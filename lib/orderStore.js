import { Client } from 'pg';
import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';

const ORDER_FIELDS = [
  'order_id',
  'stripe_payment_intent_id',
  'status',
  'fulfillment_status',
  'amount_cents',
  'customer_email',
  'customer_name',
  'shipping_name',
  'shipping_address1',
  'shipping_address2',
  'shipping_city',
  'shipping_state',
  'shipping_postal_code',
  'shipping_country',
  'created_at',
  'updated_at',
];

const FULFILLMENT_STATUSES = new Set(['new', 'processing', 'shipped']);

function getOrdersTableName() {
  return process.env.DYNAMODB_ORDERS_TABLE || '';
}

export function isDynamoOrdersConfigured() {
  return !!getOrdersTableName();
}

function shouldUseDynamo() {
  return isDynamoOrdersConfigured();
}

function isSupabaseFallbackAllowed() {
  return process.env.ALLOW_SUPABASE_FALLBACK === 'true';
}

function getPg() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) return null;
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

async function withPg(callback) {
  const pg = getPg();
  if (!pg) {
    throw new Error('SUPABASE_DB_URL is not configured on the server');
  }

  try {
    await pg.connect();
    return await callback(pg);
  } finally {
    try {
      await pg.end();
    } catch {
      // ignore
    }
  }
}

function normalizeFulfillmentStatus(value) {
  const normalized = String(value || 'new').trim().toLowerCase();
  return FULFILLMENT_STATUSES.has(normalized) ? normalized : 'new';
}

function normalizePaymentStatus(value) {
  const normalized = String(value || 'paid').trim().toLowerCase();
  return normalized === 'succeeded' ? 'paid' : normalized;
}

function parseItems(value) {
  if (Array.isArray(value)) return value;
  if (!value) return [];
  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }
  return [];
}

function normalizeOrder(row = {}) {
  const orderId = String(row.order_id || '').trim();
  const createdAt = row.created_at || new Date().toISOString();
  return {
    order_id: orderId,
    stripe_payment_intent_id: row.stripe_payment_intent_id || '',
    status: normalizePaymentStatus(row.status),
    fulfillment_status: normalizeFulfillmentStatus(row.fulfillment_status),
    amount_cents: Number(row.amount_cents) || 0,
    items: parseItems(row.items ?? row.items_json),
    customer_email: row.customer_email || '',
    customer_name: row.customer_name || '',
    shipping_name: row.shipping_name || '',
    shipping_address1: row.shipping_address1 || '',
    shipping_address2: row.shipping_address2 || '',
    shipping_city: row.shipping_city || '',
    shipping_state: row.shipping_state || '',
    shipping_postal_code: row.shipping_postal_code || '',
    shipping_country: row.shipping_country || '',
    created_at: createdAt,
    updated_at: row.updated_at || createdAt,
    inventory_decremented:
      row.inventory_decremented === true || row.inventory_decremented === 'true',
    inventory_decrement_status: row.inventory_decrement_status || '',
  };
}

function dynamoString(value) {
  const str = String(value || '').trim();
  return str ? { S: str } : null;
}

function dynamoNumber(value) {
  const num = Number(value);
  return { N: String(Number.isFinite(num) ? Math.trunc(num) : 0) };
}

function toDynamoItem(order) {
  const normalized = normalizeOrder(order);
  const item = {
    order_id: { S: normalized.order_id },
    status: { S: normalized.status },
    fulfillment_status: { S: normalized.fulfillment_status },
    amount_cents: dynamoNumber(normalized.amount_cents),
    items_json: { S: JSON.stringify(normalized.items || []) },
    created_at: { S: normalized.created_at },
    updated_at: { S: normalized.updated_at },
    inventory_decremented: { BOOL: !!normalized.inventory_decremented },
  };

  for (const field of ORDER_FIELDS) {
    if (item[field] || ['amount_cents', 'created_at', 'updated_at'].includes(field)) continue;
    const attr = dynamoString(normalized[field]);
    if (attr) item[field] = attr;
  }

  const decrementStatus = dynamoString(normalized.inventory_decrement_status);
  if (decrementStatus) item.inventory_decrement_status = decrementStatus;

  return item;
}

