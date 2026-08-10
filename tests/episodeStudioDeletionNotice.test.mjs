import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_STUDIO_DELETION_NOTICE_KEY,
  consumeEpisodeStudioDeletionNotice,
  createEpisodeStudioDeletionNotice,
  getEpisodeStudioDeletionNoticeCopy,
  storeEpisodeStudioDeletionNotice,
} from '../lib/episodeStudioDeletionNotice.mjs';

function memoryStorage() {
  const values = new Map();
  return {
    getItem(key) {
      return values.get(key) || null;
    },
    removeItem(key) {
      values.delete(key);
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

test('stores and consumes a bounded one-time deletion notice', () => {
  const storage = memoryStorage();
  assert.equal(
    storeEpisodeStudioDeletionNotice(storage, {
      status: 'scheduled',
      title: ' Forecasting\n a Dope Winter ',
      deletion_ready_at: '2026-08-10T18:03:35.000Z',
    }),
    true
  );
  assert.ok(storage.getItem(EPISODE_STUDIO_DELETION_NOTICE_KEY));
  assert.deepEqual(consumeEpisodeStudioDeletionNotice(storage), {
    version: 1,
    status: 'scheduled',
    title: 'Forecasting a Dope Winter',
    deletion_ready_at: '2026-08-10T18:03:35.000Z',
  });
  assert.equal(consumeEpisodeStudioDeletionNotice(storage), null);
});

test('explains that scheduled deletion is automatic and not yet complete', () => {
  const copy = getEpisodeStudioDeletionNoticeCopy(
    createEpisodeStudioDeletionNotice({
      status: 'scheduled',
      title: 'Test Studio',
      deletion_ready_at: '2026-08-10T18:03:35.000Z',
    }),
    { formatDate: () => 'August 10 at 11:03 AM' }
  );
  assert.equal(copy.heading, 'Deletion is scheduled for “Test Studio”.');
  assert.match(copy.body, /locked now/i);
  assert.match(copy.body, /No further action is required/i);
  assert.match(copy.body, /August 10 at 11:03 AM/);
});

test('distinguishes completed deletion from protected cleanup', () => {
  const cleaning = getEpisodeStudioDeletionNoticeCopy({
    status: 'cleaning',
    title: 'Test Studio',
  });
  const deleted = getEpisodeStudioDeletionNoticeCopy({
    status: 'deleted',
    title: 'Test Studio',
  });
  assert.match(cleaning.heading, /in progress/i);
  assert.match(cleaning.body, /automatic cleanup/i);
  assert.match(deleted.heading, /permanently deleted/i);
  assert.match(deleted.body, /production calendar/i);
});

test('rejects malformed or stale stored notices safely', () => {
  const storage = memoryStorage();
  storage.setItem(EPISODE_STUDIO_DELETION_NOTICE_KEY, '{not-json');
  assert.equal(consumeEpisodeStudioDeletionNotice(storage), null);
  storage.setItem(
    EPISODE_STUDIO_DELETION_NOTICE_KEY,
    JSON.stringify({ version: 0, status: 'deleted' })
  );
  assert.equal(consumeEpisodeStudioDeletionNotice(storage), null);
});
