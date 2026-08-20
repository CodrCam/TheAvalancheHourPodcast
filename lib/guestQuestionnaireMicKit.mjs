import crypto from 'crypto';
import { projectGuestQuestionnaireResponse } from './guestQuestionnairePresentation.mjs';
import { normalizeMicKitTracker } from './micKitPresentation.mjs';

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function normalizeShippingCountry(value) {
  const country = cleanText(value, 80);
  const key = country.toLowerCase().replace(/[^a-z]/g, '');
  if (['us', 'usa', 'unitedstates', 'unitedstatesofamerica'].includes(key)) {
    return 'US';
  }
  if (['ca', 'can', 'canada'].includes(key)) return 'CA';
  return /^[a-z]{2}$/i.test(country) ? country.toUpperCase() : '';
}

function shiftDate(value, days) {
  const date = cleanDate(value);
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + Math.trunc(Number(days) || 0));
  return parsed.toISOString().slice(0, 10);
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function responseRevision(questionnaire = {}) {
  return Math.max(
    0,
    Math.trunc(Number(plainObject(questionnaire.response).revision) || 0)
  );
}

function clearQueuedGuestRequestFromKits(tracker, requestId) {
  tracker.kits = tracker.kits.map((kit) => {
    if (kit.next_request_id !== requestId) return kit;
    const hasCurrentHolder = Boolean(kit.checked_out_request_id);
    const clearTracking =
      !kit.tracking_request_id || kit.tracking_request_id === requestId;
    return {
      ...kit,
      next_request_id: '',
      ship_by: '',
      due_back: hasCurrentHolder ? kit.due_back : '',
      carrier: clearTracking ? '' : kit.carrier,
      tracking_number: clearTracking ? '' : kit.tracking_number,
      tracking_url: clearTracking ? '' : kit.tracking_url,
      tracking_request_id: clearTracking ? '' : kit.tracking_request_id,
    };
  });
}

function requestHasPhysicalFulfillment(tracker, request) {
  if (!request) return false;
  if (['checked_out', 'returned'].includes(request.status)) return true;
  return tracker.kits.some(
    (kit) =>
      (kit.checked_out_request_id === request.request_id ||
        kit.tracking_request_id === request.request_id ||
        (kit.next_request_id === request.request_id &&
          kit.status === 'in_transit')) &&
      (kit.status === 'in_transit' ||
        Boolean(kit.checked_out_request_id) ||
        Boolean(kit.carrier || kit.tracking_number || kit.tracking_url))
  );
}

function appendCorrectionAlert(notesValue, message) {
  const notes = cleanText(notesValue, 1200);
  const alert = cleanText(message, 1200);
  if (!alert || notes.includes(alert)) return notes;
  return cleanText([alert, notes].filter(Boolean).join(' '), 1200);
}

function logisticsFingerprint(request = {}) {
  return JSON.stringify({
    request_kind: request.request_kind,
    review_resolution: request.review_resolution,
    requester_name: request.requester_name,
    requester_email: request.requester_email,
    country: request.country,
    city_region: request.city_region,
    need_by: request.need_by,
    recording_date: request.recording_date,
    shipping: request.shipping,
  });
}

export function guestMicKitRequestId(episodeId) {
  const digest = crypto
    .createHash('sha256')
    .update(cleanText(episodeId, 180), 'utf8')
    .digest('hex')
    .slice(0, 28);
  return digest ? `mic-request-guest-${digest}` : '';
}

