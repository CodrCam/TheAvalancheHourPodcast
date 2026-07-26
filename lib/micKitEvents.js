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
      intent: options.intent || 'informational',
      title,
      preview: plainTextPreview(preview),
      actor_name: options.actorName || '',
      actor_person_id: options.actorPersonId || '',
      entity_kind: 'mic_kit_request',
      entity_id: request.request_id,
      group_entity_kind: 'mic_kit_request',
      group_entity_id: request.request_id,
      group_key: `mic-kit-request:${request.request_id}`,
      deep_link: `/studio/mic-kits#${request.request_id}`,
      audit: {
        source_action: options.sourceAction || '',
        recipient_reason:
          options.recipientReason || 'mic_kit_request_owner',
      },
    },
  };
}

function managerEntries(
  managerPersonIds,
  request,
  actorPersonId,
  base,
  dedupePrefix
) {
  return [...new Set((managerPersonIds || []).filter(Boolean))]
    .filter(
      (personId) =>
        personId !== actorPersonId &&
        personId !== request?.requester_person_id
    )
    .map((personId) => ({
      dedupe_key: `${dedupePrefix}:${personId}`,
      notification: {
        category: 'mic_kit',
        kind: 'event',
        urgency: base.urgency || 'normal',
        intent: base.intent || 'administrative',
        actor_name: base.actorName || '',
        actor_person_id: actorPersonId,
        entity_kind: 'mic_kit_request',
        entity_id: request.request_id,
        group_entity_kind: 'mic_kit_request',
        group_entity_id: request.request_id,
        group_key: `mic-kit-request:${request.request_id}`,
        deep_link: `/admin/mic-kits#${request.request_id}`,
        audit: {
          source_action: base.sourceAction || '',
          recipient_reason: 'mic_kit_manager',
        },
        ...base,
      },
    }));
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
  actorPersonId = '',
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
      {
        actorName,
        actorPersonId,
        sourceAction: action,
        intent: 'informational',
      }
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
            intent: 'administrative',
            title: `${request.requester_name || 'A host'} submitted a mic kit request`,
            preview: request.need_by
              ? `The request is needed by ${request.need_by}. Open the operations board to respond.`
              : 'Open the operations board to review and respond.',
            actor_name: request.requester_name || actorName,
            entity_kind: 'mic_kit_request',
            entity_id: request.request_id,
            group_entity_kind: 'mic_kit_request',
            group_entity_id: request.request_id,
            group_key: `mic-kit-request:${request.request_id}`,
            deep_link: `/admin/mic-kits#${request.request_id}`,
            audit: {
              source_action: action,
              recipient_reason: 'mic_kit_manager',
            },
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
          {
            actorName,
            actorPersonId,
            sourceAction: action,
            intent: 'actionable',
          }
        );
        if (result) entries.push(result);
      }
    }
  }

  if (action === 'cancel_request') {
    const request = tracker.requests.find((candidate) => {
      const previous = previousRequests.get(candidate.request_id);
      return (
        previous &&
        previous.status !== 'cancelled' &&
        candidate.status === 'cancelled'
      );
    });
    if (request) {
      entries.push(
        ...managerEntries(
          managerPersonIds,
          request,
          actorPersonId,
          {
            type: 'mic_kit_request_cancelled',
            title: `${request.requester_name || 'A host'} cancelled a mic kit request`,
            preview:
              'The shared operations queue and any reserved handoff were updated.',
            actorName,
            sourceAction: action,
          },
          `mic-kit:request-cancelled:${request.request_id}:${request.updated_at || token}`
        )
      );
    }
  }

  if (action === 'confirm_receipt') {
    const request = tracker.requests.find((candidate) => {
      const previous = previousRequests.get(candidate.request_id);
      return (
        previous?.status === 'assigned' &&
        candidate.status === 'checked_out'
      );
    });
    if (request) {
      entries.push(
        ...managerEntries(
          managerPersonIds,
          request,
          actorPersonId,
          {
            type: 'mic_kit_receipt_confirmed',
            title: `${request.requester_name || 'A host'} confirmed mic kit receipt`,
            preview:
              'The kit is now recorded with the host and the shared inventory handoff is complete.',
            actorName,
            sourceAction: action,
          },
          `mic-kit:receipt-confirmed:${request.request_id}:${request.updated_at || token}`
        )
      );
    }
  }

  if (action === 'checkin_kit') {
    const request = tracker.requests.find((candidate) => {
      const previous = previousRequests.get(candidate.request_id);
      return (
        previous?.status === 'checked_out' &&
        candidate.status === 'returned'
      );
    });
    const result = entry(
      request,
      'mic_kit_return_checked_in',
      'Your mic kit return was checked in',
      'The shared inventory now shows this handoff as complete.',
      request?.updated_at || token,
      {
        actorName,
        actorPersonId,
        sourceAction: action,
      }
    );
    if (result) entries.push(result);
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
        {
          actorName,
          actorPersonId,
          sourceAction: action,
          urgency: 'high',
          intent: 'actionable',
        }
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
        {
          actorName,
          actorPersonId,
          sourceAction: action,
          urgency: 'high',
          intent: 'actionable',
        }
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
        {
          actorName,
          actorPersonId,
          sourceAction: action,
          intent: 'actionable',
        }
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
