import {
  dynamoDbRequest,
  isDynamoCredentialsConfigured,
} from './dynamoDb.js';

function tableName(name, fallback) {
  return String(name || fallback || '').trim();
}

function isConditionalFailure(error) {
  const message = String(error?.message || error || '').toLowerCase();
  return (
    message.includes('conditional') ||
    message.includes('transactioncanceledexception') ||
    message.includes('transaction cancelled')
  );
}

function normalizePaidOrderDeltas(rawDeltas = []) {
  const aggregated = new Map();

  for (const entry of Array.isArray(rawDeltas) ? rawDeltas : []) {
    const sku = String(entry?.sku || '').trim();
    const delta = Number(entry?.delta);
    if (!sku || !Number.isInteger(delta) || delta >= 0) {
      throw new Error('Paid-order inventory changes must be negative whole numbers');
    }
    aggregated.set(sku, (aggregated.get(sku) || 0) + delta);
  }

  const deltas = [...aggregated.entries()].map(([sku, delta]) => ({
    sku,
    delta,
    required: Math.abs(delta),
  }));
  if (!deltas.length) {
    throw new Error('Paid store order has no inventory changes');
  }
  if (deltas.length > 99) {
    throw new Error('Too many inventory changes for one paid order');
  }
  return deltas;
}

export function buildPaidOrderInventoryTransaction(
  orderId,
  rawDeltas,
  options = {}
) {
  const cleanOrderId = String(orderId || '').trim();
  if (!cleanOrderId) throw new Error('order_id is required');

  const ordersTableName = tableName(
    options.ordersTableName,
    process.env.DYNAMODB_ORDERS_TABLE
  );
  const inventoryTableName = tableName(
    options.inventoryTableName,
    process.env.DYNAMODB_INVENTORY_TABLE
  );
  if (!ordersTableName || !inventoryTableName) {
    throw new Error('Order and inventory DynamoDB tables must be configured');
  }

  const updatedAt = String(options.updatedAt || new Date().toISOString());
  const deltas = normalizePaidOrderDeltas(rawDeltas);
  return {
    deltas,
    transactItems: [
      {
        Update: {
          TableName: ordersTableName,
          Key: { order_id: { S: cleanOrderId } },
          UpdateExpression:
            'SET #inventory_decremented = :true, #inventory_decrement_status = :done, #updated_at = :updated_at',
          ConditionExpression:
            'attribute_exists(#order_id) AND (attribute_not_exists(#inventory_decremented) OR #inventory_decremented = :false)',
          ExpressionAttributeNames: {
            '#order_id': 'order_id',
            '#inventory_decremented': 'inventory_decremented',
            '#inventory_decrement_status': 'inventory_decrement_status',
            '#updated_at': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':true': { BOOL: true },
            ':false': { BOOL: false },
            ':done': { S: 'done' },
            ':updated_at': { S: updatedAt },
          },
        },
      },
      ...deltas.map(({ sku, delta, required }) => ({
        Update: {
          TableName: inventoryTableName,
          Key: { sku: { S: sku } },
          UpdateExpression:
            'SET #updated_at = :updated_at ADD #quantity :delta',
          ConditionExpression:
            'attribute_exists(#sku) AND #quantity >= :required',
          ExpressionAttributeNames: {
            '#sku': 'sku',
            '#quantity': 'quantity',
            '#updated_at': 'updated_at',
          },
          ExpressionAttributeValues: {
            ':delta': { N: String(delta) },
            ':required': { N: String(required) },
            ':updated_at': { S: updatedAt },
          },
        },
      })),
    ],
  };
}

function orderInventoryState(item = {}) {
  return {
    exists: Boolean(item.order_id?.S),
    decremented: item.inventory_decremented?.BOOL === true,
    status: String(item.inventory_decrement_status?.S || ''),
  };
}

