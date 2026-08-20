import { CURRENT_SEASON } from './currentSeason.mjs';

const HOST_DRAFT_STATUSES = new Set([
  'planning',
  'in_progress',
  'needs_changes',
]);
const PRODUCER_QUEUE_STATUSES = new Set([
  'submitted',
  'submitted_with_gaps',
]);
const PRODUCTION_RELATIONSHIPS = new Set([
  'producer',
  'production_lead',
  'workflow_assignee',
]);
const QUESTIONNAIRE_SENT_TASK_ID = 'guest-prep-sent';
const QUESTIONNAIRE_RECEIVED_TASK_ID = 'guest-prep-received';
const PRIVATE_NAME_PATTERN = /@|https?:\/\/|\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/i;

function clean(value, limit = 180) {
  return String(value || '')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, limit);
}

function safeDisplayName(value) {
  const name = clean(value, 120);
  return name && !PRIVATE_NAME_PATTERN.test(name) ? name : '';
}

function boundedCount(value, fallback = 0) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return fallback;
  return Math.min(Math.trunc(number), 100_000);
}

function percent(numerator, denominator) {
  if (!denominator) return 0;
  return Math.min(100, Math.max(0, Math.round((numerator / denominator) * 100)));
}

function dateKey(value) {
  const date = clean(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function stringList(values, limit = 20) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map((value) => clean(value, 80))
        .filter(Boolean)
    ),
  ].slice(0, limit);
}

function isInactiveEpisode(episode) {
  return Boolean(
    episode?.archived ||
      episode?.deleted_at ||
      episode?.deletion_pending ||
      episode?.deletion_finalized_at
  );
}

function taskComplete(workflow, taskId) {
  return (Array.isArray(workflow?.task_states)
    ? workflow.task_states
    : []
  ).some(
    (task) => clean(task?.task_id, 120) === taskId && task?.complete === true
  );
}

function questionnaireState(workflow) {
  if (taskComplete(workflow, QUESTIONNAIRE_RECEIVED_TASK_ID)) {
    return 'received';
  }
  if (taskComplete(workflow, QUESTIONNAIRE_SENT_TASK_ID)) {
    return 'pending';
  }
  return 'not_shared';
}

function episodeSignal(episode) {
  const workflow =
    episode?.workflow && typeof episode.workflow === 'object'
      ? episode.workflow
      : {};
  const status = clean(episode?.status, 60) || 'planning';
  const productionStage = clean(episode?.production_stage, 60);
  const completed = Boolean(
    productionStage === 'complete' ||
      (status === 'accepted' && episode?.production_completed_at)
  );
  const overdue = boundedCount(workflow.overdue_count) > 0;
  const dependencyBlocked = Boolean(
    workflow.has_dependency_blocking === true ||
      (Array.isArray(workflow.dependency_blocked_task_ids) &&
        workflow.dependency_blocked_task_ids.length > 0)
  );
  const offTrack = Boolean(
    episode?.effective_delivery_health === 'off_track' ||
      episode?.delivery_health === 'off_track' ||
      workflow.off_track === true
  );

  return {
    scheduled: Boolean(dateKey(episode?.target_release_date)),
    status,
    host_draft: HOST_DRAFT_STATUSES.has(status),
    producer_queue: PRODUCER_QUEUE_STATUSES.has(status),
    lead_review: status === 'accepted' && productionStage === 'lead_review',
    in_production: status === 'accepted' && !completed,
    completed,
    overdue,
    dependency_blocked: dependencyBlocked,
    off_track: offTrack,
    attention: overdue || dependencyBlocked || offTrack,
    questionnaire_state: questionnaireState(workflow),
    host_names: [
      ...new Set(
        (Array.isArray(episode?.host_names) ? episode.host_names : [])
          .map(safeDisplayName)
          .filter(Boolean)
      ),
    ].slice(0, 12),
    has_host_assignment:
      (Array.isArray(episode?.host_person_ids) &&
        episode.host_person_ids.some(Boolean)) ||
      (Array.isArray(episode?.host_names) && episode.host_names.some(Boolean)),
    producer_name: safeDisplayName(episode?.producer_name),
    has_producer_assignment: Boolean(
      clean(episode?.producer_person_id, 180) ||
        safeDisplayName(episode?.producer_name)
    ),
    my_roles: stringList(episode?.my_roles, 12),
  };
}

function countWhere(signals, field) {
  return signals.filter((signal) => signal[field] === true).length;
}

function hasProductionRelationship(signal) {
  return signal.my_roles.some((role) => PRODUCTION_RELATIONSHIPS.has(role));
}

function createWorkloadRow(name) {
  return {
    name,
    episode_count: 0,
    scheduled: 0,
    host_drafts: 0,
    producer_review: 0,
    production_active: 0,
    lead_review: 0,
    overdue: 0,
    blocked: 0,
    attention: 0,
  };
}

