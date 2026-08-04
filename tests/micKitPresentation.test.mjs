import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACTIVE_MIC_KIT_REQUEST_STATUSES,
  DEFAULT_MIC_KIT_TRACKER,
  MIC_KIT_STATUSES,
  applyMicKitStatus,
  canActOnMicKitRequest,
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

test('normalizes guest recipient metadata while legacy requests remain Studio host requests', () => {
  const tracker = normalizeMicKitTracker({
    requests: [
      {
        request_id: 'legacy-host-request',
        requester_person_id: 'host-one',
      },
      {
        request_id: 'guest-request',
        participant_type: 'guest',
        coordinator_person_ids: [
          'host-one',
          ' host-one ',
          '',
          'producer-one',
        ],
        source: 'guest_questionnaire',
        source_response_id: ' response-one ',
        request_kind: 'equipment_review',
        review_resolution: 'own_equipment',
        requester_name: 'Guest Recipient',
      },
    ],
  });

  assert.deepEqual(
    {
      participant_type: tracker.requests[0].participant_type,
      coordinator_person_ids: tracker.requests[0].coordinator_person_ids,
      source: tracker.requests[0].source,
      source_response_id: tracker.requests[0].source_response_id,
    },
    {
      participant_type: 'host',
      coordinator_person_ids: [],
      source: 'studio',
      source_response_id: '',
    }
  );
  assert.deepEqual(
    {
      participant_type: tracker.requests[1].participant_type,
      coordinator_person_ids: tracker.requests[1].coordinator_person_ids,
      source: tracker.requests[1].source,
      source_response_id: tracker.requests[1].source_response_id,
      request_kind: tracker.requests[1].request_kind,
      review_resolution: tracker.requests[1].review_resolution,
    },
    {
      participant_type: 'guest',
      coordinator_person_ids: ['host-one', 'producer-one'],
      source: 'guest_questionnaire',
      source_response_id: 'response-one',
      request_kind: 'equipment_review',
      review_resolution: 'own_equipment',
    }
  );
});

test('does not allow an unresolved equipment review to hold a physical kit', () => {
  assert.throws(
    () =>
      validateMicKitTracker({
        kits: [
          {
            kit_id: 'kit-one',
            label: 'Kit one',
            status: 'available',
            next_request_id: 'guest-review',
          },
        ],
        requests: [
          {
            request_id: 'guest-review',
            request_kind: 'equipment_review',
            participant_type: 'guest',
            requester_name: 'Guest Recipient',
            status: 'assigned',
            kit_id: 'kit-one',
          },
        ],
      }),
    /review the guest recording setup/i
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
      tracking_request_id: '',
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
  assert.equal(unrelated.requests.length, 0);
  assert.equal(unrelated.kits[0].details_visible, false);
  assert.equal(unrelated.kits[0].current_holder_name, '');
  assert.equal(unrelated.kits[0].current_location, '');
  assert.equal(unrelated.kits[0].next_request_id, '');
  assert.equal(unrelated.kits[0].ship_by, '');
  assert.equal(unrelated.kits[0].checked_out_request_id, '');
  assert.equal(unrelated.kits[0].checked_out_at, '');
  assert.equal(unrelated.kits[0].due_back, '');
  assert.equal(unrelated.kits[0].tracking_number, '');
  assert.equal(unrelated.kits[0].tracking_url, '');
  assert.equal(unrelated.kits[0].tracking_available, false);
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
  assert.equal(recipient.kits[0].details_visible, true);
  assert.equal(recipient.kits[0].notes, '');

  const manager = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  });
  assert.equal(manager.requests[0].requester_person_id, 'person-casey');
  assert.equal(manager.requests[0].shipping.postal_code, '97701');
  assert.equal(manager.kits[0].details_visible, true);
  assert.equal(manager.kits[0].notes, 'Coordinator only');
});