export function buildGuestMicKitRequest({
  questionnaire = {},
  episode = {},
  guestPlan = {},
  now = new Date().toISOString(),
} = {}) {
  const record = plainObject(questionnaire);
  const response = plainObject(record.response);
  const answers = plainObject(response.answers);
  const plan = plainObject(guestPlan);
  const episodeId = cleanText(episode.episode_id || record.episode_id, 120);
  const requestId = guestMicKitRequestId(episodeId);
  if (
    !episodeId ||
    !requestId ||
    !['request_kit', 'needs_follow_up'].includes(plan.choice)
  ) {
    return null;
  }
  const shipmentRequested = plan.choice === 'request_kit';

  const recordingDate = cleanDate(episode.recording_date);
  const shippingCountry = normalizeShippingCountry(answers.shipping_country);
  const shippingCity = cleanText(answers.shipping_city, 120);
  const shippingRegion = cleanText(answers.shipping_region, 120);
  const guestName =
    cleanText(plan.guest_name, 120) ||
    cleanText(answers.guest_name, 120) ||
    'Episode guest';
  const coordinatorPersonIds = [
    ...new Set(
      [
        ...(Array.isArray(episode.host_person_ids)
          ? episode.host_person_ids
          : []),
        episode.producer_person_id,
      ]
        .map((personId) => cleanText(personId, 100))
        .filter(Boolean)
    ),
  ].slice(0, 10);

  return {
    request_id: requestId,
    request_kind: shipmentRequested ? 'shipment' : 'equipment_review',
    review_resolution: shipmentRequested ? 'shipment' : '',
    participant_type: 'guest',
    coordinator_person_ids: coordinatorPersonIds,
    source: 'guest_questionnaire',
    source_response_id:
      cleanText(response.response_id, 180) ||
      `revision-${Math.max(0, Math.trunc(Number(response.revision) || 0))}`,
    source_response_revision: Math.max(
      0,
      Math.trunc(Number(response.revision) || 0)
    ),
    requester_subject: '',
    requester_person_id: '',
    requester_name: guestName,
    requester_email: cleanText(answers.guest_email, 240).toLowerCase(),
    country: shippingCountry,
    city_region: [shippingCity, shippingRegion].filter(Boolean).join(', '),
    need_by: shiftDate(recordingDate, -7) || recordingDate,
    recording_date: recordingDate,
    episode_id: episodeId,
    planned_due_back: '',
    status: 'requested',
    kit_id: '',
    notes: cleanText(
      plan.equipment_note ||
        (shipmentRequested
          ? 'Guest questionnaire requested an Avalanche Hour microphone kit.'
          : 'The episode team needs to review the guest recording setup.'),
      1200
    ),
    admin_response: '',
    admin_updated_at: '',
    admin_updated_by: '',
    shipping: {
      recipient:
        cleanText(answers.shipping_recipient_name, 120) || guestName,
      phone: cleanText(answers.shipping_phone, 60),
      address_line_1: cleanText(answers.shipping_address_line_1, 180),
      address_line_2: cleanText(answers.shipping_address_line_2, 180),
      city: shippingCity,
      region: shippingRegion,
      postal_code: cleanText(answers.shipping_postal_code, 40),
      country: shippingCountry,
    },
    created_at: cleanText(now, 40),
    updated_at: cleanText(now, 40),
  };
}