function fromDynamoItem(item = {}) {
  return normalizeOrder({
    order_id: item.order_id?.S,
    stripe_payment_intent_id: item.stripe_payment_intent_id?.S,
    status: item.status?.S,
    fulfillment_status: item.fulfillment_status?.S,
    amount_cents: item.amount_cents?.N,
    items_json: item.items_json?.S,
    customer_email: item.customer_email?.S,
    customer_name: item.customer_name?.S,
    shipping_name: item.shipping_name?.S,
    shipping_address1: item.shipping_address1?.S,
    shipping_address2: item.shipping_address2?.S,
    shipping_city: item.shipping_city?.S,
    shipping_state: item.shipping_state?.S,
    shipping_postal_code: item.shipping_postal_code?.S,
    shipping_country: item.shipping_country?.S,
    created_at: item.created_at?.S,
    updated_at: item.updated_at?.S,
    inventory_decremented: item.inventory_decremented?.BOOL,
    inventory_decrement_status: item.inventory_decrement_status?.S,
  });
}

function isConditionalFailure(err) {
  return String(err?.message || err).toLowerCase().includes('conditional');
}

async function upsertOrderInDynamo(order, options = {}) {
  const tableName = getOrdersTableName();
  const now = new Date().toISOString();
  const normalized = normalizeOrder({
    ...order,
    created_at: order.created_at || now,
    updated_at: now,
  });

  try {
    await dynamoDbRequest('PutItem', {
      TableName: tableName,
      Item: toDynamoItem(normalized),
      ConditionExpression: 'attribute_not_exists(#order_id)',
      ExpressionAttributeNames: {
        '#order_id': 'order_id',
      },
    });

    return { order: normalized, isNewOrder: true };
  } catch (err) {
    if (!isConditionalFailure(err)) throw err;
  }

  const expressionNames = {
    '#updated_at': 'updated_at',
    '#stripe_payment_intent_id': 'stripe_payment_intent_id',
    '#status': 'status',
    '#fulfillment_status': 'fulfillment_status',
    '#amount_cents': 'amount_cents',
    '#items_json': 'items_json',
  };
  const expressionValues = {
    ':updated_at': { S: now },
    ':stripe_payment_intent_id': { S: normalized.stripe_payment_intent_id },
    ':status': { S: normalized.status },
    ':fulfillment_status': { S: normalized.fulfillment_status },
    ':amount_cents': dynamoNumber(normalized.amount_cents),
    ':items_json': { S: JSON.stringify(normalized.items || []) },
  };
  const setParts = [
    '#updated_at = :updated_at',
    '#stripe_payment_intent_id = :stripe_payment_intent_id',
    '#status = :status',
    '#fulfillment_status = if_not_exists(#fulfillment_status, :fulfillment_status)',
    '#amount_cents = :amount_cents',
    options.preserveExistingItems
      ? '#items_json = if_not_exists(#items_json, :items_json)'
      : '#items_json = :items_json',
  ];

  for (const field of [
    'customer_email',
    'customer_name',
    'shipping_name',
    'shipping_address1',
    'shipping_address2',
    'shipping_city',
    'shipping_state',
    'shipping_postal_code',
    'shipping_country',
  ]) {
    expressionNames[`#${field}`] = field;
    expressionValues[`:${field}`] = { S: String(normalized[field] || '') };
    setParts.push(`#${field} = :${field}`);
  }

  const response = await dynamoDbRequest('UpdateItem', {
    TableName: tableName,
    Key: { order_id: { S: normalized.order_id } },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  });

  return { order: fromDynamoItem(response.Attributes), isNewOrder: false };
}

