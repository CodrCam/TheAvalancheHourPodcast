import test from 'node:test';
import assert from 'node:assert/strict';
import { runStudioReminderGeneration } from '../lib/studioReminderService.js';

test('scheduled deletion cleanup still runs when reminder delivery fails', async (t) => {
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  let cleanupCalled = false;
  const result = await runStudioReminderGeneration({
    listEpisodes: async () => ({
      configured: true,
      episodes: [
        {
          episode_id: 'deleted-episode',
          deleted_at: '2026-08-04T12:00:00.000Z',
        },
      ],
    }),
    loadMicKitTracker: async () => ({ tracker: {} }),
    createNotifications: async () => {
      throw new Error('notification store unavailable');
    },
    runDeletionCleanup: async (episodes) => {
      cleanupCalled = true;
      assert.equal(episodes.length, 1);
      return { pending: 0, swept: 1, finalized: 0, failed: 0 };
    },
    adminPersonIds: [],
    managerPersonIds: [],
  });

  assert.equal(cleanupCalled, true);
  assert.equal(result.notification_failed, true);
  assert.deepEqual(result.deletion_cleanup, {
    pending: 0,
    swept: 1,
    finalized: 0,
    failed: 0,
  });
});

test('reminder delivery still completes when deletion cleanup fails', async (t) => {
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  const result = await runStudioReminderGeneration({
    listEpisodes: async () => ({ configured: true, episodes: [] }),
    loadMicKitTracker: async () => ({ tracker: {} }),
    createNotifications: async () => [
      { created: true, configured: true },
    ],
    runDeletionCleanup: async () => {
      throw new Error('storage unavailable');
    },
    adminPersonIds: [],
    managerPersonIds: [],
  });

  assert.equal(result.created, 1);
  assert.equal(result.notification_failed, false);
  assert.deepEqual(result.deletion_cleanup, {
    pending: 0,
    swept: 0,
    finalized: 0,
    purged: 0,
    failed: 1,
  });
});

test('deletion cleanup starts even when mic-kit reminder loading fails', async (t) => {
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  let cleanupCalled = false;
  const result = await runStudioReminderGeneration({
    listEpisodes: async () => ({ configured: true, episodes: [] }),
    loadMicKitTracker: async () => {
      throw new Error('mic-kit store unavailable');
    },
    createNotifications: async () => [],
    runDeletionCleanup: async () => {
      cleanupCalled = true;
      return { pending: 0, swept: 0, finalized: 0, failed: 0 };
    },
    adminPersonIds: [],
    managerPersonIds: [],
  });

  assert.equal(cleanupCalled, true);
  assert.equal(result.mic_kit_load_failed, true);
  assert.equal(result.notification_failed, false);
});
