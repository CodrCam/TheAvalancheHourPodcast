import {
  EPISODE_ASSET_CATEGORIES,
  MAX_EPISODE_ASSETS,
  canUploadEpisodeAssets,
  resetProducerProofApprovalForNewAsset,
} from './episodeAssetPolicy.mjs';
import {
  normalizeRecordingDate,
  normalizeRecordingDuration,
  normalizeRecordingTime,
  normalizeRecordingTimeZone,
  validateRecordingSchedule,
} from './episodeCalendar.mjs';
import {
  getProductionDueDate,
  getEpisodeProductionPlanSummary,
  normalizeEpisodeProductionTasks,
  recalculateEpisodeProductionTaskDates,
} from './episodeProductionPlan.mjs';
import {
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  getEpisodeMicKitPlanCompletion,
  normalizeEpisodeGuestMicKitPlan,
  normalizeEpisodeMicKitPlans,
} from './episodeMicKitPresentation.mjs';
import {
  EPISODE_PHOTO_DELIVERABLE_ID,
  buildEpisodePhotoSelection,
  createEmptyEpisodePhotoSelection,
  isEpisodePhotoSelectionConfirmed,
  normalizeEpisodePhotoSelection,
  removeAssetFromEpisodePhotoSelection,
  sanitizeEpisodePhotoSelectionForViewer,
} from './episodePhotoSelection.mjs';

export const EPISODE_STUDIO_STATUSES = [
  'planning',
  'in_progress',
  'submitted',
  'submitted_with_gaps',
  'needs_changes',
  'accepted',
];

export const PRODUCER_DIRECTIONS_MIN_LENGTH = 80;
export const EPISODE_DELIVERY_HEALTH = ['on_track', 'off_track'];
export const EPISODE_ASSET_RETENTION_DAYS = 180;
export const EPISODE_STUDIO_SCHEMA_VERSION = 9;
const EPISODE_DELIVERABLE_MIGRATION_VERSION = 3;
const EPISODE_EARLIER_HOST_DEADLINE_VERSION = 8;
export const EPISODE_PRODUCTION_STAGES = [
  'host_preparation',
  'producer_review',
  'lead_review',
  'complete',
];

export const DEFAULT_EPISODE_DELIVERABLES = [
  {
    id: 'episode-pitch',
    label: 'Episode pitch and listener takeaway',
    description:
      'Explain the story, why it matters now, and what the listener should learn.',
    type: 'textarea',
    required: true,
    sort_order: 10,
  },
  {
    id: 'guest-details',
    label: 'Guest details',
    description:
      'Include the guest’s name, title or affiliation, contact details, a short biography, and their public social profiles or handles.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 20,
  },
  {
    id: EPISODE_MIC_KIT_DELIVERABLE_ID,
    label: 'Microphone plan',
    description:
      'Confirm the recording setup for every assigned host and the connected guest. Host plans identify a kit request or tested equipment; a submitted guest questionnaire supplies the guest plan.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 25,
  },
  {
    id: 'episode-folder',
    label: 'Previous general source files',
    description:
      'This general upload step is retained only for episodes created with the earlier form. New files belong in their matching workflow step.',
    type: 'asset',
    required: false,
    asset_category: 'other',
    sort_order: 30,
  },
  {
    id: 'recording-files',
    label: 'Raw recording tracks',
    description:
      'Upload every final local audio track after Riverside or the recording platform finishes processing it. Keep filenames clear and distinct.',
    type: 'asset',
    required: true,
    asset_category: 'recording',
    sort_order: 40,
  },
  {
    id: 'edit-notes',
    label: 'First cut or timestamped edit notes',
    description:
      'Enter the timestamped edit plan here and attach any supporting cut, transcript, or edit document directly to this step.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 50,
  },
  {
    id: 'show-notes',
    label: 'Show-notes and promotion brief',
    description:
      'Give the producer and publishing owner the episode summary, key takeaways, guest biography, public links and handles, credits, title ideas, and anything that should not be published. The publishing owner drafts the final public copy.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 60,
  },
  {
    id: 'intro-audio',
    label: 'Recorded introduction',
    description:
      'Use this upload only when you record the introduction yourself. If you send the script and schedule the producer instead, record that date in the production timeline; no host audio upload is required.',
    type: 'asset',
    required: false,
    asset_category: 'sponsor_audio',
    sort_order: 70,
  },
  {
    id: 'social-copy',
    label: 'Promotion source material',
    description:
      'Provide accurate handles, two to four takeaways, suggested excerpts or timestamps, and any no-tag or privacy request. The assigned publishing owner prepares and schedules the final channel copy.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 80,
  },
  {
    id: 'photos',
    label: 'Photos and artwork',
    description:
      'Collect 5–6 clearly named candidate images when possible. Choose and order exactly three final images, flag crop or editing needs, and confirm caption, credit, permission, and anything to avoid before the publishing brief is complete.',
    type: 'asset',
    required: true,
    asset_category: 'image',
    sort_order: 90,
  },
  {
    id: 'credits',
    label: 'Credits and permissions',
    description:
      'List photographers, music, artwork, and any usage permissions the producer should know.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 100,
  },
  {
    id: 'producer-proof-audio',
    label: 'Private producer proof',
    description:
      'The producer uploads the private proof here for the assigned host to download, listen to, and approve inside Episode Studio.',
    type: 'asset',
    required: false,
    asset_category: 'recording',
    section: 'producer_proof',
    allowed_uploader: 'producer',
    sort_order: 110,
  },
];

const DEFAULT_DELIVERABLES_BY_ID = new Map(
  DEFAULT_EPISODE_DELIVERABLES.map((deliverable) => [
    deliverable.id,
    deliverable,
  ])
);

export const REQUIRED_EPISODE_DELIVERABLE_IDS = Object.freeze([
  'guest-details',
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  'photos',
]);
export const MAX_EPISODE_DELIVERABLES = 40;

function restoreRequiredEpisodeDeliverables(
  deliverables = [],
  existingById = new Map()
) {
  const source = Array.isArray(deliverables) ? deliverables : [];
  const sourceById = new Map(
    source.map((deliverable) => [cleanId(deliverable?.id), deliverable])
  );
  const restored = source.slice(0, MAX_EPISODE_DELIVERABLES);
  for (const id of REQUIRED_EPISODE_DELIVERABLE_IDS) {
    if (restored.some((deliverable) => cleanId(deliverable?.id) === id)) {
      continue;
    }
    const template = DEFAULT_DELIVERABLES_BY_ID.get(id);
    const existing = existingById.get(id) || sourceById.get(id);
    if (restored.length >= MAX_EPISODE_DELIVERABLES) {
      let removableIndex = -1;
      for (let index = restored.length - 1; index >= 0; index -= 1) {
        if (
          !REQUIRED_EPISODE_DELIVERABLE_IDS.includes(
            cleanId(restored[index]?.id)
          )
        ) {
          removableIndex = index;
          break;
        }
      }
      if (removableIndex >= 0) restored.splice(removableIndex, 1);
    }
    restored.push({
      ...template,
      ...(existing || {}),
      required:
        id === EPISODE_MIC_KIT_DELIVERABLE_ID
          ? true
          : existing?.required === true,
      value: existing?.value || '',
      social_profiles: existing?.social_profiles || '',
      ...(id === 'guest-details'
        ? {
            guest_profile:
              existing?.guest_profile || createEmptyGuestProfile(),
          }
        : {}),
      ...(id === EPISODE_MIC_KIT_DELIVERABLE_ID
        ? {
            mic_kit_plans: existing?.mic_kit_plans || [],
            guest_mic_kit_plan:
              existing?.guest_mic_kit_plan || {},
          }
        : {}),
      ...(id === EPISODE_PHOTO_DELIVERABLE_ID
        ? {
            photo_selection:
              existing?.photo_selection || createEmptyEpisodePhotoSelection(),
          }
        : {}),
      legacy_source_url: existing?.legacy_source_url || '',
    });
  }
  return restored;
}

