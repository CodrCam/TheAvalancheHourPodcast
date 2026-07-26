import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../../lib/adminAudit';
import {
  deleteEpisodeAssetObject,
  verifyEpisodeAssetObject,
  verifyEpisodeAssetUploadToken,
} from '../../../../../../lib/episodeAssetStorage';
import {
  canUploadEpisodeAssets,
  episodeAssetMatchesUploadAuthorization,
  findDuplicateEpisodeAsset,
  MAX_EPISODE_ASSETS,
} from '../../../../../../lib/episodeAssetPolicy.mjs';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import {
  EPISODE_ASSET_RETENTION_DAYS,
  getEpisodeAssetRetentionExpiresAt,
  normalizeEpisodeStudio,
  sanitizeEpisodeStudioForViewer,
} from '../../../../../../lib/episodeStudioPresentation.mjs';
import { saveEpisodeStudio } from '../../../../../../lib/episodeStudioStore';
import { listPeople } from '../../../../../../lib/peopleStore';
import {
  publishEpisodeNotifications,
} from '../../../../../../lib/episodeStudioEvents';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  if (!req.headers['content-type']?.includes('application/json')) {
    return res
      .status(400)
      .json({ ok: false, error: 'Content-Type must be application/json' });
  }
  const episodeId = String(req.query.episodeId || '').trim();
  const access = await requireEpisodeStudioAccess(
    req,
    res,
    episodeId,
    ADMIN_PERMISSIONS.EPISODES_UPDATE
  );
  if (!access) return;
  try {
    const payload = verifyEpisodeAssetUploadToken(
      req.body?.upload_token,
      episodeId
    );
    if (payload.uploader_person_id !== access.binding?.person_id) {
      return res.status(403).json({
        ok: false,
        error: 'This upload authorization belongs to another Studio profile.',
      });
    }
    const existingAsset = access.episode.assets.find(
      (candidate) => candidate.asset_id === payload.asset_id
    );
    if (existingAsset) {
      if (
        !episodeAssetMatchesUploadAuthorization(existingAsset, payload)
      ) {
        return res.status(409).json({
          ok: false,
          code: 'EPISODE_ASSET_COMPLETION_CONFLICT',
          error:
            'This upload authorization conflicts with an existing episode file.',
        });
      }
      const safeEpisode = sanitizeEpisodeStudioForViewer(access.episode);
      return res.status(200).json({
        ok: true,
        already_completed: true,
        episode: safeEpisode,
        asset: safeEpisode.assets.find(
          (candidate) => candidate.asset_id === payload.asset_id
        ),
      });
    }
    if (
      !canUploadEpisodeAssets({
        roles: access.roles,
        status: access.episode.status,
      })
    ) {
      const assignedUploader = access.roles.some((role) =>
        ['host', 'producer'].includes(role)
      );
      return res.status(assignedUploader ? 409 : 403).json({
        ok: false,
        error: assignedUploader
          ? 'Episode source files are locked at this stage of production.'
          : 'Only an assigned host or producer can complete an episode upload.',
      });
    }
    if (access.episode.assets.length >= MAX_EPISODE_ASSETS) {
      return res.status(409).json({
        ok: false,
        code: 'EPISODE_ASSET_LIMIT_REACHED',
        error: `This episode already has the maximum of ${MAX_EPISODE_ASSETS} source files. The uploaded object was not attached.`,
      });
    }
    const requestedDeliverableId = String(
      req.body?.deliverable_id || ''
    ).trim();
    const deliverable = access.episode.deliverables.find(
      (candidate) => candidate.id === payload.deliverable_id
    );
    if (
      !requestedDeliverableId ||
      requestedDeliverableId !== payload.deliverable_id ||
      !deliverable
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'This upload authorization does not match the selected episode step. Start the upload again.',
      });
    }
    const deliverableCategory = deliverable.asset_category || 'other';
    if (payload.category !== deliverableCategory) {
      return res.status(409).json({
        ok: false,
        error:
          'This episode step changed during the upload. Refresh and upload the file again.',
      });
    }
    const duplicate = findDuplicateEpisodeAsset(access.episode.assets, {
      ...payload,
      deliverable_id: deliverable.id,
    });
    if (duplicate) {
      try {
        const duplicateObject = await verifyEpisodeAssetObject(payload);
        await deleteEpisodeAssetObject(payload.object_key, {
          episodeId,
          versionId: duplicateObject.object_version_id,
        });
      } catch (cleanupError) {
        console.error(
          'duplicate episode asset cleanup failed:',
          cleanupError
        );
      }
      return res.status(409).json({
        ok: false,
        code: 'EPISODE_ASSET_DUPLICATE',
        duplicate_asset_id: duplicate.asset_id,
        error: `“${payload.file_name}” is already uploaded to this episode step. The duplicate was not attached.`,
      });
    }
    const verifiedObject = await verifyEpisodeAssetObject(payload);
    const peopleResult = await listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    });
    const person = peopleResult.people.find(
      (candidate) => candidate.person_id === access.binding?.person_id
    );
    const uploadedAt = verifiedObject.uploaded_at;
    const asset = {
      asset_id: payload.asset_id,
      object_key: payload.object_key,
      file_name: payload.file_name,
      content_type: payload.content_type,
      size: payload.size,
      category: payload.category,
      object_version_id: verifiedObject.object_version_id,
      label: payload.file_name,
      notes: String(req.body?.notes || '').trim().slice(0, 2000),
      deliverable_id: payload.deliverable_id,
      uploaded_at: uploadedAt,
      uploaded_by_person_id: access.binding?.person_id || '',
      uploaded_by_name:
        person?.name ||
        access.principal.displayName ||
        access.principal.username ||
        'Studio participant',
      retention_days: EPISODE_ASSET_RETENTION_DAYS,
      retention_expires_at: getEpisodeAssetRetentionExpiresAt(
        uploadedAt,
        EPISODE_ASSET_RETENTION_DAYS
      ),
      status: 'uploaded',
    };
    const episode = normalizeEpisodeStudio({
      ...access.episode,
      assets: [
        ...access.episode.assets.filter(
          (candidate) => candidate.asset_id !== asset.asset_id
        ),
        asset,
      ],
    });
    if (
      episode.assets.length > MAX_EPISODE_ASSETS ||
      !episode.assets.some(
        (candidate) => candidate.asset_id === asset.asset_id
      )
    ) {
      throw new Error(
        `Episode asset: this episode cannot hold more than ${MAX_EPISODE_ASSETS} source files.`
      );
    }
    const saved = await saveEpisodeStudio(episode, {
      // Bind the write to the episode version read at completion time. A large
      // upload should not fail merely because its browser snapshot is old.
      expectedUpdatedAt: access.episode.updated_at,
    });
    logAdminAction(req, access.principal, 'episode_studio.asset_upload', {
      episode_id: episodeId,
      asset_id: asset.asset_id,
      category: asset.category,
      content_type: asset.content_type,
      size: asset.size,
    });
    try {
      await publishEpisodeNotifications({
        previousEpisode: access.episode,
        episode: saved.episode,
        action: 'asset_uploaded',
        actorPersonId: access.binding?.person_id || '',
        actorName: asset.uploaded_by_name,
        event: { asset },
      });
    } catch (notificationError) {
      console.error(
        'episode asset notification generation failed:',
        notificationError
      );
    }
    const safeEpisode = sanitizeEpisodeStudioForViewer(saved.episode);
    return res.status(201).json({
      ok: true,
      episode: safeEpisode,
      asset: safeEpisode.assets.find(
        (candidate) => candidate.asset_id === asset.asset_id
      ),
    });
  } catch (error) {
    const message = String(error.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Episode asset:/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      ...(conflict ? { code: 'EPISODE_ASSET_COMPLETION_RACE' } : {}),
      error: conflict
        ? 'The Episode Studio changed during the upload. Refresh before attaching the file.'
        : validation
          ? message
          : 'Could not verify and attach the uploaded file.',
    });
  }
}
