export const MIC_KIT_TRACKER_KEY = 'studio_mic_kit_tracker';

export const MIC_KIT_STATUSES = [
  'available',
  'in_transit',
  'with_holder',
  'maintenance',
  'retired',
];

export const MIC_KIT_STATUS_LABELS = Object.freeze({
  available: 'Available',
  in_transit: 'In transit',
  with_holder: 'With a host',
  maintenance: 'Needs attention',
  retired: 'Not in circulation',
});

export const MIC_KIT_REQUEST_STATUSES = [
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
  'returned',
  'declined',
  'cancelled',
];

export const ACTIVE_MIC_KIT_REQUEST_STATUSES = Object.freeze([
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
]);

const DEFAULT_KIT_VALUES = {
  label: '',
  home_country: '',
  status: 'available',
  current_holder_name: '',
  current_location: '',
  next_request_id: '',
  ship_by: '',
  carrier: '',
  tracking_number: '',
  tracking_url: '',
  notes: '',
  possible_addition: false,
  checked_out_request_id: '',
  checked_out_at: '',
  due_back: '',
  package_weight_lb: '',
  package_length_in: '',
  package_width_in: '',
  package_height_in: '',
};

const DEFAULT_REQUEST_VALUES = {
  requester_subject: '',
  requester_person_id: '',
  requester_name: '',
  requester_email: '',
  country: '',
  city_region: '',
  need_by: '',
  recording_date: '',
  episode_id: '',
  planned_due_back: '',
  status: 'requested',
  kit_id: '',
  notes: '',
  admin_response: '',
  admin_updated_at: '',
  admin_updated_by: '',
  shipping: {
    recipient: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    region: '',
    postal_code: '',
    country: '',
  },
  created_at: '',
  updated_at: '',
};

export const DEFAULT_MIC_KIT_TRACKER = {
  schema_version: 1,
  inventory_confirmed: false,
  inventory_note:
    'Working count from the team: four reported kits plus one possible newer kit. The Season 11 guide explains the handoff process but does not state an inventory count.',
  kits: [
    {
      ...DEFAULT_KIT_VALUES,
      kit_id: 'tah-us-1',
      label: 'TAH US Kit 1',
      home_country: 'US',
    },
    {
      ...DEFAULT_KIT_VALUES,
      kit_id: 'tah-us-2',
      label: 'TAH US Kit 2',
      home_country: 'US',
    },
    {
      ...DEFAULT_KIT_VALUES,
      kit_id: 'tah-us-3',
      label: 'TAH US Kit 3',
      home_country: 'US',
    },
    {
      ...DEFAULT_KIT_VALUES,
      kit_id: 'tah-ca-1',
      label: 'TAH Canada Kit 1',
      home_country: 'CA',
    },
    {
      ...DEFAULT_KIT_VALUES,
      kit_id: 'tah-kit-5',
      label: 'Possible newer kit',
      possible_addition: true,
    },
  ],
  requests: [],
  updated_at: '',
  updated_by: '',
};

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function cleanCountry(value) {
  return cleanText(value, 2).toUpperCase();
}

function cleanDecimal(value, max = 999) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return '';
  return String(Math.round(parsed * 100) / 100);
}

function cleanHttpsUrl(value) {
  const url = cleanText(value, 1200);
  if (!url) return '';
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' ? parsed.toString() : '';
  } catch {
    return '';
  }
}

function uniqueId(value, prefix, index) {
  const cleaned = cleanText(value, 100)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return cleaned || `${prefix}-${index + 1}`;
}

function normalizeShipping(value = {}) {
  return {
    recipient: cleanText(value.recipient, 120),
    address_line_1: cleanText(value.address_line_1, 180),
    address_line_2: cleanText(value.address_line_2, 180),
    city: cleanText(value.city, 120),
    region: cleanText(value.region, 120),
    postal_code: cleanText(value.postal_code, 40),
    country: cleanCountry(value.country),
  };
}

function normalizeKit(value = {}, index = 0) {
  const storedStatus = cleanText(value.status, 40);
  const legacyStatus = {
    needs_confirmation: 'available',
    reserved: 'available',
    returning: 'in_transit',
  }[storedStatus];
  const status = MIC_KIT_STATUSES.includes(storedStatus)
    ? storedStatus
    : legacyStatus || DEFAULT_KIT_VALUES.status;
  const normalized = {
    ...DEFAULT_KIT_VALUES,
    kit_id: uniqueId(value.kit_id, 'mic-kit', index),
    label: cleanText(value.label, 100) || `Mic Kit ${index + 1}`,
    home_country: cleanCountry(value.home_country),
    status,
    current_holder_name: cleanText(value.current_holder_name, 120),
    current_location: cleanText(value.current_location, 160),
    next_request_id: cleanText(value.next_request_id, 100),
    ship_by: cleanDate(value.ship_by),
    carrier: cleanText(value.carrier, 80),
    tracking_number: cleanText(value.tracking_number, 160),
    tracking_url: cleanHttpsUrl(value.tracking_url),
    notes: cleanText(value.notes, 1200),
    possible_addition: value.possible_addition === true,
    checked_out_request_id: cleanText(
      value.checked_out_request_id,
      100
    ),
    checked_out_at: cleanText(value.checked_out_at, 40),
    due_back: cleanDate(value.due_back),
    package_weight_lb: cleanDecimal(value.package_weight_lb),
    package_length_in: cleanDecimal(value.package_length_in),
    package_width_in: cleanDecimal(value.package_width_in),
    package_height_in: cleanDecimal(value.package_height_in),
  };

  if (status === 'available') {
    normalized.carrier = '';
    normalized.tracking_number = '';
    normalized.tracking_url = '';
  }

  return normalized;
}