const LEGACY_NAMED_DELIVERABLE_COPY_BY_ID = Object.freeze({
  [EPISODE_MIC_KIT_DELIVERABLE_ID]: Object.freeze({
    labels: Object.freeze({}),
    descriptions: Object.freeze({
      'Each assigned host confirms whether they will request an Avalanche Hour microphone kit, use their own tested microphone and headphones, or do not need a kit for this episode.':
        'Confirm the recording setup for every assigned host and the connected guest. Host plans identify a kit request or tested equipment; a submitted guest questionnaire supplies the guest plan.',
    }),
  }),
  'intro-audio': Object.freeze({
    labels: Object.freeze({
      'Record with Angie': 'Record with the assigned producer',
      'Record the intro or schedule it with Angie':
        'Record the intro or schedule it with the producer',
    }),
    descriptions: Object.freeze({
      'Send the script to Angie, then give Sierra the assets.':
        'Send the script to the assigned producer, then give the publishing owner the assets.',
      'Either upload a finished intro or send the script and record a meeting date with Angie. The recording session must occur no later than seven days before air.':
        'Either upload a finished intro or send the script and record a meeting date with the assigned producer. The recording session must occur no later than ten days before air.',
    }),
  }),
  'show-notes': Object.freeze({
    labels: Object.freeze({
      'Send Sierra or Angie the show-notes request':
        'Show-notes and promotion brief',
      'Host sends Sierra/Angie shownotes requests':
        'Show-notes and promotion brief',
    }),
    descriptions: Object.freeze({
      'Give Sierra and Angie the episode summary, takeaways, guest links and handles, image guidance, credits, and anything that must not be published.':
        'Give the producer and publishing owner the episode summary, key takeaways, guest biography, public links and handles, credits, title ideas, and anything that should not be published. The publishing owner drafts the final public copy.',
    }),
  }),
  photos: Object.freeze({
    labels: Object.freeze({}),
    descriptions: Object.freeze({
      'Upload 2–6 clearly named images. Identify the cover, preferred order, intended use, crop, caption, credit, permission, and anything to avoid in the producer handoff.':
        'Collect 5–6 clearly named candidate images when possible. Choose and order exactly three final images, flag crop or editing needs, and confirm caption, credit, permission, and anything to avoid before the publishing brief is complete.',
    }),
  }),
  'producer-proof-audio': Object.freeze({
    labels: Object.freeze({
      'Angie adds the mid-roll and outro': 'Private producer proof',
      'Angie adds mid-roll + outro and sends the final audio edit':
        'Private producer proof',
    }),
    descriptions: Object.freeze({
      'Angie adds the mid-roll and outro, then uploads the private final proof/master for the host to download and review.':
        'The producer adds the mid-roll and outro, then uploads the private final proof/master for the host to download and review.',
    }),
  }),
});

const LEGACY_ASSET_DELIVERABLE_BY_CATEGORY = {
  recording: 'recording-files',
  image: 'photos',
  document: 'episode-folder',
  sponsor_audio: 'intro-audio',
};

function cleanText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

export function createEmptyGuestProfile() {
  return {
    name: '',
    title_affiliation: '',
    contact_email: '',
    contact_phone: '',
    short_bio: '',
    website: '',
    instagram: '',
    facebook: '',
    linkedin: '',
    x_twitter: '',
    youtube: '',
    tiktok: '',
    other: '',
    no_public_profiles: false,
  };
}

export function normalizeGuestProfile(value = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return {
    name: cleanText(source.name, 180),
    title_affiliation: cleanText(source.title_affiliation, 300),
    contact_email: cleanText(source.contact_email, 254),
    contact_phone: cleanText(source.contact_phone, 100),
    short_bio: cleanText(source.short_bio, 4000),
    website: cleanText(source.website, 1000),
    instagram: cleanText(source.instagram, 1000),
    facebook: cleanText(source.facebook, 1000),
    linkedin: cleanText(source.linkedin, 1000),
    x_twitter: cleanText(source.x_twitter, 1000),
    youtube: cleanText(source.youtube, 1000),
    tiktok: cleanText(source.tiktok, 1000),
    other: cleanText(source.other, 2000),
    no_public_profiles: source.no_public_profiles === true,
  };
}

const GUEST_PROFILE_HTTPS_ONLY_FIELDS = new Set([
  'website',
  'linkedin',
]);

const GUEST_PROFILE_HANDLE_OR_HTTPS_FIELDS = new Set([
  'instagram',
  'facebook',
  'x_twitter',
  'youtube',
  'tiktok',
  'other',
]);

