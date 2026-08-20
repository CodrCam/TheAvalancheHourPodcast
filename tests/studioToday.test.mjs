import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildStudioToday,
  filterStudioTodayActions,
  isViewerMicKitRequestActionable,
} from '../lib/studioToday.mjs';

function episode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    status: 'in_progress',
    due_date: '2026-07-29',
    target_release_date: '2026-08-05',
    delivery_health: 'on_track',
    completion: { host_percent: 40 },
    my_roles: ['host'],
    ...overrides,
  };
}

test('gives a host a concrete next step for an active episode', () => {
  const result = buildStudioToday(
    { episodes: [episode()] },
    { today: '2026-07-26' }
  );

  assert.equal(result.actions[0].title, 'Continue “Episode One”');
  assert.equal(result.actions[0].badge, '40% ready');
  assert.equal(result.metrics.due_this_week, 1);
});

test('uses the same action dates for the due-this-week metric and filter', () => {
  const actions = [
    { id: 'today', date: '2026-07-26', kind: 'episode' },
    { id: 'in-seven-days', date: '2026-08-02', kind: 'intake' },
    { id: 'later', date: '2026-08-03', kind: 'episode' },
    { id: 'past-due', date: '2026-07-25', kind: 'episode' },
    { id: 'undated', date: '', kind: 'mic_kit' },
  ];

  assert.deepEqual(
    filterStudioTodayActions(actions, 'due_this_week', {
      today: '2026-07-26',
    }).map((action) => action.id),
    ['today', 'in-seven-days']
  );
});

test('keeps the default queue concise while making every next action available', () => {
  const actions = Array.from({ length: 11 }, (_, index) => ({
    id: `action-${index + 1}`,
  }));

  assert.equal(filterStudioTodayActions(actions, 'priority').length, 8);
  assert.equal(filterStudioTodayActions(actions, 'all').length, 11);
});

test('filters the queue to operations follow-ups', () => {
  const actions = [
    { id: 'episode', kind: 'episode' },
    { id: 'orders', kind: 'operations' },
    { id: 'inventory', kind: 'operations' },
  ];

  assert.deepEqual(
    filterStudioTodayActions(actions, 'operations').map(
      (action) => action.id
    ),
    ['orders', 'inventory']
  );
});

