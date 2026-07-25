export const STUDIO_NOTIFICATION_KINDS = ['event', 'reminder'];
export const STUDIO_NOTIFICATION_URGENCIES = [
  'low',
  'normal',
  'high',
  'urgent',
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
  return {
    notification_id: cleanId(value.notification_id),
    recipient_person_id: cleanId(value.recipient_person_id),
    type: cleanId(value.type),
    category: ['episode', 'mic_kit', 'system'].includes(value.category)
      ? value.category
      : 'system',
    kind,
    urgency,
    title: plainTextPreview(value.title, 180),
    preview: plainTextPreview(value.preview, 240),
    actor_name: plainTextPreview(value.actor_name, 180),
    entity_kind: cleanId(value.entity_kind),
    entity_id: cleanId(value.entity_id),
    deep_link: safeStudioDeepLink(value.deep_link),
    due_date: cleanDate(value.due_date),
    generated_at: cleanText(value.generated_at, 50),
    created_at: cleanText(value.created_at, 50),
    read_at: cleanText(value.read_at, 50),
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
