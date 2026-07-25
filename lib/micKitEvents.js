import { createStudioNotifications } from './studioNotificationStore.js';
import { plainTextPreview } from './studioNotificationPresentation.mjs';

function entry(request, type, title, preview, token, options = {}) {
  if (!request?.requester_person_id) return null;
  return {
    dedupe_key: `mic-kit:${type}:${request.request_id}:${token}:${request.requester_person_id}`,
    notification: {
      recipient_person_id: request.requester_person_id,
      type,
      category: 'mic_kit',
      kind: 'event',
      urgency: options.urgency || 'normal',
      title,
      preview: plainTextPreview(preview),
      actor_name: options.actorName || '',
      entity_kind: 'mic_kit_request',
      entity_id: request.request_id,
      deep_link: `/studio/mic-kits#${request.request_id}`,
    },
  };
}

function requestForKit(tracker, kit) {
  const requestId = kit?.next_request_id || kit?.checked_out_request_id;
  return tracker.requests.find(
    (request) => request.request_id === requestId
  );
}

export function buildMicKitNotificationEntries({
  previousTracker,
  tracker,
  action,
  actorName = 'Studio team',
  managerPersonIds = [],
}) {
  const entries = [];
  const previousRequests = new Map(
    (previousTracker?.requests || []).map((request) => [
      request.request_id,
      request,
    ])
  );
  const previousKits = new Map(
    (previousTracker?.kits || []).map((kit) => [kit.kit_id, kit])
  );
  const token = tracker.updated_at || new Date().toISOString();

  if (action === 'create_request') {
    const request = tracker.requests.find(
      (candidate) => !previousRequests.has(candidate.request_id)
    );
    const result = entry(
      request,
      'mic_kit_request_submitted',
      'Mic kit request submitted',
      'Your request is in the shared operations queue. You will be notified when the team responds.',
      request?.created_at || token,
      { actorName }
    );
    if (result) entries.push(result);
    if (request) {
      for (const managerPersonId of [
        ...new Set(managerPersonIds.filter(Boolean)),
      ]) {
        if (managerPersonId === request.requester_person_id) continue;
        entries.push({
          dedupe_key: `mic-kit:manager-request-submitted:${request.request_id}:${request.created_at || token}:${managerPersonId}`,
          notification: {
            recipient_person_id: managerPersonId,
            type: 'mic_kit_request_submitted',
            category: 'mic_kit',
            kind: 'event',
            urgency: 'normal',
            title: `${request.requester_name || 'A host'} submitted a mic kit request`,
            preview: request.need_by
              ? `The request is needed by ${request.need_by}. Open the operations board to respond.`
              : 'Open the operations board to review and respond.',
            actor_name: request.requester_name || actorName,
            entity_kind: 'mic_kit_request',
            entity_id: request.request_id,
            deep_link: `/admin/mic-kits#${request.request_id}`,
          },
        });
      }
    }
  }

  if (action === 'update_request') {
    for (const request of tracker.requests) {
      const previous = previousRequests.get(request.request_id);
      if (
        previous &&
        (previous.status !== request.status ||
          previous.admin_response !== request.admin_response)
      ) {
        const result = entry(
          request,
          'mic_kit_admin_responded',
          `Mic kit request ${request.status.replace(/_/g, ' ')}`,
          request.admin_response ||
            `The operations team changed your request to ${request.status.replace(/_/g, ' ')}.`,
          request.admin_updated_at || token,
          { actorName }
        );
        if (result) entries.push(result);
      }
    }
  }

  for (const kit of tracker.kits || []) {
    const previous = previousKits.get(kit.kit_id);
    const request = requestForKit(tracker, kit);
    if (!request) continue;
    if (
      kit.next_request_id &&
      previous?.next_request_id !== kit.next_request_id
    ) {
      const directHandoff = Boolean(kit.checked_out_request_id);
      const result = entry(
        request,
        directHandoff ? 'mic_kit_direct_handoff_ready' : 'mic_kit_assigned',
        directHandoff
          ? `${kit.label} is planned for a direct handoff`
          : `${kit.label} was assigned to your request`,
        directHandoff
          ? 'Open Mic Kits for the handoff plan. Private address details remain visible only to authorized participants.'
          : 'Open Mic Kits for the current ship-by date and assignment details.',
        token,
        { actorName, urgency: 'high' }
      );
      if (result) entries.push(result);
    }
    if (
      kit.checked_out_request_id &&
      previous?.checked_out_request_id !== kit.checked_out_request_id &&
      !kit.next_request_id
    ) {
      const result = entry(
        request,
        'mic_kit_assigned',
        `${kit.label} is now assigned to your request`,
        'Open Mic Kits to review the current handoff and return plan.',
        token,
        { actorName, urgency: 'high' }
      );
      if (result) entries.push(result);
    }
    if (
      (kit.tracking_url || kit.tracking_number) &&
      (!previous?.tracking_url ||
        previous.tracking_number !== kit.tracking_number ||
        previous.status !== kit.status)
    ) {
      const result = entry(
        request,
        'mic_kit_shipment_tracking_added',
        `Tracking was added for ${kit.label}`,
        'Open your mic kit request to view the authorized shipment details.',
        token,
        { actorName }
      );
      if (result) entries.push(result);
    }
  }

  return entries;
}

export async function publishMicKitNotifications(context) {
  return createStudioNotifications(
    buildMicKitNotificationEntries(context)
  );
}