export function isValidGuestContactEmail(value = '') {
  const email = cleanText(value, 254);
  return !email || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

export function isValidGuestHttpsUrl(value = '') {
  const input = cleanText(value, 2000);
  if (!input || !/^https:\/\//i.test(input)) return false;

  try {
    const url = new URL(input);
    return Boolean(
      url.protocol === 'https:' &&
        url.hostname &&
        !url.username &&
        !url.password
    );
  } catch {
    return false;
  }
}

export function isValidGuestSocialHandle(value = '') {
  const handle = cleanText(value, 200);
  return /^@[a-z0-9][a-z0-9._-]{0,99}$/i.test(handle);
}

export function isValidGuestProfileEntry(field, value = '') {
  const input = cleanText(value, field === 'other' ? 2000 : 1000);
  if (!input) return true;
  if (GUEST_PROFILE_HTTPS_ONLY_FIELDS.has(field)) {
    return isValidGuestHttpsUrl(input);
  }
  if (GUEST_PROFILE_HANDLE_OR_HTTPS_FIELDS.has(field)) {
    return isValidGuestSocialHandle(input) || isValidGuestHttpsUrl(input);
  }
  return true;
}

export function getGuestProfileFieldErrors(value = {}) {
  const profile = normalizeGuestProfile(value);
  const errors = {};

  if (!isValidGuestContactEmail(profile.contact_email)) {
    errors.contact_email = 'Enter a valid email address.';
  }

  for (const field of GUEST_PROFILE_HTTPS_ONLY_FIELDS) {
    if (!isValidGuestProfileEntry(field, profile[field])) {
      errors[field] = 'Use a complete HTTPS link.';
    }
  }

  for (const field of GUEST_PROFILE_HANDLE_OR_HTTPS_FIELDS) {
    if (!isValidGuestProfileEntry(field, profile[field])) {
      errors[field] = 'Use an @handle or a complete HTTPS link.';
    }
  }

  return errors;
}

export function isGuestProfileValid(value = {}) {
  const profile = normalizeGuestProfile(value);
  const errors = getGuestProfileFieldErrors(profile);
  if (profile.no_public_profiles) {
    return !errors.contact_email;
  }
  return Object.keys(errors).length === 0;
}

function cleanId(value, fallback = '') {
  return (
    String(value || fallback)
      .toLowerCase()
      .trim()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 120) || fallback
  );
}

function normalizeDate(value) {
  const date = cleanText(value, 30);
  if (!date) return '';
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

export function getEpisodeAssetRetentionExpiresAt(
  uploadedAt,
  retentionDays = EPISODE_ASSET_RETENTION_DAYS
) {
  const uploaded = new Date(String(uploadedAt || ''));
  const requestedDays = Number(retentionDays);
  const days =
    Number.isFinite(requestedDays) && requestedDays > 0
      ? Math.trunc(requestedDays)
      : EPISODE_ASSET_RETENTION_DAYS;
  if (Number.isNaN(uploaded.getTime())) return '';
  uploaded.setUTCDate(uploaded.getUTCDate() + days);
  return uploaded.toISOString();
}

export function isEpisodeAssetExpired(asset = {}, now = new Date()) {
  const expiresAt = new Date(String(asset.retention_expires_at || ''));
  const comparison = now instanceof Date ? now : new Date(now);
  return (
    !Number.isNaN(expiresAt.getTime()) &&
    !Number.isNaN(comparison.getTime()) &&
    expiresAt.getTime() <= comparison.getTime()
  );
}

export function isSafeEpisodeMaterialUrl(value) {
  const url = cleanText(value, 2000);
  if (!url) return false;

  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

export function isSafeSpotifyStagingUrl(value) {
  const url = cleanText(value, 2000);
  if (!url) return false;

  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname.toLowerCase();
    return (
      parsed.protocol === 'https:' &&
      (hostname === 'spotify.com' ||
        hostname.endsWith('.spotify.com') ||
        hostname === 'spotify.link')
    );
  } catch {
    return false;
  }
}

function normalizeDeliverable(value = {}, index = 0, hostPersonIds = []) {
  const id = cleanId(value.id, `deliverable-${index + 1}`);
  const requiredTemplate = REQUIRED_EPISODE_DELIVERABLE_IDS.includes(id)
    ? DEFAULT_DELIVERABLES_BY_ID.get(id)
    : null;
  const type = requiredTemplate?.type ||
    (['url', 'asset'].includes(value.type) ? value.type : 'textarea');
  const requestedAssetCategory = EPISODE_ASSET_CATEGORIES.includes(
    value.asset_category
  )
    ? value.asset_category
    : 'document';
  const assetCategory =
    requiredTemplate?.asset_category ||
    (id === 'episode-folder' ? 'other' : requestedAssetCategory);
  const sortOrder = Number(value.sort_order);

  return {
    id,
    label: cleanText(value.label, 180),
    description: cleanText(value.description, 800),
    type,
    asset_category: assetCategory,
    section:
      value.section === 'producer_proof' || id === 'producer-proof-audio'
        ? 'producer_proof'
        : 'host',
    allowed_uploader:
      value.allowed_uploader === 'producer' || id === 'producer-proof-audio'
        ? 'producer'
        : 'episode_participant',
    required:
      id === EPISODE_MIC_KIT_DELIVERABLE_ID ? true : value.required !== false,
    value: cleanText(value.value, type === 'url' ? 2000 : 12000),
    social_profiles: cleanText(value.social_profiles, 3000),
    ...(id === 'guest-details'
      ? { guest_profile: normalizeGuestProfile(value.guest_profile) }
      : {}),
    ...(id === EPISODE_MIC_KIT_DELIVERABLE_ID
      ? {
          mic_kit_plans: normalizeEpisodeMicKitPlans(
            value.mic_kit_plans,
            hostPersonIds
          ),
          guest_mic_kit_plan: normalizeEpisodeGuestMicKitPlan(
            value.guest_mic_kit_plan
          ),
        }
      : {}),
    ...(id === EPISODE_PHOTO_DELIVERABLE_ID
      ? {
          photo_selection: normalizeEpisodePhotoSelection(
            value.photo_selection
          ),
        }
      : {}),
    legacy_source_url: isSafeEpisodeMaterialUrl(value.legacy_source_url)
      ? cleanText(value.legacy_source_url, 2000)
      : '',
    missing_acknowledged: value.missing_acknowledged === true,
    missing_note: cleanText(value.missing_note, 1200),
    expected_by: normalizeDate(value.expected_by),
    sort_order: Number.isFinite(sortOrder)
      ? Math.trunc(sortOrder)
      : (index + 1) * 10,
  };
}

function migrateLegacyDeliverable(value = {}) {
  const id = cleanId(value.id);
  const modernDefault = DEFAULT_DELIVERABLES_BY_ID.get(id);
  if (!modernDefault) return value;

  const legacyUrl =
    value.type === 'url' && isSafeEpisodeMaterialUrl(value.value)
      ? value.value
      : value.legacy_source_url;
  return {
    ...value,
    label: modernDefault.label,
    description: modernDefault.description,
    type: modernDefault.type,
    required: modernDefault.required,
    asset_category: modernDefault.asset_category || 'document',
    section: modernDefault.section || value.section,
    allowed_uploader:
      modernDefault.allowed_uploader || value.allowed_uploader,
    value:
      value.type === 'url' && modernDefault.type !== 'url'
        ? ''
        : value.value,
    legacy_source_url: legacyUrl,
  };
}

function migrateBuiltInDeliverableRoleCopy(value = {}) {
  const id = cleanId(value.id);
  const migration = LEGACY_NAMED_DELIVERABLE_COPY_BY_ID[id];
  if (!migration) return value;

  const label = cleanText(value.label, 180);
  const description = cleanText(value.description, 800);

  return {
    ...value,
    label: migration.labels[label] || value.label,
    description: migration.descriptions[description] || value.description,
  };
}

function normalizeMessage(value = {}, index = 0) {
  return {
    message_id: cleanId(value.message_id, `message-${index + 1}`),
    body: cleanText(value.body, 2400),
    author_name: cleanText(value.author_name, 180),
    author_role: ['host', 'producer', 'studio_manager', 'creator'].includes(
      value.author_role
    )
      ? value.author_role
      : 'host',
    created_at: cleanText(value.created_at, 50),
  };
}

function normalizeSponsorReadAssignment(value = {}, index = 0) {
  const requiresAudio = value.requires_audio === true;
  const audioUrl = cleanText(value.audio_url, 2000);
  const audioAssetId = cleanId(value.audio_asset_id);
  const recordingMode =
    value.recording_mode === 'included_in_voice_file'
      ? 'included_in_voice_file'
      : 'separate_upload';
  const completed = requiresAudio
    ? value.completed === true &&
      (Boolean(audioAssetId) || isSafeEpisodeMaterialUrl(audioUrl))
    : value.completed !== false;

  return {
    assignment_id: cleanId(
      value.assignment_id,
      `sponsor-read-assignment-${index + 1}`
    ),
    sponsor_read_id: cleanId(value.sponsor_read_id),
    sponsor_id: cleanId(value.sponsor_id),
    sponsor_name: cleanText(value.sponsor_name, 180),
    script_title: cleanText(value.script_title, 220),
    approved_text: cleanText(value.approved_text, 12000),
    pronunciation_guidance: cleanText(
      value.pronunciation_guidance,
      3000
    ),
    host_instructions: cleanText(value.host_instructions, 3000),
    effective_date: normalizeDate(value.effective_date),
    expiration_date: normalizeDate(value.expiration_date),
    version_number: Math.max(
      1,
      Math.trunc(Number(value.version_number) || 1)
    ),
    source_state: ['draft', 'approved', 'expired', 'retired'].includes(
      value.source_state
    )
      ? value.source_state
      : 'approved',
    requires_audio: requiresAudio,
    recording_mode: recordingMode,
    audio_asset_id: audioAssetId,
    audio_url: isSafeEpisodeMaterialUrl(audioUrl) ? audioUrl : '',
    completed,
    assigned_at: cleanText(value.assigned_at, 50),
    assigned_by_person_id: cleanId(value.assigned_by_person_id),
    assigned_by_name: cleanText(value.assigned_by_name, 180),
    completed_at: completed ? cleanText(value.completed_at, 50) : '',
    completed_by_person_id: completed
      ? cleanId(value.completed_by_person_id)
      : '',
    completed_by_name: completed
      ? cleanText(value.completed_by_name, 180)
      : '',
  };
}

function normalizeEpisodeAsset(value = {}, index = 0) {
  const category = [
    'recording',
    'image',
    'document',
    'sponsor_audio',
    'other',
  ].includes(value.category)
    ? value.category
    : 'other';
  const uploadedAt = cleanText(value.uploaded_at, 50);
  const retentionDays = Math.max(
    1,
    Math.min(
      3650,
      Math.trunc(
        Number(value.retention_days) || EPISODE_ASSET_RETENTION_DAYS
      )
    )
  );
  const retentionExpiresAt =
    cleanText(value.retention_expires_at, 50) ||
    getEpisodeAssetRetentionExpiresAt(uploadedAt, retentionDays);
  return {
    asset_id: cleanId(value.asset_id, `asset-${index + 1}`),
    object_key: cleanText(value.object_key, 800),
    object_version_id: cleanText(value.object_version_id, 1024),
    file_name: cleanText(value.file_name, 180),
    content_type: cleanText(value.content_type, 160).toLowerCase(),
    size: Math.max(0, Math.trunc(Number(value.size) || 0)),
    category,
    label: cleanText(value.label, 220),
    notes: cleanText(value.notes, 2000),
    deliverable_id: cleanId(value.deliverable_id),
    uploaded_at: uploadedAt,
    uploaded_by_person_id: cleanId(value.uploaded_by_person_id),
    uploaded_by_name: cleanText(value.uploaded_by_name, 180),
    retention_days: retentionDays,
    retention_expires_at: retentionExpiresAt,
    status: value.status === 'uploaded' ? 'uploaded' : 'uploaded',
  };
}

export function createDefaultEpisodeDeliverables() {
  return DEFAULT_EPISODE_DELIVERABLES.filter(
    (deliverable) => deliverable.id !== 'episode-folder'
  ).map((deliverable) => ({
    ...deliverable,
    value: '',
    social_profiles: '',
    ...(deliverable.id === 'guest-details'
      ? { guest_profile: createEmptyGuestProfile() }
      : {}),
    ...(deliverable.id === EPISODE_MIC_KIT_DELIVERABLE_ID
      ? {
          mic_kit_plans: [],
          guest_mic_kit_plan: normalizeEpisodeGuestMicKitPlan(),
        }
      : {}),
    ...(deliverable.id === EPISODE_PHOTO_DELIVERABLE_ID
      ? { photo_selection: createEmptyEpisodePhotoSelection() }
      : {}),
    legacy_source_url: '',
  }));
}

export function normalizeEpisodeStudio(value = {}, fallback = {}) {
  const sourceSchemaVersion = Math.max(
    1,
    Math.trunc(
      Number(value.schema_version || fallback.schema_version) || 1
    )
  );
  const normalizedHostPersonIds = [
    ...new Set(
      (Array.isArray(value.host_person_ids)
        ? value.host_person_ids
        : fallback.host_person_ids || []
      )
        .map((personId) => cleanId(personId))
        .filter(Boolean)
    ),
  ].slice(0, 5);
  const migratedSourceDeliverables = (
    Array.isArray(value.deliverables)
      ? value.deliverables
      : Array.isArray(fallback.deliverables)
        ? fallback.deliverables
        : createDefaultEpisodeDeliverables()
  ).map((deliverable) =>
    migrateBuiltInDeliverableRoleCopy(
      sourceSchemaVersion < EPISODE_DELIVERABLE_MIGRATION_VERSION
        ? migrateLegacyDeliverable(deliverable)
        : deliverable
    )
  );
  const sourceDeliverables = restoreRequiredEpisodeDeliverables(
    migratedSourceDeliverables
  );
  const normalizedDeliverables = sourceDeliverables
    .slice(0, MAX_EPISODE_DELIVERABLES)
    .map((deliverable, index) =>
      normalizeDeliverable(deliverable, index, normalizedHostPersonIds)
    )
    .sort(
      (a, b) =>
        a.sort_order - b.sort_order || a.label.localeCompare(b.label)
    );
  const deliverableIds = new Set(
    normalizedDeliverables.map((deliverable) => deliverable.id)
  );
  const normalizedAssets = (
    Array.isArray(value.assets)
      ? value.assets
      : Array.isArray(fallback.assets)
        ? fallback.assets
        : []
  )
    .slice(0, MAX_EPISODE_ASSETS)
    .map(normalizeEpisodeAsset)
    .filter(
      (asset) =>
        asset.asset_id &&
        asset.object_key &&
        asset.file_name &&
        asset.content_type &&
        asset.size > 0
    )
    .map((asset) => {
      if (asset.deliverable_id) return asset;
      const mappedDeliverable =
        LEGACY_ASSET_DELIVERABLE_BY_CATEGORY[asset.category] || '';
      return mappedDeliverable && deliverableIds.has(mappedDeliverable)
        ? { ...asset, deliverable_id: mappedDeliverable }
        : asset;
    });
  const status = EPISODE_STUDIO_STATUSES.includes(value.status)
    ? value.status
    : EPISODE_STUDIO_STATUSES.includes(fallback.status)
      ? fallback.status
      : 'planning';
  const deliveryHealth = Object.prototype.hasOwnProperty.call(
    value,
    'delivery_health'
  )
    ? value.delivery_health === 'off_track'
      ? 'off_track'
      : 'on_track'
    : fallback.delivery_health === 'off_track'
      ? 'off_track'
      : 'on_track';
  const defaultProductionStage =
    status === 'accepted'
      ? 'complete'
      : ['submitted', 'submitted_with_gaps'].includes(status)
        ? 'producer_review'
        : 'host_preparation';
  const requestedProductionStage = Object.prototype.hasOwnProperty.call(
    value,
    'production_stage'
  )
    ? value.production_stage
    : fallback.production_stage;
  const productionStage = EPISODE_PRODUCTION_STAGES.includes(
    requestedProductionStage
  )
    ? requestedProductionStage
    : defaultProductionStage;
  const recordingValue = (field) =>
    Object.prototype.hasOwnProperty.call(value, field)
      ? value[field]
      : fallback[field];
  const targetReleaseDate =
    normalizeDate(value.target_release_date) ||
    normalizeDate(fallback.target_release_date);
  const sourceDueDate =
    normalizeDate(value.due_date) || normalizeDate(fallback.due_date);
  const dueDate =
    sourceSchemaVersion < EPISODE_EARLIER_HOST_DEADLINE_VERSION &&
    sourceDueDate &&
    sourceDueDate === getProductionDueDate(targetReleaseDate, 7)
      ? getProductionDueDate(targetReleaseDate, 10)
      : sourceDueDate;
  const sourceProductionTasks = Object.prototype.hasOwnProperty.call(
    value,
    'production_tasks'
  )
    ? value.production_tasks
    : fallback.production_tasks;

  return {
    schema_version: EPISODE_STUDIO_SCHEMA_VERSION,
    episode_id: cleanId(value.episode_id, cleanId(fallback.episode_id)),
    title: cleanText(value.title, 220) || cleanText(fallback.title, 220),
    season: cleanText(value.season, 80) || cleanText(fallback.season, 80),
    target_release_date: targetReleaseDate,
    due_date: dueDate,
    recording_date: normalizeRecordingDate(recordingValue('recording_date')),
    recording_time: normalizeRecordingTime(recordingValue('recording_time')),
    recording_time_zone: normalizeRecordingTimeZone(
      recordingValue('recording_time_zone')
    ),
    recording_duration_minutes: normalizeRecordingDuration(
      recordingValue('recording_duration_minutes')
    ),
    recording_location: cleanText(recordingValue('recording_location'), 500),
    host_person_ids: normalizedHostPersonIds,
    production_tasks: normalizeEpisodeProductionTasks(
      sourceProductionTasks,
      targetReleaseDate,
      {
        episodeStatus: status,
        migrationCompletedAt:
          cleanText(value.production_completed_at, 50) ||
          cleanText(fallback.production_completed_at, 50) ||
          cleanText(value.updated_at, 50) ||
          cleanText(fallback.updated_at, 50),
        migrationCompletedByPersonId:
          value.production_advanced_by_person_id ||
          fallback.production_advanced_by_person_id,
        migrationCompletedByName:
          value.production_advanced_by_name ||
          fallback.production_advanced_by_name,
      }
    ),
    production_workflow_updated_at: Object.prototype.hasOwnProperty.call(
      value,
      'production_workflow_updated_at'
    )
      ? cleanText(value.production_workflow_updated_at, 50)
      : cleanText(fallback.production_workflow_updated_at, 50),
    production_workflow_updated_by_person_id:
      Object.prototype.hasOwnProperty.call(
        value,
        'production_workflow_updated_by_person_id'
      )
        ? cleanId(value.production_workflow_updated_by_person_id)
        : cleanId(fallback.production_workflow_updated_by_person_id),
    production_workflow_updated_by_name: Object.prototype.hasOwnProperty.call(
      value,
      'production_workflow_updated_by_name'
    )
      ? cleanText(value.production_workflow_updated_by_name, 180)
      : cleanText(fallback.production_workflow_updated_by_name, 180),
    producer_email:
      cleanText(value.producer_email, 254).toLowerCase() ||
      cleanText(fallback.producer_email, 254).toLowerCase(),
    producer_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'producer_person_id'
    )
      ? cleanId(value.producer_person_id)
      : cleanId(fallback.producer_person_id),
    canonical_assets_required:
      value.canonical_assets_required === true ||
      (value.canonical_assets_required === undefined &&
        fallback.canonical_assets_required === true),
    producer_feedback: Object.prototype.hasOwnProperty.call(
      value,
      'producer_feedback'
    )
      ? cleanText(value.producer_feedback, 4000)
      : cleanText(fallback.producer_feedback, 4000),
    producer_directions: Object.prototype.hasOwnProperty.call(
      value,
      'producer_directions'
    )
      ? cleanText(value.producer_directions, 6000)
      : cleanText(fallback.producer_directions, 6000),
    staged_episode_url: isSafeSpotifyStagingUrl(
      Object.prototype.hasOwnProperty.call(value, 'staged_episode_url')
        ? value.staged_episode_url
        : fallback.staged_episode_url
    )
      ? cleanText(
          Object.prototype.hasOwnProperty.call(value, 'staged_episode_url')
            ? value.staged_episode_url
            : fallback.staged_episode_url,
          2000
        )
      : '',
    messages: (
      Array.isArray(value.messages)
        ? value.messages
        : Array.isArray(fallback.messages)
          ? fallback.messages
          : []
    )
      .slice(-100)
      .map(normalizeMessage)
      .filter((message) => message.body && message.author_name),
    sponsor_read_assignments: (
      Array.isArray(value.sponsor_read_assignments)
        ? value.sponsor_read_assignments
        : Array.isArray(fallback.sponsor_read_assignments)
          ? fallback.sponsor_read_assignments
          : []
    )
      .slice(0, 12)
      .map(normalizeSponsorReadAssignment)
      .filter(
        (assignment) =>
          assignment.assignment_id &&
          assignment.sponsor_read_id &&
          assignment.sponsor_name &&
          assignment.script_title &&
          assignment.approved_text
      ),
    assets: normalizedAssets,
    status,
    archived:
      value.archived === true ||
      (value.archived === undefined && fallback.archived === true),
    archived_at: Object.prototype.hasOwnProperty.call(value, 'archived_at')
      ? cleanText(value.archived_at, 50)
      : cleanText(fallback.archived_at, 50),
    deleted_at: Object.prototype.hasOwnProperty.call(value, 'deleted_at')
      ? cleanText(value.deleted_at, 50)
      : cleanText(fallback.deleted_at, 50),
    asset_upload_grants_expire_at: Object.prototype.hasOwnProperty.call(
      value,
      'asset_upload_grants_expire_at'
    )
      ? cleanText(value.asset_upload_grants_expire_at, 50)
      : cleanText(fallback.asset_upload_grants_expire_at, 50),
    deletion_finalized_at: Object.prototype.hasOwnProperty.call(
      value,
      'deletion_finalized_at'
    )
      ? cleanText(value.deletion_finalized_at, 50)
      : cleanText(fallback.deletion_finalized_at, 50),
    deletion_tombstone_purge_at: Object.prototype.hasOwnProperty.call(
      value,
      'deletion_tombstone_purge_at'
    )
      ? cleanText(value.deletion_tombstone_purge_at, 50)
      : cleanText(fallback.deletion_tombstone_purge_at, 50),
    production_stage: productionStage,
    production_lead_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'production_lead_person_id'
    )
      ? cleanId(value.production_lead_person_id)
      : cleanId(fallback.production_lead_person_id),
    production_handoff_at: Object.prototype.hasOwnProperty.call(
      value,
      'production_handoff_at'
    )
      ? cleanText(value.production_handoff_at, 50)
      : cleanText(fallback.production_handoff_at, 50),
    production_completed_at: Object.prototype.hasOwnProperty.call(
      value,
      'production_completed_at'
    )
      ? cleanText(value.production_completed_at, 50)
      : cleanText(fallback.production_completed_at, 50),
    production_advanced_by_person_id:
      Object.prototype.hasOwnProperty.call(
        value,
        'production_advanced_by_person_id'
      )
        ? cleanId(value.production_advanced_by_person_id)
        : cleanId(fallback.production_advanced_by_person_id),
    production_advanced_by_name: Object.prototype.hasOwnProperty.call(
      value,
      'production_advanced_by_name'
    )
      ? cleanText(value.production_advanced_by_name, 180)
      : cleanText(fallback.production_advanced_by_name, 180),
    delivery_health: deliveryHealth,
    delivery_health_updated_at: Object.prototype.hasOwnProperty.call(
      value,
      'delivery_health_updated_at'
    )
      ? cleanText(value.delivery_health_updated_at, 50)
      : cleanText(fallback.delivery_health_updated_at, 50),
    delivery_health_updated_by_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'delivery_health_updated_by_person_id'
    )
      ? cleanId(value.delivery_health_updated_by_person_id)
      : cleanId(fallback.delivery_health_updated_by_person_id),
    delivery_health_updated_by_name: Object.prototype.hasOwnProperty.call(
      value,
      'delivery_health_updated_by_name'
    )
      ? cleanText(value.delivery_health_updated_by_name, 180)
      : cleanText(fallback.delivery_health_updated_by_name, 180),
    delivery_health_updated_by_role: [
      'host',
      'producer',
      'studio_manager',
      'admin',
    ].includes(value.delivery_health_updated_by_role)
      ? value.delivery_health_updated_by_role
      : [
            'host',
            'producer',
            'studio_manager',
            'admin',
          ].includes(fallback.delivery_health_updated_by_role)
        ? fallback.delivery_health_updated_by_role
        : '',
    deliverables: normalizedDeliverables,
    created_by_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'created_by_person_id'
    )
      ? cleanId(value.created_by_person_id)
      : cleanId(fallback.created_by_person_id),
    created_by:
      cleanText(value.created_by, 254) || cleanText(fallback.created_by, 254),
    created_at:
      cleanText(value.created_at, 50) || cleanText(fallback.created_at, 50),
    updated_at:
      cleanText(value.updated_at, 50) || cleanText(fallback.updated_at, 50),
    submitted_at:
      cleanText(value.submitted_at, 50) ||
      cleanText(fallback.submitted_at, 50),
    reviewed_at:
      cleanText(value.reviewed_at, 50) ||
      cleanText(fallback.reviewed_at, 50),
    reviewed_by_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'reviewed_by_person_id'
    )
      ? cleanId(value.reviewed_by_person_id)
      : cleanId(fallback.reviewed_by_person_id),
    reviewed_by_name: Object.prototype.hasOwnProperty.call(
      value,
      'reviewed_by_name'
    )
      ? cleanText(value.reviewed_by_name, 180)
      : cleanText(fallback.reviewed_by_name, 180),
    review_override:
      value.review_override === true ||
      (value.review_override === undefined &&
        fallback.review_override === true),
    review_override_reason: Object.prototype.hasOwnProperty.call(
      value,
      'review_override_reason'
    )
      ? cleanText(value.review_override_reason, 1000)
      : cleanText(fallback.review_override_reason, 1000),
  };
}

