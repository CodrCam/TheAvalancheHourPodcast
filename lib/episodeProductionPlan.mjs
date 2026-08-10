import {
  EPISODE_PHOTO_DELIVERABLE_ID,
  isEpisodePhotoSelectionConfirmed,
} from './episodePhotoSelection.mjs';
import { getEpisodeMicKitPlanCompletion } from './episodeMicKitPresentation.mjs';

export const EPISODE_PRODUCTION_TASK_STATUSES = [
  'not_started',
  'in_progress',
  'complete',
  'waived',
];

export const EPISODE_PRODUCTION_TASK_OWNER_TYPES = [
  'hosts',
  'producer',
  'person',
  'hosts_and_producer',
];

export const EPISODE_PRODUCTION_TASK_KINDS = [
  'standard',
  'intro',
  'proof',
  'bundle',
];

export const EPISODE_PRODUCTION_TASK_PHASES = [
  'host_preparation',
  'producer_review',
  'publishing',
  'release_coordination',
];

export const EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION = 4;
export const EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION = 4;
export const INTRO_RECORDING_LATEST_DAYS_BEFORE_AIR = 17;
export const PRODUCER_PROOF_DELIVERABLE_ID = 'producer-proof-audio';
export const MICROPHONE_PLAN_DELIVERABLE_ID = 'mic-kit-plan';
export const MICROPHONE_PLAN_TASK_ID = 'microphone-plan-confirmed';
export const GUEST_RECORDING_PLAN_TASK_ID = 'guest-recording-plan-reviewed';
export const PHOTO_SELECTION_PRODUCTION_TASK_ID = 'show-notes-brief';

const LEGACY_NAMED_OWNER_BY_TASK_ID = Object.freeze({
  'producer-proof-upload': 'angie-link',
  'publishing-package': 'sierra-bishop',
  'promotion-scheduled': 'sierra-bishop',
});
const EARLIER_DEFAULT_DEADLINE_BY_TASK_ID = Object.freeze({
  'guest-prep-sent': { from: 28, to: 35 },
  'guest-prep-received': { from: 21, to: 28 },
  [MICROPHONE_PLAN_TASK_ID]: { from: 21, to: 28 },
  [GUEST_RECORDING_PLAN_TASK_ID]: { from: 21, to: 28 },
  'edit-package-delivered': { from: 14, to: 21 },
  'intro-ready': { from: 14, to: 21 },
  'show-notes-brief': { from: 10, to: 21 },
  'producer-proof-upload': { from: 9, to: 16 },
  'proof-listen-approval': { from: 8, to: 15 },
  'publishing-package': { from: 7, to: 21 },
  'promotion-scheduled': { from: 7, to: 14 },
  'guest-assets-shared': { from: 7, to: 14 },
});
const EARLIER_DEFAULT_DEPENDENCIES_BY_TASK_ID = Object.freeze({
  [MICROPHONE_PLAN_TASK_ID]: Object.freeze(['guest-prep-sent']),
  'edit-package-delivered': Object.freeze([
    'guest-prep-received',
    GUEST_RECORDING_PLAN_TASK_ID,
  ]),
  'producer-proof-upload': Object.freeze([
    'edit-package-delivered',
    'intro-ready',
  ]),
  'publishing-package': Object.freeze([
    'proof-listen-approval',
    'show-notes-brief',
  ]),
  'promotion-scheduled': Object.freeze(['publishing-package']),
  'guest-assets-shared': Object.freeze(['publishing-package']),
});
const EARLIER_DEFAULT_SORT_ORDER_BY_TASK_ID = Object.freeze({
  'producer-proof-upload': 60,
  'proof-listen-approval': 70,
  'publishing-package': 80,
});
const LEGACY_NAMED_COPY_BY_TASK_ID = Object.freeze({
  [MICROPHONE_PLAN_TASK_ID]: Object.freeze({
    labels: Object.freeze(['Confirm the host microphone plans']),
    descriptions: Object.freeze([
      'Each assigned host confirms an active mic-kit request, identifies their own tested microphone and headphones, or records that no separate kit is needed.',
    ]),
  }),
  'intro-ready': Object.freeze({
    labels: Object.freeze([
      'Record the intro or schedule it with Angie',
      'Host either records the intro or schedules time with Angie to record',
    ]),
    descriptions: Object.freeze([
      'Either upload a finished intro or send the script and record a meeting date with Angie. The recording session must occur no later than seven days before air.',
      'Either upload a finished intro or send the script and record a meeting date with Angie. The recording session must occur no later than ten days before air.',
      'Either upload a finished intro or send the script and record a meeting date with the assigned producer. The recording session must occur no later than ten days before air.',
      'Either upload a finished intro or send the script and record a meeting date with the assigned producer. The recording session must occur no later than seventeen days before air.',
    ]),
  }),
  'show-notes-brief': Object.freeze({
    labels: Object.freeze([
      'Send Sierra or Angie the show-notes request',
      'Host sends Sierra/Angie shownotes requests',
      'Deliver the show-notes and promotion brief',
    ]),
    descriptions: Object.freeze([
      'Give Sierra and Angie the episode summary, takeaways, guest links and handles, image guidance, credits, and anything that must not be published.',
      'Provide the episode summary, takeaways, guest links and handles, image guidance, credits, and anything that must not be published.',
      'Provide the episode summary, takeaways, guest links and handles, credits, and anything that must not be published. Choose, order, and confirm exactly three final images with any crop or editing instructions.',
      'Provide one source brief with the episode summary, title ideas, takeaways, guest links and handles, suggested excerpts or timestamps, and any no-tag, privacy, or do-not-publish instructions. Upload and confirm the final image set in Photos and artwork.',
    ]),
  }),
  'edit-package-delivered': Object.freeze({
    labels: Object.freeze(['Deliver the recording and edit package']),
    descriptions: Object.freeze([
      'Upload the conversation audio and provide all requested edits or timestamped edit notes.',
    ]),
  }),
  'producer-proof-upload': Object.freeze({
    labels: Object.freeze([
      'Angie adds the mid-roll and outro',
      'Angie adds mid-roll + outro and sends the final audio edit',
    ]),
    descriptions: Object.freeze([
      'Angie adds the mid-roll and outro, then uploads the private final proof/master for the host to download and review.',
    ]),
  }),
  'publishing-package': Object.freeze({
    labels: Object.freeze([
      'Sierra or Angie drafts the publishing package',
      'Sierra/Angie draft graphic, shownotes and schedule on Spotify',
      'Finish the publishing package',
    ]),
    descriptions: Object.freeze([
      'Sierra or Angie completes the episode graphic and final show notes, then schedules the approved episode on Spotify.',
      'Complete the episode graphic and final show notes, then schedule the approved episode on Spotify.',
    ]),
  }),
  'promotion-scheduled': Object.freeze({
    labels: Object.freeze([
      'Sierra or Angie schedules promotion',
      'Sierra/Angie schedule content',
      'Schedule episode promotion',
    ]),
    descriptions: Object.freeze([
      'Sierra or Angie schedules the approved social media, email, and blog promotion.',
      'Schedule the approved social media, email, and blog promotion.',
    ]),
  }),
});
const MAX_PRODUCTION_TASKS = 50;
const MAX_TASK_SUBTASKS = 20;
const MAX_TASK_ASSIGNEES = 8;
const MAX_TASK_DEPENDENCIES = 20;

const PUBLISHING_SUBTASKS = [
  { id: 'graphic', label: 'Episode graphic', required: true },
  { id: 'show-notes', label: 'Final show notes', required: true },
];

const PROMOTION_SUBTASKS = [
  { id: 'spotify', label: 'Spotify episode scheduled', required: true },
  { id: 'social-media', label: 'Social media scheduled', required: true },
  { id: 'email', label: 'Email scheduled', required: true },
  { id: 'blog', label: 'Blog scheduled', required: true },
];

/**
 * The immutable workflow definition. Runtime fields such as due_date and
 * completion audit values are added by createDefaultEpisodeProductionTasks.
 */
