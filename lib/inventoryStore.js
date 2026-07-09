import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';

function getInventoryTableName() {
  return process.env.DYNAMODB_INVENTORY_TABLE || '';
}

export function isDynamoInventoryConfigured() {
  return !!getInventoryTableName();
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

function shouldUseDynamo() {
  return isDynamoInventoryConfigured();
}

function assertDynamoInventoryReady() {
  if (!shouldUseDynamo()) {
    throw new Error('DYNAMODB_INVENTORY_TABLE is not configured on the server');
  }
  if (!isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }
}

export async function listInventory() {
  assertDynamoInventoryReady();
  return listInventoryFromDynamo();
}

export async function getInventoryForSkus(skus = []) {
  const cleanSkus = [...new Set(
    (Array.isArray(skus) ? skus : [])
      .map((sku) => String(sku || '').trim())
      .filter(Boolean)
  )];

  if (!cleanSkus.length) return [];

  assertDynamoInventoryReady();
  return getInventoryForSkusFromDynamo(cleanSkus);
}

export async function setInventoryQuantity(sku, quantity, options = {}) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  assertDynamoInventoryReady();
  return setInventoryQuantityInDynamo(cleanSku, quantity, options);
}

export async function setInventoryHidden(sku, hidden) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  assertDynamoInventoryReady();
  return setInventoryHiddenInDynamo(cleanSku, hidden);
}

export async function applyInventoryDelta(sku, delta) {
  const cleanSku = String(sku || '').trim();
  const cleanDelta = Number(delta);
  if (!cleanSku) throw new Error('SKU is required');
  if (!Number.isFinite(cleanDelta)) throw new Error('Inventory delta is invalid');

  assertDynamoInventoryReady();
  return applyInventoryDeltaInDynamo(cleanSku, cleanDelta);
}

async function deleteInventorySkuFromDynamo(sku) {
  const tableName = getInventoryTableName();
  await dynamoDbRequest('DeleteItem', {
    TableName: tableName,
    Key: { sku: { S: String(sku) } },
  });
  return { sku: String(sku), deleted: true };
}

export async function deleteInventorySku(sku) {
  const cleanSku = String(sku || '').trim();
  if (!cleanSku) throw new Error('SKU is required');

  assertDynamoInventoryReady();
  return deleteInventorySkuFromDynamo(cleanSku);
}
