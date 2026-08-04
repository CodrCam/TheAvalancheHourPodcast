import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  normalizeGuestQuestionnaireRecord,
  validateGuestQuestionnaireRecord,
} from './guestQuestionnairePresentation.mjs';
import { validateEpisodeStudio } from './episodeStudioPresentation.mjs';
import { createEpisodeDeletionTombstone } from './episodeAssetGrantLifecycle.mjs';

const QUESTIONNAIRE_PREFIX = 'guest_questionnaire#';
const EPISODE_PREFIX = 'episode_studio#';

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

function questionnaireKey(episodeId) {
  return `${QUESTIONNAIRE_PREFIX}${String(episodeId || '').trim()}`;
}

function episodeKey(episodeId) {
  return `${EPISODE_PREFIX}${String(episodeId || '').trim()}`;
}

function parseRecord(item = {}) {
  try {
    const value = JSON.parse(item.content_json?.S || '{}');
    return normalizeGuestQuestionnaireRecord({
      ...value,
      updated_at: item.updated_at?.S || value.updated_at,
    });
  } catch {
    return null;
  }
}

function storedQuestionnaire(record) {
  return {
    content_key: { S: questionnaireKey(record.episode_id) },
    content_json: { S: JSON.stringify(record) },
    guest_questionnaire_status: { S: record.response.status },
    updated_at: { S: record.updated_at },
  };
}

function versionCondition(expectedUpdatedAt, keyName = '#key') {
  return expectedUpdatedAt
    ? {
        ConditionExpression: '#updated_at = :expected_updated_at',
        ExpressionAttributeNames: { '#updated_at': 'updated_at' },
        ExpressionAttributeValues: {
          ':expected_updated_at': { S: expectedUpdatedAt },
        },
      }
    : {
        ConditionExpression: `attribute_not_exists(${keyName})`,
        ExpressionAttributeNames: { [keyName]: 'content_key' },
      };
}

export function isGuestQuestionnaireStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

export async function getGuestQuestionnaire(episodeId) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    return { questionnaire: null, configured: false };
  }
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName(),
    Key: { content_key: { S: questionnaireKey(episodeId) } },
    ConsistentRead: true,
  });
  return {
    questionnaire: response.Item ? parseRecord(response.Item) : null,
    configured: true,
  };
}

export async function saveGuestQuestionnaire(value = {}, options = {}) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    throw new Error('Guest questionnaire storage is not configured.');
  }
  if (!Object.prototype.hasOwnProperty.call(options, 'expectedUpdatedAt')) {
    throw new Error(
      'Guest questionnaire: refresh the questionnaire before saving.'
    );
  }
  const now = new Date().toISOString();
  const record = validateGuestQuestionnaireRecord({
    ...value,
    created_at: value.created_at || now,
    updated_at: now,
  });
  await dynamoDbRequest('PutItem', {
    TableName: tableName(),
    Item: storedQuestionnaire(record),
    ...versionCondition(String(options.expectedUpdatedAt || '')),
  });
  return { questionnaire: record, configured: true };
}

export async function deleteGuestQuestionnaire(episodeId, options = {}) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    return { deleted: false, configured: false };
  }
  if (!Object.prototype.hasOwnProperty.call(options, 'expectedUpdatedAt')) {
    throw new Error(
      'Guest questionnaire deletion requires the current questionnaire version.'
    );
  }
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '').trim();
  const response = await dynamoDbRequest('DeleteItem', {
    TableName: tableName(),
    Key: { content_key: { S: questionnaireKey(episodeId) } },
    ...versionCondition(expectedUpdatedAt),
    ReturnValues: 'ALL_OLD',
  });
  return {
    deleted: Boolean(response.Attributes),
    configured: true,
    episode_id: String(episodeId || '').trim(),
  };
}