export const DEFAULT_EPISODE_PRODUCTION_TASKS = [
  {
    task_id: 'guest-prep-sent',
    label: 'Send the guest prep form',
    description:
      'The host sends the guest the prep form early enough for it to be completed before editing begins.',
    phase: 'host_preparation',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 35,
    required: true,
    dependencies: [],
    kind: 'standard',
    linked_deliverable_ids: [],
    subtasks: [],
    sort_order: 10,
  },
  {
    task_id: 'guest-prep-received',
    label: 'Receive the completed guest prep form',
    description:
      'Confirm that the guest prep form is complete. Editing must not begin until this gate is complete.',
    phase: 'host_preparation',
    owner_type: 'hosts_and_producer',
    assigned_person_ids: [],
    days_before_air: 28,
    required: true,
    dependencies: ['guest-prep-sent'],
    kind: 'standard',
    linked_deliverable_ids: [],
    subtasks: [],
    sort_order: 20,
  },
  {
    task_id: MICROPHONE_PLAN_TASK_ID,
    label: 'Confirm the episode microphone plans',
    description:
      'Each assigned host confirms an active mic-kit request, identifies tested equipment, or records that no separate kit is needed. When a guest questionnaire supplies a guest recording plan, that plan must also be ready.',
    phase: 'host_preparation',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 28,
    required: true,
    dependencies: ['guest-prep-received'],
    kind: 'standard',
    linked_deliverable_ids: [MICROPHONE_PLAN_DELIVERABLE_ID],
    subtasks: [],
    sort_order: 25,
  },
  {
    task_id: GUEST_RECORDING_PLAN_TASK_ID,
    label: 'Review the guest recording setup',
    description:
      'The producer reviews the guest questionnaire for internet, microphone, headphones, recording-space readiness, and any guest microphone-kit shipping request before editing begins.',
    phase: 'host_preparation',
    owner_type: 'producer',
    assigned_person_ids: [],
    days_before_air: 28,
    required: true,
    dependencies: ['guest-prep-received'],
    kind: 'standard',
    linked_deliverable_ids: [],
    subtasks: [],
    sort_order: 28,
  },
  {
    task_id: 'edit-package-delivered',
    label: 'Complete the interview and upload the raw tracks',
    description:
      'Schedule and complete the interview, then upload every final local recording track so production can begin.',
    phase: 'host_preparation',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 21,
    required: true,
    dependencies: [
      'guest-prep-received',
      MICROPHONE_PLAN_TASK_ID,
      GUEST_RECORDING_PLAN_TASK_ID,
    ],
    kind: 'standard',
    linked_deliverable_ids: ['recording-files'],
    subtasks: [],
    sort_order: 30,
  },
  {
    task_id: 'intro-ready',
    label: 'Record the intro or schedule it with the producer',
    description:
      'Either upload the finished intro with the raw recording tracks, or send the script and record a meeting date with the assigned producer. The recording session must occur no later than seventeen days before air.',
    phase: 'host_preparation',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 21,
    required: true,
    dependencies: ['edit-package-delivered'],
    kind: 'intro',
    linked_deliverable_ids: ['recording-files'],
    subtasks: [],
    sort_order: 40,
  },
  {
    task_id: 'show-notes-brief',
    label: 'Deliver edit notes, show-notes, and the promotion brief',
    description:
      'Submit the timestamped edit notes and one source brief with the episode summary, title ideas, takeaways, guest links and handles, suggested excerpts or timestamps, and any no-tag, privacy, or do-not-publish instructions. Upload and confirm the final image set in Photos and artwork.',
    phase: 'host_preparation',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 21,
    required: true,
    dependencies: ['edit-package-delivered'],
    kind: 'standard',
    linked_deliverable_ids: [
      'edit-notes',
      'show-notes',
      'photos',
      'credits',
    ],
    subtasks: [],
    sort_order: 50,
  },
  {
    task_id: 'producer-proof-upload',
    label: 'Upload the private final proof',
    description:
      'The producer adds the mid-roll and outro, then uploads the private final proof/master for the host to download and review.',
    phase: 'producer_review',
    owner_type: 'producer',
    assigned_person_ids: [],
    days_before_air: 16,
    required: true,
    dependencies: ['intro-ready', 'show-notes-brief'],
    kind: 'proof',
    linked_deliverable_ids: [PRODUCER_PROOF_DELIVERABLE_ID],
    subtasks: [],
    sort_order: 70,
  },
  {
    task_id: 'proof-listen-approval',
    label: 'Listen to and approve the private proof',
    description:
      'The host downloads and listens to the private proof, then approves it or requests changes. Keep staged Spotify links and internal publishing packages inside the Studio.',
    phase: 'producer_review',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 15,
    required: true,
    dependencies: ['producer-proof-upload'],
    kind: 'proof',
    linked_deliverable_ids: [PRODUCER_PROOF_DELIVERABLE_ID],
    subtasks: [],
    sort_order: 80,
  },
  {
    task_id: 'publishing-package',
    label: 'Complete the graphics and show assets',
    description:
      'Complete the episode graphic, final show notes, and the show assets the producer and social media crew need for the remaining review and release work.',
    phase: 'publishing',
    owner_type: 'producer',
    assigned_person_ids: [],
    days_before_air: 21,
    required: true,
    dependencies: ['edit-package-delivered', 'show-notes-brief'],
    kind: 'bundle',
    linked_deliverable_ids: [],
    subtasks: PUBLISHING_SUBTASKS,
    sort_order: 60,
  },
  {
    task_id: 'promotion-scheduled',
    label: 'Schedule the episode and promotion',
    description:
      'After proof approval, schedule the episode on Spotify and schedule the approved social media, email, and blog promotion.',
    phase: 'publishing',
    owner_type: 'producer',
    assigned_person_ids: [],
    days_before_air: 14,
    required: true,
    dependencies: ['proof-listen-approval', 'publishing-package'],
    kind: 'bundle',
    linked_deliverable_ids: [],
    subtasks: PROMOTION_SUBTASKS,
    sort_order: 90,
  },
  {
    task_id: 'guest-assets-shared',
    label: 'Share the air date and approved assets with the guest',
    description:
      'Share only approved assets. If a guest proof listen is desired, use a controlled Google Drive file. Never share a private staged Spotify link or the internal publishing package, because either can expose unreleased program material and internal-only metadata.',
    phase: 'release_coordination',
    owner_type: 'hosts',
    assigned_person_ids: [],
    days_before_air: 14,
    required: true,
    dependencies: ['proof-listen-approval', 'publishing-package'],
    kind: 'standard',
    linked_deliverable_ids: [],
    subtasks: [],
    sort_order: 100,
  },
];

const DEFAULT_TASK_BY_ID = new Map(
  DEFAULT_EPISODE_PRODUCTION_TASKS.map((task) => [task.task_id, task])
);

function cleanText(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanId(value, fallback = '') {
  return (
    String(value ?? fallback)
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_.:-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 180) || fallback
  );
}

function uniqueIds(value, max = 20) {
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return [...new Set(source.map((entry) => cleanId(entry)).filter(Boolean))]
    .slice(0, max);
}

function formatUtcDate(date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, '0'),
    String(date.getUTCDate()).padStart(2, '0'),
  ].join('-');
}

/** Normalize a value to a real YYYY-MM-DD date without local-time math. */
export function normalizeProductionDate(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : formatUtcDate(value);
  }

  const source = cleanText(value, 50);
  if (!source) return '';
  const dateOnly = source.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnly) {
    const [, year, month, day] = dateOnly;
    const parsed = new Date(
      Date.UTC(Number(year), Number(month) - 1, Number(day))
    );
    return formatUtcDate(parsed) === source ? source : '';
  }

  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? '' : formatUtcDate(parsed);
}

function resolveAirDate(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    return normalizeProductionDate(
      value.target_release_date || value.air_date || value.release_date
    );
  }
  return normalizeProductionDate(value);
}

/** Subtract date-only days in UTC. */
export function getProductionDueDate(airDate, daysBeforeAir) {
  const normalizedAirDate = resolveAirDate(airDate);
  const requestedDays = Number(daysBeforeAir);
  if (!normalizedAirDate || !Number.isFinite(requestedDays)) return '';
  const [year, month, day] = normalizedAirDate.split('-').map(Number);
  const result = new Date(Date.UTC(year, month - 1, day));
  result.setUTCDate(result.getUTCDate() - Math.trunc(requestedDays));
  return formatUtcDate(result);
}

function normalizeTimestamp(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? '' : value.toISOString();
  }
  const source = cleanText(value, 80);
  if (!source) return '';
  const parsed = new Date(source);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function normalizeStatus(value) {
  const requested = cleanText(value, 40).toLowerCase();
  if (EPISODE_PRODUCTION_TASK_STATUSES.includes(requested)) {
    return requested;
  }
  if (['completed', 'done'].includes(requested)) return 'complete';
  if (['started', 'active', 'blocked'].includes(requested)) {
    return 'in_progress';
  }
  return 'not_started';
}

function normalizeIntroMethod(value, { acceptLegacy = true } = {}) {
  const requested = cleanText(value, 80).toLowerCase();
  if (['recorded', 'recorded_intro', 'uploaded'].includes(requested)) {
    return 'recorded';
  }
  if (requested === 'scheduled_with_producer') {
    return 'scheduled_with_producer';
  }
  if (
    acceptLegacy &&
    ['scheduled_with_angie', 'scheduled', 'schedule_with_angie', 'script_and_schedule'].includes(
      requested
    )
  ) {
    return 'scheduled_with_producer';
  }
  return '';
}

function normalizeProofDecision(value) {
  const requested = cleanText(value, 40).toLowerCase();
  return ['pending', 'approved', 'changes_requested'].includes(requested)
    ? requested
    : 'pending';
}

function isSafeEvidenceUrl(value) {
  const source = cleanText(value, 2000);
  if (!source) return false;
  try {
    return new URL(source).protocol === 'https:';
  } catch {
    return false;
  }
}

function isSpotifyUrl(value) {
  if (!isSafeEvidenceUrl(value)) return false;
  const hostname = new URL(value).hostname.toLowerCase();
  return (
    hostname === 'spotify.com' ||
    hostname.endsWith('.spotify.com') ||
    hostname === 'spotify.link'
  );
}

function normalizeSubtask(value = {}, fallback = {}, index = 0) {
  const id = cleanId(value.id || value.subtask_id, fallback.id || `item-${index + 1}`);
  const completed = value.completed === true || normalizeStatus(value.status) === 'complete';
  return {
    id,
    label:
      cleanText(value.label, 180) || cleanText(fallback.label, 180) || id,
    required:
      Object.prototype.hasOwnProperty.call(value, 'required')
        ? value.required !== false
        : fallback.required !== false,
    completed,
    completed_at: completed ? normalizeTimestamp(value.completed_at) : '',
    completed_by_person_id: completed
      ? cleanId(value.completed_by_person_id)
      : '',
    completed_by_name: completed
      ? cleanText(value.completed_by_name, 180)
      : '',
  };
}

