import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../../lib/adminAudit';
import {
  createEpisodeAssetDownloadUrl,
  deleteEpisodeAssetObject,
} from '../../../../../../lib/episodeAssetStorage';
import { canDeleteEpisodeAsset } from '../../../../../../lib/episodeAssetPolicy.mjs';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import {
  isEpisodeAssetExpired,
  removeEpisodeAssetFromEpisode,
  sanitizeEpisodeStudioForViewer,
} from '../../../../../../lib/episodeStudioPresentation.mjs';
import {
  getEpisodeStudio,
  saveEpisodeStudio,
} from '../../../../../../lib/episodeStudioStore';

export default async function handler(req, res) {
  if (!['GET', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const episodeId = String(req.query.episodeId || '').trim();
  const access = await requireEpisodeStudioAccess(
    req,
    res,
    episodeId,
    req.method === 'DELETE'
      ? ADMIN_PERMISSIONS.EPISODES_UPDATE
      : ADMIN_PERMISSIONS.EPISODES_READ
  );
  if (!access) return;
  const assetId = String(req.query.assetId || '').trim();
  const asset = access.episode.assets.find(
    (candidate) => candidate.asset_id === assetId
  );
  if (!asset) {
    return res.status(404).json({ ok: false, error: 'Episode asset not found.' });
  }

  if (req.method === 'DELETE') {
    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }
    if (
      !canDeleteEpisodeAsset({
        roles: access.roles,
        status: access.episode.status,
        canManage: access.canManage,
        viewerPersonId: access.binding?.person_id,
        uploaderPersonId: asset.uploaded_by_person_id,
      })
    ) {
      return res.status(403).json({
        ok: false,
        error:
          'Only the assigned producer, a Studio manager, or the host who uploaded this file can delete it at this stage.',
      });
    }
    const expectedUpdatedAt = String(
      req.body?.expected_updated_at || ''
    ).trim();
    if (
      !expectedUpdatedAt ||
      expectedUpdatedAt !== access.episode.updated_at
    ) {
      return res.status(409).json({
        ok: false,
        error:
          'This Episode Studio changed in another session. Refresh before deleting the file.',
      });
    }

    try {
      await deleteEpisodeAssetObject(asset.object_key, {
        episodeId,
        versionId: asset.object_version_id,
      });

      let saved;
      try {
        saved = await saveEpisodeStudio(
          removeEpisodeAssetFromEpisode(access.episode, assetId),
          { expectedUpdatedAt: access.episode.updated_at }
        );
      } catch (saveError) {
        if (!/conditional/i.test(String(saveError?.message || ''))) {
          throw saveError;
        }
        const latest = await getEpisodeStudio(episodeId);
        const latestAsset = latest.episode?.assets?.find(
          (candidate) => candidate.asset_id === assetId
        );
        if (!latestAsset) {
          saved = latest;
        } else {
          saved = await saveEpisodeStudio(
            removeEpisodeAssetFromEpisode(latest.episode, assetId),
            { expectedUpdatedAt: latest.episode.updated_at }
          );
        }
      }

      logAdminAction(req, access.principal, 'episode_studio.asset_delete', {
        episode_id: episodeId,
        asset_id: asset.asset_id,
        category: asset.category,
        content_type: asset.content_type,
        size: asset.size,
        object_version_id: asset.object_version_id,
      });
      return res.status(200).json({
        ok: true,
        episode: sanitizeEpisodeStudioForViewer(saved.episode),
        deleted_asset_id: asset.asset_id,
      });
    } catch (error) {
      const message = String(error?.message || '');
      const storage = /secure storage could not delete/i.test(message);
      const invalidVersion = /stored object version is invalid/i.test(message);
      const conflict = /conditional/i.test(message);
      return res
        .status(storage ? 502 : invalidVersion || conflict ? 409 : 500)
        .json({
          ok: false,
          error: storage
            ? 'Secure storage did not allow this exact file version to be deleted. The file was not removed from the episode.'
            : invalidVersion
              ? 'This file is missing its immutable storage version and cannot be deleted safely.'
              : conflict
                ? 'This Episode Studio changed while the file was being deleted. Refresh to confirm its current state.'
                : 'Could not delete this episode file.',
        });
    }
  }

  if (isEpisodeAssetExpired(asset)) {
    return res.status(410).json({
      ok: false,
      error:
        'This temporary production asset reached the end of its 180-day storage window.',
    });
  }
  try {
    res.setHeader('Cache-Control', 'no-store, private');
    return res.redirect(
      302,
      createEpisodeAssetDownloadUrl(asset.object_key, {
        episodeId,
        fileName: asset.file_name,
        versionId: asset.object_version_id,
      })
    );
  } catch (error) {
    const missingVersion = /stored object version is invalid/i.test(
      String(error?.message || '')
    );
    return res.status(missingVersion ? 409 : 503).json({
      ok: false,
      error: missingVersion
        ? 'This episode asset is missing its immutable storage version and cannot be downloaded safely.'
        : 'Episode asset downloads are not configured in this environment.',
    });
  }
}