function addSignalToWorkload(row, signal) {
  row.episode_count += 1;
  row.scheduled += Number(signal.scheduled);
  row.host_drafts += Number(signal.host_draft);
  row.producer_review += Number(signal.producer_queue);
  row.production_active += Number(signal.in_production);
  row.lead_review += Number(signal.lead_review);
  row.overdue += Number(signal.overdue);
  row.blocked += Number(signal.dependency_blocked || signal.off_track);
  row.attention += Number(signal.attention);
}

function sortedWorkloadRows(map) {
  return [...map.values()].sort(
    (left, right) =>
      right.episode_count - left.episode_count ||
      left.name.localeCompare(right.name)
  );
}

function buildTeamWorkload(signals, canManage) {
  if (!canManage) {
    return {
      available: false,
      scope: 'personal',
      hosts: [],
      producers: [],
      producer_breakdown_available: false,
      producer_assignment: null,
      unnamed_host_assignments: 0,
    };
  }

  const hostRows = new Map();
  const producerRows = new Map();
  let unnamedHostAssignments = 0;
  let assignedProducers = 0;
  let unnamedAssignedProducers = 0;

  for (const signal of signals) {
    if (signal.host_names.length) {
      for (const name of signal.host_names) {
        const key = name.toLocaleLowerCase();
        if (!hostRows.has(key)) hostRows.set(key, createWorkloadRow(name));
        addSignalToWorkload(hostRows.get(key), signal);
      }
    } else if (signal.has_host_assignment) {
      unnamedHostAssignments += 1;
    }

    if (signal.has_producer_assignment) {
      assignedProducers += 1;
      if (signal.producer_name) {
        const key = signal.producer_name.toLocaleLowerCase();
        if (!producerRows.has(key)) {
          producerRows.set(key, createWorkloadRow(signal.producer_name));
        }
        addSignalToWorkload(producerRows.get(key), signal);
      } else {
        unnamedAssignedProducers += 1;
      }
    }
  }

  return {
    available: true,
    scope: 'team',
    hosts: sortedWorkloadRows(hostRows),
    producers: sortedWorkloadRows(producerRows),
    producer_breakdown_available:
      assignedProducers > 0 && unnamedAssignedProducers === 0,
    producer_assignment: {
      assigned: assignedProducers,
      unassigned: Math.max(0, signals.length - assignedProducers),
      names_unavailable: unnamedAssignedProducers,
    },
    unnamed_host_assignments: unnamedHostAssignments,
  };
}

function countPersonalRelationship(signals, role) {
  return signals.filter((signal) => signal.my_roles.includes(role)).length;
}

function buildPersonalWorkload(signals, canManage) {
  if (canManage) return null;
  const asHost = countPersonalRelationship(signals, 'host');
  const asProducer = countPersonalRelationship(signals, 'producer');
  const asProductionLead = countPersonalRelationship(
    signals,
    'production_lead'
  );
  const asWorkflowAssignee = countPersonalRelationship(
    signals,
    'workflow_assignee'
  );
  return {
    episode_count: signals.length,
    as_host: asHost,
    as_producer: asProducer,
    as_production_lead: asProductionLead,
    as_workflow_assignee: asWorkflowAssignee,
    actionable: signals.filter(
      (signal) =>
        (signal.host_draft && signal.my_roles.includes('host')) ||
        (signal.producer_queue && signal.my_roles.includes('producer')) ||
        (signal.lead_review && signal.my_roles.includes('production_lead')) ||
        (signal.attention && signal.my_roles.includes('workflow_assignee'))
    ).length,
  };
}

function pipelineItem({ id, label, count, href, tone = 'neutral' }) {
  return { id, label, count, href, tone };
}

/**
 * Build the privacy-safe Studio operations model from data already loaded by
 * the Studio home. This helper performs no reads and never returns episode,
 * questionnaire, contact, asset, recording, note, or task-detail payloads.
 */
