import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import {
  createEpisodeAssetUpload,
  isEpisodeAssetStorageConfigured,
} from '../../../../../../lib/episodeAssetStorage';

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
      error: 'Only an assigned host can upload the final episode package.',
    });
  }
  if (HOST_LOCKED_STATUSES.includes(access.episode.status)) {
    return res.status(409).json({
      ok: false,
      error:
        'The final package is locked while it is with the producer. Request changes before uploading a replacement.',
    });
  }
  if (!isEpisodeAssetStorageConfigured()) {
    return res.status(503).json({
      ok: false,
      code: 'EPISODE_ASSET_STORAGE_NOT_CONFIGURED',
      error:
        'Direct episode uploads are ready but object storage is not configured for this environment.',
    });
  }
  try {
    const upload = createEpisodeAssetUpload({
      episodeId,
      uploaderPersonId: access.binding?.person_id,
      file: req.body?.file,
    });
    return res.status(200).json({ ok: true, upload });
  } catch (error) {
    const validation = /Episode asset:/i.test(String(error.message || ''));
    return res.status(validation ? 400 : 500).json({
      ok: false,
      error: validation
        ? error.message
        : 'Could not authorize the episode upload.',
    });
  }
}