function normalizeSubtasks(value, defaults = []) {
  const source = Array.isArray(value) ? value.slice(0, MAX_TASK_SUBTASKS) : [];
  const sourceById = new Map(
    source
      .map((subtask) => [cleanId(subtask?.id || subtask?.subtask_id), subtask])
      .filter(([id]) => id)
  );
  const defaultIds = new Set(defaults.map((subtask) => subtask.id));
  const normalizedDefaults = defaults.map((subtask, index) =>
    normalizeSubtask(sourceById.get(subtask.id) || {}, subtask, index)
  );
  const custom = source
    .filter(
      (subtask) =>
        cleanId(subtask?.id || subtask?.subtask_id) &&
        !defaultIds.has(cleanId(subtask?.id || subtask?.subtask_id))
    )
    .map((subtask, index) =>
      normalizeSubtask(subtask, {}, normalizedDefaults.length + index)
    );
  return [...normalizedDefaults, ...custom].slice(0, MAX_TASK_SUBTASKS);
}

function normalizeTask(value = {}, fallback = {}, index = 0, airDate = '') {
  const taskId = cleanId(
    value.task_id || value.id,
    fallback.task_id || `production-task-${index + 1}`
  );
  const daysSource = Object.prototype.hasOwnProperty.call(value, 'days_before_air')
    ? value.days_before_air
    : fallback.days_before_air;
  const daysBeforeAir = Math.max(
    0,
    Math.min(3650, Math.trunc(Number(daysSource) || 0))
  );
  const requestedOverride = value.due_date_overridden === true;
  const suppliedDueDate = normalizeProductionDate(value.due_date);
  const calculatedDueDate = getProductionDueDate(airDate, daysBeforeAir);
  const dueDateOverridden = requestedOverride && Boolean(suppliedDueDate);
  const status = normalizeStatus(value.status);
  const isFinished = ['complete', 'waived'].includes(status);
  const preservesFinishedDueDate = isFinished && Boolean(suppliedDueDate);
  const fallbackSubtasks = Array.isArray(fallback.subtasks)
    ? fallback.subtasks
    : [];
  const kind = EPISODE_PRODUCTION_TASK_KINDS.includes(value.kind)
    ? value.kind
    : EPISODE_PRODUCTION_TASK_KINDS.includes(fallback.kind)
      ? fallback.kind
      : 'standard';
  const evidenceUrl = isSafeEvidenceUrl(value.evidence_url)
    ? cleanText(value.evidence_url, 2000)
    : '';
  const requestedDeadlineSchemaVersion = Number(
    value.deadline_schema_version ?? fallback.deadline_schema_version
  );
  const deadlineSchemaVersion =
    Number.isInteger(requestedDeadlineSchemaVersion) &&
    requestedDeadlineSchemaVersion > 0
      ? Math.min(requestedDeadlineSchemaVersion, 1000)
      : EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION;
  const requestedDefinitionSchemaVersion = Number(
    value.definition_schema_version ?? fallback.definition_schema_version
  );
  const definitionSchemaVersion =
    Number.isInteger(requestedDefinitionSchemaVersion) &&
    requestedDefinitionSchemaVersion > 0
      ? Math.min(requestedDefinitionSchemaVersion, 1000)
      : EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION;

  return {
    task_id: taskId,
    label:
      cleanText(value.label || value.title, 180) ||
      cleanText(fallback.label, 180) ||
      taskId,
    description:
      cleanText(value.description, 1600) ||
      cleanText(fallback.description, 1600),
    phase:
      cleanId(value.phase, cleanId(fallback.phase, 'production')) ||
      'production',
    owner_type: EPISODE_PRODUCTION_TASK_OWNER_TYPES.includes(value.owner_type)
      ? value.owner_type
      : EPISODE_PRODUCTION_TASK_OWNER_TYPES.includes(fallback.owner_type)
        ? fallback.owner_type
        : 'person',
    assigned_person_ids: uniqueIds(
      Object.prototype.hasOwnProperty.call(value, 'assigned_person_ids')
        ? value.assigned_person_ids
        : fallback.assigned_person_ids
    ),
    definition_schema_version: definitionSchemaVersion,
    deadline_schema_version: deadlineSchemaVersion,
    days_before_air: daysBeforeAir,
    due_date: dueDateOverridden || preservesFinishedDueDate
      ? suppliedDueDate
      : calculatedDueDate || suppliedDueDate,
    due_date_overridden: dueDateOverridden,
    required:
      Object.prototype.hasOwnProperty.call(value, 'required')
        ? value.required !== false
        : fallback.required !== false,
    dependencies: uniqueIds(
      Object.prototype.hasOwnProperty.call(value, 'dependencies')
        ? value.dependencies
        : fallback.dependencies
    ),
    kind,
    linked_deliverable_ids: uniqueIds(
      Array.isArray(fallback.linked_deliverable_ids)
        ? fallback.linked_deliverable_ids
        : value.linked_deliverable_ids
    ),
    subtasks: normalizeSubtasks(value.subtasks, fallbackSubtasks),
    status,
    intro_method: kind === 'intro' ? normalizeIntroMethod(value.intro_method) : '',
    intro_scheduled_for:
      kind === 'intro' ? normalizeProductionDate(value.intro_scheduled_for) : '',
    proof_decision:
      kind === 'proof' ? normalizeProofDecision(value.proof_decision) : '',
    evidence_url:
      taskId === 'guest-assets-shared' && isSpotifyUrl(evidenceUrl)
        ? ''
        : evidenceUrl,
    evidence_note: cleanText(value.evidence_note ?? value.note, 2400),
    evidence_asset_id: cleanId(value.evidence_asset_id),
    completed_at: isFinished ? normalizeTimestamp(value.completed_at) : '',
    completed_by_person_id: isFinished
      ? cleanId(value.completed_by_person_id)
      : '',
    completed_by_name: isFinished
      ? cleanText(value.completed_by_name, 180)
      : '',
    is_custom: !DEFAULT_TASK_BY_ID.has(taskId),
    created_at: normalizeTimestamp(value.created_at),
    created_by_person_id: cleanId(value.created_by_person_id),
    created_by_name: cleanText(value.created_by_name, 180),
    updated_at: normalizeTimestamp(value.updated_at),
    updated_by_person_id: cleanId(value.updated_by_person_id),
    updated_by_name: cleanText(value.updated_by_name, 180),
    sort_order: Number.isFinite(Number(value.sort_order ?? fallback.sort_order))
      ? Math.trunc(Number(value.sort_order ?? fallback.sort_order))
      : (index + 1) * 10,
  };
}

/** Create all default production tasks for an episode air date. */
export function createDefaultEpisodeProductionTasks(airDate) {
  const normalizedAirDate = resolveAirDate(airDate);
  return DEFAULT_EPISODE_PRODUCTION_TASKS.map((task, index) =>
    normalizeTask({}, task, index, normalizedAirDate)
  ).sort(
    (a, b) =>
      a.sort_order - b.sort_order || a.label.localeCompare(b.label)
  );
}

function migrateLegacyNamedTaskOwner(task = {}, taskId = '') {
  const legacyPersonId = LEGACY_NAMED_OWNER_BY_TASK_ID[taskId];
  const assignedPersonIds = uniqueIds(task.assigned_person_ids);
  if (
    !legacyPersonId ||
    task.owner_type !== 'person' ||
    assignedPersonIds.length !== 1 ||
    assignedPersonIds[0] !== legacyPersonId
  ) {
    return task;
  }
  return {
    ...task,
    owner_type: 'producer',
    assigned_person_ids: [],
  };
}

function migrateLegacyNamedTaskCopy(task = {}, taskId = '') {
  const migration = LEGACY_NAMED_COPY_BY_TASK_ID[taskId];
  const currentDefault = DEFAULT_TASK_BY_ID.get(taskId);
  if (!migration || !currentDefault) return task;

  const savedLabel = cleanText(task.label || task.title, 180);
  const savedDescription = cleanText(
    task.description || task.instructions,
    1600
  );
  return {
    ...task,
    ...(migration.labels.includes(savedLabel)
      ? { label: currentDefault.label, title: undefined }
      : {}),
    ...(migration.descriptions.includes(savedDescription)
      ? {
          description: currentDefault.description,
          instructions: undefined,
        }
      : {}),
  };
}

function migrateEarlierDefaultDeadline(task = {}, taskId = '', airDate = '') {
  const requestedVersion = Number(task.deadline_schema_version);
  if (
    Number.isInteger(requestedVersion) &&
    requestedVersion >= EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION
  ) {
    return task;
  }

  const migration = EARLIER_DEFAULT_DEADLINE_BY_TASK_ID[taskId];
  const next = {
    ...task,
    deadline_schema_version: EPISODE_PRODUCTION_DEADLINE_SCHEMA_VERSION,
  };
  if (!migration) return next;

  const newDefaultDueDate = getProductionDueDate(airDate, migration.to);
  return {
    ...next,
    days_before_air: migration.to,
    due_date: newDefaultDueDate,
    due_date_overridden: false,
  };
}

