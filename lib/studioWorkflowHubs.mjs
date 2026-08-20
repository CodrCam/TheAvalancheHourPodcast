const QUESTIONNAIRE_SENT_TASK_ID = 'guest-prep-sent';
const QUESTIONNAIRE_RECEIVED_TASK_ID = 'guest-prep-received';
const PRODUCTION_RELATIONSHIPS = new Set([
  'producer',
  'production_lead',
  'workflow_assignee',
]);
const PRODUCER_REVIEW_STATUSES = new Set([
  'submitted',
  'submitted_with_gaps',
]);

function clean(value, limit = 240) {
  return String(value || '').trim().slice(0, limit);
}

function cleanList(values, limit = 24) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => clean(value, 180))
        .filter(Boolean)
    ),
  ].slice(0, limit);
}

function boundedCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number <= 0) return 0;
  return Math.min(Math.trunc(number), 10000);
}

function boundedPercent(value) {
  const number = Number(value);
  if (!Number.isFinite(number)) return 0;
  return Math.min(100, Math.max(0, Math.round(number)));
}

function optionalPercent(value) {
  if (value === undefined || value === null || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? boundedPercent(number) : null;
}

function dateKey(value) {
  const normalized = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : '';
}

function taskIsComplete(workflow, taskId) {
  return (Array.isArray(workflow?.task_states)
    ? workflow.task_states
    : []
  ).some(
    (task) => clean(task?.task_id, 120) === taskId && task?.complete === true
  );
}

function taskIsOverdue(workflow, taskId) {
  return (Array.isArray(workflow?.task_states)
    ? workflow.task_states
    : []
  ).some(
    (task) => clean(task?.task_id, 120) === taskId && task?.overdue === true
  );
}

function questionnaireState(workflow) {
  if (taskIsComplete(workflow, QUESTIONNAIRE_RECEIVED_TASK_ID)) {
    return 'received';
  }
  if (taskIsComplete(workflow, QUESTIONNAIRE_SENT_TASK_ID)) {
    return 'awaiting_response';
  }
  return 'not_shared';
}

function questionnaireIsOverdue(workflow, state) {
  if (state === 'not_shared') {
    return taskIsOverdue(workflow, QUESTIONNAIRE_SENT_TASK_ID);
  }
  if (state === 'awaiting_response') {
    return taskIsOverdue(workflow, QUESTIONNAIRE_RECEIVED_TASK_ID);
  }
  return false;
}

function producerLane(status, productionStage) {
  if (PRODUCER_REVIEW_STATUSES.has(status)) return 'review_queue';
  if (status === 'accepted' && productionStage === 'lead_review') {
    return 'lead_review_queue';
  }
  if (status === 'accepted') return 'completed_history';
  return 'host_draft';
}

function projectEpisode(episode = {}) {
  const workflow =
    episode.workflow && typeof episode.workflow === 'object'
      ? episode.workflow
      : {};
  const requiredTasks = boundedCount(workflow.required_task_count);
  const completedRequiredTasks = Math.min(
    requiredTasks,
    boundedCount(workflow.completed_required_task_count)
  );
  const nextTask =
    workflow.next_due_task && typeof workflow.next_due_task === 'object'
      ? {
          label: clean(workflow.next_due_task.label, 180),
          due_date: dateKey(workflow.next_due_task.due_date),
        }
      : null;

  const status = clean(episode.status, 80) || 'planning';
  const productionStage = clean(episode.production_stage, 80);
  const hostPercent = optionalPercent(episode.completion?.host_percent);
  const guestQuestionnaireState = questionnaireState(workflow);

  return {
    episode_id: clean(episode.episode_id, 180),
    title: clean(episode.title, 240) || 'Untitled episode',
    season: clean(episode.season, 80),
    target_release_date: dateKey(episode.target_release_date),
    status,
    host_names: cleanList(episode.host_names, 16),
    my_roles: cleanList(episode.my_roles, 12),
    delivery_health:
      clean(
        episode.effective_delivery_health || episode.delivery_health,
        40
      ) || 'on_track',
    production_stage: productionStage,
    producer_lane: producerLane(status, productionStage),
    completion:
      hostPercent === null ? null : { host_percent: hostPercent },
    workflow: {
      required_task_count: requiredTasks,
      completed_required_task_count: completedRequiredTasks,
      completion_percent: boundedPercent(workflow.completion_percent),
      overdue_count: boundedCount(workflow.overdue_count),
      next_due_task: nextTask?.label ? nextTask : null,
      questionnaire_state: guestQuestionnaireState,
      questionnaire_overdue: questionnaireIsOverdue(
        workflow,
        guestQuestionnaireState
      ),
    },
  };
}

function compareDates(left, right) {
  const leftDate = left.target_release_date || '9999-12-31';
  const rightDate = right.target_release_date || '9999-12-31';
  return (
    leftDate.localeCompare(rightDate) ||
    left.title.localeCompare(right.title) ||
    left.episode_id.localeCompare(right.episode_id)
  );
}

function hasPermission(permissions, permission) {
  return (Array.isArray(permissions) ? permissions : []).includes(permission);
}

export function isStudioWorkflowHubAvailable(kind, capabilities = {}) {
  return kind !== 'production' || capabilities?.producer_tasks === true;
}

export function getStudioWorkflowHubRequest(permissions = []) {
  const canManage = hasPermission(permissions, 'episodes:manage');
  return {
    canManage,
    url: canManage
      ? '/api/studio/episodes?scope=all&include_directory=false'
      : '/api/studio/episodes?scope=mine',
  };
}

export function getStudioWorkflowHubLoadRequest(
  kind,
  permissions = [],
  capabilities = {}
) {
  return isStudioWorkflowHubAvailable(kind, capabilities)
    ? getStudioWorkflowHubRequest(permissions)
    : null;
}

const QUESTIONNAIRE_STATUS_PRIORITY = Object.freeze({
  not_shared: 0,
  awaiting_response: 1,
  received: 2,
});

function compareQuestionnaireUrgency(left, right) {
  const overdueDifference =
    Number(right.workflow?.questionnaire_overdue === true) -
    Number(left.workflow?.questionnaire_overdue === true);
  if (overdueDifference) return overdueDifference;

  const statusDifference =
    (QUESTIONNAIRE_STATUS_PRIORITY[left.workflow?.questionnaire_state] ?? 3) -
    (QUESTIONNAIRE_STATUS_PRIORITY[right.workflow?.questionnaire_state] ?? 3);
  return statusDifference || compareDates(left, right);
}

export function filterQuestionnaireHubRows(
  rows = [],
  { filter = 'all', query = '', sort = 'urgency' } = {}
) {
  const allowedFilter = Object.prototype.hasOwnProperty.call(
    QUESTIONNAIRE_STATUS_PRIORITY,
    filter
  )
    ? filter
    : 'all';
  const normalizedQuery = clean(query, 240).toLowerCase();
  const filteredRows = (Array.isArray(rows) ? rows : []).filter((episode) => {
    if (
      allowedFilter !== 'all' &&
      episode.workflow?.questionnaire_state !== allowedFilter
    ) {
      return false;
    }
    if (!normalizedQuery) return true;
    const hostNames = Array.isArray(episode.host_names)
      ? episode.host_names
      : [];
    const searchableText = [episode.title, ...hostNames]
      .map((value) => clean(value, 240).toLowerCase())
      .join(' ');
    return searchableText.includes(normalizedQuery);
  });

  return [...filteredRows].sort(
    sort === 'air_date' ? compareDates : compareQuestionnaireUrgency
  );
}

export function getQuestionnaireHubEpisodeHref(episode = {}) {
  const episodeId = clean(episode.episode_id, 180);
  return episodeId
    ? `/studio/episodes/${encodeURIComponent(episodeId)}/questionnaire`
    : '';
}

export function buildQuestionnaireHubModel(episodes = []) {
  const projectedRows = (Array.isArray(episodes) ? episodes : [])
    .filter(
      (episode) =>
        !episode?.archived &&
        !episode?.deleted_at &&
        !episode?.deletion_pending &&
        !episode?.deletion_finalized_at
    )
    .map(projectEpisode)
    .filter((episode) => episode.episode_id);
  const rows = filterQuestionnaireHubRows(projectedRows);

  return {
    rows,
    summary: {
      total: rows.length,
      not_shared: rows.filter(
        (episode) => episode.workflow.questionnaire_state === 'not_shared'
      ).length,
      awaiting_response: rows.filter(
        (episode) =>
          episode.workflow.questionnaire_state === 'awaiting_response'
      ).length,
      received: rows.filter(
        (episode) => episode.workflow.questionnaire_state === 'received'
      ).length,
    },
  };
}

function hasProductionRelationship(episode) {
  return episode.my_roles.some((role) => PRODUCTION_RELATIONSHIPS.has(role));
}

function scopeLeadReviewLane(episode, canManage) {
  if (episode.producer_lane !== 'lead_review_queue') return episode;
  if (canManage || episode.my_roles.includes('production_lead')) {
    return episode;
  }
  return { ...episode, producer_lane: 'lead_review_watchlist' };
}

export function getProductionHubEpisodeHref(episode = {}) {
  const episodeId = clean(episode.episode_id, 180);
  if (!episodeId) return '';
  const base = `/studio/episodes/${encodeURIComponent(episodeId)}`;
  return episode.producer_lane === 'host_draft'
    ? base
    : `${base}/production`;
}

function compareReviewQueue(left, right) {
  const overdueDifference =
    Number(right.workflow.overdue_count > 0) -
    Number(left.workflow.overdue_count > 0);
  if (overdueDifference) return overdueDifference;

  const leftDue = left.workflow.next_due_task?.due_date || '9999-12-31';
  const rightDue = right.workflow.next_due_task?.due_date || '9999-12-31';
  return leftDue.localeCompare(rightDue) || compareDates(left, right);
}

function compareHostDrafts(left, right) {
  const priority = { needs_changes: 0, in_progress: 1, planning: 2 };
  return (
    (priority[left.status] ?? 3) - (priority[right.status] ?? 3) ||
    compareDates(left, right)
  );
}

function compareHistory(left, right) {
  const leftDate = left.target_release_date || '0000-00-00';
  const rightDate = right.target_release_date || '0000-00-00';
  return rightDate.localeCompare(leftDate) || compareDates(left, right);
}

export function buildProductionHubModel(
  episodes = [],
  { canManage = false } = {}
) {
  const visibleRows = (Array.isArray(episodes) ? episodes : [])
    .filter(
      (episode) =>
        !episode?.archived &&
        !episode?.deleted_at &&
        !episode?.deletion_pending &&
        !episode?.deletion_finalized_at
    )
    .map(projectEpisode)
    .filter(
      (episode) =>
        episode.episode_id && (canManage || hasProductionRelationship(episode))
    )
    .map((episode) => scopeLeadReviewLane(episode, canManage));
  const reviewQueue = visibleRows
    .filter((episode) => episode.producer_lane === 'review_queue')
    .sort(compareReviewQueue);
  const leadReviewQueue = visibleRows
    .filter((episode) => episode.producer_lane === 'lead_review_queue')
    .sort(compareReviewQueue);
  const hostDrafts = visibleRows
    .filter((episode) => episode.producer_lane === 'host_draft')
    .sort(compareHostDrafts);
  const leadReviewWatchlist = visibleRows
    .filter((episode) => episode.producer_lane === 'lead_review_watchlist')
    .sort(compareReviewQueue);
  const completedHistory = visibleRows
    .filter((episode) => episode.producer_lane === 'completed_history')
    .sort(compareHistory);
  const actionQueue = [...reviewQueue, ...leadReviewQueue];
  const rows = [
    ...reviewQueue,
    ...leadReviewQueue,
    ...hostDrafts,
    ...leadReviewWatchlist,
    ...completedHistory,
  ];
  const openRequiredTasks = actionQueue.reduce(
    (total, episode) =>
      total +
      Math.max(
        0,
        episode.workflow.required_task_count -
          episode.workflow.completed_required_task_count
      ),
    0
  );

  return {
    rows,
    sections: {
      review_queue: reviewQueue,
      lead_review_queue: leadReviewQueue,
      host_drafts: hostDrafts,
      lead_review_watchlist: leadReviewWatchlist,
      completed_history: completedHistory,
    },
    summary: {
      total: rows.length,
      review_queue: reviewQueue.length,
      lead_review_queue: leadReviewQueue.length,
      open_required_tasks: openRequiredTasks,
      overdue_episodes: actionQueue.filter(
        (episode) => episode.workflow.overdue_count > 0
      ).length,
      host_drafts: hostDrafts.length,
      lead_review_watchlist: leadReviewWatchlist.length,
      completed_history: completedHistory.length,
    },
  };
}

export const STUDIO_WORKFLOW_HUB_TASK_IDS = Object.freeze({
  questionnaire_sent: QUESTIONNAIRE_SENT_TASK_ID,
  questionnaire_received: QUESTIONNAIRE_RECEIVED_TASK_ID,
});
