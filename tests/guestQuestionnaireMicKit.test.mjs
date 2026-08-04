import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildGuestMicKitRequest,
  guestMicKitRequestId,
  scrubGuestMicKitDataForEpisode,
  upsertGuestMicKitRequest,
} from '../lib/guestQuestionnaireMicKit.mjs';
import { validateMicKitTracker } from '../lib/micKitPresentation.mjs';

function questionnaire() {
  return {
    episode_id: 'episode-one',
    response: {
      response_id: 'guest-response-one',
      revision: 1,
      answers: {
        guest_name: 'Alex Guest',
        guest_email: 'alex@example.com',
        shipping_recipient_name: 'Alex Guest',
        shipping_address_line_1: '123 Private Lane',
        shipping_address_line_2: 'Unit 4',
        shipping_city: 'Wenatchee',
        shipping_region: 'WA',
        shipping_postal_code: '98801',
        shipping_country: 'US',
        shipping_phone: '+1 509 555 0101',
      },
    },
  };
}

const episode = {
  episode_id: 'episode-one',
  recording_date: '2026-09-21',
  host_person_ids: ['host-one', 'host-two'],
};

const guestPlan = {
  guest_name: 'Alex Guest',
  choice: 'request_kit',
  equipment_note: 'Guest requested an Avalanche Hour microphone kit.',
};

test('builds a private guest request owned by the assigned episode hosts', () => {
  const request = buildGuestMicKitRequest({
    questionnaire: questionnaire(),
    episode,
    guestPlan,
    now: '2026-08-04T12:00:00.000Z',
  });

  assert.equal(request.request_id, guestMicKitRequestId('episode-one'));
  assert.equal(request.participant_type, 'guest');
  assert.equal(request.source, 'guest_questionnaire');
  assert.deepEqual(request.coordinator_person_ids, ['host-one', 'host-two']);
  assert.equal(request.recording_date, '2026-09-21');
  assert.equal(request.need_by, '2026-09-14');
  assert.equal(request.shipping.address_line_1, '123 Private Lane');
  assert.equal(request.shipping.phone, '+1 509 555 0101');
  assert.equal(request.requester_person_id, '');
});

test('normalizes common written country names without truncating them', () => {
  const writtenCountry = questionnaire();
  writtenCountry.response.answers.shipping_country = 'United States';
  const request = buildGuestMicKitRequest({
    questionnaire: writtenCountry,
    episode,
    guestPlan,
  });

  assert.equal(request.country, 'US');
  assert.equal(request.shipping.country, 'US');
});

test('upserts one deterministic request without erasing logistics state', () => {
  const first = upsertGuestMicKitRequest({
    tracker: { kits: [], requests: [] },
    questionnaire: questionnaire(),
    episode,
    guestPlan,
    now: '2026-08-04T12:00:00.000Z',
  });
  assert.equal(first.created, true);
  assert.equal(first.tracker.requests.length, 1);

  first.tracker.requests[0] = {
    ...first.tracker.requests[0],
    status: 'assigned',
    kit_id: 'kit-one',
    admin_response: 'Kit reserved.',
  };
  const second = upsertGuestMicKitRequest({
    tracker: first.tracker,
    questionnaire: questionnaire(),
    episode,
    guestPlan,
    now: '2026-08-05T12:00:00.000Z',
  });

  assert.equal(second.created, false);
  assert.equal(second.tracker.requests.length, 1);
  assert.equal(second.request.status, 'assigned');
  assert.equal(second.request.kit_id, 'kit-one');
  assert.equal(second.request.admin_response, 'Kit reserved.');
});

test('does not create a tracker request for own-equipment or follow-up plans', () => {
  for (const choice of ['use_own_equipment', 'needs_follow_up']) {
    const result = upsertGuestMicKitRequest({
      tracker: { kits: [], requests: [] },
      questionnaire: questionnaire(),
      episode,
      guestPlan: { ...guestPlan, choice },
    });
    assert.equal(result.request, null);
    assert.equal(result.tracker.requests.length, 0);
  }
});

