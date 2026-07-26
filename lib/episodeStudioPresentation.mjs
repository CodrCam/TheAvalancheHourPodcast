import {
  EPISODE_ASSET_CATEGORIES,
  MAX_EPISODE_ASSETS,
  canUploadEpisodeAssets,
} from './episodeAssetPolicy.mjs';

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
export const EPISODE_STUDIO_SCHEMA_VERSION = 2;

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
    id: 'episode-folder',
    label: 'Episode source files',
    description:
      'Upload research, releases, reference documents, audio or video, raster images, transcripts, or other supported source material the producer may need. Drive can remain a working space, but the final source files belong here.',
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
    label: 'Show notes and relevant links',
    description:
      'Write the episode summary, guest biography, topics covered, and the links listeners will need.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 60,
  },
  {
    id: 'intro-audio',
    label: 'Introduction and sponsor read',
    description:
      'Upload the finished introduction and sponsor audio using the current approved language. Use filenames that identify the version and approval status.',
    type: 'asset',
    required: true,
    asset_category: 'sponsor_audio',
    sort_order: 70,
  },
  {
    id: 'social-copy',
    label: 'Social media copy',
    description:
      'Provide the short promotional copy the team can use when the episode is released.',
    type: 'textarea',
    required: true,
    asset_category: 'document',
    sort_order: 80,
  },
  {
    id: 'photos',
    label: 'Photos and artwork',
    description:
      'Upload 2–6 clearly named images. Identify the cover, preferred order, intended use, crop, caption, credit, permission, and anything to avoid in the producer handoff.',
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
];

const DEFAULT_DELIVERABLES_BY_ID = new Map(
  DEFAULT_EPISODE_DELIVERABLES.map((deliverable) => [
    deliverable.id,
    deliverable,
  ])
);

const LEGACY_ASSET_DELIVERABLE_BY_CATEGORY = {
  recording: 'recording-files',
  image: 'photos',
  document: 'episode-folder',
  sponsor_audio: 'intro-audio',
};

function cleanText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
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

