import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildPaidOrderInventoryTransaction,
  finalizePaidOrderInventory,
} from '../lib/orderInventoryStore.js';

const options = {
  ordersTableName: 'Orders',
  inventoryTableName: 'Inventory',
  updatedAt: '2026-07-25T22:00:00.000Z',
};

test('builds one atomic paid-order marker and aggregated stock decrements', () => {
  const transaction = buildPaidOrderInventoryTransaction(
    'order-123',
    [
      { sku: 'hat-blue', delta: -1 },
      { sku: 'hat-blue', delta: -2 },
      { sku: 'shirt-m', delta: -1 },
    ],
    options
  );

  assert.deepEqual(transaction.deltas, [
    { sku: 'hat-blue', delta: -3, required: 3 },
    { sku: 'shirt-m', delta: -1, required: 1 },
  ]);
  assert.equal(transaction.transactItems.length, 3);
  assert.equal(transaction.transactItems[0].Update.TableName, 'Orders');
  assert.equal(
    transaction.transactItems[1].Update.ExpressionAttributeValues[':required'].N,
    '3'
  );
  assert.match(
    transaction.transactItems[1].Update.ConditionExpression,
    /#quantity >= :required/
  );
});

test('rejects non-decrementing paid-order inventory changes', () => {
  assert.throws(
    () =>
      buildPaidOrderInventoryTransaction(
        'order-123',
        [{ sku: 'hat-blue', delta: 0 }],
        options
      ),
    /negative whole numbers/i
  );
  assert.throws(
    () =>
      buildPaidOrderInventoryTransaction(
        'order-123',
        [{ sku: 'hat-blue', delta: 1 }],
        options
      ),
    /negative whole numbers/i
  );
});

test('treats a duplicate webhook as already applied', async () => {
  const calls = [];
  const request = async (action, body) => {
    calls.push({ action, body });
    if (action === 'TransactWriteItems') {
      throw new Error('Transaction cancelled [ConditionalCheckFailed]');
    }
    return {
      Item: {
        order_id: { S: 'order-123' },
        inventory_decremented: { BOOL: true },
        inventory_decrement_status: { S: 'done' },
      },
    };
  };

  const result = await finalizePaidOrderInventory(
    'order-123',
    [{ sku: 'hat-blue', delta: -1 }],
    { ...options, request }
  );

  assert.equal(result.applied, false);
  assert.equal(result.alreadyApplied, true);
  assert.equal(result.requiresAttention, false);
  assert.deepEqual(
    calls.map((call) => call.action),
    ['TransactWriteItems', 'GetItem']
  );
});

test('commits the order marker and inventory changes in one request', async () => {
  const calls = [];
  const request = async (action, body) => {
    calls.push({ action, body });
    return {};
  };

  const result = await finalizePaidOrderInventory(
    'order-123',
    [{ sku: 'hat-blue', delta: -1 }],
    { ...options, request }
  );

  assert.equal(result.applied, true);
  assert.equal(result.requiresAttention, false);
  assert.deepEqual(
    calls.map((call) => call.action),
    ['TransactWriteItems']
  );
  assert.equal(calls[0].body.TransactItems.length, 2);
});

test('flags a paid order when stock cannot be decremented safely', async () => {
  const calls = [];
  const request = async (action, body) => {
    calls.push({ action, body });
    if (action === 'TransactWriteItems') {
      throw new Error('TransactionCanceledException');
    }
    if (action === 'GetItem') {
      return {
        Item: {
          order_id: { S: 'order-123' },
          inventory_decremented: { BOOL: false },
        },
      };
    }
    return {};
  };

  const result = await finalizePaidOrderInventory(
    'order-123',
    [{ sku: 'hat-blue', delta: -2 }],
    { ...options, request }
  );

  assert.equal(result.applied, false);
  assert.equal(result.requiresAttention, true);
  assert.equal(result.newlyFlagged, true);
  assert.equal(calls.at(-1).action, 'UpdateItem');
  assert.equal(
    calls.at(-1).body.ExpressionAttributeValues[':requires_attention'].S,
    'requires_attention'
  );
});

test('lets transient DynamoDB failures retry through Stripe', async () => {
  const request = async () => {
    throw new Error('fetch failed');
  };

  await assert.rejects(
    finalizePaidOrderInventory(
      'order-123',
      [{ sku: 'hat-blue', delta: -1 }],
      { ...options, request }
    ),
    /fetch failed/
  );
});
