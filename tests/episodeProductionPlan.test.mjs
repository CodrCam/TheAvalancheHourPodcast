import assert from 'node:assert/strict';
import test from 'node:test';
import {
  DEFAULT_EPISODE_PRODUCTION_TASKS,
  EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION,
  GUEST_RECORDING_PLAN_TASK_ID,
  MICROPHONE_PLAN_TASK_ID,
  addEpisodeProductionTaskDefinition,
  applyEpisodeProductionTaskUpdate,
  canEditEpisodeProductionTaskStructure,
  createDefaultEpisodeProductionTasks,
  editEpisodeProductionTaskDefinition,
  getEpisodeProductionPlanSummary,
  getProductionDueDate,
  isEpisodeProductionTaskComplete,
  isEpisodeProductionTaskOwner,
  moveEpisodeProductionTaskDefinition,
  normalizeEpisodeProductionTasks,
  normalizeProductionDate,
  recalculateEpisodeProductionTaskDates,
  validateEpisodeProductionTaskGraph,
} from '../lib/episodeProductionPlan.mjs';

const AIR_DATE = '2026-08-31';

function episode(overrides = {}) {
  return {
    episode_id: 'episode-one',
    target_release_date: AIR_DATE,
    host_person_ids: ['host-one', 'host-two'],
    producer_person_id: 'producer-one',
    assets: [],
    production_tasks: createDefaultEpisodeProductionTasks(AIR_DATE),
    ...overrides,
  };
}

function setTask(tasks, taskId, patch) {
  return tasks.map((task) =>
    task.task_id === taskId ? { ...task, ...patch } : task
  );
}

function waiveDependencies(tasks, taskId) {
  const task = tasks.find((candidate) => candidate.task_id === taskId);
  const dependencyIds = new Set(task.dependencies);
  return tasks.map((candidate) =>
    dependencyIds.has(candidate.task_id)
      ? {
          ...candidate,
          status: 'waived',
          completed_at: '2026-08-01T12:00:00.000Z',
          completed_by_person_id: 'manager-one',
          completed_by_name: 'Manager One',
        }
      : candidate
  );
}

test('creates the complete default workflow from the air date', () => {
  const tasks = createDefaultEpisodeProductionTasks(AIR_DATE);

  assert.doesNotMatch(
    JSON.stringify(tasks),
    /\b(?:Angie|Sierra|Caleb|Cameron|Cam)\b/
  );

  assert.deepEqual(
    tasks.map((task) => task.task_id),
    [
      'guest-prep-sent',
      'guest-prep-received',
      'microphone-plan-confirmed',
      'guest-recording-plan-reviewed',
      'edit-package-delivered',
      'intro-ready',
      'show-notes-brief',
      'producer-proof-upload',
      'proof-listen-approval',
      'publishing-package',
      'promotion-scheduled',
      'guest-assets-shared',
    ]
  );
  assert.deepEqual(
    tasks.map((task) => task.due_date),
    [
      '2026-08-03',
      '2026-08-10',
      '2026-08-10',
      '2026-08-10',
      '2026-08-10',
      '2026-08-17',
      '2026-08-21',
      '2026-08-21',
      '2026-08-23',
      '2026-08-24',
      '2026-08-24',
      '2026-08-24',
    ]
  );
  const microphonePlan = tasks.find(
    (task) => task.task_id === MICROPHONE_PLAN_TASK_ID
  );
  assert.equal(microphonePlan.owner_type, 'hosts');
  assert.equal(microphonePlan.days_before_air, 21);
  assert.deepEqual(microphonePlan.dependencies, ['guest-prep-sent']);
  assert.deepEqual(microphonePlan.linked_deliverable_ids, ['mic-kit-plan']);
  assert.equal(
    microphonePlan.deadline_schema_version,
    EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION
  );
  const guestRecordingPlan = tasks.find(
    (task) => task.task_id === GUEST_RECORDING_PLAN_TASK_ID
  );
  assert.equal(guestRecordingPlan.owner_type, 'producer');
  assert.equal(guestRecordingPlan.days_before_air, 21);
  assert.deepEqual(guestRecordingPlan.dependencies, ['guest-prep-received']);
  assert.deepEqual(
    tasks.find((task) => task.task_id === 'edit-package-delivered')
      .dependencies,
    ['guest-prep-received', GUEST_RECORDING_PLAN_TASK_ID]
  );
  assert.deepEqual(
    tasks.find((task) => task.task_id === 'producer-proof-upload')
      .assigned_person_ids,
    []
  );
  assert.equal(
    tasks.find((task) => task.task_id === 'producer-proof-upload')
      .owner_type,
    'producer'
  );
  assert.deepEqual(
    tasks.find((task) => task.task_id === 'publishing-package')
      .assigned_person_ids,
    []
  );
  assert.equal(
    tasks.find((task) => task.task_id === 'publishing-package').owner_type,
    'producer'
  );
  assert.deepEqual(
    tasks
      .find((task) => task.task_id === 'promotion-scheduled')
      .subtasks.map((subtask) => subtask.id),
    ['social-media', 'email', 'blog']
  );
});

test('uses calendar-day UTC arithmetic across months and leap years', () => {
  assert.equal(normalizeProductionDate('2026-02-30'), '');
  assert.equal(getProductionDueDate('2028-03-01', 1), '2028-02-29');
  assert.equal(getProductionDueDate('2026-03-01', 1), '2026-02-28');
  assert.equal(getProductionDueDate('2026-11-08', 7), '2026-11-01');
});

test('normalization merges new defaults, accepts legacy names, and retains custom tasks', () => {
  const tasks = normalizeEpisodeProductionTasks(
    [
      {
        id: 'guest-prep-sent',
        title: 'Send it',
        status: 'completed',
        due_date: '2026-07-31',
        due_date_overridden: true,
        note: 'Sent by email.',
      },
      {
        task_id: 'custom-legal-review',
        label: 'Legal review',
        days_before_air: 9,
        required: false,
        status: 'blocked',
      },
    ],
    AIR_DATE
  );

  assert.equal(tasks.length, DEFAULT_EPISODE_PRODUCTION_TASKS.length + 1);
  const sent = tasks.find((task) => task.task_id === 'guest-prep-sent');
  assert.equal(sent.status, 'complete');
  assert.equal(sent.due_date, '2026-07-31');
  assert.equal(sent.due_date_overridden, true);
  assert.equal(sent.evidence_note, 'Sent by email.');
  const custom = tasks.find(
    (task) => task.task_id === 'custom-legal-review'
  );
  assert.equal(custom.due_date, '2026-08-22');
  assert.equal(custom.required, false);
  assert.equal(custom.status, 'in_progress');
});