test('keeps requested changes with the host instead of activating production', () => {
  const result = buildStudioToday(
    {
      episodes: [
        episode(),
        episode({
          episode_id: 'episode-two',
          title: 'Episode Two',
          status: 'needs_changes',
          delivery_health: 'off_track',
        }),
      ],
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.actions[0].title.includes('requested changes'), true);
  assert.equal(result.actions[0].urgency, 'urgent');
  assert.equal(
    result.actions[0].href,
    '/studio/episodes/episode-two'
  );
  assert.equal(result.metrics.off_track, 1);
});

test('a producer can watch a host draft without receiving draft actions', () => {
  const draft = episode({
    my_roles: ['producer'],
    workflow: {
      next_due_task: {
        task_id: 'guest-prep',
        label: 'Prepare guest brief',
        due_date: '2026-07-28',
        owner_type: 'producer',
        owner_label: 'Assigned producer',
      },
    },
  });
  const producer = buildStudioToday(
    { episodes: [draft] },
    { today: '2026-07-26' }
  );

  assert.equal(producer.actions.length, 0);
  assert.equal(producer.metrics.active_episodes, 1);
});

test('deletion-scheduled Studios disappear from Today work', () => {
  const result = buildStudioToday(
    {
      episodes: [
        episode({
          deletion_pending: true,
          deleted_at: '2026-07-26T12:00:00.000Z',
          delivery_health: 'off_track',
        }),
      ],
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.episode_actions.length, 0);
  assert.equal(result.metrics.active_episodes, 0);
  assert.equal(result.metrics.off_track, 0);
});

test('routes workflow work to Production while routine package work stays on Package', () => {
  const result = buildStudioToday(
    {
      episodes: [
        episode({
          episode_id: 'workflow-episode',
          status: 'accepted',
          my_roles: ['host'],
          workflow: {
            next_due_task: {
              task_id: 'intro-ready',
              label: 'Introduction ready',
              due_date: '2026-07-28',
              owner_type: 'hosts',
              assigned_person_ids: [],
              owner_label: 'Hosts',
            },
          },
        }),
        episode({
          episode_id: 'package-episode',
        }),
      ],
    },
    { today: '2026-07-26' }
  );

  assert.equal(
    result.episode_actions.find(
      (action) => action.id === 'episode:workflow-episode'
    ).href,
    '/studio/episodes/workflow-episode/production#production-workflow'
  );
  assert.equal(
    result.episode_actions.find(
      (action) => action.id === 'episode:package-episode'
    ).href,
    '/studio/episodes/package-episode'
  );
});

test('shows producer review work to a manager or assigned producer', () => {
  const submitted = episode({
    status: 'submitted',
    my_roles: [],
  });
  const manager = buildStudioToday(
    { episodes: [submitted], canManageEpisodes: true },
    { today: '2026-07-26' }
  );
  const unrelatedHost = buildStudioToday(
    { episodes: [submitted] },
    { today: '2026-07-26' }
  );

  assert.equal(manager.actions[0].badge, 'Producer review');
  assert.equal(unrelatedHost.actions.length, 0);
});

test('combines Caleb operations and mic-kit work into the same queue', () => {
  const result = buildStudioToday(
    {
      micKitPayload: {
        automation: {
          actions: [
            {
              action_id: 'ship-kit',
              title: 'Create the kit label',
              detail: 'Shipment is due.',
              urgency: 'urgent',
            },
          ],
        },
      },
      canManageMicKits: true,
      operations: {
        orders: { unshipped: 2 },
        inventory: {
          low_stock: 1,
          sold_out: 1,
          low_stock_rows: [
            {
              sku: 'field-shirt-blue-m',
              label: 'Blue / Medium',
              quantity: 1,
              attention_status: 'low_stock',
            },
          ],
          sold_out_rows: [
            {
              sku: 'beanie-black',
              label: 'Black',
              quantity: 0,
              attention_status: 'sold_out',
            },
          ],
        },
      },
    },
    { today: '2026-07-26' }
  );

  assert.deepEqual(
    result.actions.map((action) => action.kind),
    ['mic_kit', 'operations', 'operations']
  );
  assert.deepEqual(
    result.operations_actions.find(
      (action) => action.id === 'operations:inventory'
    ).inventory_items.map((item) => item.sku),
    ['beanie-black', 'field-shirt-blue-m']
  );
});

test('does not add muted inventory items to the priority queue', () => {
  const result = buildStudioToday(
    {
      operations: {
        orders: { unshipped: 0 },
        inventory: {
          low_stock: 0,
          sold_out: 0,
          muted_attention: 2,
          muted_rows: [
            { sku: 'beanie-black', attention_status: 'sold_out' },
            { sku: 'field-shirt-blue-m', attention_status: 'low_stock' },
          ],
        },
      },
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.operations_actions.length, 0);
  assert.equal(result.metrics.action_count, 0);
});

test('shows only the signed-in host mic-kit requests', () => {
  const result = buildStudioToday(
    {
      micKitPayload: {
        tracker: {
          requests: [
            {
              request_id: 'mine',
              is_mine: true,
              status: 'assigned',
              need_by: '2026-08-01',
            },
            {
              request_id: 'other',
              is_mine: false,
              status: 'assigned',
            },
          ],
        },
      },
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.mic_kit_actions.length, 1);
  assert.equal(result.mic_kit_actions[0].id, 'mic-kit:mine');
});

test('surfaces coordinated guest equipment reviews with actionable copy', () => {
  const coordinatedReview = {
    request_id: 'guest-review',
    participant_type: 'guest',
    request_kind: 'equipment_review',
    requester_name: 'Alex Guest',
    is_mine: false,
    is_coordinator: true,
    status: 'requested',
    need_by: '2026-08-01',
    recording_date: '2026-08-08',
    notes: 'The guest is unsure whether the microphone is suitable.',
  };
  const result = buildStudioToday(
    {
      micKitPayload: {
        tracker: {
          requests: [
            coordinatedReview,
            {
              ...coordinatedReview,
              request_id: 'unrelated-guest',
              is_coordinator: false,
            },
            {
              ...coordinatedReview,
              request_id: 'unrelated-host',
              participant_type: 'host',
              is_coordinator: true,
            },
          ],
        },
      },
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.mic_kit_actions.length, 1);
  assert.deepEqual(
    {
      id: result.mic_kit_actions[0].id,
      title: result.mic_kit_actions[0].title,
      badge: result.mic_kit_actions[0].badge,
      href: result.mic_kit_actions[0].href,
      urgency: result.mic_kit_actions[0].urgency,
    },
    {
      id: 'mic-kit:guest-review',
      title: 'Confirm Alex Guest’s recording setup',
      badge: 'Guest equipment review',
      href: '/studio/mic-kits#guest-review',
      urgency: 'medium',
    }
  );
  assert.match(result.mic_kit_actions[0].detail, /unsure/i);
  assert.equal(isViewerMicKitRequestActionable(coordinatedReview), true);
  assert.equal(
    isViewerMicKitRequestActionable({
      ...coordinatedReview,
      status: 'declined',
    }),
    false
  );
});

test('puts Team Inbox blockers and untriaged requests into Caleb’s queue', () => {
  const result = buildStudioToday(
    {
      canManageIntake: true,
      intakePayload: {
        summary: { open: 2 },
        items: [
          {
            item_id: 'blocker-one',
            kind: 'blocker',
            title: 'Recording link is unavailable',
            status: 'reviewing',
            priority: 'high',
            created_by_name: 'Host One',
          },
          {
            item_id: 'idea-one',
            kind: 'idea',
            title: 'Shared guest checklist',
            status: 'new',
            priority: 'normal',
            created_by_name: 'Host Two',
          },
        ],
      },
    },
    { today: '2026-07-26' }
  );

  assert.equal(result.intake_actions.length, 2);
  assert.equal(
    result.actions[0].title,
    'Unblock “Recording link is unavailable”'
  );
  assert.equal(result.metrics.intake_open, 2);
});

test('shows a host only their assigned or waiting Team Inbox follow-ups', () => {
  const result = buildStudioToday(
    {
      viewerPersonId: 'host-one',
      intakePayload: {
        items: [
          {
            item_id: 'assigned',
            kind: 'request',
            title: 'Confirm the new intro',
            status: 'in_progress',
            assigned_to_person_id: 'host-one',
            assigned_to_name: 'Host One',
          },
          {
            item_id: 'someone-else',
            kind: 'question',
            title: 'Unrelated question',
            status: 'new',
            created_by_person_id: 'host-two',
          },
        ],
      },
    },
    { today: '2026-07-26' }
  );

  assert.deepEqual(
    result.intake_actions.map((action) => action.id),
    ['intake:assigned']
  );
});