export function applyMicKitStatus(draft = {}, nextStatus = '') {
  const status = MIC_KIT_STATUSES.includes(nextStatus)
    ? nextStatus
    : MIC_KIT_STATUSES.includes(draft.status)
      ? draft.status
      : DEFAULT_KIT_VALUES.status;

  return {
    ...draft,
    status,
    ...(status === 'available'
      ? {
          carrier: '',
          tracking_number: '',
          tracking_url: '',
        }
      : {}),
  };
}

function normalizeRequest(value = {}, index = 0) {
  const status = cleanText(value.status, 40);
  return {
    ...DEFAULT_REQUEST_VALUES,
    request_id: uniqueId(value.request_id, 'mic-request', index),
    requester_subject: cleanText(value.requester_subject, 160),
    requester_person_id: cleanText(value.requester_person_id, 100),
    requester_name:
      cleanText(value.requester_name, 120) || 'Studio team member',
    requester_email: cleanText(value.requester_email, 240).toLowerCase(),
    country: cleanCountry(value.country),
    city_region: cleanText(value.city_region, 180),
    need_by: cleanDate(value.need_by),
    recording_date: cleanDate(value.recording_date),
    episode_id: cleanText(value.episode_id, 120),
    planned_due_back: cleanDate(value.planned_due_back),
    status: MIC_KIT_REQUEST_STATUSES.includes(status)
      ? status
      : DEFAULT_REQUEST_VALUES.status,
    kit_id: cleanText(value.kit_id, 100),
    notes: cleanText(value.notes, 1200),
    admin_response: cleanText(value.admin_response, 1200),
    admin_updated_at: cleanText(value.admin_updated_at, 40),
    admin_updated_by: cleanText(value.admin_updated_by, 120),
    shipping: normalizeShipping(value.shipping),
    created_at: cleanText(value.created_at, 40),
    updated_at: cleanText(value.updated_at, 40),
  };
}

export function normalizeMicKitTracker(
  value = {},
  fallback = DEFAULT_MIC_KIT_TRACKER
) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const fallbackSource =
    fallback && typeof fallback === 'object' && !Array.isArray(fallback)
      ? fallback
      : DEFAULT_MIC_KIT_TRACKER;
  const rawKits = Array.isArray(source.kits)
    ? source.kits
    : fallbackSource.kits;
  const rawRequests = Array.isArray(source.requests)
    ? source.requests
    : fallbackSource.requests;

  return {
    schema_version: Number.isInteger(source.schema_version)
      ? source.schema_version
      : 1,
    inventory_confirmed: source.inventory_confirmed === true,
    inventory_note:
      cleanText(source.inventory_note, 1200) ||
      cleanText(fallbackSource.inventory_note, 1200),
    kits: rawKits.slice(0, 50).map(normalizeKit),
    requests: rawRequests.slice(0, 500).map(normalizeRequest),
    updated_at: cleanText(source.updated_at, 40),
    updated_by: cleanText(source.updated_by, 240),
  };
}

export function findActiveMicKitRequest(
  trackerValue = {},
  { requesterPersonId = '', episodeId = '' } = {}
) {
  const cleanRequesterPersonId = cleanText(requesterPersonId, 100);
  const cleanEpisodeId = cleanText(episodeId, 120);
  if (!cleanRequesterPersonId || !cleanEpisodeId) return null;

  const tracker = normalizeMicKitTracker(trackerValue);
  return (
    tracker.requests.find(
      (request) =>
        request.requester_person_id === cleanRequesterPersonId &&
        request.episode_id === cleanEpisodeId &&
        ACTIVE_MIC_KIT_REQUEST_STATUSES.includes(request.status)
    ) || null
  );
}

