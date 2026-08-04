import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import { validateEpisodeStudio } from './episodeStudioPresentation.mjs';
import { validateGuestQuestionnaireRecord } from './guestQuestionnairePresentation.mjs';

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

export function isGuestQuestionnaireUploadStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

export function isGuestQuestionnaireUploadVersionConflict(error) {
  return /conditional|transaction.*cancel/i.test(
    String(error?.message || '')
  );
}

export async function saveGuestQuestionnaireUploadCompletion(
  { questionnaire: questionnaireValue, episode: episodeValue } = {},
  {
    expectedQuestionnaireUpdatedAt,
    expectedEpisodeUpdatedAt,
    now = new Date(),
  } = {}
) {
  if (!isGuestQuestionnaireUploadStoreConfigured()) {
    throw new Error('Guest questionnaire upload storage is not configured.');
  }
  const expectedQuestionnaire = String(
    expectedQuestionnaireUpdatedAt || ''
  ).trim();
  const expectedEpisode = String(expectedEpisodeUpdatedAt || '').trim();
  if (!expectedQuestionnaire || !expectedEpisode) {
    throw new Error(
      'Guest questionnaire upload completion requires current questionnaire and episode versions.'
    );
  }
  const updatedAt = now.toISOString();
  const questionnaire = validateGuestQuestionnaireRecord({
    ...questionnaireValue,
    updated_at: updatedAt,
  });
  const episode = validateEpisodeStudio({
    ...episodeValue,
    updated_at: updatedAt,
  });
  if (
    questionnaire.episode_id !== episode.episode_id ||
    questionnaire.episode_id !== questionnaireValue?.episode_id
  ) {
    throw new Error(
      'Guest questionnaire upload completion does not match the episode.'
    );
  }

  await dynamoDbRequest('TransactWriteItems', {
    TransactItems: [
      {
        Put: {
          TableName: tableName(),
          Item: {
            content_key: { S: episodeKey(episode.episode_id) },
            content_json: { S: JSON.stringify(episode) },
            updated_at: { S: updatedAt },
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
          Item: {
            content_key: {
              S: questionnaireKey(questionnaire.episode_id),
            },
            content_json: { S: JSON.stringify(questionnaire) },
            guest_questionnaire_status: {
              S: questionnaire.response.status,
            },
            updated_at: { S: updatedAt },
          },
          ConditionExpression: '#updated_at = :expected_updated_at',
          ExpressionAttributeNames: { '#updated_at': 'updated_at' },
          ExpressionAttributeValues: {
            ':expected_updated_at': { S: expectedQuestionnaire },
          },
        },
      },
    ],
  });

  return { questionnaire, episode, configured: true };
}
