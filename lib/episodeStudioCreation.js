import {
  createDefaultEpisodeDeliverables,
} from './episodeStudioPresentation.mjs';
import { createDefaultEpisodeProductionTasks } from './episodeProductionPlan.mjs';
import { getPersonStudioCapabilities } from './peopleStudioCapabilities.mjs';

export class EpisodeStudioCreationError extends Error {
  constructor(
    message,
    { code = 'EPISODE_STUDIO_CREATE_FAILED', status = 400 } = {}
  ) {
    super(message);
    this.name = 'EpisodeStudioCreationError';
    this.code = code;
    this.status = status;
  }
}

function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function validDate(value) {
  const normalized = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const parsed = new Date(`${normalized}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : '';
}

function dateDaysBefore(value, days = 10) {
  const normalized = validDate(value);
  if (!normalized) return '';
  const date = new Date(`${normalized}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function cleanId(value) {
  return String(value || '').trim();
}

function conditionalFailure(error) {
  return /conditional/i.test(String(error?.message || ''));
}

export async function getEpisodeStudioCreationDirectory({
  listPeopleImpl,
  listStudioBindingsImpl,
} = {}) {
  if (
    typeof listPeopleImpl !== 'function' ||
    typeof listStudioBindingsImpl !== 'function'
  ) {
    throw new TypeError(
      'People and Studio binding loaders are required for Episode Studio creation.'
    );
  }
  const [peopleResult, bindingResult] = await Promise.all([
    listPeopleImpl({ allowStaticFallback: true, includeInactive: true }),
    listStudioBindingsImpl(),
  ]);
  const bindingsByPerson = new Map(
    (bindingResult.bindings || []).map((binding) => [
      String(binding.person_id || ''),
      binding,
    ])
  );
  const people = (peopleResult.people || []).map((person) => {
    const binding = bindingsByPerson.get(String(person.person_id || ''));
    return {
      person_id: String(person.person_id || ''),
      name: String(person.name || ''),
      active: person.active !== false,
      image: String(person.images?.[0] || ''),
      connected: Boolean(binding),
      account_email: String(binding?.account_email || ''),
      capabilities: getPersonStudioCapabilities(person),
    };
  });
  return {
    hosts: people.filter(
      (person) => person.active && person.capabilities.host
    ),
    producers: people.filter(
      (person) => person.active && person.capabilities.producer
    ),
    peopleById: new Map(
      people
        .filter((person) => person.person_id)
        .map((person) => [person.person_id, person])
    ),
  };
}

function mappedPlanHosts(plan = {}, directory = {}) {
  const assignments = Array.isArray(plan.hosts) ? plan.hosts : [];
  if (!assignments.length) {
    throw new EpisodeStudioCreationError(
      'Assign at least one mapped host before creating an Episode Studio.',
      { code: 'MASTERMIND_HOSTS_NOT_MAPPED', status: 409 }
    );
  }
  const ids = [];
  const invalid = [];
  for (const assignment of assignments) {
    const personId = cleanId(
      assignment?.person_id || assignment?.host_person_id
    );
    const person = directory.peopleById?.get(personId);
    if (
      !personId ||
      assignment?.assignment_status === 'unavailable' ||
      !person ||
      person.active === false ||
      person.capabilities?.host !== true
    ) {
      invalid.push(
        String(assignment?.display_name || assignment?.host_display_name || '')
      );
      continue;
    }
    if (!ids.includes(personId)) ids.push(personId);
  }
  if (invalid.length || !ids.length) {
    throw new EpisodeStudioCreationError(
      'Every assigned host must map to a current Host Studio profile.',
      { code: 'MASTERMIND_HOSTS_NOT_MAPPED', status: 409 }
    );
  }
  return ids;
}

function currentProducer(directory, producerPersonId) {
  const cleanProducerId = cleanId(producerPersonId);
  if (!cleanProducerId) return null;
  const producer = directory.peopleById?.get(cleanProducerId);
  if (
    !producer ||
    producer.active === false ||
    producer.capabilities?.producer !== true
  ) {
    throw new EpisodeStudioCreationError(
      'Choose a current producer profile.',
      { code: 'EPISODE_PRODUCER_INVALID' }
    );
  }
  return producer;
}

function assertExistingSource(
  existing,
  planId,
  planRevision,
  {
    sourceAlreadyLinked = false,
    title = '',
    season = '',
    targetReleaseDate = '',
    hostPersonIds = [],
    producerPersonId = '',
  } = {}
) {
  if (existing.source_mastermind_plan_id !== planId) {
    throw new EpisodeStudioCreationError(
      'A different Episode Studio already uses this handoff key.',
      { code: 'EPISODE_HANDOFF_CONFLICT', status: 409 }
    );
  }
  if (
    !sourceAlreadyLinked &&
    Number(existing.source_mastermind_plan_revision) !== planRevision
  ) {
    throw new EpisodeStudioCreationError(
      'The Mastermind plan changed after this Episode Studio was created. Review and reconcile the two records before linking them.',
      { code: 'EPISODE_HANDOFF_SOURCE_CHANGED', status: 409 }
    );
  }
  const existingHosts = [...new Set(existing.host_person_ids || [])]
    .map(cleanId)
    .filter(Boolean)
    .sort();
  const expectedHosts = [...new Set(hostPersonIds)]
    .map(cleanId)
    .filter(Boolean)
    .sort();
  if (
    !sourceAlreadyLinked &&
    (String(existing.title || '').trim() !== title ||
      String(existing.season || '').trim() !== season ||
      String(existing.target_release_date || '').trim() !== targetReleaseDate ||
      cleanId(existing.producer_person_id) !== producerPersonId ||
      JSON.stringify(existingHosts) !== JSON.stringify(expectedHosts))
  ) {
    throw new EpisodeStudioCreationError(
      'This Episode Studio no longer matches the reviewed handoff snapshot. Review and reconcile it before linking.',
      { code: 'EPISODE_HANDOFF_SNAPSHOT_CHANGED', status: 409 }
    );
  }
}

export async function ensureEpisodeStudioFromMastermindPlan(
  {
    plan,
    seasonLabel,
    producerPersonId = '',
    principal,
    creatorBinding,
    directory,
    expectedEpisodeId,
    sourceAlreadyLinked = false,
    now = new Date(),
  },
  {
    getEpisodeStudioImpl,
    saveEpisodeStudioImpl,
    isEpisodeAssetStorageConfiguredImpl = () => false,
    getDefaultStudioProducerEmailImpl = () => '',
  } = {}
) {
  const planId = cleanId(plan?.episode_plan_id || plan?.plan_id).toLowerCase();
  const planRevision = Number(plan?.revision);
  const episodeId = cleanId(expectedEpisodeId);
  if (
    !planId ||
    !episodeId ||
    !Number.isInteger(planRevision) ||
    planRevision < 1
  ) {
    throw new EpisodeStudioCreationError(
      'The Episode Studio handoff identifiers are missing.',
      { code: 'EPISODE_HANDOFF_INPUT_INVALID' }
    );
  }
  const planStatus = String(plan.status || '');
  if (
    planStatus !== 'ready' &&
    !(sourceAlreadyLinked && planStatus === 'scheduled')
  ) {
    throw new EpisodeStudioCreationError(
      'Only a Ready episode plan can create an Episode Studio.',
      { code: 'MASTERMIND_PLAN_NOT_READY', status: 409 }
    );
  }
  const targetReleaseDate = validDate(plan.target_air_date);
  if (!targetReleaseDate) {
    throw new EpisodeStudioCreationError(
      'Add a target air date before creating an Episode Studio.',
      { code: 'MASTERMIND_PLAN_DATE_REQUIRED', status: 409 }
    );
  }
  const cleanSeasonLabel = String(seasonLabel || '').trim();
  if (!cleanSeasonLabel) {
    throw new EpisodeStudioCreationError(
      'The plan must belong to a current planning season.',
      { code: 'MASTERMIND_SEASON_REQUIRED', status: 409 }
    );
  }
  const hostPersonIds = mappedPlanHosts(plan, directory);
  const producer = currentProducer(directory, producerPersonId);
  const snapshot = {
    sourceAlreadyLinked,
    title: String(plan.working_title || '').trim(),
    season: cleanSeasonLabel,
    targetReleaseDate,
    hostPersonIds,
    producerPersonId: cleanId(producer?.person_id),
  };

  if (
    typeof getEpisodeStudioImpl !== 'function' ||
    typeof saveEpisodeStudioImpl !== 'function'
  ) {
    throw new TypeError(
      'Episode Studio read and write dependencies are required.'
    );
  }

  const loaded = await getEpisodeStudioImpl(episodeId);
  if (loaded.configured === false) {
    throw new EpisodeStudioCreationError(
      'Episode Studio storage is not configured.',
      { code: 'EPISODE_STUDIO_NOT_CONFIGURED', status: 503 }
    );
  }
  if (loaded.episode) {
    assertExistingSource(loaded.episode, planId, planRevision, {
      ...snapshot,
    });
    return {
      episode: loaded.episode,
      created: false,
      idempotent: true,
    };
  }
  if (sourceAlreadyLinked) {
    throw new EpisodeStudioCreationError(
      'The linked Episode Studio could not be found. Repair the planning link before retrying.',
      { code: 'EPISODE_HANDOFF_LINK_TARGET_MISSING', status: 409 }
    );
  }

  const timestamp =
    now instanceof Date && !Number.isNaN(now.getTime())
      ? now.toISOString()
      : new Date().toISOString();
  const producerEmail =
    validEmail(producer?.account_email) ||
    validEmail(principal?.username) ||
    validEmail(getDefaultStudioProducerEmailImpl());
  const creatorPersonId = cleanId(creatorBinding?.person_id);
  const creator = directory.peopleById?.get(creatorPersonId);
  const episodeValue = {
    episode_id: episodeId,
    source_mastermind_plan_id: planId,
    source_mastermind_plan_revision: planRevision,
    title: String(plan.working_title || '').trim(),
    season: cleanSeasonLabel,
    target_release_date: targetReleaseDate,
    due_date: dateDaysBefore(targetReleaseDate, 10),
    recording_date: '',
    recording_time: '',
    recording_time_zone: '',
    recording_duration_minutes: '',
    recording_location: '',
    host_person_ids: hostPersonIds,
    producer_person_id: cleanId(producer?.person_id),
    producer_email: producerEmail,
    producer_feedback: '',
    producer_directions: '',
    canonical_assets_required: isEpisodeAssetStorageConfiguredImpl(),
    status: 'planning',
    delivery_health: 'on_track',
    delivery_health_updated_at: '',
    delivery_health_updated_by_person_id: '',
    delivery_health_updated_by_name: '',
    delivery_health_updated_by_role: '',
    deliverables: createDefaultEpisodeDeliverables(),
    production_tasks: createDefaultEpisodeProductionTasks(targetReleaseDate),
    production_workflow_updated_at: timestamp,
    production_workflow_updated_by_person_id: creatorPersonId,
    production_workflow_updated_by_name:
      creator?.name ||
      String(principal?.displayName || '').trim() ||
      String(principal?.username || '').trim(),
    created_by_person_id: creatorPersonId,
    created_by: String(principal?.username || '').trim(),
    created_at: timestamp,
    updated_at: timestamp,
  };

  try {
    const saved = await saveEpisodeStudioImpl(episodeValue, { create: true });
    return { episode: saved.episode, created: true, idempotent: false };
  } catch (error) {
    if (!conditionalFailure(error)) throw error;
    const raced = await getEpisodeStudioImpl(episodeId);
    if (!raced.episode) throw error;
    assertExistingSource(raced.episode, planId, planRevision, {
      ...snapshot,
    });
    return { episode: raced.episode, created: false, idempotent: true };
  }
}
