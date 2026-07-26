export const STUDIO_NOTIFICATION_KINDS = ['event', 'reminder'];
export const STUDIO_NOTIFICATION_URGENCIES = [
  'low',
  'normal',
  'high',
  'urgent',
];
export const STUDIO_NOTIFICATION_INTENTS = [
  'informational',
  'actionable',
  'urgent',
  'administrative',
];

function cleanText(value, maxLength = 1000) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

export function plainTextPreview(value, maxLength = 180) {
  const withoutMarkup = String(value || '')
    .replace(/<[^>]*>/g, ' ')
    .replace(/&(?:[a-z]+|#\d+|#x[a-f0-9]+);/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  return withoutMarkup.slice(0, maxLength);
}

export function safeStudioDeepLink(value = '') {
  const link = cleanText(value, 500);
  if (
    !link.startsWith('/') ||
    link.startsWith('//') ||
    link.includes('\\') ||
    /[\u0000-\u001f]/.test(link)
  ) {
    return '';
  }
  return link;
}

export function normalizeStudioNotification(value = {}) {
  const kind = STUDIO_NOTIFICATION_KINDS.includes(value.kind)
    ? value.kind
    : 'event';
  const urgency = STUDIO_NOTIFICATION_URGENCIES.includes(value.urgency)
    ? value.urgency
    : 'normal';
  const intent = STUDIO_NOTIFICATION_INTENTS.includes(value.intent)
    ? value.intent
    : urgency === 'urgent'
      ? 'urgent'
      : 'informational';
  const entityKind = cleanId(value.entity_kind);
  const entityId = cleanId(value.entity_id);
  const groupEntityKind =
    cleanId(value.group_entity_kind) || entityKind || 'system';
  const groupEntityId =
    cleanId(value.group_entity_id) || entityId || 'general';
  return {
    notification_id: cleanId(value.notification_id),
    recipient_person_id: cleanId(value.recipient_person_id),
    type: cleanId(value.type),
    category: [
      'episode',
      'mic_kit',
      'store',
      'access',
      'system',
    ].includes(value.category)
      ? value.category
      : 'system',
    kind,
    urgency,
    intent,
    title: plainTextPreview(value.title, 180),
    preview: plainTextPreview(value.preview, 240),
    actor_name: plainTextPreview(value.actor_name, 180),
    actor_person_id: cleanId(value.actor_person_id),
    entity_kind: entityKind,
    entity_id: entityId,
    group_entity_kind: groupEntityKind,
    group_entity_id: groupEntityId,
    group_key:
      cleanId(value.group_key) ||
      `${groupEntityKind}:${groupEntityId}`,
    deep_link: safeStudioDeepLink(value.deep_link),
    due_date: cleanDate(value.due_date),
    generated_at: cleanText(value.generated_at, 50),
    created_at: cleanText(value.created_at, 50),
    seen_at: cleanText(value.seen_at, 50),
    read_at: cleanText(value.read_at, 50),
    expires_at: cleanText(value.expires_at, 50),
    audit: {
      event_name: cleanId(value.audit?.event_name || value.type),
      source_action: cleanId(value.audit?.source_action),
      recipient_reason: cleanId(value.audit?.recipient_reason),
      idempotency_key_hash: cleanId(
        value.audit?.idempotency_key_hash
      ),
    },
    required_permission: cleanText(value.required_permission, 120),
    delivery: {
      in_app: ['pending', 'delivered', 'failed'].includes(
        value.delivery?.in_app
      )
        ? value.delivery.in_app
        : 'delivered',
      email: ['not_requested', 'pending', 'delivered', 'failed'].includes(
        value.delivery?.email
      )
        ? value.delivery.email
        : 'not_requested',
    },
  };
}

export function validateStudioNotification(value = {}) {
  const notification = normalizeStudioNotification(value);
  if (
    !notification.notification_id ||
    !notification.recipient_person_id ||
    !notification.type ||
    !notification.title ||
    !notification.deep_link
  ) {
    throw new Error('Studio notification: required fields are missing.');
  }
  return notification;
}

function notificationDate(notification = {}) {
  return (
    notification.created_at ||
    notification.generated_at ||
    '1970-01-01T00:00:00.000Z'
  );
}

export function groupStudioNotifications(values = []) {
  const groupsByKey = new Map();

  for (const value of Array.isArray(values) ? values : []) {
    const notification = normalizeStudioNotification(value);
    if (!notification.notification_id) continue;
    const groupKey =
      notification.group_key ||
      `${notification.group_entity_kind}:${notification.group_entity_id}`;
    const group = groupsByKey.get(groupKey) || {
      group_key: groupKey,
      category: notification.category,
      entity_kind: notification.group_entity_kind,
      entity_id: notification.group_entity_id,
      latest_at: '',
      latest_title: '',
      latest_preview: '',
      deep_link: notification.deep_link,
      unread_count: 0,
      unseen_count: 0,
      notification_count: 0,
      urgency: 'low',
      intent: 'informational',
      notifications: [],
    };
    group.notifications.push(notification);
    groupsByKey.set(groupKey, group);
  }

  const urgencyOrder = {
    low: 0,
    normal: 1,
    high: 2,
    urgent: 3,
  };
  const intentOrder = {
    informational: 0,
    actionable: 1,
    administrative: 2,
    urgent: 3,
  };

  const groups = [...groupsByKey.values()].map((group) => {
    group.notifications.sort((a, b) =>
      notificationDate(b).localeCompare(notificationDate(a))
    );
    const latest = group.notifications[0];
    return {
      ...group,
      latest_at: notificationDate(latest),
      latest_title: latest.title,
      latest_preview: latest.preview,
      deep_link: latest.deep_link,
      unread_count: group.notifications.filter(
        (notification) => !notification.read_at
      ).length,
      unseen_count: group.notifications.filter(
        (notification) => !notification.seen_at
      ).length,
      notification_count: group.notifications.length,
      urgency: group.notifications.reduce(
        (current, notification) =>
          urgencyOrder[notification.urgency] > urgencyOrder[current]
            ? notification.urgency
            : current,
        'low'
      ),
      intent: group.notifications.reduce(
        (current, notification) =>
          intentOrder[notification.intent] > intentOrder[current]
            ? notification.intent
            : current,
        'informational'
      ),
    };
  });

  return groups.sort((a, b) => b.latest_at.localeCompare(a.latest_at));
}

export function notificationCanBeOpened(
  value,
  {
    personId = '',
    permissions = [],
    episodesById = new Map(),
    micKitRequestsById = new Map(),
  } = {}
) {
  const notification = normalizeStudioNotification(value);
  const cleanPersonId = cleanId(personId);
  if (
    !cleanPersonId ||
    notification.recipient_person_id !== cleanPersonId ||
    !notification.deep_link
  ) {
    return false;
  }

  const permissionSet = new Set(permissions || []);
  if (notification.category === 'episode') {
    const episode = episodesById.get(notification.group_entity_id);
    if (
      !episode ||
      episode.archived === true ||
      episode.archived_at ||
      episode.deleted_at
    ) {
      return false;
    }
    if (permissionSet.has('episodes:manage')) return true;
    return [
      ...(episode.host_person_ids || []),
      episode.producer_person_id,
      episode.created_by_person_id,
    ]
      .filter(Boolean)
      .includes(cleanPersonId);
  }

  if (notification.category === 'mic_kit') {
    const request = micKitRequestsById.get(
      notification.group_entity_id
    );
    if (!request || request.deleted_at) return false;
    if (permissionSet.has('mic_kits:manage')) return true;
    return request.requester_person_id === cleanPersonId;
  }

  if (notification.required_permission) {
    return permissionSet.has(notification.required_permission);
  }

  return true;
}

export function filterOpenableStudioNotifications(values = [], context = {}) {
  return (Array.isArray(values) ? values : []).filter((notification) =>
    notificationCanBeOpened(notification, context)
  );
}
