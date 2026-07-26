import { normalizeEpisodeStudio } from './episodeStudioPresentation.mjs';

const DELETE_BATCH_SIZE = 5;

export class EpisodeStudioAssetCleanupError extends Error {
  constructor({ deletedAssets = [], failedAssets = [] } = {}) {
    super(
      `Episode Studio asset cleanup failed for ${failedAssets.length} file${
        failedAssets.length === 1 ? '' : 's'
      }.`
    );
    this.name = 'EpisodeStudioAssetCleanupError';
    this.code = 'EPISODE_STUDIO_ASSET_CLEANUP_FAILED';
    this.deletedAssets = deletedAssets;
    this.failedAssets = failedAssets;
  }
}

export function getEpisodeStudioDeletionPlan(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  const seenObjects = new Set();
  const assets = episode.assets.filter((asset) => {
    const identity = `${asset.object_key}\n${asset.object_version_id}`;
    if (seenObjects.has(identity)) return false;
    seenObjects.add(identity);
    return true;
  });

  return {
    episode_id: episode.episode_id,
    title: episode.title,
    asset_count: assets.length,
    asset_bytes: assets.reduce(
      (total, asset) => total + Math.max(0, Number(asset.size) || 0),
      0
    ),
    assets,
  };
}

export async function deleteEpisodeStudioWithAssets(
  value,
  { deleteAsset, deleteRecord } = {}
) {
  if (typeof deleteAsset !== 'function' || typeof deleteRecord !== 'function') {
    throw new Error(
      'Episode Studio deletion requires storage and record deletion handlers.'
    );
  }

  const plan = getEpisodeStudioDeletionPlan(value);
  const deletedAssets = [];
  const failedAssets = [];

  for (let index = 0; index < plan.assets.length; index += DELETE_BATCH_SIZE) {
    const batch = plan.assets.slice(index, index + DELETE_BATCH_SIZE);
    const results = await Promise.allSettled(
      batch.map((asset) => deleteAsset(asset, plan))
    );

    results.forEach((result, resultIndex) => {
      const asset = batch[resultIndex];
      if (result.status === 'fulfilled') {
        deletedAssets.push(asset);
      } else {
        failedAssets.push({
          asset_id: asset.asset_id,
          file_name: asset.file_name,
        });
      }
    });
  }

  if (failedAssets.length) {
    throw new EpisodeStudioAssetCleanupError({
      deletedAssets,
      failedAssets,
    });
  }

  await deleteRecord(plan);

  return {
    episode_id: plan.episode_id,
    title: plan.title,
    deleted_asset_count: deletedAssets.length,
    deleted_asset_bytes: plan.asset_bytes,
  };
}