async function readOrderInventoryState(request, ordersTableName, orderId) {
  const response = await request('GetItem', {
    TableName: ordersTableName,
    Key: { order_id: { S: orderId } },
    ProjectionExpression:
      '#order_id, #inventory_decremented, #inventory_decrement_status',
    ExpressionAttributeNames: {
      '#order_id': 'order_id',
      '#inventory_decremented': 'inventory_decremented',
      '#inventory_decrement_status': 'inventory_decrement_status',
    },
    ConsistentRead: true,
  });
  return orderInventoryState(response.Item);
}

async function markOrderForStockReview(
  request,
  ordersTableName,
  orderId,
  updatedAt
) {
  await request('UpdateItem', {
    TableName: ordersTableName,
    Key: { order_id: { S: orderId } },
    UpdateExpression:
      'SET #inventory_decrement_status = :requires_attention, #updated_at = :updated_at',
    ConditionExpression:
      'attribute_exists(#order_id) AND (attribute_not_exists(#inventory_decremented) OR #inventory_decremented = :false)',
    ExpressionAttributeNames: {
      '#order_id': 'order_id',
      '#inventory_decremented': 'inventory_decremented',
      '#inventory_decrement_status': 'inventory_decrement_status',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':false': { BOOL: false },
      ':requires_attention': { S: 'requires_attention' },
      ':updated_at': { S: updatedAt },
    },
  });
}

export async function finalizePaidOrderInventory(
  orderId,
  rawDeltas,
  options = {}
) {
  const cleanOrderId = String(orderId || '').trim();
  const ordersTableName = tableName(
    options.ordersTableName,
    process.env.DYNAMODB_ORDERS_TABLE
  );
  const inventoryTableName = tableName(
    options.inventoryTableName,
    process.env.DYNAMODB_INVENTORY_TABLE
  );
  const updatedAt = String(options.updatedAt || new Date().toISOString());
  const request = options.request || dynamoDbRequest;

  if (!options.request && !isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }

  const transaction = buildPaidOrderInventoryTransaction(
    cleanOrderId,
    rawDeltas,
    {
      ordersTableName,
      inventoryTableName,
      updatedAt,
    }
  );

  try {
    await request('TransactWriteItems', {
      TransactItems: transaction.transactItems,
    });
    return {
      applied: true,
      alreadyApplied: false,
      requiresAttention: false,
      newlyFlagged: false,
      changes: transaction.deltas,
    };
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
  }

  let state = await readOrderInventoryState(
    request,
    ordersTableName,
    cleanOrderId
  );
  if (!state.exists) throw new Error('Paid order record is missing');
  if (state.decremented) {
    return {
      applied: false,
      alreadyApplied: true,
      requiresAttention: false,
      newlyFlagged: false,
      changes: transaction.deltas,
    };
  }
  if (state.status === 'requires_attention') {
    return {
      applied: false,
      alreadyApplied: false,
      requiresAttention: true,
      newlyFlagged: false,
      changes: transaction.deltas,
    };
  }

  try {
    await markOrderForStockReview(
      request,
      ordersTableName,
      cleanOrderId,
      updatedAt
    );
  } catch (error) {
    if (!isConditionalFailure(error)) throw error;
    state = await readOrderInventoryState(
      request,
      ordersTableName,
      cleanOrderId
    );
    if (state.decremented) {
      return {
        applied: false,
        alreadyApplied: true,
        requiresAttention: false,
        newlyFlagged: false,
        changes: transaction.deltas,
      };
    }
    if (!state.exists) throw new Error('Paid order record is missing');
    if (state.status === 'requires_attention') {
      return {
        applied: false,
        alreadyApplied: false,
        requiresAttention: true,
        newlyFlagged: false,
        changes: transaction.deltas,
      };
    }
  }

  return {
    applied: false,
    alreadyApplied: false,
    requiresAttention: true,
    newlyFlagged: true,
    changes: transaction.deltas,
  };
}