test('normalization adds the current workflow and audits accepted history as waived', () => {
  const activeTasks = normalizeEpisodeProductionTasks(undefined, AIR_DATE);
  assert.equal(activeTasks.length, DEFAULT_EPISODE_PRODUCTION_TASKS.length);
  assert.ok(
    activeTasks.some((task) => task.task_id === MICROPHONE_PLAN_TASK_ID)
  );
  assert.equal(
    activeTasks.every((task) => task.status === 'not_started'),
    true
  );

  const acceptedTasks = normalizeEpisodeProductionTasks([], AIR_DATE, {
    episodeStatus: 'accepted',
    migrationCompletedAt: '2026-08-30T12:00:00.000Z',
    migrationCompletedByPersonId: 'producer-one',
    migrationCompletedByName: 'Producer One',
  });
  assert.equal(
    acceptedTasks.every((task) => task.status === 'waived'),
    true
  );
  assert.equal(acceptedTasks[0].completed_at, '2026-08-30T12:00:00.000Z');
  assert.equal(acceptedTasks[0].completed_by_person_id, 'producer-one');

  const acceptedSummary = getEpisodeProductionPlanSummary(
    {
      status: 'accepted',
      target_release_date: AIR_DATE,
      updated_at: '2026-08-30T12:00:00.000Z',
    },
    { today: '2026-09-15' }
  );
  assert.equal(acceptedSummary.task_count, DEFAULT_EPISODE_PRODUCTION_TASKS.length);
  assert.equal(acceptedSummary.completion_percent, 100);
  assert.equal(acceptedSummary.off_track, false);
});

test('legacy named default owners migrate to roles without changing a deliberate reassignment', () => {
  const tasks = normalizeEpisodeProductionTasks(
    [
      {
        task_id: 'producer-proof-upload',
        owner_type: 'person',
        assigned_person_ids: ['angie-link'],
      },
      {
        task_id: 'publishing-package',
        owner_type: 'person',
        assigned_person_ids: ['publishing-owner-two'],
      },
      {
        task_id: 'show-notes-brief',
        days_before_air: 7,
        due_date: '2026-08-24',
        due_date_overridden: false,
      },
      {
        task_id: 'promotion-scheduled',
        days_before_air: 3,
        due_date: '2026-08-29',
        due_date_overridden: true,
      },
    ],
    AIR_DATE
  );
  const proof = tasks.find(
    (task) => task.task_id === 'producer-proof-upload'
  );
  const publishing = tasks.find(
    (task) => task.task_id === 'publishing-package'
  );
  const showNotes = tasks.find(
    (task) => task.task_id === 'show-notes-brief'
  );
  const promotion = tasks.find(
    (task) => task.task_id === 'promotion-scheduled'
  );

  assert.equal(proof.owner_type, 'producer');
  assert.deepEqual(proof.assigned_person_ids, []);
  assert.equal(publishing.owner_type, 'person');
  assert.deepEqual(publishing.assigned_person_ids, [
    'publishing-owner-two',
  ]);
  assert.equal(showNotes.days_before_air, 10);
  assert.equal(showNotes.due_date, '2026-08-21');
  assert.equal(promotion.days_before_air, 7);
  assert.equal(promotion.due_date, '2026-08-24');
  assert.equal(promotion.due_date_overridden, false);
  assert.equal(
    promotion.deadline_schema_version,
    EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION
  );
});

test('current seeded deadlines replace every legacy default once and then remain editable', () => {
  const legacyDeadlineByTaskId = new Map([
    ['show-notes-brief', 7],
    ['producer-proof-upload', 7],
    ['proof-listen-approval', 5],
    ['publishing-package', 4],
    ['promotion-scheduled', 3],
    ['guest-assets-shared', 3],
  ]);
  const currentDeadlineByTaskId = new Map([
    ['show-notes-brief', 10],
    ['producer-proof-upload', 10],
    ['proof-listen-approval', 8],
    ['publishing-package', 7],
    ['promotion-scheduled', 7],
    ['guest-assets-shared', 7],
  ]);
  const legacyTasks = [...legacyDeadlineByTaskId].map(
    ([taskId, daysBeforeAir], index) => ({
      task_id: taskId,
      days_before_air: daysBeforeAir,
      due_date: getProductionDueDate(AIR_DATE, daysBeforeAir),
      due_date_overridden: index % 2 === 0,
      ...(taskId === 'show-notes-brief'
        ? {
            status: 'complete',
            completed_at: '2026-08-20T09:00:00.000Z',
            completed_by_person_id: 'host-one',
            completed_by_name: 'Host One',
          }
        : {}),
    })
  );

  const migrated = normalizeEpisodeProductionTasks(legacyTasks, AIR_DATE);
  for (const [taskId, currentDaysBeforeAir] of currentDeadlineByTaskId) {
    const task = migrated.find((candidate) => candidate.task_id === taskId);
    assert.equal(task.days_before_air, currentDaysBeforeAir, taskId);
    assert.equal(
      task.due_date,
      getProductionDueDate(AIR_DATE, currentDaysBeforeAir),
      taskId
    );
    assert.equal(task.due_date_overridden, false, taskId);
    assert.equal(
      task.deadline_schema_version,
      EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION,
      taskId
    );
  }
  const completedShowNotes = migrated.find(
    (task) => task.task_id === 'show-notes-brief'
  );
  assert.equal(completedShowNotes.status, 'complete');
  assert.equal(completedShowNotes.completed_at, '2026-08-20T09:00:00.000Z');
  assert.equal(completedShowNotes.completed_by_person_id, 'host-one');

  let intentionallyEdited = episode({ production_tasks: migrated });
  for (const [taskId, legacyDaysBeforeAir] of legacyDeadlineByTaskId) {
    intentionallyEdited = editEpisodeProductionTaskDefinition(
      intentionallyEdited,
      taskId,
      {
        days_before_air: legacyDaysBeforeAir,
        due_date_overridden: false,
      },
      {
        personId: 'manager-one',
        personName: 'Manager One',
        canManage: true,
      },
      { now: '2026-08-20T12:00:00.000Z' }
    );
  }
  const normalizedAgain = normalizeEpisodeProductionTasks(
    intentionallyEdited.production_tasks,
    AIR_DATE
  );
  for (const [taskId, intentionalDaysBeforeAir] of legacyDeadlineByTaskId) {
    const task = normalizedAgain.find(
      (candidate) => candidate.task_id === taskId
    );
    assert.equal(task.days_before_air, intentionalDaysBeforeAir, taskId);
    assert.equal(
      task.due_date,
      getProductionDueDate(AIR_DATE, intentionalDaysBeforeAir),
      taskId
    );
  }
});

