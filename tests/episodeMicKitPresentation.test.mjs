import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_GUEST_MIC_KIT_PLAN_CHOICES,
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  EPISODE_MIC_KIT_PLAN_CHOICES,
  applyEpisodeMicKitReadinessToCompletion,
  applyEpisodeMicKitPlanUpdate,
  buildEpisodeMicKitPlanRows,
  connectEpisodeMicKitRequestToPlan,
  findEpisodeMicKitRequest,
  getEpisodeGuestMicKitRequestCoverage,
  getEpisodeMicKitPlanCompletion,
  getEpisodeMicKitRequestCoverage,
  getEpisodeMicKitSubmissionReadiness,
  hasEpisodeGuestMicKitPlan,
  isActiveEpisodeMicKitRequestCoverage,
  isEpisodeGuestMicKitPlanResolved,
  isEpisodeMicKitPlanResolved,
  isHistoricallyFulfilledEpisodeMicKitRequestCoverage,
  isSatisfiedEpisodeMicKitRequestCoverage,
  normalizeEpisodeGuestMicKitPlan,
  normalizeEpisodeMicKitPlans,
} from '../lib/episodeMicKitPresentation.mjs';

const hosts = ['host-one', 'host-two'];

function trackerWithRequests() {
  return {
    requests: [
      {
        request_id: 'request-one',
        requester_subject: 'private-subject',
        requester_person_id: 'host-one',
        requester_name: 'Private Name',
        requester_email: 'private@example.com',
        episode_id: 'episode-one',
        status: 'assigned',
        kit_id: 'kit-one',
        notes: 'Private request note',
        shipping: {
          address_line_1: '123 Private Lane',
          postal_code: '99999',
        },
        updated_at: '2026-08-04T12:00:00.000Z',
      },
      {
        request_id: 'wrong-episode',
        requester_person_id: 'host-one',
        episode_id: 'episode-two',
        status: 'requested',
      },
      {
        request_id: 'unassigned-host',
        requester_person_id: 'host-three',
        episode_id: 'episode-one',
        status: 'requested',
      },
    ],
    kits: [
      {
        kit_id: 'kit-one',
        label: 'Private physical kit label',
        status: 'in_transit',
        next_request_id: 'request-one',
        tracking_number: 'PRIVATE-TRACKING',
      },
    ],
  };
}

test('defines a dedicated built-in deliverable and compact plan choices', () => {
  assert.equal(EPISODE_MIC_KIT_DELIVERABLE_ID, 'mic-kit-plan');
  assert.deepEqual(EPISODE_MIC_KIT_PLAN_CHOICES, [
    'request_kit',
    'use_own_equipment',
    'no_kit_needed',
  ]);
  assert.deepEqual(EPISODE_GUEST_MIC_KIT_PLAN_CHOICES, [
    'request_kit',
    'use_own_equipment',
    'needs_follow_up',
  ]);
});

test('normalizes the additive guest plan without retaining private questionnaire data', () => {
  const plan = normalizeEpisodeGuestMicKitPlan({
    guest_name: '  Alex Guest  ',
    choice: 'request_kit',
    request_id: ' Guest Request One ',
    equipment_note: '  Producer will confirm the sound check.  ',
    response_revision: 3.9,
    readiness: {
      internet: 'yes',
      microphone: 'no',
      headphones: 'not_sure',
      quiet_place: 'yes',
      shipping_address: 'must not survive',
    },
    guest_email: 'must-not-survive@example.com',
    shipping_address: 'must not survive',
  });

  assert.deepEqual(plan, {
    guest_name: 'Alex Guest',
    choice: 'request_kit',
    request_id: 'guest-request-one',
    equipment_note: 'Producer will confirm the sound check.',
    response_revision: 3,
    readiness: {
      internet: 'yes',
      microphone: 'no',
      headphones: 'not_sure',
      quiet_place: 'yes',
    },
  });
  assert.equal(hasEpisodeGuestMicKitPlan(plan), true);
  assert.equal(hasEpisodeGuestMicKitPlan({}), false);
  assert.equal(isEpisodeGuestMicKitPlanResolved(plan), true);
  assert.equal(
    isEpisodeGuestMicKitPlanResolved({
      ...plan,
      choice: 'needs_follow_up',
      request_id: 'review-request-one',
    }),
    false
  );
  assert.equal(
    normalizeEpisodeGuestMicKitPlan({
      ...plan,
      choice: 'needs_follow_up',
      request_id: 'review-request-one',
    }).request_id,
    'review-request-one'
  );
  assert.doesNotMatch(JSON.stringify(plan), /email|shipping|private/i);
});

