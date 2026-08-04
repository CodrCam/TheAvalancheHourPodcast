import assert from 'node:assert/strict';
import test from 'node:test';
import {
  applyEpisodeProductionTaskUpdate,
  createDefaultEpisodeProductionTasks,
  getEpisodeProductionPlanSummary,
  isEpisodeProductionTaskComplete,
} from '../lib/episodeProductionPlan.mjs';
import {
  EPISODE_FINAL_PHOTO_COUNT,
  buildEpisodePhotoSelection,
  isEpisodePhotoSelectionConfirmed,
  sanitizeEpisodePhotoSelectionForViewer,
} from '../lib/episodePhotoSelection.mjs';
import {
  createDefaultEpisodeDeliverables,
  isDeliverableComplete,
  removeEpisodeAssetFromEpisode,
  sanitizeEpisodeStudioForViewer,
  updateEpisodePhotoSelection,
} from '../lib/episodeStudioPresentation.mjs';

const NOW = new Date('2026-08-04T18:00:00.000Z');

function photoAsset(index, overrides = {}) {
  return {
    asset_id: `photo-${index}`,
    object_key: `episodes/episode-one/image/photo-${index}.jpg`,
    object_version_id: `version-${index}`,
    file_name: `photo-${index}.jpg`,
    content_type: 'image/jpeg',
    size: 100 + index,
    category: 'image',
    deliverable_id: 'photos',
    uploaded_at: '2026-08-04T12:00:00.000Z',
    retention_expires_at: '2027-02-01T12:00:00.000Z',
    status: 'uploaded',
    ...overrides,
  };
}

function selectionItems() {
  return [1, 2, 3].map((index) => ({
    asset_id: `photo-${index}`,
    needs_crop: index === 1,
    needs_editing: index === 2,
    editing_notes: index === 1 ? 'Crop square around the guest.' : '',
  }));
}

function episode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    target_release_date: '2026-08-31',
    host_person_ids: ['host-one'],
    producer_person_id: 'producer-one',
    deliverables: createDefaultEpisodeDeliverables(),
    assets: [1, 2, 3, 4, 5].map(photoAsset),
    production_tasks: createDefaultEpisodeProductionTasks('2026-08-31'),
    ...overrides,
  };
}

test('final photo review binds exactly three ordered choices to immutable versions', () => {
  const assets = [1, 2, 3, 4].map(photoAsset);
  const selection = buildEpisodePhotoSelection(
    {},
    {
      status: 'confirmed',
      items: selectionItems().map((item) => ({
        ...item,
        object_version_id: 'client-cannot-choose-this',
      })),
      general_notes: 'Use the first image as the cover.',
    },
    assets,
    { personId: 'producer-one', personName: 'Producer One' },
    { now: NOW }
  );

  assert.equal(selection.status, 'confirmed');
  assert.equal(selection.items.length, EPISODE_FINAL_PHOTO_COUNT);
  assert.deepEqual(
    selection.items.map((item) => item.object_version_id),
    ['version-1', 'version-2', 'version-3']
  );
  assert.deepEqual(
    selection.items.map((item) => item.position),
    [1, 2, 3]
  );
  assert.equal(selection.confirmed_by_person_id, 'producer-one');
  assert.equal(isEpisodePhotoSelectionConfirmed(selection, assets, { now: NOW }), true);

  const safe = sanitizeEpisodePhotoSelectionForViewer(selection);
  assert.equal(safe.items.every((item) => item.version_bound), true);
  assert.equal(
    safe.items.some((item) => 'object_version_id' in item),
    false
  );
  const viewerAssets = assets.map(({ object_key, object_version_id, ...asset }) => ({
    ...asset,
    storage_verified: Boolean(object_key && object_version_id),
  }));
  assert.equal(
    isEpisodePhotoSelectionConfirmed(safe, viewerAssets, { now: NOW }),
    true
  );
});

