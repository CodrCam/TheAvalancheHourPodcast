import crypto from 'crypto';
import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  sortEpisodeIdeas,
  validateEpisodeIdea,
} from './episodeIdea.mjs';
import { validateStudioIntakeItem } from './studioIntakePresentation.mjs';

const EPISODE_IDEA_PREFIX = 'studio_episode_idea#';
const INTAKE_PREFIX = 'studio_intake#';

function tableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

function ideaKey(ideaId) {
  return `${EPISODE_IDEA_PREFIX}${String(ideaId || '').trim()}`;
}

function parseIdea(item = {}) {
  try {
    const value = JSON.parse(item.content_json?.S || '{}');
    return validateEpisodeIdea({
      ...value,
      updated_at: item.updated_at?.S || value.updated_at,
    });
  } catch {
    return null;
  }
}

function storedIdea(idea) {
  return {
    content_key: { S: ideaKey(idea.idea_id) },
    content_json: { S: JSON.stringify(idea) },
    episode_idea_status: { S: idea.status },
    episode_idea_owner: { S: idea.owner_person_id },
    created_at: { S: idea.created_at },
    updated_at: { S: idea.updated_at },
  };
}

function storedIntake(item) {
  return {
    content_key: { S: `${INTAKE_PREFIX}${item.item_id}` },
    content_json: { S: JSON.stringify(item) },
    intake_status: { S: item.status },
    intake_priority: { S: item.priority },
    created_at: { S: item.created_at },
    updated_at: { S: item.updated_at },
  };
}

export function isStudioEpisodeIdeaStoreConfigured() {
  return Boolean(tableName()) && isDynamoCredentialsConfigured();
}

export function normalizeStudioEpisodeIdeaRequestId(value) {
  const requestId = String(value || '').trim().toLowerCase();
  return /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
    requestId
  )
    ? requestId
    : '';
}

export function createDeterministicStudioEpisodeIdeaId({
  ownerPersonId = '',
  requestId = '',
} = {}) {
  const owner = String(ownerPersonId || '').trim();
  const request = normalizeStudioEpisodeIdeaRequestId(requestId);
  if (!owner || !request) {
    throw new Error('Episode idea: a valid creation request is required.');
  }
  const digest = crypto
    .createHash('sha256')
    .update(`episode-idea\u0000${owner}\u0000${request}`, 'utf8')
    .digest('hex');
  return [
    digest.slice(0, 8),
    digest.slice(8, 12),
    `5${digest.slice(13, 16)}`,
    `8${digest.slice(17, 20)}`,
    digest.slice(20, 32),
  ].join('-');
}

function creationFingerprint(idea, requestId) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        request_id: requestId,
        owner_person_id: idea.owner_person_id,
        status: idea.status,
        working_title: idea.working_title,
        premise: idea.premise,
        listener_takeaway: idea.listener_takeaway,
        research_notes: idea.research_notes,
        proposed_guest: idea.proposed_guest,
        preferred_air_date: idea.preferred_air_date,
        planning_horizon: idea.planning_horizon,
      }),
      'utf8'
    )
    .digest('hex');
}

export function bindStudioEpisodeIdeaCreation(value = {}, { requestId } = {}) {
  const request = normalizeStudioEpisodeIdeaRequestId(requestId);
  if (!request) {
    throw new Error('Episode idea: a valid creation request is required.');
  }
  const idea = validateEpisodeIdea(value);
  const expectedIdeaId = createDeterministicStudioEpisodeIdeaId({
    ownerPersonId: idea.owner_person_id,
    requestId: request,
  });
  if (idea.idea_id !== expectedIdeaId) {
    throw new Error('Episode idea: the creation request does not match its ID.');
  }
  return validateEpisodeIdea({
    ...idea,
    creation_request_id: request,
    creation_fingerprint: creationFingerprint(idea, request),
  });
}

export async function listStudioEpisodeIdeas({ includeArchived = false } = {}) {
  if (!isStudioEpisodeIdeaStoreConfigured()) {
    return { ideas: [], configured: false };
  }

  const ideas = [];
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
        ':prefix': { S: EPISODE_IDEA_PREFIX },
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    for (const row of response.Items || []) {
      const idea = parseIdea(row);
      if (idea?.idea_id && (includeArchived || !idea.archived)) {
        ideas.push(idea);
      }
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return { ideas: sortEpisodeIdeas(ideas), configured: true };
}

export async function getStudioEpisodeIdea(ideaId) {
  if (!isStudioEpisodeIdeaStoreConfigured()) {
    return { idea: null, configured: false };
  }
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName(),
    Key: { content_key: { S: ideaKey(ideaId) } },
    ConsistentRead: true,
  });
  return {
    idea: response.Item ? parseIdea(response.Item) : null,
    configured: true,
  };
}

