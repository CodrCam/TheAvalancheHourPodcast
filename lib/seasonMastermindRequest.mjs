const PLAN_STATUSES = new Set([
  'idea',
  'researching',
  'ready',
  'scheduled',
  'recording',
  'published',
  'archived',
]);
const EPISODE_TYPES = new Set([
  'regular',
  'slabs_and_sluffs',
  'special',
]);
const DATED_PLAN_STATUSES = new Set([
  'scheduled',
  'recording',
  'published',
]);
const SAFE_ID = /^[A-Za-z0-9._:@-]+$/;
const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function text(value, label, maxLength, { required = false } = {}) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (required && !normalized) {
    throw new MastermindInputError(`${label} is required.`);
  }
  if (normalized.length > maxLength) {
    throw new MastermindInputError(
      `${label} must be ${maxLength} characters or fewer.`
    );
  }
  return normalized;
}

function id(value, label, { required = false, uuid = false } = {}) {
  const normalized = String(value || '').trim();
  if (required && !normalized) {
    throw new MastermindInputError(`${label} is required.`);
  }
  if (!normalized) return '';
  if (
    normalized.length > 180 ||
    !(uuid ? UUID.test(normalized) : SAFE_ID.test(normalized))
  ) {
    throw new MastermindInputError(`${label} has an invalid format.`);
  }
  return normalized;
}

function date(value, label, { required = false } = {}) {
  const normalized = String(value || '').trim();
  if (required && !normalized) {
    throw new MastermindInputError(`${label} is required.`);
  }
  if (!normalized) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new MastermindInputError(`${label} must be a calendar date.`);
  }
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new MastermindInputError(`${label} must be a valid calendar date.`);
  }
  return normalized;
}

function choice(value, allowed, label, fallback = '') {
  const normalized = String(value || '').trim();
  if (!normalized) return fallback;
  if (!allowed.has(normalized)) {
    throw new MastermindInputError(`Choose a valid ${label}.`);
  }
  return normalized;
}

function revision(value) {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new MastermindInputError('The plan revision is invalid.');
  }
  return parsed;
}

function positiveInteger(value, label, { fallback, maximum }) {
  if (value === undefined || value === null || value === '') return fallback;
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1 || parsed > maximum) {
    throw new MastermindInputError(
      `${label} must be an integer from 1 to ${maximum}.`
    );
  }
  return parsed;
}

function directoryMap(directory = []) {
  return new Map(
    (Array.isArray(directory) ? directory : [])
      .filter((person) => person?.person_id && person?.name)
      .map((person) => [String(person.person_id), person])
  );
}

function normalizeHosts(hostPersonIds, directory) {
  const people = directoryMap(directory);
  const seen = new Set();
  const hosts = [];
  for (const value of Array.isArray(hostPersonIds) ? hostPersonIds : []) {
    const personId = id(value, 'Host profile');
    if (!personId || seen.has(personId)) continue;
    const person = people.get(personId);
    if (!person) {
      throw new MastermindInputError('Choose a current host profile.');
    }
    seen.add(personId);
    hosts.push({
      person_id: personId,
      display_name: text(person.name, 'Host name', 180, { required: true }),
    });
    if (hosts.length > 20) {
      throw new MastermindInputError(
        'An episode plan can have at most 20 hosts.'
      );
    }
  }
  return hosts;
}

function planFields(
  input = {},
  directory = [],
  { includeEmptyHosts = false } = {}
) {
  const ownerPersonId = id(input.owner_person_id, 'Owner profile');
  if (ownerPersonId && !directoryMap(directory).has(ownerPersonId)) {
    throw new MastermindInputError('Choose a current owner profile.');
  }
  const status = choice(input.status, PLAN_STATUSES, 'plan status', 'idea');
  const targetAirDate = date(input.target_air_date, 'Target air date') || null;
  if (DATED_PLAN_STATUSES.has(status) && !targetAirDate) {
    throw new MastermindInputError(
      'A target air date is required once a plan is Scheduled.'
    );
  }
  const normalized = {
    season_id: id(input.season_id, 'Season', { required: true, uuid: true }),
    working_title: text(input.working_title, 'Working title', 180, {
      required: true,
    }),
    premise: text(input.premise, 'Premise', 6000, { required: true }),
    listener_takeaway: text(
      input.listener_takeaway,
      'Listener takeaway',
      2400
    ),
    episode_type: choice(
      input.episode_type,
      EPISODE_TYPES,
      'episode type',
      'regular'
    ),
    status,
    target_air_date: targetAirDate,
    owner_person_id: ownerPersonId || null,
    source_intake_item_id:
      id(input.source_intake_item_id, 'Source follow-up') || null,
  };
  if (
    includeEmptyHosts ||
    Object.prototype.hasOwnProperty.call(input, 'host_person_ids')
  ) {
    normalized.hosts = normalizeHosts(input.host_person_ids, directory);
  }
  return normalized;
}

