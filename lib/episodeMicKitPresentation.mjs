import {
  ACTIVE_MIC_KIT_REQUEST_STATUSES,
  MIC_KIT_REQUEST_STATUSES,
  normalizeMicKitTracker,
} from './micKitPresentation.mjs';

export const EPISODE_MIC_KIT_DELIVERABLE_ID = 'mic-kit-plan';

export const EPISODE_MIC_KIT_PLAN_CHOICES = Object.freeze([
  'request_kit',
  'use_own_equipment',
  'no_kit_needed',
]);

function cleanText(value, maxLength = 800) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 120)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export function normalizeEpisodeMicKitPlan(value = {}) {
  const source = plainObject(value);
  const choice = EPISODE_MIC_KIT_PLAN_CHOICES.includes(source.choice)
    ? source.choice
    : '';
  return {
    host_person_id: cleanId(source.host_person_id),
    choice,
    request_id:
      choice === 'request_kit' ? cleanId(source.request_id) : '',
    equipment_note: cleanText(source.equipment_note, 800),
  };
}

export function normalizeEpisodeMicKitPlans(
  value = [],
  hostPersonIds = []
) {
  const hosts = [
    ...new Set(
      (Array.isArray(hostPersonIds) ? hostPersonIds : [])
        .map(cleanId)
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const hostSet = new Set(hosts);
  const plansByHost = new Map();
  for (const source of Array.isArray(value) ? value.slice(0, 20) : []) {
    const plan = normalizeEpisodeMicKitPlan(source);
    if (plan.host_person_id && hostSet.has(plan.host_person_id)) {
      plansByHost.set(plan.host_person_id, plan);
    }
  }
  return hosts
    .filter((hostPersonId) => plansByHost.has(hostPersonId))
    .map((hostPersonId) => plansByHost.get(hostPersonId));
}

export function isEpisodeMicKitPlanResolved(value = {}) {
  const plan = normalizeEpisodeMicKitPlan(value);
  if (plan.choice === 'request_kit') return Boolean(plan.request_id);
  if (plan.choice === 'use_own_equipment') {
    return Boolean(plan.equipment_note);
  }
  return plan.choice === 'no_kit_needed';
}

export function getEpisodeMicKitPlanCompletion(
  plansValue = [],
  hostPersonIds = []
) {
  const hosts = [
    ...new Set(
      (Array.isArray(hostPersonIds) ? hostPersonIds : [])
        .map(cleanId)
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const plans = normalizeEpisodeMicKitPlans(plansValue, hosts);
  const plansByHost = new Map(
    plans.map((plan) => [plan.host_person_id, plan])
  );
  const resolvedHostPersonIds = hosts.filter((hostPersonId) =>
    isEpisodeMicKitPlanResolved(plansByHost.get(hostPersonId))
  );
  return {
    host_count: hosts.length,
    resolved_count: resolvedHostPersonIds.length,
    resolved_host_person_ids: resolvedHostPersonIds,
    complete:
      hosts.length > 0 && resolvedHostPersonIds.length === hosts.length,
  };
}

export function applyEpisodeMicKitPlanUpdate({
  plans = [],
  hostPersonIds = [],
  actorPersonId = '',
  update = {},
} = {}) {
  const hosts = [
    ...new Set(
      (Array.isArray(hostPersonIds) ? hostPersonIds : [])
        .map(cleanId)
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const actor = cleanId(actorPersonId);
  if (!actor || !hosts.includes(actor)) {
    throw new Error(
      'Microphone plan: only an assigned host can update their own plan.'
    );
  }
  const sourceUpdate = plainObject(update);
  const nextPlan = normalizeEpisodeMicKitPlan({
    host_person_id: actor,
    choice: sourceUpdate.choice,
    request_id: sourceUpdate.request_id,
    equipment_note: sourceUpdate.equipment_note,
  });
  if (!nextPlan.choice) {
    throw new Error('Microphone plan: choose how you will record.');
  }
  if (nextPlan.choice === 'request_kit' && !nextPlan.request_id) {
    throw new Error('Microphone plan: select your episode mic-kit request.');
  }
  if (
    nextPlan.choice === 'use_own_equipment' &&
    !nextPlan.equipment_note
  ) {
    throw new Error(
      'Microphone plan: briefly identify the microphone and headphones you will use.'
    );
  }

  const plansByHost = new Map(
    normalizeEpisodeMicKitPlans(plans, hosts).map((plan) => [
      plan.host_person_id,
      plan,
    ])
  );
  plansByHost.set(actor, nextPlan);
  return hosts
    .filter((hostPersonId) => plansByHost.has(hostPersonId))
    .map((hostPersonId) => plansByHost.get(hostPersonId));
}

export function findEpisodeMicKitRequest(
  trackerValue,
  { requestId = '', episodeId = '', hostPersonId = '' } = {}
) {
  const request = normalizeMicKitTracker(trackerValue).requests.find(
    (candidate) => candidate.request_id === cleanId(requestId)
  );
  if (
    !request ||
    cleanId(request.episode_id) !== cleanId(episodeId) ||
    cleanId(request.requester_person_id) !== cleanId(hostPersonId)
  ) {
    return null;
  }
  return request;
}

export function getEpisodeMicKitRequestCoverage(
  trackerValue,
  { episodeId = '', hostPersonIds = [] } = {}
) {
  const episode = cleanId(episodeId);
  const hosts = new Set(
    (Array.isArray(hostPersonIds) ? hostPersonIds : [])
      .map(cleanId)
      .filter(Boolean)
  );
  return normalizeMicKitTracker(trackerValue).requests
    .filter(
      (request) =>
        cleanId(request.episode_id) === episode &&
        hosts.has(cleanId(request.requester_person_id))
    )
    .map((request) => ({
      request_id: request.request_id,
      host_person_id: cleanId(request.requester_person_id),
      status: MIC_KIT_REQUEST_STATUSES.includes(request.status)
        ? request.status
        : 'requested',
      has_kit_assignment: Boolean(request.kit_id),
      updated_at: request.updated_at,
    }));
}

export function isActiveEpisodeMicKitRequestCoverage(value = {}) {
  return ACTIVE_MIC_KIT_REQUEST_STATUSES.includes(value?.status);
}

export function buildEpisodeMicKitPlanRows({
  plans = [],
  hostPersonIds = [],
  requestCoverage = [],
} = {}) {
  const hosts = [
    ...new Set(
      (Array.isArray(hostPersonIds) ? hostPersonIds : [])
        .map(cleanId)
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const plansByHost = new Map(
    normalizeEpisodeMicKitPlans(plans, hosts).map((plan) => [
      plan.host_person_id,
      plan,
    ])
  );
  const coverageByRequest = new Map(
    (Array.isArray(requestCoverage) ? requestCoverage : []).map((coverage) => [
      cleanId(coverage.request_id),
      coverage,
    ])
  );
  return hosts.map((hostPersonId) => {
    const plan =
      plansByHost.get(hostPersonId) ||
      normalizeEpisodeMicKitPlan({ host_person_id: hostPersonId });
    const linkedCoverage = coverageByRequest.get(plan.request_id);
    const requestCoverage =
      plan.choice === 'request_kit' &&
      linkedCoverage?.host_person_id === hostPersonId
        ? linkedCoverage
        : null;
    return {
      ...plan,
      resolved:
        plan.choice === 'request_kit'
          ? Boolean(
              requestCoverage &&
                isActiveEpisodeMicKitRequestCoverage(requestCoverage)
            )
          : isEpisodeMicKitPlanResolved(plan),
      request_coverage: requestCoverage,
    };
  });
}

export function getEpisodeMicKitSubmissionReadiness(
  episodeValue = {},
  trackerValue = {}
) {
  const episode = plainObject(episodeValue);
  const hostPersonIds = Array.isArray(episode.host_person_ids)
    ? episode.host_person_ids
    : [];
  const deliverable = (
    Array.isArray(episode.deliverables) ? episode.deliverables : []
  ).find((candidate) => candidate?.id === EPISODE_MIC_KIT_DELIVERABLE_ID);
  const microphonePlan = plainObject(deliverable);

  const requestCoverage = getEpisodeMicKitRequestCoverage(trackerValue, {
    episodeId: episode.episode_id,
    hostPersonIds,
  });
  const rows = buildEpisodeMicKitPlanRows({
    plans: microphonePlan.mic_kit_plans,
    hostPersonIds,
    requestCoverage,
  });
  const unresolvedHosts = rows
    .filter((row) => row.resolved !== true)
    .map((row) => {
      let reason = 'plan_missing';
      if (row.choice === 'request_kit') {
        reason = row.request_coverage
          ? 'request_inactive'
          : 'request_not_verified';
      } else if (row.choice === 'use_own_equipment') {
        reason = 'equipment_note_missing';
      }
      return {
        host_person_id: row.host_person_id,
        choice: row.choice,
        reason,
        request_status: row.request_coverage?.status || '',
      };
    });

  return {
    deliverable_id: EPISODE_MIC_KIT_DELIVERABLE_ID,
    required: true,
    complete: rows.length > 0 && unresolvedHosts.length === 0,
    host_count: rows.length,
    resolved_count: rows.length - unresolvedHosts.length,
    gap_acknowledged:
      microphonePlan.missing_acknowledged === true &&
      cleanText(microphonePlan.missing_note, 1200).length >= 4,
    unresolved_hosts: unresolvedHosts,
  };
}

export function applyEpisodeMicKitReadinessToCompletion(
  completionValue = {},
  readinessValue = {}
) {
  const completion = plainObject(completionValue);
  const readiness = plainObject(readinessValue);
  if (readiness.required !== true || readiness.complete === true) {
    return { ...completion };
  }

  const sourceMissing = Array.isArray(completion.missing)
    ? completion.missing
    : [];
  const alreadyMissing = sourceMissing.some(
    (item) => item?.id === EPISODE_MIC_KIT_DELIVERABLE_ID
  );
  const micMissing = {
    id: EPISODE_MIC_KIT_DELIVERABLE_ID,
    label: 'Microphone plan',
    acknowledged: readiness.gap_acknowledged === true,
    note: readiness.gap_acknowledged
      ? 'The unresolved microphone plan was acknowledged.'
      : '',
    expected_by: '',
    unresolved_hosts: Array.isArray(readiness.unresolved_hosts)
      ? readiness.unresolved_hosts
      : [],
  };
  const missing = alreadyMissing
    ? sourceMissing.map((item) =>
        item?.id === EPISODE_MIC_KIT_DELIVERABLE_ID
          ? { ...item, unresolved_hosts: micMissing.unresolved_hosts }
          : item
      )
    : [...sourceMissing, micMissing];
  const required = Math.max(0, Number(completion.required) || 0);
  const completed = Math.max(
    0,
    (Number(completion.completed) || 0) - (alreadyMissing ? 0 : 1)
  );
  const hostPercent = required
    ? Math.round((completed / required) * 100)
    : 0;
  const acknowledgedMissing =
    Math.max(0, Number(completion.acknowledged_missing) || 0) +
    (!alreadyMissing && readiness.gap_acknowledged ? 1 : 0);

  return {
    ...completion,
    completed,
    percent: Math.min(80, Math.round(hostPercent * 0.8)),
    host_percent: hostPercent,
    overall_percent: Math.min(80, Math.round(hostPercent * 0.8)),
    host_ready: false,
    workflow_stage: 'host_preparation',
    remaining_reason: 'A required host microphone plan needs attention.',
    missing,
    acknowledged_missing: acknowledgedMissing,
    can_submit: false,
    can_submit_with_gaps: Boolean(
      readiness.gap_acknowledged &&
        (completion.can_submit || completion.can_submit_with_gaps)
    ),
  };
}
