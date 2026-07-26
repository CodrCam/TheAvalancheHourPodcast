import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { createEpisodeAssetDownloadUrl } from '../../../../../../lib/episodeAssetStorage';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import { isEpisodeAssetExpired } from '../../../../../../lib/episodeStudioPresentation.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const episodeId = String(req.query.episodeId || '').trim();
  const access = await requireEpisodeStudioAccess(
    req,
    res,
    episodeId,
    ADMIN_PERMISSIONS.EPISODES_READ
  );
  if (!access) return;
  const assetId = String(req.query.assetId || '').trim();
  const asset = access.episode.assets.find(
    (candidate) => candidate.asset_id === assetId
  );
  if (!asset) {
    return res.status(404).json({ ok: false, error: 'Episode asset not found.' });
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
