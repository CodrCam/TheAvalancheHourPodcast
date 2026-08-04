import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpisodeMicKitEquipmentReviewRequest,
  episodeMicKitRequestId,
  upsertEpisodeMicKitEquipmentReviewRequest,
} from '../lib/episodeMicKitRequests.mjs';

const NOW = '2026-08-04T12:00:00.000Z';

function context(overrides = {}) {
  return {
    episodeId: 'episode-one',
    recordingDate: '2026-09-21',
    participantType: 'host',
    requesterName: 'Host One',
    requesterPersonId: 'host-one',
    requesterSubject: 'identity-host-one',
    requesterEmail: 'HOST@example.com',
    coordinatorPersonIds: ['producer-one', 'host-one', 'producer-one'],
    now: NOW,
    ...overrides,
  };
}

test('builds an early non-assignable review from server-derived context', () => {
  const request = buildEpisodeMicKitEquipmentReviewRequest(context());

  assert.equal(
    request.request_id,
    episodeMicKitRequestId({
      episodeId: 'episode-one',
      participantType: 'host',
      requesterPersonId: 'host-one',
    })
  );
  assert.equal(request.request_kind, 'equipment_review');
  assert.equal(request.review_resolution, '');
  assert.equal(request.status, 'requested');
  assert.equal(request.kit_id, '');
  assert.equal(request.recording_date, '2026-09-21');
  assert.equal(request.need_by, '2026-09-14');
  assert.equal(request.requester_email, 'host@example.com');
  assert.deepEqual(request.coordinator_person_ids, [
    'producer-one',
    'host-one',
  ]);
});

test('host and guest requests coexist for the same episode', () => {
  const host = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: { kits: [], requests: [] },
    ...context(),
  });
  const guest = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: host.tracker,
    ...context({
      participantType: 'guest',
      requesterName: 'Guest One',
      requesterPersonId: '',
      requesterSubject: '',
      requesterEmail: 'guest@example.com',
    }),
  });

  assert.equal(host.created, true);
  assert.equal(guest.created, true);
  assert.equal(guest.tracker.requests.length, 2);
  assert.deepEqual(
    new Set(guest.tracker.requests.map((request) => request.participant_type)),
    new Set(['host', 'guest'])
  );
  assert.notEqual(host.request.request_id, guest.request.request_id);
});

test('a retry returns an existing active participant request without duplication', () => {
  const existingRequest = {
    ...buildEpisodeMicKitEquipmentReviewRequest(context()),
    request_id: 'legacy-random-request-id',
    status: 'approved',
    admin_response: 'Recording setup review is underway.',
  };
  const result = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: { kits: [], requests: [existingRequest] },
    ...context({ now: '2026-08-05T12:00:00.000Z' }),
  });

  assert.equal(result.created, false);
  assert.equal(result.reopened, false);
  assert.equal(result.existing, true);
  assert.equal(result.request.request_id, 'legacy-random-request-id');
  assert.equal(result.request.status, 'approved');
  assert.equal(result.tracker.requests.length, 1);
  assert.equal(result.request.updated_at, NOW);
});

test('reopens a cancelled deterministic request and retains private shipping data', () => {
  const deterministic = buildEpisodeMicKitEquipmentReviewRequest(context());
  const result = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: {
      kits: [],
      requests: [
        {
          ...deterministic,
          source: 'guest_questionnaire',
          source_response_id: 'stored-response-id',
          requester_name: 'Outdated host name',
          requester_email: 'old@example.com',
          country: 'US',
          city_region: 'Wenatchee, WA',
          status: 'cancelled',
          request_kind: 'shipment',
          review_resolution: 'shipment',
          kit_id: 'kit-two',
          planned_due_back: '2026-09-24',
          admin_response: 'Old cancellation note.',
          shipping: {
            recipient: 'Private Recipient',
            phone: '+1 509 555 0199',
            address_line_1: '123 Private Lane',
            address_line_2: 'Unit 4',
            city: 'Wenatchee',
            region: 'WA',
            postal_code: '98801',
            country: 'US',
          },
          created_at: '2026-07-01T12:00:00.000Z',
          updated_at: '2026-07-02T12:00:00.000Z',
        },
      ],
    },
    ...context({
      requesterName: 'Current Host Name',
      requesterEmail: 'current@example.com',
      now: '2026-08-06T12:00:00.000Z',
    }),
  });

  assert.equal(result.created, false);
  assert.equal(result.reopened, true);
  assert.equal(result.existing, false);
  assert.equal(result.tracker.requests.length, 1);
  assert.equal(result.request.status, 'requested');
  assert.equal(result.request.request_kind, 'equipment_review');
  assert.equal(result.request.review_resolution, '');
  assert.equal(result.request.kit_id, '');
  assert.equal(result.request.planned_due_back, '');
  assert.equal(result.request.admin_response, '');
  assert.equal(result.request.requester_name, 'Current Host Name');
  assert.equal(result.request.requester_email, 'current@example.com');
  assert.equal(result.request.country, 'US');
  assert.equal(result.request.city_region, 'Wenatchee, WA');
  assert.equal(
    result.request.shipping.address_line_1,
    '123 Private Lane'
  );
  assert.equal(result.request.shipping.phone, '+1 509 555 0199');
  assert.equal(result.request.source_response_id, 'stored-response-id');
  assert.equal(result.request.created_at, '2026-07-01T12:00:00.000Z');
  assert.equal(result.request.updated_at, '2026-08-06T12:00:00.000Z');
});