export class MastermindInputError extends Error {
  constructor(message) {
    super(message);
    this.name = 'MastermindInputError';
    this.code = 'MASTERMIND_INPUT_INVALID';
    this.status = 400;
  }
}

export function normalizeMastermindListInput(query = {}, actor = {}) {
  const canManage = actor.can_manage === true;
  const personId = id(actor.person_id, 'Viewer profile');
  if (!canManage && !personId) {
    throw new MastermindInputError(
      'Your account is not connected to a Studio profile.'
    );
  }

  const normalized = {
    include_archived: canManage && String(query.include_archived) === 'true',
    page: positiveInteger(query.page, 'Page', {
      fallback: 1,
      maximum: 1_000,
    }),
    page_size: positiveInteger(query.page_size, 'Page size', {
      fallback: 50,
      maximum: 50,
    }),
  };
  if (query.season_id) {
    normalized.season_id = id(query.season_id, 'Season', { uuid: true });
  }
  if (query.status) {
    normalized.status = choice(query.status, PLAN_STATUSES, 'plan status');
  }
  if (query.episode_type) {
    normalized.episode_type = choice(
      query.episode_type,
      EPISODE_TYPES,
      'episode type'
    );
  }
  if (query.host_person_id) {
    const hostPersonId = id(query.host_person_id, 'Host profile');
    if (canManage) normalized.host_person_id = hostPersonId;
  }
  if (query.from_date) {
    normalized.from_date = date(query.from_date, 'Start date');
  }
  if (query.to_date) {
    normalized.to_date = date(query.to_date, 'End date');
  }
  if (
    normalized.from_date &&
    normalized.to_date &&
    normalized.from_date > normalized.to_date
  ) {
    throw new MastermindInputError(
      'Start date must be on or before end date.'
    );
  }
  const search = text(query.query, 'Search', 120);
  if (search) normalized.query = search;
  return normalized;
}

export function normalizeMastermindMutation(
  body = {},
  { directory = [] } = {}
) {
  const action = String(body.action || '').trim();
  const input = body.input && typeof body.input === 'object' ? body.input : {};

  if (['create_season', 'update_season'].includes(action)) {
    const startsOn = date(input.starts_on, 'Season start', { required: true });
    const endsOn = date(input.ends_on, 'Season end', { required: true });
    if (endsOn < startsOn) {
      throw new MastermindInputError(
        'Season end must be on or after the start date.'
      );
    }
    const normalized = {
      label: text(input.label, 'Season label', 80, { required: true }),
      starts_on: startsOn,
      ends_on: endsOn,
      planning_goal: text(input.planning_goal, 'Planning goal', 2400),
    };
    return {
      operation: action,
      input:
        action === 'update_season'
          ? {
              season_id: id(input.season_id, 'Season', {
                required: true,
                uuid: true,
              }),
              revision: revision(input.revision),
              ...normalized,
            }
          : normalized,
    };
  }

  if (action === 'create_plan') {
    return { operation: action, input: planFields(input, directory) };
  }

  if (action === 'update_plan') {
    const fields = planFields(input, directory);
    if (!fields.owner_person_id) delete fields.owner_person_id;
    if (!fields.source_intake_item_id) delete fields.source_intake_item_id;
    return {
      operation: action,
      input: {
        episode_plan_id: id(input.episode_plan_id, 'Episode plan', {
          required: true,
          uuid: true,
        }),
        revision: revision(input.revision),
        ...fields,
      },
    };
  }

  throw new MastermindInputError('Choose a valid Season Mastermind action.');
}

export const SEASON_MASTERMIND_PLAN_STATUSES = Object.freeze([
  ...PLAN_STATUSES,
]);
export const SEASON_MASTERMIND_EPISODE_TYPES = Object.freeze([
  ...EPISODE_TYPES,
]);
