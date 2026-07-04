// Seeds DynamoDB inventory from data/dynamodb-inventory-seed.json.
// By default this is a dry run. Pass --apply to write to DynamoDB.
require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const SEED_PATH = path.join(
  process.cwd(),
  'data',
  'dynamodb-inventory-seed.json'
);

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

function getAwsConfig() {
  return {
    region:
      process.env.DYNAMODB_REGION ||
      process.env.AWS_REGION ||
      process.env.COGNITO_REGION ||
      'us-east-2',
    tableName: process.env.DYNAMODB_INVENTORY_TABLE,
    accessKeyId:
      process.env.DYNAMODB_ACCESS_KEY_ID || process.env.AWS_ACCESS_KEY_ID,
    secretAccessKey:
      process.env.DYNAMODB_SECRET_ACCESS_KEY || process.env.AWS_SECRET_ACCESS_KEY,
    sessionToken:
      process.env.DYNAMODB_SESSION_TOKEN || process.env.AWS_SESSION_TOKEN,
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
    throw new Error('AWS access key env vars are missing');
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
    throw new Error(message);
  }

  return data;
}

function normalizeSeedRows(rawRows) {
  if (!Array.isArray(rawRows)) {
    throw new Error('Seed file must contain an array of inventory rows');
  }

  return rawRows
    .map((row) => ({
      sku: String(row.sku || '').trim(),
      quantity: Math.max(0, Number(row.quantity) || 0),
      updated_at: row.updated_at || new Date().toISOString(),
    }))
    .filter((row) => row.sku);
}

async function putInventoryRow(tableName, row) {
  await dynamoDbRequest('PutItem', {
    TableName: tableName,
    Item: {
      sku: { S: row.sku },
      quantity: { N: String(row.quantity) },
      updated_at: { S: row.updated_at },
    },
  });
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { tableName, region } = getAwsConfig();

  if (!tableName) {
    console.error('Missing DYNAMODB_INVENTORY_TABLE in .env.local');
    process.exit(1);
  }

  if (!fs.existsSync(SEED_PATH)) {
    console.error(`Seed file not found: ${SEED_PATH}`);
    console.error('Run npm run export:supabase-inventory first.');
    process.exit(1);
  }

  const rows = normalizeSeedRows(
    JSON.parse(fs.readFileSync(SEED_PATH, 'utf8'))
  );
  const totalQuantity = rows.reduce(
    (sum, row) => sum + Number(row.quantity || 0),
    0
  );

  console.log(`Seed file: ${SEED_PATH}`);
  console.log(`DynamoDB table: ${tableName}`);
  console.log(`Region: ${region}`);
  console.log(`Rows: ${rows.length}`);
  console.log(`Total quantity: ${totalQuantity}`);

  if (!apply) {
    console.log('Dry run only. Re-run with -- --apply to write to DynamoDB.');
    return;
  }

  for (const row of rows) {
    await putInventoryRow(tableName, row);
    console.log(`Upserted ${row.sku} = ${row.quantity}`);
  }

  console.log('DynamoDB inventory seed complete.');
}

main().catch((err) => {
  console.error('DynamoDB inventory seed failed:', err.message);
  process.exitCode = 1;
});