test('exact legacy built-in names migrate to roles while custom task copy remains intact', () => {
  const migrated = normalizeEpisodeProductionTasks(
    [
      {
        task_id: 'intro-ready',
        label: 'Record the intro or schedule it with Angie',
        description:
          'Either upload a finished intro or send the script and record a meeting date with Angie. The recording session must occur no later than seven days before air.',
      },
      {
        task_id: 'show-notes-brief',
        label: 'Send Sierra or Angie the show-notes request',
        description:
          'Give Sierra and Angie the episode summary, takeaways, guest links and handles, image guidance, credits, and anything that must not be published.',
      },
      {
        task_id: 'producer-proof-upload',
        label: 'Angie adds the mid-roll and outro',
      },
      {
        task_id: 'publishing-package',
        description:
          'Sierra or Angie completes the episode graphic and final show notes, then schedules the approved episode on Spotify.',
      },
      {
        task_id: 'promotion-scheduled',
        label: 'Sierra or Angie schedules promotion',
      },
    ],
    AIR_DATE
  );

  for (const taskId of [
    'intro-ready',
    'show-notes-brief',
    'producer-proof-upload',
    'publishing-package',
    'promotion-scheduled',
  ]) {
    const task = migrated.find((candidate) => candidate.task_id === taskId);
    assert.doesNotMatch(`${task.label} ${task.description}`, /Angie|Sierra/);
  }

  const customCopy = normalizeEpisodeProductionTasks(
    [
      {
        task_id: 'show-notes-brief',
        label: 'Confirm Angie interview references for this episode',
        description: 'This intentionally customized instruction stays as written.',
      },
    ],
    AIR_DATE
  ).find((task) => task.task_id === 'show-notes-brief');
  assert.equal(
    customCopy.label,
    'Confirm Angie interview references for this episode'
  );
  assert.equal(
    customCopy.description,
    'This intentionally customized instruction stays as written.'
  );
});

test('air-date recalculation moves unfinished dates but preserves completed and overridden dates', () => {
  let tasks = createDefaultEpisodeProductionTasks('2026-08-31');
  tasks = setTask(tasks, 'guest-prep-sent', {
    status: 'complete',
    due_date: '2026-08-03',
  });
  tasks = setTask(tasks, 'guest-prep-received', {
    due_date: '2026-08-08',
    due_date_overridden: true,
  });

  const recalculated = recalculateEpisodeProductionTaskDates(
    tasks,
    '2026-09-07'
  );

  assert.equal(
    recalculated.find((task) => task.task_id === 'guest-prep-sent').due_date,
    '2026-08-03'
  );
  assert.equal(
    recalculated.find((task) => task.task_id === 'guest-prep-received')
      .due_date,
    '2026-08-08'
  );
  assert.equal(
    recalculated.find((task) => task.task_id === 'edit-package-delivered')
      .due_date,
    '2026-08-17'
  );

  const normalizedAgain = normalizeEpisodeProductionTasks(
    recalculated,
    '2026-09-07'
  );
  const completedAgain = normalizedAgain.find(
    (task) => task.task_id === 'guest-prep-sent'
  );
  assert.equal(completedAgain.due_date, '2026-08-03');
  assert.equal(completedAgain.due_date_overridden, false);
});

test('summary exposes progress, next actionable task, overdue IDs, and dependency blocking', () => {
  const result = getEpisodeProductionPlanSummary(episode(), {
    today: '2026-08-04',
  });

  assert.equal(result.completion_percent, 0);
  assert.equal(result.next_due_task_id, 'guest-prep-sent');
  assert.deepEqual(result.overdue_task_ids, ['guest-prep-sent']);
  assert.equal(result.off_track, true);
  assert.equal(result.has_dependency_blocking, true);
  assert.equal(
    result.dependency_blocking.find(
      (entry) => entry.task_id === 'guest-prep-received'
    ).blocked_by_task_ids[0],
    'guest-prep-sent'
  );
});

test('a task is not overdue until the day after its deadline', () => {
  const onDeadline = getEpisodeProductionPlanSummary(episode(), {
    today: '2026-08-03',
  });
  const afterDeadline = getEpisodeProductionPlanSummary(episode(), {
    today: '2026-08-04',
  });

  assert.equal(onDeadline.off_track, false);
  assert.equal(afterDeadline.off_track, true);
});

test('recorded intro completion requires the linked intro asset', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(value.production_tasks, 'intro-ready');

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'intro-ready',
        { status: 'complete', intro_method: 'recorded' },
        { personId: 'host-one', personName: 'Host One' },
        { now: '2026-08-16T10:00:00Z' }
      ),
    /upload the recorded intro/i
  );

  value.assets.push({
    asset_id: 'intro-one',
    deliverable_id: 'intro-audio',
    status: 'uploaded',
  });
  const updated = applyEpisodeProductionTaskUpdate(
    value,
    'intro-ready',
    {
      status: 'complete',
      intro_method: 'recorded',
      evidence_asset_id: 'intro-one',
    },
    { person_id: 'host-one', person_name: 'Host One' },
    { now: '2026-08-16T10:00:00Z' }
  );
  const intro = updated.production_tasks.find(
    (task) => task.task_id === 'intro-ready'
  );

  assert.equal(intro.status, 'complete');
  assert.equal(intro.completed_at, '2026-08-16T10:00:00.000Z');
  assert.equal(intro.completed_by_person_id, 'host-one');
  assert.equal(isEpisodeProductionTaskComplete(intro, updated), true);
});

