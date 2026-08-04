import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeDeletionTombstone,
  getEpisodeDeletionReadyAt,
  getEpisodeDeletionTombstonePurgeAt,
  recordEpisodeAssetUploadGrant,
} from '../lib/episodeAssetGrantLifecycle.mjs';

test('records the latest issued upload grant without shortening an existing grant', () => {
  const current = {
    episode_id: 'episode-one',
    asset_upload_grants_expire_at: '2026-08-04T14:00:00.000Z',
  };
  assert.equal(
    recordEpisodeAssetUploadGrant(
      current,
      '2026-08-04T13:00:00.000Z'
    ).asset_upload_grants_expire_at,
    '2026-08-04T14:00:00.000Z'
  );
  assert.equal(
    recordEpisodeAssetUploadGrant(
      current,
      '2026-08-04T15:00:00.000Z'
    ).asset_upload_grants_expire_at,
    '2026-08-04T15:00:00.000Z'
  );
});

test('uses the tracked grant expiry plus the safety buffer for deletion readiness', () => {
  assert.equal(
    getEpisodeDeletionReadyAt({
      deleted_at: '2026-08-04T12:00:00.000Z',
      asset_upload_grants_expire_at: '2026-08-04T12:45:00.000Z',
    }).toISOString(),
    '2026-08-04T12:46:00.000Z'
  );
});

test('keeps the legacy one-hour grant window when tracking metadata is absent', () => {
  assert.equal(
    getEpisodeDeletionReadyAt({
      deleted_at: '2026-08-04T12:00:00.000Z',
    }).toISOString(),
    '2026-08-04T13:01:00.000Z'
  );
});

test('creates a minimal tombstone without guest or episode title data', () => {
  const tombstone = createEpisodeDeletionTombstone(
    {
      schema_version: 8,
      episode_id: 'guest-name-episode',
      title: 'Guest Name Interview',
      deleted_at: '2026-08-04T12:00:00.000Z',
      asset_upload_grants_expire_at: '2026-08-04T13:00:00.000Z',
      messages: [{ body: 'private' }],
      assets: [{ file_name: 'private.wav' }],
    },
    { finalizedAt: '2026-08-04T13:01:00.000Z' }
  );
  assert.deepEqual(tombstone, {
    schema_version: 8,
    episode_id: 'guest-name-episode',
    title: 'Deleted Episode Studio',
    deleted_at: '2026-08-04T12:00:00.000Z',
    deletion_finalized_at: '2026-08-04T13:01:00.000Z',
    deletion_tombstone_purge_at: '2026-09-03T13:01:00.000Z',
    asset_upload_grants_expire_at: '2026-08-04T13:00:00.000Z',
    archived: true,
    archived_at: '2026-08-04T13:01:00.000Z',
    created_at: '2026-08-04T13:01:00.000Z',
    updated_at: '2026-08-04T13:01:00.000Z',
  });
  assert.doesNotMatch(JSON.stringify(tombstone), /Guest Name|private\.wav/);
});

test('bounds legacy and current cleanup markers to a 30-day privacy window', () => {
  assert.equal(
    getEpisodeDeletionTombstonePurgeAt({
      deletion_finalized_at: '2026-08-04T13:01:00.000Z',
    }).toISOString(),
    '2026-09-03T13:01:00.000Z'
  );
  assert.equal(
    getEpisodeDeletionTombstonePurgeAt({
      deletion_finalized_at: '2026-08-04T13:01:00.000Z',
      deletion_tombstone_purge_at: '2026-08-11T13:01:00.000Z',
    }).toISOString(),
    '2026-08-11T13:01:00.000Z'
  );
});