export function getEpisodeStudioMembership(value = {}, identity = {}) {
  const episode = normalizeEpisodeStudio(value);
  const personId = cleanId(identity.person_id);
  const creatorIdentifiers = new Set(
    [
      ...(Array.isArray(identity.identifiers) ? identity.identifiers : []),
      identity.username,
      identity.subject,
      identity.account_email,
    ]
      .map((identifier) => String(identifier || '').trim().toLowerCase())
      .filter(Boolean)
  );
  const membership = [];

  if (personId && episode.host_person_ids.includes(personId)) {
    membership.push('host');
  }
  if (personId && episode.producer_person_id === personId) {
    membership.push('producer');
  }
  if (
    (personId && episode.created_by_person_id === personId) ||
    (episode.created_by &&
      creatorIdentifiers.has(episode.created_by.toLowerCase()))
  ) {
    membership.push('creator');
  }
  if (
    personId &&
    episode.production_tasks.some((task) =>
      task.assigned_person_ids.includes(personId)
    )
  ) {
    membership.push('workflow_assignee');
  }

  return membership;
}

export function getEpisodeRelationshipCapabilities(
  episodeValue = {},
  identity = {},
  principal = {}
) {
  const roles = getEpisodeStudioMembership(episodeValue, identity);
  const permissions = new Set(
    Array.isArray(principal.permissions) ? principal.permissions : []
  );
  const groups = new Set(
    Array.isArray(principal.groups) ? principal.groups : []
  );
  const canManage = permissions.has('episodes:manage');
  const canHost = roles.includes('host');
  const canReview = roles.includes('producer');
  const canUploadAssets = canUploadEpisodeAssets({
    roles,
    status: normalizeEpisodeStudio(episodeValue).status,
  });
  return {
    roles,
    canAccess: canManage || roles.length > 0,
    canManage,
    canHost,
    canReview,
    canUploadAssets,
    canConfigure: canManage || canReview,
    canAdminOverride: groups.has('admin') && canManage,
  };
}