export function upsertGuestMicKitRequest({
  tracker: trackerValue = {},
  questionnaire = {},
  episode = {},
  guestPlan = {},
  now = new Date().toISOString(),
} = {}) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const episodeId = cleanText(
    episode.episode_id || questionnaire.episode_id,
    120
  );
  const deterministicRequestId = guestMicKitRequestId(episodeId);
  const existingIndex = tracker.requests.findIndex(
    (candidate) =>
      candidate.request_id === deterministicRequestId ||
      (candidate.participant_type === 'guest' &&
        candidate.source === 'guest_questionnaire' &&
        candidate.episode_id === episodeId)
  );
  const existing = existingIndex >= 0 ? tracker.requests[existingIndex] : null;
  const request = buildGuestMicKitRequest({
    questionnaire,
    episode,
    guestPlan,
    now,
  });
  const incomingRevision = responseRevision(questionnaire);
  const existingRevision = Math.max(
    0,
    Math.trunc(Number(existing?.source_response_revision) || 0)
  );
  const correctedResponse = Boolean(
    existing &&
      incomingRevision > existingRevision &&
      incomingRevision > 1
  );

  if (!request) {
    if (!existing || !correctedResponse) {
      return { tracker, request: existing, created: false, changed: false };
    }

    const physicalFulfillment = requestHasPhysicalFulfillment(
      tracker,
      existing
    );
    const candidate = physicalFulfillment
      ? {
          ...existing,
          source_response_revision: incomingRevision,
          notes: appendCorrectionAlert(
            existing.notes,
            'Action required: a corrected guest questionnaire says no microphone-kit shipment is needed, but physical fulfillment has already started. Verify the shipment manually.'
          ),
          updated_at: cleanText(now, 40),
        }
      : {
          ...existing,
          request_kind: 'equipment_review',
          review_resolution: 'own_equipment',
          source_response_revision: incomingRevision,
          status: 'cancelled',
          kit_id: '',
          planned_due_back: '',
          notes: appendCorrectionAlert(
            existing.notes,
            'Corrected guest questionnaire: no microphone-kit shipment is needed.'
          ),
          updated_at: cleanText(now, 40),
        };
    if (!physicalFulfillment) {
      clearQueuedGuestRequestFromKits(tracker, existing.request_id);
    }
    tracker.requests[existingIndex] = candidate;
    const normalizedTracker = normalizeMicKitTracker(tracker);
    return {
      tracker: normalizedTracker,
      request:
        normalizedTracker.requests.find(
          (item) => item.request_id === candidate.request_id
        ) || null,
      created: false,
      changed: JSON.stringify(candidate) !== JSON.stringify(existing),
    };
  }

  const resolvedReview = ['shipment', 'own_equipment'].includes(
    existing?.review_resolution
  );
  const physicalFulfillment = requestHasPhysicalFulfillment(tracker, existing);
  const logisticsChanged = Boolean(
    existing && logisticsFingerprint(existing) !== logisticsFingerprint(request)
  );
  const requestShapeChanged = Boolean(
    existing &&
      (existing.request_kind !== request.request_kind ||
        existing.review_resolution !== request.review_resolution)
  );
  const needsManualReview = Boolean(
    correctedResponse && physicalFulfillment && logisticsChanged
  );
  const correctionAlertPending = Boolean(
    physicalFulfillment &&
      existing?.notes?.includes(
        'Action required: corrected guest questionnaire'
      )
  );
  const refreshCorrectedRequest = Boolean(
    correctedResponse && !physicalFulfillment
  );
  const reopenCorrectedRequest = Boolean(
    refreshCorrectedRequest &&
      (requestShapeChanged ||
        ['declined', 'cancelled', 'returned'].includes(existing?.status))
  );

  const candidate = existing
    ? needsManualReview
      ? {
          ...existing,
          source_response_revision: incomingRevision,
          notes: appendCorrectionAlert(
            existing.notes,
            'Action required: corrected guest questionnaire shipping or equipment details arrived after physical fulfillment started. Verify the current shipment manually.'
          ),
          updated_at: cleanText(now, 40),
        }
      : {
          ...existing,
          ...request,
          request_id: existing.request_id,
          request_kind:
            resolvedReview && !refreshCorrectedRequest
              ? existing.request_kind
              : request.request_kind,
          review_resolution:
            resolvedReview && !refreshCorrectedRequest
              ? existing.review_resolution
              : request.review_resolution,
          status: reopenCorrectedRequest ? 'requested' : existing.status,
          kit_id: reopenCorrectedRequest ? '' : existing.kit_id,
          planned_due_back: reopenCorrectedRequest
            ? ''
            : existing.planned_due_back,
          admin_response: existing.admin_response,
          admin_updated_at: existing.admin_updated_at,
          admin_updated_by: existing.admin_updated_by,
          notes: correctionAlertPending ? existing.notes : request.notes,
          country:
            resolvedReview && !refreshCorrectedRequest
              ? existing.country
              : request.country,
          city_region:
            resolvedReview && !refreshCorrectedRequest
              ? existing.city_region
              : request.city_region,
          need_by:
            resolvedReview && !refreshCorrectedRequest
              ? existing.need_by
              : request.need_by,
          shipping:
            resolvedReview && !refreshCorrectedRequest
              ? existing.shipping
              : request.shipping,
          created_at: existing.created_at || request.created_at,
          updated_at: existing.updated_at || request.updated_at,
        }
    : request;
  if (reopenCorrectedRequest) {
    clearQueuedGuestRequestFromKits(tracker, existing.request_id);
  }
  const changed =
    !existing || JSON.stringify(candidate) !== JSON.stringify(existing);
  if (changed) candidate.updated_at = cleanText(now, 40);

  if (existingIndex >= 0) tracker.requests[existingIndex] = candidate;
  else tracker.requests.push(candidate);

  const normalizedTracker = normalizeMicKitTracker(tracker);
  const normalizedRequest = normalizedTracker.requests.find(
    (item) => item.request_id === candidate.request_id
  );
  return {
    tracker: normalizedTracker,
    request: normalizedRequest || null,
    created: !existing,
    changed,
  };
}