function migrateEarlierDefaultDefinition(task = {}, taskId = '') {
  const requestedVersion = Number(task.definition_schema_version);
  if (
    Number.isInteger(requestedVersion) &&
    requestedVersion >= EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION
  ) {
    return task;
  }

  const earlierDependencies =
    EARLIER_DEFAULT_DEPENDENCIES_BY_TASK_ID[taskId];
  const currentDefault = DEFAULT_TASK_BY_ID.get(taskId);
  const shouldMigrateDependencies = Boolean(
    earlierDependencies &&
      currentDefault &&
      Object.prototype.hasOwnProperty.call(task, 'dependencies') &&
      sameIds(task.dependencies, earlierDependencies)
  );
  const earlierSortOrder = EARLIER_DEFAULT_SORT_ORDER_BY_TASK_ID[taskId];
  const shouldMigrateSortOrder = Boolean(
    currentDefault &&
      Number.isFinite(Number(earlierSortOrder)) &&
      Number(task.sort_order) === Number(earlierSortOrder)
  );
  return {
    ...task,
    definition_schema_version: EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION,
    ...(shouldMigrateDependencies
      ? { dependencies: currentDefault.dependencies }
      : {}),
    ...(shouldMigrateSortOrder
      ? { sort_order: currentDefault.sort_order }
      : {}),
  };
}

function migrateReleaseSchedulingSubtask(tasks = []) {
  const source = Array.isArray(tasks) ? tasks : [];
  const publishingIndex = source.findIndex(
    (task) => cleanId(task?.task_id || task?.id) === 'publishing-package'
  );
  const promotionIndex = source.findIndex(
    (task) => cleanId(task?.task_id || task?.id) === 'promotion-scheduled'
  );
  if (publishingIndex < 0 || promotionIndex < 0) return source;

  const publishing = source[publishingIndex] || {};
  if (
    Number(publishing.definition_schema_version) >=
    EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION
  ) {
    return source;
  }
  const publishingSubtasks = Array.isArray(publishing.subtasks)
    ? publishing.subtasks
    : [];
  const spotifySubtask = publishingSubtasks.find(
    (subtask) => cleanId(subtask?.id || subtask?.subtask_id) === 'spotify'
  );
  if (!spotifySubtask) return source;

  const promotion = source[promotionIndex] || {};
  const promotionSubtasks = Array.isArray(promotion.subtasks)
    ? promotion.subtasks
    : [];
  const promotionHasSpotify = promotionSubtasks.some(
    (subtask) => cleanId(subtask?.id || subtask?.subtask_id) === 'spotify'
  );
  return source.map((task, index) => {
    if (index === publishingIndex) {
      return {
        ...task,
        subtasks: publishingSubtasks.filter(
          (subtask) =>
            cleanId(subtask?.id || subtask?.subtask_id) !== 'spotify'
        ),
      };
    }
    if (index === promotionIndex && !promotionHasSpotify) {
      return {
        ...task,
        subtasks: [spotifySubtask, ...promotionSubtasks],
      };
    }
    return task;
  });
}

function acceptedWorkflowWaiver(task = {}, airDate = '', options = {}) {
  if (['complete', 'waived'].includes(normalizeStatus(task.status))) return task;
  const completedAt =
    normalizeTimestamp(options.migrationCompletedAt) ||
    normalizeTimestamp(airDate ? `${airDate}T00:00:00.000Z` : '');
  return {
    ...task,
    status: 'waived',
    completed_at: completedAt,
    completed_by_person_id: cleanId(options.migrationCompletedByPersonId),
    completed_by_name:
      cleanText(options.migrationCompletedByName, 180) ||
      'Accepted episode workflow migration',
  };
}

/**
 * Normalize saved tasks, add any defaults introduced in a later release, and
 * retain valid custom tasks after the defaults.
 */
export function normalizeEpisodeProductionTasks(tasks, airDate, options = {}) {
  const normalizedAirDate = resolveAirDate(airDate);
  const source = migrateReleaseSchedulingSubtask(
    Array.isArray(tasks) ? tasks.slice(0, MAX_PRODUCTION_TASKS) : []
  );
  const sourceById = new Map();
  for (const task of source) {
    const id = cleanId(task?.task_id || task?.id);
    if (id) sourceById.set(id, task);
  }

  const defaults = DEFAULT_EPISODE_PRODUCTION_TASKS.map((task, index) =>
    normalizeTask(
      migrateLegacyNamedTaskOwner(
        migrateLegacyNamedTaskCopy(
          migrateEarlierDefaultDefinition(
            migrateEarlierDefaultDeadline(
              sourceById.get(task.task_id) || {},
              task.task_id,
              normalizedAirDate
            ),
            task.task_id,
          ),
          task.task_id
        ),
        task.task_id
      ),
      task,
      index,
      normalizedAirDate
    )
  );
  const customTasks = source
    .filter((task) => {
      const id = cleanId(task?.task_id || task?.id);
      return id && !DEFAULT_TASK_BY_ID.has(id);
    })
    .map((task, index) =>
      normalizeTask(task, {}, defaults.length + index, normalizedAirDate)
    )
    .filter((task) => task.task_id);

  const normalizedTasks = [...defaults, ...customTasks]
    .slice(0, MAX_PRODUCTION_TASKS)
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );
  if (options.episodeStatus === 'accepted') {
    return normalizedTasks.map((task) =>
      acceptedWorkflowWaiver(task, normalizedAirDate, options)
    );
  }
  return normalizedTasks;
}

export function canEditEpisodeProductionTaskStructure(capabilities = {}) {
  return (
    capabilities.canManage === true ||
    capabilities.can_manage === true ||
    capabilities.canReview === true ||
    capabilities.can_review === true
  );
}

export function isDefaultEpisodeProductionTaskId(value) {
  return DEFAULT_TASK_BY_ID.has(cleanId(value));
}

function strictDefinitionText(value, fieldLabel, maxLength, required) {
  if (value === undefined && !required) return undefined;
  const source = String(value ?? '').trim();
  if (!source) {
    throw new Error(`Episode production: ${fieldLabel} is required.`);
  }
  if (source.length > maxLength) {
    throw new Error(
      `Episode production: ${fieldLabel} must be ${maxLength} characters or fewer.`
    );
  }
  return source;
}

function strictDefinitionIds(value, fieldLabel, maxLength) {
  if (!Array.isArray(value)) {
    throw new Error(`Episode production: ${fieldLabel} must be a list.`);
  }
  if (value.length > maxLength) {
    throw new Error(
      `Episode production: ${fieldLabel} can include at most ${maxLength} items.`
    );
  }
  const ids = value.map((entry) => cleanId(entry)).filter(Boolean);
  if (ids.length !== value.length) {
    throw new Error(
      `Episode production: every ${fieldLabel} entry needs a valid ID.`
    );
  }
  if (new Set(ids).size !== ids.length) {
    throw new Error(
      `Episode production: ${fieldLabel} cannot contain duplicates.`
    );
  }
  return ids;
}

function sameIds(left, right) {
  const normalized = (value) =>
    [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .map((entry) => cleanId(entry))
          .filter(Boolean)
      ),
    ]
      .sort();
  return JSON.stringify(normalized(left)) === JSON.stringify(normalized(right));
}

function validateImmutableTaskFields(input, current) {
  const requestedId = cleanId(input.task_id || input.id);
  if (requestedId && requestedId !== current.task_id) {
    throw new Error('Episode production: task IDs cannot be changed.');
  }
  if (
    Object.prototype.hasOwnProperty.call(input, 'kind') &&
    input.kind !== current.kind
  ) {
    throw new Error('Episode production: task kinds cannot be changed.');
  }
  if (
    Object.prototype.hasOwnProperty.call(input, 'linked_deliverable_ids') &&
    !sameIds(input.linked_deliverable_ids, current.linked_deliverable_ids)
  ) {
    throw new Error(
      'Episode production: linked package requirements cannot be changed here.'
    );
  }
}

