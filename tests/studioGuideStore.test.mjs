import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getStudioGuide,
  publishStudioGuide,
  saveStudioGuideDraft,
} from '../lib/studioGuideStore.js';

const originalFetch = globalThis.fetch;
const originalEnvironment = {
  DYNAMODB_SITE_CONTENT_TABLE: process.env.DYNAMODB_SITE_CONTENT_TABLE,
  DYNAMODB_ACCESS_KEY_ID: process.env.DYNAMODB_ACCESS_KEY_ID,
  DYNAMODB_SECRET_ACCESS_KEY: process.env.DYNAMODB_SECRET_ACCESS_KEY,
};

process.env.DYNAMODB_SITE_CONTENT_TABLE = 'StudioContentTest';
process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';

test.after(() => {
  globalThis.fetch = originalFetch;
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
});

function guide(title, { published = true } = {}) {
  return {
    eyebrow: 'The Avalanche Hour',
    title,
    intro: `${title} intro`,
    sections: [
      {
        id: 'recording',
        category: 'Record',
        title: 'Recording',
        summary: 'Prepare the room.',
        body: '- Wear headphones',
        published,
        sort_order: 10,
        links: [],
      },
    ],
    manager_notes: [],
  };
}

function dynamoItem({
  publishedGuide,
  draftGuide,
  updatedAt = '',
  updatedBy = '',
  draftUpdatedAt = '',
  draftUpdatedBy = '',
}) {
  return {
    content_key: { S: 'host_studio_guide' },
    ...(publishedGuide === undefined
      ? {}
      : {
          content_json: {
            S:
              typeof publishedGuide === 'string'
                ? publishedGuide
                : JSON.stringify(publishedGuide),
          },
        }),
    ...(draftGuide === undefined
      ? {}
      : {
          draft_content_json: {
            S:
              typeof draftGuide === 'string'
                ? draftGuide
                : JSON.stringify(draftGuide),
          },
        }),
    ...(updatedAt ? { updated_at: { S: updatedAt } } : {}),
    ...(updatedBy ? { updated_by: { S: updatedBy } } : {}),
    ...(draftUpdatedAt
      ? { draft_updated_at: { S: draftUpdatedAt } }
      : {}),
    ...(draftUpdatedBy
      ? { draft_updated_by: { S: draftUpdatedBy } }
      : {}),
  };
}

function mockDynamoResponse(value, calls = []) {
  globalThis.fetch = async (_url, options) => {
    calls.push(JSON.parse(options.body));
    return {
      ok: true,
      text: async () => JSON.stringify(value),
    };
  };
  return calls;
}

test('manager reads a saved draft alongside the published guide and metadata', async () => {
  const publishedGuide = guide('Published guide');
  const draftGuide = guide('Saved draft');
  mockDynamoResponse({
    Item: dynamoItem({
      publishedGuide,
      draftGuide,
      updatedAt: '2026-07-20T12:00:00.000Z',
      updatedBy: 'caleb',
      draftUpdatedAt: '2026-07-21T12:00:00.000Z',
      draftUpdatedBy: 'sierra',
    }),
  });

  const result = await getStudioGuide({ includeDraft: true });

  assert.equal(result.guide.title, 'Saved draft');
  assert.equal(result.published_guide.title, 'Published guide');
  assert.equal(result.updated_by, 'caleb');
  assert.equal(result.draft_updated_by, 'sierra');
  assert.equal(result.has_draft, true);
  assert.deepEqual(result.metadata.published, {
    source: 'dynamo',
    updated_at: '2026-07-20T12:00:00.000Z',
    updated_by: 'caleb',
  });
  assert.deepEqual(result.metadata.draft, {
    source: 'dynamo',
    updated_at: '2026-07-21T12:00:00.000Z',
    updated_by: 'sierra',
    saved: true,
  });
});