function normalizeDeliverable(value = {}, index = 0) {
  const id = cleanId(value.id, `deliverable-${index + 1}`);
  const type = ['url', 'asset'].includes(value.type)
    ? value.type
    : 'textarea';
  const requestedAssetCategory = EPISODE_ASSET_CATEGORIES.includes(
    value.asset_category
  )
    ? value.asset_category
    : 'document';
  const assetCategory =
    id === 'episode-folder' ? 'other' : requestedAssetCategory;
  const sortOrder = Number(value.sort_order);

  return {
    id,
    label: cleanText(value.label, 180),
    description: cleanText(value.description, 800),
    type,
    asset_category: assetCategory,
    required: value.required !== false,
    value: cleanText(value.value, type === 'url' ? 2000 : 12000),
    social_profiles: cleanText(value.social_profiles, 3000),
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
    value:
      value.type === 'url' && modernDefault.type !== 'url'
        ? ''
        : value.value,
    legacy_source_url: legacyUrl,
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
  return DEFAULT_EPISODE_DELIVERABLES.map((deliverable) => ({
    ...deliverable,
    value: '',
    social_profiles: '',
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
  const sourceDeliverables = (
    Array.isArray(value.deliverables)
      ? value.deliverables
      : Array.isArray(fallback.deliverables)
        ? fallback.deliverables
        : createDefaultEpisodeDeliverables()
  ).map((deliverable) =>
    sourceSchemaVersion < EPISODE_STUDIO_SCHEMA_VERSION
      ? migrateLegacyDeliverable(deliverable)
      : deliverable
  );
  const normalizedDeliverables = sourceDeliverables
    .slice(0, 30)
    .map(normalizeDeliverable)
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

  return {
    schema_version: EPISODE_STUDIO_SCHEMA_VERSION,
    episode_id: cleanId(value.episode_id, cleanId(fallback.episode_id)),
    title: cleanText(value.title, 220) || cleanText(fallback.title, 220),
    season: cleanText(value.season, 80) || cleanText(fallback.season, 80),
    target_release_date:
      normalizeDate(value.target_release_date) ||
      normalizeDate(fallback.target_release_date),
    due_date: normalizeDate(value.due_date) || normalizeDate(fallback.due_date),
    host_person_ids: [
      ...new Set(
        (Array.isArray(value.host_person_ids)
          ? value.host_person_ids
          : fallback.host_person_ids || []
        )
          .map((personId) => cleanId(personId))
          .filter(Boolean)
      ),
    ].slice(0, 5),
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
    producer_feedback:
      cleanText(value.producer_feedback, 4000) ||
      cleanText(fallback.producer_feedback, 4000),
    producer_directions: Object.prototype.hasOwnProperty.call(
      value,
      'producer_directions'
    )
      ? cleanText(value.producer_directions, 6000)
      : cleanText(fallback.producer_directions, 6000),
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

export function isDeliverableComplete(deliverable = {}, assets = []) {
  if (deliverable.type === 'asset') {
    return (Array.isArray(assets) ? assets : []).some(
      (asset) =>
        asset.deliverable_id === deliverable.id &&
        asset.status === 'uploaded' &&
        !isEpisodeAssetExpired(asset)
    );
  }
  const value = cleanText(deliverable.value, 12000);
  if (!value) return false;
  if (
    deliverable.id === 'guest-details' &&
    !cleanText(deliverable.social_profiles, 3000)
  ) {
    return false;
  }
  return deliverable.type !== 'url' || isSafeEpisodeMaterialUrl(value);
}

export function areProducerDirectionsComplete(value = '') {
  return cleanText(value, 6000).length >= PRODUCER_DIRECTIONS_MIN_LENGTH;
}

export function getEpisodeCompletion(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  const required = episode.deliverables.filter(
    (deliverable) => deliverable.required
  );
  const completed = required.filter((deliverable) =>
    isDeliverableComplete(deliverable, episode.assets)
  );
  const missingDeliverables = required
    .filter(
      (deliverable) =>
        !isDeliverableComplete(deliverable, episode.assets)
    )
    .map((deliverable) => ({
      id: deliverable.id,
      label: deliverable.label,
      acknowledged: deliverable.missing_acknowledged,
      note: deliverable.missing_note,
      expected_by: deliverable.expected_by,
    }));
  const producerDirectionsComplete = areProducerDirectionsComplete(
    episode.producer_directions
  );
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
        !episode.assets.some(
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
    ...(!producerDirectionsComplete
      ? [
          {
            id: 'producer-directions',
            label: 'Producer handoff brief and asset map',
            acknowledged: false,
            note: '',
            expected_by: '',
          },
        ]
      : []),
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
    1 +
    episode.sponsor_read_assignments.filter(
      (assignment) => assignment.requires_audio
    ).length +
    requiredAssetCategories.length;
  const completedCount =
    completed.length +
    (producerDirectionsComplete ? 1 : 0) +
    episode.sponsor_read_assignments.filter(
      (assignment) => assignment.requires_audio && assignment.completed
    ).length +
    (requiredAssetCategories.length - missingAssets.length);
  const hostPercent = requiredCount
    ? Math.round((completedCount / requiredCount) * 100)
    : 100;
  const producerApproved = episode.status === 'accepted';
  const hostReady = missing.length === 0;
  const overallPercent = producerApproved
    ? 100
    : Math.min(80, Math.round(hostPercent * 0.8));
  const workflowStage =
    episode.status === 'accepted'
      ? 'episode_complete'
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
    final_complete: producerApproved,
    workflow_stage: workflowStage,
    remaining_reason: producerApproved
      ? 'Producer approval is complete.'
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
    producer_directions_complete: producerDirectionsComplete,
    can_submit: hostReady,
    can_submit_with_gaps:
      producerDirectionsComplete &&
      missingDeliverables.length > 0 &&
      acknowledgedMissing.length === missingDeliverables.length &&
      incompleteSponsorReads.length === 0 &&
      missingAssets.length === 0,
  };
}

export function validateEpisodeStudio(value = {}) {
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
        deliverable.sort_order
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
        deliverable.sort_order
      );
    }),
  };
  const allowedFields = [
    'title',
    'season',
    'target_release_date',
    'due_date',
    'host_person_ids',
    'producer_person_id',
    'producer_email',
    'producer_directions',
    'canonical_assets_required',
  ];
  const allowedUpdate = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(update, field)) {
      allowedUpdate[field] = update[field];
    }
  }

  return normalizeEpisodeStudio(
    {
      ...withManagerConfiguration,
      ...allowedUpdate,
    },
    episode
  );
}

export function configureEpisodeDeliverables(
  episodeValue,
  configurationValue = []
) {
  const episode = normalizeEpisodeStudio(episodeValue);
  const existingById = new Map(
    episode.deliverables.map((deliverable) => [deliverable.id, deliverable])
  );
  const configured = (Array.isArray(configurationValue)
    ? configurationValue
    : []
  )
    .slice(0, 30)
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
          legacy_source_url: existing?.legacy_source_url || '',
          missing_acknowledged:
            existing?.missing_acknowledged === true,
          missing_note: existing?.missing_note || '',
          expected_by: existing?.expected_by || '',
        },
        index
      );
    })
    .filter((deliverable) => deliverable.id && deliverable.label);

  if (!configured.length) {
    throw new Error(
      'Episode Studio: keep at least one checklist item.'
    );
  }
  if (new Set(configured.map((item) => item.id)).size !== configured.length) {
    throw new Error('Episode Studio: checklist item IDs must be unique.');
  }
  return normalizeEpisodeStudio({
    ...episode,
    deliverables: configured,
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

export function sanitizeEpisodeStudioForViewer(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  return {
    ...episode,
    assets: episode.assets.map((asset) => {
      const safeAsset = { ...asset };
      delete safeAsset.object_key;
      delete safeAsset.object_version_id;
      return safeAsset;
    }),
  };
}

export function episodeStudioSummary(value = {}) {
  const episode = normalizeEpisodeStudio(value);
  return {
    episode_id: episode.episode_id,
    title: episode.title,
    season: episode.season,
    target_release_date: episode.target_release_date,
    due_date: episode.due_date,
    host_person_ids: episode.host_person_ids,
    producer_email: episode.producer_email,
    producer_person_id: episode.producer_person_id,
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
    delivery_health: episode.delivery_health,
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
