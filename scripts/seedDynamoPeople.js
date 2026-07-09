// Seeds the DynamoDB people table from src/data/people.js.
// By default this is a dry run. Pass --apply to write to DynamoDB.
require('dotenv').config({ path: '.env.local' });

const crypto = require('crypto');

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
    tableName: readEnv('DYNAMODB_PEOPLE_TABLE'),
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
  const now = new Date();
  const amzDate = toAmzDate(now);
  const dateStamp = amzDate.slice(0, 8);
  const payload = JSON.stringify(body || {});
  const headers = {
    'content-type': 'application/x-amz-json-1.0',
    host,
    'x-amz-date': amzDate,
    'x-amz-target': `DynamoDB_20120810.${action}`,
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

  const response = await fetch(`https://${host}/`, {
    method: 'POST',
    headers: { ...headers, Authorization: authorization },
    body: payload,
  });
  const text = await response.text();
  const data = text ? JSON.parse(text) : {};

  if (!response.ok) {
    throw new Error(data.message || data.__type || 'DynamoDB request failed');
  }

  return data;
}

function normalizePerson(person, index) {
  const slug = person.slug || String(person.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');

  return {
    person_id: slug,
    slug,
    role: person.role === 'producer' ? 'producer' : 'host',
    name: person.name || '',
    title: person.title || '',
    images: Array.isArray(person.images) ? person.images : [],
    bioShort: person.bioShort || '',
    bioFull: person.bioFull || '',
    active: true,
    needsBio: person.needsBio === true,
    needsImages: person.needsImages === true,
    sort_order: index,
    updated_at: new Date().toISOString(),
  };
}

function toDynamoItem(person) {
  return {
    person_id: { S: person.person_id },
    slug: { S: person.slug },
    role: { S: person.role },
    name: { S: person.name },
    title: { S: person.title },
    images_json: { S: JSON.stringify(person.images || []) },
    bio_short: { S: person.bioShort },
    bio_full: { S: person.bioFull },
    active: { BOOL: person.active },
    needs_bio: { BOOL: person.needsBio },
    needs_images: { BOOL: person.needsImages },
    sort_order: { N: String(person.sort_order) },
    updated_at: { S: person.updated_at },
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const { tableName, region } = getAwsConfig();

  if (!tableName) {
    console.error('Missing DYNAMODB_PEOPLE_TABLE in .env.local');
    process.exit(1);
  }

  const { people } = await import('../src/data/people.js');
  const rows = people.map(normalizePerson);

  console.log(`DynamoDB table: ${tableName}`);
  console.log(`Region: ${region}`);
  console.log(`People rows: ${rows.length}`);

  if (!apply) {
    console.log('Dry run only. Re-run with --apply to write rows.');
    rows.forEach((row) =>
      console.log(`${row.sort_order}: ${row.name} (${row.role}) -> ${row.slug}`)
    );
    return;
  }

  for (const row of rows) {
    await dynamoDbRequest('PutItem', {
      TableName: tableName,
      Item: toDynamoItem(row),
    });
    console.log(`Seeded ${row.name}`);
  }
}

main().catch((err) => {
  console.error(err.message);
  process.exit(1);
});
