// Seeds DynamoDB orders from data/dynamodb-orders-seed.json.
// By default this is a dry run. Pass --apply to write to DynamoDB.
// Existing DynamoDB orders are skipped unless --overwrite is also passed.
require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(process.cwd(), 'data', 'dynamodb-orders-seed.json');

function sha256(value, encoding = 'hex') {
  return crypto.createHash('sha256').update(value, 'utf8').digest(encoding);
}

function hmac(key, value, encoding) {
  return crypto.createHmac('sha256', key).update(value, 'utf8').digest(encoding);
}

function getSigningKey(secretKey, dateStamp, region, service) {
  const kDate = hmac(`AWS4${secretKey}`, dateStamp);
  const kRegion = hmac(kDate, region);
  const kService = hmac(kRegion, service);
  return hmac(kService, 'aws4_request');
}

function toAmzDate(date) {
  return date.toISOString().replace(/[:-]|\.\d{3}/g, '');
}

function readEnv(name) {
  return String(process.env[name] || '').trim();
}

function getAwsConfig() {
  const dynamoAccessKeyId = readEnv('DYNAMODB_ACCESS_KEY_ID');
  const dynamoSecretAccessKey = readEnv('DYNAMODB_SECRET_ACCESS_KEY');
  const usingDynamoNamedCredentials =
    !!(dynamoAccessKeyId || dynamoSecretAccessKey);

  return {
    region:
      readEnv('DYNAMODB_REGION') ||
      readEnv('AWS_REGION') ||
      readEnv('COGNITO_REGION') ||
      'us-east-2',
    tableName: readEnv('DYNAMODB_ORDERS_TABLE'),
    accessKeyId: usingDynamoNamedCredentials
      ? dynamoAccessKeyId
      : readEnv('AWS_ACCESS_KEY_ID'),
    secretAccessKey: usingDynamoNamedCredentials
      ? dynamoSecretAccessKey
      : readEnv('AWS_SECRET_ACCESS_KEY'),
    sessionToken: usingDynamoNamedCredentials
      ? readEnv('DYNAMODB_SESSION_TOKEN')
      : readEnv('AWS_SESSION_TOKEN'),
  };
}

async function dynamoDbRequest(action, body) {
  const {
    region,
    accessKeyId,
    secretAccessKey,
    sessionToken,
  } = getAwsConfig();

  if (!accessKeyId || !secretAccessKey) {
    throw new Error('DynamoDB access key env vars are missing');
  }

  const service = 'dynamodb';
  const host = `dynamodb.${region}.amazonaws.com`;
  const endpoint = `https://${host}/`;
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payload = JSON.stringify(body || {});
  const target = `DynamoDB_20120810.${action}`;

  const headers = {
    'content-type': 'application/x-amz-json-1.0',
    host,
    'x-amz-date': amzDate,
    'x-amz-target': target,
  };

  if (sessionToken) {
    headers['x-amz-security-token'] = sessionToken;
  }

  const signedHeaderNames = Object.keys(headers).sort();
  const canonicalHeaders = signedHeaderNames
    .map((name) => `${name}:${String(headers[name]).trim()}\n`)
    .join('');
  const signedHeaders = signedHeaderNames.join(';');
  const canonicalRequest = [
    'POST',
    '/',
    '',
    canonicalHeaders,
    signedHeaders,
    sha256(payload),
  ].join('\n');

  const credentialScope = `${dateStamp}/${region}/${service}/aws4_request`;
  const stringToSign = [
    'AWS4-HMAC-SHA256',
    amzDate,
    credentialScope,
    sha256(canonicalRequest),
  ].join('\n');
  const signingKey = getSigningKey(
    secretAccessKey,
    dateStamp,
    region,
    service
  );
  const signature = hmac(signingKey, stringToSign, 'hex');
  const authorization = [
    `AWS4-HMAC-SHA256 Credential=${accessKeyId}/${credentialScope}`,
    `SignedHeaders=${signedHeaders}`,
    `Signature=${signature}`,
  ].join(', ');

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      ...headers,
      Authorization: authorization,
    },
    body: payload,
  });

  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    const message = data.message || data.__type || 'DynamoDB request failed';
    const err = new Error(message);
    err.status = response.status;
    throw err;
  }

  return data;
}

function dynamoString(value) {
  const str = String(value || '').trim();
  return str ? { S: str } : null;
}

function dynamoNumber(value) {
  const num = Math.trunc(Number(value));
  return { N: String(Number.isFinite(num) ? num : 0) };
}

