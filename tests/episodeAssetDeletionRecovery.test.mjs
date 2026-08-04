import test from 'node:test';
import assert from 'node:assert/strict';
import { restoreEpisodeAssetDeletionMetadata } from '../lib/episodeAssetDeletionRecovery.mjs';
import {
  removeEpisodeAssetFromEpisode,
  updateEpisodePhotoSelection,
} from '../lib/episodeStudioPresentation.mjs';

function sampleEpisode() {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    target_release_date: '2026-09-01',
    host_person_ids: ['host-one'],
    producer_person_id: 'producer-one',
    assets: [
      {
        asset_id: 'asset-one',
        object_key:
          'episodes/episode-one/recording/asset-12345678-1234-4123-8123-123456789abc-proof.wav',
        object_version_id: 'version-one',
        file_name: 'proof.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'recording',
        deliverable_id: 'producer-proof-audio',
        status: 'uploaded',
      },
    ],
    production_tasks: [
      {
        task_id: 'producer-proof-upload',
        label: 'Upload proof',
        status: 'complete',
        evidence_asset_id: 'asset-one',
      },
    ],
    created_at: '2026-08-01T12:00:00.000Z',
    updated_at: '2026-08-04T12:00:00.000Z',
  };
}

test('asset-delete rollback restores only deletion-owned fields on a fresher episode', () => {
  const before = sampleEpisode();
  const after = removeEpisodeAssetFromEpisode(before, 'asset-one');
  const concurrent = {
    ...after,
    title: 'Producer changed this title',
    updated_at: '2026-08-04T12:05:00.000Z',
  };

  const restored = restoreEpisodeAssetDeletionMetadata(concurrent, {
    beforeDeletion: before,
    afterDeletion: after,
    assetId: 'asset-one',
  });
  assert.equal(restored.title, 'Producer changed this title');
  assert.equal(
    restored.assets.some((asset) => asset.asset_id === 'asset-one'),
    true
  );
  assert.equal(
    restored.production_tasks.find(
      (task) => task.task_id === 'producer-proof-upload'
    ).status,
    'complete'
  );
});

test('asset-delete rollback restores a confirmed photo choice without overwriting concurrent copy', () => {
  const before = updateEpisodePhotoSelection(
    {
      ...sampleEpisode(),
      assets: [1, 2, 3].map((index) => ({
        asset_id: `photo-${index}`,
        object_key: `episodes/episode-one/image/photo-${index}.jpg`,
        object_version_id: `version-${index}`,
        file_name: `photo-${index}.jpg`,
        content_type: 'image/jpeg',
        size: 100,
        category: 'image',
        deliverable_id: 'photos',
        status: 'uploaded',
      })),
    },
    {
      status: 'confirmed',
      items: [1, 2, 3].map((index) => ({ asset_id: `photo-${index}` })),
    },
    { personId: 'producer-one', personName: 'Producer One' },
    { now: '2026-08-04T12:01:00.000Z' }
  );
  const after = removeEpisodeAssetFromEpisode(before, 'photo-1', {
    personId: 'producer-one',
    personName: 'Producer One',
    updatedAt: '2026-08-04T12:02:00.000Z',
  });
  const concurrent = {
    ...after,
    deliverables: after.deliverables.map((deliverable) =>
      deliverable.id === 'photos'
        ? { ...deliverable, value: 'Concurrent producer caption.' }
        : deliverable
    ),
    updated_at: '2026-08-04T12:05:00.000Z',
  };

  const restored = restoreEpisodeAssetDeletionMetadata(concurrent, {
    beforeDeletion: before,
    afterDeletion: after,
    assetId: 'photo-1',
  });
  const photos = restored.deliverables.find(
    (deliverable) => deliverable.id === 'photos'
  );
  assert.equal(photos.value, 'Concurrent producer caption.');
  assert.equal(photos.photo_selection.status, 'confirmed');
  assert.deepEqual(
    photos.photo_selection.items.map((item) => item.asset_id),
    ['photo-1', 'photo-2', 'photo-3']
  );
});