test('microphone plan completion requires a resolved choice for every assigned host', () => {
  let value = episode({
    deliverables: [
      {
        id: 'mic-kit-plan',
        mic_kit_plans: [
          {
            host_person_id: 'host-one',
            choice: 'request_kit',
            request_id: 'mic-request-one',
          },
        ],
      },
    ],
  });
  value.production_tasks = waiveDependencies(
    value.production_tasks,
    MICROPHONE_PLAN_TASK_ID
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        MICROPHONE_PLAN_TASK_ID,
        { status: 'complete' },
        { personId: 'host-one', personName: 'Host One' },
        { now: '2026-08-09T10:00:00Z' }
      ),
    /every assigned host must complete the microphone plan/i
  );

  value.deliverables[0].mic_kit_plans.push({
    host_person_id: 'host-two',
    choice: 'use_own_equipment',
    equipment_note: 'Tested USB microphone and wired headphones.',
  });
  value = applyEpisodeProductionTaskUpdate(
    value,
    MICROPHONE_PLAN_TASK_ID,
    { status: 'complete' },
    { personId: 'host-one', personName: 'Host One' },
    { now: '2026-08-09T10:00:00Z' }
  );
  const microphoneTask = value.production_tasks.find(
    (task) => task.task_id === MICROPHONE_PLAN_TASK_ID
  );
  assert.equal(microphoneTask.status, 'complete');
  assert.equal(isEpisodeProductionTaskComplete(microphoneTask, value), true);
});

test('producer scheduling path allows ten days before air but rejects a later meeting', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(value.production_tasks, 'intro-ready');

  const migratedLegacyIntro = normalizeEpisodeProductionTasks(
    [
      {
        task_id: 'intro-ready',
        intro_method: 'scheduled_with_angie',
        intro_scheduled_for: '2026-08-21',
      },
    ],
    AIR_DATE
  ).find((task) => task.task_id === 'intro-ready');
  assert.equal(migratedLegacyIntro.intro_method, 'scheduled_with_producer');

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'intro-ready',
        {
          status: 'complete',
          intro_method: 'scheduled_with_angie',
          intro_scheduled_for: '2026-08-21',
        },
        { personId: 'host-one' },
        { now: '2026-08-16T10:00:00Z' }
      ),
    /choose a recorded intro or a scheduled recording with the producer/i
  );

  const valid = applyEpisodeProductionTaskUpdate(
    value,
    'intro-ready',
    {
      status: 'complete',
      intro_method: 'scheduled_with_producer',
      intro_scheduled_for: '2026-08-21',
    },
    { personId: 'host-one', personName: 'Host One' },
    { now: '2026-08-16T10:00:00Z' }
  );
  assert.equal(
    valid.production_tasks.find((task) => task.task_id === 'intro-ready')
      .status,
    'complete'
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'intro-ready',
        {
          status: 'complete',
          intro_method: 'scheduled_with_producer',
          intro_scheduled_for: '2026-08-22',
        },
        { personId: 'host-one' },
        { now: '2026-08-16T10:00:00Z' }
      ),
    /no later than ten days/i
  );
});

test('manager task edits preserve a custom deadline and named owner', () => {
  const updated = applyEpisodeProductionTaskUpdate(
    episode(),
    'guest-prep-sent',
    {
      due_date: '2026-08-05',
      assigned_person_ids: ['producer-two'],
      evidence_note: 'Producer is coordinating directly with the guest.',
    },
    { personId: 'manager-one', personName: 'Manager One', canManage: true },
    { now: '2026-08-02T10:00:00Z' }
  );
  const task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'guest-prep-sent'
  );

  assert.equal(task.due_date, '2026-08-05');
  assert.equal(task.due_date_overridden, true);
  assert.deepEqual(task.assigned_person_ids, ['producer-two']);
  assert.equal(
    task.evidence_note,
    'Producer is coordinating directly with the guest.'
  );
});

test('manager can restore a task deadline to its air-date countdown rule', () => {
  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        episode(),
        'guest-prep-sent',
        { due_date_overridden: true },
        { personId: 'manager-one', canManage: true }
      ),
    /add the custom task deadline/i
  );

  let value = applyEpisodeProductionTaskUpdate(
    episode(),
    'guest-prep-sent',
    { due_date: '2026-08-05' },
    { personId: 'manager-one', canManage: true }
  );
  value = applyEpisodeProductionTaskUpdate(
    value,
    'guest-prep-sent',
    { due_date_overridden: false },
    { personId: 'manager-one', canManage: true }
  );
  const task = value.production_tasks.find(
    (candidate) => candidate.task_id === 'guest-prep-sent'
  );

  assert.equal(task.due_date, '2026-08-03');
  assert.equal(task.due_date_overridden, false);
});

test('an upstream step cannot reopen while completed dependents rely on it', () => {
  let value = episode();
  value.production_tasks = setTask(
    setTask(value.production_tasks, 'guest-prep-sent', {
      status: 'complete',
      completed_at: '2026-08-03T10:00:00.000Z',
    }),
    'guest-prep-received',
    {
      status: 'complete',
      completed_at: '2026-08-10T10:00:00.000Z',
    }
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'guest-prep-sent',
        { status: 'in_progress' },
        { personId: 'host-one' }
      ),
    /reopen completed dependent steps \(Receive the completed guest prep form\) before reopening Send the guest prep form/i
  );

  value = applyEpisodeProductionTaskUpdate(
    value,
    'guest-prep-received',
    { status: 'in_progress' },
    { personId: 'host-one' }
  );
  value = applyEpisodeProductionTaskUpdate(
    value,
    'guest-prep-sent',
    { status: 'in_progress' },
    { personId: 'host-one' }
  );

  assert.equal(
    value.production_tasks.find(
      (candidate) => candidate.task_id === 'guest-prep-sent'
    ).status,
    'in_progress'
  );
});

test('proof upload and proof-listen approval require the private proof asset', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(
    value.production_tasks,
    'producer-proof-upload'
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'producer-proof-upload',
        { status: 'complete' },
        { personId: 'producer-one', personName: 'Producer One' },
        { now: '2026-08-23T10:00:00Z' }
      ),
    /private proof audio/i
  );

  value.assets.push({
    asset_id: 'private-proof-one',
    deliverable_id: 'producer-proof-audio',
    status: 'uploaded',
  });
  value = applyEpisodeProductionTaskUpdate(
    value,
    'producer-proof-upload',
    { status: 'complete', evidence_asset_id: 'private-proof-one' },
    { personId: 'producer-one', personName: 'Producer One' },
    { now: '2026-08-23T10:00:00Z' }
  );

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'proof-listen-approval',
        { status: 'complete', proof_decision: 'pending' },
        { personId: 'host-one', personName: 'Host One' },
        { now: '2026-08-25T10:00:00Z' }
      ),
    /uploaded and approved/i
  );

  value = applyEpisodeProductionTaskUpdate(
    value,
    'proof-listen-approval',
    { status: 'complete', proof_decision: 'approved' },
    { personId: 'host-one', personName: 'Host One' },
    { now: '2026-08-25T10:00:00Z' }
  );
  const approval = value.production_tasks.find(
    (task) => task.task_id === 'proof-listen-approval'
  );
  assert.equal(approval.proof_decision, 'approved');
  assert.equal(approval.evidence_asset_id, 'private-proof-one');
  assert.equal(isEpisodeProductionTaskComplete(approval, value), true);
});

