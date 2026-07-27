import crypto from 'crypto';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  sortStudioIntakeItems,
  validateStudioIntakeItem,
} from './studioIntakePresentation.mjs';

const INTAKE_PREFIX = 'studio_intake#';

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

function itemKey(itemId) {
  return `${INTAKE_PREFIX}${String(itemId || '').trim()}`;
}

function parseItem(item = {}) {
  try {
    const value = JSON.parse(item.content_json?.S || '{}');
    return validateStudioIntakeItem({
      ...value,
      updated_at: item.updated_at?.S || value.updated_at,
    });
  } catch {
    return null;
  }
}

function storedItem(item) {
  return {
    content_key: { S: itemKey(item.item_id) },
    content_json: { S: JSON.stringify(item) },
    intake_status: { S: item.status },
    intake_priority: { S: item.priority },
    created_at: { S: item.created_at },
    updated_at: { S: item.updated_at },
  };
}

export function isStudioIntakeStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

export function createStudioIntakeId(title = '') {
  const slug = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
  return `${slug || 'team-item'}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listStudioIntakeItems({ includeArchived = false } = {}) {
  if (!isStudioIntakeStoreConfigured()) {
    return { items: [], configured: false };
  }

  const items = [];
  let exclusiveStartKey;
  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName(),
      ProjectionExpression: '#key, #content_json, #updated_at',
      FilterExpression: 'begins_with(#key, :prefix)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#content_json': 'content_json',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':prefix': { S: INTAKE_PREFIX },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const row of response.Items || []) {
      const item = parseItem(row);
      if (item?.item_id && (includeArchived || !item.archived)) {
        items.push(item);
      }
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return { items: sortStudioIntakeItems(items), configured: true };
}

export async function getStudioIntakeItem(itemId) {
  if (!isStudioIntakeStoreConfigured()) {
    return { item: null, configured: false };
  }
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName(),
    Key: { content_key: { S: itemKey(itemId) } },
    ConsistentRead: true,
  });
  return {
    item: response.Item ? parseItem(response.Item) : null,
    configured: true,
  };
}

export async function createStudioIntakeItem(value = {}) {
  if (!isStudioIntakeStoreConfigured()) {
    throw new Error('Team follow-up storage is not configured.');
  }
  const now = new Date().toISOString();
  const item = validateStudioIntakeItem({
    ...value,
    item_id: value.item_id || createStudioIntakeId(value.title),
    created_at: value.created_at || now,
    updated_at: now,
  });
  await dynamoDbRequest('PutItem', {
    TableName: tableName(),
    Item: storedItem(item),
    ConditionExpression: 'attribute_not_exists(#key)',
    ExpressionAttributeNames: { '#key': 'content_key' },
  });
  return { item, configured: true };
}

export async function saveStudioIntakeItem(value = {}, options = {}) {
  if (!isStudioIntakeStoreConfigured()) {
    throw new Error('Team follow-up storage is not configured.');
  }
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '').trim();
  if (!expectedUpdatedAt) {
    throw new Error('Team follow-up: refresh this item before updating it.');
  }
  const item = validateStudioIntakeItem({
    ...value,
    updated_at: new Date().toISOString(),
  });
  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName(),
      Item: storedItem(item),
      ConditionExpression: '#updated_at = :expected_updated_at',
      ExpressionAttributeNames: { '#updated_at': 'updated_at' },
      ExpressionAttributeValues: {
        ':expected_updated_at': { S: expectedUpdatedAt },
      },
    });
  } catch (error) {
    if (/conditional/i.test(String(error?.message || ''))) {
      throw new Error(
        'This follow-up changed elsewhere. Refresh and try again.'
      );
    }
    throw error;
  }
  return { item, configured: true };
}