test('reopens a declined shipment review when the participant later needs a kit', () => {
  const deterministic = buildEpisodeMicKitEquipmentReviewRequest(context());
  const result = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: {
      kits: [],
      requests: [
        {
          ...deterministic,
          status: 'declined',
          review_resolution: 'own_equipment',
          admin_response: 'No shipment was needed at the time.',
        },
      ],
    },
    ...context({ now: '2026-08-07T12:00:00.000Z' }),
  });

  assert.equal(result.reopened, true);
  assert.equal(result.request.status, 'requested');
  assert.equal(result.request.request_kind, 'equipment_review');
  assert.equal(result.request.review_resolution, '');
});

test('distinct cohosts receive distinct stable requests', () => {
  const hostOne = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: { kits: [], requests: [] },
    ...context(),
  });
  const hostTwo = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: hostOne.tracker,
    ...context({
      requesterName: 'Host Two',
      requesterPersonId: 'host-two',
      requesterSubject: 'identity-host-two',
      requesterEmail: 'host-two@example.com',
    }),
  });

  assert.equal(hostTwo.tracker.requests.length, 2);
  assert.notEqual(hostOne.request.request_id, hostTwo.request.request_id);
  assert.equal(
    episodeMicKitRequestId({
      episodeId: 'episode-one',
      participantType: 'host',
      requesterPersonId: 'host-one',
    }),
    hostOne.request.request_id
  );
});

test('need-by is always derived as seven days before the recording date', () => {
  const request = buildEpisodeMicKitEquipmentReviewRequest(
    context({ recordingDate: '2027-01-04' })
  );

  assert.equal(request.recording_date, '2027-01-04');
  assert.equal(request.need_by, '2026-12-28');
});

test('arbitrary nested or logistics input cannot replace authoritative identity', () => {
  const result = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: { kits: [], requests: [] },
    ...context(),
    requestInput: {
      episodeId: 'attacker-episode',
      participantType: 'guest',
      requesterPersonId: 'attacker',
      requesterName: 'Attacker',
      shipping: { address_line_1: 'Injected address' },
    },
    episode: {
      episode_id: 'attacker-episode',
      recording_date: '2099-01-01',
    },
    participant: {
      participant_type: 'guest',
      requester_name: 'Attacker',
    },
    country: 'CA',
    cityRegion: 'Injected location',
    shipping: { address_line_1: 'Injected address' },
    notes: 'Injected note',
  });

  assert.equal(result.request.episode_id, 'episode-one');
  assert.equal(result.request.participant_type, 'host');
  assert.equal(result.request.requester_person_id, 'host-one');
  assert.equal(result.request.requester_name, 'Host One');
  assert.equal(result.request.recording_date, '2026-09-21');
  assert.equal(result.request.country, '');
  assert.equal(result.request.city_region, '');
  assert.equal(result.request.shipping.address_line_1, '');
  assert.doesNotMatch(result.request.notes, /Injected/);
});

test('a host request cannot be created without a server-side person ID', () => {
  const result = upsertEpisodeMicKitEquipmentReviewRequest({
    tracker: { kits: [], requests: [] },
    ...context({ requesterPersonId: '' }),
  });

  assert.equal(result.request, null);
  assert.equal(result.created, false);
  assert.equal(result.reopened, false);
  assert.equal(result.existing, false);
  assert.equal(result.tracker.requests.length, 0);
});
