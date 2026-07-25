import crypto from 'crypto';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  episodeStudioSummary,
  normalizeEpisodeStudio,
  validateEpisodeStudio,
} from './episodeStudioPresentation.mjs';

const EPISODE_PREFIX = 'episode_studio#';

function getSiteContentTableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isEpisodeStudioStoreConfigured() {
  return !!getSiteContentTableName() && isDynamoCredentialsConfigured();
}

function episodeKey(episodeId) {
  return `${EPISODE_PREFIX}${String(episodeId || '').trim()}`;
}

function parseEpisode(item = {}) {
  try {
    const value = JSON.parse(item.content_json?.S || '{}');
    return normalizeEpisodeStudio({
      ...value,
      updated_at: item.updated_at?.S || value.updated_at,
    });
  } catch {
    return null;
  }
}

export function createEpisodeStudioId(title = '') {
  const slug = String(title || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 70);
  return `${slug || 'episode'}-${crypto.randomUUID().slice(0, 8)}`;
}

export async function listEpisodeStudios() {
  if (!isEpisodeStudioStoreConfigured()) {
    return { episodes: [], configured: false };
  }

  const episodes = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: getSiteContentTableName(),
      ProjectionExpression: '#key, #content_json, #updated_at',
      FilterExpression: 'begins_with(#key, :prefix)',
      ExpressionAttributeNames: {
        '#key': 'content_key',
        '#content_json': 'content_json',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':prefix': { S: EPISODE_PREFIX },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const item of response.Items || []) {
      const episode = parseEpisode(item);
      if (episode?.episode_id) episodes.push(episode);
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  episodes.sort(
    (a, b) =>
      String(a.target_release_date || '9999').localeCompare(
        String(b.target_release_date || '9999')
      ) || a.title.localeCompare(b.title)
  );

  return { episodes, configured: true };
}

export async function getEpisodeStudio(episodeId) {
  if (!isEpisodeStudioStoreConfigured()) {
    return { episode: null, configured: false };
  }

  const response = await dynamoDbRequest('GetItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: episodeKey(episodeId) } },
    ConsistentRead: true,
  });

  return {
    episode: response.Item ? parseEpisode(response.Item) : null,
    configured: true,
  };
}

export async function saveEpisodeStudio(value, options = {}) {
  if (!isEpisodeStudioStoreConfigured()) {
    throw new Error('Episode Studio storage is not configured.');
  }

  const now = new Date().toISOString();
  const episode = validateEpisodeStudio({
    ...value,
    created_at: value.created_at || now,
    updated_at: now,
  });
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '');
  const creating = options.create === true;

  const condition = creating
    ? {
        ConditionExpression: 'attribute_not_exists(#content_key)',
        ExpressionAttributeNames: { '#content_key': 'content_key' },
      }
    : Object.prototype.hasOwnProperty.call(options, 'expectedUpdatedAt')
      ? {
          ConditionExpression: '#updated_at = :expected_updated_at',
          ExpressionAttributeNames: { '#updated_at': 'updated_at' },
          ExpressionAttributeValues: {
            ':expected_updated_at': { S: expectedUpdatedAt },
          },
        }
      : {};

  await dynamoDbRequest('PutItem', {
    TableName: getSiteContentTableName(),
    Item: {
      content_key: { S: episodeKey(episode.episode_id) },
      content_json: { S: JSON.stringify(episode) },
      updated_at: { S: now },
    },
    ...condition,
  });

  return {
    episode,
    summary: episodeStudioSummary(episode),
    configured: true,
  };
}
