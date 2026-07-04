import { Client } from 'pg';
import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';

function getPg() {
  const connectionString = process.env.SUPABASE_DB_URL;
  if (!connectionString) return null;
  return new Client({
    connectionString,
    ssl: { rejectUnauthorized: false },
  });
}

function getInventoryTableName() {
  return process.env.DYNAMODB_INVENTORY_TABLE || '';
}

export function isDynamoInventoryConfigured() {
  return !!getInventoryTableName();
}

function isSupabaseFallbackAllowed() {
  return process.env.ALLOW_SUPABASE_FALLBACK === 'true';
}

function normalizeQuantity(quantity) {
  const value = Number(quantity);
  return Math.max(0, Number.isFinite(value) ? Math.trunc(value) : 0);
}

function normalizeInventoryRow(row = {}) {
  const sku = String(row.sku || row.sku_key || '').trim();
  const quantity = normalizeQuantity(row.quantity);
  const name = String(row.name || row.product_name || '').trim();
  const hidden = row.hidden === true || row.hidden === 'true';
  return {
    sku,
    sku_key: sku,
    name,
    hidden,
    quantity,
    updated_at: row.updated_at || null,
  };
}

function fromDynamoItem(item = {}) {
  return normalizeInventoryRow({
    sku: item.sku?.S,
    name: item.name?.S,
    hidden: item.hidden?.BOOL,
    quantity: item.quantity?.N,
    updated_at: item.updated_at?.S || null,
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

async function listInventoryFromDynamo() {
  const tableName = getInventoryTableName();
  const rows = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName,
      ProjectionExpression: '#sku, #name, #hidden, #quantity, #updated_at',
      ExpressionAttributeNames: {
        '#sku': 'sku',
        '#name': 'name',
        '#hidden': 'hidden',
        '#quantity': 'quantity',
        '#updated_at': 'updated_at',
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const item of response.Items || []) {
      rows.push(fromDynamoItem(item));
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return rows.sort((a, b) => a.sku.localeCompare(b.sku));
}

async function getInventoryForSkusFromDynamo(skus) {
  const tableName = getInventoryTableName();
  const keys = skus.map((sku) => ({ sku: { S: String(sku) } }));
  const rows = [];

  for (let i = 0; i < keys.length; i += 100) {
    const batch = keys.slice(i, i + 100);
    const response = await dynamoDbRequest('BatchGetItem', {
      RequestItems: {
        [tableName]: {
          Keys: batch,
          ProjectionExpression: '#sku, #name, #hidden, #quantity, #updated_at',
          ExpressionAttributeNames: {
            '#sku': 'sku',
            '#name': 'name',
            '#hidden': 'hidden',
            '#quantity': 'quantity',
            '#updated_at': 'updated_at',
          },
        },
      },
    });

    for (const item of response.Responses?.[tableName] || []) {
      rows.push(fromDynamoItem(item));
    }
  }

  return rows;
}

async function getInventoryRowFromDynamo(sku) {
  const tableName = getInventoryTableName();
  const response = await dynamoDbRequest('GetItem', {
    TableName: tableName,
    Key: { sku: { S: String(sku) } },
    ConsistentRead: true,
  });

  return response.Item ? fromDynamoItem(response.Item) : null;
}

async function setInventoryQuantityInDynamo(sku, quantity, options = {}) {
  const tableName = getInventoryTableName();
  const updatedAt = new Date().toISOString();
  const cleanSku = String(sku).trim();
  const cleanQuantity = normalizeQuantity(quantity);
  const name = String(options.name || '').trim();

  const expressionNames = {
    '#quantity': 'quantity',
    '#updated_at': 'updated_at',
  };
  const expressionValues = {
    ':quantity': { N: String(cleanQuantity) },
    ':updated_at': { S: updatedAt },
  };
  const setParts = ['#quantity = :quantity', '#updated_at = :updated_at'];

  if (name) {
    expressionNames['#name'] = 'name';
    expressionValues[':name'] = { S: name };
    setParts.push('#name = :name');
  }

  if (typeof options.hidden === 'boolean') {
    expressionNames['#hidden'] = 'hidden';
    expressionValues[':hidden'] = { BOOL: options.hidden };
    setParts.push('#hidden = :hidden');
  }

  const response = await dynamoDbRequest('UpdateItem', {
    TableName: tableName,
    Key: { sku: { S: cleanSku } },
    UpdateExpression: `SET ${setParts.join(', ')}`,
    ExpressionAttributeNames: expressionNames,
    ExpressionAttributeValues: expressionValues,
    ReturnValues: 'ALL_NEW',
  });

  return fromDynamoItem(response.Attributes);
}

async function setInventoryHiddenInDynamo(sku, hidden) {
  const tableName = getInventoryTableName();
  const updatedAt = new Date().toISOString();
  const response = await dynamoDbRequest('UpdateItem', {
    TableName: tableName,
    Key: { sku: { S: String(sku) } },
    UpdateExpression: 'SET #hidden = :hidden, #updated_at = :updated_at',
    ExpressionAttributeNames: {
      '#hidden': 'hidden',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':hidden': { BOOL: !!hidden },
      ':updated_at': { S: updatedAt },
    },
    ReturnValues: 'ALL_NEW',
  });

  return fromDynamoItem(response.Attributes);
}

async function applyInventoryDeltaInDynamo(sku, delta) {
  const tableName = getInventoryTableName();
  const cleanSku = String(sku).trim();
  const cleanDelta = Math.trunc(Number(delta));
  const updatedAt = new Date().toISOString();

  if (cleanDelta >= 0) {
    const response = await dynamoDbRequest('UpdateItem', {
      TableName: tableName,
      Key: { sku: { S: cleanSku } },
      UpdateExpression: 'SET #updated_at = :updated_at ADD #quantity :delta',
      ExpressionAttributeNames: {
        '#quantity': 'quantity',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':delta': { N: String(cleanDelta) },
        ':updated_at': { S: updatedAt },
      },
      ReturnValues: 'ALL_NEW',
    });

    return fromDynamoItem(response.Attributes);
  }

  try {
    const response = await dynamoDbRequest('UpdateItem', {
      TableName: tableName,
      Key: { sku: { S: cleanSku } },
      UpdateExpression: 'SET #updated_at = :updated_at ADD #quantity :delta',
      ConditionExpression: 'attribute_exists(#sku) AND #quantity >= :required',
      ExpressionAttributeNames: {
        '#sku': 'sku',
        '#quantity': 'quantity',
        '#updated_at': 'updated_at',
      },
      ExpressionAttributeValues: {
        ':delta': { N: String(cleanDelta) },
        ':required': { N: String(Math.abs(cleanDelta)) },
        ':updated_at': { S: updatedAt },
      },
      ReturnValues: 'ALL_NEW',
    });

    return fromDynamoItem(response.Attributes);
  } catch (err) {
    if (String(err.message).toLowerCase().includes('conditional')) {
      return setInventoryQuantityInDynamo(cleanSku, 0);
    }
    throw err;
  }
}

async function listInventoryFromPg() {
  return withPg(async (pg) => {
    const { rows } = await pg.query(
      'select sku_key as sku, quantity, updated_at from inventory order by sku_key asc'
    );
    return rows.map(normalizeInventoryRow);
  });
}

async function getInventoryForSkusFromPg(skus) {
  return withPg(async (pg) => {
    const { rows } = await pg.query(
      'select sku_key as sku, quantity, updated_at from inventory where sku_key = any($1::text[])',
      [skus]
    );
    return rows.map(normalizeInventoryRow);
  });
}

async function setInventoryQuantityInPg(sku, quantity) {
  return withPg(async (pg) => {
    const cleanQuantity = normalizeQuantity(quantity);
    const { rows } = await pg.query(
      `
      insert into inventory (sku_key, quantity, updated_at)
      values ($1, $2, now())
      on conflict (sku_key)
      do update set quantity = $2, updated_at = now()
      returning sku_key as sku, quantity, updated_at
      `,
      [sku, cleanQuantity]
    );
    return normalizeInventoryRow(rows[0]);
  });
}

async function applyInventoryDeltaInPg(sku, delta) {
  return withPg(async (pg) => {
    const { rows } = await pg.query(
      `
      insert into inventory (sku_key, quantity, updated_at)
      values ($1, greatest(0, $2), now())
      on conflict (sku_key)
      do update set quantity = greatest(0, inventory.quantity + $2), updated_at = now()
      returning sku_key as sku, quantity, updated_at
      `,
      [sku, delta]
    );
    return normalizeInventoryRow(rows[0]);
  });
}

function shouldUseDynamo() {
  return isDynamoInventoryConfigured();
}

export async function listInventory() {
  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return listInventoryFromDynamo();
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return listInventoryFromPg();
}

export async function getInventoryForSkus(skus = []) {
  const cleanSkus = [...new Set(
    (Array.isArray(skus) ? skus : [])
      .map((sku) => String(sku || '').trim())
      .filter(Boolean)
  )];

  if (!cleanSkus.length) return [];

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return getInventoryForSkusFromDynamo(cleanSkus);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return getInventoryForSkusFromPg(cleanSkus);
}

export async function setInventoryQuantity(sku, quantity, options = {}) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return setInventoryQuantityInDynamo(cleanSku, quantity, options);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return setInventoryQuantityInPg(cleanSku, quantity);
}

export async function setInventoryHidden(sku, hidden) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return setInventoryHiddenInDynamo(cleanSku, hidden);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return normalizeInventoryRow({
    sku: cleanSku,
    quantity: 0,
    hidden: !!hidden,
  });
}

export async function applyInventoryDelta(sku, delta) {
  const cleanSku = String(sku || '').trim();
  const cleanDelta = Number(delta);
  if (!cleanSku) throw new Error('SKU is required');
  if (!Number.isFinite(cleanDelta)) throw new Error('Inventory delta is invalid');

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return applyInventoryDeltaInDynamo(cleanSku, cleanDelta);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return applyInventoryDeltaInPg(cleanSku, cleanDelta);
}

async function deleteInventorySkuFromDynamo(sku) {
  const tableName = getInventoryTableName();
  await dynamoDbRequest('DeleteItem', {
    TableName: tableName,
    Key: { sku: { S: String(sku) } },
  });
  return { sku: String(sku), deleted: true };
}

async function deleteInventorySkuFromPg(sku) {
  return withPg(async (pg) => {
    await pg.query('delete from inventory where sku_key = $1', [sku]);
    return { sku, deleted: true };
  });
}

export async function deleteInventorySku(sku) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  if (shouldUseDynamo()) {
    if (!isDynamoCredentialsConfigured()) {
      throw new Error('AWS credentials are not configured for DynamoDB');
    }
    return deleteInventorySkuFromDynamo(cleanSku);
  }

  if (!isSupabaseFallbackAllowed()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }

  return deleteInventorySkuFromPg(cleanSku);
}
