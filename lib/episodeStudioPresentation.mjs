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
      'Include the guest’s name, title or affiliation, contact details, and a short biography.',
    type: 'textarea',
    required: true,
    sort_order: 20,
  },
  {
    id: 'episode-folder',
    label: 'Episode Drive folder',
    description:
      'Link the single source-of-truth folder. Use the episode name consistently and clearly mark or remove superseded versions.',
    type: 'url',
    required: true,
    sort_order: 30,
  },
  {
    id: 'recording-files',
    label: 'Recording files',
    description:
      'Link the uploaded Riverside or Drive tracks after every local file finishes uploading. Keep the raw WAV filenames clear and distinct.',
    type: 'url',
    required: true,
    sort_order: 40,
  },
  {
    id: 'edit-notes',
    label: 'First cut or timestamped edit notes',
    description:
      'Link the rough cut or edit document. Directions should name the exact recording file, timestamp range, requested action, and intended result.',
    type: 'url',
    required: true,
    sort_order: 50,
  },
  {
    id: 'show-notes',
    label: 'Show notes and relevant links',
    description:
      'Write the episode summary, guest biography, topics covered, and the links listeners will need.',
    type: 'textarea',
    required: true,
    sort_order: 60,
  },
  {
    id: 'intro-audio',
    label: 'Introduction and sponsor read',
    description:
      'Link the finished introduction audio using the current sponsor language, with a filename that identifies its version and approval status.',
    type: 'url',
    required: true,
    sort_order: 70,
  },
  {
    id: 'social-copy',
    label: 'Social media copy',
    description:
      'Provide the short promotional copy the team can use when the episode is released.',
    type: 'textarea',
    required: true,
    sort_order: 80,
  },
  {
    id: 'photos',
    label: 'Photos and artwork',
    description:
      'Link 2–6 clearly named images. Identify the cover, preferred order, intended use, crop, caption, credit, permission, and anything to avoid in the producer handoff.',
    type: 'url',
    required: true,
    sort_order: 90,
  },
  {
    id: 'credits',
    label: 'Credits and permissions',
    description:
      'List photographers, music, artwork, and any usage permissions the producer should know.',
    type: 'textarea',
    required: true,
    sort_order: 100,
  },
];

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
  const type = value.type === 'url' ? 'url' : 'textarea';
  const sortOrder = Number(value.sort_order);

  return {
    id: cleanId(value.id, `deliverable-${index + 1}`),
    label: cleanText(value.label, 180),
    description: cleanText(value.description, 800),
    type,
    required: value.required !== false,
    value: cleanText(value.value, type === 'url' ? 2000 : 12000),
    missing_acknowledged: value.missing_acknowledged === true,
    missing_note: cleanText(value.missing_note, 1200),
    expected_by: normalizeDate(value.expected_by),
    sort_order: Number.isFinite(sortOrder)
      ? Math.trunc(sortOrder)
      : (index + 1) * 10,
  };
}

function normalizeMessage(value = {}, index = 0) {
  return {
    message_id: cleanId(value.message_id, `message-${index + 1}`),
    body: cleanText(value.body, 2400),
    author_name: cleanText(value.author_name, 180),
    author_role:
      value.author_role === 'host' ? 'host' : 'producer',
    created_at: cleanText(value.created_at, 50),
  };
}

export function createDefaultEpisodeDeliverables() {
  return DEFAULT_EPISODE_DELIVERABLES.map((deliverable) => ({
    ...deliverable,
    value: '',
  }));
}

export function normalizeEpisodeStudio(value = {}, fallback = {}) {
  const sourceDeliverables = Array.isArray(value.deliverables)
    ? value.deliverables
    : Array.isArray(fallback.deliverables)
      ? fallback.deliverables
      : createDefaultEpisodeDeliverables();
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
    deliverables: sourceDeliverables
      .slice(0, 30)
      .map(normalizeDeliverable)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.label.localeCompare(b.label)
      ),
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

export function isDeliverableComplete(deliverable = {}) {
  const value = cleanText(deliverable.value, 12000);
  if (!value) return false;
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
  const completed = required.filter(isDeliverableComplete);
  const missingDeliverables = required
    .filter((deliverable) => !isDeliverableComplete(deliverable))
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
  ];
  const acknowledgedMissing = missingDeliverables.filter(
    (deliverable) =>
      deliverable.acknowledged && deliverable.note.trim().length >= 4
  );
  const requiredCount = required.length + 1;
  const completedCount = completed.length + (producerDirectionsComplete ? 1 : 0);

  return {
    required: requiredCount,
    completed: completedCount,
    percent: requiredCount
      ? Math.round((completedCount / requiredCount) * 100)
      : 100,
    missing,
    acknowledged_missing: acknowledgedMissing.length,
    producer_directions_complete: producerDirectionsComplete,
    can_submit: missing.length === 0,
    can_submit_with_gaps:
      producerDirectionsComplete &&
      missingDeliverables.length > 0 &&
      acknowledgedMissing.length === missingDeliverables.length,
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
  const withDeliverableValues = mergeHostDeliverableValues(
    episode,
    update.deliverables
  );
  const allowedFields = [
    'title',
    'season',
    'target_release_date',
    'due_date',
    'host_person_ids',
    'producer_person_id',
    'producer_email',
    'producer_directions',
  ];
  const allowedUpdate = {};

  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(update, field)) {
      allowedUpdate[field] = update[field];
    }
  }

  return normalizeEpisodeStudio(
    {
      ...withDeliverableValues,
      ...allowedUpdate,
    },
    episode
  );
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
    producer_feedback: episode.producer_feedback,
    producer_directions_complete: areProducerDirectionsComplete(
      episode.producer_directions
    ),
    message_count: episode.messages.length,
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
