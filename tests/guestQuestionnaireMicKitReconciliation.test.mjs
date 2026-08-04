import test from 'node:test';
import assert from 'node:assert/strict';
import { reconcileSubmittedGuestMicKitQueue } from '../lib/guestQuestionnaireMicKitReconciliation.mjs';

function submittedQuestionnaire() {
  return {
    episode_id: 'episode-one',
    response: {
      status: 'submitted',
      response_id: 'response-one',
      revision: 1,
      answers: {
        guest_name: 'Alex Guest',
        guest_email: 'alex@example.com',
        external_microphone: 'no',
        over_ear_headphones: 'no',
        mic_kit_shipping_needed: 'yes',
        shipping_recipient_name: 'Alex Guest',
        shipping_address_line_1: '123 Private Lane',
        shipping_city: 'Wenatchee',
        shipping_region: 'WA',
        shipping_postal_code: '98801',
        shipping_country: 'US',
      },
    },
  };
}

const episodes = [
  {
    episode_id: 'episode-one',
    status: 'planning',
    recording_date: '2026-09-21',
    host_person_ids: ['host-one'],
  },
];

test('persists submitted-intake backfill with an optimistic concurrency guard', async () => {
  const saveCalls = [];
  const result = await reconcileSubmittedGuestMicKitQueue({
    trackerResult: {
      tracker: { kits: [], requests: [], updated_at: 'tracker-v1' },
      configured: true,
      source: 'dynamo',
    },
    episodes,
    now: '2026-08-04T12:00:00.000Z',
    loadQuestionnaires: async () => ({
      questionnaires: [submittedQuestionnaire()],
      configured: true,
    }),
    loadTracker: async () => {
      throw new Error('a reload should not be needed');
    },
    saveTracker: async (tracker, options) => {
      saveCalls.push({ tracker, options });
      return { tracker, configured: true, source: 'dynamo' };
    },
  });

  assert.equal(saveCalls.length, 1);
  assert.equal(saveCalls[0].options.expectedUpdatedAt, 'tracker-v1');
  assert.equal(saveCalls[0].tracker.requests.length, 1);
  assert.equal(result.tracker.requests.length, 1);
  assert.deepEqual(result.reconciled_guest_request_ids, [
    result.tracker.requests[0].request_id,
  ]);
});

test('retries a concurrent tracker write and converges without duplicates', async () => {
  let persistedTracker = { kits: [], requests: [], updated_at: 'tracker-v1' };
  let saveCount = 0;
  let loadCount = 0;
  const result = await reconcileSubmittedGuestMicKitQueue({
    trackerResult: {
      tracker: persistedTracker,
      configured: true,
      source: 'dynamo',
    },
    episodes,
    now: '2026-08-04T12:00:00.000Z',
    loadQuestionnaires: async () => ({
      questionnaires: [submittedQuestionnaire()],
      configured: true,
    }),
    loadTracker: async () => {
      loadCount += 1;
      return {
        tracker: persistedTracker,
        configured: true,
        source: 'dynamo',
      };
    },
    saveTracker: async (tracker) => {
      saveCount += 1;
      if (saveCount === 1) {
        persistedTracker = { ...tracker, updated_at: 'tracker-v2' };
        throw new Error('conditional request failed');
      }
      throw new Error('the idempotent retry should not save twice');
    },
  });

  assert.equal(saveCount, 1);
  assert.equal(loadCount, 1);
  assert.equal(result.tracker.requests.length, 1);
  assert.equal(
    new Set(result.tracker.requests.map((request) => request.request_id)).size,
    1
  );
});
