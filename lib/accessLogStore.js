import crypto from 'crypto';
import { isIP } from 'node:net';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  describeAccessClient,
  summarizeAccessSessions,
} from './accessLogPresentation.mjs';

const ACCESS_SESSION_PREFIX = 'access_session#';
const DEFAULT_RETENTION_DAYS = 400;

function tableName() {
  return String(process.env.DYNAMODB_SITE_CONTENT_TABLE || '').trim();
}

export function isAccessLogStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function sessionIdentifier(principal = {}) {
  return (
    String(principal.sessionId || '').trim() ||
    [principal.subject, principal.sessionIssuedAt]
      .map((value) => String(value || '').trim())
      .filter(Boolean)
      .join(':')
  );
}

export function getAccessSessionKey(principal = {}) {
  const identifier = sessionIdentifier(principal);
  return identifier ? `${ACCESS_SESSION_PREFIX}${sha256(identifier)}` : '';
}

function getHeader(req, name) {
  const value = req?.headers?.[name.toLowerCase()] || req?.headers?.[name];
  return Array.isArray(value) ? value[0] : String(value || '');
}

function getRequestIp(req) {
  const candidate =
    process.env.NETLIFY === 'true'
      ? getHeader(req, 'x-nf-client-connection-ip')
      : String(req?.socket?.remoteAddress || '');
  const normalized = candidate.trim();
  return isIP(normalized) ? normalized : '';
}

function retentionDays() {
  const configured = Number(process.env.ACCESS_LOG_RETENTION_DAYS);
  return Number.isFinite(configured)
    ? Math.max(30, Math.min(730, Math.trunc(configured)))
    : DEFAULT_RETENTION_DAYS;
}

function retentionEpoch(loginAt) {
  const date = new Date(loginAt);
  date.setUTCDate(date.getUTCDate() + retentionDays());
  return Math.floor(date.getTime() / 1000);
}

function isoFromEpochSeconds(value) {
  const seconds = Number(value);
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : '';
}

function principalSession(principal, req, now) {
  const userAgent = getHeader(req, 'user-agent').slice(0, 500);
  const loginAt = isoFromEpochSeconds(principal.sessionIssuedAt) || now;
  return {
    session_key: getAccessSessionKey(principal),
    subject: String(principal.subject || '').trim(),
    username: String(principal.username || '').trim(),
    display_name: String(principal.displayName || '').trim(),
    role: String(principal.role || '').trim(),
    groups: Array.isArray(principal.groups) ? principal.groups : [],
    login_at: loginAt,
    last_seen_at: now,
    ended_at: '',
    token_expires_at: isoFromEpochSeconds(principal.sessionExpiresAt),
    end_reason: '',
    ip: getRequestIp(req),
    user_agent: userAgent,
    client: describeAccessClient(userAgent),
  };
}

function parseSession(item = {}) {
  try {
    return {
      ...JSON.parse(item.content_json?.S || '{}'),
      session_key: item.content_key?.S || '',
      last_seen_at: item.last_seen_at?.S || '',
      ended_at: item.ended_at?.S || '',
      end_reason: item.end_reason?.S || '',
    };
  } catch {
    return null;
  }
}

export async function recordAccessSession(req, principal) {
  if (!isAccessLogStoreConfigured()) {
    return { recorded: false, configured: false };
  }

  const now = new Date().toISOString();
  const session = principalSession(principal, req, now);
  if (!session.session_key || !session.subject) {
    return { recorded: false, configured: true, reason: 'missing_identity' };
  }

  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName(),
      Item: {
        content_key: { S: session.session_key },
        content_json: { S: JSON.stringify(session) },
        last_seen_at: { S: now },
        created_at: { S: now },
        updated_at: { S: now },
        expires_at_epoch: { N: String(retentionEpoch(session.login_at)) },
      },
      ConditionExpression: 'attribute_not_exists(#key)',
      ExpressionAttributeNames: { '#key': 'content_key' },
    });
    return { recorded: true, configured: true, session };
  } catch (error) {
    if (/conditional/i.test(String(error?.message || ''))) {
      await touchAccessSession(principal, now);
      return { recorded: false, configured: true, duplicate: true };
    }
    throw error;
  }
}

export async function touchAccessSession(
  principal,
  at = new Date().toISOString()
) {
  if (!isAccessLogStoreConfigured()) return false;
  const key = getAccessSessionKey(principal);
  if (!key) return false;

  try {
    await dynamoDbRequest('UpdateItem', {
      TableName: tableName(),
      Key: { content_key: { S: key } },
      UpdateExpression: 'SET #last_seen_at = :at, #updated_at = :at',
      ConditionExpression: 'attribute_exists(#key)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#last_seen_at': 'last_seen_at',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: { ':at': { S: at } },
    });
    return true;
  } catch (error) {
    if (/conditional/i.test(String(error?.message || ''))) return false;
    throw error;
  }
}

export async function endAccessSession(
  principal,
  reason = 'signed_out',
  at = new Date().toISOString()
) {
  if (!isAccessLogStoreConfigured()) return false;
  const key = getAccessSessionKey(principal);
  if (!key) return false;

  try {
    await dynamoDbRequest('UpdateItem', {
      TableName: tableName(),
      Key: { content_key: { S: key } },
      UpdateExpression:
        'SET #last_seen_at = :at, #ended_at = :at, #end_reason = :reason, #updated_at = :at',
      ConditionExpression: 'attribute_exists(#key)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#last_seen_at': 'last_seen_at',
        '#ended_at': 'ended_at',
        '#end_reason': 'end_reason',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':at': { S: at },
        ':reason': { S: String(reason || 'signed_out').slice(0, 60) },
      },
    });
    return true;
  } catch (error) {
    if (/conditional/i.test(String(error?.message || ''))) return false;
    throw error;
  }
}

export async function listAccessSessions({ days = 30 } = {}) {
  if (!isAccessLogStoreConfigured()) {
    return {
      configured: false,
      generated_at: new Date().toISOString(),
      range_days: days,
      ...summarizeAccessSessions([]),
    };
  }

  const rows = [];
  let exclusiveStartKey;
  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName(),
      ProjectionExpression:
        '#key, #content_json, #last_seen_at, #ended_at, #end_reason',
      FilterExpression: 'begins_with(#key, :prefix)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#content_json': 'content_json',
        '#last_seen_at': 'last_seen_at',
        '#ended_at': 'ended_at',
        '#end_reason': 'end_reason',
      },
      ExpressionAttributeValues: {
        ':prefix': { S: ACCESS_SESSION_PREFIX },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    for (const item of response.Items || []) {
      const session = parseSession(item);
      if (session) rows.push(session);
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const generatedAt = new Date();
  const rangeDays = days === 'all' ? 'all' : Math.max(1, Number(days) || 30);
  const cutoff =
    rangeDays === 'all'
      ? 0
      : generatedAt.getTime() - rangeDays * 24 * 60 * 60 * 1000;
  const filtered = rows.filter(
    (session) => new Date(session.login_at || '').getTime() >= cutoff
  );

  return {
    configured: true,
    generated_at: generatedAt.toISOString(),
    range_days: rangeDays,
    ...summarizeAccessSessions(filtered, { generatedAt }),
  };
}
