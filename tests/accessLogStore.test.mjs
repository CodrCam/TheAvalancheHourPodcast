import test from 'node:test';
import assert from 'node:assert/strict';

test('stores a privacy-bounded Cognito session in the existing content table', async () => {
  const previous = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
    netlify: process.env.NETLIFY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  process.env.NETLIFY = 'true';
  globalThis.fetch = async (_url, options = {}) => {
    requests.push({
      target: options.headers?.['x-amz-target'] || '',
      body: JSON.parse(options.body || '{}'),
    });
    return {
      ok: true,
      text: async () => '{}',
    };
  };

  try {
    const { recordAccessSession } = await import(
      `../lib/accessLogStore.js?test=${Date.now()}`
    );
    const result = await recordAccessSession(
      {
        headers: {
          'user-agent':
            'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/140.0',
          'x-forwarded-for': '203.0.113.200',
          'x-nf-client-connection-ip': '198.51.100.42',
        },
      },
      {
        subject: '11111111-2222-3333-4444-555555555555',
        username: 'cam@example.com',
        displayName: 'Cam Griffin',
        role: 'admin',
        groups: ['admin'],
        sessionId: 'sensitive-cognito-jti',
        sessionIssuedAt: 1786377600,
        sessionExpiresAt: 1786381200,
      }
    );

    assert.equal(result.recorded, true);
    assert.equal(requests.length, 1);
    assert.match(requests[0].target, /\.PutItem$/);
    const item = requests[0].body.Item;
    assert.match(item.content_key.S, /^access_session#[a-f0-9]{64}$/);
    assert.equal(item.content_key.S.includes('sensitive-cognito-jti'), false);
    const stored = JSON.parse(item.content_json.S);
    assert.equal(stored.username, 'cam@example.com');
    assert.equal(stored.ip, '198.51.100.42');
    assert.equal(stored.client, 'Chrome on macOS');
    assert.equal(stored.login_at, '2026-08-10T16:00:00.000Z');
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      DYNAMODB_SITE_CONTENT_TABLE: previous.table,
      DYNAMODB_ACCESS_KEY_ID: previous.accessKey,
      DYNAMODB_SECRET_ACCESS_KEY: previous.secretKey,
      NETLIFY: previous.netlify,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