async function listOrdersFromDynamo(options = {}) {
  const tableName = getOrdersTableName();
  const rows = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName,
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const item of response.Items || []) {
      rows.push(fromDynamoItem(item));
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  const filtered = options.unshippedOnly
    ? rows.filter((order) => order.fulfillment_status !== 'shipped')
    : rows;
  const direction = options.sort === 'asc' ? 1 : -1;

  return filtered
    .sort((a, b) => direction * String(a.created_at).localeCompare(String(b.created_at)))
    .slice(0, options.limit || 200);
}

async function updateFulfillmentStatusInDynamo(orderId, fulfillmentStatus) {
  const tableName = getOrdersTableName();
  const now = new Date().toISOString();
  const response = await dynamoDbRequest('UpdateItem', {
    TableName: tableName,
    Key: { order_id: { S: String(orderId) } },
    UpdateExpression: 'SET #fulfillment_status = :status, #updated_at = :updated_at',
    ConditionExpression: 'attribute_exists(#order_id)',
    ExpressionAttributeNames: {
      '#order_id': 'order_id',
      '#fulfillment_status': 'fulfillment_status',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':status': { S: normalizeFulfillmentStatus(fulfillmentStatus) },
      ':updated_at': { S: now },
    },
    ReturnValues: 'ALL_NEW',
  });

  return fromDynamoItem(response.Attributes);
}

async function claimInventoryDecrementInDynamo(orderId) {
  const tableName = getOrdersTableName();
  const now = new Date().toISOString();

  try {
    await dynamoDbRequest('UpdateItem', {
      TableName: tableName,
      Key: { order_id: { S: String(orderId) } },
      UpdateExpression:
        'SET #inventory_decrement_status = :processing, #updated_at = :updated_at',
      ConditionExpression:
        'attribute_exists(#order_id) AND (attribute_not_exists(#inventory_decremented) OR #inventory_decremented = :false) AND (attribute_not_exists(#inventory_decrement_status) OR #inventory_decrement_status <> :processing)',
      ExpressionAttributeNames: {
        '#order_id': 'order_id',
        '#inventory_decremented': 'inventory_decremented',
        '#inventory_decrement_status': 'inventory_decrement_status',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':false': { BOOL: false },
        ':processing': { S: 'processing' },
        ':updated_at': { S: now },
      },
    });
    return true;
  } catch (err) {
    if (isConditionalFailure(err)) return false;
    throw err;
  }
}

async function markInventoryDecrementedInDynamo(orderId) {
  const tableName = getOrdersTableName();
  const now = new Date().toISOString();
  await dynamoDbRequest('UpdateItem', {
    TableName: tableName,
    Key: { order_id: { S: String(orderId) } },
    UpdateExpression:
      'SET #inventory_decremented = :true, #inventory_decrement_status = :done, #updated_at = :updated_at',
    ExpressionAttributeNames: {
      '#inventory_decremented': 'inventory_decremented',
      '#inventory_decrement_status': 'inventory_decrement_status',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':true': { BOOL: true },
      ':done': { S: 'done' },
      ':updated_at': { S: now },
    },
  });
}