test('proof approval follows the exact current proof and replacement refreshes upload audit', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(
    value.production_tasks,
    'producer-proof-upload'
  );
  value.assets.push({
    asset_id: 'private-proof-one',
    deliverable_id: 'producer-proof-audio',
    status: 'uploaded',
  });
  value = applyEpisodeProductionTaskUpdate(
    value,
    'producer-proof-upload',
    { status: 'complete', evidence_asset_id: 'private-proof-one' },
    { personId: 'producer-one', personName: 'Producer One' },
    { now: '2026-08-23T10:00:00Z' }
  );
  value = applyEpisodeProductionTaskUpdate(
    value,
    'proof-listen-approval',
    { status: 'complete', proof_decision: 'approved' },
    { personId: 'host-one', personName: 'Host One' },
    { now: '2026-08-25T10:00:00Z' }
  );
  const originalApproval = value.production_tasks.find(
    (task) => task.task_id === 'proof-listen-approval'
  );
  assert.equal(originalApproval.evidence_asset_id, 'private-proof-one');

  value.assets.push({
    asset_id: 'private-proof-two',
    deliverable_id: 'producer-proof-audio',
    status: 'uploaded',
  });
  value = applyEpisodeProductionTaskUpdate(
    value,
    'producer-proof-upload',
    { status: 'complete', evidence_asset_id: 'private-proof-two' },
    { personId: 'producer-one', personName: 'Producer One' },
    { now: '2026-08-26T11:00:00Z' }
  );
  const replacementUpload = value.production_tasks.find(
    (task) => task.task_id === 'producer-proof-upload'
  );
  const staleApproval = value.production_tasks.find(
    (task) => task.task_id === 'proof-listen-approval'
  );

  assert.equal(replacementUpload.evidence_asset_id, 'private-proof-two');
  assert.equal(replacementUpload.completed_at, '2026-08-26T11:00:00.000Z');
  assert.equal(replacementUpload.completed_by_person_id, 'producer-one');
  assert.equal(isEpisodeProductionTaskComplete(staleApproval, value), false);
});

test('expired proof evidence fails exact completion using deterministic time', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(
    value.production_tasks,
    'producer-proof-upload'
  );
  value.assets.push({
    asset_id: 'expiring-proof',
    deliverable_id: 'producer-proof-audio',
    status: 'uploaded',
    retention_expires_at: '2026-08-26T00:00:00.000Z',
  });
  value = applyEpisodeProductionTaskUpdate(
    value,
    'producer-proof-upload',
    { status: 'complete', evidence_asset_id: 'expiring-proof' },
    { personId: 'producer-one', personName: 'Producer One' },
    { now: '2026-08-23T10:00:00Z' }
  );
  value = applyEpisodeProductionTaskUpdate(
    value,
    'proof-listen-approval',
    { status: 'complete', proof_decision: 'approved' },
    { personId: 'host-one', personName: 'Host One' },
    { now: '2026-08-25T10:00:00Z' }
  );
  const upload = value.production_tasks.find(
    (task) => task.task_id === 'producer-proof-upload'
  );
  const approval = value.production_tasks.find(
    (task) => task.task_id === 'proof-listen-approval'
  );

  assert.equal(
    isEpisodeProductionTaskComplete(upload, value, {
      now: '2026-08-25T23:59:59Z',
    }),
    true
  );
  assert.equal(
    isEpisodeProductionTaskComplete(approval, value, {
      now: '2026-08-26T00:00:00Z',
    }),
    false
  );
  const beforeExpiration = getEpisodeProductionPlanSummary(value, {
    now: '2026-08-25T23:59:59Z',
  });
  assert.equal(
    beforeExpiration.task_states.find(
      (state) => state.task_id === 'producer-proof-upload'
    ).complete,
    true
  );
  assert.equal(
    beforeExpiration.task_states.find(
      (state) => state.task_id === 'proof-listen-approval'
    ).complete,
    true
  );
  const summary = getEpisodeProductionPlanSummary(value, {
    now: '2026-08-26T00:00:00Z',
  });
  assert.equal(
    summary.task_states.find(
      (state) => state.task_id === 'producer-proof-upload'
    ).complete,
    false
  );
  assert.equal(
    summary.task_states.find(
      (state) => state.task_id === 'proof-listen-approval'
    ).complete,
    false
  );
});

test('bundle subchecks complete and reopen the parent with audit fields', () => {
  let value = episode();
  value.production_tasks = waiveDependencies(
    value.production_tasks,
    'promotion-scheduled'
  );
  const actor = { personId: 'producer-one', personName: 'Producer One' };

  for (const subtaskId of ['social-media', 'email', 'blog']) {
    value = applyEpisodeProductionTaskUpdate(
      value,
      'promotion-scheduled',
      { subtask_id: subtaskId, subtask_completed: true },
      actor,
      { now: '2026-08-27T09:00:00Z' }
    );
  }
  let promotion = value.production_tasks.find(
    (task) => task.task_id === 'promotion-scheduled'
  );
  assert.equal(promotion.status, 'complete');
  assert.equal(promotion.completed_by_person_id, 'producer-one');
  assert.equal(
    promotion.subtasks.every((subtask) => subtask.completed),
    true
  );

  value = applyEpisodeProductionTaskUpdate(
    value,
    'promotion-scheduled',
    { subtask_id: 'blog', subtask_completed: false },
    actor,
    { now: '2026-08-27T10:00:00Z' }
  );
  promotion = value.production_tasks.find(
    (task) => task.task_id === 'promotion-scheduled'
  );
  assert.equal(promotion.status, 'in_progress');
  assert.equal(promotion.completed_at, '');
});

