import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';
import {
  DEFAULT_STUDIO_GUIDE,
  STUDIO_GUIDE_KEY,
} from './studioGuideDefaults.js';
import {
  normalizeStudioGuide,
  sanitizeStudioGuideForHosts,
  validateStudioGuide,
} from './studioGuidePresentation.mjs';

function getSiteContentTableName() {
  return process.env.DYNAMODB_SITE_CONTENT_TABLE || '';
}

export function isStudioGuideStoreConfigured() {
  return !!getSiteContentTableName() && isDynamoCredentialsConfigured();
}

function parseContentJson(value, label) {
  try {
    const parsed = JSON.parse(value);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('must contain a JSON object');
    }
    return parsed;
  } catch (error) {
    throw new Error(
      `Stored Studio guide ${label} is malformed: ${error.message}`
    );
  }
}

function normalizedDefaultGuide() {
  return normalizeStudioGuide(DEFAULT_STUDIO_GUIDE, DEFAULT_STUDIO_GUIDE);
}

function getStoredGuide(item, attributeName, label) {
  const attribute = item?.[attributeName];
  if (!attribute) return null;
  if (typeof attribute.S !== 'string') {
    throw new Error(
      `Stored Studio guide ${label} is malformed: expected a JSON string`
    );
  }

  return normalizeStudioGuide(
    parseContentJson(attribute.S, label),
    DEFAULT_STUDIO_GUIDE
  );
}

function metadataForResult({
  publishedSource,
  draftSource,
  updatedAt,
  updatedBy,
  draftUpdatedAt,
  draftUpdatedBy,
  hasDraft,
}) {
  return {
    published: {
      source: publishedSource,
      updated_at: updatedAt,
      updated_by: updatedBy,
    },
    draft: {
      source: draftSource,
      updated_at: draftUpdatedAt,
      updated_by: draftUpdatedBy,
      saved: hasDraft,
    },
  };
}

function resultFromItem(
  item,
  { forHosts = false, includeDraft = false, configured = false } = {}
) {
  const defaultGuide = normalizedDefaultGuide();
  const publishedGuide =
    getStoredGuide(item, 'content_json', 'published content') || defaultGuide;
  const publishedSource = item?.content_json ? 'dynamo' : 'default';
  const updatedAt = item?.updated_at?.S || '';
  const updatedBy = item?.updated_by?.S || '';

  if (forHosts) {
    return {
      guide: sanitizeStudioGuideForHosts(
        publishedGuide,
        DEFAULT_STUDIO_GUIDE
      ),
      updated_at: updatedAt,
      source: publishedSource,
      configured,
    };
  }

  if (!includeDraft) {
    return {
      guide: publishedGuide,
      updated_at: updatedAt,
      updated_by: updatedBy,
      source: publishedSource,
      configured,
    };
  }

  const savedDraft = getStoredGuide(
    item,
    'draft_content_json',
    'draft content'
  );
  const hasDraft = Boolean(savedDraft);
  const draftGuide = savedDraft || publishedGuide;
  const draftSource = hasDraft
    ? 'dynamo'
    : publishedSource === 'dynamo'
      ? 'published'
      : 'default';
  const draftUpdatedAt = item?.draft_updated_at?.S || '';
  const draftUpdatedBy = item?.draft_updated_by?.S || '';

  return {
    guide: draftGuide,
    published_guide: publishedGuide,
    updated_at: updatedAt,
    updated_by: updatedBy,
    draft_updated_at: draftUpdatedAt,
    draft_updated_by: draftUpdatedBy,
    source: hasDraft ? 'dynamo' : publishedSource,
    published_source: publishedSource,
    draft_source: draftSource,
    has_draft: hasDraft,
    metadata: metadataForResult({
      publishedSource,
      draftSource,
      updatedAt,
      updatedBy,
      draftUpdatedAt,
      draftUpdatedBy,
      hasDraft,
    }),
    configured,
  };
}

async function loadStudioGuideItem() {
  const response = await dynamoDbRequest('GetItem', {
    TableName: getSiteContentTableName(),
    Key: { content_key: { S: STUDIO_GUIDE_KEY } },
    ConsistentRead: true,
  });

  return response.Item || null;
}

export async function getStudioGuide(options = {}) {
  const forHosts = options.forHosts === true;
  const includeDraft = options.includeDraft === true;

  if (!isStudioGuideStoreConfigured()) {
    return resultFromItem(null, {
      forHosts,
      includeDraft,
      configured: false,
    });
  }

  const item = await loadStudioGuideItem();
  return resultFromItem(item, { forHosts, includeDraft, configured: true });
}

function assertStudioGuideStoreConfigured() {
  if (!isStudioGuideStoreConfigured()) {
    throw new Error('Studio resource storage is not configured.');
  }
}

function normalizeDraft(value) {
  const guide = normalizeStudioGuide(value);
  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(guide)
  ).length;
  if (serializedBytes > 330000) {
    throw new Error('Studio guide: the combined content is too large to save.');
  }
  return guide;
}

function expectedCondition(attributeName, placeholder, expectedValue) {
  return expectedValue
    ? `#${attributeName} = :${placeholder}`
    : `(attribute_not_exists(#${attributeName}) OR #${attributeName} = :${placeholder})`;
}