async function upsertOrderInPg(order) {
  return withPg(async (pg) => {
    const normalized = normalizeOrder(order);
    const existing = await pg.query(
      'select 1 from orders where order_id = $1 limit 1',
      [normalized.order_id]
    );
    const isNewOrder = existing.rowCount === 0;

    await pg.query(
      `
      insert into orders (
        order_id,
        stripe_payment_intent_id,
        status,
        fulfillment_status,
        amount_cents,
        items,
        customer_email,
        customer_name,
        shipping_name,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        created_at
      )
      values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, now())
      on conflict (order_id) do update set
        stripe_payment_intent_id = excluded.stripe_payment_intent_id,
        status = excluded.status,
        amount_cents = excluded.amount_cents,
        items = excluded.items,
        customer_email = excluded.customer_email,
        customer_name = excluded.customer_name,
        shipping_name = excluded.shipping_name,
        shipping_address1 = excluded.shipping_address1,
        shipping_address2 = excluded.shipping_address2,
        shipping_city = excluded.shipping_city,
        shipping_state = excluded.shipping_state,
        shipping_postal_code = excluded.shipping_postal_code,
        shipping_country = excluded.shipping_country
      `,
      [
        normalized.order_id,
        normalized.stripe_payment_intent_id,
        normalized.status,
        normalized.fulfillment_status,
        normalized.amount_cents,
        JSON.stringify(normalized.items || []),
        normalized.customer_email,
        normalized.customer_name,
        normalized.shipping_name,
        normalized.shipping_address1,
        normalized.shipping_address2,
        normalized.shipping_city,
        normalized.shipping_state,
        normalized.shipping_postal_code,
        normalized.shipping_country,
      ]
    );

    return { order: normalized, isNewOrder };
  });
}

async function listOrdersFromPg(options = {}) {
  return withPg(async (pg) => {
    const where = options.unshippedOnly
      ? "where fulfillment_status is distinct from 'shipped'"
      : '';
    const orderDirection = options.sort === 'asc' ? 'asc' : 'desc';
    const limit = Math.max(1, Math.min(Number(options.limit) || 200, 1000));
    const { rows } = await pg.query(`
      select
        order_id,
        stripe_payment_intent_id,
        status,
        fulfillment_status,
        amount_cents,
        items,
        customer_email,
        customer_name,
        shipping_name,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        created_at
      from orders
      ${where}
      order by created_at ${orderDirection}
      limit ${limit}
    `);
    return rows.map(normalizeOrder);
  });
}

async function updateFulfillmentStatusInPg(orderId, fulfillmentStatus) {
  return withPg(async (pg) => {
    const { rows, rowCount } = await pg.query(
      `
      update orders
      set fulfillment_status = $2
      where order_id = $1
      returning
        order_id,
        stripe_payment_intent_id,
        status,
        fulfillment_status,
        amount_cents,
        items,
        customer_email,
        customer_name,
        shipping_name,
        shipping_address1,
        shipping_address2,
        shipping_city,
        shipping_state,
        shipping_postal_code,
        shipping_country,
        created_at
      `,
      [orderId, normalizeFulfillmentStatus(fulfillmentStatus)]
    );

    if (rowCount === 0) {
      const err = new Error('Order not found');
      err.code = 'ORDER_NOT_FOUND';
      throw err;
    }

    return normalizeOrder(rows[0]);
  });
}

export async function upsertOrder(order, options = {}) {
  const normalized = normalizeOrder(order);
  if (!normalized.order_id) throw new Error('order_id is required');

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return upsertOrderInDynamo(normalized, options);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_ORDERS_TABLE is not configured on the server');
  }

  return upsertOrderInPg(normalized, options);
}

export async function listOrders(options = {}) {
  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return listOrdersFromDynamo(options);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_ORDERS_TABLE is not configured on the server');
  }

  return listOrdersFromPg(options);
}

export async function updateFulfillmentStatus(orderId, fulfillmentStatus) {
  const status = normalizeFulfillmentStatus(fulfillmentStatus);

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return updateFulfillmentStatusInDynamo(orderId, status);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_ORDERS_TABLE is not configured on the server');
  }

  return updateFulfillmentStatusInPg(orderId, status);
}

export async function claimInventoryDecrement(orderId) {
  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return claimInventoryDecrementInDynamo(orderId);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_ORDERS_TABLE is not configured on the server');
  }

  return true;
}

export async function markInventoryDecremented(orderId) {
  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return markInventoryDecrementedInDynamo(orderId);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_ORDERS_TABLE is not configured on the server');
  }

  return null;
}