test('normalizes only assigned-host plans and strips unknown or private fields', () => {
  const plans = normalizeEpisodeMicKitPlans(
    [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'request-one',
        equipment_note: '  Optional USB-C adapter  ',
        requester_email: 'must-not-survive@example.com',
        shipping_address: 'must not survive',
        request_status: 'assigned',
      },
      {
        host_person_id: 'host-two',
        choice: 'use_own_equipment',
        equipment_note: 'Shure MV7 and wired headphones',
      },
      {
        host_person_id: 'host-three',
        choice: 'no_kit_needed',
      },
    ],
    hosts
  );

  assert.deepEqual(plans, [
    {
      host_person_id: 'host-one',
      choice: 'request_kit',
      request_id: 'request-one',
      equipment_note: 'Optional USB-C adapter',
    },
    {
      host_person_id: 'host-two',
      choice: 'use_own_equipment',
      request_id: '',
      equipment_note: 'Shure MV7 and wired headphones',
    },
  ]);
});

test('requires every assigned host to resolve the microphone plan', () => {
  const requestPlan = {
    host_person_id: 'host-one',
    choice: 'request_kit',
    request_id: 'request-one',
  };
  const ownEquipmentPlan = {
    host_person_id: 'host-two',
    choice: 'use_own_equipment',
    equipment_note: 'Shure MV7 and wired headphones',
  };

  assert.equal(isEpisodeMicKitPlanResolved(requestPlan), true);
  assert.equal(
    isEpisodeMicKitPlanResolved({
      ...requestPlan,
      request_id: '',
    }),
    false
  );
  assert.equal(isEpisodeMicKitPlanResolved(ownEquipmentPlan), true);
  assert.equal(
    isEpisodeMicKitPlanResolved({
      ...ownEquipmentPlan,
      equipment_note: '',
    }),
    false
  );
  assert.equal(
    isEpisodeMicKitPlanResolved({ choice: 'no_kit_needed' }),
    true
  );
  assert.equal(
    getEpisodeMicKitPlanCompletion([requestPlan], hosts).complete,
    false
  );
  assert.deepEqual(
    getEpisodeMicKitPlanCompletion(
      [requestPlan, ownEquipmentPlan],
      hosts
    ),
    {
      host_count: 2,
      resolved_count: 2,
      resolved_host_person_ids: hosts,
      complete: true,
    }
  );
});

test('binds a plan update to the authenticated assigned host', () => {
  const existing = [
    {
      host_person_id: 'host-two',
      choice: 'no_kit_needed',
      equipment_note: '',
    },
  ];
  const updated = applyEpisodeMicKitPlanUpdate({
    plans: existing,
    hostPersonIds: hosts,
    actorPersonId: 'host-one',
    update: {
      host_person_id: 'host-two',
      choice: 'request_kit',
      request_id: 'request-one',
      request_status: 'assigned',
      shipping_address: 'must not survive',
    },
  });

  assert.deepEqual(updated, [
    {
      host_person_id: 'host-one',
      choice: 'request_kit',
      request_id: 'request-one',
      equipment_note: '',
    },
    {
      host_person_id: 'host-two',
      choice: 'no_kit_needed',
      request_id: '',
      equipment_note: '',
    },
  ]);
  assert.throws(
    () =>
      applyEpisodeMicKitPlanUpdate({
        hostPersonIds: hosts,
        actorPersonId: 'host-three',
        update: { choice: 'no_kit_needed' },
      }),
    /only an assigned host/i
  );
});

