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

export const EPISODE_GUEST_MIC_KIT_PLAN_CHOICES = Object.freeze([
  'request_kit',
  'use_own_equipment',
  'needs_follow_up',
]);

const GUEST_RECORDING_READINESS_KEYS = Object.freeze([
  'internet',
  'microphone',
  'headphones',
  'quiet_place',
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

export function normalizeEpisodeGuestMicKitPlan(value = {}) {
  const source = plainObject(value);
  const choice = EPISODE_GUEST_MIC_KIT_PLAN_CHOICES.includes(source.choice)
    ? source.choice
    : '';
  const readinessSource = plainObject(source.readiness);
  return {
    guest_name: cleanText(source.guest_name, 180),
    choice,
    request_id:
      ['request_kit', 'needs_follow_up'].includes(choice)
        ? cleanId(source.request_id)
        : '',
    equipment_note: cleanText(source.equipment_note, 800),
    response_revision: Math.max(
      0,
      Math.trunc(Number(source.response_revision) || 0)
    ),
    readiness: Object.fromEntries(
      GUEST_RECORDING_READINESS_KEYS.map((key) => [
        key,
        cleanText(readinessSource[key], 80),
      ])
    ),
  };
}

export function hasEpisodeGuestMicKitPlan(value = {}) {
  const plan = normalizeEpisodeGuestMicKitPlan(value);
  return Boolean(
    plan.response_revision ||
      plan.guest_name ||
      plan.choice ||
      plan.request_id ||
      plan.equipment_note ||
      Object.values(plan.readiness).some(Boolean)
  );
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

export function isEpisodeGuestMicKitPlanResolved(value = {}) {
  const plan = normalizeEpisodeGuestMicKitPlan(value);
  if (!hasEpisodeGuestMicKitPlan(plan)) return true;
  if (plan.choice === 'request_kit') return Boolean(plan.request_id);
  if (plan.choice === 'use_own_equipment') {
    return Boolean(plan.equipment_note);
  }
  return false;
}

export function getEpisodeMicKitPlanCompletion(
  plansValue = [],
  hostPersonIds = [],
  guestPlanValue = {}
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
  const guestPlanPresent = hasEpisodeGuestMicKitPlan(guestPlanValue);
  const guestPlanResolved =
    !guestPlanPresent || isEpisodeGuestMicKitPlanResolved(guestPlanValue);
  const completion = {
    host_count: hosts.length,
    resolved_count: resolvedHostPersonIds.length,
    resolved_host_person_ids: resolvedHostPersonIds,
    complete:
      hosts.length > 0 &&
      resolvedHostPersonIds.length === hosts.length &&
      guestPlanResolved,
  };
  if (!guestPlanPresent) return completion;
  return {
    ...completion,
    guest_count: 1,
    guest_resolved_count: guestPlanResolved ? 1 : 0,
    participant_count: hosts.length + 1,
    participant_resolved_count:
      resolvedHostPersonIds.length + (guestPlanResolved ? 1 : 0),
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

export function connectEpisodeMicKitRequestToPlan({
  deliverable = {},
  hostPersonIds = [],
  participantType = '',
  hostPersonId = '',
  guestName = '',
  requestId = '',
} = {}) {
  const source = plainObject(deliverable);
  const cleanRequestId = cleanId(requestId);
  if (!cleanRequestId) {
    throw new Error('Microphone plan: a mic-kit request is required.');
  }

  if (participantType === 'guest') {
    const current = normalizeEpisodeGuestMicKitPlan(
      source.guest_mic_kit_plan
    );
    return {
      ...source,
      guest_mic_kit_plan: {
        ...current,
        guest_name:
          cleanText(guestName, 180) || current.guest_name || 'Episode guest',
        choice: 'request_kit',
        request_id: cleanRequestId,
      },
    };
  }

  const hosts = [
    ...new Set(
      (Array.isArray(hostPersonIds) ? hostPersonIds : [])
        .map(cleanId)
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const targetHost = cleanId(hostPersonId);
  if (!targetHost || !hosts.includes(targetHost)) {
    throw new Error(
      'Microphone plan: choose an assigned host for this request.'
    );
  }
  const plansByHost = new Map(
    normalizeEpisodeMicKitPlans(source.mic_kit_plans, hosts).map((plan) => [
      plan.host_person_id,
      plan,
    ])
  );
  plansByHost.set(targetHost, {
    host_person_id: targetHost,
    choice: 'request_kit',
    request_id: cleanRequestId,
    equipment_note: plansByHost.get(targetHost)?.equipment_note || '',
  });
  return {
    ...source,
    mic_kit_plans: hosts
      .filter((personId) => plansByHost.has(personId))
      .map((personId) => plansByHost.get(personId)),
  };
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
      request_kind:
        request.request_kind === 'equipment_review'
          ? 'equipment_review'
          : 'shipment',
      review_resolution: ['shipment', 'own_equipment'].includes(
        request.review_resolution
      )
        ? request.review_resolution
        : '',
      status: MIC_KIT_REQUEST_STATUSES.includes(request.status)
        ? request.status
        : 'requested',
      has_kit_assignment: Boolean(request.kit_id),
      updated_at: request.updated_at,
    }));
}

export function getEpisodeGuestMicKitRequestCoverage(
  trackerValue,
  { episodeId = '' } = {}
) {
  const episode = cleanId(episodeId);
  const requests = Array.isArray(trackerValue?.requests)
    ? trackerValue.requests
    : [];
  return requests
    .filter(
      (request) =>
        cleanId(request?.episode_id) === episode &&
        cleanId(request?.participant_type) === 'guest'
    )
    .map((request) => ({
      request_id: cleanId(request?.request_id),
      participant_type: 'guest',
      request_kind:
        request?.request_kind === 'equipment_review'
          ? 'equipment_review'
          : 'shipment',
      review_resolution: ['shipment', 'own_equipment'].includes(
        request?.review_resolution
      )
        ? request.review_resolution
        : '',
      status: MIC_KIT_REQUEST_STATUSES.includes(request?.status)
        ? request.status
        : 'requested',
      has_kit_assignment: Boolean(request?.kit_id),
      updated_at: cleanText(request?.updated_at, 80),
    }))
    .filter((coverage) => coverage.request_id);
}

export function isActiveEpisodeMicKitRequestCoverage(value = {}) {
  return ACTIVE_MIC_KIT_REQUEST_STATUSES.includes(value?.status);
}

export function isHistoricallyFulfilledEpisodeMicKitRequestCoverage(
  value = {}
) {
  return value?.request_kind !== 'equipment_review' && value?.status === 'returned';
}

export function isSatisfiedEpisodeMicKitRequestCoverage(value = {}) {
  return Boolean(
    value?.request_kind !== 'equipment_review' &&
      (isActiveEpisodeMicKitRequestCoverage(value) ||
        isHistoricallyFulfilledEpisodeMicKitRequestCoverage(value))
  );
}

export function buildEpisodeMicKitPlanRows({
  plans = [],
  hostPersonIds = [],
  requestCoverage = [],
  guestPlan = {},
  guestRequestCoverage = [],
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
  const hostRows = hosts.map((hostPersonId) => {
    const plan =
      plansByHost.get(hostPersonId) ||
      normalizeEpisodeMicKitPlan({ host_person_id: hostPersonId });
    const linkedCoverage = coverageByRequest.get(plan.request_id);
    const hostCoverage = (Array.isArray(requestCoverage)
      ? requestCoverage
      : []
    )
      .filter(
        (coverage) => cleanId(coverage?.host_person_id) === hostPersonId
      )
      .sort((left, right) =>
        String(right?.updated_at || '').localeCompare(
          String(left?.updated_at || '')
        )
      );
    const activeHostCoverage = hostCoverage.filter(
      isActiveEpisodeMicKitRequestCoverage
    );
    const safeLinkedCoverage =
      linkedCoverage?.host_person_id === hostPersonId
        ? linkedCoverage
        : null;
    const effectiveCoverage =
      safeLinkedCoverage &&
      isActiveEpisodeMicKitRequestCoverage(safeLinkedCoverage)
        ? safeLinkedCoverage
        : activeHostCoverage.length === 1
          ? activeHostCoverage[0]
          : safeLinkedCoverage;
    const resolvedWithOwnEquipment = Boolean(
      effectiveCoverage?.request_kind === 'equipment_review' &&
        effectiveCoverage.review_resolution === 'own_equipment'
    );
    const effectiveChoice = resolvedWithOwnEquipment
      ? 'use_own_equipment'
      : effectiveCoverage &&
          isActiveEpisodeMicKitRequestCoverage(effectiveCoverage)
        ? 'request_kit'
        : plan.choice;
    const effectiveRequestId =
      effectiveChoice === 'request_kit'
        ? effectiveCoverage?.request_id || plan.request_id
        : plan.request_id;
    return {
      ...plan,
      choice: effectiveChoice,
      request_id: effectiveRequestId,
      resolved:
        effectiveChoice === 'request_kit'
          ? isSatisfiedEpisodeMicKitRequestCoverage(effectiveCoverage)
          : effectiveChoice === 'use_own_equipment' &&
              resolvedWithOwnEquipment
            ? true
          : isEpisodeMicKitPlanResolved(plan),
      request_coverage: effectiveCoverage || null,
    };
  });
  const availableGuestCoverage = (
    Array.isArray(guestRequestCoverage) ? guestRequestCoverage : []
  ).filter(
    (coverage) => cleanId(coverage?.participant_type) === 'guest'
  );
  const activeGuestCoverage = availableGuestCoverage
    .filter(isActiveEpisodeMicKitRequestCoverage)
    .sort((left, right) =>
      String(right?.updated_at || '').localeCompare(
        String(left?.updated_at || '')
      )
    );
  const hasStoredGuestPlan = hasEpisodeGuestMicKitPlan(guestPlan);
  if (!hasStoredGuestPlan && !activeGuestCoverage.length) return hostRows;

  const normalizedGuestPlan = normalizeEpisodeGuestMicKitPlan(
    hasStoredGuestPlan
      ? guestPlan
      : {
          guest_name: 'Episode guest',
          choice: 'request_kit',
          request_id: '',
        }
  );
  const exactGuestCoverage = availableGuestCoverage.find(
    (coverage) =>
      cleanId(coverage?.request_id) === normalizedGuestPlan.request_id
    );
  const linkedGuestCoverage =
    exactGuestCoverage &&
    isActiveEpisodeMicKitRequestCoverage(exactGuestCoverage)
      ? exactGuestCoverage
      : activeGuestCoverage.length === 1
        ? activeGuestCoverage[0]
        : exactGuestCoverage ||
          (!normalizedGuestPlan.request_id &&
          availableGuestCoverage.length === 1
            ? availableGuestCoverage[0]
            : null);
  const safeGuestCoverage = linkedGuestCoverage
    ? {
        request_id: cleanId(linkedGuestCoverage.request_id),
        participant_type: 'guest',
        request_kind:
          linkedGuestCoverage.request_kind === 'equipment_review'
            ? 'equipment_review'
            : 'shipment',
        review_resolution: ['shipment', 'own_equipment'].includes(
          linkedGuestCoverage.review_resolution
        )
          ? linkedGuestCoverage.review_resolution
          : '',
        status: MIC_KIT_REQUEST_STATUSES.includes(linkedGuestCoverage.status)
          ? linkedGuestCoverage.status
          : 'requested',
        has_kit_assignment:
          linkedGuestCoverage.has_kit_assignment === true,
        updated_at: cleanText(linkedGuestCoverage.updated_at, 80),
      }
    : null;
  const effectiveGuestChoice =
    normalizedGuestPlan.choice === 'needs_follow_up' &&
    safeGuestCoverage?.review_resolution === 'shipment'
      ? 'request_kit'
      : normalizedGuestPlan.choice === 'needs_follow_up' &&
          safeGuestCoverage?.review_resolution === 'own_equipment'
        ? 'use_own_equipment'
        : normalizedGuestPlan.choice;
  return [
    ...hostRows,
    {
      participant_type: 'guest',
      ...normalizedGuestPlan,
      guest_name: normalizedGuestPlan.guest_name || 'Episode guest',
      choice: effectiveGuestChoice,
      request_id:
        normalizedGuestPlan.request_id || safeGuestCoverage?.request_id || '',
      resolved:
        effectiveGuestChoice === 'request_kit'
          ? isSatisfiedEpisodeMicKitRequestCoverage(safeGuestCoverage)
          : effectiveGuestChoice === 'use_own_equipment' &&
              safeGuestCoverage?.review_resolution === 'own_equipment'
            ? true
            : isEpisodeGuestMicKitPlanResolved({
                ...normalizedGuestPlan,
                choice: effectiveGuestChoice,
              }),
      request_coverage: safeGuestCoverage,
    },
  ];
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
  const guestRequestCoverage = getEpisodeGuestMicKitRequestCoverage(
    trackerValue,
    { episodeId: episode.episode_id }
  );
  const rows = buildEpisodeMicKitPlanRows({
    plans: microphonePlan.mic_kit_plans,
    hostPersonIds,
    requestCoverage,
    guestPlan: microphonePlan.guest_mic_kit_plan,
    guestRequestCoverage,
  });
  const hostRows = rows.filter((row) => row.participant_type !== 'guest');
  const guestRow = rows.find((row) => row.participant_type === 'guest') || null;
  const unresolvedHosts = hostRows
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

  const readiness = {
    deliverable_id: EPISODE_MIC_KIT_DELIVERABLE_ID,
    required: true,
    complete:
      hostRows.length > 0 &&
      unresolvedHosts.length === 0 &&
      (!guestRow || guestRow.resolved === true),
    host_count: hostRows.length,
    resolved_count: hostRows.length - unresolvedHosts.length,
    gap_acknowledged:
      microphonePlan.missing_acknowledged === true &&
      cleanText(microphonePlan.missing_note, 1200).length >= 4,
    unresolved_hosts: unresolvedHosts,
  };
  if (!guestRow) return readiness;
  return {
    ...readiness,
    guest_count: 1,
    guest_resolved_count: guestRow.resolved ? 1 : 0,
    participant_count: hostRows.length + 1,
    participant_resolved_count:
      hostRows.length - unresolvedHosts.length + (guestRow.resolved ? 1 : 0),
    guest_plan: guestRow,
    unresolved_guest: guestRow.resolved
      ? null
      : {
          participant_type: 'guest',
          choice: guestRow.choice,
          reason:
            guestRow.choice === 'request_kit'
              ? guestRow.request_coverage
                ? 'request_inactive'
                : 'request_not_verified'
              : guestRow.choice === 'use_own_equipment'
                ? 'equipment_note_missing'
                : 'follow_up_required',
          request_status: guestRow.request_coverage?.status || '',
        },
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
    ...(readiness.unresolved_guest
      ? { unresolved_guest: readiness.unresolved_guest }
      : {}),
  };
  const missing = alreadyMissing
    ? sourceMissing.map((item) =>
        item?.id === EPISODE_MIC_KIT_DELIVERABLE_ID
          ? {
              ...item,
              unresolved_hosts: micMissing.unresolved_hosts,
              ...(micMissing.unresolved_guest
                ? { unresolved_guest: micMissing.unresolved_guest }
                : {}),
            }
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
    remaining_reason: 'A required microphone plan needs attention.',
    missing,
    acknowledged_missing: acknowledgedMissing,
    can_submit: false,
    can_submit_with_gaps: Boolean(
      readiness.gap_acknowledged &&
        (completion.can_submit || completion.can_submit_with_gaps)
    ),
  };
}