test('photo confirmation rejects missing, duplicate, expired, and unversioned assets', () => {
  const assets = [1, 2, 3].map(photoAsset);
  assert.throws(
    () =>
      buildEpisodePhotoSelection(
        {},
        { status: 'confirmed', items: selectionItems().slice(0, 2) },
        assets,
        {},
        { now: NOW }
      ),
    /exactly 3 images/i
  );
  assert.throws(
    () =>
      buildEpisodePhotoSelection(
        {},
        {
          status: 'draft',
          items: [selectionItems()[0], selectionItems()[0]],
        },
        assets,
        {},
        { now: NOW }
      ),
    /only once/i
  );
  assert.throws(
    () =>
      buildEpisodePhotoSelection(
        {},
        { status: 'draft', items: [selectionItems()[0]] },
        [photoAsset(1, { object_version_id: '' })],
        {},
        { now: NOW }
      ),
    /immutable storage version/i
  );
  assert.throws(
    () =>
      buildEpisodePhotoSelection(
        {},
        { status: 'draft', items: [selectionItems()[0]] },
        [
          photoAsset(1, {
            retention_expires_at: '2026-08-03T12:00:00.000Z',
          }),
        ],
        {},
        { now: NOW }
      ),
    /unavailable/i
  );
});

test('the photos deliverable and production task stay open until the exact set is confirmed', () => {
  const base = episode();
  const photos = base.deliverables.find((item) => item.id === 'photos');
  assert.equal(isDeliverableComplete(photos, base.assets), false);

  const confirmed = updateEpisodePhotoSelection(
    base,
    {
      status: 'confirmed',
      items: selectionItems(),
      general_notes: 'First image is the cover.',
    },
    { personId: 'host-one', personName: 'Host One' },
    { now: NOW }
  );
  const confirmedPhotos = confirmed.deliverables.find(
    (item) => item.id === 'photos'
  );
  assert.equal(isDeliverableComplete(confirmedPhotos, confirmed.assets), true);

  const safe = sanitizeEpisodeStudioForViewer(confirmed);
  const safePhotos = safe.deliverables.find((item) => item.id === 'photos');
  assert.equal(isDeliverableComplete(safePhotos, safe.assets), true);

  const removed = removeEpisodeAssetFromEpisode(confirmed, 'photo-1');
  const removedPhotos = removed.deliverables.find((item) => item.id === 'photos');
  assert.equal(removedPhotos.photo_selection.status, 'draft');
  assert.equal(removedPhotos.photo_selection.items.length, 2);
  assert.equal(isDeliverableComplete(removedPhotos, removed.assets), false);
});

test('show-notes handoff cannot complete before the final photo confirmation and reopens dynamically', () => {
  const base = episode();
  base.production_tasks = base.production_tasks.map((task) =>
    task.task_id === 'edit-package-delivered'
      ? { ...task, status: 'waived' }
      : task
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        base,
        'show-notes-brief',
        { status: 'complete' },
        { personId: 'host-one', personName: 'Host One', roles: ['host'] },
        { now: NOW }
      ),
    /confirm exactly three final photos/i
  );

  const withPhotos = updateEpisodePhotoSelection(
    base,
    { status: 'confirmed', items: selectionItems() },
    { personId: 'host-one', personName: 'Host One' },
    { now: NOW }
  );
  const completed = applyEpisodeProductionTaskUpdate(
    withPhotos,
    'show-notes-brief',
    { status: 'complete' },
    { personId: 'host-one', personName: 'Host One', roles: ['host'] },
    { now: NOW }
  );
  const task = completed.production_tasks.find(
    (candidate) => candidate.task_id === 'show-notes-brief'
  );
  assert.equal(isEpisodeProductionTaskComplete(task, completed, { now: NOW }), true);

  const afterDelete = removeEpisodeAssetFromEpisode(completed, 'photo-2');
  assert.equal(
    isEpisodeProductionTaskComplete(task, afterDelete, { now: NOW }),
    false
  );
  const summary = getEpisodeProductionPlanSummary(afterDelete, { now: NOW });
  assert.equal(
    summary.task_states.find(
      (state) => state.task_id === 'show-notes-brief'
    ).complete,
    false
  );
});
