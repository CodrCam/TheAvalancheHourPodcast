import test from 'node:test';
import assert from 'node:assert/strict';

test('deletes an Episode Studio record only at the expected version', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  globalThis.fetch = async (_url, options = {}) => {
    requests.push({
      target: options.headers?.['x-amz-target'] || '',
      body: JSON.parse(options.body || '{}'),
    });
    return {
      ok: true,
      text: async () =>
        JSON.stringify({
          Attributes: {
            content_key: { S: 'episode_studio#episode-one' },
          },
        }),
    };
  };

  try {
    const { deleteEpisodeStudio } = await import(
      `../lib/episodeStudioStore.js?delete-test=${Date.now()}`
    );
    const result = await deleteEpisodeStudio('episode-one', {
      expectedUpdatedAt: '2026-07-26T12:00:00.000Z',
    });

    assert.equal(result.deleted, true);
    const request = requests.find((candidate) =>
      candidate.target.endsWith('.DeleteItem')
    )?.body;
    assert.ok(request);
    assert.deepEqual(request.Key, {
      content_key: { S: 'episode_studio#episode-one' },
    });
    assert.equal(
      request.ExpressionAttributeValues[':expected_updated_at'].S,
      '2026-07-26T12:00:00.000Z'
    );
    assert.match(request.ConditionExpression, /updated_at/);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnv.table === undefined) {
      delete process.env.DYNAMODB_SITE_CONTENT_TABLE;
    } else {
      process.env.DYNAMODB_SITE_CONTENT_TABLE = previousEnv.table;
    }
    if (previousEnv.accessKey === undefined) {
      delete process.env.DYNAMODB_ACCESS_KEY_ID;
    } else {
      process.env.DYNAMODB_ACCESS_KEY_ID = previousEnv.accessKey;
    }
    if (previousEnv.secretKey === undefined) {
      delete process.env.DYNAMODB_SECRET_ACCESS_KEY;
    } else {
      process.env.DYNAMODB_SECRET_ACCESS_KEY = previousEnv.secretKey;
    }
  }
});
