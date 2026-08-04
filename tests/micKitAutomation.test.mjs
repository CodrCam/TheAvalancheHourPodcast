import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildMicKitAutomation,
  getMicKitAssignmentOptions,
} from '../lib/micKitAutomation.mjs';
import { DEFAULT_MIC_KIT_TRACKER } from '../lib/micKitPresentation.mjs';

test('prioritizes linked episodes and recommends an available in-country kit', () => {
  const tracker = {
    ...DEFAULT_MIC_KIT_TRACKER,
    inventory_confirmed: true,
    kits: DEFAULT_MIC_KIT_TRACKER.kits.map((kit, index) => ({
      ...kit,
      status: index <= 3 ? 'available' : 'maintenance',
    })),
    requests: [
      {
        request_id: 'later-request',
        requester_person_id: 'host-later',
        requester_name: 'Later Host',
        country: 'US',
        city_region: 'Denver, Colorado',
        need_by: '2026-09-20',
        status: 'approved',
      },
      {
        request_id: 'episode-request',
        requester_person_id: 'host-priority',
        requester_name: 'Priority Host',
        country: 'CA',
        city_region: 'Revelstoke, British Columbia',
        need_by: '2026-08-05',
        recording_date: '2026-08-06',
        episode_id: 'season-opener',
        status: 'approved',
      },
    ],
  };
  const episodes = [
    {
      episode_id: 'season-opener',
      title: 'Season Opener',
      status: 'planning',
      due_date: '2026-08-07',
      target_release_date: '2026-08-14',
      host_person_ids: ['host-priority'],
    },
  ];

  const automation = buildMicKitAutomation(tracker, episodes, {
    today: '2026-07-25',
  });

  assert.equal(
    automation.recommendations[0].request_id,
    'episode-request'
  );
  assert.equal(
    automation.recommendations[0].recommended_kit_id,
    'tah-ca-1'
  );
  assert.equal(
    automation.recommendations[0].recommended_ship_by,
    '2026-07-30'
  );
  assert.equal(
    automation.recommendations[0].recommended_shipping_provider,
    'manual_carrier'
  );
  assert.match(
    automation.recommendations[0].reasons.join(' '),
    /Season Opener/
  );
});

test('surfaces overdue returns and upcoming episode hosts without requests', () => {
  const tracker = {
    ...DEFAULT_MIC_KIT_TRACKER,
    inventory_confirmed: true,
    kits: [
      {
        ...DEFAULT_MIC_KIT_TRACKER.kits[0],
        status: 'with_holder',
        current_holder_name: 'Current Host',
        checked_out_request_id: 'checked-out-request',
        due_back: '2026-07-20',
      },
    ],
    requests: [
      {
        request_id: 'checked-out-request',
        requester_person_id: 'covered-host',
        requester_name: 'Current Host',
        status: 'checked_out',
        kit_id: 'tah-us-1',
      },
    ],
  };
  const episodes = [
    {
      episode_id: 'next-episode',
      title: 'Next Episode',
      status: 'planning',
      due_date: '2026-08-01',
      target_release_date: '2026-08-08',
      host_person_ids: ['covered-host', 'uncovered-host'],
    },
  ];

  const automation = buildMicKitAutomation(tracker, episodes, {
    today: '2026-07-25',
  });

  assert.equal(automation.metrics.overdue_returns, 1);
  assert.equal(automation.metrics.uncovered_episode_hosts, 1);
  assert.equal(automation.actions[0].kind, 'overdue_return');
  assert.ok(
    automation.actions.some(
      (action) => action.kind === 'episode_coverage'
    )
  );
});

test('treats a resolved episode microphone plan as covered without a kit request', () => {
  const automation = buildMicKitAutomation(
    { kits: [], requests: [] },
    [
      {
        episode_id: 'own-equipment-episode',
        title: 'Own Equipment Episode',
        status: 'planning',
        recording_date: '2026-08-03',
        host_person_ids: [
          'own-equipment-host',
          'no-kit-host',
          'unresolved-host',
        ],
        deliverables: [
          {
            id: 'mic-kit-plan',
            mic_kit_plans: [
              {
                host_person_id: 'own-equipment-host',
                choice: 'use_own_equipment',
                equipment_note: 'Shure MV7 and wired headphones',
              },
              {
                host_person_id: 'no-kit-host',
                choice: 'no_kit_needed',
              },
            ],
          },
        ],
      },
    ],
    { today: '2026-08-01' }
  );

  assert.equal(automation.metrics.uncovered_episode_hosts, 1);
  assert.match(
    automation.actions.find(
      (action) => action.kind === 'episode_coverage'
    )?.detail || '',
    /1 assigned host/
  );
});

