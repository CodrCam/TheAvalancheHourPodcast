import crypto from 'node:crypto';

const UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const OPAQUE_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+=#-]{0,179}$/;
const EPISODE_TYPES = new Set([
  'regular',
  'slabs_and_sluffs',
  'special',
]);
const DEFAULT_LOOKUP_PAGE_LIMIT = 10;
const RETRYABLE_LINK_CODES = new Set([
  'database_busy',
  'database_unavailable',
  'mastermind_timeout',
  'mastermind_unavailable',
  'mastermind_waking',
  'revision_conflict',
]);

export class SeasonMastermindHandoffError extends Error {
  constructor(
    message,
    { code = 'MASTERMIND_HANDOFF_FAILED', status = 400 } = {}
  ) {
    super(message);
    this.name = 'SeasonMastermindHandoffError';
    this.code = code;
    this.status = status;
  }
}

function cleanText(value, label, maxLength, { required = false } = {}) {
  const normalized = String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim();
  if (required && !normalized) {
    throw new SeasonMastermindHandoffError(`${label} is required.`, {
      code: 'MASTERMIND_HANDOFF_INPUT_INVALID',
    });
  }
  if (normalized.length > maxLength) {
    throw new SeasonMastermindHandoffError(
      `${label} must be ${maxLength} characters or fewer.`,
      { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
    );
  }
  return normalized;
}

function opaqueId(value, label, { required = false } = {}) {
  const normalized = String(value || '').trim();
  if (required && !normalized) {
    throw new SeasonMastermindHandoffError(`${label} is required.`, {
      code: 'MASTERMIND_HANDOFF_INPUT_INVALID',
    });
  }
  if (normalized && !OPAQUE_ID.test(normalized)) {
    throw new SeasonMastermindHandoffError(`${label} has an invalid format.`, {
      code: 'MASTERMIND_HANDOFF_INPUT_INVALID',
    });
  }
  return normalized;
}

function uuid(value, label) {
  const normalized = String(value || '').trim().toLowerCase();
  if (!UUID.test(normalized)) {
    throw new SeasonMastermindHandoffError(`${label} has an invalid format.`, {
      code: 'MASTERMIND_HANDOFF_INPUT_INVALID',
    });
  }
  return normalized;
}

function calendarDate(value, label) {
  const normalized = String(value || '').trim();
  if (!normalized) return null;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    throw new SeasonMastermindHandoffError(
      `${label} must be a calendar date.`,
      { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
    );
  }
  const parsed = new Date(`${normalized}T12:00:00Z`);
  if (
    Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== normalized
  ) {
    throw new SeasonMastermindHandoffError(
      `${label} must be a valid calendar date.`,
      { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
    );
  }
  return normalized;
}

function stableUuid(namespace, value) {
  const digest = crypto
    .createHash('sha256')
    .update(`${namespace}\0${value}`, 'utf8')
    .digest();
  const bytes = Buffer.from(digest.subarray(0, 16));
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export function mastermindPlanIdForIntake(itemId) {
  const sourceId = opaqueId(itemId, 'Team Follow-up', { required: true });
  return stableUuid('the-avalanche-hour:season-mastermind:intake', sourceId);
}

export function episodeStudioIdForMastermindPlan(episodePlanId) {
  return `mastermind-${uuid(episodePlanId, 'Episode plan')}`;
}

export function unwrapSeasonMastermindResult(result = {}) {
  if (!result || typeof result !== 'object') {
    throw new SeasonMastermindHandoffError(
      'Season Mastermind returned an invalid response.',
      { code: 'MASTERMIND_BAD_RESPONSE', status: 502 }
    );
  }
  return result.data && typeof result.data === 'object'
    ? result.data
    : result;
}

function activeHostDirectory(directory = []) {
  return new Map(
    (Array.isArray(directory) ? directory : [])
      .filter(
        (person) =>
          person?.active !== false &&
          person?.person_id &&
          person?.name &&
          (person.capabilities?.host !== false)
      )
      .map((person) => [String(person.person_id), person])
  );
}

function reviewedHosts(hostPersonIds, directory = []) {
  const people = activeHostDirectory(directory);
  const hosts = [];
  const seen = new Set();
  for (const value of Array.isArray(hostPersonIds) ? hostPersonIds : []) {
    const personId = opaqueId(value, 'Host profile');
    if (!personId || seen.has(personId)) continue;
    const person = people.get(personId);
    if (!person) {
      throw new SeasonMastermindHandoffError(
        'Choose only current host profiles.',
        { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
      );
    }
    seen.add(personId);
    hosts.push({
      person_id: personId,
      display_name: cleanText(person.name, 'Host name', 180, {
        required: true,
      }),
    });
    if (hosts.length > 20) {
      throw new SeasonMastermindHandoffError(
        'Choose at most 20 hosts.',
        { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
      );
    }
  }
  return hosts;
}

export function normalizeIntakeMastermindHandoff(
  sourceItem = {},
  approved = {},
  { directory = [] } = {}
) {
  const sourceId = opaqueId(sourceItem.item_id, 'Team Follow-up', {
    required: true,
  });
  const seasonId = uuid(approved.season_id, 'Season');
  const episodeType = String(approved.episode_type || 'regular').trim();
  if (!EPISODE_TYPES.has(episodeType)) {
    throw new SeasonMastermindHandoffError(
      'Choose a valid episode type.',
      { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
    );
  }

  const ownerPersonId = opaqueId(approved.owner_person_id, 'Owner profile');
  if (ownerPersonId && !activeHostDirectory(directory).has(ownerPersonId)) {
    throw new SeasonMastermindHandoffError(
      'Choose a current host profile as the plan owner.',
      { code: 'MASTERMIND_HANDOFF_INPUT_INVALID' }
    );
  }

  return {
    episode_plan_id: mastermindPlanIdForIntake(sourceId),
    season_id: seasonId,
    working_title: cleanText(
      approved.working_title,
      'Working title',
      180,
      { required: true }
    ),
    premise: cleanText(approved.premise, 'Premise', 6000, {
      required: true,
    }),
    listener_takeaway: cleanText(
      approved.listener_takeaway,
      'Listener takeaway',
      2400
    ),
    episode_type: episodeType,
    status: 'researching',
    target_air_date: calendarDate(
      approved.target_air_date,
      'Target air date'
    ),
    source_intake_item_id: sourceId,
    owner_person_id: ownerPersonId || null,
    hosts: reviewedHosts(approved.host_person_ids, directory),
  };
}

export async function handoffStudioIntakeToMastermind(
  { sourceItem, approved, actor, directory = [] },
  { invokeMastermind }
) {
  if (actor?.can_manage !== true || !opaqueId(actor.person_id, 'Manager profile')) {
    throw new SeasonMastermindHandoffError(
      'Manager permission and a connected Studio profile are required.',
      { code: 'MASTERMIND_HANDOFF_FORBIDDEN', status: 403 }
    );
  }
  if (typeof invokeMastermind !== 'function') {
    throw new TypeError('invokeMastermind is required');
  }
  const input = normalizeIntakeMastermindHandoff(sourceItem, approved, {
    directory,
  });
  const response = await invokeMastermind({
    operation: 'create_plan',
    actor,
    input,
  });
  return {
    ...unwrapSeasonMastermindResult(response),
    requested_plan_id: input.episode_plan_id,
    source_intake_item_id: input.source_intake_item_id,
  };
}

export async function findManagerMastermindPlan(
  { episodePlanId, seasonId, actor },
  { invokeMastermind, maxPages = DEFAULT_LOOKUP_PAGE_LIMIT }
) {
  const planId = uuid(episodePlanId, 'Episode plan');
  const selectedSeasonId = uuid(seasonId, 'Season');
  if (actor?.can_manage !== true || !opaqueId(actor.person_id, 'Manager profile')) {
    throw new SeasonMastermindHandoffError(
      'Manager permission and a connected Studio profile are required.',
      { code: 'MASTERMIND_HANDOFF_FORBIDDEN', status: 403 }
    );
  }
  if (typeof invokeMastermind !== 'function') {
    throw new TypeError('invokeMastermind is required');
  }
  const boundedPages = Math.min(
    Math.max(Number.parseInt(maxPages, 10) || 1, 1),
    DEFAULT_LOOKUP_PAGE_LIMIT
  );

  for (let page = 1; page <= boundedPages; page += 1) {
    const response = await invokeMastermind({
      operation: 'list_mastermind',
      actor,
      input: {
        season_id: selectedSeasonId,
        include_archived: true,
        page,
        page_size: 50,
      },
    });
    const data = unwrapSeasonMastermindResult(response);
    const plan = (Array.isArray(data.plans) ? data.plans : []).find(
      (candidate) =>
        String(candidate?.episode_plan_id || candidate?.plan_id || '').toLowerCase() ===
        planId
    );
    if (plan) {
      const season = (Array.isArray(data.seasons) ? data.seasons : []).find(
        (candidate) =>
          String(candidate?.season_id || '').toLowerCase() === selectedSeasonId
      );
      return { plan, season: season || null };
    }
    if (data.page?.has_more !== true) {
      throw new SeasonMastermindHandoffError('Episode plan was not found.', {
        code: 'MASTERMIND_PLAN_NOT_FOUND',
        status: 404,
      });
    }
  }

  throw new SeasonMastermindHandoffError(
    'The selected season is too large for a bounded handoff lookup.',
    { code: 'MASTERMIND_LOOKUP_BOUNDED', status: 409 }
  );
}

function assertReadyPlan(plan = {}, { sourceAlreadyLinked = false } = {}) {
  const status = String(plan.status || '');
  if (
    status !== 'ready' &&
    !(sourceAlreadyLinked && status === 'scheduled')
  ) {
    throw new SeasonMastermindHandoffError(
      'Only a Ready episode plan can create an Episode Studio.',
      { code: 'MASTERMIND_PLAN_NOT_READY', status: 409 }
    );
  }
  if (!calendarDate(plan.target_air_date, 'Target air date')) {
    throw new SeasonMastermindHandoffError(
      'Add a target air date before creating an Episode Studio.',
      { code: 'MASTERMIND_PLAN_DATE_REQUIRED', status: 409 }
    );
  }
}

function safeFailureCode(error) {
  const code = String(error?.code || '').trim();
  return OPAQUE_ID.test(code) ? code : 'MASTERMIND_LINK_FAILED';
}

function retryableLinkFailure(error) {
  const code = String(error?.code || '').trim().toLowerCase();
  if (RETRYABLE_LINK_CODES.has(code)) return true;
  const status = Number(error?.status);
  return status === 429 || status === 500 || status === 502 || status === 504;
}

export async function handoffReadyPlanToEpisodeStudio(
  {
    episodePlanId,
    seasonId,
    producerPersonId = '',
    actor,
    principal,
    creatorBinding,
    directory,
  },
  {
    invokeMastermind,
    ensureEpisodeStudio,
    publishNotifications = async () => {},
    maxPages = DEFAULT_LOOKUP_PAGE_LIMIT,
  }
) {
  if (typeof ensureEpisodeStudio !== 'function') {
    throw new TypeError('ensureEpisodeStudio is required');
  }
  const located = await findManagerMastermindPlan(
    { episodePlanId, seasonId, actor },
    { invokeMastermind, maxPages }
  );
  const { plan, season } = located;
  const planId = uuid(
    plan.episode_plan_id || plan.plan_id,
    'Episode plan'
  );
  const expectedEpisodeId = episodeStudioIdForMastermindPlan(planId);
  const currentLink = String(plan.linked_episode_id || '').trim();
  if (currentLink && currentLink !== expectedEpisodeId) {
    throw new SeasonMastermindHandoffError(
      'This plan is already linked to a different Episode Studio.',
      { code: 'MASTERMIND_EPISODE_LINK_CONFLICT', status: 409 }
    );
  }
  const sourceAlreadyLinked = currentLink === expectedEpisodeId;
  assertReadyPlan(plan, { sourceAlreadyLinked });

  const episodeResult = await ensureEpisodeStudio({
    plan,
    seasonLabel: season?.label || '',
    producerPersonId,
    principal,
    creatorBinding,
    directory,
    expectedEpisodeId,
    sourceAlreadyLinked,
  });

  let notificationFailed = false;
  if (episodeResult.created) {
    try {
      await publishNotifications({
        previousEpisode: null,
        episode: episodeResult.episode,
        action: 'create',
        actorPersonId: actor.person_id,
        actorName:
          String(principal?.displayName || '').trim() ||
          String(principal?.username || '').trim() ||
          'Studio team',
      });
    } catch {
      notificationFailed = true;
    }
  }

  try {
    const linked = unwrapSeasonMastermindResult(
      await invokeMastermind({
        operation: 'link_episode',
        actor,
        input: {
          episode_plan_id: planId,
          linked_episode_id: episodeResult.episode.episode_id,
          revision: Number(plan.revision),
        },
      })
    );
    return {
      outcome: 'linked',
      episode: episodeResult.episode,
      episode_created: episodeResult.created === true,
      episode_idempotent: episodeResult.idempotent === true,
      plan: linked.plan || plan,
      link_idempotent: linked.idempotent === true || currentLink === expectedEpisodeId,
      notification_failed: notificationFailed,
    };
  } catch (error) {
    return {
      outcome: 'link_pending',
      episode: episodeResult.episode,
      episode_created: episodeResult.created === true,
      episode_idempotent: episodeResult.idempotent === true,
      plan,
      link_error_code: safeFailureCode(error),
      link_retryable: retryableLinkFailure(error),
      notification_failed: notificationFailed,
    };
  }
}
