import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  DEFAULT_MIC_KIT_TRACKER,
  MIC_KIT_TRACKER_KEY,
  normalizeMicKitTracker,
  validateMicKitTracker,
} from './micKitPresentation.mjs';

function getMicKitTableName() {
  return process.env.DYNAMODB_MIC_KITS_TABLE || '';
}

export function isMicKitStoreConfigured() {
  return !!getMicKitTableName() && isDynamoCredentialsConfigured();
}

function parseTracker(item) {
  if (!item?.content_json?.S) {
    return normalizeMicKitTracker(DEFAULT_MIC_KIT_TRACKER);
  }

  try {
    return normalizeMicKitTracker(
      JSON.parse(item.content_json.S),
      DEFAULT_MIC_KIT_TRACKER
    );
  } catch (error) {
    throw new Error(`Stored mic kit tracker is malformed: ${error.message}`);
  }
}

export async function getMicKitTracker() {
  if (!isMicKitStoreConfigured()) {
    return {
      tracker: normalizeMicKitTracker(DEFAULT_MIC_KIT_TRACKER),
      configured: false,
      source: 'default',
    };
  }

  const response = await dynamoDbRequest('GetItem', {
    TableName: getMicKitTableName(),
    Key: { tracker_id: { S: MIC_KIT_TRACKER_KEY } },
    ConsistentRead: true,
  });

  return {
    tracker: parseTracker(response.Item),
    configured: true,
    source: response.Item ? 'dynamo' : 'default',
  };
}

export async function saveMicKitTracker(value, options = {}) {
  if (!isMicKitStoreConfigured()) {
    throw new Error('Mic kit storage is not configured.');
  }

  const now = new Date().toISOString();
  const tracker = validateMicKitTracker({
    ...value,
    updated_at: now,
    updated_by: String(options.updatedBy || '').trim() || 'unknown',
  });
  const hasExpectedUpdatedAt = Object.prototype.hasOwnProperty.call(
    options,
    'expectedUpdatedAt'
  );
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '');
  const request = {
    TableName: getMicKitTableName(),
    Item: {
      tracker_id: { S: MIC_KIT_TRACKER_KEY },
      content_json: { S: JSON.stringify(tracker) },
      updated_at: { S: now },
      updated_by: { S: tracker.updated_by },
    },
  };

  if (hasExpectedUpdatedAt) {
    request.ConditionExpression = expectedUpdatedAt
      ? '#updated_at = :expected_updated_at'
      : '(attribute_not_exists(#updated_at) OR #updated_at = :expected_updated_at)';
    request.ExpressionAttributeNames = { '#updated_at': 'updated_at' };
    request.ExpressionAttributeValues = {
      ':expected_updated_at': { S: expectedUpdatedAt },
    };
  }

  await dynamoDbRequest('PutItem', request);

  return {
    tracker,
    configured: true,
    source: 'dynamo',
  };
}