function normalizeStatus(value, fallback) {
  return String(value || fallback).trim().toLowerCase();
}

function normalizeOrder(row) {
  const createdAt = row.created_at || new Date().toISOString();
  return {
    order_id: String(row.order_id || '').trim(),
    stripe_payment_intent_id: String(row.stripe_payment_intent_id || '').trim(),
    status: normalizeStatus(row.status, 'paid'),
    fulfillment_status: normalizeStatus(row.fulfillment_status, 'new'),
    amount_cents: Math.max(0, Math.trunc(Number(row.amount_cents) || 0)),
    items: Array.isArray(row.items) ? row.items : [],
    customer_email: String(row.customer_email || '').trim(),
    customer_name: String(row.customer_name || '').trim(),
    shipping_name: String(row.shipping_name || '').trim(),
    shipping_address1: String(row.shipping_address1 || '').trim(),
    shipping_address2: String(row.shipping_address2 || '').trim(),
    shipping_city: String(row.shipping_city || '').trim(),
    shipping_state: String(row.shipping_state || '').trim(),
    shipping_postal_code: String(row.shipping_postal_code || '').trim(),
    shipping_country: String(row.shipping_country || '').trim(),
    created_at: createdAt,
    updated_at: row.updated_at || createdAt,
    inventory_decremented: true,
    inventory_decrement_status: row.inventory_decrement_status || 'migrated',
  };
}

function normalizeSeedRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    throw new Error('Seed file must contain an array of order rows');
  }

  return rawRows.map(normalizeOrder).filter((row) => row.order_id);
}

function toDynamoItem(order) {
  const item = {
    order_id: { S: order.order_id },
    status: { S: order.status },
    fulfillment_status: { S: order.fulfillment_status },
    amount_cents: dynamoNumber(order.amount_cents),
    items_json: { S: JSON.stringify(order.items || []) },
    created_at: { S: order.created_at },
    updated_at: { S: order.updated_at },
    inventory_decremented: { BOOL: true },
    inventory_decrement_status: { S: order.inventory_decrement_status },
  };

  for (const field of [
    'stripe_payment_intent_id',
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
    const attr = dynamoString(order[field]);
    if (attr) item[field] = attr;
  }

  return item;
}

function isConditionalFailure(err) {
  return String(err?.message || err).toLowerCase().includes('conditional');
}

async function putOrderRow(tableName, row, overwrite) {
  const payload = {
    TableName: tableName,
    Item: toDynamoItem(row),
  };

  if (!overwrite) {
    payload.ConditionExpression = 'attribute_not_exists(#order_id)';
    payload.ExpressionAttributeNames = { '#order_id': 'order_id' };
  }

  try {
    await dynamoDbRequest('PutItem', payload);
    return 'upserted';
  } catch (err) {
    if (!overwrite && isConditionalFailure(err)) return 'skipped';
    throw err;
  }
}

async function main() {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  const { tableName, region } = getAwsConfig();

  if (!tableName) {
    console.error('Missing DYNAMODB_ORDERS_TABLE in .env.local');
    process.exit(1);
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found: ${SEED_PATH}`);
    console.error('Run npm run export:supabase-orders first.');
    process.exit(1);
  }

  const rows = normalizeSeedRows(JSON.parse(fs.readFileSync(SEED_PATH, 'utf8')));
  const totalCents = rows.reduce(
    (sum, row) => sum + Number(row.amount_cents || 0),
    0
  );

  console.log(`Seed file: ${SEED_PATH}`);
  console.log(`DynamoDB table: ${tableName}`);
  console.log(`Region: ${region}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Total historical amount: $${(totalCents / 100).toFixed(2)}`);
  console.log(`Existing DynamoDB orders: ${overwrite ? 'overwrite' : 'skip'}`);

  if (!apply) {
    console.log('Dry run only. Re-run with -- --apply to write to DynamoDB.');
    return;
  }

  let upserted = 0;
  let skipped = 0;

  for (const row of rows) {
    const result = await putOrderRow(tableName, row, overwrite);
    if (result === 'skipped') {
      skipped += 1;
      console.log(`Skipped existing ${row.order_id}`);
    } else {
      upserted += 1;
      console.log(`Upserted ${row.order_id}`);
    }
  }

  console.log(`DynamoDB orders seed complete. Upserted: ${upserted}. Skipped: ${skipped}.`);
}

main().catch((err) => {
  console.error('DynamoDB orders seed failed:', err.message);
  process.exitCode = 1;
});