function applyTaskDefinitionInput(
  current,
  inputValue,
  airDate,
  { creating = false } = {}
) {
  const input =
    inputValue && typeof inputValue === 'object' ? inputValue : {};
  validateImmutableTaskFields(input, current);
  const next = { ...current };
  const hasLabel =
    Object.prototype.hasOwnProperty.call(input, 'label') ||
    Object.prototype.hasOwnProperty.call(input, 'title');
  const hasDescription =
    Object.prototype.hasOwnProperty.call(input, 'description') ||
    Object.prototype.hasOwnProperty.call(input, 'instructions');

  if (hasLabel || creating) {
    next.label = strictDefinitionText(
      input.label ?? input.title,
      'task title',
      180,
      true
    );
  }
  if (hasDescription || creating) {
    next.description = strictDefinitionText(
      input.description ?? input.instructions,
      'task instructions',
      1600,
      true
    );
  }

  if (Object.prototype.hasOwnProperty.call(input, 'phase') || creating) {
    const phase = cleanId(input.phase);
    if (!EPISODE_PRODUCTION_TASK_PHASES.includes(phase)) {
      throw new Error(
        'Episode production: choose a visible production board phase.'
      );
    }
    next.phase = phase;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'owner_type') || creating) {
    if (!EPISODE_PRODUCTION_TASK_OWNER_TYPES.includes(input.owner_type)) {
      throw new Error('Episode production: choose a valid task owner.');
    }
    next.owner_type = input.owner_type;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'assigned_person_ids')) {
    next.assigned_person_ids = strictDefinitionIds(
      input.assigned_person_ids,
      'task assignees',
      MAX_TASK_ASSIGNEES
    );
  }
  if (next.owner_type === 'person') {
    if (!next.assigned_person_ids.length) {
      throw new Error(
        'Episode production: choose an accountable person for this task.'
      );
    }
  } else {
    next.assigned_person_ids = [];
  }

  if (Object.prototype.hasOwnProperty.call(input, 'required')) {
    if (typeof input.required !== 'boolean') {
      throw new Error(
        'Episode production: choose whether this task is required.'
      );
    }
    next.required = input.required;
  }

  const hasDaysBeforeAir = Object.prototype.hasOwnProperty.call(
    input,
    'days_before_air'
  );
  const hasDueDate = Object.prototype.hasOwnProperty.call(input, 'due_date');
  const hasOverride = Object.prototype.hasOwnProperty.call(
    input,
    'due_date_overridden'
  );
  if (creating && !hasDaysBeforeAir && !hasDueDate) {
    throw new Error(
      'Episode production: add days before air or a custom task deadline.'
    );
  }
  if (hasDaysBeforeAir) {
    const daysBeforeAir = Number(input.days_before_air);
    if (
      !Number.isInteger(daysBeforeAir) ||
      daysBeforeAir < 0 ||
      daysBeforeAir > 365
    ) {
      throw new Error(
        'Episode production: days before air must be a whole number from 0 to 365.'
      );
    }
    next.days_before_air = daysBeforeAir;
    if (next.due_date_overridden !== true && !hasDueDate) {
      next.due_date = getProductionDueDate(airDate, daysBeforeAir);
    }
  }
  if (hasOverride && typeof input.due_date_overridden !== 'boolean') {
    throw new Error(
      'Episode production: choose whether this task uses a custom deadline.'
    );
  }
  if (input.due_date_overridden === true && !hasDueDate) {
    throw new Error(
      'Episode production: add the custom task deadline before saving it.'
    );
  }
  if (hasDueDate) {
    const dueDate = normalizeProductionDate(input.due_date);
    if (!dueDate) {
      throw new Error('Episode production: choose a valid task deadline.');
    }
    next.due_date = dueDate;
    next.due_date_overridden = input.due_date_overridden !== false;
  }
  if (input.due_date_overridden === false) {
    next.due_date = getProductionDueDate(airDate, next.days_before_air);
    next.due_date_overridden = false;
  }

  if (Object.prototype.hasOwnProperty.call(input, 'dependencies') || creating) {
    next.dependencies = strictDefinitionIds(
      input.dependencies || [],
      'task dependencies',
      MAX_TASK_DEPENDENCIES
    );
  }

  return next;
}

export function validateEpisodeProductionTaskGraph(tasksValue = []) {
  if (!Array.isArray(tasksValue)) {
    throw new Error('Episode production: production tasks must be a list.');
  }
  if (tasksValue.length > MAX_PRODUCTION_TASKS) {
    throw new Error(
      `Episode production: an episode can contain at most ${MAX_PRODUCTION_TASKS} tasks.`
    );
  }

  const taskById = new Map();
  for (const task of tasksValue) {
    const taskId = cleanId(task?.task_id || task?.id);
    if (!taskId) {
      throw new Error('Episode production: every task needs a valid ID.');
    }
    if (taskById.has(taskId)) {
      throw new Error(`Episode production: duplicate task ID "${taskId}".`);
    }
    taskById.set(taskId, task);
  }

  for (const [taskId, task] of taskById) {
    const dependencies = Array.isArray(task.dependencies)
      ? task.dependencies.map((entry) => cleanId(entry)).filter(Boolean)
      : [];
    if (dependencies.includes(taskId)) {
      throw new Error(
        `Episode production: "${task.label || taskId}" cannot depend on itself.`
      );
    }
    const unknown = dependencies.find((dependencyId) => !taskById.has(dependencyId));
    if (unknown) {
      throw new Error(
        `Episode production: unknown dependency "${unknown}" for ${task.label || taskId}.`
      );
    }
  }

  const visiting = new Set();
  const visited = new Set();
  function visit(taskId, path = []) {
    if (visiting.has(taskId)) {
      const cycleStart = path.indexOf(taskId);
      const cycle = [...path.slice(Math.max(0, cycleStart)), taskId];
      throw new Error(
        `Episode production: dependency cycle detected (${cycle.join(' -> ')}).`
      );
    }
    if (visited.has(taskId)) return;
    visiting.add(taskId);
    const task = taskById.get(taskId);
    for (const dependencyId of task.dependencies || []) {
      visit(cleanId(dependencyId), [...path, taskId]);
    }
    visiting.delete(taskId);
    visited.add(taskId);
  }
  for (const taskId of taskById.keys()) visit(taskId);
  return true;
}

function validateEpisodeProductionTaskRelationshipOwner(task, episode = {}) {
  const ownerType = task?.owner_type;
  const hostPersonIds = uniqueIds(episode.host_person_ids);
  const producerPersonId = cleanId(episode.producer_person_id);
  if (
    ['hosts', 'hosts_and_producer'].includes(ownerType) &&
    !hostPersonIds.length
  ) {
    throw new Error(
      'Episode production: assign at least one host before using a host-owned task.'
    );
  }
  if (
    ['producer', 'hosts_and_producer'].includes(ownerType) &&
    !producerPersonId
  ) {
    throw new Error(
      'Episode production: assign a producer before using a producer-owned task.'
    );
  }
}

function assertStructuralEditor(actor) {
  if (!canEditEpisodeProductionTaskStructure(actor)) {
    throw new Error(
      'Episode production: only the assigned producer or a Studio manager can edit task structure.'
    );
  }
}

/** Add a standard custom task while leaving seeded workflow definitions intact. */
export function addEpisodeProductionTaskDefinition(
  episode = {},
  input = {},
  actor = {},
  { taskId, now = new Date() } = {}
) {
  assertStructuralEditor(actor);
  const sourceTasks = Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : [];
  if (!sourceTasks.length) {
    throw new Error(
      'Episode production: enable the production workflow before adding a task.'
    );
  }
  if (sourceTasks.length >= MAX_PRODUCTION_TASKS) {
    throw new Error(
      `Episode production: an episode can contain at most ${MAX_PRODUCTION_TASKS} tasks.`
    );
  }
  const airDate = resolveAirDate(episode);
  const tasks = normalizeEpisodeProductionTasks(sourceTasks, airDate);
  const requestedTaskId = cleanId(taskId);
  if (!requestedTaskId || isDefaultEpisodeProductionTaskId(requestedTaskId)) {
    throw new Error('Episode production: a unique custom task ID is required.');
  }
  if (tasks.some((task) => task.task_id === requestedTaskId)) {
    throw new Error(`Episode production: task "${requestedTaskId}" already exists.`);
  }
  const auditActor = normalizeActor(actor);
  const timestamp = getAuditTimestamp(now);
  const sortOrder =
    tasks.reduce(
      (highest, task) => Math.max(highest, Number(task.sort_order) || 0),
      0
    ) + 10;
  const baseTask = {
    task_id: requestedTaskId,
    label: '',
    description: '',
    phase: '',
    owner_type: 'person',
    assigned_person_ids: [],
    days_before_air: 0,
    due_date: '',
    due_date_overridden: false,
    required: true,
    dependencies: [],
    kind: 'standard',
    linked_deliverable_ids: [],
    subtasks: [],
    status: 'not_started',
    evidence_url: '',
    evidence_note: '',
    evidence_asset_id: '',
    completed_at: '',
    completed_by_person_id: '',
    completed_by_name: '',
    sort_order: sortOrder,
  };
  const configured = applyTaskDefinitionInput(baseTask, input, airDate, {
    creating: true,
  });
  validateEpisodeProductionTaskRelationshipOwner(configured, episode);
  const customTask = normalizeTask(
    {
      ...configured,
      created_at: timestamp,
      created_by_person_id: auditActor.person_id,
      created_by_name: auditActor.person_name,
      updated_at: timestamp,
      updated_by_person_id: auditActor.person_id,
      updated_by_name: auditActor.person_name,
    },
    {},
    tasks.length,
    airDate
  );
  const productionTasks = normalizeEpisodeProductionTasks(
    [...tasks, customTask],
    airDate
  );
  validateEpisodeProductionTaskGraph(productionTasks);
  return { ...episode, production_tasks: productionTasks };
}

/** Edit structural fields while preserving runtime state and special-task data. */
export function editEpisodeProductionTaskDefinition(
  episode = {},
  taskId,
  input = {},
  actor = {},
  { now = new Date() } = {}
) {
  assertStructuralEditor(actor);
  const sourceTasks = Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : [];
  if (sourceTasks.length > MAX_PRODUCTION_TASKS) {
    throw new Error(
      `Episode production: an episode can contain at most ${MAX_PRODUCTION_TASKS} tasks.`
    );
  }
  const airDate = resolveAirDate(episode);
  const tasks = normalizeEpisodeProductionTasks(sourceTasks, airDate);
  const requestedTaskId = cleanId(taskId);
  const current = tasks.find((task) => task.task_id === requestedTaskId);
  if (!current) {
    throw new Error(`Episode production: unknown task "${requestedTaskId}".`);
  }
  const auditActor = normalizeActor(actor);
  const timestamp = getAuditTimestamp(now);
  const dependenciesBefore = current.dependencies || [];
  const configured = applyTaskDefinitionInput(current, input, airDate);
  validateEpisodeProductionTaskRelationshipOwner(configured, episode);
  const editedTask = {
    ...configured,
    updated_at: timestamp,
    updated_by_person_id: auditActor.person_id,
    updated_by_name: auditActor.person_name,
  };
  const productionTasks = normalizeEpisodeProductionTasks(
    tasks.map((task) =>
      task.task_id === requestedTaskId ? editedTask : task
    ),
    airDate
  );
  validateEpisodeProductionTaskGraph(productionTasks);
  const updatedEpisode = { ...episode, production_tasks: productionTasks };
  if (
    current.status === 'complete' &&
    !sameIds(dependenciesBefore, editedTask.dependencies)
  ) {
    const taskById = new Map(
      productionTasks.map((task) => [task.task_id, task])
    );
    const savedTask = taskById.get(requestedTaskId);
    const blockers = getDependencyBlockers(
      savedTask,
      taskById,
      updatedEpisode
    );
    if (blockers.length) {
      throw new Error(
        `Episode production: a completed task cannot depend on incomplete steps (${blockers.join(', ')}). Reopen it before changing those dependencies.`
      );
    }
  }
  return updatedEpisode;
}

