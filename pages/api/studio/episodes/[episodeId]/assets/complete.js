import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../../lib/adminAudit';
import {
  verifyEpisodeAssetObject,
  verifyEpisodeAssetUploadToken,
} from '../../../../../../lib/episodeAssetStorage';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import {
  EPISODE_ASSET_RETENTION_DAYS,
  getEpisodeAssetRetentionExpiresAt,
  normalizeEpisodeStudio,
  sanitizeEpisodeStudioForViewer,
} from '../../../../../../lib/episodeStudioPresentation.mjs';
import { saveEpisodeStudio } from '../../../../../../lib/episodeStudioStore';
import { listPeople } from '../../../../../../lib/peopleStore';

const HOST_LOCKED_STATUSES = ['submitted', 'submitted_with_gaps', 'accepted'];

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
  if (!access.roles.includes('host')) {
    return res.status(403).json({
      ok: false,
      error: 'Only an assigned host can complete an episode upload.',
    });
  }
  if (HOST_LOCKED_STATUSES.includes(access.episode.status)) {
    return res.status(409).json({
      ok: false,
      error: 'The final package is locked while it is with the producer.',
    });
  }
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
    const deliverableId = String(
      req.body?.deliverable_id || ''
    ).trim();
    if (
      !deliverableId ||
      !access.episode.deliverables.some(
        (deliverable) => deliverable.id === deliverableId
      )
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'Choose the episode step this file belongs to before attaching it.',
      });
    }
    await verifyEpisodeAssetObject(payload);
    const peopleResult = await listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    });
    const person = peopleResult.people.find(
      (candidate) => candidate.person_id === access.binding?.person_id
    );
    const uploadedAt = new Date().toISOString();
    const asset = {
      asset_id: payload.asset_id,
      object_key: payload.object_key,
      file_name: payload.file_name,
      content_type: payload.content_type,
      size: payload.size,
      category: payload.category,
      label: String(req.body?.label || '').trim().slice(0, 220),
      notes: String(req.body?.notes || '').trim().slice(0, 2000),
      deliverable_id: deliverableId,
      uploaded_at: uploadedAt,
      uploaded_by_person_id: access.binding?.person_id || '',
      uploaded_by_name:
        person?.name ||
        access.principal.displayName ||
        access.principal.username ||
        'Assigned host',
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
    const saved = await saveEpisodeStudio(episode, {
      expectedUpdatedAt: String(req.body?.expected_updated_at || ''),
    });
    logAdminAction(req, access.principal, 'episode_studio.asset_upload', {
      episode_id: episodeId,
      asset_id: asset.asset_id,
      category: asset.category,
      content_type: asset.content_type,
      size: asset.size,
    });
    return res.status(201).json({
      ok: true,
      episode: sanitizeEpisodeStudioForViewer(saved.episode),
      asset: sanitizeEpisodeStudioForViewer(saved.episode).assets.find(
        (candidate) => candidate.asset_id === asset.asset_id
      ),
    });
  } catch (error) {
    const message = String(error.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Episode asset:/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'The Episode Studio changed during the upload. Refresh before attaching the file.'
        : validation
          ? message
          : 'Could not verify and attach the uploaded file.',
    });
  }
}