export function isDeliverableComplete(
  deliverable = {},
  assets = [],
  hostPersonIds = []
) {
  if (deliverable.type === 'asset') {
    if (deliverable.id === EPISODE_PHOTO_DELIVERABLE_ID) {
      return isEpisodePhotoSelectionConfirmed(deliverable, assets);
    }
    return (Array.isArray(assets) ? assets : []).some(
      (asset) =>
        asset.deliverable_id === deliverable.id &&
        asset.status === 'uploaded' &&
        !isEpisodeAssetExpired(asset)
    );
  }
  if (deliverable.id === EPISODE_MIC_KIT_DELIVERABLE_ID) {
    // Episode JSON stores only safe participant plans and verified request
    // references. The episode-scoped mic-kit endpoint overlays current
    // canonical request status for live UI readiness without copying it here.
    return getEpisodeMicKitPlanCompletion(
      deliverable.mic_kit_plans,
      hostPersonIds,
      deliverable.guest_mic_kit_plan
    ).complete;
  }
  const value = cleanText(deliverable.value, 12000);
  if (deliverable.id === 'guest-details') {
    const guestProfile = normalizeGuestProfile(deliverable.guest_profile);
    const structuredCoreComplete = Boolean(
      guestProfile.name &&
        guestProfile.title_affiliation &&
        (guestProfile.contact_email || guestProfile.contact_phone) &&
        guestProfile.short_bio
    );
    const structuredProfileResponse = Boolean(
      guestProfile.no_public_profiles ||
        guestProfile.website ||
        guestProfile.instagram ||
        guestProfile.facebook ||
        guestProfile.linkedin ||
        guestProfile.x_twitter ||
        guestProfile.youtube ||
        guestProfile.tiktok ||
        guestProfile.other
    );
    return Boolean(
      structuredCoreComplete &&
        structuredProfileResponse &&
        isGuestProfileValid(guestProfile)
    );
  }
  if (!value) return false;
  return deliverable.type !== 'url' || isSafeEpisodeMaterialUrl(value);
}