test('legacy published records are the manager draft fallback', async () => {
  mockDynamoResponse({
    Item: dynamoItem({
      publishedGuide: guide('Legacy published guide'),
      updatedAt: '2026-07-20T12:00:00.000Z',
    }),
  });

  const result = await getStudioGuide({ includeDraft: true });

  assert.equal(result.guide.title, 'Legacy published guide');
  assert.equal(result.published_guide.title, 'Legacy published guide');
  assert.equal(result.has_draft, false);
  assert.equal(result.draft_source, 'published');
  assert.equal(result.draft_updated_at, '');
});

test('host reads only sanitized published content and ignores the draft', async () => {
  mockDynamoResponse({
    Item: dynamoItem({
      publishedGuide: guide('Published host guide', { published: false }),
      draftGuide: guide('Manager draft'),
    }),
  });

  const result = await getStudioGuide({ forHosts: true });

  assert.equal(result.guide.title, 'Published host guide');
  assert.deepEqual(result.guide.sections, []);
  assert.equal(result.published_guide, undefined);
  assert.equal(result.draft_updated_at, undefined);
});

test('malformed stored JSON throws instead of falling back silently', async () => {
  mockDynamoResponse({
    Item: dynamoItem({ publishedGuide: '{not-json' }),
  });
  await assert.rejects(
    () => getStudioGuide({ forHosts: true }),
    /published content is malformed/
  );

  mockDynamoResponse({
    Item: dynamoItem({
      publishedGuide: guide('Published guide'),
      draftGuide: '{not-json',
    }),
  });
  await assert.rejects(
    () => getStudioGuide({ includeDraft: true }),
    /draft content is malformed/
  );
});

test('host availability is not affected by a malformed manager draft', async () => {
  mockDynamoResponse({
    Item: dynamoItem({
      publishedGuide: guide('Published guide'),
      draftGuide: '{not-json',
    }),
  });

  const result = await getStudioGuide({ forHosts: true });
  assert.equal(result.guide.title, 'Published guide');
});

test('draft save updates only draft fields with draft concurrency metadata', async () => {
  const calls = mockDynamoResponse({});

  const result = await saveStudioGuideDraft(guide('Work in progress'), {
    expectedDraftUpdatedAt: '2026-07-21T12:00:00.000Z',
    updatedBy: 'sierra',
  });

  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.match(request.UpdateExpression, /#draft_content_json/);
  assert.doesNotMatch(request.UpdateExpression, /(?:^|, )#content_json =/);
  assert.equal(
    request.ConditionExpression,
    '#draft_updated_at = :expected_draft_updated_at'
  );
  assert.equal(
    request.ExpressionAttributeValues[':expected_draft_updated_at'].S,
    '2026-07-21T12:00:00.000Z'
  );
  assert.equal(
    request.ExpressionAttributeValues[':draft_updated_by'].S,
    'sierra'
  );
  assert.equal(result.draft_updated_by, 'sierra');
});

test('publish atomically aligns draft and published content with separate checks', async () => {
  const calls = mockDynamoResponse({});

  const result = await publishStudioGuide(guide('Ready to publish'), {
    expectedUpdatedAt: '2026-07-20T12:00:00.000Z',
    expectedDraftUpdatedAt: '2026-07-21T12:00:00.000Z',
    updatedBy: 'caleb',
  });

  assert.equal(calls.length, 1);
  const request = calls[0];
  assert.match(
    request.ConditionExpression,
    /#updated_at = :expected_updated_at/
  );
  assert.match(
    request.ConditionExpression,
    /#draft_updated_at = :expected_draft_updated_at/
  );
  assert.match(request.ConditionExpression, / AND /);
  assert.equal(
    request.ExpressionAttributeValues[':content_json'].S,
    request.ExpressionAttributeValues[':draft_content_json'].S
  );
  assert.equal(
    request.ExpressionAttributeValues[':updated_at'].S,
    request.ExpressionAttributeValues[':draft_updated_at'].S
  );
  assert.equal(
    request.ExpressionAttributeValues[':updated_by'].S,
    request.ExpressionAttributeValues[':draft_updated_by'].S
  );
  assert.equal(
    result.updated_at,
    result.draft_updated_at,
    'published and draft timestamps should advance together'
  );
  assert.equal(result.updated_by, 'caleb');
  assert.equal(result.draft_updated_by, 'caleb');
});