test('connects an early request to the correct host or guest plan', () => {
  const base = {
    id: 'mic-kit-plan',
    mic_kit_plans: [
      {
        host_person_id: 'host-two',
        choice: 'no_kit_needed',
        equipment_note: 'Shared studio',
      },
    ],
  };
  const host = connectEpisodeMicKitRequestToPlan({
    deliverable: base,
    hostPersonIds: hosts,
    participantType: 'host',
    hostPersonId: 'host-one',
    requestId: 'host-request-one',
  });
  assert.deepEqual(host.mic_kit_plans, [
    {
      host_person_id: 'host-one',
      choice: 'request_kit',
      request_id: 'host-request-one',
      equipment_note: '',
    },
    {
      host_person_id: 'host-two',
      choice: 'no_kit_needed',
      request_id: '',
      equipment_note: 'Shared studio',
    },
  ]);

  const guest = connectEpisodeMicKitRequestToPlan({
    deliverable: host,
    hostPersonIds: hosts,
    participantType: 'guest',
    guestName: 'Alex Guest',
    requestId: 'guest-request-one',
  });
  assert.equal(guest.guest_mic_kit_plan.guest_name, 'Alex Guest');
  assert.equal(guest.guest_mic_kit_plan.choice, 'request_kit');
  assert.equal(guest.guest_mic_kit_plan.request_id, 'guest-request-one');
  assert.doesNotMatch(JSON.stringify(guest), /shipping|address|email/i);
});

test('verifies a linked canonical request by request, host, and episode', () => {
  const tracker = trackerWithRequests();
  assert.equal(
    findEpisodeMicKitRequest(tracker, {
      requestId: 'request-one',
      episodeId: 'episode-one',
      hostPersonId: 'host-one',
    })?.request_id,
    'request-one'
  );
  assert.equal(
    findEpisodeMicKitRequest(tracker, {
      requestId: 'request-one',
      episodeId: 'episode-two',
      hostPersonId: 'host-one',
    }),
    null
  );
  assert.equal(
    findEpisodeMicKitRequest(tracker, {
      requestId: 'request-one',
      episodeId: 'episode-one',
      hostPersonId: 'host-two',
    }),
    null
  );
});