export function areProducerDirectionsComplete(value = '') {
  return cleanText(value, 6000).length >= PRODUCER_DIRECTIONS_MIN_LENGTH;
}

function completionAssetsForViewer(value = {}, episode = {}) {
  const sourceAssets = Array.isArray(value.assets)
    ? value.assets
    : episode.assets;
  const deliverableIds = new Set(
    episode.deliverables.map((deliverable) => deliverable.id)
  );
  return (Array.isArray(sourceAssets) ? sourceAssets : [])
    .slice(0, MAX_EPISODE_ASSETS)
    .map((sourceAsset, index) => ({
      sourceAsset,
      asset: normalizeEpisodeAsset(sourceAsset, index),
    }))
    .filter(
      ({ sourceAsset, asset }) =>
        asset.asset_id &&
        asset.file_name &&
        asset.content_type &&
        asset.size > 0 &&
        (asset.object_key || sourceAsset?.storage_verified === true)
    )
    .map(({ sourceAsset, asset }) => {
      const completionAsset =
        sourceAsset?.storage_verified === true
          ? { ...asset, storage_verified: true }
          : asset;
      if (completionAsset.deliverable_id) return completionAsset;
      const mappedDeliverable =
        LEGACY_ASSET_DELIVERABLE_BY_CATEGORY[completionAsset.category] || '';
      return mappedDeliverable && deliverableIds.has(mappedDeliverable)
        ? { ...completionAsset, deliverable_id: mappedDeliverable }
        : completionAsset;
    });
}

export function getEpisodeCompletion(value = {}, options = {}) {
  const episode = normalizeEpisodeStudio(value);
  const completionAssets = completionAssetsForViewer(value, episode);
  const deliverableCompletion =
    options?.deliverableCompletion &&
    typeof options.deliverableCompletion === 'object' &&
    !Array.isArray(options.deliverableCompletion)
      ? options.deliverableCompletion
      : {};
  const deliverableIsComplete = (deliverable) =>
    Object.prototype.hasOwnProperty.call(
      deliverableCompletion,
      deliverable.id
    )
      ? deliverableCompletion[deliverable.id] === true
      : isDeliverableComplete(
          deliverable,
          completionAssets,
          episode.host_person_ids
        );
  const required = episode.deliverables.filter(
    (deliverable) => deliverable.required
  );
  const completed = required.filter(deliverableIsComplete);
  const missingDeliverables = required
    .filter((deliverable) => !deliverableIsComplete(deliverable))
    .map((deliverable) => ({
      id: deliverable.id,
      label: deliverable.label,
      acknowledged: deliverable.missing_acknowledged,
      note: deliverable.missing_note,
      expected_by: deliverable.expected_by,
    }));
  const requiredDeliverableAssetCategories = new Set(
    required
      .filter((deliverable) => deliverable.type === 'asset')
      .map((deliverable) => deliverable.asset_category)
  );
  const requiredAssetCategories = episode.canonical_assets_required
    ? [
        {
          category: 'recording',
          id: 'canonical-recording',
          label: 'Final recording uploaded to the Episode Studio',
        },
        {
          category: 'image',
          id: 'canonical-images',
          label: 'Final episode images uploaded to the Episode Studio',
        },
      ].filter(
        (requirement) =>
          !requiredDeliverableAssetCategories.has(requirement.category)
      )
    : [];
  const missingAssets = requiredAssetCategories
    .filter(
      (requirement) =>
        !completionAssets.some(
          (asset) =>
            asset.category === requirement.category &&
            asset.status === 'uploaded' &&
            !isEpisodeAssetExpired(asset)
        )
    )
    .map((requirement) => ({
      id: requirement.id,
      label: requirement.label,
      acknowledged: false,
      note: '',
      expected_by: episode.due_date,
    }));
  const incompleteSponsorReads = episode.sponsor_read_assignments
    .filter(
      (assignment) => assignment.requires_audio && !assignment.completed
    )
    .map((assignment) => ({
      id: `sponsor-read:${assignment.assignment_id}`,
      label: `${assignment.sponsor_name} sponsor audio`,
      acknowledged: false,
      note: '',
      expected_by: episode.due_date,
    }));
  const missing = [
    ...missingDeliverables,
    ...incompleteSponsorReads,
    ...missingAssets,
  ];
  const acknowledgedMissing = missingDeliverables.filter(
    (deliverable) =>
      deliverable.acknowledged && deliverable.note.trim().length >= 4
  );
  const requiredCount =
    required.length +
    episode.sponsor_read_assignments.filter(
      (assignment) => assignment.requires_audio
    ).length +
    requiredAssetCategories.length;
  const completedCount =
    completed.length +
    episode.sponsor_read_assignments.filter(
      (assignment) => assignment.requires_audio && assignment.completed
    ).length +
    (requiredAssetCategories.length - missingAssets.length);
  const hostPercent = requiredCount
    ? Math.round((completedCount / requiredCount) * 100)
    : 100;
  const producerApproved = episode.status === 'accepted';
  const productionComplete =
    producerApproved && episode.production_stage === 'complete';
  const hostReady = missing.length === 0;
  const overallPercent = productionComplete
    ? 100
    : producerApproved
      ? 90
    : Math.min(80, Math.round(hostPercent * 0.8));
  const workflowStage =
    episode.status === 'accepted'
      ? productionComplete
        ? 'episode_complete'
        : 'production_lead_review'
      : episode.status === 'needs_changes'
        ? 'changes_requested'
        : ['submitted', 'submitted_with_gaps'].includes(episode.status)
          ? 'producer_review'
          : hostReady
            ? 'ready_for_producer'
            : 'host_preparation';

  return {
    required: requiredCount,
    completed: completedCount,
    percent: overallPercent,
    host_percent: hostPercent,
    overall_percent: overallPercent,
    host_ready: hostReady,
    producer_approved: producerApproved,
    final_complete: productionComplete,
    workflow_stage: workflowStage,
    remaining_reason: productionComplete
      ? 'The production escalation chain is complete.'
      : producerApproved
        ? 'The producer accepted the package; a production lead must acknowledge the handoff.'
      : ['submitted', 'submitted_with_gaps'].includes(episode.status)
        ? 'The host package is awaiting producer approval.'
        : episode.status === 'needs_changes'
          ? 'The producer requested host changes and a new submission.'
          : hostReady
            ? 'The host package is ready to submit to the producer.'
            : `${missing.length} required host ${
                missing.length === 1 ? 'item remains' : 'items remain'
              }.`,
    missing,
    acknowledged_missing: acknowledgedMissing.length,
    producer_directions_complete: areProducerDirectionsComplete(
      episode.producer_directions
    ),
    can_submit: hostReady,
    can_submit_with_gaps:
      missingDeliverables.length > 0 &&
      acknowledgedMissing.length === missingDeliverables.length &&
      incompleteSponsorReads.length === 0 &&
      missingAssets.length === 0,
  };
}

export function validateEpisodeStudio(value = {}) {
  validateRecordingSchedule(value);
  const episode = normalizeEpisodeStudio(value);
  if (!episode.episode_id) {
    throw new Error('Episode Studio: episode ID is required.');
  }
  if (!episode.title) {
    throw new Error('Episode Studio: title is required.');
  }
  if (!episode.host_person_ids.length) {
    throw new Error('Episode Studio: assign at least one host.');
  }
  if (!episode.target_release_date) {
    throw new Error('Episode Studio: a release date is required.');
  }
  if (
    episode.producer_email &&
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(episode.producer_email)
  ) {
    throw new Error('Episode Studio: producer email is invalid.');
  }
  if (!episode.deliverables.length) {
    throw new Error('Episode Studio: at least one deliverable is required.');
  }

  const ids = new Set();
  for (const deliverable of episode.deliverables) {
    if (!deliverable.id || !deliverable.label) {
      throw new Error(
        'Episode Studio: every deliverable needs a label and ID.'
      );
    }
    if (ids.has(deliverable.id)) {
      throw new Error(
        `Episode Studio: duplicate deliverable ID "${deliverable.id}".`
      );
    }
    ids.add(deliverable.id);
    if (
      deliverable.type === 'url' &&
      deliverable.value &&
      !isSafeEpisodeMaterialUrl(deliverable.value)
    ) {
      throw new Error(
        `Episode Studio: "${deliverable.label}" must use an HTTPS link.`
      );
    }
  }

  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(episode)
  ).length;
  if (serializedBytes > 330000) {
    throw new Error('Episode Studio: the combined record is too large.');
  }

  return episode;
}