test('producer-created host requests still belong to the intended host person', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'producer-created-host-request',
        participant_type: 'host',
        requester_subject: 'producer-subject',
        requester_person_id: 'host-one',
        requester_name: 'Host Recipient',
        requester_email: 'host@example.com',
        coordinator_person_ids: ['producer-one'],
        episode_id: 'episode-one',
        status: 'requested',
        shipping: {
          recipient: 'Host Recipient',
          address_line_1: '123 Private Lane',
          city: 'Bozeman',
          region: 'MT',
          postal_code: '59715',
          country: 'US',
        },
      },
    ],
  });

  const host = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-one',
    subject: 'host-subject',
    username: 'different@example.com',
    coordinated_episode_ids: [],
  });

  assert.equal(host.requests.length, 1);
  assert.equal(host.requests[0].is_mine, true);
  assert.equal(host.requests[0].is_coordinator, false);
  assert.equal(host.requests[0].can_act, true);
  assert.equal(host.requests[0].shipping.address_line_1, '123 Private Lane');
  assert.equal(
    canActOnMicKitRequest(tracker.requests[0], {
      person_id: 'host-one',
      coordinated_episode_ids: [],
    }),
    true
  );

  const unrelated = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-two',
    coordinated_episode_ids: [],
  });
  assert.equal(unrelated.requests.length, 0);

  const manager = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  });
  assert.equal(manager.requests.length, 1);
  assert.equal(manager.requests[0].requester_person_id, 'host-one');
});

test('guest coordinators can act and see their guest delivery details', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'guest-request',
        participant_type: 'guest',
        coordinator_person_ids: ['host-one'],
        source: 'guest_questionnaire',
        source_response_id: 'guest-response-one',
        requester_subject: 'guest-subject',
        requester_name: 'Guest Recipient',
        requester_email: 'guest@example.com',
        country: 'US',
        city_region: 'Bozeman, Montana',
        need_by: '2026-10-01',
        status: 'assigned',
        kit_id: 'tah-us-1',
        notes: 'Private guest equipment note',
        admin_response: 'The kit ships Monday.',
        admin_updated_at: '2026-09-20T12:00:00.000Z',
        admin_updated_by: 'Mic kit coordinator',
        shipping: {
          recipient: 'Guest Recipient',
          phone: '+1 406 555 0102',
          address_line_1: '123 Private Lane',
          city: 'Bozeman',
          region: 'MT',
          postal_code: '59715',
          country: 'US',
        },
      },
    ],
    kits: DEFAULT_MIC_KIT_TRACKER.kits.map((kit, index) =>
      index === 0
        ? {
            ...kit,
            status: 'in_transit',
            next_request_id: 'guest-request',
            tracking_number: 'GUEST-TRACKING',
            tracking_url: 'https://carrier.example/guest-tracking',
          }
        : kit
    ),
  });

  const coordinator = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-one',
    username: 'guest@example.com',
  });
  const guestRequest = coordinator.requests[0];
  assert.equal(guestRequest.participant_type, 'guest');
  assert.equal(guestRequest.status, 'assigned');
  assert.equal(guestRequest.is_mine, false);
  assert.equal(guestRequest.is_coordinator, true);
  assert.equal(guestRequest.can_act, true);
  assert.equal(guestRequest.requester_email, 'guest@example.com');
  assert.equal(guestRequest.shipping.phone, '+1 406 555 0102');
  assert.equal(guestRequest.shipping.address_line_1, '123 Private Lane');
  assert.equal(guestRequest.notes, 'Private guest equipment note');
  assert.equal(guestRequest.admin_response, 'The kit ships Monday.');
  assert.deepEqual(guestRequest.coordinator_person_ids, []);
  assert.equal(guestRequest.source_response_id, '');
  assert.equal(coordinator.kits[0].tracking_number, 'GUEST-TRACKING');
  assert.equal(coordinator.kits[0].details_visible, true);
  assert.equal(
    canActOnMicKitRequest(tracker.requests[0], {
      person_id: 'host-one',
    }),
    true
  );
  assert.equal(
    canActOnMicKitRequest(tracker.requests[0], {
      username: 'guest@example.com',
    }),
    false
  );

  const unrelated = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-two',
  });
  assert.equal(unrelated.requests.length, 0);
  assert.equal(unrelated.kits[0].tracking_number, '');
  assert.equal(unrelated.kits[0].details_visible, false);

  const manager = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  });
  assert.equal(manager.requests[0].requester_email, 'guest@example.com');
  assert.equal(
    manager.requests[0].shipping.address_line_1,
    '123 Private Lane'
  );
  assert.equal(manager.requests[0].notes, 'Private guest equipment note');
  assert.deepEqual(manager.requests[0].coordinator_person_ids, ['host-one']);
  assert.equal(manager.requests[0].source_response_id, 'guest-response-one');
  assert.equal(manager.requests[0].can_act, true);
});