export function buildStudioOperationsInsightModel({
  episodes = [],
  season = CURRENT_SEASON,
  permissions = [],
  capabilities = {},
} = {}) {
  const allowed = new Set(Array.isArray(permissions) ? permissions : []);
  const canManage = allowed.has('episodes:manage');
  const canViewProducerOperations = Boolean(
    canManage || capabilities?.producer_tasks === true
  );
  const seasonLabel = clean(season?.label || CURRENT_SEASON.label, 80);
  const rows = (Array.isArray(episodes) ? episodes : []).filter(
    (episode) =>
      episode &&
      clean(episode.season, 80) === seasonLabel &&
      !isInactiveEpisode(episode)
  );
  const signals = rows.map(episodeSignal);
  const producerSignals = canManage
    ? signals
    : signals.filter(hasProductionRelationship);

  const scheduled = countWhere(signals, 'scheduled');
  const completed = countWhere(signals, 'completed');
  const hostReviewDrafts = countWhere(signals, 'host_draft');
  const producerQueue = countWhere(producerSignals, 'producer_queue');
  const leadReview = countWhere(producerSignals, 'lead_review');
  const productionCompleted = countWhere(producerSignals, 'completed');
  const overdue = countWhere(signals, 'overdue');
  const dependencyBlocked = countWhere(signals, 'dependency_blocked');
  const offTrack = countWhere(signals, 'off_track');
  const attention = countWhere(signals, 'attention');
  const inProduction = countWhere(producerSignals, 'in_production');
  const unassigned = signals.filter(
    (signal) =>
      !signal.has_host_assignment || !signal.has_producer_assignment
  ).length;
  const questionnaires = {
    total: signals.length,
    not_shared: signals.filter(
      (signal) => signal.questionnaire_state === 'not_shared'
    ).length,
    pending: signals.filter(
      (signal) => signal.questionnaire_state === 'pending'
    ).length,
    received: signals.filter(
      (signal) => signal.questionnaire_state === 'received'
    ).length,
  };

  const plannedSlots = boundedCount(
    season?.schedule_slots,
    boundedCount(CURRENT_SEASON.schedule_slots)
  );
  const reportedStudios = boundedCount(
    season?.episode_studios,
    signals.length
  );
  const scheduleCoverage = {
    scheduled,
    unscheduled: Math.max(0, signals.length - scheduled),
    total: signals.length,
    percent: percent(scheduled, signals.length),
  };
  const metrics = {
    schedule_coverage: scheduleCoverage,
    host_drafts: hostReviewDrafts,
    producer_review: canViewProducerOperations ? producerQueue : null,
    production_active: canViewProducerOperations ? inProduction : null,
    production_completed: canViewProducerOperations
      ? productionCompleted
      : null,
    attention,
    questionnaires_received: questionnaires.received,
    questionnaires_pending: questionnaires.pending,
  };
  const pipeline = [
    pipelineItem({
      id: 'host_drafts',
      label: 'Host review drafts',
      count: hostReviewDrafts,
      href: '/studio/episodes',
    }),
    ...(canViewProducerOperations
      ? [
          pipelineItem({
            id: 'producer_review',
            label: 'With producer',
            count: producerQueue,
            href: '/studio/production',
            tone: producerQueue ? 'active' : 'neutral',
          }),
          pipelineItem({
            id: 'production_active',
            label: 'In production',
            count: inProduction,
            href: '/studio/production',
          }),
          pipelineItem({
            id: 'lead_review',
            label: 'Lead review',
            count: leadReview,
            href: '/studio/production',
            tone: leadReview ? 'active' : 'neutral',
          }),
        ]
      : []),
    pipelineItem({
      id: 'questionnaires_pending',
      label: 'Questionnaires pending',
      count: questionnaires.pending,
      href: '/studio/questionnaires',
      tone: questionnaires.pending ? 'warning' : 'neutral',
    }),
    pipelineItem({
      id: 'questionnaires_received',
      label: 'Questionnaires received',
      count: questionnaires.received,
      href: '/studio/questionnaires',
      tone: questionnaires.received ? 'positive' : 'neutral',
    }),
  ];
  const teamWorkload = buildTeamWorkload(signals, canManage);
  const workload = teamWorkload.available
    ? [
        ...teamWorkload.producers.map((row) => ({
          role: 'producer',
          ...row,
        })),
        ...teamWorkload.hosts.map((row) => ({ role: 'host', ...row })),
      ]
    : [];

  return {
    schema_version: 1,
    scope: canManage ? 'team' : 'assigned',
    visibility: {
      team_workload: canManage,
      producer_operations: canViewProducerOperations,
      private_questionnaire_fields: false,
    },
    season: {
      label: seasonLabel,
      status: clean(season?.status || CURRENT_SEASON.status, 40),
      starts_on: dateKey(season?.starts_on || CURRENT_SEASON.starts_on),
      ends_on: dateKey(season?.ends_on || CURRENT_SEASON.ends_on),
      planned_slots: plannedSlots,
      reported_episode_studios: reportedStudios,
      open_slots: Math.max(0, plannedSlots - reportedStudios),
      created_percent: percent(reportedStudios, plannedSlots),
      scheduled_in_scope: scheduled,
      unscheduled_in_scope: Math.max(0, signals.length - scheduled),
      completed_in_scope: completed,
      completion_percent_in_scope: percent(completed, signals.length),
    },
    metrics,
    pipeline,
    health: {
      on_track: Math.max(0, signals.length - offTrack),
      off_track: offTrack,
      overdue,
      blocked: dependencyBlocked,
      unassigned,
    },
    workload,
    workload_meta: {
      available: teamWorkload.available,
      producer_breakdown_available:
        teamWorkload.producer_breakdown_available,
      producer_assignment: teamWorkload.producer_assignment,
      unnamed_host_assignments: teamWorkload.unnamed_host_assignments,
      personal: buildPersonalWorkload(signals, canManage),
    },
    questionnaire_summary: questionnaires,
  };
}