test('uses the recording date ahead of release deadlines for mic coverage', () => {
  const automation = buildMicKitAutomation(
    {
      kits: [],
      requests: [],
      shipments: [],
    },
    [
      {
        episode_id: 'recording-first',
        title: 'Recording First',
        status: 'planning',
        recording_date: '2026-08-03',
        due_date: '2026-09-01',
        target_release_date: '2026-09-08',
        host_person_ids: ['host-one'],
      },
    ],
    { today: '2026-08-01' }
  );

  const coverage = automation.actions.find(
    (action) => action.episode_id === 'recording-first'
  );
  assert.equal(coverage?.kind, 'episode_coverage');
  assert.equal(coverage?.urgency, 'urgent');
});

test('surfaces equipment review without recommending or assigning a kit', () => {
  const automation = buildMicKitAutomation(
    {
      ...DEFAULT_MIC_KIT_TRACKER,
      inventory_confirmed: true,
      requests: [
        {
          request_id: 'guest-review',
          request_kind: 'equipment_review',
          participant_type: 'guest',
          requester_name: 'Alex Guest',
          episode_id: 'episode-one',
          recording_date: '2026-08-12',
          need_by: '2026-08-05',
          status: 'requested',
          notes: 'The guest is unsure whether the microphone is suitable.',
        },
      ],
    },
    [
      {
        episode_id: 'episode-one',
        title: 'Episode One',
        recording_date: '2026-08-12',
      },
    ],
    { today: '2026-08-01' }
  );

  assert.equal(automation.recommendations.length, 0);
  const review = automation.actions.find(
    (action) => action.request_id === 'guest-review'
  );
  assert.equal(review.kind, 'review_equipment_plan');
  assert.equal(review.kit_id, '');
  assert.match(review.detail, /unsure/i);
});

test('plans a direct handoff when a held kit is due before the next ship date', () => {
  const tracker = {
    ...DEFAULT_MIC_KIT_TRACKER,
    inventory_confirmed: true,
    kits: [
      {
        ...DEFAULT_MIC_KIT_TRACKER.kits[0],
        status: 'with_holder',
        current_holder_name: 'First Host',
        checked_out_request_id: 'first-host',
        due_back: '2026-08-01',
      },
    ],
    requests: [
      {
        request_id: 'first-host',
        requester_person_id: 'first-host',
        requester_name: 'First Host',
        status: 'checked_out',
        kit_id: 'tah-us-1',
        shipping: {
          recipient: 'First Host',
          address_line_1: '44 Sender Way',
          city: 'Bend',
          region: 'OR',
          postal_code: '97701',
          country: 'US',
        },
      },
      {
        request_id: 'next-host',
        requester_person_id: 'next-host',
        requester_name: 'Next Host',
        country: 'US',
        need_by: '2026-08-12',
        recording_date: '2026-08-13',
        status: 'approved',
      },
    ],
  };

  const automation = buildMicKitAutomation(tracker, [], {
    today: '2026-07-25',
  });
  const recommendation = automation.recommendations[0];

  assert.equal(recommendation.recommended_kit_id, 'tah-us-1');
  assert.equal(
    recommendation.recommended_shipping_provider,
    'pirate_ship_manual'
  );
  assert.match(recommendation.reasons.join(' '), /hand it off/);
});

