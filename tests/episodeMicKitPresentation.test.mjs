import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  EPISODE_MIC_KIT_PLAN_CHOICES,
  applyEpisodeMicKitReadinessToCompletion,
  applyEpisodeMicKitPlanUpdate,
  buildEpisodeMicKitPlanRows,
  findEpisodeMicKitRequest,
  getEpisodeMicKitPlanCompletion,
  getEpisodeMicKitRequestCoverage,
  getEpisodeMicKitSubmissionReadiness,
  isEpisodeMicKitPlanResolved,
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
      status: 'assigned',
      has_kit_assignment: true,
      updated_at: '2026-08-04T12:00:00.000Z',
    },
  ]);
  assert.doesNotMatch(JSON.stringify(coverage), /private|tracking|address/i);
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

test('submission readiness requires an active request for the same host and episode', () => {
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