test('manager deadline override can be set and reset to the calculated date', () => {
  const value = episode();
  let updated = applyEpisodeProductionTaskUpdate(
    value,
    'show-notes-brief',
    { due_date: '2026-08-22' },
    { personId: 'manager-one', roles: ['studio_manager'] }
  );
  let task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'show-notes-brief'
  );
  assert.equal(task.due_date, '2026-08-22');
  assert.equal(task.due_date_overridden, true);

  updated = applyEpisodeProductionTaskUpdate(
    updated,
    'show-notes-brief',
    { due_date_overridden: false },
    { personId: 'manager-one', roles: ['studio_manager'] }
  );
  task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'show-notes-brief'
  );
  assert.equal(task.due_date, '2026-08-21');
  assert.equal(task.due_date_overridden, false);
});

test('ownership resolves hosts, the assigned producer, and Studio managers', () => {
  const value = episode();
  const tasks = value.production_tasks;
  const hostTask = tasks.find((task) => task.task_id === 'intro-ready');
  const sharedTask = tasks.find(
    (task) => task.task_id === 'guest-prep-received'
  );
  const producerTask = tasks.find(
    (task) => task.task_id === 'producer-proof-upload'
  );

  assert.equal(
    isEpisodeProductionTaskOwner(hostTask, value, 'host-one', ['host']),
    true
  );
  assert.equal(
    isEpisodeProductionTaskOwner(sharedTask, value, 'producer-one', ['producer']),
    true
  );
  assert.equal(
    isEpisodeProductionTaskOwner(
      producerTask,
      value,
      'producer-one',
      ['producer']
    ),
    true
  );
  assert.equal(
    isEpisodeProductionTaskOwner(hostTask, value, 'manager-one', [
      'studio_manager',
    ]),
    true
  );
  assert.equal(
    isEpisodeProductionTaskOwner(producerTask, value, 'host-one', ['host']),
    false
  );
});

test('guest-share evidence rejects Spotify staging links but allows Drive', () => {
  const value = episode();

  assert.throws(
    () =>
      applyEpisodeProductionTaskUpdate(
        value,
        'guest-assets-shared',
        { evidence_url: 'https://open.spotify.com/episode/private-stage' },
        { personId: 'host-one' }
      ),
    /never share a private Spotify/i
  );

  const updated = applyEpisodeProductionTaskUpdate(
    value,
    'guest-assets-shared',
    { evidence_url: 'https://drive.google.com/file/d/approved-proof/view' },
    { personId: 'host-one' }
  );
  assert.equal(
    updated.production_tasks.find(
      (task) => task.task_id === 'guest-assets-shared'
    ).evidence_url,
    'https://drive.google.com/file/d/approved-proof/view'
  );
});

test('waiver is an audited completion override and clears off-track state', () => {
  let value = episode();
  value = applyEpisodeProductionTaskUpdate(
    value,
    'guest-prep-sent',
    { status: 'waived', evidence_note: 'Guest is a returning contributor.' },
    {
      personId: 'manager-one',
      personName: 'Manager One',
      roles: ['studio_manager'],
    },
    { now: '2026-08-04T12:00:00Z' }
  );
  const task = value.production_tasks.find(
    (candidate) => candidate.task_id === 'guest-prep-sent'
  );
  const summary = getEpisodeProductionPlanSummary(value, {
    today: '2026-08-04',
  });

  assert.equal(task.completed_by_person_id, 'manager-one');
  assert.equal(isEpisodeProductionTaskComplete(task, value), true);
  assert.deepEqual(summary.overdue_task_ids, []);
  assert.equal(summary.next_due_task_id, 'guest-prep-received');
});

test('only an assigned producer relationship or Studio manager can edit task structure', () => {
  assert.equal(
    canEditEpisodeProductionTaskStructure({ canReview: true }),
    true
  );
  assert.equal(
    canEditEpisodeProductionTaskStructure({ canManage: true }),
    true
  );
  assert.equal(
    canEditEpisodeProductionTaskStructure({ roles: ['producer'] }),
    false
  );
  assert.equal(
    canEditEpisodeProductionTaskStructure({ roles: ['host'] }),
    false
  );

  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode(),
        {
          label: 'Confirm transcript',
          instructions: 'Review the transcript and record any corrections.',
          phase: 'producer_review',
          owner_type: 'producer',
          days_before_air: 5,
          dependencies: [],
        },
        { personId: 'host-one' },
        { taskId: 'custom-task-host-denied' }
      ),
    /only the assigned producer or a Studio manager/i
  );
});

test('assigned producers can add an audited custom task with a calculated deadline', () => {
  const updated = addEpisodeProductionTaskDefinition(
    episode(),
    {
      label: 'Confirm transcript',
      instructions: 'Review the transcript and record any corrections.',
      phase: 'producer_review',
      owner_type: 'person',
      assigned_person_ids: ['producer-one'],
      days_before_air: 6,
      dependencies: ['edit-package-delivered'],
      required: true,
    },
    {
      personId: 'producer-one',
      personName: 'Producer One',
      canReview: true,
    },
    {
      taskId: 'custom-task-transcript-review',
      now: '2026-08-12T09:30:00Z',
    }
  );
  const task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'custom-task-transcript-review'
  );

  assert.equal(task.label, 'Confirm transcript');
  assert.equal(
    task.description,
    'Review the transcript and record any corrections.'
  );
  assert.equal(task.phase, 'producer_review');
  assert.equal(task.owner_type, 'person');
  assert.deepEqual(task.assigned_person_ids, ['producer-one']);
  assert.equal(task.due_date, '2026-08-25');
  assert.equal(task.due_date_overridden, false);
  assert.deepEqual(task.dependencies, ['edit-package-delivered']);
  assert.equal(task.kind, 'standard');
  assert.deepEqual(task.linked_deliverable_ids, []);
  assert.equal(task.status, 'not_started');
  assert.equal(task.is_custom, true);
  assert.equal(task.created_by_person_id, 'producer-one');
  assert.equal(task.updated_by_person_id, 'producer-one');
  assert.equal(task.created_at, '2026-08-12T09:30:00.000Z');
});

test('relationship-owned custom tasks clear individual assignees and support explicit dates', () => {
  const updated = addEpisodeProductionTaskDefinition(
    episode(),
    {
      title: 'Share transcript corrections',
      description: 'Send the approved correction list to the editing team.',
      phase: 'host_preparation',
      owner_type: 'hosts',
      assigned_person_ids: ['host-one'],
      due_date: '2026-08-20',
      dependencies: [],
    },
    { personId: 'producer-one', canReview: true },
    { taskId: 'custom-task-share-corrections' }
  );
  const task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'custom-task-share-corrections'
  );

  assert.deepEqual(task.assigned_person_ids, []);
  assert.equal(task.due_date, '2026-08-20');
  assert.equal(task.due_date_overridden, true);
});