/**
 * Move a task to a zero-based position within a board phase. Only board
 * placement fields change; task progress, evidence, dependencies, and audit
 * history are retained by the object spreads below.
 */
export function moveEpisodeProductionTaskDefinition(
  episode = {},
  taskId,
  input = {},
  actor = {}
) {
  assertStructuralEditor(actor);
  const sourceTasks = Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : [];
  if (!sourceTasks.length) {
    throw new Error(
      'Episode production: enable the production workflow before moving a task.'
    );
  }
  if (sourceTasks.length > MAX_PRODUCTION_TASKS) {
    throw new Error(
      `Episode production: an episode can contain at most ${MAX_PRODUCTION_TASKS} tasks.`
    );
  }

  const airDate = resolveAirDate(episode);
  const tasks = normalizeEpisodeProductionTasks(sourceTasks, airDate);
  const requestedTaskId = cleanId(taskId);
  const current = tasks.find((task) => task.task_id === requestedTaskId);
  if (!requestedTaskId || !current) {
    throw new Error(`Episode production: unknown task "${requestedTaskId}".`);
  }

  const targetPhase = cleanId(input?.target_phase);
  if (!EPISODE_PRODUCTION_TASK_PHASES.includes(targetPhase)) {
    throw new Error(
      'Episode production: choose a visible production board phase.'
    );
  }
  if (
    typeof input?.target_index !== 'number' ||
    !Number.isInteger(input.target_index) ||
    input.target_index < 0
  ) {
    throw new Error(
      'Episode production: the board position must be a non-negative whole number.'
    );
  }

  const remainingTasks = tasks.filter(
    (task) => task.task_id !== requestedTaskId
  );
  const destinationTasks = remainingTasks.filter(
    (task) => task.phase === targetPhase
  );
  if (input.target_index > destinationTasks.length) {
    throw new Error(
      `Episode production: the board position must be between 0 and ${destinationTasks.length}.`
    );
  }
  destinationTasks.splice(input.target_index, 0, {
    ...current,
    phase: targetPhase,
  });

  const destinationIds = new Set(
    destinationTasks.map((task) => task.task_id)
  );
  const orderedTasks = [];
  for (const phase of EPISODE_PRODUCTION_TASK_PHASES) {
    if (phase === targetPhase) {
      orderedTasks.push(...destinationTasks);
      continue;
    }
    orderedTasks.push(
      ...remainingTasks.filter((task) => task.phase === phase)
    );
  }
  // Preserve any historical task that predates the fixed board phase list.
  orderedTasks.push(
    ...remainingTasks.filter(
      (task) =>
        !EPISODE_PRODUCTION_TASK_PHASES.includes(task.phase) &&
        !destinationIds.has(task.task_id)
    )
  );

  const productionTasks = orderedTasks.map((task, index) => ({
    ...task,
    sort_order: (index + 1) * 10,
  }));
  validateEpisodeProductionTaskGraph(productionTasks);
  return { ...episode, production_tasks: productionTasks };
}

/**
 * Move unfinished default dates with a changed air date while retaining the
 * historical due date of completed tasks and every explicit manager override.
 */
export function recalculateEpisodeProductionTaskDates(tasks, airDate) {
  const source = Array.isArray(tasks) ? tasks : [];
  const sourceById = new Map(
    source
      .map((task) => [cleanId(task?.task_id || task?.id), task])
      .filter(([id]) => id)
  );
  return normalizeEpisodeProductionTasks(source, airDate).map((task) => {
    const original = sourceById.get(task.task_id);
    const originalDueDate = normalizeProductionDate(original?.due_date);
    const originalStatus = normalizeStatus(original?.status);
    if (
      originalDueDate &&
      (original?.due_date_overridden === true ||
        ['complete', 'waived'].includes(originalStatus))
    ) {
      return {
        ...task,
        due_date: originalDueDate,
        due_date_overridden: original?.due_date_overridden === true,
      };
    }
    return task;
  });
}

function getAssets(episode = {}) {
  return Array.isArray(episode.assets) ? episode.assets : [];
}

function resolveCompletionTimestamp(options = {}) {
  const requested = options.now ?? options.today ?? new Date();
  if (requested instanceof Date) {
    return Number.isNaN(requested.getTime())
      ? Date.now()
      : requested.getTime();
  }
  const source = cleanText(requested, 80);
  const parsed = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(source)
      ? `${source}T00:00:00.000Z`
      : source
  );
  return Number.isNaN(parsed.getTime()) ? Date.now() : parsed.getTime();
}

function assetIsAvailable(asset = {}, options = {}) {
  const status = cleanText(asset.status, 40).toLowerCase();
  if (['deleted', 'expired', 'failed'].includes(status)) return false;
  const expiresAt = cleanText(asset.retention_expires_at, 80);
  if (!expiresAt) return true;
  const expiration = new Date(expiresAt);
  return (
    !Number.isNaN(expiration.getTime()) &&
    expiration.getTime() > resolveCompletionTimestamp(options)
  );
}

function hasDeliverableAsset(
  episode,
  deliverableIds,
  evidenceAssetId = '',
  options = {}
) {
  const wantedIds = new Set(uniqueIds(deliverableIds));
  const cleanEvidenceAssetId = cleanId(evidenceAssetId);
  return getAssets(episode).some((asset) => {
    const assetId = cleanId(asset?.asset_id || asset?.id);
    const deliverableId = cleanId(asset?.deliverable_id);
    return (
      assetIsAvailable(asset, options) &&
      assetId &&
      wantedIds.has(deliverableId) &&
      (!cleanEvidenceAssetId || assetId === cleanEvidenceAssetId)
    );
  });
}

function requiredSubtasksComplete(task) {
  const required = (Array.isArray(task.subtasks) ? task.subtasks : []).filter(
    (subtask) => subtask.required !== false
  );
  return required.length > 0 && required.every((subtask) => subtask.completed === true);
}

/** Whether a task's own completion requirements are satisfied. */
export function isEpisodeProductionTaskComplete(
  task = {},
  episode = {},
  options = {}
) {
  if (task.status === 'waived') return true;
  if (task.status !== 'complete') return false;

  if (task.kind === 'bundle') {
    return requiredSubtasksComplete(task);
  }

  if (task.kind === 'intro') {
    if (task.intro_method === 'recorded') {
      if (!cleanId(task.evidence_asset_id)) return false;
      return hasDeliverableAsset(
        episode,
        [
          ...(task.linked_deliverable_ids || ['recording-files']),
          'intro-audio',
        ],
        task.evidence_asset_id,
        options
      );
    }
    if (task.intro_method === 'scheduled_with_producer') {
      const scheduledFor = normalizeProductionDate(task.intro_scheduled_for);
      const latestAllowed = getProductionDueDate(
        resolveAirDate(episode),
        INTRO_RECORDING_LATEST_DAYS_BEFORE_AIR
      );
      return Boolean(
        scheduledFor && latestAllowed && scheduledFor <= latestAllowed
      );
    }
    return false;
  }

  if (task.task_id === MICROPHONE_PLAN_TASK_ID) {
    const microphonePlan = (Array.isArray(episode.deliverables)
      ? episode.deliverables
      : []
    ).find(
      (deliverable) =>
        cleanId(deliverable?.id) === MICROPHONE_PLAN_DELIVERABLE_ID
    );
    if (!microphonePlan) return false;
    const hostPersonIds = uniqueIds(episode.host_person_ids);
    return getEpisodeMicKitPlanCompletion(
      microphonePlan.mic_kit_plans,
      hostPersonIds,
      microphonePlan.guest_mic_kit_plan
    ).complete;
  }

  if (task.task_id === 'producer-proof-upload') {
    return hasDeliverableAsset(
      episode,
      [PRODUCER_PROOF_DELIVERABLE_ID],
      task.evidence_asset_id,
      options
    );
  }

  if (task.task_id === 'proof-listen-approval') {
    const approvalAssetId = cleanId(task.evidence_asset_id);
    const currentProofTask = (Array.isArray(episode.production_tasks)
      ? episode.production_tasks
      : []
    ).find(
      (candidate) =>
        cleanId(candidate?.task_id || candidate?.id) ===
        'producer-proof-upload'
    );
    const currentProofAssetId = cleanId(currentProofTask?.evidence_asset_id);
    return (
      task.proof_decision === 'approved' &&
      Boolean(task.completed_at) &&
      Boolean(approvalAssetId) &&
      approvalAssetId === currentProofAssetId &&
      hasDeliverableAsset(
        episode,
        [PRODUCER_PROOF_DELIVERABLE_ID],
        approvalAssetId,
        options
      )
    );
  }

  if (task.task_id === PHOTO_SELECTION_PRODUCTION_TASK_ID) {
    const photos = (Array.isArray(episode.deliverables)
      ? episode.deliverables
      : []
    ).find(
      (deliverable) =>
        cleanId(deliverable?.id) === EPISODE_PHOTO_DELIVERABLE_ID
    );
    return Boolean(
      photos &&
        isEpisodePhotoSelectionConfirmed(
          photos,
          Array.isArray(episode.assets) ? episode.assets : [],
          options
        )
    );
  }

  return true;
}

