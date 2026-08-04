import test from 'node:test';
import assert from 'node:assert/strict';
import {
  finalizeEpisodeStudioDeletion,
  runEpisodeStudioDeletionCleanup,
} from '../lib/episodeStudioDeletionCleanup.js';

function deletionEpisode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    title: 'Guest Interview',
    deleted_at: '2026-08-04T12:00:00.000Z',
    asset_upload_grants_expire_at: '2026-08-04T12:30:00.000Z',
    updated_at: '2026-08-04T12:00:01.000Z',
    ...overrides,
  };
}

test('keeps deletion pending until the latest tracked grant is safe', async () => {
  let sweepCalled = false;
  const result = await finalizeEpisodeStudioDeletion(deletionEpisode(), {
    now: '2026-08-04T12:30:30.000Z',
    deleteVersions: async () => {
      sweepCalled = true;
      return { deleted_version_count: 0 };
    },
  });
  assert.equal(result.pending, true);
  assert.equal(result.deletion_ready_at, '2026-08-04T12:31:00.000Z');
  assert.equal(sweepCalled, false);
});

test('sweeps storage before deleting the questionnaire and writing a tombstone', async () => {
  const calls = [];
  const episode = deletionEpisode();
  const result = await finalizeEpisodeStudioDeletion(episode, {
    now: '2026-08-04T12:31:00.000Z',
    deleteVersions: async (episodeId) => {
      calls.push(`sweep:${episodeId}`);
      return { deleted_version_count: 4 };
    },
    getQuestionnaire: async (episodeId) => {
      calls.push(`questionnaire:${episodeId}`);
      return {
        configured: true,
        questionnaire: { updated_at: '2026-08-04T12:15:00.000Z' },
      };
    },
    finalizeTombstone: async (value, options) => {
      calls.push(`finalize:${value.episode_id}`);
      assert.equal(
        options.expectedQuestionnaireUpdatedAt,
        '2026-08-04T12:15:00.000Z'
      );
      assert.equal(
        options.expectedEpisodeUpdatedAt,
        episode.updated_at
      );
      return {
        episode: {
          episode_id: value.episode_id,
          title: 'Deleted Episode Studio',
          deleted_at: value.deleted_at,
          deletion_finalized_at: options.finalizedAt,
        },
      };
    },
  });
  assert.deepEqual(calls, [
    'sweep:episode-one',
    'questionnaire:episode-one',
    'finalize:episode-one',
  ]);
  assert.equal(result.pending, false);
  assert.equal(result.finalized, true);
  assert.equal(result.deleted_storage_version_count, 4);
  assert.equal(result.episode.title, 'Deleted Episode Studio');
});

test('keeps the Studio locked when a bounded storage batch has more versions', async () => {
  let questionnaireRead = false;
  const result = await finalizeEpisodeStudioDeletion(deletionEpisode(), {
    now: '2026-08-04T12:31:00.000Z',
    deleteVersions: async () => ({
      deleted: false,
      cleanup_pending: true,
      deleted_version_count: 20,
    }),
    getQuestionnaire: async () => {
      questionnaireRead = true;
    },
  });
  assert.equal(result.pending, true);
  assert.equal(result.storage_cleanup_pending, true);
  assert.equal(result.deleted_storage_version_count, 20);
  assert.equal(questionnaireRead, false);
});

test('resweeps a finalized tombstone without recreating or finalizing records', async () => {
  let finalizeCalled = false;
  const result = await finalizeEpisodeStudioDeletion(
    deletionEpisode({
      title: 'Deleted Episode Studio',
      deletion_finalized_at: '2026-08-04T12:31:00.000Z',
    }),
    {
      now: '2026-08-05T12:00:00.000Z',
      deleteVersions: async () => ({ deleted_version_count: 1 }),
      getQuestionnaire: async () => {
        throw new Error('questionnaire should not be read');
      },
      finalizeTombstone: async () => {
        finalizeCalled = true;
      },
    }
  );
  assert.equal(result.deleted_storage_version_count, 1);
  assert.equal(result.purged, false);
  assert.equal(finalizeCalled, false);
});

test('purges the title-derived cleanup identifier after the retention window and a final sweep', async () => {
  const calls = [];
  const result = await finalizeEpisodeStudioDeletion(
    deletionEpisode({
      title: 'Deleted Episode Studio',
      deletion_finalized_at: '2026-08-04T12:31:00.000Z',
      deletion_tombstone_purge_at: '2026-09-03T12:31:00.000Z',
    }),
    {
      now: '2026-09-03T12:31:00.000Z',
      deleteVersions: async (episodeId) => {
        calls.push(`sweep:${episodeId}`);
        return { deleted_version_count: 0 };
      },
      deleteTombstone: async (episodeId, options) => {
        calls.push(`purge:${episodeId}:${options.expectedUpdatedAt}`);
        return { deleted: true };
      },
    }
  );
  assert.deepEqual(calls, [
    'sweep:episode-one',
    'purge:episode-one:2026-08-04T12:00:01.000Z',
  ]);
  assert.equal(result.purged, true);
  assert.equal(result.episode, null);
});

test('one failed tombstone sweep does not stop cleanup for later Studios', async (t) => {
  const originalConsoleError = console.error;
  t.after(() => {
    console.error = originalConsoleError;
  });
  console.error = () => {};
  const result = await runEpisodeStudioDeletionCleanup(
    [
      deletionEpisode({
        episode_id: 'episode-fails',
        deletion_finalized_at: '2026-08-04T12:31:00.000Z',
      }),
      deletionEpisode({
        episode_id: 'episode-succeeds',
        deletion_finalized_at: '2026-08-04T12:31:00.000Z',
      }),
    ],
    {
      now: '2026-08-05T12:00:00.000Z',
      deleteVersions: async (episodeId) => {
        if (episodeId === 'episode-fails') {
          throw new Error('temporary storage outage');
        }
        return { deleted_version_count: 0 };
      },
    }
  );
  assert.deepEqual(result, {
    pending: 0,
    swept: 1,
    finalized: 0,
    purged: 0,
    failed: 1,
  });
});