test('relationship-owned tasks require the episode relationship they name', () => {
  const actor = { personId: 'manager-one', canManage: true };
  const definition = {
    label: 'Coordinate final review',
    instructions: 'Confirm the final review owner and record the outcome.',
    phase: 'producer_review',
    days_before_air: 5,
    dependencies: [],
  };

  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode({ producer_person_id: '' }),
        { ...definition, owner_type: 'producer' },
        actor,
        { taskId: 'custom-task-missing-producer' }
      ),
    /assign a producer/i
  );
  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode({ host_person_ids: [] }),
        { ...definition, owner_type: 'hosts' },
        actor,
        { taskId: 'custom-task-missing-host' }
      ),
    /assign at least one host/i
  );
  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        episode({ producer_person_id: '' }),
        'intro-ready',
        { owner_type: 'hosts_and_producer' },
        actor
      ),
    /assign a producer/i
  );
});

test('structural edits work for seeded tasks and preserve runtime and special fields', () => {
  const value = episode();
  value.production_tasks = setTask(
    value.production_tasks,
    'show-notes-brief',
    {
      status: 'in_progress',
      evidence_note: 'Draft copy is in review.',
      evidence_url: 'https://example.com/show-notes',
    }
  );
  const before = value.production_tasks.find(
    (task) => task.task_id === 'show-notes-brief'
  );
  const updated = editEpisodeProductionTaskDefinition(
    value,
    'show-notes-brief',
    {
      label: 'Finalize the publishing brief',
      instructions: 'Confirm show notes, credits, links, and image guidance.',
      phase: 'publishing',
      owner_type: 'hosts_and_producer',
      assigned_person_ids: ['producer-one'],
      days_before_air: 8,
      dependencies: ['guest-prep-received'],
      required: false,
    },
    {
      personId: 'producer-one',
      personName: 'Producer One',
      canReview: true,
    },
    { now: '2026-08-13T10:00:00Z' }
  );
  const task = updated.production_tasks.find(
    (candidate) => candidate.task_id === 'show-notes-brief'
  );

  assert.equal(task.task_id, before.task_id);
  assert.equal(task.kind, before.kind);
  assert.deepEqual(task.linked_deliverable_ids, before.linked_deliverable_ids);
  assert.equal(task.label, 'Finalize the publishing brief');
  assert.equal(task.phase, 'publishing');
  assert.equal(task.owner_type, 'hosts_and_producer');
  assert.deepEqual(task.assigned_person_ids, []);
  assert.equal(task.due_date, '2026-08-23');
  assert.deepEqual(task.dependencies, ['guest-prep-received']);
  assert.equal(task.required, false);
  assert.equal(task.status, 'in_progress');
  assert.equal(task.evidence_note, 'Draft copy is in review.');
  assert.equal(task.evidence_url, 'https://example.com/show-notes');
  assert.equal(task.updated_by_person_id, 'producer-one');
  assert.equal(task.updated_at, '2026-08-13T10:00:00.000Z');
});

test('task IDs, kinds, and linked package requirements remain immutable', () => {
  const actor = { personId: 'producer-one', canReview: true };
  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { task_id: 'renamed-intro', label: 'Renamed intro' },
        actor
      ),
    /task IDs cannot be changed/i
  );
  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { kind: 'standard', label: 'Renamed intro' },
        actor
      ),
    /task kinds cannot be changed/i
  );
  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        {
          linked_deliverable_ids: ['recording-files'],
          label: 'Renamed intro',
        },
        actor
      ),
    /linked package requirements cannot be changed/i
  );
});

test('custom task definitions reject invalid visible fields and overflow', () => {
  const actor = { personId: 'manager-one', canManage: true };
  const valid = {
    label: 'Custom review',
    instructions: 'Review and document the custom production requirement.',
    phase: 'producer_review',
    owner_type: 'producer',
    days_before_air: 5,
    dependencies: [],
  };
  const add = (patch, taskId = 'custom-task-validation') =>
    addEpisodeProductionTaskDefinition(
      episode(),
      { ...valid, ...patch },
      actor,
      { taskId }
    );

  assert.throws(() => add({ label: ' ' }), /task title is required/i);
  assert.throws(
    () => add({ instructions: '' }),
    /task instructions is required/i
  );
  assert.throws(
    () => add({ phase: 'backlog' }),
    /visible production board phase/i
  );
  assert.throws(
    () => add({ owner_type: 'anyone' }),
    /valid task owner/i
  );
  assert.throws(
    () => add({ owner_type: 'person', assigned_person_ids: [] }),
    /accountable person/i
  );
  assert.throws(
    () => add({ days_before_air: 366 }),
    /whole number from 0 to 365/i
  );
  assert.throws(
    () => add({ due_date: '2026-02-31' }),
    /valid task deadline/i
  );
  assert.throws(
    () => add({ assigned_person_ids: Array.from({ length: 9 }, (_, i) => `person-${i}`) }),
    /at most 8 items/i
  );
  assert.throws(
    () => add({ dependencies: Array.from({ length: 21 }, (_, i) => `task-${i}`) }),
    /at most 20 items/i
  );
  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode(),
        {
          label: 'Missing deadline',
          instructions: 'This task intentionally omits its required deadline.',
          phase: 'publishing',
          owner_type: 'producer',
          dependencies: [],
        },
        actor,
        { taskId: 'custom-task-missing-deadline' }
      ),
    /days before air or a custom task deadline/i
  );
});