test('assignment options rank available inventory ahead of a same-country handoff', () => {
  const tracker = {
    kits: [
      {
        kit_id: 'available-us',
        label: 'Available US kit',
        home_country: 'US',
        status: 'available',
      },
      {
        kit_id: 'held-ca',
        label: 'Held Canada kit',
        home_country: 'CA',
        status: 'with_holder',
        checked_out_request_id: 'current-holder',
        due_back: '2026-08-10',
      },
    ],
    requests: [
      {
        request_id: 'current-holder',
        requester_name: 'Current holder',
        status: 'checked_out',
        shipping: { country: 'CA' },
      },
      {
        request_id: 'next-guest',
        requester_name: 'Next guest',
        country: 'CA',
        need_by: '2026-08-20',
        recording_date: '2026-08-21',
        status: 'approved',
      },
    ],
  };

  const choices = getMicKitAssignmentOptions(tracker, 'next-guest', {
    today: '2026-08-01',
  });

  assert.deepEqual(
    choices.map((choice) => choice.kit_id),
    ['available-us', 'held-ca']
  );
  assert.equal(choices[0].availability, 'available_now');
  assert.equal(choices[0].same_country, false);
  assert.equal(choices[0].is_recommended, true);
  assert.equal(choices[0].ship_by, '2026-08-08');
  assert.equal(choices[0].due_back, '2026-08-24');
  assert.equal(choices[0].shipping_provider, 'pirate_ship_spreadsheet');
  assert.equal(choices[1].availability, 'direct_handoff');
  assert.equal(choices[1].same_country, true);
  assert.equal(choices[1].current_due_back, '2026-08-10');
  assert.equal(choices[1].ship_by, '2026-08-14');
  assert.equal(choices[1].shipping_provider, 'manual_carrier');
});

test('assignment options include all actual kits independent of virtual recommendations', () => {
  const tracker = {
    kits: [
      {
        kit_id: 'kit-one',
        label: 'Kit One',
        home_country: 'US',
        status: 'available',
      },
      {
        kit_id: 'kit-two',
        label: 'Kit Two',
        home_country: 'US',
        status: 'available',
      },
    ],
    requests: [
      {
        request_id: 'first-request',
        requester_name: 'First guest',
        country: 'US',
        need_by: '2026-08-05',
        status: 'approved',
      },
      {
        request_id: 'second-request',
        requester_name: 'Second guest',
        country: 'US',
        need_by: '2026-08-12',
        status: 'approved',
      },
    ],
  };

  const automation = buildMicKitAutomation(tracker, [], {
    today: '2026-08-01',
  });
  const choices = getMicKitAssignmentOptions(
    tracker,
    'second-request',
    { today: '2026-08-01' }
  );

  assert.notEqual(
    automation.recommendations[0].recommended_kit_id,
    automation.recommendations[1].recommended_kit_id
  );
  assert.ok(
    automation.recommendations.every(
      (recommendation) =>
        recommendation.assignment_options.length === 2 &&
        recommendation.assignment_options.every((option) => option.eligible)
    )
  );
  assert.deepEqual(
    choices.map((choice) => choice.kit_id),
    ['kit-one', 'kit-two']
  );
  assert.ok(choices.every((choice) => choice.eligible));
});

test('assignment options explain why unsafe inventory cannot be selected', () => {
  const tracker = {
    kits: [
      {
        kit_id: 'maintenance',
        label: 'Maintenance kit',
        status: 'maintenance',
      },
      {
        kit_id: 'retired',
        label: 'Retired kit',
        status: 'retired',
      },
      {
        kit_id: 'in-transit',
        label: 'In-transit kit',
        status: 'in_transit',
      },
      {
        kit_id: 'reserved',
        label: 'Reserved kit',
        status: 'available',
        next_request_id: 'another-request',
      },
      {
        kit_id: 'late-return',
        label: 'Late-return kit',
        status: 'with_holder',
        checked_out_request_id: 'current-holder',
        due_back: '2026-08-18',
      },
      {
        kit_id: 'missing-return',
        label: 'Missing-return kit',
        status: 'with_holder',
        checked_out_request_id: 'current-holder',
      },
    ],
    requests: [
      {
        request_id: 'current-holder',
        requester_name: 'Current holder',
        status: 'checked_out',
        shipping: { country: 'US' },
      },
      {
        request_id: 'another-request',
        requester_name: 'Another guest',
        status: 'approved',
      },
      {
        request_id: 'target-request',
        requester_name: 'Target guest',
        country: 'US',
        need_by: '2026-08-20',
        status: 'approved',
      },
    ],
  };

  const choices = getMicKitAssignmentOptions(
    tracker,
    'target-request',
    { today: '2026-08-01' }
  );
  const byId = new Map(
    choices.map((choice) => [choice.kit_id, choice])
  );

  assert.ok(choices.every((choice) => !choice.eligible));
  assert.match(byId.get('maintenance').reason, /Needs attention/);
  assert.match(byId.get('retired').reason, /Not in circulation/);
  assert.match(byId.get('in-transit').reason, /Currently in transit/);
  assert.match(byId.get('reserved').reason, /Reserved for another/);
  assert.match(byId.get('late-return').reason, /after this request must ship/);
  assert.match(byId.get('missing-return').reason, /return date is required/);
});