function getDependencyBlockers(task, taskById, episode, options = {}) {
  return uniqueIds(task.dependencies).filter((dependencyId) => {
    const dependency = taskById.get(dependencyId);
    return (
      !dependency ||
      !isEpisodeProductionTaskComplete(dependency, episode, options)
    );
  });
}

function taskTransitivelyDependsOn(
  task,
  dependencyTaskId,
  taskById,
  visited = new Set()
) {
  const id = cleanId(task?.task_id);
  if (!id || visited.has(id)) return false;
  visited.add(id);

  return uniqueIds(task?.dependencies).some((candidateId) => {
    if (candidateId === dependencyTaskId) return true;
    return taskTransitivelyDependsOn(
      taskById.get(candidateId),
      dependencyTaskId,
      taskById,
      visited
    );
  });
}

function completedDependentLabels(tasks, dependencyTaskId) {
  const taskById = new Map(tasks.map((task) => [task.task_id, task]));
  return tasks
    .filter(
      (task) =>
        task.status === 'complete' &&
        taskTransitivelyDependsOn(
          task,
          dependencyTaskId,
          taskById,
          new Set()
        )
    )
    .map((task) => task.label);
}

function resolveToday(value) {
  return normalizeProductionDate(value) || normalizeProductionDate(new Date());
}

const EPISODE_PRODUCTION_TASK_DRAFT_FIELDS = [
  'evidence_note',
  'evidence_url',
  'due_date',
  'due_date_overridden',
  'assigned_person_ids',
];

export function mergeEpisodeProductionTaskDrafts(tasks = [], drafts = {}) {
  const sourceTasks = Array.isArray(tasks) ? tasks : [];
  const sourceDrafts =
    drafts && typeof drafts === 'object' && !Array.isArray(drafts)
      ? drafts
      : {};

  return sourceTasks.map((task) => {
    const draft = sourceDrafts[task?.task_id];
    if (!draft || typeof draft !== 'object' || Array.isArray(draft)) {
      return task;
    }

    const patch = {};
    for (const field of EPISODE_PRODUCTION_TASK_DRAFT_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(draft, field)) {
        patch[field] = draft[field];
      }
    }
    return Object.keys(patch).length ? { ...task, ...patch } : task;
  });
}

/**
 * Build the task-level health used by queues and automatic off-track notices.
 */
export function getEpisodeProductionPlanSummary(
  episode = {},
  options = {}
) {
  const airDate = resolveAirDate(episode);
  const productionTasks = normalizeEpisodeProductionTasks(
    episode.production_tasks,
    airDate,
    {
      episodeStatus: episode.status,
      migrationCompletedAt:
        episode.production_completed_at || episode.updated_at,
      migrationCompletedByPersonId:
        episode.production_advanced_by_person_id,
      migrationCompletedByName: episode.production_advanced_by_name,
    }
  );
  const normalizedEpisode = { ...episode, production_tasks: productionTasks };
  const taskById = new Map(
    productionTasks.map((task) => [task.task_id, task])
  );
  const comparisonTime = Object.prototype.hasOwnProperty.call(options, 'today')
    ? options.today
    : Object.prototype.hasOwnProperty.call(options, 'now')
      ? options.now
      : new Date();
  const todayDate = resolveToday(comparisonTime);
  const completionOptions = Object.prototype.hasOwnProperty.call(options, 'now')
    ? { now: options.now }
    : { today: todayDate };
  const taskStates = productionTasks.map((task) => {
    const complete = isEpisodeProductionTaskComplete(
      task,
      normalizedEpisode,
      completionOptions
    );
    const blockedByTaskIds = complete
      ? []
      : getDependencyBlockers(
          task,
          taskById,
          normalizedEpisode,
          completionOptions
        );
    const overdue = Boolean(
      task.required && !complete && task.due_date && task.due_date < todayDate
    );
    return {
      task_id: task.task_id,
      complete,
      overdue,
      blocked_by_task_ids: blockedByTaskIds,
    };
  });
  const stateById = new Map(taskStates.map((state) => [state.task_id, state]));
  const requiredTasks = productionTasks.filter((task) => task.required);
  const completedRequiredTasks = requiredTasks.filter(
    (task) => stateById.get(task.task_id)?.complete
  );
  const completedTasks = productionTasks.filter(
    (task) => stateById.get(task.task_id)?.complete
  );
  const overdueTaskIds = taskStates
    .filter((state) => state.overdue)
    .map((state) => state.task_id);
  const dependencyBlocking = taskStates
    .filter((state) => state.blocked_by_task_ids.length > 0)
    .map((state) => ({
      task_id: state.task_id,
      blocked_by_task_ids: state.blocked_by_task_ids,
    }));
  const availableIncompleteTasks = productionTasks
    .filter((task) => {
      const state = stateById.get(task.task_id);
      return task.required && !state.complete && !state.blocked_by_task_ids.length;
    })
    .sort((a, b) => {
      if (!a.due_date && b.due_date) return 1;
      if (a.due_date && !b.due_date) return -1;
      return a.due_date.localeCompare(b.due_date) || a.sort_order - b.sort_order;
    });
  const nextDueTask = availableIncompleteTasks[0] || null;

  return {
    schema_version: EPISODE_PRODUCTION_PLAN_SCHEMA_VERSION,
    air_date: airDate,
    today: todayDate,
    task_count: productionTasks.length,
    required_task_count: requiredTasks.length,
    completed_task_count: completedTasks.length,
    completed_required_task_count: completedRequiredTasks.length,
    completion_percent: requiredTasks.length
      ? Math.round((completedRequiredTasks.length / requiredTasks.length) * 100)
      : 100,
    next_due_task: nextDueTask,
    next_due_task_id: nextDueTask?.task_id || '',
    overdue_task_ids: overdueTaskIds,
    overdue_count: overdueTaskIds.length,
    off_track: overdueTaskIds.length > 0,
    dependency_blocking: dependencyBlocking,
    dependency_blocked_task_ids: dependencyBlocking.map(
      (entry) => entry.task_id
    ),
    has_dependency_blocking: dependencyBlocking.length > 0,
    task_states: taskStates,
  };
}

function normalizeRoles(value) {
  if (value instanceof Set) return new Set([...value].map((role) => cleanId(role)));
  const source = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? value.split(',')
      : [];
  return new Set(source.map((role) => cleanId(role)).filter(Boolean));
}

/** Resolve ownership without treating a generic producer as an assigned person. */
export function isEpisodeProductionTaskOwner(
  task = {},
  episode = {},
  personId = '',
  roles = []
) {
  const cleanPersonId = cleanId(personId);
  if (!cleanPersonId) return false;
  const roleSet = normalizeRoles(roles);
  if (roleSet.has('studio_manager') || roleSet.has('admin')) return true;

  const assignedIds = new Set(uniqueIds(task.assigned_person_ids));
  if (assignedIds.has(cleanPersonId)) return true;
  if (task.owner_type === 'person') return false;

  const hostIds = new Set(uniqueIds(episode.host_person_ids));
  const producerId = cleanId(episode.producer_person_id);
  const isHost = hostIds.has(cleanPersonId);
  const isProducer = producerId === cleanPersonId;

  if (task.owner_type === 'hosts') {
    return isHost || (!hostIds.size && roleSet.has('host'));
  }
  if (task.owner_type === 'producer') {
    return isProducer || (!producerId && roleSet.has('producer'));
  }
  if (task.owner_type === 'hosts_and_producer') {
    return (
      isHost ||
      isProducer ||
      (!hostIds.size && roleSet.has('host')) ||
      (!producerId && roleSet.has('producer'))
    );
  }
  return false;
}

function normalizeActor(actor = {}) {
  const roles = normalizeRoles(actor.roles || actor.role);
  return {
    person_id: cleanId(
      actor.person_id || actor.personId || actor.actor_person_id
    ),
    person_name: cleanText(
      actor.person_name || actor.personName || actor.actor_name || actor.name,
      180
    ),
    roles,
    can_manage:
      actor.can_manage === true ||
      actor.canManage === true ||
      roles.has('studio_manager') ||
      roles.has('admin'),
  };
}

function getAuditTimestamp(value) {
  return normalizeTimestamp(value) || new Date().toISOString();
}

function mergeSubtaskUpdates(currentSubtasks, patch, actor, completedAt) {
  const updates = Array.isArray(patch.subtasks) ? patch.subtasks : [];
  const oneUpdate = patch.subtask && typeof patch.subtask === 'object'
    ? [patch.subtask]
    : patch.subtask_id
      ? [
          {
            id: patch.subtask_id,
            completed: patch.subtask_completed === true,
          },
        ]
      : [];
  const updateById = new Map(
    [...updates, ...oneUpdate]
      .map((subtask) => [cleanId(subtask?.id || subtask?.subtask_id), subtask])
      .filter(([id]) => id)
  );
  return currentSubtasks.map((subtask) => {
    const update = updateById.get(subtask.id);
    if (!update) return subtask;
    const completed = update.completed === true || normalizeStatus(update.status) === 'complete';
    if (completed === subtask.completed) return subtask;
    return {
      ...subtask,
      completed,
      completed_at: completed ? completedAt : '',
      completed_by_person_id: completed ? actor.person_id : '',
      completed_by_name: completed ? actor.person_name : '',
    };
  });
}