export function mergeHostDeliverableValues(episodeValue, updates = []) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const valuesById = new Map(
    (Array.isArray(updates) ? updates : []).map((item) => [
      cleanId(item?.id),
      item && typeof item === 'object' ? item : {},
    ])
  );

  return {
    ...episode,
    deliverables: episode.deliverables.map((deliverable) => {
      if (!valuesById.has(deliverable.id)) return deliverable;
      const update = valuesById.get(deliverable.id);
      return normalizeDeliverable(
        {
          ...deliverable,
          value: Object.prototype.hasOwnProperty.call(update, 'value')
            ? update.value
            : deliverable.value,
          social_profiles: Object.prototype.hasOwnProperty.call(
            update,
            'social_profiles'
          )
            ? update.social_profiles
            : deliverable.social_profiles,
          ...(deliverable.id === 'guest-details'
            ? {
                guest_profile: Object.prototype.hasOwnProperty.call(
                  update,
                  'guest_profile'
                )
                  ? {
                      ...deliverable.guest_profile,
                      ...(update.guest_profile &&
                      typeof update.guest_profile === 'object' &&
                      !Array.isArray(update.guest_profile)
                        ? update.guest_profile
                        : {}),
                    }
                  : deliverable.guest_profile,
              }
            : {}),
          missing_acknowledged: Object.prototype.hasOwnProperty.call(
            update,
            'missing_acknowledged'
          )
            ? update.missing_acknowledged
            : deliverable.missing_acknowledged,
          missing_note: Object.prototype.hasOwnProperty.call(
            update,
            'missing_note'
          )
            ? update.missing_note
            : deliverable.missing_note,
          expected_by: Object.prototype.hasOwnProperty.call(
            update,
            'expected_by'
          )
            ? update.expected_by
            : deliverable.expected_by,
        },
        deliverable.sort_order,
        episode.host_person_ids
      );
    }),
  };
}

export function mergeEpisodeStudioManagerValues(
  episodeValue,
  updateValue = {}
) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const update =
    updateValue && typeof updateValue === 'object' ? updateValue : {};
  const managerDeliverablesById = new Map(
    (Array.isArray(update.deliverables) ? update.deliverables : []).map(
      (deliverable) => [cleanId(deliverable?.id), deliverable]
    )
  );
  const withManagerConfiguration = {
    ...episode,
    deliverables: episode.deliverables.map((deliverable) => {
      const managerUpdate = managerDeliverablesById.get(deliverable.id);
      if (!managerUpdate) return deliverable;
      return normalizeDeliverable(
        {
          ...deliverable,
          required: Object.prototype.hasOwnProperty.call(
            managerUpdate,
            'required'
          )
            ? managerUpdate.required === true
            : deliverable.required,
          label: Object.prototype.hasOwnProperty.call(managerUpdate, 'label')
            ? managerUpdate.label
            : deliverable.label,
          description: Object.prototype.hasOwnProperty.call(
            managerUpdate,
            'description'
          )
            ? managerUpdate.description
            : deliverable.description,
          type: Object.prototype.hasOwnProperty.call(managerUpdate, 'type')
            ? managerUpdate.type
            : deliverable.type,
          asset_category: Object.prototype.hasOwnProperty.call(
            managerUpdate,
            'asset_category'
          )
            ? managerUpdate.asset_category
            : deliverable.asset_category,
          sort_order: Object.prototype.hasOwnProperty.call(
            managerUpdate,
            'sort_order'
          )
            ? managerUpdate.sort_order
            : deliverable.sort_order,
        },
        deliverable.sort_order,
        episode.host_person_ids
      );
    }),
  };
  const allowedFields = [
    'title',
    'season',
    'target_release_date',
    'due_date',
    'recording_date',
    'recording_time',
    'recording_time_zone',
    'recording_duration_minutes',
    'recording_location',
    'host_person_ids',
    'producer_person_id',
    'producer_email',
    'producer_feedback',
    'producer_directions',
    'staged_episode_url',
    'canonical_assets_required',
  ];
  const allowedUpdate = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(update, field)) {
      allowedUpdate[field] = update[field];
    }
  }

  const normalized = normalizeEpisodeStudio(
    {
      ...withManagerConfiguration,
      ...allowedUpdate,
    },
    episode
  );
  if (
    Object.prototype.hasOwnProperty.call(allowedUpdate, 'target_release_date') &&
    normalized.target_release_date !== episode.target_release_date &&
    normalized.production_tasks.length
  ) {
    return normalizeEpisodeStudio({
      ...normalized,
      production_tasks: recalculateEpisodeProductionTaskDates(
        episode.production_tasks,
        normalized.target_release_date
      ),
    });
  }
  return normalized;
}

export function configureEpisodeDeliverables(
  episodeValue,
  configurationValue = []
) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const requestedConfiguration = Array.isArray(configurationValue)
    ? configurationValue
    : [];
  if (requestedConfiguration.length > MAX_EPISODE_DELIVERABLES) {
    throw new Error(
      `Episode Studio: a checklist can contain at most ${MAX_EPISODE_DELIVERABLES} items.`
    );
  }
  const requestedIds = new Set(
    requestedConfiguration.map((value) => cleanId(value?.id)).filter(Boolean)
  );
  const missingRequiredCount = REQUIRED_EPISODE_DELIVERABLE_IDS.filter(
    (id) => !requestedIds.has(id)
  ).length;
  if (
    requestedConfiguration.length + missingRequiredCount >
    MAX_EPISODE_DELIVERABLES
  ) {
    throw new Error(
      `Episode Studio: keep the built-in guest details, microphone plan, and photos steps within the ${MAX_EPISODE_DELIVERABLES}-item checklist limit.`
    );
  }
  const existingById = new Map(
    episode.deliverables.map((deliverable) => [deliverable.id, deliverable])
  );
  const configured = requestedConfiguration
    .map((value, index) => {
      const id = cleanId(value?.id, `deliverable-${index + 1}`);
      const existing = existingById.get(id);
      return normalizeDeliverable(
        {
          ...(existing || {}),
          id,
          label: value?.label,
          description: value?.description,
          type: value?.type,
          asset_category: value?.asset_category,
          required: value?.required === true,
          sort_order: (index + 1) * 10,
          value: existing?.value || '',
          social_profiles: existing?.social_profiles || '',
          ...(id === 'guest-details'
            ? {
                guest_profile:
                  existing?.guest_profile || createEmptyGuestProfile(),
              }
            : {}),
          ...(id === EPISODE_MIC_KIT_DELIVERABLE_ID
            ? {
                mic_kit_plans: existing?.mic_kit_plans || [],
                guest_mic_kit_plan:
                  existing?.guest_mic_kit_plan || {},
              }
            : {}),
          ...(id === EPISODE_PHOTO_DELIVERABLE_ID
            ? {
                photo_selection:
                  existing?.photo_selection ||
                  createEmptyEpisodePhotoSelection(),
              }
            : {}),
          legacy_source_url: existing?.legacy_source_url || '',
          missing_acknowledged:
            existing?.missing_acknowledged === true,
          missing_note: existing?.missing_note || '',
          expected_by: existing?.expected_by || '',
        },
        index,
        episode.host_person_ids
      );
    });
  if (configured.some((deliverable) => !deliverable.id || !deliverable.label)) {
    throw new Error(
      'Episode Studio: every checklist item needs a title and ID.'
    );
  }
  const withRequiredDeliverables = restoreRequiredEpisodeDeliverables(
    configured,
    existingById
  ).map((deliverable, index) =>
    normalizeDeliverable(deliverable, index, episode.host_person_ids)
  );

  if (!withRequiredDeliverables.length) {
    throw new Error(
      'Episode Studio: keep at least one checklist item.'
    );
  }
  if (
    new Set(withRequiredDeliverables.map((item) => item.id)).size !==
    withRequiredDeliverables.length
  ) {
    throw new Error('Episode Studio: checklist item IDs must be unique.');
  }
  return normalizeEpisodeStudio({
    ...episode,
    deliverables: withRequiredDeliverables,
  });
}

export function mergeEpisodeStudioServerFields(
  currentValue = {},
  serverValue = {},
  fields = []
) {
  const next = { ...currentValue };
  for (const field of Array.isArray(fields) ? fields : []) {
    if (Object.prototype.hasOwnProperty.call(serverValue, field)) {
      next[field] = serverValue[field];
    }
  }
  return next;
}