export async function deleteGuestQuestionnaireWithEpisode(
  episodeId,
  {
    expectedQuestionnaireUpdatedAt = '',
    expectedEpisodeUpdatedAt = '',
  } = {}
) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    throw new Error('Guest questionnaire storage is not configured.');
  }
  const cleanEpisodeId = String(episodeId || '').trim();
  const expectedQuestionnaire = String(
    expectedQuestionnaireUpdatedAt || ''
  ).trim();
  const expectedEpisode = String(expectedEpisodeUpdatedAt || '').trim();
  if (!cleanEpisodeId || !expectedEpisode) {
    throw new Error(
      'Episode Studio deletion requires the current episode version.'
    );
  }

  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: [
      {
        Delete: {
          TableName: tableName(),
          Key: {
            content_key: { S: questionnaireKey(cleanEpisodeId) },
          },
          ...versionCondition(expectedQuestionnaire),
        },
      },
      {
        Delete: {
          TableName: tableName(),
          Key: { content_key: { S: episodeKey(cleanEpisodeId) } },
          ConditionExpression: '#updated_at = :expected_updated_at',
          ExpressionAttributeNames: { '#updated_at': 'updated_at' },
          ExpressionAttributeValues: {
            ':expected_updated_at': { S: expectedEpisode },
          },
        },
      },
    ],
  });
  return {
    deleted: true,
    episode_id: cleanEpisodeId,
    configured: true,
  };
}

export async function finalizeGuestQuestionnaireDeletionWithEpisodeTombstone(
  episodeValue,
  {
    expectedQuestionnaireUpdatedAt = '',
    expectedEpisodeUpdatedAt = '',
    finalizedAt = new Date().toISOString(),
  } = {}
) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    throw new Error('Guest questionnaire storage is not configured.');
  }
  const expectedQuestionnaire = String(
    expectedQuestionnaireUpdatedAt || ''
  ).trim();
  const expectedEpisode = String(expectedEpisodeUpdatedAt || '').trim();
  if (!expectedEpisode) {
    throw new Error(
      'Episode Studio deletion requires the current episode version.'
    );
  }
  const now = new Date(finalizedAt).toISOString();
  const episode = createEpisodeDeletionTombstone(episodeValue, {
    finalizedAt: now,
  });

  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: [
      {
        Delete: {
          TableName: tableName(),
          Key: {
            content_key: { S: questionnaireKey(episode.episode_id) },
          },
          ...versionCondition(expectedQuestionnaire),
        },
      },
      {
        Put: {
          TableName: tableName(),
          Item: {
            content_key: { S: episodeKey(episode.episode_id) },
            content_json: { S: JSON.stringify(episode) },
            updated_at: { S: now },
          },
          ConditionExpression: '#updated_at = :expected_updated_at',
          ExpressionAttributeNames: { '#updated_at': 'updated_at' },
          ExpressionAttributeValues: {
            ':expected_updated_at': { S: expectedEpisode },
          },
        },
      },
    ],
  });
  return { questionnaire_deleted: true, episode, configured: true };
}

export async function saveGuestQuestionnaireWithEpisode(
  { questionnaire: questionnaireValue, episode: episodeValue } = {},
  { expectedQuestionnaireUpdatedAt, expectedEpisodeUpdatedAt } = {}
) {
  if (!isGuestQuestionnaireStoreConfigured()) {
    throw new Error('Guest questionnaire storage is not configured.');
  }
  const expectedQuestionnaire = String(
    expectedQuestionnaireUpdatedAt || ''
  ).trim();
  const expectedEpisode = String(expectedEpisodeUpdatedAt || '').trim();
  if (!expectedEpisode) {
    throw new Error(
      'Guest questionnaire episode updates require the current episode version.'
    );
  }
  const now = new Date().toISOString();
  const questionnaire = validateGuestQuestionnaireRecord({
    ...questionnaireValue,
    updated_at: now,
  });
  const episode = validateEpisodeStudio({
    ...episodeValue,
    updated_at: now,
  });
  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: [
      {
        Put: {
          TableName: tableName(),
          Item: {
            content_key: { S: episodeKey(episode.episode_id) },
            content_json: { S: JSON.stringify(episode) },
            updated_at: { S: now },
          },
          ConditionExpression: '#updated_at = :expected_updated_at',
          ExpressionAttributeNames: { '#updated_at': 'updated_at' },
          ExpressionAttributeValues: {
            ':expected_updated_at': { S: expectedEpisode },
          },
        },
      },
      {
        Put: {
          TableName: tableName(),
          Item: storedQuestionnaire(questionnaire),
          ...versionCondition(expectedQuestionnaire),
        },
      },
    ],
  });
  return { questionnaire, episode, configured: true };
}

export async function saveGuestQuestionnaireAutofill(values, options) {
  return saveGuestQuestionnaireWithEpisode(values, options);
}