function withOptimisticConditions(request, conditions) {
  const selected = conditions.filter((condition) => condition.enabled);
  if (!selected.length) return request;

  return {
    ...request,
    ConditionExpression: selected
      .map((condition) =>
        expectedCondition(
          condition.attributeName,
          condition.placeholder,
          condition.value
        )
      )
      .join(' AND '),
    ExpressionAttributeNames: {
      ...request.ExpressionAttributeNames,
      ...Object.fromEntries(
        selected.map((condition) => [
          `#${condition.attributeName}`,
          condition.attributeName,
        ])
      ),
    },
    ExpressionAttributeValues: {
      ...request.ExpressionAttributeValues,
      ...Object.fromEntries(
        selected.map((condition) => [
          `:${condition.placeholder}`,
          { S: condition.value },
        ])
      ),
    },
  };
}

export async function saveStudioGuideDraft(value, options = {}) {
  assertStudioGuideStoreConfigured();

  const guide = normalizeDraft(value);
  const updatedAt = new Date().toISOString();
  const updatedBy = String(options.updatedBy || '').trim() || 'unknown';
  const hasExpectedDraftUpdatedAt = Object.prototype.hasOwnProperty.call(
    options,
    'expectedDraftUpdatedAt'
  );
  const expectedDraftUpdatedAt = String(
    options.expectedDraftUpdatedAt || ''
  );

  const request = withOptimisticConditions(
    {
      TableName: getSiteContentTableName(),
      Key: { content_key: { S: STUDIO_GUIDE_KEY } },
      UpdateExpression:
        'SET #draft_content_json = :draft_content_json, #draft_updated_at = :draft_updated_at, #draft_updated_by = :draft_updated_by',
      ExpressionAttributeNames: {
        '#draft_content_json': 'draft_content_json',
        '#draft_updated_at': 'draft_updated_at',
        '#draft_updated_by': 'draft_updated_by',
      },
      ExpressionAttributeValues: {
        ':draft_content_json': { S: JSON.stringify(guide) },
        ':draft_updated_at': { S: updatedAt },
        ':draft_updated_by': { S: updatedBy },
      },
    },
    [
      {
        enabled: hasExpectedDraftUpdatedAt,
        attributeName: 'draft_updated_at',
        placeholder: 'expected_draft_updated_at',
        value: expectedDraftUpdatedAt,
      },
    ]
  );

  await dynamoDbRequest('UpdateItem', request);

  return {
    guide,
    draft_updated_at: updatedAt,
    draft_updated_by: updatedBy,
    source: 'dynamo',
    draft_source: 'dynamo',
    has_draft: true,
    configured: true,
  };
}

export async function publishStudioGuide(value, options = {}) {
  assertStudioGuideStoreConfigured();

  const guide = validateStudioGuide(value);
  const updatedAt = new Date().toISOString();
  const updatedBy = String(options.updatedBy || '').trim() || 'unknown';
  const hasExpectedUpdatedAt = Object.prototype.hasOwnProperty.call(
    options,
    'expectedUpdatedAt'
  );
  const hasExpectedDraftUpdatedAt = Object.prototype.hasOwnProperty.call(
    options,
    'expectedDraftUpdatedAt'
  );
  const expectedUpdatedAt = String(options.expectedUpdatedAt || '');
  const expectedDraftUpdatedAt = String(
    options.expectedDraftUpdatedAt || ''
  );
  const serializedGuide = JSON.stringify(guide);

  const request = withOptimisticConditions(
    {
      TableName: getSiteContentTableName(),
      Key: { content_key: { S: STUDIO_GUIDE_KEY } },
      UpdateExpression:
        'SET #content_json = :content_json, #updated_at = :updated_at, #updated_by = :updated_by, #draft_content_json = :draft_content_json, #draft_updated_at = :draft_updated_at, #draft_updated_by = :draft_updated_by',
      ExpressionAttributeNames: {
        '#content_json': 'content_json',
        '#updated_at': 'updated_at',
        '#updated_by': 'updated_by',
        '#draft_content_json': 'draft_content_json',
        '#draft_updated_at': 'draft_updated_at',
        '#draft_updated_by': 'draft_updated_by',
      },
      ExpressionAttributeValues: {
        ':content_json': { S: serializedGuide },
        ':updated_at': { S: updatedAt },
        ':updated_by': { S: updatedBy },
        ':draft_content_json': { S: serializedGuide },
        ':draft_updated_at': { S: updatedAt },
        ':draft_updated_by': { S: updatedBy },
      },
    },
    [
      {
        enabled: hasExpectedUpdatedAt,
        attributeName: 'updated_at',
        placeholder: 'expected_updated_at',
        value: expectedUpdatedAt,
      },
      {
        enabled: hasExpectedDraftUpdatedAt,
        attributeName: 'draft_updated_at',
        placeholder: 'expected_draft_updated_at',
        value: expectedDraftUpdatedAt,
      },
    ]
  );

  await dynamoDbRequest('UpdateItem', request);

  const metadata = metadataForResult({
    publishedSource: 'dynamo',
    draftSource: 'dynamo',
    updatedAt,
    updatedBy,
    draftUpdatedAt: updatedAt,
    draftUpdatedBy: updatedBy,
    hasDraft: true,
  });

  return {
    guide,
    published_guide: guide,
    updated_at: updatedAt,
    updated_by: updatedBy,
    draft_updated_at: updatedAt,
    draft_updated_by: updatedBy,
    source: 'dynamo',
    published_source: 'dynamo',
    draft_source: 'dynamo',
    has_draft: true,
    metadata,
    configured: true,
  };
}

export async function saveStudioGuide(value, options = {}) {
  return publishStudioGuide(value, options);
}
