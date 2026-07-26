import test from 'node:test';
import assert from 'node:assert/strict';

test('stores Team Inbox items in the existing content table with concurrency protection', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_SITE_CONTENT_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];
  const stored = {
    item_id: 'guest-release-12345678',
    kind: 'request',
    title: 'Add the guest release',
    details: 'Please add the current guest release to the shared guide.',
    status: 'new',
    priority: 'normal',
    created_by_person_id: 'host-one',
    created_by_name: 'Host One',
    created_at: '2026-07-26T12:00:00.000Z',
    updated_at: '2026-07-26T12:00:00.000Z',
  };
  const row = {
    content_key: { S: 'studio_intake#guest-release-12345678' },
    content_json: { S: JSON.stringify(stored) },
    updated_at: { S: stored.updated_at },
  };

  process.env.DYNAMODB_SITE_CONTENT_TABLE = 'TestSiteContent';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  globalThis.fetch = async (_url, options = {}) => {
    const target = options.headers?.['x-amz-target'] || '';
    const body = JSON.parse(options.body || '{}');
    requests.push({ target, body });
    if (target.endsWith('.Scan')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ Items: [row] }),
      };
    }
    if (target.endsWith('.GetItem')) {
      return {
        ok: true,
        text: async () => JSON.stringify({ Item: row }),
      };
    }
    return { ok: true, text: async () => '{}' };
  };

  try {
    const store = await import(
      `../lib/studioIntakeStore.js?test=${Date.now()}`
    );
    const listed = await store.listStudioIntakeItems();
    const loaded = await store.getStudioIntakeItem(stored.item_id);
    const created = await store.createStudioIntakeItem(stored);
    const saved = await store.saveStudioIntakeItem(
      { ...created.item, status: 'reviewing' },
      { expectedUpdatedAt: created.item.updated_at }
    );

    assert.equal(listed.items[0].item_id, stored.item_id);
    assert.equal(loaded.item.title, stored.title);
    assert.equal(saved.item.status, 'reviewing');

    const scan = requests.find((request) =>
      request.target.endsWith('.Scan')
    ).body;
    assert.equal(
      scan.ExpressionAttributeValues[':prefix'].S,
      'studio_intake#'
    );

    const puts = requests.filter((request) =>
      request.target.endsWith('.PutItem')
    );
    assert.match(puts[0].body.Item.content_key.S, /^studio_intake#/);
    assert.equal(
      puts[0].body.ConditionExpression,
      'attribute_not_exists(#key)'
    );
    assert.equal(
      puts[1].body.ExpressionAttributeValues[':expected_updated_at'].S,
      created.item.updated_at
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [name, value] of Object.entries({
      DYNAMODB_SITE_CONTENT_TABLE: previousEnv.table,
      DYNAMODB_ACCESS_KEY_ID: previousEnv.accessKey,
      DYNAMODB_SECRET_ACCESS_KEY: previousEnv.secretKey,
    })) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
});