test('returns narrowly redacted episode request coverage', () => {
  const coverage = getEpisodeMicKitRequestCoverage(trackerWithRequests(), {
    episodeId: 'episode-one',
    hostPersonIds: hosts,
  });

  assert.deepEqual(coverage, [
    {
      request_id: 'request-one',
      host_person_id: 'host-one',
      request_kind: 'shipment',
      review_resolution: '',
      status: 'assigned',
      has_kit_assignment: true,
      updated_at: '2026-08-04T12:00:00.000Z',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(coverage), /private|tracking|address/i);
});

test('returns safe guest request coverage and builds a guest participant row', () => {
  const tracker = trackerWithRequests();
  tracker.requests.push(
    {
      request_id: 'guest-request-one',
      participant_type: 'guest',
      requester_name: 'Private Guest Name',
      requester_email: 'private-guest@example.com',
      episode_id: 'episode-one',
      status: 'approved',
      kit_id: '',
      notes: 'Private guest request note',
      shipping: { address_line_1: '123 Private Guest Lane' },
      updated_at: '2026-08-06T12:00:00.000Z',
    },
    {
      request_id: 'guest-wrong-episode',
      participant_type: 'guest',
      episode_id: 'episode-two',
      status: 'requested',
    }
  );
  const guestCoverage = getEpisodeGuestMicKitRequestCoverage(tracker, {
    episodeId: 'episode-one',
  });

  assert.deepEqual(guestCoverage, [
    {
      request_id: 'guest-request-one',
      participant_type: 'guest',
      request_kind: 'shipment',
      review_resolution: '',
      status: 'approved',
      has_kit_assignment: false,
      updated_at: '2026-08-06T12:00:00.000Z',
    },
  ]);
  const rows = buildEpisodeMicKitPlanRows({
    plans: [
      { host_person_id: 'host-one', choice: 'no_kit_needed' },
    ],
    hostPersonIds: ['host-one'],
    guestPlan: {
      guest_name: 'Alex Guest',
      choice: 'request_kit',
      request_id: 'guest-request-one',
      response_revision: 1,
      readiness: { microphone: 'no', headphones: 'no' },
    },
    guestRequestCoverage: guestCoverage,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[1].participant_type, 'guest');
  assert.equal(rows[1].guest_name, 'Alex Guest');
  assert.equal(rows[1].resolved, true);
  assert.equal(rows[1].request_coverage.status, 'approved');
  assert.doesNotMatch(
    JSON.stringify(rows[1]),
    /email|shipping|address|private/i
  );
});

test('derives the guest setup lifecycle from an equipment-review queue item', () => {
  const guestPlan = {
    guest_name: 'Alex Guest',
    choice: 'needs_follow_up',
    request_id: '',
    equipment_note: 'The guest is unsure whether the microphone is suitable.',
    response_revision: 1,
    readiness: { microphone: 'not_sure', headphones: 'yes' },
  };
  const pendingCoverage = [
    {
      request_id: 'guest-review-one',
      participant_type: 'guest',
      request_kind: 'equipment_review',
      review_resolution: '',
      status: 'requested',
    },
  ];
  const pending = buildEpisodeMicKitPlanRows({
    hostPersonIds: [],
    guestPlan,
    guestRequestCoverage: pendingCoverage,
  })[0];
  assert.equal(pending.request_id, 'guest-review-one');
  assert.equal(pending.choice, 'needs_follow_up');
  assert.equal(pending.resolved, false);
  assert.equal(pending.request_coverage.request_kind, 'equipment_review');

  const shipment = buildEpisodeMicKitPlanRows({
    hostPersonIds: [],
    guestPlan,
    guestRequestCoverage: [
      {
        ...pendingCoverage[0],
        request_kind: 'shipment',
        review_resolution: 'shipment',
      },
    ],
  })[0];
  assert.equal(shipment.request_id, 'guest-review-one');
  assert.equal(shipment.choice, 'request_kit');
  assert.equal(shipment.resolved, true);

  const ownEquipment = buildEpisodeMicKitPlanRows({
    hostPersonIds: [],
    guestPlan,
    guestRequestCoverage: [
      {
        ...pendingCoverage[0],
        review_resolution: 'own_equipment',
        status: 'declined',
      },
    ],
  })[0];
  assert.equal(ownEquipment.request_id, 'guest-review-one');
  assert.equal(ownEquipment.choice, 'use_own_equipment');
  assert.equal(ownEquipment.resolved, true);
});

test('derives a resolved host-owned-equipment plan from a closed review', () => {
  const rows = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'host-review-one',
      },
    ],
    hostPersonIds: ['host-one'],
    requestCoverage: [
      {
        request_id: 'host-review-one',
        host_person_id: 'host-one',
        request_kind: 'equipment_review',
        review_resolution: 'own_equipment',
        status: 'declined',
        updated_at: '2026-08-07T12:00:00.000Z',
      },
    ],
  });

  assert.equal(rows.length, 1);
  assert.equal(rows[0].choice, 'use_own_equipment');
  assert.equal(rows[0].request_id, 'host-review-one');
  assert.equal(rows[0].resolved, true);
  assert.equal(rows[0].request_coverage.review_resolution, 'own_equipment');
  assert.equal(
    isActiveEpisodeMicKitRequestCoverage(rows[0].request_coverage),
    false
  );
});

