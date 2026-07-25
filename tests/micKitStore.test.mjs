import test from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_MIC_KIT_TRACKER } from '../lib/micKitPresentation.mjs';

test('saves the shared tracker with concurrency protection in the dedicated mic-kit table', async () => {
  const previousEnv = {
    table: process.env.DYNAMODB_MIC_KITS_TABLE,
    accessKey: process.env.DYNAMODB_ACCESS_KEY_ID,
    secretKey: process.env.DYNAMODB_SECRET_ACCESS_KEY,
  };
  const previousFetch = globalThis.fetch;
  const requests = [];

  process.env.DYNAMODB_MIC_KITS_TABLE = 'TestMicKits';
  process.env.DYNAMODB_ACCESS_KEY_ID = 'test-access-key';
  process.env.DYNAMODB_SECRET_ACCESS_KEY = 'test-secret-key';
  globalThis.fetch = async (_url, options = {}) => {
    requests.push({
      target: options.headers?.['x-amz-target'] || '',
      body: JSON.parse(options.body || '{}'),
    });
    return {
      ok: true,
      text: async () => JSON.stringify({}),
    };
  };

  try {
    const { saveMicKitTracker } = await import(
      `../lib/micKitStore.js?test=${Date.now()}`
    );
    const result = await saveMicKitTracker(DEFAULT_MIC_KIT_TRACKER, {
      expectedUpdatedAt: '',
      updatedBy: 'Caleb Merrill',
    });

    assert.equal(result.configured, true);
    assert.equal(result.tracker.updated_by, 'Caleb Merrill');
    const put = requests.find((request) =>
      request.target.endsWith('.PutItem')
    )?.body;
    assert.ok(put);
    assert.equal(
      put.Item.tracker_id.S,
      'studio_mic_kit_tracker'
    );
    assert.match(put.ConditionExpression, /attribute_not_exists/);
    assert.equal(
      put.ExpressionAttributeValues[':expected_updated_at'].S,
      ''
    );
    const stored = JSON.parse(put.Item.content_json.S);
    assert.equal(stored.kits.length, 5);
    assert.equal(stored.inventory_confirmed, false);
  } finally {
    globalThis.fetch = previousFetch;
    if (previousEnv.table === undefined) {
      delete process.env.DYNAMODB_MIC_KITS_TABLE;
    } else {
      process.env.DYNAMODB_MIC_KITS_TABLE = previousEnv.table;
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