function validateTaskCompletion(task, episode, taskById, options = {}) {
  if (task.status === 'waived') return;
  const dependencyBlockers = getDependencyBlockers(
    task,
    taskById,
    episode,
    options
  );
  if (dependencyBlockers.length) {
    throw new Error(
      `Episode production: complete ${dependencyBlockers.join(', ')} before ${task.label}.`
    );
  }
  if (isEpisodeProductionTaskComplete(task, episode, options)) return;

  if (task.task_id === 'intro-ready') {
    if (task.intro_method === 'recorded') {
      throw new Error(
        'Episode production: choose the recorded intro from the raw recording uploads before completing this step.'
      );
    }
    if (task.intro_method === 'scheduled_with_producer') {
      throw new Error(
        'Episode production: schedule the producer recording no later than seventeen days before air.'
      );
    }
    throw new Error(
      'Episode production: choose a recorded intro or a scheduled recording with the producer.'
    );
  }
  if (task.task_id === MICROPHONE_PLAN_TASK_ID) {
    throw new Error(
      'Episode production: every assigned host and any connected guest must complete the microphone plan before completing this step.'
    );
  }
  if (task.task_id === 'producer-proof-upload') {
    throw new Error(
      'Episode production: upload the private proof audio before completing this step.'
    );
  }
  if (task.task_id === 'proof-listen-approval') {
    throw new Error(
      'Episode production: the private proof must be uploaded and approved before completing this step.'
    );
  }
  if (task.task_id === PHOTO_SELECTION_PRODUCTION_TASK_ID) {
    throw new Error(
      'Episode production: choose, order, and confirm exactly three final photos before completing this step.'
    );
  }
  if (task.kind === 'bundle') {
    throw new Error(
      'Episode production: complete every required subcheck before completing this step.'
    );
  }
  throw new Error('Episode production: this step is not ready to complete.');
}

/**
 * Apply one task patch and write an immutable completion audit. Authorization is
 * intentionally left to the API; this helper validates workflow correctness.
 */
export function applyEpisodeProductionTaskUpdate(
  episode = {},
  taskId,
  patch = {},
  actor = {},
  { now = new Date(), allowCompletedDependents = false } = {}
) {
  const requestedTaskId = cleanId(taskId);
  if (!requestedTaskId) {
    throw new Error('Episode production: a task ID is required.');
  }
  const update = patch?.task && typeof patch.task === 'object' ? patch.task : patch;
  if (!update || typeof update !== 'object') {
    throw new Error('Episode production: a task update is required.');
  }

  const airDate = resolveAirDate(episode);
  const tasks = normalizeEpisodeProductionTasks(episode.production_tasks, airDate);
  const taskIndex = tasks.findIndex((task) => task.task_id === requestedTaskId);
  if (taskIndex < 0) {
    throw new Error(`Episode production: unknown task "${requestedTaskId}".`);
  }

  const normalizedActor = normalizeActor(actor);
  const completedAt = getAuditTimestamp(now);
  const current = tasks[taskIndex];
  const next = { ...current };

  if (Object.prototype.hasOwnProperty.call(update, 'assigned_person_ids')) {
    next.assigned_person_ids = uniqueIds(update.assigned_person_ids);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'evidence_note') ||
      Object.prototype.hasOwnProperty.call(update, 'note')) {
    next.evidence_note = cleanText(update.evidence_note ?? update.note, 2400);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'evidence_asset_id')) {
    next.evidence_asset_id = cleanId(update.evidence_asset_id);
  }
  if (Object.prototype.hasOwnProperty.call(update, 'evidence_url')) {
    const evidenceUrl = cleanText(update.evidence_url, 2000);
    if (evidenceUrl && !isSafeEvidenceUrl(evidenceUrl)) {
      throw new Error('Episode production: evidence links must use HTTPS.');
    }
    if (requestedTaskId === 'guest-assets-shared' && isSpotifyUrl(evidenceUrl)) {
      throw new Error(
        'Episode production: never share a private Spotify staging link with a guest. Use an approved Google Drive file instead.'
      );
    }
    next.evidence_url = evidenceUrl;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'intro_method')) {
    next.intro_method = normalizeIntroMethod(update.intro_method, {
      acceptLegacy: false,
    });
    if (next.intro_method === 'recorded') next.intro_scheduled_for = '';
    if (next.intro_method === 'scheduled_with_producer') {
      next.evidence_asset_id = '';
    }
  }
  if (Object.prototype.hasOwnProperty.call(update, 'intro_scheduled_for')) {
    const scheduledFor = normalizeProductionDate(update.intro_scheduled_for);
    if (update.intro_scheduled_for && !scheduledFor) {
      throw new Error('Episode production: choose a valid intro recording date.');
    }
    next.intro_scheduled_for = scheduledFor;
  }
  if (Object.prototype.hasOwnProperty.call(update, 'proof_decision')) {
    const requestedDecision = cleanText(update.proof_decision, 40).toLowerCase();
    if (!['pending', 'approved', 'changes_requested'].includes(requestedDecision)) {
      throw new Error('Episode production: choose a valid proof decision.');
    }
    next.proof_decision = requestedDecision;
  }

  const hasDueDatePatch = Object.prototype.hasOwnProperty.call(update, 'due_date');
  const clearsOverride = update.due_date_overridden === false;
  if (update.due_date_overridden === true && !hasDueDatePatch) {
    throw new Error(
      'Episode production: add the custom task deadline before saving it.'
    );
  }
  if (hasDueDatePatch && !clearsOverride) {
    const requestedDueDate = normalizeProductionDate(update.due_date);
    if (!requestedDueDate) {
      throw new Error('Episode production: choose a valid task deadline.');
    }
    next.due_date = requestedDueDate;
    next.due_date_overridden = true;
  } else if (clearsOverride) {
    next.due_date = getProductionDueDate(airDate, next.days_before_air);
    next.due_date_overridden = false;
  }

  const hasSubtaskPatch =
    Array.isArray(update.subtasks) ||
    Boolean(update.subtask) ||
    Boolean(update.subtask_id);
  if (hasSubtaskPatch) {
    next.subtasks = mergeSubtaskUpdates(
      current.subtasks,
      update,
      normalizedActor,
      completedAt
    );
  }

  if (Object.prototype.hasOwnProperty.call(update, 'status')) {
    const requestedStatus = cleanText(update.status, 40).toLowerCase();
    const recognized = [
      ...EPISODE_PRODUCTION_TASK_STATUSES,
      'completed',
      'done',
      'started',
      'active',
      'blocked',
    ];
    if (!recognized.includes(requestedStatus)) {
      throw new Error('Episode production: choose a valid task status.');
    }
    next.status = normalizeStatus(requestedStatus);
  } else if (hasSubtaskPatch && next.kind === 'bundle') {
    const anyCompleted = next.subtasks.some((subtask) => subtask.completed);
    next.status = requiredSubtasksComplete(next)
      ? 'complete'
      : anyCompleted
        ? 'in_progress'
        : 'not_started';
  }

  const wasFinishedBeforeUpdate = ['complete', 'waived'].includes(
    current.status
  );
  const isFinishedAfterUpdate = ['complete', 'waived'].includes(next.status);
  if (wasFinishedBeforeUpdate && !isFinishedAfterUpdate) {
    const dependentLabels = completedDependentLabels(
      tasks,
      requestedTaskId
    );
    if (dependentLabels.length && !allowCompletedDependents) {
      throw new Error(
        `Episode production: reopen completed dependent steps (${dependentLabels.join(', ')}) before reopening ${current.label}.`
      );
    }
  }

  if (requestedTaskId === 'proof-listen-approval') {
    if (next.status === 'complete' && next.proof_decision === 'approved') {
      const currentProofTask = tasks.find(
        (task) => task.task_id === 'producer-proof-upload'
      );
      next.evidence_asset_id = cleanId(currentProofTask?.evidence_asset_id);
    } else if (next.status !== 'complete') {
      next.evidence_asset_id = '';
    }
  }

  const wasFinished = wasFinishedBeforeUpdate;
  const isFinished = isFinishedAfterUpdate;
  const completedEvidenceChanged =
    next.status === 'complete' &&
    cleanId(next.evidence_asset_id) !== cleanId(current.evidence_asset_id);
  if (isFinished && (!wasFinished || completedEvidenceChanged)) {
    next.completed_at = completedAt;
    next.completed_by_person_id = normalizedActor.person_id;
    next.completed_by_name = normalizedActor.person_name;
  } else if (!isFinished) {
    next.completed_at = '';
    next.completed_by_person_id = '';
    next.completed_by_name = '';
  }

  if (
    next.evidence_asset_id &&
    !getAssets(episode).some(
      (asset) => cleanId(asset?.asset_id || asset?.id) === next.evidence_asset_id
    )
  ) {
    throw new Error('Episode production: the evidence file is not attached to this episode.');
  }

  const nextTasks = tasks.map((task, index) => (index === taskIndex ? next : task));
  const nextEpisode = { ...episode, production_tasks: nextTasks };
  const nextTaskById = new Map(nextTasks.map((task) => [task.task_id, task]));
  if (next.status === 'complete') {
    validateTaskCompletion(next, nextEpisode, nextTaskById, {
      now: completedAt,
    });
  }

  return nextEpisode;
}