export function updateEpisodePhotoSelection(
  episodeValue = {},
  updateValue = {},
  actor = {},
  options = {}
) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const photoDeliverable = episode.deliverables.find(
    (deliverable) => deliverable.id === EPISODE_PHOTO_DELIVERABLE_ID
  );
  if (!photoDeliverable) {
    throw new Error('Episode photos: the Photos and artwork step is missing.');
  }
  const photoSelection = buildEpisodePhotoSelection(
    photoDeliverable.photo_selection,
    updateValue,
    episode.assets,
    actor,
    options
  );
  return normalizeEpisodeStudio({
    ...episode,
    deliverables: episode.deliverables.map((deliverable) =>
      deliverable.id === EPISODE_PHOTO_DELIVERABLE_ID
        ? { ...deliverable, photo_selection: photoSelection }
        : deliverable
    ),
  });
}

export function sanitizeEpisodeStudioForViewer(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  return {
    ...episode,
    deliverables: episode.deliverables.map((deliverable) =>
      deliverable.id === EPISODE_PHOTO_DELIVERABLE_ID
        ? {
            ...deliverable,
            photo_selection: sanitizeEpisodePhotoSelectionForViewer(
              deliverable.photo_selection
            ),
          }
        : deliverable
    ),
    assets: episode.assets.map((asset) => {
      const safeAsset = { ...asset };
      safeAsset.storage_verified = Boolean(
        safeAsset.object_key && safeAsset.object_version_id
      );
      delete safeAsset.object_key;
      delete safeAsset.object_version_id;
      return safeAsset;
    }),
  };
}

export function removeEpisodeAssetFromEpisode(
  value = {},
  assetId = '',
  { personId = '', personName = '', updatedAt = '' } = {}
) {
  const episode = normalizeEpisodeStudio(value);
  const cleanAssetId = cleanId(assetId);
  if (!cleanAssetId) return episode;
  const removedAsset = episode.assets.find(
    (asset) => asset.asset_id === cleanAssetId
  );
  const remainingAssets = episode.assets.filter(
    (asset) => asset.asset_id !== cleanAssetId
  );
  const deliverables = episode.deliverables.map((deliverable) => {
    if (deliverable.id !== EPISODE_PHOTO_DELIVERABLE_ID) return deliverable;
    const photoSelection = removeAssetFromEpisodePhotoSelection(
      deliverable.photo_selection,
      cleanAssetId
    );
    const selectionChanged =
      JSON.stringify(photoSelection) !==
      JSON.stringify(deliverable.photo_selection);
    return {
      ...deliverable,
      photo_selection:
        selectionChanged && updatedAt
          ? {
              ...photoSelection,
              updated_at: cleanText(updatedAt, 50),
              updated_by_person_id: cleanId(personId),
              updated_by_name: cleanText(personName, 180),
            }
          : photoSelection,
    };
  });
  const removedProducerProof =
    removedAsset?.deliverable_id === 'producer-proof-audio' &&
    Boolean(removedAsset);
  const producerProofTask = episode.production_tasks.find(
    (task) => task.task_id === 'producer-proof-upload'
  );
  const approvalTask = episode.production_tasks.find(
    (task) => task.task_id === 'proof-listen-approval'
  );
  const removedCurrentProducerProof =
    removedProducerProof &&
    (producerProofTask?.evidence_asset_id === cleanAssetId ||
      approvalTask?.evidence_asset_id === cleanAssetId ||
      !remainingAssets.some(
        (asset) => asset.deliverable_id === 'producer-proof-audio'
      ));
  const resetProofDependents = removedCurrentProducerProof
    ? resetProducerProofApprovalForNewAsset(episode.production_tasks)
    : episode.production_tasks;
  return normalizeEpisodeStudio({
    ...episode,
    deliverables,
    assets: remainingAssets,
    production_tasks: removedCurrentProducerProof
      ? resetProofDependents.map((task) =>
          task.task_id === 'producer-proof-upload'
            ? {
                ...task,
                status: 'in_progress',
                completed_at: '',
                completed_by_person_id: '',
                completed_by_name: '',
                evidence_asset_id: '',
                evidence_note: '',
              }
            : task
        )
      : episode.production_tasks,
    sponsor_read_assignments: episode.sponsor_read_assignments.map(
      (assignment) =>
        assignment.audio_asset_id === cleanAssetId
          ? {
              ...assignment,
              audio_asset_id: '',
              completed: assignment.requires_audio
                ? false
                : assignment.completed,
              completed_at: assignment.requires_audio
                ? ''
                : assignment.completed_at,
              completed_by_person_id: assignment.requires_audio
                ? ''
                : assignment.completed_by_person_id,
              completed_by_name: assignment.requires_audio
                ? ''
                : assignment.completed_by_name,
            }
          : assignment
    ),
  });
}

export function episodeStudioSummary(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  const workflowBase = getEpisodeProductionPlanSummary(episode);
  const overdueTaskIds = new Set(workflowBase.overdue_task_ids || []);
  const workflow = {
    ...workflowBase,
    overdue_tasks: episode.production_tasks.filter((task) =>
      overdueTaskIds.has(task.task_id)
    ),
  };
  return {
    episode_id: episode.episode_id,
    title: episode.title,
    season: episode.season,
    target_release_date: episode.target_release_date,
    due_date: episode.due_date,
    recording_date: episode.recording_date,
    recording_time: episode.recording_time,
    recording_time_zone: episode.recording_time_zone,
    recording_duration_minutes: episode.recording_duration_minutes,
    recording_location: episode.recording_location,
    host_person_ids: episode.host_person_ids,
    producer_email: episode.producer_email,
    producer_person_id: episode.producer_person_id,
    staged_episode_url: episode.staged_episode_url,
    production_stage: episode.production_stage,
    production_lead_person_id: episode.production_lead_person_id,
    production_handoff_at: episode.production_handoff_at,
    production_completed_at: episode.production_completed_at,
    canonical_assets_required: episode.canonical_assets_required,
    producer_feedback: episode.producer_feedback,
    producer_directions_complete: areProducerDirectionsComplete(
      episode.producer_directions
    ),
    message_count: episode.messages.length,
    asset_count: episode.assets.length,
    last_message_at:
      episode.messages[episode.messages.length - 1]?.created_at || '',
    status: episode.status,
    deleted_at: episode.deleted_at,
    deletion_finalized_at: episode.deletion_finalized_at,
    deletion_tombstone_purge_at: episode.deletion_tombstone_purge_at,
    asset_upload_grants_expire_at:
      episode.asset_upload_grants_expire_at,
    deletion_pending: Boolean(episode.deleted_at),
    archived: episode.archived,
    archived_at: episode.archived_at,
    delivery_health: episode.delivery_health,
    effective_delivery_health:
      episode.delivery_health === 'off_track' || workflow.off_track
        ? 'off_track'
        : 'on_track',
    workflow,
    production_workflow_updated_at: episode.production_workflow_updated_at,
    production_workflow_updated_by_person_id:
      episode.production_workflow_updated_by_person_id,
    production_workflow_updated_by_name:
      episode.production_workflow_updated_by_name,
    delivery_health_updated_at: episode.delivery_health_updated_at,
    delivery_health_updated_by_person_id:
      episode.delivery_health_updated_by_person_id,
    delivery_health_updated_by_name:
      episode.delivery_health_updated_by_name,
    delivery_health_updated_by_role:
      episode.delivery_health_updated_by_role,
    submitted_at: episode.submitted_at,
    updated_at: episode.updated_at,
    completion: getEpisodeCompletion(episode),
  };
}

function currentDateKey(timeZone = 'America/Los_Angeles') {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(new Date());
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

/**
 * Build the deliberately small, read-only projection used by the shared
 * upcoming schedule. It omits the Episode Studio identifier and all guest,
 * recording, assignment, and production details so an unassigned host only
 * receives the schedule information shown on the calendar.
 */
export function upcomingEpisodeCalendarEntries(
  values = [],
  { today = currentDateKey() } = {}
) {
  const startDate = normalizeRecordingDate(today);
  if (!startDate) {
    throw new Error('Episode calendar: choose a valid starting date.');
  }

  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeEpisodeStudio(value))
    .filter(
      (episode) =>
        episode.target_release_date >= startDate &&
        !episode.archived &&
        !episode.deleted_at &&
        !episode.deletion_finalized_at
    )
    .map((episode) => ({
      title: episode.title,
      season: episode.season,
      target_release_date: episode.target_release_date,
    }))
    .sort(
      (a, b) =>
        a.target_release_date.localeCompare(b.target_release_date) ||
        a.title.localeCompare(b.title)
    );
}
