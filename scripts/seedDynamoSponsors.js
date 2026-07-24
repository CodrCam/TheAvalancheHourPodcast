// Seeds the DynamoDB sponsors table from src/data/sponsors.js.
// By default this is a dry run. --apply creates missing rows; add --overwrite
// only when intentionally replacing existing admin-managed sponsor records.
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
    tableName: readEnv('DYNAMODB_SPONSORS_TABLE'),
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

function normalizeSponsor(sponsor, index) {
  return {
    sponsor_id: sponsor.id,
    name: sponsor.name,
    tier: sponsor.tier === 'friend' ? 'friend' : sponsor.tier,
    url: sponsor.url || '',
    logo: sponsor.logo || '',
    promo_code: sponsor.promo_code || '',
    promo_details: sponsor.promo_details || '',
    active: true,
    episode_ids: Array.isArray(sponsor.episode_ids) ? sponsor.episode_ids : [],
    sort_order: index,
    updated_at: new Date().toISOString(),
  };
}

function toDynamoItem(sponsor) {
  return {
    sponsor_id: { S: sponsor.sponsor_id },
    name: { S: sponsor.name },
    tier: { S: sponsor.tier },
    url: { S: sponsor.url },
    logo: { S: sponsor.logo },
    promo_code: { S: sponsor.promo_code },
    promo_details: { S: sponsor.promo_details },
    active: { BOOL: sponsor.active },
    episode_ids_json: { S: JSON.stringify(sponsor.episode_ids || []) },
    sort_order: { N: String(sponsor.sort_order) },
    updated_at: { S: sponsor.updated_at },
  };
}

async function main() {
  const apply = process.argv.includes('--apply');
  const overwrite = process.argv.includes('--overwrite');
  const { tableName, region } = getAwsConfig();

  if (!tableName) {
    console.error('Missing DYNAMODB_SPONSORS_TABLE in .env.local');
    process.exit(1);
  }

  const { sponsors } = await import('../src/data/sponsors.js');
  const rows = [
    ...sponsors.legacy,
    ...sponsors.partner,
    ...sponsors.friends,
  ].map(normalizeSponsor);

  console.log(`DynamoDB table: ${tableName}`);
  console.log(`Region: ${region}`);
  console.log(`Sponsor rows: ${rows.length}`);

  if (!apply) {
    console.log('Dry run only. Re-run with -- --apply to write to DynamoDB.');
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    try {
      await dynamoDbRequest('PutItem', {
        TableName: tableName,
        Item: toDynamoItem(row),
        ...(!overwrite
          ? {
              ConditionExpression: 'attribute_not_exists(#id)',
              ExpressionAttributeNames: { '#id': 'sponsor_id' },
            }
          : {}),
      });
      created += 1;
    } catch (err) {
      if (!overwrite && /conditional/i.test(String(err.message || ''))) {
        skipped += 1;
        continue;
      }
      throw err;
    }
  }

  console.log(
    `DynamoDB sponsors seed complete. Created ${created}; preserved ${skipped} existing sponsors.`
  );
}

main().catch((err) => {
  console.error('DynamoDB sponsors seed failed:', err.message);
  process.exitCode = 1;
});
