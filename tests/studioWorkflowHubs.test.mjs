import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildProductionHubModel,
  buildQuestionnaireHubModel,
  filterQuestionnaireHubRows,
  getProductionHubEpisodeHref,
  getQuestionnaireHubEpisodeHref,
  getStudioWorkflowHubLoadRequest,
  getStudioWorkflowHubRequest,
  isStudioWorkflowHubAvailable,
} from '../lib/studioWorkflowHubs.mjs';

function episode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    season: 'Season 11',
    target_release_date: '2026-11-04',
    status: 'in_progress',
    host_names: ['Host One'],
    my_roles: ['host'],
    producer_email: 'private@example.com',
    recording_location: 'Private room',
    completion: {
      host_percent: 42,
      missing: [{ label: 'Private missing item' }],
      remaining_reason: 'Private host detail',
    },
    workflow: {
      required_task_count: 10,
      completed_required_task_count: 4,
      completion_percent: 40,
      overdue_count: 0,
      next_due_task: {
        task_id: 'edit-package-delivered',
        label: 'Upload raw tracks',
        due_date: '2026-10-14',
        evidence_note: 'Private note',
      },
      task_states: [
        { task_id: 'guest-prep-sent', complete: false },
        { task_id: 'guest-prep-received', complete: false },
      ],
    },
    ...overrides,
  };
}

test('manager and non-manager hubs request only their intended API scope', () => {
  assert.deepEqual(getStudioWorkflowHubRequest(['episodes:read']), {
    canManage: false,
    url: '/api/studio/episodes?scope=mine',
  });
  assert.deepEqual(
    getStudioWorkflowHubRequest(['episodes:read', 'episodes:manage']),
    {
      canManage: true,
      url: '/api/studio/episodes?scope=all&include_directory=false',
    }
  );
});

test('production hub availability follows the explicit session role capability', () => {
  assert.equal(isStudioWorkflowHubAvailable('questionnaires'), true);
  assert.equal(isStudioWorkflowHubAvailable('production'), false);
  assert.equal(
    isStudioWorkflowHubAvailable('production', { producer_tasks: false }),
    false
  );
  assert.equal(
    isStudioWorkflowHubAvailable('production', { producer_tasks: true }),
    true
  );
  assert.equal(
    getStudioWorkflowHubLoadRequest(
      'production',
      ['episodes:read'],
      { producer_tasks: false }
    ),
    null
  );
  assert.deepEqual(
    getStudioWorkflowHubLoadRequest(
      'production',
      ['episodes:read'],
      { producer_tasks: true }
    ),
    {
      canManage: false,
      url: '/api/studio/episodes?scope=mine',
    }
  );
});

test('questionnaire hub classifies visible episode workflow gates', () => {
  const model = buildQuestionnaireHubModel([
    episode(),
    episode({
      episode_id: 'awaiting',
      title: 'Awaiting Guest',
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true },
          { task_id: 'guest-prep-received', complete: false },
        ],
      },
    }),
    episode({
      episode_id: 'received',
      title: 'Guest Responded',
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true },
          { task_id: 'guest-prep-received', complete: true },
        ],
      },
    }),
  ]);

  assert.deepEqual(model.summary, {
    total: 3,
    not_shared: 1,
    awaiting_response: 1,
    received: 1,
  });
  assert.deepEqual(
    model.rows.map((row) => row.workflow.questionnaire_state),
    ['not_shared', 'awaiting_response', 'received']
  );
  assert.equal('producer_email' in model.rows[0], false);
  assert.equal('recording_location' in model.rows[0], false);
  assert.equal(
    'evidence_note' in (model.rows[0].workflow.next_due_task || {}),
    false
  );
  assert.deepEqual(model.rows[0].completion, { host_percent: 42 });
  assert.equal('missing' in model.rows[0].completion, false);
});

test('questionnaire operations filter locally by status, title, and host', () => {
  const model = buildQuestionnaireHubModel([
    episode({
      episode_id: 'not-shared',
      title: 'Early Season Forecast',
      host_names: ['Morgan Dinsdale'],
    }),
    episode({
      episode_id: 'awaiting',
      title: 'Terrain Choices',
      host_names: ['Sara Boilen'],
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true },
          { task_id: 'guest-prep-received', complete: false },
        ],
      },
    }),
    episode({
      episode_id: 'received',
      title: 'Storm Stories',
      host_names: ['Caleb Merrill'],
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true },
          { task_id: 'guest-prep-received', complete: true },
        ],
      },
    }),
  ]);
  const before = structuredClone(model.rows);

  assert.deepEqual(
    filterQuestionnaireHubRows(model.rows, {
      filter: 'awaiting_response',
    }).map((row) => row.episode_id),
    ['awaiting']
  );
  assert.deepEqual(
    filterQuestionnaireHubRows(model.rows, { query: 'MORGAN' }).map(
      (row) => row.episode_id
    ),
    ['not-shared']
  );
  assert.deepEqual(
    filterQuestionnaireHubRows(model.rows, { query: 'storm stories' }).map(
      (row) => row.episode_id
    ),
    ['received']
  );
  assert.deepEqual(model.rows, before);
});

