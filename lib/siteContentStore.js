import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';
import {
  DEFAULT_HOME_CONTENT,
  HOME_CONTENT_KEY,
  normalizeHomeContent,
} from './siteContentDefaults';

function getSiteContentTableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isDynamoSiteContentConfigured() {
  return !!getSiteContentTableName();
}

function assertDynamoSiteContentReady() {
  if (!isDynamoSiteContentConfigured()) {
    throw new Error('DYNAMODB_SITE_CONTENT_TABLE is not configured on the server');
  }
  if (!isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }
}

function parseContentJson(value) {
  if (!value) return {};
  try {
    const parsed = JSON.parse(value);
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch {
    return {};
  }
}

function fromDynamoItem(item = {}) {
  return {
    content_key: item.content_key?.S || HOME_CONTENT_KEY,
    content: normalizeHomeContent(parseContentJson(item.content_json?.S)),
    updated_at: item.updated_at?.S || '',
  };
}

export async function getHomeContent(options = {}) {
  const allowDefault = options.allowDefault !== false;

  if (!isDynamoSiteContentConfigured()) {
    if (allowDefault) {
      return {
        content: DEFAULT_HOME_CONTENT,
        updated_at: '',
        source: 'default',
        configured: false,
      };
    }
    assertDynamoSiteContentReady();
  }

  assertDynamoSiteContentReady();

  const response = await dynamoDbRequest('GetItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: HOME_CONTENT_KEY } },
    ConsistentRead: true,
  });

  if (!response.Item) {
    return {
      content: DEFAULT_HOME_CONTENT,
      updated_at: '',
      source: 'default',
      configured: true,
    };
  }

  const row = fromDynamoItem(response.Item);
  return {
    content: row.content,
    updated_at: row.updated_at,
    source: 'dynamo',
    configured: true,
  };
}

export async function saveHomeContent(content) {
  assertDynamoSiteContentReady();

  const normalized = normalizeHomeContent(content);
  const updatedAt = new Date().toISOString();

  await dynamoDbRequest('PutItem', {
    TableName: getSiteContentTableName(),
    Item: {
      content_key: { S: HOME_CONTENT_KEY },
      content_json: { S: JSON.stringify(normalized) },
      updated_at: { S: updatedAt },
    },
  });

  return {
    content: normalized,
    updated_at: updatedAt,
    source: 'dynamo',
    configured: true,
  };
}