export async function createStudioEpisodeIdea(value = {}) {
  if (!isStudioEpisodeIdeaStoreConfigured()) {
    throw new Error('Episode idea storage is not configured.');
  }
  const now = new Date().toISOString();
  const idea = validateEpisodeIdea({
    ...value,
    created_at: value.created_at || now,
    updated_at: now,
  });
  if (!idea.creation_request_id || !idea.creation_fingerprint) {
    throw new Error('Episode idea: a valid creation request is required.');
  }
  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName(),
      Item: storedIdea(idea),
      ConditionExpression: 'attribute_not_exists(#key)',
      ExpressionAttributeNames: { '#key': 'content_key' },
    });
    return { idea, configured: true, idempotent: false };
  } catch (error) {
    if (!/conditional/i.test(String(error?.message || ''))) throw error;
    const existing = await getStudioEpisodeIdea(idea.idea_id);
    if (
      existing.idea?.owner_person_id === idea.owner_person_id &&
      existing.idea?.creation_request_id === idea.creation_request_id &&
      existing.idea?.creation_fingerprint === idea.creation_fingerprint
    ) {
      return { idea: existing.idea, configured: true, idempotent: true };
    }
    throw new Error(
      'Episode idea: this creation request was already used for different pitch details.'
    );
  }
}

export async function saveStudioEpisodeIdea(value = {}, options = {}) {
  if (!isStudioEpisodeIdeaStoreConfigured()) {
    throw new Error('Episode idea storage is not configured.');
  }
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '').trim();
  if (!expectedUpdatedAt) {
    throw new Error('Episode idea: refresh this idea before updating it.');
  }
  const idea = validateEpisodeIdea({
    ...value,
    updated_at: new Date().toISOString(),
  });
  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName(),
      Item: storedIdea(idea),
      ConditionExpression: '#updated_at = :expected_updated_at',
      ExpressionAttributeNames: { '#updated_at': 'updated_at' },
      ExpressionAttributeValues: {
        ':expected_updated_at': { S: expectedUpdatedAt },
      },
    });
  } catch (error) {
    if (/conditional/i.test(String(error?.message || ''))) {
      throw new Error(
        'This episode idea changed elsewhere. Refresh it and try again.'
      );
    }
    throw error;
  }
  return { idea, configured: true };
}

export async function approveStudioEpisodeIdea(
  value = {},
  intakeValue = {},
  options = {}
) {
  if (!isStudioEpisodeIdeaStoreConfigured()) {
    throw new Error('Episode idea storage is not configured.');
  }
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '').trim();
  if (!expectedUpdatedAt) {
    throw new Error('Episode idea: refresh this idea before approving it.');
  }
  const now = new Date().toISOString();
  const idea = validateEpisodeIdea({ ...value, updated_at: now });
  if (idea.status !== 'approved' || !idea.source_intake_item_id) {
    throw new Error(
      'Episode idea: approval must include its planning Follow-up.'
    );
  }
  const intake = validateStudioIntakeItem({
    ...intakeValue,
    item_id: idea.source_intake_item_id,
    created_at: intakeValue.created_at || now,
    updated_at: now,
  });

  try {
    await dynamoDbRequest('TransactWriteItems', {
      TransactItems: [
        {
          Put: {
            TableName: tableName(),
            Item: storedIntake(intake),
            ConditionExpression: 'attribute_not_exists(#key)',
            ExpressionAttributeNames: { '#key': 'content_key' },
          },
        },
        {
          Put: {
            TableName: tableName(),
            Item: storedIdea(idea),
            ConditionExpression: '#updated_at = :expected_updated_at',
            ExpressionAttributeNames: { '#updated_at': 'updated_at' },
            ExpressionAttributeValues: {
              ':expected_updated_at': { S: expectedUpdatedAt },
            },
          },
        },
      ],
    });
  } catch (error) {
    if (/transaction|conditional/i.test(String(error?.message || ''))) {
      throw new Error(
        'This episode idea changed elsewhere. Refresh it before approving it.'
      );
    }
    throw error;
  }
  return { idea, intake, configured: true };
}
