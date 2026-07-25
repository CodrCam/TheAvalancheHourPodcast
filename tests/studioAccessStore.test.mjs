import test from 'node:test';
import assert from 'node:assert/strict';

test('reserves a Cognito subject before conditionally claiming a profile', async () => {
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
    const target = options.headers?.['x-amz-target'] || '';
    const body = JSON.parse(options.body || '{}');
    requests.push({ target, body });
    const data = target.endsWith('.Scan') ? { Items: [] } : {};
    return {
      ok: true,
      text: async () => JSON.stringify(data),
    };
  };

  try {
    const { saveStudioBinding } = await import(
      `../lib/studioAccessStore.js?test=${Date.now()}`
    );
    await saveStudioBinding({
      person_id: 'cam-griffin',
      user_sub: '11111111-2222-3333-4444-555555555555',
      account_email: 'cam@example.com',
      active: true,
    });

    const puts = requests
      .filter((request) => request.target.endsWith('.PutItem'))
      .map((request) => request.body);
    assert.equal(puts.length, 2);
    assert.match(
      puts[0].Item.content_key.S,
      /^studio_profile_subject#[a-f0-9]{64}$/
    );
    assert.match(puts[0].ConditionExpression, /#person_id = :person_id/);
    assert.equal(
      puts[1].Item.content_key.S,
      'studio_profile_binding#cam-griffin'
    );
    assert.match(puts[1].ConditionExpression, /#user_sub = :user_sub/);
    assert.equal(puts[1].Item.active.BOOL, true);
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
