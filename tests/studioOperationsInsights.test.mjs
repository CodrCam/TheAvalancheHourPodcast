import assert from 'node:assert/strict';
import test from 'node:test';

import { buildStudioOperationsInsightModel } from '../lib/studioOperationsInsights.mjs';

function workflow({ sent = false, received = false, ...overrides } = {}) {
  return {
    overdue_count: 0,
    off_track: false,
    has_dependency_blocking: false,
    dependency_blocked_task_ids: [],
    task_states: [
      { task_id: 'guest-prep-sent', complete: sent },
      { task_id: 'guest-prep-received', complete: received },
    ],
    next_due_task: {
      label: 'Private task label',
      evidence_note: 'Private task evidence',
    },
    ...overrides,
  };
}

function episode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    title: 'Private working title',
    season: 'Season 11',
    status: 'planning',
    target_release_date: '2026-11-04',
    host_person_ids: ['host-one'],
    host_names: ['Host One'],
    producer_person_id: 'producer-one',
    producer_name: 'Producer One',
    producer_email: 'private-producer@example.test',
    recording_location: 'Private recording room',
    producer_feedback: 'Private feedback',
    messages: [{ body: 'Private message' }],
    completion: {
      host_percent: 50,
      missing: [{ label: 'Private missing item' }],
    },
    workflow: workflow(),
    my_roles: [],
    ...overrides,
  };
}

function managerInput() {
  return [
    episode(),
    episode({
      episode_id: 'host-draft-two',
      status: 'in_progress',
      target_release_date: '',
      host_person_ids: ['host-one', 'host-two'],
      host_names: ['Host One', 'Host Two'],
      workflow: workflow({
        sent: true,
        has_dependency_blocking: true,
        dependency_blocked_task_ids: ['private-task-id'],
      }),
      effective_delivery_health: 'off_track',
    }),
    episode({
      episode_id: 'producer-review',
      status: 'submitted',
      host_person_ids: ['host-two'],
      host_names: ['Host Two'],
      producer_person_id: 'producer-two',
      producer_name: 'Producer Two',
      workflow: workflow({
        sent: true,
        received: true,
        overdue_count: 2,
        off_track: true,
      }),
    }),
    episode({
      episode_id: 'producer-review-with-gaps',
      status: 'submitted_with_gaps',
      target_release_date: '',
      host_person_ids: ['host-four'],
      host_names: ['Host Four', 'host-private@example.test'],
      producer_person_id: 'producer-private-id',
      producer_name: 'producer-private@example.test',
      workflow: workflow({ sent: true }),
    }),
    episode({
      episode_id: 'lead-review',
      status: 'accepted',
      production_stage: 'lead_review',
      host_person_ids: ['host-five'],
      host_names: ['Host Five'],
      producer_person_id: 'producer-two',
      producer_name: 'Producer Two',
      workflow: workflow({ sent: true, received: true }),
    }),
    episode({
      episode_id: 'complete',
      status: 'accepted',
      production_stage: 'complete',
      production_completed_at: '2026-11-06T12:00:00.000Z',
      host_person_ids: ['host-six'],
      host_names: ['Host Six'],
      producer_person_id: '',
      producer_name: '',
      workflow: workflow({ sent: true, received: true }),
    }),
  ];
}

test('manager insights normalize season progress, pipeline, health, and safe workload', () => {
  const episodes = managerInput();
  const before = structuredClone(episodes);
  const model = buildStudioOperationsInsightModel({
    episodes,
    season: {
      label: 'Season 11',
      status: 'planning',
      starts_on: '2026-10-01',
      ends_on: '2027-05-31',
      schedule_slots: 10,
      episode_studios: 6,
    },
    permissions: ['episodes:read', 'episodes:manage'],
    capabilities: { producer_tasks: true },
  });

  assert.equal(model.scope, 'team');
  assert.deepEqual(model.metrics.schedule_coverage, {
    scheduled: 4,
    unscheduled: 2,
    total: 6,
    percent: 67,
  });
  assert.deepEqual(
    {
      host_drafts: model.metrics.host_drafts,
      producer_review: model.metrics.producer_review,
      production_active: model.metrics.production_active,
      attention: model.metrics.attention,
      questionnaires_received: model.metrics.questionnaires_received,
      questionnaires_pending: model.metrics.questionnaires_pending,
    },
    {
      host_drafts: 2,
      producer_review: 2,
      production_active: 1,
      attention: 2,
      questionnaires_received: 3,
      questionnaires_pending: 2,
    }
  );
  assert.deepEqual(model.health, {
    on_track: 4,
    off_track: 2,
    overdue: 1,
    blocked: 1,
    unassigned: 1,
  });
  assert.deepEqual(
    model.pipeline.map(({ id, count }) => [id, count]),
    [
      ['host_drafts', 2],
      ['producer_review', 2],
      ['production_active', 1],
      ['lead_review', 1],
      ['questionnaires_pending', 2],
      ['questionnaires_received', 3],
    ]
  );
  assert.deepEqual(
    model.workload
      .filter((row) => row.role === 'host')
      .map((row) => [row.name, row.episode_count]),
    [
      ['Host One', 2],
      ['Host Two', 2],
      ['Host Five', 1],
      ['Host Four', 1],
      ['Host Six', 1],
    ]
  );
  assert.deepEqual(model.workload_meta.producer_assignment, {
    assigned: 5,
    unassigned: 1,
    names_unavailable: 1,
  });
  assert.equal(model.workload_meta.producer_breakdown_available, false);
  assert.equal(model.season.created_percent, 60);
  assert.equal(model.season.open_slots, 4);
  assert.deepEqual(episodes, before);
});