test('questionnaire operations sort overdue work first or by air date', () => {
  const model = buildQuestionnaireHubModel([
    episode({
      episode_id: 'not-shared-sooner',
      target_release_date: '2026-10-01',
    }),
    episode({
      episode_id: 'awaiting-overdue',
      target_release_date: '2026-12-01',
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true, overdue: false },
          {
            task_id: 'guest-prep-received',
            complete: false,
            overdue: true,
          },
        ],
      },
    }),
    episode({
      episode_id: 'received-earliest',
      target_release_date: '2026-09-01',
      workflow: {
        ...episode().workflow,
        task_states: [
          { task_id: 'guest-prep-sent', complete: true, overdue: false },
          { task_id: 'guest-prep-received', complete: true, overdue: true },
        ],
      },
    }),
  ]);

  assert.deepEqual(
    filterQuestionnaireHubRows(model.rows, { sort: 'urgency' }).map(
      (row) => row.episode_id
    ),
    ['awaiting-overdue', 'not-shared-sooner', 'received-earliest']
  );
  assert.equal(
    model.rows.find((row) => row.episode_id === 'awaiting-overdue').workflow
      .questionnaire_overdue,
    true
  );
  assert.equal(
    model.rows.find((row) => row.episode_id === 'received-earliest').workflow
      .questionnaire_overdue,
    false
  );
  assert.deepEqual(
    filterQuestionnaireHubRows(model.rows, { sort: 'air_date' }).map(
      (row) => row.episode_id
    ),
    ['received-earliest', 'not-shared-sooner', 'awaiting-overdue']
  );
});

test('questionnaire operations build one encoded episode destination', () => {
  assert.equal(
    getQuestionnaireHubEpisodeHref({ episode_id: 'episode /?# one' }),
    '/studio/episodes/episode%20%2F%3F%23%20one/questionnaire'
  );
  assert.equal(getQuestionnaireHubEpisodeHref({}), '');
});

test('non-manager production hub separates host drafts, review work, and history', () => {
  const model = buildProductionHubModel([
    episode({ episode_id: 'host-only', my_roles: ['host'] }),
    episode({
      episode_id: 'producer-review',
      my_roles: ['producer'],
      status: 'submitted',
      workflow: {
        ...episode().workflow,
        overdue_count: 2,
      },
    }),
    episode({
      episode_id: 'workflow-review',
      my_roles: ['workflow_assignee'],
      status: 'submitted_with_gaps',
      workflow: {
        ...episode().workflow,
        required_task_count: 8,
        completed_required_task_count: 5,
        completion_percent: 63,
      },
    }),
    episode({
      episode_id: 'producer-draft',
      my_roles: ['producer'],
      status: 'in_progress',
      workflow: {
        ...episode().workflow,
        overdue_count: 7,
        required_task_count: 20,
        completed_required_task_count: 0,
      },
    }),
    episode({
      episode_id: 'changes-with-host',
      my_roles: ['producer'],
      status: 'needs_changes',
    }),
    episode({
      episode_id: 'lead-review',
      my_roles: ['production_lead'],
      status: 'accepted',
      production_stage: 'lead_review',
      workflow: {
        ...episode().workflow,
        required_task_count: 9,
        completed_required_task_count: 7,
        completion_percent: 78,
        overdue_count: 1,
      },
    }),
    episode({
      episode_id: 'accepted-review',
      my_roles: ['producer'],
      status: 'accepted',
      workflow: {
        ...episode().workflow,
        overdue_count: 4,
        required_task_count: 12,
        completed_required_task_count: 7,
      },
    }),
    episode({
      episode_id: 'lead-review-watch',
      my_roles: ['producer'],
      status: 'accepted',
      production_stage: 'lead_review',
      workflow: {
        ...episode().workflow,
        required_task_count: 30,
        completed_required_task_count: 0,
        overdue_count: 8,
      },
    }),
  ]);

  assert.deepEqual(
    model.rows.map((row) => row.episode_id),
    [
      'producer-review',
      'workflow-review',
      'lead-review',
      'changes-with-host',
      'producer-draft',
      'lead-review-watch',
      'accepted-review',
    ]
  );
  assert.deepEqual(
    model.sections.review_queue.map((row) => row.episode_id),
    ['producer-review', 'workflow-review']
  );
  assert.deepEqual(
    model.sections.lead_review_queue.map((row) => row.episode_id),
    ['lead-review']
  );
  assert.deepEqual(
    model.sections.host_drafts.map((row) => row.episode_id),
    ['changes-with-host', 'producer-draft']
  );
  assert.deepEqual(
    model.sections.lead_review_watchlist.map((row) => row.episode_id),
    ['lead-review-watch']
  );
  assert.deepEqual(
    model.sections.completed_history.map((row) => row.episode_id),
    ['accepted-review']
  );
  assert.deepEqual(model.summary, {
    total: 7,
    review_queue: 2,
    lead_review_queue: 1,
    open_required_tasks: 11,
    overdue_episodes: 2,
    host_drafts: 2,
    lead_review_watchlist: 1,
    completed_history: 1,
  });
  assert.equal(model.sections.host_drafts[0].completion.host_percent, 42);
});