export function reconcileSubmittedGuestMicKitRequests({
  tracker: trackerValue = {},
  questionnaires = [],
  episodes = [],
  now = new Date().toISOString(),
} = {}) {
  const episodesById = new Map(
    (Array.isArray(episodes) ? episodes : [])
      .filter(
        (episode) =>
          episode?.episode_id &&
          episode.status !== 'accepted' &&
          episode.archived !== true &&
          !episode.deleted_at &&
          !episode.deletion_finalized_at
      )
      .map((episode) => [episode.episode_id, episode])
  );
  let tracker = normalizeMicKitTracker(trackerValue);
  let changed = false;
  const requestIds = [];

  for (const questionnaire of Array.isArray(questionnaires)
    ? questionnaires
    : []) {
    if (questionnaire?.response?.status !== 'submitted') continue;
    const episode = episodesById.get(questionnaire.episode_id);
    if (!episode) continue;
    const projection = projectGuestQuestionnaireResponse(questionnaire);
    const guestPlan = projection.production?.guest_mic_kit_plan;
    const synced = upsertGuestMicKitRequest({
      tracker,
      questionnaire,
      episode,
      guestPlan,
      now,
    });
    tracker = synced.tracker;
    changed = changed || synced.changed;
    if (synced.request?.request_id) {
      requestIds.push(synced.request.request_id);
    }
  }

  return {
    tracker,
    changed,
    request_ids: [...new Set(requestIds)],
  };
}

export function scrubGuestMicKitDataForEpisode(
  trackerValue = {},
  episodeIdValue = '',
  { now = new Date().toISOString() } = {}
) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const episodeId = cleanText(episodeIdValue, 120);
  const matchingRequestIds = new Set(
    tracker.requests
      .filter(
        (request) =>
          request.participant_type === 'guest' &&
          request.source === 'guest_questionnaire' &&
          request.episode_id === episodeId
      )
      .map((request) => request.request_id)
  );
  if (!episodeId || matchingRequestIds.size === 0) {
    return { tracker, changed: false, scrubbed_request_count: 0 };
  }

  const scrubbed = {
    ...tracker,
    kits: tracker.kits.map((kit) => {
      const isNextRecipient = matchingRequestIds.has(kit.next_request_id);
      const isCurrentRecipient = matchingRequestIds.has(
        kit.checked_out_request_id
      );
      const isLinked = isNextRecipient || isCurrentRecipient;
      return isLinked
        ? {
            ...kit,
            current_holder_name: isCurrentRecipient
              ? ''
              : kit.current_holder_name,
            current_location: isCurrentRecipient
              ? ''
              : kit.current_location,
            tracking_number: '',
            tracking_url: '',
            notes: '',
          }
        : kit;
    }),
    requests: tracker.requests.map((request) =>
      matchingRequestIds.has(request.request_id)
        ? {
            ...request,
            coordinator_person_ids: [],
            source_response_id: '',
            requester_subject: '',
            requester_person_id: '',
            requester_name: 'Deleted guest recipient',
            requester_email: '',
            country: '',
            city_region: '',
            need_by: '',
            recording_date: '',
            episode_id: '',
            notes: '',
            admin_response: '',
            admin_updated_at: '',
            admin_updated_by: '',
            shipping: {},
            updated_at: cleanText(now, 40),
          }
        : request
    ),
  };

  return {
    tracker: normalizeMicKitTracker(scrubbed),
    changed: true,
    scrubbed_request_count: matchingRequestIds.size,
  };
}
