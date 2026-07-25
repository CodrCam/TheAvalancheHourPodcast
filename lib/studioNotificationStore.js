import crypto from 'crypto';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  normalizeStudioNotification,
  validateStudioNotification,
} from './studioNotificationPresentation.mjs';

const NOTIFICATION_PREFIX = 'studio_notification#';

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isStudioNotificationStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

function recipientId(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .slice(0, 180);
}

function notificationId(dedupeKey) {
  return crypto
    .createHash('sha256')
    .update(String(dedupeKey || ''), 'utf8')
    .digest('hex');
}

function key(personId, id) {
  return `${NOTIFICATION_PREFIX}${recipientId(personId)}#${String(id || '')}`;
}

function prefix(personId) {
  return `${NOTIFICATION_PREFIX}${recipientId(personId)}#`;
}

function parse(item) {
  try {
    return normalizeStudioNotification(JSON.parse(item.content_json?.S || '{}'));
  } catch {
    return null;
  }
}

export async function createStudioNotification(value, options = {}) {
  if (!isStudioNotificationStoreConfigured()) {
    return {
      created: false,
      configured: false,
      reason: 'Studio notification storage is not configured.',
    };
  }
  const now = new Date().toISOString();
  const id = notificationId(
    options.dedupeKey ||
      `${value.type}:${value.recipient_person_id}:${value.entity_id}:${now}`
  );
  const notification = validateStudioNotification({
    ...value,
    notification_id: id,
    generated_at: value.generated_at || now,
    created_at: value.created_at || now,
    delivery: {
      in_app: 'delivered',
      email: 'not_requested',
    },
  });
  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName(),
      Item: {
        content_key: {
          S: key(notification.recipient_person_id, notification.notification_id),
        },
        content_json: { S: JSON.stringify(notification) },
        updated_at: { S: now },
      },
      ConditionExpression: 'attribute_not_exists(#key)',
      ExpressionAttributeNames: { '#key': 'content_key' },
    });
    return { created: true, configured: true, notification };
  } catch (error) {
    if (/conditional/i.test(String(error.message || ''))) {
      return { created: false, configured: true, duplicate: true };
    }
    throw error;
  }
}

export async function createStudioNotifications(entries = []) {
  const results = [];
  for (const entry of Array.isArray(entries) ? entries : []) {
    results.push(
      await createStudioNotification(entry.notification, {
        dedupeKey: entry.dedupe_key,
      })
    );
  }
  return results;
}

export async function listStudioNotifications(personId, options = {}) {
  if (!isStudioNotificationStoreConfigured()) {
    return {
      notifications: [],
      unread_count: 0,
      configured: false,
    };
  }
  const notifications = [];
  let exclusiveStartKey;
  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName(),
      ProjectionExpression: '#key, #content_json',
      FilterExpression: 'begins_with(#key, :prefix)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#content_json': 'content_json',
      },
      ExpressionAttributeValues: {
        ':prefix': { S: prefix(personId) },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    for (const item of response.Items || []) {
      const notification = parse(item);
      if (
        notification?.recipient_person_id === recipientId(personId)
      ) {
        notifications.push(notification);
      }
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  notifications.sort((a, b) => b.created_at.localeCompare(a.created_at));
  const unreadCount = notifications.filter(
    (notification) => !notification.read_at
  ).length;
  const limit =
    options.limit === 'all'
      ? notifications.length
      : Math.max(1, Math.min(200, Number(options.limit) || 100));
  return {
    notifications: notifications.slice(0, limit),
    unread_count: unreadCount,
    configured: true,
  };
}

async function saveReadState(notification, readAt) {
  const now = new Date().toISOString();
  const next = normalizeStudioNotification({
    ...notification,
    read_at: readAt,
  });
  await dynamoDbRequest('PutItem', {
    TableName: tableName(),
    Item: {
      content_key: {
        S: key(next.recipient_person_id, next.notification_id),
      },
      content_json: { S: JSON.stringify(next) },
      updated_at: { S: now },
    },
    ConditionExpression: 'attribute_exists(#key)',
    ExpressionAttributeNames: { '#key': 'content_key' },
  });
  return next;
}

export async function markStudioNotificationRead(
  personId,
  notificationIdValue,
  read = true
) {
  if (!isStudioNotificationStoreConfigured()) {
    throw new Error('Studio notification storage is not configured.');
  }
  const id = String(notificationIdValue || '').trim();
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName(),
    Key: { content_key: { S: key(personId, id) } },
    ConsistentRead: true,
  });
  const notification = parse(response.Item);
  if (
    !notification ||
    notification.recipient_person_id !== recipientId(personId)
  ) {
    throw new Error('Studio notification not found.');
  }
  return saveReadState(notification, read ? new Date().toISOString() : '');
}

export async function markAllStudioNotificationsRead(personId) {
  const result = await listStudioNotifications(personId, { limit: 'all' });
  const unread = result.notifications.filter(
    (notification) => !notification.read_at
  );
  const readAt = new Date().toISOString();
  for (const notification of unread) {
    await saveReadState(notification, readAt);
  }
  return { updated: unread.length, read_at: readAt };
}
