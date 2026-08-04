import crypto from 'crypto';
import {
  ACTIVE_MIC_KIT_REQUEST_STATUSES,
  normalizeMicKitTracker,
} from './micKitPresentation.mjs';

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function shiftDate(value, days) {
  const date = cleanDate(value);
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(Number(days) || 0));
  return parsed.toISOString().slice(0, 10);
}

function participantType(value) {
  return ['host', 'guest'].includes(value) ? value : '';
}

function coordinatorIds(value) {
  return [
    ...new Set(
      (Array.isArray(value) ? value : [])
        .map((personId) => cleanText(personId, 100))
        .filter(Boolean)
    ),
  ].slice(0, 10);
}

function digest(value) {
  return crypto
    .createHash('sha256')
    .update(value, 'utf8')
    .digest('hex')
    .slice(0, 28);
}

/**
 * Returns one stable request ID for an episode participant. Guest IDs retain
 * compatibility with questionnaire-created requests, while cohosts are keyed
 * by their server-side person ID.
 */
export function episodeMicKitRequestId({
  episodeId = '',
  participantType: participantTypeValue = '',
  requesterPersonId = '',
} = {}) {
  const cleanEpisodeId = cleanText(episodeId, 120);
  const cleanParticipantType = participantType(participantTypeValue);
  const cleanRequesterPersonId = cleanText(requesterPersonId, 100);
  if (!cleanEpisodeId || !cleanParticipantType) return '';

  if (cleanParticipantType === 'guest') {
    return `mic-request-guest-${digest(cleanEpisodeId)}`;
  }
  if (!cleanRequesterPersonId) return '';
  return `mic-request-host-${digest(
    `${cleanEpisodeId}\u0000${cleanRequesterPersonId}`
  )}`;
}

export function buildEpisodeMicKitEquipmentReviewRequest({
  episodeId = '',
  recordingDate = '',
  participantType: participantTypeValue = '',
  requesterName = '',
  requesterPersonId = '',
  requesterSubject = '',
  requesterEmail = '',
  coordinatorPersonIds = [],
  now = new Date().toISOString(),
} = {}) {
  const cleanParticipantType = participantType(participantTypeValue);
  const cleanEpisodeId = cleanText(episodeId, 120);
  const cleanRequesterPersonId = cleanText(requesterPersonId, 100);
  const requestId = episodeMicKitRequestId({
    episodeId: cleanEpisodeId,
    participantType: cleanParticipantType,
    requesterPersonId: cleanRequesterPersonId,
  });
  if (!requestId) return null;

  const cleanRecordingDate = cleanDate(recordingDate);
  const timestamp = cleanText(now, 40);
  const roleLabel =
    cleanParticipantType === 'guest' ? 'Episode guest' : 'Episode host';

  return {
    request_id: requestId,
    request_kind: 'equipment_review',
    review_resolution: '',
    participant_type: cleanParticipantType,
    coordinator_person_ids: coordinatorIds(coordinatorPersonIds),
    source: 'studio',
    source_response_id: '',
    requester_subject: cleanText(requesterSubject, 160),
    requester_person_id: cleanRequesterPersonId,
    requester_name: cleanText(requesterName, 120) || roleLabel,
    requester_email: cleanText(requesterEmail, 240).toLowerCase(),
    country: '',
    city_region: '',
    need_by: shiftDate(cleanRecordingDate, -7),
    recording_date: cleanRecordingDate,
    episode_id: cleanEpisodeId,
    planned_due_back: '',
    status: 'requested',
    kit_id: '',
    notes:
      cleanParticipantType === 'guest'
        ? 'Review the guest recording setup and confirm whether a microphone kit is needed.'
        : 'Review the host recording setup and confirm whether a microphone kit is needed.',
    admin_response: '',
    admin_updated_at: '',
    admin_updated_by: '',
    shipping: {},
    created_at: timestamp,
    updated_at: timestamp,
  };
}

function matchesParticipant(request, candidate) {
  if (
    request.episode_id !== candidate.episode_id ||
    request.participant_type !== candidate.participant_type
  ) {
    return false;
  }
  return candidate.participant_type === 'guest'
    ? true
    : request.requester_person_id === candidate.requester_person_id;
}

/**
 * Creates one early equipment-review request, or returns/reopens the existing
 * request for the same episode participant. All identity fields in `candidate`
 * come from explicit server-derived arguments; arbitrary nested request input
 * is intentionally unsupported.
 */
export function upsertEpisodeMicKitEquipmentReviewRequest({
  tracker: trackerValue = {},
  ...serverContext
} = {}) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const candidate = buildEpisodeMicKitEquipmentReviewRequest(serverContext);
  if (!candidate) {
    return {
      tracker,
      request: null,
      created: false,
      reopened: false,
      existing: false,
    };
  }

  const activeRequest =
    tracker.requests.find(
      (request) =>
        request.request_id === candidate.request_id &&
        ACTIVE_MIC_KIT_REQUEST_STATUSES.includes(request.status)
    ) ||
    tracker.requests.find(
      (request) =>
        matchesParticipant(request, candidate) &&
        ACTIVE_MIC_KIT_REQUEST_STATUSES.includes(request.status)
    );
  if (activeRequest) {
    return {
      tracker,
      request: activeRequest,
      created: false,
      reopened: false,
      existing: true,
    };
  }

  const deterministicIndex = tracker.requests.findIndex(
    (request) => request.request_id === candidate.request_id
  );
  const deterministicRequest =
    deterministicIndex >= 0 ? tracker.requests[deterministicIndex] : null;
  if (['cancelled', 'declined'].includes(deterministicRequest?.status)) {
    const reopenedRequest = {
      ...deterministicRequest,
      ...candidate,
      source: deterministicRequest.source || candidate.source,
      source_response_id: deterministicRequest.source_response_id,
      country: deterministicRequest.country,
      city_region: deterministicRequest.city_region,
      notes: deterministicRequest.notes || candidate.notes,
      shipping: deterministicRequest.shipping,
      created_at:
        deterministicRequest.created_at || candidate.created_at,
      updated_at: candidate.updated_at,
    };
    tracker.requests[deterministicIndex] = reopenedRequest;
    const normalizedTracker = normalizeMicKitTracker(tracker);
    return {
      tracker: normalizedTracker,
      request:
        normalizedTracker.requests.find(
          (request) => request.request_id === candidate.request_id
        ) || null,
      created: false,
      reopened: true,
      existing: false,
    };
  }

  // A deterministic terminal request must not be duplicated under the same ID.
  // This branch is primarily defensive for legacy returned/declined records.
  if (deterministicRequest) {
    return {
      tracker,
      request: deterministicRequest,
      created: false,
      reopened: false,
      existing: true,
    };
  }

  tracker.requests.push(candidate);
  const normalizedTracker = normalizeMicKitTracker(tracker);
  return {
    tracker: normalizedTracker,
    request:
      normalizedTracker.requests.find(
        (request) => request.request_id === candidate.request_id
      ) || null,
    created: true,
    reopened: false,
    existing: false,
  };
}
