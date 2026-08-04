import test from 'node:test';
import assert from 'node:assert/strict';
import { buildMicKitAutomation } from '../lib/micKitAutomation.mjs';
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
    'usps_click_n_ship'
  );
  assert.match(recommendation.reasons.join(' '), /hand it off/);
});
