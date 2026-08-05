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

function readArgument(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? String(process.argv[index + 1] || '').trim() : '';
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

async function listPeopleForAccessAudit(tableName) {
  const people = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName,
      ProjectionExpression: '#person_id, #slug, #name, #role, #active',
      ExpressionAttributeNames: {
        '#person_id': 'person_id',
        '#slug': 'slug',
        '#name': 'name',
        '#role': 'role',
        '#active': 'active',
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });
    for (const item of response.Items || []) {
      people.push({
        person_id: item.person_id?.S || '',
        slug: item.slug?.S || '',
        name: item.name?.S || '',
        role: item.role?.S || '',
        active: item.active?.BOOL !== false,
      });
    }
    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return people;
}

function normalizePerson(person, index) {
  const slug = person.slug || String(person.name || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
  const role = [
    'host',
    'webmaster',
    'social_media_manager',
    'team',
    'producer',
  ].includes(person.role)
    ? person.role
    : 'host';

  return {
    person_id: slug,
    slug,
    role,
    name: person.name || '',
    title: person.title || '',
    roles: Array.isArray(person.roles) ? person.roles : [],
    studioRoles: Array.isArray(person.studioRoles) ? person.studioRoles : [],
    images: Array.isArray(person.images) ? person.images : [],
    bioShort: person.bioShort || '',
    bioFull: person.bioFull || '',
    active: person.active !== false,
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
    roles_json: { S: JSON.stringify(person.roles || []) },
    studio_roles_json: { S: JSON.stringify(person.studioRoles || []) },
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

  if (process.argv.includes('--audit-access-profiles')) {
    const [{ people: sourcePeople }, { auditStudioAccessRoster }] =
      await Promise.all([
        import('../src/data/people.js'),
        import('../lib/studioAccessRoster.mjs'),
      ]);
    const livePeople = await listPeopleForAccessAudit(tableName);
    const audit = auditStudioAccessRoster(sourcePeople, livePeople);

    console.log(`DynamoDB table: ${tableName}`);
    console.log(`Source roster profiles: ${sourcePeople.length}`);
    console.log(`Live backend profiles: ${livePeople.length}`);
    console.log(
      `Active connectable profiles: ${audit.activeLiveProfiles.length}`
    );
    if (audit.missingPersonIds.length) {
      console.log(
        `Missing backend profiles: ${audit.missingPersonIds.join(', ')}`
      );
      process.exitCode = 2;
    } else {
      console.log('Roster audit passed: every source profile exists in DynamoDB.');
    }
    return;
  }

  const lookupName = readArgument('--lookup-name');
  if (lookupName) {
    const response = await dynamoDbRequest('Scan', {
      TableName: tableName,
      ProjectionExpression:
        '#person_id, #name, #role, #studio_roles_json, #active',
      ExpressionAttributeNames: {
        '#person_id': 'person_id',
        '#name': 'name',
        '#role': 'role',
        '#studio_roles_json': 'studio_roles_json',
        '#active': 'active',
      },
    });
    const normalizedLookup = lookupName.toLowerCase();
    const matches = (response.Items || [])
      .map((item) => ({
        person_id: item.person_id?.S || '',
        name: item.name?.S || '',
        role: item.role?.S || '',
        studioRoles: JSON.parse(item.studio_roles_json?.S || '[]'),
        active: item.active?.BOOL !== false,
      }))
      .filter(
        (person) =>
          person.person_id.toLowerCase().includes(normalizedLookup) ||
          person.name.toLowerCase().includes(normalizedLookup)
      );
    console.log(`DynamoDB table: ${tableName}`);
    console.log(`Matching people: ${matches.length}`);
    matches.forEach((person) =>
      console.log(
        `${person.person_id}: ${person.name} (${person.role}; ${person.studioRoles.join(', ') || 'no Studio roles'}; ${person.active ? 'active' : 'inactive'})`
      )
    );
    return;
  }

  const upsertStaticPersonId = readArgument('--upsert-static-person');
  if (upsertStaticPersonId) {
    const { people } = await import('../src/data/people.js');
    const sourceIndex = people.findIndex(
      (person) => person.slug === upsertStaticPersonId
    );
    if (sourceIndex < 0) {
      throw new Error(
        `No static People record found for "${upsertStaticPersonId}".`
      );
    }
    const row = normalizePerson(people[sourceIndex], sourceIndex);

    console.log(`DynamoDB table: ${tableName}`);
    console.log(`Region: ${region}`);
    console.log(
      `Targeted person: ${row.name} (${row.person_id}) -> ${row.studioRoles.join(', ')}`
    );
    if (!apply) {
      console.log(
        'Dry run only. Re-run with --apply to create this one person if missing.'
      );
      return;
    }

    const existing = await dynamoDbRequest('GetItem', {
      TableName: tableName,
      Key: { person_id: { S: row.person_id } },
      ConsistentRead: true,
    });
    if (existing.Item) {
      console.log(`${row.person_id} already exists; no changes made.`);
      return;
    }

    await dynamoDbRequest('PutItem', {
      TableName: tableName,
      Item: toDynamoItem(row),
      ConditionExpression: 'attribute_not_exists(#person_id)',
      ExpressionAttributeNames: { '#person_id': 'person_id' },
    });
    console.log(`Created ${row.name}`);
    return;
  }

  const syncStaticPersonId = readArgument('--sync-static-person');
  if (syncStaticPersonId) {
    const { people } = await import('../src/data/people.js');
    const sourceIndex = people.findIndex(
      (person) => person.slug === syncStaticPersonId
    );
    if (sourceIndex < 0) {
      throw new Error(
        `No static People record found for "${syncStaticPersonId}".`
      );
    }
    const row = normalizePerson(people[sourceIndex], sourceIndex);

    console.log(`DynamoDB table: ${tableName}`);
    console.log(`Region: ${region}`);
    console.log(
      `Targeted static sync: ${row.name} (${row.person_id}) -> ${
        row.active ? 'active' : 'inactive'
      }; ${row.studioRoles.join(', ') || 'no Studio roles'}`
    );
    if (!apply) {
      console.log(
        'Dry run only. Re-run with --apply to replace this existing person with the static record.'
      );
      return;
    }

    await dynamoDbRequest('PutItem', {
      TableName: tableName,
      Item: toDynamoItem(row),
      ConditionExpression: 'attribute_exists(#person_id)',
      ExpressionAttributeNames: { '#person_id': 'person_id' },
    });
    console.log(`Synced ${row.name}`);
    return;
  }

  const targetPersonId = readArgument('--person');
  const nameArgument = readArgument('--name');
  const activeArgument = readArgument('--active');
  const studioRolesArgument = readArgument('--studio-roles');
  if (
    targetPersonId ||
    nameArgument ||
    studioRolesArgument ||
    activeArgument
  ) {
    if (
      !targetPersonId ||
      (!nameArgument && !studioRolesArgument && !activeArgument)
    ) {
      throw new Error(
        'Use --person <person-id> with --name <display-name>, --studio-roles <host,producer>, --active <true|false>, or a combination.'
      );
    }
    let studioRoles = null;
    if (studioRolesArgument) {
      const supportedRoles = new Set(['host', 'producer']);
      studioRoles = [
        ...new Set(
          studioRolesArgument
            .split(',')
            .map((role) => role.trim().toLowerCase())
            .filter(Boolean)
        ),
      ];
      if (
        !studioRoles.length ||
        studioRoles.some((role) => !supportedRoles.has(role))
      ) {
        throw new Error('Studio roles must be host, producer, or both.');
      }
    }
    let active = null;
    if (activeArgument) {
      if (!['true', 'false'].includes(activeArgument.toLowerCase())) {
        throw new Error('Active must be true or false.');
      }
      active = activeArgument.toLowerCase() === 'true';
    }

    console.log(`DynamoDB table: ${tableName}`);
    console.log(`Region: ${region}`);
    if (nameArgument) {
      console.log(
        `Targeted display name: ${targetPersonId} -> ${nameArgument}`
      );
    }
    if (studioRoles) {
      console.log(
        `Targeted Studio roles: ${targetPersonId} -> ${studioRoles.join(', ')}`
      );
    }
    if (active !== null) {
      console.log(
        `Targeted website visibility: ${targetPersonId} -> ${active ? 'active' : 'inactive'}`
      );
    }
    if (!apply) {
      console.log('Dry run only. Re-run with --apply to update this one person.');
      return;
    }

    const updates = [];
    const names = {
      '#person_id': 'person_id',
      '#updated_at': 'updated_at',
    };
    const values = {
      ':updated_at': { S: new Date().toISOString() },
    };
    if (nameArgument) {
      updates.push('#name = :name');
      names['#name'] = 'name';
      values[':name'] = { S: nameArgument };
    }
    if (studioRoles) {
      updates.push('#studio_roles_json = :studio_roles_json');
      names['#studio_roles_json'] = 'studio_roles_json';
      values[':studio_roles_json'] = { S: JSON.stringify(studioRoles) };
    }
    if (active !== null) {
      updates.push('#active = :active');
      names['#active'] = 'active';
      values[':active'] = { BOOL: active };
    }
    updates.push('#updated_at = :updated_at');

    await dynamoDbRequest('UpdateItem', {
      TableName: tableName,
      Key: { person_id: { S: targetPersonId } },
      UpdateExpression: `SET ${updates.join(', ')}`,
      ConditionExpression: 'attribute_exists(#person_id)',
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: values,
    });
    console.log(`Updated ${targetPersonId}`);
    return;
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