test('the model emits no episode, contact, recording, note, task, URL, or identifier details', () => {
  const model = buildStudioOperationsInsightModel({
    episodes: managerInput(),
    season: { label: 'Season 11', schedule_slots: 10, episode_studios: 6 },
    permissions: ['episodes:manage'],
  });
  const serialized = JSON.stringify(model);

  for (const privateValue of [
    'private-producer@example.test',
    'producer-private@example.test',
    'host-private@example.test',
    'producer-private-id',
    'Private working title',
    'Private recording room',
    'Private feedback',
    'Private message',
    'Private missing item',
    'Private task label',
    'Private task evidence',
    'private-task-id',
  ]) {
    assert.equal(serialized.includes(privateValue), false, privateValue);
  }
  assert.equal(serialized.includes('producer_email'), false);
  assert.equal(serialized.includes('episode_id'), false);
});

test('producer insights retain assigned production counts without team workload', () => {
  const model = buildStudioOperationsInsightModel({
    episodes: [
      episode({ status: 'submitted', my_roles: ['producer'] }),
      episode({
        episode_id: 'host-only-submission',
        status: 'submitted',
        my_roles: ['host'],
      }),
      episode({
        episode_id: 'lead',
        status: 'accepted',
        production_stage: 'lead_review',
        my_roles: ['production_lead'],
      }),
    ],
    season: { label: 'Season 11', schedule_slots: 38, episode_studios: 8 },
    permissions: ['episodes:read'],
    capabilities: { producer_tasks: true },
  });

  assert.equal(model.scope, 'assigned');
  assert.equal(model.metrics.producer_review, 1);
  assert.equal(model.metrics.production_active, 1);
  assert.equal(model.visibility.team_workload, false);
  assert.deepEqual(model.workload, []);
  assert.deepEqual(model.workload_meta.personal, {
    episode_count: 3,
    as_host: 1,
    as_producer: 1,
    as_production_lead: 1,
    as_workflow_assignee: 0,
    actionable: 2,
  });
  assert.equal(
    model.pipeline.some((item) => item.id === 'producer_review'),
    true
  );
  assert.equal(
    model.pipeline.find((item) => item.id === 'producer_review')?.count,
    1
  );
});

test('host-only insights suppress producer metrics and production pipeline rows', () => {
  const model = buildStudioOperationsInsightModel({
    episodes: [
      episode({ my_roles: ['host'] }),
      episode({
        episode_id: 'submitted-host',
        status: 'submitted',
        my_roles: ['host'],
      }),
    ],
    season: { label: 'Season 11', schedule_slots: 38, episode_studios: 8 },
    permissions: ['episodes:read'],
    capabilities: { producer_tasks: false },
  });

  assert.equal(model.metrics.producer_review, null);
  assert.equal(model.metrics.production_active, null);
  assert.equal(model.visibility.producer_operations, false);
  assert.equal(
    model.pipeline.some((item) =>
      ['producer_review', 'production_active', 'lead_review'].includes(item.id)
    ),
    false
  );
  assert.equal(model.workload_meta.personal.as_host, 2);
});

test('inactive, deleted, and other-season rows never affect the current season model', () => {
  const model = buildStudioOperationsInsightModel({
    episodes: [
      episode(),
      episode({ episode_id: 'old', season: 'Season 10' }),
      episode({ episode_id: 'archived', archived: true }),
      episode({ episode_id: 'pending-delete', deletion_pending: true }),
      episode({ episode_id: 'deleted', deleted_at: '2026-08-19T00:00:00Z' }),
      episode({
        episode_id: 'finalized',
        deletion_finalized_at: '2026-08-19T00:00:00Z',
      }),
    ],
    season: { label: 'Season 11', schedule_slots: 38 },
    permissions: ['episodes:manage'],
  });

  assert.equal(model.metrics.schedule_coverage.total, 1);
  assert.equal(model.metrics.host_drafts, 1);
});

test('empty input returns a stable Season 11 dashboard contract', () => {
  const model = buildStudioOperationsInsightModel();

  assert.equal(model.schema_version, 1);
  assert.equal(model.scope, 'assigned');
  assert.deepEqual(model.metrics.schedule_coverage, {
    scheduled: 0,
    unscheduled: 0,
    total: 0,
    percent: 0,
  });
  assert.equal(model.season.label, 'Season 11');
  assert.equal(model.season.planned_slots, 38);
  assert.equal(model.season.open_slots, 38);
  assert.deepEqual(model.workload, []);
});