test('scrubs deleted guest PII while preserving active kit references', () => {
  const tracker = {
    kits: [
      {
        kit_id: 'kit-one',
        label: 'Kit one',
        status: 'with_holder',
        current_holder_name: 'Alex Guest',
        current_location: '123 Private Lane',
        next_request_id: 'guest-next',
        checked_out_request_id: 'guest-current',
        checked_out_at: '2026-08-01T12:00:00.000Z',
        ship_by: '2026-09-01',
        due_back: '2026-09-20',
        carrier: 'UPS',
        tracking_number: 'PRIVATE-TRACKING',
        tracking_url: 'https://carrier.example/private',
        notes: 'Leave at the guest address.',
      },
      {
        kit_id: 'kit-two',
        label: 'Kit two',
        status: 'with_holder',
        current_holder_name: 'Current Host',
        current_location: 'Current holder location',
        next_request_id: 'guest-next-only',
        checked_out_request_id: 'host-current',
        checked_out_at: '2026-08-02T12:00:00.000Z',
        ship_by: '2026-09-02',
        due_back: '2026-09-21',
        tracking_number: 'HANDOFF-TRACKING',
        notes: 'Handoff note may mention the guest.',
      },
    ],
    requests: [
      {
        request_id: 'guest-current',
        participant_type: 'guest',
        coordinator_person_ids: ['host-one'],
        source: 'guest_questionnaire',
        source_response_id: 'guest-response-one',
        requester_name: 'Alex Guest',
        requester_email: 'alex@example.com',
        country: 'US',
        city_region: 'Wenatchee, WA',
        episode_id: 'episode-one',
        status: 'checked_out',
        kit_id: 'kit-one',
        notes: 'Private guest note',
        admin_response: 'Sent to 123 Private Lane',
        shipping: questionnaire().response.answers,
      },
      {
        request_id: 'guest-next',
        participant_type: 'guest',
        coordinator_person_ids: ['host-one'],
        source: 'guest_questionnaire',
        source_response_id: 'guest-response-two',
        requester_name: 'Second Guest',
        requester_email: 'second@example.com',
        episode_id: 'episode-one',
        status: 'assigned',
        kit_id: 'kit-one',
        shipping: {
          recipient: 'Second Guest',
          address_line_1: '456 Private Lane',
        },
      },
      {
        request_id: 'host-current',
        participant_type: 'host',
        source: 'studio',
        requester_name: 'Current Host',
        episode_id: 'host-episode',
        status: 'checked_out',
        kit_id: 'kit-two',
      },
      {
        request_id: 'guest-next-only',
        participant_type: 'guest',
        coordinator_person_ids: ['host-one'],
        source: 'guest_questionnaire',
        source_response_id: 'guest-response-three',
        requester_name: 'Third Guest',
        requester_email: 'third@example.com',
        episode_id: 'episode-one',
        status: 'assigned',
        kit_id: 'kit-two',
        shipping: {
          recipient: 'Third Guest',
          address_line_1: '789 Private Lane',
        },
      },
    ],
  };

  const result = scrubGuestMicKitDataForEpisode(tracker, 'episode-one', {
    now: '2026-08-04T13:00:00.000Z',
  });
  assert.equal(result.changed, true);
  assert.equal(result.scrubbed_request_count, 3);
  assert.equal(result.tracker.kits[0].next_request_id, 'guest-next');
  assert.equal(
    result.tracker.kits[0].checked_out_request_id,
    'guest-current'
  );
  assert.equal(result.tracker.kits[0].current_holder_name, '');
  assert.equal(result.tracker.kits[0].tracking_number, '');
  assert.equal(result.tracker.kits[1].current_holder_name, 'Current Host');
  assert.equal(
    result.tracker.kits[1].current_location,
    'Current holder location'
  );
  assert.equal(result.tracker.kits[1].tracking_number, '');
  assert.equal(result.tracker.requests[0].status, 'checked_out');
  assert.equal(result.tracker.requests[0].kit_id, 'kit-one');
  assert.equal(result.tracker.requests[0].requester_name, 'Deleted guest recipient');
  assert.equal(result.tracker.requests[0].requester_email, '');
  assert.equal(result.tracker.requests[0].episode_id, '');
  assert.deepEqual(result.tracker.requests[0].coordinator_person_ids, []);
  assert.equal(result.tracker.requests[0].shipping.address_line_1, '');
  assert.doesNotThrow(() => validateMicKitTracker(result.tracker));

  const serialized = JSON.stringify(result.tracker);
  for (const privateValue of [
    'Alex Guest',
    'alex@example.com',
    'Second Guest',
    'second@example.com',
    '123 Private Lane',
    '456 Private Lane',
    'PRIVATE-TRACKING',
    'guest-response-one',
    'guest-response-two',
    'guest-response-three',
    'Third Guest',
    'third@example.com',
    '789 Private Lane',
  ]) {
    assert.equal(serialized.includes(privateValue), false);
  }
});