test('current episode scope overrides stale host and guest coordinator snapshots', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'host-request',
        participant_type: 'host',
        requester_person_id: 'host-one',
        requester_name: 'Host Recipient',
        coordinator_person_ids: ['former-producer'],
        episode_id: 'episode-one',
        status: 'requested',
        shipping: {
          recipient: 'Host Recipient',
          address_line_1: '100 Host Lane',
          country: 'US',
        },
      },
      {
        request_id: 'guest-request',
        participant_type: 'guest',
        requester_name: 'Guest Recipient',
        coordinator_person_ids: ['former-producer'],
        episode_id: 'episode-one',
        status: 'requested',
        shipping: {
          recipient: 'Guest Recipient',
          address_line_1: '200 Guest Lane',
          country: 'US',
        },
      },
    ],
  });

  const currentProducer = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'current-producer',
    coordinated_episode_ids: ['episode-one'],
  });
  assert.equal(currentProducer.requests.length, 2);
  assert.equal(
    currentProducer.requests.every((request) => request.is_coordinator),
    true
  );
  assert.equal(
    currentProducer.requests.every((request) => request.shipping),
    true
  );

  const formerProducer = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'former-producer',
    coordinated_episode_ids: [],
  });
  assert.equal(formerProducer.requests.length, 0);
  assert.equal(
    tracker.requests.every(
      (request) =>
        canActOnMicKitRequest(request, {
          person_id: 'former-producer',
          coordinated_episode_ids: [],
        }) === false
    ),
    true
  );

  const host = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-one',
    coordinated_episode_ids: [],
  });
  assert.deepEqual(
    host.requests.map((request) => request.request_id),
    ['host-request']
  );
  assert.equal(host.requests[0].is_mine, true);

  const manager = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  });
  assert.equal(manager.requests.length, 2);

  const roleAwareProducer = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'current-producer',
    produced_episode_ids: ['episode-one'],
    hosted_episode_ids: [],
  });
  assert.deepEqual(
    roleAwareProducer.requests.map((request) => request.request_id),
    ['host-request', 'guest-request']
  );

  const cohost = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-two',
    produced_episode_ids: [],
    hosted_episode_ids: ['episode-one'],
  });
  assert.deepEqual(
    cohost.requests.map((request) => request.request_id),
    ['guest-request']
  );
  assert.equal(cohost.requests[0].shipping.address_line_1, '200 Guest Lane');
});

test('current episode producers can see older guest requests without stale coordinator data', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    requests: [
      {
        request_id: 'legacy-guest-request',
        participant_type: 'guest',
        coordinator_person_ids: ['host-one'],
        source: 'guest_questionnaire',
        requester_name: 'Guest Recipient',
        requester_email: 'guest@example.com',
        country: 'US',
        city_region: 'Bozeman, Montana',
        need_by: '2026-10-01',
        episode_id: 'episode-one',
        status: 'requested',
        shipping: {
          recipient: 'Guest Recipient',
          address_line_1: '123 Private Lane',
          city: 'Bozeman',
          region: 'MT',
          postal_code: '59715',
          country: 'US',
        },
      },
    ],
  });

  const producer = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'producer-one',
    coordinated_episode_ids: ['episode-one'],
  });
  assert.equal(producer.requests.length, 1);
  assert.equal(producer.requests[0].is_coordinator, true);
  assert.equal(producer.requests[0].can_act, true);
  assert.equal(
    producer.requests[0].shipping.address_line_1,
    '123 Private Lane'
  );
  assert.equal(
    canActOnMicKitRequest(tracker.requests[0], {
      person_id: 'producer-one',
      coordinated_episode_ids: ['episode-one'],
    }),
    true
  );

  const unrelatedProducer = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'producer-two',
    coordinated_episode_ids: ['episode-two'],
  });
  assert.equal(unrelatedProducer.requests.length, 0);

  const formerHost = sanitizeMicKitTrackerForViewer(tracker, {
    person_id: 'host-one',
    coordinated_episode_ids: [],
  });
  assert.equal(formerHost.requests.length, 0);
  assert.equal(
    canActOnMicKitRequest(tracker.requests[0], {
      person_id: 'host-one',
      coordinated_episode_ids: [],
    }),
    false
  );

  assert.equal(
    canActOnMicKitRequest(
      {
        ...tracker.requests[0],
        episode_id: '',
      },
      {
        person_id: 'host-one',
        coordinated_episode_ids: ['episode-one'],
      }
    ),
    false
  );
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