test('manager production hub includes every API-visible episode', () => {
  const input = [
    episode({ episode_id: 'host-only', my_roles: ['host'] }),
    episode({ episode_id: 'producer', my_roles: ['producer'] }),
    episode({ episode_id: '', title: 'Invalid identifier' }),
  ];
  const before = structuredClone(input);
  const model = buildProductionHubModel(input, { canManage: true });

  assert.deepEqual(
    model.rows.map((row) => row.episode_id),
    ['host-only', 'producer']
  );
  assert.equal(model.summary.total, 2);
  assert.equal(model.summary.review_queue, 0);
  assert.equal(model.summary.lead_review_queue, 0);
  assert.equal(model.summary.open_required_tasks, 0);
  assert.equal(model.summary.overdue_episodes, 0);
  assert.equal(model.summary.host_drafts, 2);
  assert.equal(model.summary.lead_review_watchlist, 0);
  assert.deepEqual(input, before);
});

test('managers keep pending production-lead handoffs in their action queue', () => {
  const model = buildProductionHubModel(
    [
      episode({
        episode_id: 'manager-lead-review',
        my_roles: ['producer'],
        status: 'accepted',
        production_stage: 'lead_review',
        workflow: {
          ...episode().workflow,
          required_task_count: 10,
          completed_required_task_count: 8,
          overdue_count: 1,
        },
      }),
    ],
    { canManage: true }
  );

  assert.equal(model.sections.lead_review_queue.length, 1);
  assert.equal(model.sections.lead_review_watchlist.length, 0);
  assert.equal(model.summary.open_required_tasks, 2);
  assert.equal(model.summary.overdue_episodes, 1);
});

test('host drafts never route into the production board', () => {
  const drafts = ['planning', 'in_progress', 'needs_changes'].map((status) =>
    buildProductionHubModel(
      [episode({ episode_id: status, status, my_roles: ['producer'] })]
    ).rows[0]
  );
  const submitted = buildProductionHubModel([
    episode({
      episode_id: 'submitted',
      status: 'submitted',
      my_roles: ['producer'],
    }),
  ]).rows[0];
  const accepted = buildProductionHubModel([
    episode({
      episode_id: 'accepted',
      status: 'accepted',
      my_roles: ['producer'],
    }),
  ]).rows[0];
  const leadReview = buildProductionHubModel([
    episode({
      episode_id: 'lead-review',
      status: 'accepted',
      production_stage: 'lead_review',
      my_roles: ['production_lead'],
    }),
  ]).rows[0];
  const leadReviewWatch = buildProductionHubModel([
    episode({
      episode_id: 'lead-review-watch',
      status: 'accepted',
      production_stage: 'lead_review',
      my_roles: ['producer'],
    }),
  ]).rows[0];

  assert.deepEqual(
    drafts.map((row) => [row.producer_lane, getProductionHubEpisodeHref(row)]),
    [
      ['host_draft', '/studio/episodes/planning'],
      ['host_draft', '/studio/episodes/in_progress'],
      ['host_draft', '/studio/episodes/needs_changes'],
    ]
  );
  assert.equal(
    getProductionHubEpisodeHref(submitted),
    '/studio/episodes/submitted/production'
  );
  assert.equal(
    getProductionHubEpisodeHref(accepted),
    '/studio/episodes/accepted/production'
  );
  assert.equal(leadReview.producer_lane, 'lead_review_queue');
  assert.equal(
    getProductionHubEpisodeHref(leadReview),
    '/studio/episodes/lead-review/production'
  );
  assert.equal(leadReviewWatch.producer_lane, 'lead_review_watchlist');
  assert.equal(
    getProductionHubEpisodeHref(leadReviewWatch),
    '/studio/episodes/lead-review-watch/production'
  );
});

test('workflow hubs omit deletion-scheduled Episode Studios', () => {
  const deleted = {
    episode_id: 'deleted-episode',
    title: 'Deletion scheduled',
    status: 'submitted',
    deletion_pending: true,
    deleted_at: '2026-08-19T12:00:00.000Z',
    my_roles: ['producer'],
    workflow: {
      required_task_count: 10,
      completed_required_task_count: 0,
      overdue_count: 10,
    },
  };

  assert.equal(buildQuestionnaireHubModel([deleted]).rows.length, 0);
  assert.equal(buildProductionHubModel([deleted]).rows.length, 0);
  assert.equal(
    buildProductionHubModel([
      {
        ...deleted,
        deletion_pending: false,
        deleted_at: '',
        archived: true,
      },
    ]).rows.length,
    0
  );
});
