import 'dotenv/config';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from '../lib/dynamoDb.js';
import {
  normalizeStudioNotification,
} from '../lib/studioNotificationPresentation.mjs';

const PREFIX = 'studio_notification#';
const apply = process.argv.includes('--apply');
const tableName = String(
  process.env.DYNAMODB_SITE_CONTENT_TABLE || ''
).trim();
const retentionDays = Math.max(
  30,
  Math.min(
    365,
    Number(process.env.STUDIO_NOTIFICATION_RETENTION_DAYS) || 120
  )
);

if (!tableName || !isDynamoCredentialsConfigured()) {
  throw new Error(
    'Configure DYNAMODB_SITE_CONTENT_TABLE and DynamoDB credentials first.'
  );
}

function expiresAt(createdAt) {
  const date = new Date(createdAt);
  const base = Number.isNaN(date.getTime()) ? new Date() : date;
  base.setUTCDate(base.getUTCDate() + retentionDays);
  return base.toISOString();
}

function parse(item = {}) {
  try {
    const stored = JSON.parse(item.content_json?.S || '{}');
    const notification = normalizeStudioNotification({
      ...stored,
      created_at:
        stored.created_at ||
        item.created_at?.S ||
        item.updated_at?.S ||
        new Date().toISOString(),
    });
    if (
      !notification.notification_id ||
      !notification.recipient_person_id
    ) {
      return null;
    }
    return notification;
  } catch {
    return null;
  }
}

let scanned = 0;
let eligible = 0;
let updated = 0;
let malformed = 0;
let exclusiveStartKey;

do {
  const response = await dynamoDbRequest('Scan', {
    TableName: tableName,
    ProjectionExpression:
      '#key, #content_json, #created_at, #updated_at',
    FilterExpression: 'begins_with(#key, :prefix)',
    ExpressionAttributeNames: {
      '#key': 'content_key',
      '#content_json': 'content_json',
      '#created_at': 'created_at',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':prefix': { S: PREFIX },
    },
    ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
  });

  scanned += Number(response.ScannedCount) || 0;
  for (const item of response.Items || []) {
    const notification = parse(item);
    if (!notification) {
      malformed += 1;
      continue;
    }
    eligible += 1;
    if (!apply) continue;

    const expiration = notification.expires_at || expiresAt(
      notification.created_at
    );
    const normalized = normalizeStudioNotification({
      ...notification,
      expires_at: expiration,
    });
    const names = {
      '#content_json': 'content_json',
      '#recipient': 'notification_recipient',
      '#sort': 'notification_sort',
      '#created_at': 'created_at',
      '#expires_at_epoch': 'expires_at_epoch',
      '#updated_at': 'updated_at',
      '#unread': 'notification_unread',
    };
    const values = {
      ':content_json': { S: JSON.stringify(normalized) },
      ':recipient': {
        S: `recipient#${normalized.recipient_person_id}`,
      },
      ':sort': {
        S: `${normalized.created_at}#${normalized.notification_id}`,
      },
      ':created_at': { S: normalized.created_at },
      ':expires_at_epoch': {
        N: String(Math.floor(new Date(expiration).getTime() / 1000)),
      },
      ':updated_at': { S: new Date().toISOString() },
    };
    const unread = !normalized.read_at;
    if (unread) values[':unread'] = { N: '1' };

    await dynamoDbRequest('UpdateItem', {
      TableName: tableName,
      Key: { content_key: item.content_key },
      UpdateExpression: unread
        ? 'SET #content_json = :content_json, #recipient = :recipient, #sort = :sort, #created_at = :created_at, #expires_at_epoch = :expires_at_epoch, #updated_at = :updated_at, #unread = :unread'
        : 'SET #content_json = :content_json, #recipient = :recipient, #sort = :sort, #created_at = :created_at, #expires_at_epoch = :expires_at_epoch, #updated_at = :updated_at REMOVE #unread',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    });
    updated += 1;
  }

  exclusiveStartKey = response.LastEvaluatedKey;
} while (exclusiveStartKey);

console.info(
  JSON.stringify(
    {
      mode: apply ? 'apply' : 'dry-run',
      table: tableName,
      scanned,
      eligible,
      updated,
      malformed,
      retention_days: retentionDays,
    },
    null,
    2
  )
);

if (!apply) {
  console.info(
    'Dry run only. Re-run with --apply after reviewing the counts.'
  );
}