test('keeps a linked returned shipment fulfilled without treating it as active', () => {
  const activeCoverage = {
    request_id: 'active-shipment',
    host_person_id: 'host-one',
    request_kind: 'shipment',
    status: 'assigned',
  };
  const returnedCoverage = {
    request_id: 'returned-shipment',
    host_person_id: 'host-one',
    request_kind: 'shipment',
    status: 'returned',
  };
  assert.equal(isActiveEpisodeMicKitRequestCoverage(activeCoverage), true);
  assert.equal(
    isHistoricallyFulfilledEpisodeMicKitRequestCoverage(activeCoverage),
    false
  );
  assert.equal(isSatisfiedEpisodeMicKitRequestCoverage(activeCoverage), true);
  assert.equal(isActiveEpisodeMicKitRequestCoverage(returnedCoverage), false);
  assert.equal(
    isHistoricallyFulfilledEpisodeMicKitRequestCoverage(returnedCoverage),
    true
  );
  assert.equal(
    isSatisfiedEpisodeMicKitRequestCoverage(returnedCoverage),
    true
  );
  assert.equal(
    isHistoricallyFulfilledEpisodeMicKitRequestCoverage({
      ...returnedCoverage,
      request_kind: 'equipment_review',
    }),
    false
  );

  const hostRow = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'returned-shipment',
      },
    ],
    hostPersonIds: ['host-one'],
    requestCoverage: [returnedCoverage],
  })[0];
  assert.equal(hostRow.choice, 'request_kit');
  assert.equal(hostRow.resolved, true);
  assert.equal(hostRow.request_coverage.status, 'returned');

  const guestRow = buildEpisodeMicKitPlanRows({
    hostPersonIds: [],
    guestPlan: {
      guest_name: 'Alex Guest',
      choice: 'request_kit',
      request_id: 'guest-returned-shipment',
      response_revision: 1,
    },
    guestRequestCoverage: [
      {
        request_id: 'guest-returned-shipment',
        participant_type: 'guest',
        request_kind: 'shipment',
        status: 'returned',
      },
    ],
  })[0];
  assert.equal(guestRow.choice, 'request_kit');
  assert.equal(guestRow.resolved, true);
  assert.equal(guestRow.request_coverage.status, 'returned');

  const unlinkedRow = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'different-request',
      },
    ],
    hostPersonIds: ['host-one'],
    requestCoverage: [returnedCoverage],
  })[0];
  assert.equal(unlinkedRow.resolved, false);
  assert.equal(unlinkedRow.request_coverage, null);
});

test('builds one safe plan row for every assigned host', () => {
  const coverage = getEpisodeMicKitRequestCoverage(trackerWithRequests(), {
    episodeId: 'episode-one',
    hostPersonIds: hosts,
  });
  const rows = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'request-one',
      },
    ],
    hostPersonIds: hosts,
    requestCoverage: coverage,
  });

  assert.equal(rows.length, 2);
  assert.equal(rows[0].resolved, true);
  assert.equal(rows[0].request_coverage.status, 'assigned');
  assert.deepEqual(rows[1], {
    host_person_id: 'host-two',
    choice: '',
    request_id: '',
    equipment_note: '',
    resolved: false,
    request_coverage: null,
  });

  const closedRows = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'request-one',
      },
    ],
    hostPersonIds: ['host-one'],
    requestCoverage: [
      {
        request_id: 'request-one',
        host_person_id: 'host-one',
        status: 'declined',
        has_kit_assignment: false,
        updated_at: '2026-08-05T12:00:00.000Z',
      },
    ],
  });
  assert.equal(closedRows[0].resolved, false);
  assert.equal(closedRows[0].request_coverage.status, 'declined');

  const wrongOwnerRows = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-two',
        choice: 'request_kit',
        request_id: 'request-one',
      },
    ],
    hostPersonIds: ['host-two'],
    requestCoverage: coverage,
  });
  assert.equal(wrongOwnerRows[0].resolved, false);
  assert.equal(wrongOwnerRows[0].request_coverage, null);
});

