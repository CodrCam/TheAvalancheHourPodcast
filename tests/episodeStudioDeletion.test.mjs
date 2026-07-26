import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EpisodeStudioAssetCleanupError,
  deleteEpisodeStudioWithAssets,
  getEpisodeStudioDeletionPlan,
} from '../lib/episodeStudioDeletion.mjs';

function studioWithAssets() {
  return {
    episode_id: 'episode-one',
    title: 'Field Notes',
    assets: [
      {
        asset_id: 'asset-one',
        object_key:
          'episodes/episode-one/recording/asset-11111111-1111-4111-8111-111111111111-one.wav',
        object_version_id: 'version-one',
        file_name: 'one.wav',
        content_type: 'audio/wav',
        size: 1024,
        category: 'recording',
      },
      {
        asset_id: 'asset-two',
        object_key:
          'episodes/episode-one/image/asset-22222222-2222-4222-8222-222222222222-two.jpg',
        object_version_id: 'version-two',
        file_name: 'two.jpg',
        content_type: 'image/jpeg',
        size: 2048,
        category: 'image',
      },
    ],
  };
}

test('builds an exact deletion plan for every stored asset version', () => {
  const plan = getEpisodeStudioDeletionPlan(studioWithAssets());

  assert.equal(plan.episode_id, 'episode-one');
  assert.equal(plan.asset_count, 2);
  assert.equal(plan.asset_bytes, 3072);
  assert.deepEqual(
    plan.assets.map((asset) => asset.object_version_id),
    ['version-one', 'version-two']
  );
});

test('deletes every stored asset before deleting the Studio record', async () => {
  const events = [];
  const result = await deleteEpisodeStudioWithAssets(studioWithAssets(), {
    deleteAsset: async (asset) => {
      events.push(`asset:${asset.asset_id}`);
    },
    deleteRecord: async () => {
      events.push('record');
    },
  });

  assert.equal(events.at(-1), 'record');
  assert.deepEqual(new Set(events.slice(0, -1)), new Set([
    'asset:asset-one',
    'asset:asset-two',
  ]));
  assert.deepEqual(result, {
    episode_id: 'episode-one',
    title: 'Field Notes',
    deleted_asset_count: 2,
    deleted_asset_bytes: 3072,
  });
});

test('keeps the Studio record when any stored asset cannot be deleted', async () => {
  let recordDeleted = false;

  await assert.rejects(
    deleteEpisodeStudioWithAssets(studioWithAssets(), {
      deleteAsset: async (asset) => {
        if (asset.asset_id === 'asset-two') {
          throw new Error('S3 unavailable');
        }
      },
      deleteRecord: async () => {
        recordDeleted = true;
      },
    }),
    (error) => {
      assert.equal(error instanceof EpisodeStudioAssetCleanupError, true);
      assert.equal(error.deletedAssets.length, 1);
      assert.deepEqual(error.failedAssets, [
        { asset_id: 'asset-two', file_name: 'two.jpg' },
      ]);
      return true;
    }
  );

  assert.equal(recordDeleted, false);
});
