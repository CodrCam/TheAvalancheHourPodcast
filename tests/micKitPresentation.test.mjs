import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_MIC_KIT_REQUEST_STATUSES,
  DEFAULT_MIC_KIT_TRACKER,
  MIC_KIT_STATUSES,
  applyMicKitStatus,
  findActiveMicKitRequest,
  micKitTrackerSummary,
  normalizeMicKitTracker,
  sanitizeMicKitTrackerForViewer,
  validateMicKitTracker,
} from '../lib/micKitPresentation.mjs';

test('defines the request states that still cover an episode', () => {
  assert.deepEqual(ACTIVE_MIC_KIT_REQUEST_STATUSES, [
    'requested',
    'approved',
    'waitlisted',
    'assigned',
    'checked_out',
  ]);
});

test('finds an active mic request only for the same host and episode', () => {
  const tracker = {
    requests: [
      {
        request_id: 'closed-request',
        requester_person_id: 'host-one',
        episode_id: 'episode-one',
        status: 'cancelled',
      },
      {
        request_id: 'other-host',
        requester_person_id: 'host-two',
        episode_id: 'episode-one',
        status: 'requested',
      },
      {
        request_id: 'active-request',
        requester_person_id: 'host-one',
        episode_id: 'episode-one',
        status: 'approved',
      },
    ],
  };

  assert.equal(
    findActiveMicKitRequest(tracker, {
      requesterPersonId: 'host-one',
      episodeId: 'episode-one',
    })?.request_id,
    'active-request'
  );
  assert.equal(
    findActiveMicKitRequest(tracker, {
      requesterPersonId: 'host-one',
      episodeId: 'episode-two',
    }),
    null
  );
});

test('uses a compact physical-status lifecycle', () => {
  assert.deepEqual(MIC_KIT_STATUSES, [
    'available',
    'in_transit',
    'with_holder',
    'maintenance',
    'retired',
  ]);
});

test('selecting available clears shipment details from an editor draft', () => {
  assert.deepEqual(
    applyMicKitStatus(
      {
        kit_id: 'kit-one',
        status: 'in_transit',
        carrier: 'UPS',
        tracking_number: '1Z-OLD',
        tracking_url: 'https://ups.example/1Z-OLD',
      },
      'available'
    ),
    {
      kit_id: 'kit-one',
      status: 'available',
      carrier: '',
      tracking_number: '',
      tracking_url: '',
    }
  );
});

test('migrates retired status choices and clears stale tracking when available', () => {
  const tracker = normalizeMicKitTracker({
    kits: [
      {
        kit_id: 'confirmation-kit',
        status: 'needs_confirmation',
        carrier: 'UPS',
        tracking_number: 'OLD-CONFIRMATION',
        tracking_url: 'https://ups.example/old-confirmation',
      },
      {
        kit_id: 'reserved-kit',
        status: 'reserved',
        carrier: 'UPS',
        tracking_number: 'OLD-RESERVATION',
      },
      {
        kit_id: 'returning-kit',
        status: 'returning',
        carrier: 'UPS',
        tracking_number: 'ACTIVE-RETURN',
      },
      {
        kit_id: 'available-kit',
        status: 'available',
        carrier: 'UPS',
        tracking_number: 'STALE-AVAILABLE',
        tracking_url: 'https://ups.example/stale-available',
      },
    ],
  });

  assert.deepEqual(
    tracker.kits.map((kit) => kit.status),
    ['available', 'available', 'in_transit', 'available']
  );
  for (const kit of tracker.kits.filter((item) => item.status === 'available')) {
    assert.equal(kit.carrier, '');
    assert.equal(kit.tracking_number, '');
    assert.equal(kit.tracking_url, '');
  }
  assert.equal(tracker.kits[2].tracking_number, 'ACTIVE-RETURN');
});

test('starts with four reported kits and one explicitly possible addition', () => {
  const tracker = normalizeMicKitTracker(DEFAULT_MIC_KIT_TRACKER);

  assert.equal(tracker.kits.length, 5);
  assert.equal(
    tracker.kits.filter((kit) => kit.possible_addition).length,
    1
  );
  assert.equal(
    tracker.kits.filter((kit) => kit.home_country === 'CA').length,
    1
  );
  assert.equal(tracker.inventory_confirmed, false);
  assert.match(tracker.inventory_note, /guide.*does not state/i);
});

