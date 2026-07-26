import { ADMIN_PERMISSIONS } from '../../../../../../lib/adminAuth';
import { requireEpisodeStudioAccess } from '../../../../../../lib/episodeStudioAccess';
import {
  createEpisodeAssetUpload,
  isEpisodeAssetStorageConfigured,
} from '../../../../../../lib/episodeAssetStorage';
import {
  canUploadEpisodeAssets,
  findDuplicateEpisodeAsset,
  MAX_EPISODE_ASSETS,
  validateEpisodeAssetInput,
} from '../../../../../../lib/episodeAssetPolicy.mjs';

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
        : 'Only an assigned host or producer can upload episode source files.',
    });
  }
  if (access.episode.assets.length >= MAX_EPISODE_ASSETS) {
    return res.status(409).json({
      ok: false,
      code: 'EPISODE_ASSET_LIMIT_REACHED',
      error: `This episode already has the maximum of ${MAX_EPISODE_ASSETS} source files.`,
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
  const deliverableId = String(req.body?.deliverable_id || '').trim();
  const deliverable = access.episode.deliverables.find(
    (candidate) => candidate.id === deliverableId
  );
  if (!deliverable) {
    return res.status(400).json({
      ok: false,
      error:
        'Choose the episode step this file belongs to before starting the upload.',
    });
  }
  try {
    const requestedFile =
      req.body?.file && typeof req.body.file === 'object'
        ? req.body.file
        : {};
    const input = validateEpisodeAssetInput({
      ...requestedFile,
      category: deliverable.asset_category || 'other',
    });
    const duplicate = findDuplicateEpisodeAsset(access.episode.assets, {
      ...input,
      deliverable_id: deliverable.id,
    });
    if (duplicate) {
      return res.status(409).json({
        ok: false,
        code: 'EPISODE_ASSET_DUPLICATE',
        duplicate_asset_id: duplicate.asset_id,
        error: `“${input.file_name}” is already uploaded to this episode step. Delete the existing copy first if you intend to replace it.`,
      });
    }
    const upload = createEpisodeAssetUpload({
      episodeId,
      uploaderPersonId: access.binding?.person_id,
      deliverableId: deliverable.id,
      file: input,
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