export function validateMicKitTracker(value = {}) {
  const tracker = normalizeMicKitTracker(value);
  const kitIds = tracker.kits.map((kit) => kit.kit_id);
  const requestIds = tracker.requests.map((request) => request.request_id);
  const assignedRequestIds = tracker.kits
    .map((kit) => kit.next_request_id)
    .filter(Boolean);
  const checkedOutRequestIds = tracker.kits
    .map((kit) => kit.checked_out_request_id)
    .filter(Boolean);

  if (new Set(kitIds).size !== kitIds.length) {
    throw new Error('Mic kit tracker: every kit must have a unique ID.');
  }
  if (new Set(requestIds).size !== requestIds.length) {
    throw new Error('Mic kit tracker: every request must have a unique ID.');
  }
  if (new Set(assignedRequestIds).size !== assignedRequestIds.length) {
    throw new Error(
      'Mic kit tracker: one request cannot be assigned to multiple kits.'
    );
  }
  if (
    new Set(checkedOutRequestIds).size !== checkedOutRequestIds.length
  ) {
    throw new Error(
      'Mic kit tracker: one request cannot be checked out to multiple kits.'
    );
  }

  const knownKitIds = new Set(kitIds);
  const knownRequestIds = new Set(requestIds);
  for (const kit of tracker.kits) {
    if (kit.next_request_id && !knownRequestIds.has(kit.next_request_id)) {
      throw new Error(
        `${kit.label}: the selected next recipient request no longer exists.`
      );
    }
    if (
      kit.checked_out_request_id &&
      !knownRequestIds.has(kit.checked_out_request_id)
    ) {
      throw new Error(
        `${kit.label}: the checked-out request no longer exists.`
      );
    }
    if (kit.checked_out_request_id) {
      const checkedOutRequest = tracker.requests.find(
        (request) =>
          request.request_id === kit.checked_out_request_id
      );
      if (
        kit.status !== 'with_holder' ||
        checkedOutRequest?.status !== 'checked_out' ||
        checkedOutRequest?.kit_id !== kit.kit_id
      ) {
        throw new Error(
          `${kit.label}: the checkout record does not match its host request.`
        );
      }
    }
  }
  for (const request of tracker.requests) {
    if (request.kit_id && !knownKitIds.has(request.kit_id)) {
      throw new Error(
        `${request.requester_name}: the assigned mic kit no longer exists.`
      );
    }
    if (request.status === 'assigned') {
      const assignedKit = tracker.kits.find(
        (kit) => kit.next_request_id === request.request_id
      );
      if (!assignedKit || assignedKit.kit_id !== request.kit_id) {
        throw new Error(
          `${request.requester_name}: the assigned request does not match its mic kit.`
        );
      }
    }
    if (request.status === 'checked_out') {
      const checkedOutKit = tracker.kits.find(
        (kit) => kit.checked_out_request_id === request.request_id
      );
      if (!checkedOutKit || checkedOutKit.kit_id !== request.kit_id) {
        throw new Error(
          `${request.requester_name}: the checkout request does not match its mic kit.`
        );
      }
    }
  }

  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(tracker)
  ).length;
  if (serializedBytes > 350000) {
    throw new Error('Mic kit tracker: the combined history is too large.');
  }

  return tracker;
}

function requestBelongsToViewer(request, viewer = {}) {
  const subject = cleanText(viewer.subject, 160);
  const username = cleanText(viewer.username, 240).toLowerCase();
  return Boolean(
    (subject && request.requester_subject === subject) ||
      (username && request.requester_email === username)
  );
}

export function sanitizeMicKitTrackerForViewer(trackerValue, viewer = {}) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const canManage = viewer.canManage === true;
  const ownRequestIds = new Set(
    tracker.requests
      .filter((request) => requestBelongsToViewer(request, viewer))
      .map((request) => request.request_id)
  );

  return {
    ...tracker,
    kits: tracker.kits.map((kit) => {
      const canSeeShipment =
        canManage ||
        ownRequestIds.has(kit.next_request_id) ||
        ownRequestIds.has(kit.checked_out_request_id);
      return {
        ...kit,
        tracking_available: Boolean(
          kit.tracking_number || kit.tracking_url
        ),
        carrier: canSeeShipment ? kit.carrier : '',
        tracking_number: canSeeShipment ? kit.tracking_number : '',
        tracking_url: canSeeShipment ? kit.tracking_url : '',
        notes: canManage ? kit.notes : '',
      };
    }),
    requests: tracker.requests.map((request) => {
      const isMine = requestBelongsToViewer(request, viewer);
      const canSeePrivate = canManage || isMine;
      return {
        ...request,
        is_mine: isMine,
        requester_subject: '',
        requester_person_id: canManage
          ? request.requester_person_id
          : '',
        requester_email: canSeePrivate ? request.requester_email : '',
        notes: canSeePrivate ? request.notes : '',
        admin_response: canSeePrivate ? request.admin_response : '',
        admin_updated_at: canSeePrivate ? request.admin_updated_at : '',
        admin_updated_by: canSeePrivate ? request.admin_updated_by : '',
        shipping: canSeePrivate ? request.shipping : null,
      };
    }),
  };
}

export function micKitTrackerSummary(trackerValue) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const activeKits = tracker.kits.filter((kit) => kit.status !== 'retired');
  return {
    total: activeKits.length,
    available: activeKits.filter((kit) => kit.status === 'available').length,
    moving: activeKits.filter((kit) => kit.status === 'in_transit').length,
    with_team: activeKits.filter((kit) => kit.status === 'with_holder').length,
    needs_attention: activeKits.filter((kit) => kit.status === 'maintenance')
      .length,
    waiting_requests: tracker.requests.filter((request) =>
      ['requested', 'approved', 'waitlisted'].includes(request.status)
    ).length,
  };
}