test('keeps shipping addresses and tracking private from unrelated viewers', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'request-one',
        requester_subject: 'subject-one',
        requester_person_id: 'person-casey',
        requester_name: 'Casey Host',
        requester_email: 'casey@example.com',
        country: 'US',
        city_region: 'Bend, Oregon',
        need_by: '2026-10-01',
        status: 'assigned',
        kit_id: 'tah-us-1',
        notes: 'Gate code 1234',
        admin_response: 'Your kit will ship on Monday.',
        shipping: {
          recipient: 'Casey Host',
          address_line_1: '123 Private Lane',
          city: 'Bend',
          region: 'OR',
          postal_code: '97701',
          country: 'US',
        },
      },
    ],
    kits: DEFAULT_MIC_KIT_TRACKER.kits.map((kit, index) =>
      index === 0
        ? {
            ...kit,
            status: 'in_transit',
            next_request_id: 'request-one',
            carrier: 'UPS',
            tracking_number: 'TRACK-PRIVATE',
            tracking_url: 'https://ups.example/track',
            notes: 'Coordinator only',
          }
        : kit
    ),
  });

  const unrelated = sanitizeMicKitTrackerForViewer(tracker, {
    subject: 'subject-two',
    username: 'someone@example.com',
    canManage: false,
  });
  assert.equal(unrelated.requests[0].shipping, null);
  assert.equal(unrelated.requests[0].requester_subject, '');
  assert.equal(unrelated.requests[0].requester_person_id, '');
  assert.equal(unrelated.requests[0].requester_email, '');
  assert.equal(unrelated.requests[0].notes, '');
  assert.equal(unrelated.requests[0].admin_response, '');
  assert.equal(unrelated.kits[0].tracking_number, '');
  assert.equal(unrelated.kits[0].tracking_url, '');
  assert.equal(unrelated.kits[0].tracking_available, true);
  assert.equal(unrelated.kits[0].notes, '');

  const recipient = sanitizeMicKitTrackerForViewer(tracker, {
    subject: 'subject-one',
    username: 'casey@example.com',
    canManage: false,
  });
  assert.equal(
    recipient.requests[0].shipping.address_line_1,
    '123 Private Lane'
  );
  assert.equal(
    recipient.requests[0].admin_response,
    'Your kit will ship on Monday.'
  );
  assert.equal(recipient.kits[0].tracking_number, 'TRACK-PRIVATE');
  assert.equal(recipient.kits[0].notes, '');

  const manager = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  });
  assert.equal(manager.requests[0].requester_person_id, 'person-casey');
  assert.equal(manager.requests[0].shipping.postal_code, '97701');
  assert.equal(manager.kits[0].notes, 'Coordinator only');
});

test('keeps tracking visible to the host while a kit is checked out', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'checked-out-request',
        requester_subject: 'host-subject',
        requester_name: 'Taylor Host',
        requester_email: 'taylor@example.com',
        country: 'US',
        city_region: 'Bozeman, Montana',
        need_by: '2026-10-01',
        status: 'checked_out',
        kit_id: 'tah-us-1',
      },
    ],
    kits: DEFAULT_MIC_KIT_TRACKER.kits.map((kit, index) =>
      index === 0
        ? {
            ...kit,
            status: 'with_holder',
            checked_out_request_id: 'checked-out-request',
            checked_out_at: '2026-09-20T12:00:00.000Z',
            carrier: 'UPS',
            tracking_number: 'TRACK-CHECKED-OUT',
          }
        : kit
    ),
  });

  const recipient = sanitizeMicKitTrackerForViewer(tracker, {
    subject: 'host-subject',
    username: 'taylor@example.com',
  });

  assert.equal(
    recipient.kits[0].tracking_number,
    'TRACK-CHECKED-OUT'
  );
  assert.doesNotThrow(() => validateMicKitTracker(tracker));
});

test('allows one current checkout and one scheduled direct handoff', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    kits: [
      {
        ...DEFAULT_MIC_KIT_TRACKER.kits[0],
        status: 'with_holder',
        checked_out_request_id: 'current-request',
        next_request_id: 'next-request',
        due_back: '2026-08-01',
        ship_by: '2026-08-02',
      },
    ],
    requests: [
      {
        request_id: 'current-request',
        requester_name: 'Current Host',
        status: 'checked_out',
        kit_id: 'tah-us-1',
      },
      {
        request_id: 'next-request',
        requester_name: 'Next Host',
        status: 'assigned',
        kit_id: 'tah-us-1',
        planned_due_back: '2026-08-15',
      },
    ],
  });

  assert.equal(
    tracker.requests[1].planned_due_back,
    '2026-08-15'
  );
  assert.doesNotThrow(() => validateMicKitTracker(tracker));
});

test('rejects dangling assignments and summarizes only active inventory', () => {
  assert.throws(
    () =>
      validateMicKitTracker({
        ...DEFAULT_MIC_KIT_TRACKER,
        kits: [
          {
            ...DEFAULT_MIC_KIT_TRACKER.kits[0],
            next_request_id: 'missing-request',
          },
        ],
      }),
    /request no longer exists/i
  );
  assert.throws(
    () =>
      validateMicKitTracker({
        ...DEFAULT_MIC_KIT_TRACKER,
        kits: DEFAULT_MIC_KIT_TRACKER.kits.slice(0, 2).map((kit) => ({
          ...kit,
          next_request_id: 'same-request',
        })),
        requests: [
          {
            request_id: 'same-request',
            requester_name: 'One Host',
            status: 'requested',
          },
        ],
      }),
    /cannot be assigned to multiple kits/i
  );
  assert.throws(
    () =>
      validateMicKitTracker({
        ...DEFAULT_MIC_KIT_TRACKER,
        kits: [
          {
            ...DEFAULT_MIC_KIT_TRACKER.kits[0],
            status: 'with_holder',
            checked_out_request_id: 'checked-out-request',
          },
        ],
        requests: [
          {
            request_id: 'checked-out-request',
            requester_name: 'Checked Out Host',
            status: 'checked_out',
            kit_id: 'another-kit',
          },
        ],
      }),
    /checkout record does not match/i
  );

  const summary = micKitTrackerSummary({
    ...DEFAULT_MIC_KIT_TRACKER,
    kits: [
      { ...DEFAULT_MIC_KIT_TRACKER.kits[0], status: 'available' },
      { ...DEFAULT_MIC_KIT_TRACKER.kits[1], status: 'in_transit' },
      { ...DEFAULT_MIC_KIT_TRACKER.kits[2], status: 'retired' },
    ],
    requests: [
      {
        request_id: 'waiting',
        requester_name: 'Waiting Host',
        status: 'approved',
      },
    ],
  });

  assert.deepEqual(summary, {
    total: 2,
    available: 1,
    moving: 1,
    with_team: 0,
    needs_attention: 0,
    waiting_requests: 1,
  });
});