test('dependency validation rejects unknown, self, and cyclic relationships', () => {
  const actor = { personId: 'producer-one', canReview: true };
  const definition = {
    label: 'Dependency test',
    instructions: 'Exercise strict dependency graph validation.',
    phase: 'producer_review',
    owner_type: 'producer',
    days_before_air: 5,
  };

  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode(),
        { ...definition, dependencies: ['missing-task'] },
        actor,
        { taskId: 'custom-task-unknown-dependency' }
      ),
    /unknown dependency/i
  );
  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode(),
        {
          ...definition,
          dependencies: ['custom-task-self-dependency'],
        },
        actor,
        { taskId: 'custom-task-self-dependency' }
      ),
    /cannot depend on itself/i
  );
  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        episode(),
        'guest-prep-sent',
        { dependencies: ['guest-prep-received'] },
        actor
      ),
    /dependency cycle/i
  );

  const invalidGraph = createDefaultEpisodeProductionTasks(AIR_DATE).map(
    (task) =>
      task.task_id === 'guest-prep-sent'
        ? { ...task, dependencies: ['unknown-task'] }
        : task
  );
  assert.throws(
    () => validateEpisodeProductionTaskGraph(invalidGraph),
    /unknown dependency/i
  );
});

test('a completed task cannot gain an incomplete dependency', () => {
  const value = episode();
  value.production_tasks = setTask(
    value.production_tasks,
    'show-notes-brief',
    {
      status: 'complete',
      completed_at: '2026-08-20T10:00:00.000Z',
      completed_by_person_id: 'host-one',
      completed_by_name: 'Host One',
    }
  );

  assert.throws(
    () =>
      editEpisodeProductionTaskDefinition(
        value,
        'show-notes-brief',
        { dependencies: ['guest-prep-received'] },
        { personId: 'producer-one', canReview: true }
      ),
    /completed task cannot depend on incomplete steps/i
  );
});

test('manager tile moves preserve task state and deterministically renumber the board', () => {
  const value = episode();
  value.production_tasks = setTask(
    value.production_tasks,
    'show-notes-brief',
    {
      status: 'complete',
      evidence_url: 'https://example.com/show-notes',
      evidence_note: 'Draft brief is ready for review.',
      completed_at: '2026-08-20T09:55:00.000Z',
      completed_by_person_id: 'host-one',
      completed_by_name: 'Host One',
      updated_at: '2026-08-20T10:00:00.000Z',
      updated_by_person_id: 'host-one',
      updated_by_name: 'Host One',
    }
  );
  const before = value.production_tasks.find(
    (task) => task.task_id === 'show-notes-brief'
  );

  const updated = moveEpisodeProductionTaskDefinition(
    value,
    'show-notes-brief',
    { target_phase: 'host_preparation', target_index: 0 },
    { personId: 'manager-one', canManage: true }
  );
  const moved = updated.production_tasks.find(
    (task) => task.task_id === 'show-notes-brief'
  );

  assert.equal(updated.production_tasks[0].task_id, 'show-notes-brief');
  assert.deepEqual(
    updated.production_tasks.map((task) => task.sort_order),
    updated.production_tasks.map((_, index) => (index + 1) * 10)
  );
  for (const field of [
    'status',
    'evidence_url',
    'evidence_note',
    'dependencies',
    'completed_at',
    'completed_by_person_id',
    'completed_by_name',
    'updated_at',
    'updated_by_person_id',
    'updated_by_name',
  ]) {
    assert.deepEqual(moved[field], before[field]);
  }

  const normalizedAgain = normalizeEpisodeProductionTasks(
    updated.production_tasks,
    AIR_DATE
  );
  assert.equal(normalizedAgain[0].task_id, 'show-notes-brief');
});

test('assigned producers can move a tile across phases without changing dependencies', () => {
  const value = episode();
  const dependenciesBefore = value.production_tasks.find(
    (task) => task.task_id === 'intro-ready'
  ).dependencies;
  const updated = moveEpisodeProductionTaskDefinition(
    value,
    'intro-ready',
    { target_phase: 'publishing', target_index: 1 },
    { personId: 'producer-one', canReview: true }
  );
  const moved = updated.production_tasks.find(
    (task) => task.task_id === 'intro-ready'
  );

  assert.equal(moved.phase, 'publishing');
  assert.deepEqual(moved.dependencies, dependenciesBefore);
  assert.deepEqual(
    updated.production_tasks
      .filter((task) => task.phase === 'publishing')
      .map((task) => task.task_id),
    ['publishing-package', 'intro-ready', 'promotion-scheduled']
  );
});

test('tile moves reject unauthorized actors and invalid destinations', () => {
  assert.throws(
    () =>
      moveEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { target_phase: 'publishing', target_index: 0 },
        { personId: 'host-one' }
      ),
    /assigned producer or a Studio manager/i
  );
  assert.throws(
    () =>
      moveEpisodeProductionTaskDefinition(
        episode(),
        'missing-task',
        { target_phase: 'publishing', target_index: 0 },
        { canManage: true }
      ),
    /unknown task/i
  );
  assert.throws(
    () =>
      moveEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { target_phase: 'private_review', target_index: 0 },
        { canManage: true }
      ),
    /visible production board phase/i
  );
  assert.throws(
    () =>
      moveEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { target_phase: 'publishing', target_index: 3 },
        { canManage: true }
      ),
    /between 0 and 2/i
  );
  assert.throws(
    () =>
      moveEpisodeProductionTaskDefinition(
        episode(),
        'intro-ready',
        { target_phase: 'publishing', target_index: '1' },
        { canManage: true }
      ),
    /non-negative whole number/i
  );
});

test('custom IDs must be unique and task-count overflow is rejected', () => {
  const actor = { personId: 'manager-one', canManage: true };
  const definition = {
    label: 'Capacity task',
    instructions: 'Confirm capacity validation for custom workflow tasks.',
    phase: 'publishing',
    owner_type: 'producer',
    days_before_air: 2,
    dependencies: [],
  };
  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        episode(),
        definition,
        actor,
        { taskId: 'guest-prep-sent' }
      ),
    /unique custom task ID/i
  );

  const fullEpisode = episode();
  fullEpisode.production_tasks = [
    ...fullEpisode.production_tasks,
    ...Array.from({ length: 40 }, (_, index) => ({
      task_id: `custom-task-capacity-${index + 1}`,
      label: `Capacity ${index + 1}`,
      description: 'Existing custom task.',
      phase: 'publishing',
      owner_type: 'producer',
      assigned_person_ids: [],
      days_before_air: 1,
      due_date: '2026-08-30',
      dependencies: [],
      kind: 'standard',
      linked_deliverable_ids: [],
      status: 'not_started',
      sort_order: 200 + index * 10,
    })),
  ];
  assert.throws(
    () =>
      addEpisodeProductionTaskDefinition(
        fullEpisode,
        definition,
        actor,
        { taskId: 'custom-task-over-capacity' }
      ),
    /at most 50 tasks/i
  );
});
