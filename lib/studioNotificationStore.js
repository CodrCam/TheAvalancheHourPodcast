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
const DEFAULT_RETENTION_DAYS = 120;

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

function indexName() {
  return (
    process.env.DYNAMODB_STUDIO_NOTIFICATIONS_INDEX ||
    'studio-notifications-index'
  );
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

function idempotencyKeyHash(dedupeKey) {
  return crypto
    .createHash('sha256')
    .update(String(dedupeKey || ''), 'utf8')
    .digest('hex');
}

function key(personId, id) {
  return `${NOTIFICATION_PREFIX}${recipientId(personId)}#${String(id || '')}`;
}

function recipientPartition(personId) {
  return `recipient#${recipientId(personId)}`;
}

function sortKey(notification) {
  return `${notification.created_at}#${notification.notification_id}`;
}

function hasAttribute(item, name) {
  return Object.prototype.hasOwnProperty.call(item || {}, name);
}

function parse(item) {
  try {
    const stored = JSON.parse(item.content_json?.S || '{}');
    return normalizeStudioNotification({
      ...stored,
      ...(hasAttribute(item, 'read_at')
        ? { read_at: item.read_at?.S || '' }
        : {}),
      ...(hasAttribute(item, 'seen_at')
        ? { seen_at: item.seen_at?.S || '' }
        : {}),
    });
  } catch {
    return null;
  }
}

function retentionDays() {
  const configured = Number(
    process.env.STUDIO_NOTIFICATION_RETENTION_DAYS
  );
  return Number.isFinite(configured)
    ? Math.max(30, Math.min(365, Math.trunc(configured)))
    : DEFAULT_RETENTION_DAYS;
}

function expirationFor(createdAt) {
  const date = new Date(createdAt);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  base.setUTCDate(base.getUTCDate() + retentionDays());
  return base.toISOString();
}

function auditNotification(outcome, notification, extra = {}) {
  console.info(
    JSON.stringify({
      event: 'studio_notification_audit',
      timestamp: new Date().toISOString(),
      outcome,
      notification_id: notification?.notification_id || '',
      recipient_person_id: notification?.recipient_person_id || '',
      recipient_reason:
        notification?.audit?.recipient_reason || '',
      event_name: notification?.audit?.event_name || notification?.type || '',
      entity_kind: notification?.group_entity_kind || '',
      entity_id: notification?.group_entity_id || '',
      ...extra,
    })
  );
}

function cursorKey(value = {}) {
  return {
    content_key: { S: String(value.content_key?.S || '') },
    notification_recipient: {
      S: String(value.notification_recipient?.S || ''),
    },
    notification_sort: {
      S: String(value.notification_sort?.S || ''),
    },
  };
}

export function encodeStudioNotificationCursor(value) {
  if (!value) return '';
  return Buffer.from(JSON.stringify(cursorKey(value)), 'utf8').toString(
    'base64url'
  );
}

export function decodeStudioNotificationCursor(value, personId) {
  if (!value) return undefined;
  try {
    const parsed = JSON.parse(
      Buffer.from(String(value), 'base64url').toString('utf8')
    );
    const cursor = cursorKey(parsed);
    const expectedRecipient = recipientPartition(personId);
    if (
      !cursor.content_key.S.startsWith(
        `${NOTIFICATION_PREFIX}${recipientId(personId)}#`
      ) ||
      cursor.notification_recipient.S !== expectedRecipient ||
      !cursor.notification_sort.S
    ) {
      throw new Error('Cursor does not belong to this notification feed.');
    }
    return cursor;
  } catch {
    throw new Error('Notification cursor is invalid.');
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
  const dedupeKey =
    options.dedupeKey ||
    `${value.type}:${value.recipient_person_id}:${value.entity_id}:${now}`;
  const id = notificationId(dedupeKey);
  const expiresAt = value.expires_at || expirationFor(value.created_at || now);
  const notification = validateStudioNotification({
    ...value,
    notification_id: id,
    generated_at: value.generated_at || now,
    created_at: value.created_at || now,
    expires_at: expiresAt,
    audit: {
      ...value.audit,
      event_name: value.audit?.event_name || value.type,
      idempotency_key_hash: idempotencyKeyHash(dedupeKey),
    },
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
          S: key(
            notification.recipient_person_id,
            notification.notification_id
          ),
        },
        content_json: { S: JSON.stringify(notification) },
        notification_recipient: {
          S: recipientPartition(notification.recipient_person_id),
        },
        notification_sort: { S: sortKey(notification) },
        notification_unread: { N: '1' },
        expires_at_epoch: {
          N: String(Math.floor(new Date(expiresAt).getTime() / 1000)),
        },
        created_at: { S: notification.created_at },
        updated_at: { S: now },
      },
      ConditionExpression: 'attribute_not_exists(#key)',
      ExpressionAttributeNames: { '#key': 'content_key' },
    });
    auditNotification('created', notification);
    return { created: true, configured: true, notification };
  } catch (error) {
    if (/conditional/i.test(String(error.message || ''))) {
      auditNotification('duplicate_suppressed', notification);
      return { created: false, configured: true, duplicate: true };
    }
    auditNotification('failed', notification, {
      reason: 'storage_write_failed',
    });
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

async function countUnread(personId) {
  let count = 0;
  let exclusiveStartKey;
  do {
    const response = await dynamoDbRequest('Query', {
      TableName: tableName(),
      IndexName: indexName(),
      KeyConditionExpression: '#recipient = :recipient',
      FilterExpression: '#unread = :unread',
      ExpressionAttributeNames: {
        '#recipient': 'notification_recipient',
        '#unread': 'notification_unread',
      },
      ExpressionAttributeValues: {
        ':recipient': { S: recipientPartition(personId) },
        ':unread': { N: '1' },
      },
      Select: 'COUNT',
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    count += Number(response.Count) || 0;
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  return count;
}

async function queryNotifications(personId, options = {}) {
  const limit = Math.max(1, Math.min(100, Number(options.limit) || 20));
  const response = await dynamoDbRequest('Query', {
    TableName: tableName(),
    IndexName: indexName(),
    KeyConditionExpression: '#recipient = :recipient',
    ExpressionAttributeNames: {
      '#recipient': 'notification_recipient',
    },
    ExpressionAttributeValues: {
      ':recipient': { S: recipientPartition(personId) },
    },
    ScanIndexForward: false,
    Limit: limit,
    ...(options.cursor
      ? {
          ExclusiveStartKey: decodeStudioNotificationCursor(
            options.cursor,
            personId
          ),
        }
      : {}),
  });
  return {
    notifications: (response.Items || [])
      .map(parse)
      .filter(
        (notification) =>
          notification?.recipient_person_id === recipientId(personId)
      ),
    next_cursor: encodeStudioNotificationCursor(
      response.LastEvaluatedKey
    ),
  };
}

export async function listStudioNotifications(personId, options = {}) {
  if (!isStudioNotificationStoreConfigured()) {
    return {
      notifications: [],
      unread_count: 0,
      next_cursor: '',
      configured: false,
    };
  }
  const [page, unreadCount] = await Promise.all([
    queryNotifications(personId, options),
    options.includeUnreadCount === false
      ? Promise.resolve(undefined)
      : countUnread(personId),
  ]);
  return {
    ...page,
    ...(unreadCount === undefined ? {} : { unread_count: unreadCount }),
    configured: true,
  };
}

async function listAllNotifications(personId) {
  const notifications = [];
  let cursor = '';
  do {
    const page = await queryNotifications(personId, {
      limit: 100,
      cursor,
    });
    notifications.push(...page.notifications);
    cursor = page.next_cursor;
  } while (cursor);
  return notifications;
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
  const now = new Date().toISOString();
  const stateExpression = read
    ? {
        UpdateExpression:
          'SET #read_at = :read_at, #seen_at = if_not_exists(#seen_at, :read_at), #updated_at = :updated_at REMOVE #unread',
        ExpressionAttributeNames: {
          '#key': 'content_key',
          '#read_at': 'read_at',
          '#seen_at': 'seen_at',
          '#updated_at': 'updated_at',
          '#unread': 'notification_unread',
        },
        ExpressionAttributeValues: {
          ':read_at': { S: now },
          ':updated_at': { S: now },
        },
      }
    : {
        UpdateExpression:
          'SET #read_at = :empty, #updated_at = :updated_at, #unread = :unread',
        ExpressionAttributeNames: {
          '#key': 'content_key',
          '#read_at': 'read_at',
          '#updated_at': 'updated_at',
          '#unread': 'notification_unread',
        },
        ExpressionAttributeValues: {
          ':empty': { S: '' },
          ':updated_at': { S: now },
          ':unread': { N: '1' },
        },
      };
  let response;
  try {
    response = await dynamoDbRequest('UpdateItem', {
      TableName: tableName(),
      Key: { content_key: { S: key(personId, id) } },
      ConditionExpression: 'attribute_exists(#key)',
      ...stateExpression,
      ReturnValues: 'ALL_NEW',
    });
  } catch (error) {
    if (/conditional/i.test(String(error.message || ''))) {
      throw new Error('Studio notification not found.');
    }
    throw error;
  }
  const notification = parse(response.Attributes);
  if (!notification) throw new Error('Studio notification not found.');
  return notification;
}

async function transactStateUpdates(items, buildUpdate) {
  for (let index = 0; index < items.length; index += 100) {
    const chunk = items.slice(index, index + 100);
    await dynamoDbRequest('TransactWriteItems', {
      TransactItems: chunk.map(buildUpdate),
    });
  }
}

export async function markStudioNotificationsSeen(
  personId,
  notificationIds = []
) {
  if (!isStudioNotificationStoreConfigured()) {
    throw new Error('Studio notification storage is not configured.');
  }
  const ids = [
    ...new Set(
      (Array.isArray(notificationIds) ? notificationIds : [])
        .map((id) => String(id || '').trim())
        .filter(Boolean)
    ),
  ].slice(0, 100);
  if (!ids.length) return { updated: 0, seen_at: '' };
  const seenAt = new Date().toISOString();
  await transactStateUpdates(ids, (id) => ({
    Update: {
      TableName: tableName(),
      Key: { content_key: { S: key(personId, id) } },
      UpdateExpression:
        'SET #seen_at = if_not_exists(#seen_at, :seen_at), #updated_at = :seen_at',
      ConditionExpression: 'attribute_exists(#key)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#seen_at': 'seen_at',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':seen_at': { S: seenAt },
      },
    },
  }));
  return { updated: ids.length, seen_at: seenAt };
}

export async function markAllStudioNotificationsRead(personId) {
  const notifications = await listAllNotifications(personId);
  const unread = notifications.filter(
    (notification) => !notification.read_at
  );
  const readAt = new Date().toISOString();
  await transactStateUpdates(unread, (notification) => ({
    Update: {
      TableName: tableName(),
      Key: {
        content_key: {
          S: key(personId, notification.notification_id),
        },
      },
      UpdateExpression:
        'SET #read_at = :read_at, #seen_at = if_not_exists(#seen_at, :read_at), #updated_at = :read_at REMOVE #unread',
      ConditionExpression: 'attribute_exists(#key)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#read_at': 'read_at',
        '#seen_at': 'seen_at',
        '#updated_at': 'updated_at',
        '#unread': 'notification_unread',
      },
      ExpressionAttributeValues: {
        ':read_at': { S: readAt },
      },
    },
  }));
  return { updated: unread.length, read_at: readAt };
}