test('keeps direct-handoff custody and tracking private to the related recipient', () => {
  const tracker = normalizeMicKitTracker({
    ...DEFAULT_MIC_KIT_TRACKER,
    kits: [
      {
        ...DEFAULT_MIC_KIT_TRACKER.kits[0],
        status: 'with_holder',
        current_holder_name: 'Current Recipient',
        current_location: 'Current recipient private location',
        checked_out_request_id: 'current-request',
        checked_out_at: '2026-08-01T12:00:00.000Z',
        next_request_id: 'next-request',
        ship_by: '2026-08-10',
        carrier: 'UPS',
        tracking_number: 'CURRENT-TRACKING',
        tracking_url: 'https://tracking.example/current',
        tracking_request_id: 'current-request',
      },
    ],
    requests: [
      {
        request_id: 'current-request',
        requester_subject: 'current-subject',
        requester_name: 'Current Recipient',
        status: 'checked_out',
        kit_id: 'tah-us-1',
      },
      {
        request_id: 'next-request',
        requester_subject: 'next-subject',
        requester_name: 'Next Recipient',
        status: 'assigned',
        kit_id: 'tah-us-1',
      },
    ],
  });

  const currentView = sanitizeMicKitTrackerForViewer(tracker, {
    subject: 'current-subject',
  }).kits[0];
  assert.equal(currentView.current_holder_name, 'Current Recipient');
  assert.equal(currentView.current_location, 'Current recipient private location');
  assert.equal(currentView.checked_out_request_id, 'current-request');
  assert.equal(currentView.next_request_id, '');
  assert.equal(currentView.ship_by, '');
  assert.equal(currentView.tracking_number, 'CURRENT-TRACKING');

  const nextView = sanitizeMicKitTrackerForViewer(tracker, {
    subject: 'next-subject',
  }).kits[0];
  assert.equal(nextView.current_holder_name, '');
  assert.equal(nextView.current_location, '');
  assert.equal(nextView.checked_out_request_id, '');
  assert.equal(nextView.checked_out_at, '');
  assert.equal(nextView.next_request_id, 'next-request');
  assert.equal(nextView.ship_by, '2026-08-10');
  assert.equal(nextView.tracking_number, '');

  const nextTrackingView = sanitizeMicKitTrackerForViewer(
    {
      ...tracker,
      kits: tracker.kits.map((kit) => ({
        ...kit,
        tracking_number: 'NEXT-TRACKING',
        tracking_url: 'https://tracking.example/next',
        tracking_request_id: 'next-request',
      })),
    },
    { subject: 'next-subject' }
  ).kits[0];
  assert.equal(nextTrackingView.tracking_number, 'NEXT-TRACKING');
  assert.equal(nextTrackingView.current_location, '');

  const managerView = sanitizeMicKitTrackerForViewer(tracker, {
    canManage: true,
  }).kits[0];
  assert.equal(managerView.current_location, 'Current recipient private location');
  assert.equal(managerView.next_request_id, 'next-request');
  assert.equal(managerView.tracking_number, 'CURRENT-TRACKING');
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