test('recovers a participant plan from the sole active episode request', () => {
  const hostRows = buildEpisodeMicKitPlanRows({
    plans: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        request_id: 'cancelled-request',
      },
    ],
    hostPersonIds: ['host-one'],
    requestCoverage: [
      {
        request_id: 'cancelled-request',
        host_person_id: 'host-one',
        request_kind: 'shipment',
        status: 'cancelled',
      },
      {
        request_id: 'replacement-review',
        host_person_id: 'host-one',
        request_kind: 'equipment_review',
        status: 'requested',
        updated_at: '2026-08-04T13:00:00.000Z',
      },
    ],
  });

  assert.equal(hostRows[0].choice, 'request_kit');
  assert.equal(hostRows[0].request_id, 'replacement-review');
  assert.equal(hostRows[0].resolved, false);
  assert.equal(
    hostRows[0].request_coverage.request_kind,
    'equipment_review'
  );

  const guestRows = buildEpisodeMicKitPlanRows({
    hostPersonIds: [],
    guestRequestCoverage: [
      {
        request_id: 'guest-review',
        participant_type: 'guest',
        request_kind: 'equipment_review',
        status: 'requested',
      },
    ],
  });
  assert.equal(guestRows.length, 1);
  assert.equal(guestRows[0].guest_name, 'Episode guest');
  assert.equal(guestRows[0].request_id, 'guest-review');
  assert.equal(guestRows[0].resolved, false);
});

test('submission readiness accepts active or linked fulfilled requests for the same episode', () => {
  const episode = {
    episode_id: 'episode-one',
    host_person_ids: hosts,
    deliverables: [
      {
        id: 'mic-kit-plan',
        required: true,
        mic_kit_plans: [
          {
            host_person_id: 'host-one',
            choice: 'request_kit',
            request_id: 'request-one',
          },
          {
            host_person_id: 'host-two',
            choice: 'no_kit_needed',
          },
        ],
      },
    ],
  };

  const active = getEpisodeMicKitSubmissionReadiness(
    episode,
    trackerWithRequests()
  );
  assert.deepEqual(active, {
    deliverable_id: 'mic-kit-plan',
    required: true,
    complete: true,
    host_count: 2,
    resolved_count: 2,
    gap_acknowledged: false,
    unresolved_hosts: [],
  });

  const fulfilledTracker = trackerWithRequests();
  fulfilledTracker.requests[0].status = 'returned';
  const fulfilled = getEpisodeMicKitSubmissionReadiness(
    episode,
    fulfilledTracker
  );
  assert.equal(fulfilled.complete, true);
  assert.equal(fulfilled.resolved_count, 2);
  assert.deepEqual(fulfilled.unresolved_hosts, []);

  const inactiveTracker = trackerWithRequests();
  inactiveTracker.requests[0].status = 'declined';
  const inactive = getEpisodeMicKitSubmissionReadiness(
    episode,
    inactiveTracker
  );
  assert.equal(inactive.complete, false);
  assert.deepEqual(inactive.unresolved_hosts, [
    {
      host_person_id: 'host-one',
      choice: 'request_kit',
      reason: 'request_inactive',
      request_status: 'declined',
    },
  ]);
  assert.doesNotMatch(
    JSON.stringify(inactive),
    /email|shipping|address|tracking|private/i
  );

  const wrongEpisodeTracker = trackerWithRequests();
  wrongEpisodeTracker.requests[0].episode_id = 'episode-two';
  const wrongEpisode = getEpisodeMicKitSubmissionReadiness(
    episode,
    wrongEpisodeTracker
  );
  assert.deepEqual(wrongEpisode.unresolved_hosts, [
    {
      host_person_id: 'host-one',
      choice: 'request_kit',
      reason: 'request_not_verified',
      request_status: '',
    },
  ]);
});

