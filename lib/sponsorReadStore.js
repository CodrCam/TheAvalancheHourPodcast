import crypto from 'crypto';
import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';
import {
  normalizeSponsorRead,
  sponsorReadVersionSnapshot,
  validateSponsorRead,
} from './sponsorReadPresentation.mjs';

const SPONSOR_READ_PREFIX = 'studio_sponsor_read#';

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isSponsorReadStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

function key(readId) {
  return `${SPONSOR_READ_PREFIX}${String(readId || '').trim()}`;
}

function parse(item) {
  if (!item?.content_json?.S) return null;
  try {
    return normalizeSponsorRead({
      ...JSON.parse(item.content_json.S),
      updated_at: item.updated_at?.S || '',
    });
  } catch {
    return null;
  }
}

export function createSponsorReadId(title = '') {
  const slug = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${slug || 'sponsor-read'}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listSponsorReads() {
  if (!isSponsorReadStoreConfigured()) {
    return { sponsor_reads: [], configured: false };
  }
  const sponsorReads = [];
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
        ':prefix': { S: SPONSOR_READ_PREFIX },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    for (const item of response.Items || []) {
      const read = parse(item);
      if (read?.sponsor_read_id) sponsorReads.push(read);
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);
  sponsorReads.sort(
    (a, b) =>
      a.sponsor_name.localeCompare(b.sponsor_name) ||
      a.script_title.localeCompare(b.script_title)
  );
  return { sponsor_reads: sponsorReads, configured: true };
}

export async function getSponsorRead(readId) {
  if (!isSponsorReadStoreConfigured()) {
    return { sponsor_read: null, configured: false };
  }
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName(),
    Key: { content_key: { S: key(readId) } },
    ConsistentRead: true,
  });
  return {
    sponsor_read: parse(response.Item),
    configured: true,
  };
}

export async function saveSponsorRead(value, options = {}) {
  if (!isSponsorReadStoreConfigured()) {
    throw new Error('Sponsor read storage is not configured.');
  }
  const now = new Date().toISOString();
  const actor = {
    person_id: String(options.actor?.person_id || '').trim(),
    name: String(options.actor?.name || '').trim(),
    at: now,
  };
  const existingResult = options.create
    ? { sponsor_read: null }
    : await getSponsorRead(value.sponsor_read_id);
  const existing = existingResult.sponsor_read;
  const proposed = normalizeSponsorRead(value, existing || {});
  const next = validateSponsorRead({
    ...proposed,
    version_number: existing ? existing.version_number + 1 : 1,
    version_history: existing
      ? [
          ...existing.version_history,
          sponsorReadVersionSnapshot(existing, {
            person_id: existing.updated_by_person_id,
            name: existing.updated_by_name,
            at: existing.updated_at,
          }),
        ].slice(-30)
      : [],
    created_at: existing?.created_at || now,
    created_by_person_id:
      existing?.created_by_person_id || actor.person_id,
    created_by_name: existing?.created_by_name || actor.name,
    updated_at: now,
    updated_by_person_id: actor.person_id,
    updated_by_name: actor.name,
  });
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '');
  const condition = options.create
    ? {
        ConditionExpression: 'attribute_not_exists(#key)',
        ExpressionAttributeNames: { '#key': 'content_key' },
      }
    : {
        ConditionExpression: '#updated_at = :expected_updated_at',
        ExpressionAttributeNames: { '#updated_at': 'updated_at' },
        ExpressionAttributeValues: {
          ':expected_updated_at': { S: expectedUpdatedAt },
        },
      };
  await dynamoDbRequest('PutItem', {
    TableName: tableName(),
    Item: {
      content_key: { S: key(next.sponsor_read_id) },
      content_json: { S: JSON.stringify(next) },
      updated_at: { S: now },
    },
    ...condition,
  });
  return next;
}