test('submission readiness includes a connected guest without blocking legacy episodes', () => {
  const episode = {
    episode_id: 'episode-one',
    host_person_ids: ['host-one'],
    deliverables: [
      {
        id: 'mic-kit-plan',
        required: true,
        mic_kit_plans: [
          { host_person_id: 'host-one', choice: 'no_kit_needed' },
        ],
        guest_mic_kit_plan: {
          guest_name: 'Alex Guest',
          choice: 'request_kit',
          request_id: 'guest-request-one',
          response_revision: 1,
          readiness: { microphone: 'no', headphones: 'no' },
        },
      },
    ],
  };
  const tracker = {
    requests: [
      {
        request_id: 'guest-request-one',
        participant_type: 'guest',
        episode_id: 'episode-one',
        status: 'requested',
      },
    ],
  };

  const active = getEpisodeMicKitSubmissionReadiness(episode, tracker);
  assert.equal(active.complete, true);
  assert.equal(active.host_count, 1);
  assert.equal(active.guest_count, 1);
  assert.equal(active.participant_count, 2);
  assert.equal(active.participant_resolved_count, 2);
  assert.equal(active.unresolved_guest, null);

  tracker.requests[0].status = 'declined';
  const declined = getEpisodeMicKitSubmissionReadiness(episode, tracker);
  assert.equal(declined.complete, false);
  assert.deepEqual(declined.unresolved_guest, {
    participant_type: 'guest',
    choice: 'request_kit',
    reason: 'request_inactive',
    request_status: 'declined',
  });

  const legacy = getEpisodeMicKitSubmissionReadiness(
    {
      ...episode,
      deliverables: [
        {
          ...episode.deliverables[0],
          guest_mic_kit_plan: undefined,
        },
      ],
    },
    tracker
  );
  assert.equal(legacy.complete, true);
  assert.equal(Object.hasOwn(legacy, 'guest_count'), false);
});

test('a missing or legacy-optional microphone plan still blocks submission', () => {
  const readiness = getEpisodeMicKitSubmissionReadiness(
    {
      episode_id: 'legacy-episode',
      host_person_ids: hosts,
      deliverables: [],
    },
    {}
  );

  assert.equal(readiness.required, true);
  assert.equal(readiness.complete, false);
  assert.deepEqual(
    readiness.unresolved_hosts.map(({ host_person_id, reason }) => ({
      host_person_id,
      reason,
    })),
    hosts.map((host_person_id) => ({
      host_person_id,
      reason: 'plan_missing',
    }))
  );

  const legacyOptional = getEpisodeMicKitSubmissionReadiness(
    {
      episode_id: 'legacy-episode',
      host_person_ids: ['host-one'],
      deliverables: [
        {
          id: 'mic-kit-plan',
          required: false,
          mic_kit_plans: [],
        },
      ],
    },
    {}
  );
  assert.equal(legacyOptional.required, true);
  assert.equal(legacyOptional.complete, false);
});

test('live microphone readiness safely adjusts submission completion and gap eligibility', () => {
  const baseCompletion = {
    required: 3,
    completed: 3,
    percent: 80,
    host_percent: 100,
    overall_percent: 80,
    host_ready: true,
    workflow_stage: 'ready_for_producer',
    remaining_reason: 'The host package is ready to submit to the producer.',
    missing: [],
    acknowledged_missing: 0,
    can_submit: true,
    can_submit_with_gaps: false,
  };
  const unresolved = {
    deliverable_id: 'mic-kit-plan',
    required: true,
    complete: false,
    gap_acknowledged: false,
    unresolved_hosts: [
      {
        host_person_id: 'host-one',
        choice: 'request_kit',
        reason: 'request_inactive',
        request_status: 'cancelled',
      },
    ],
  };

  const blocked = applyEpisodeMicKitReadinessToCompletion(
    baseCompletion,
    unresolved
  );
  assert.equal(blocked.can_submit, false);
  assert.equal(blocked.can_submit_with_gaps, false);
  assert.equal(blocked.completed, 2);
  assert.equal(blocked.host_percent, 67);
  assert.equal(blocked.missing[0].id, 'mic-kit-plan');
  assert.deepEqual(
    blocked.missing[0].unresolved_hosts,
    unresolved.unresolved_hosts
  );

  const acknowledged = applyEpisodeMicKitReadinessToCompletion(
    baseCompletion,
    { ...unresolved, gap_acknowledged: true }
  );
  assert.equal(acknowledged.can_submit, false);
  assert.equal(acknowledged.can_submit_with_gaps, true);
  assert.equal(acknowledged.acknowledged_missing, 1);
});
