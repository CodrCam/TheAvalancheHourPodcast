import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';
import { people as staticPeople } from '../src/data/people';
import {
  isAllowedSelfProfileImage,
  MAX_PERSON_IMAGES,
} from './peoplePresentation.mjs';

const ROLE_ORDER = {
  host: 0,
  webmaster: 1,
  social_media_manager: 2,
  team: 3,
  producer: 4,
};
const MAX_STORED_IMAGE_LENGTH = 300000;

function getPeopleTableName() {
  return process.env.DYNAMODB_PEOPLE_TABLE || '';
}

export function isDynamoPeopleConfigured() {
  return !!getPeopleTableName();
}

function assertDynamoPeopleReady() {
  if (!isDynamoPeopleConfigured()) {
    throw new Error('DYNAMODB_PEOPLE_TABLE is not configured on the server');
  }
  if (!isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }
}

export function slugifyPerson(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeRole(value) {
  const role = String(value || '').trim().toLowerCase().replace(/[\s-]+/g, '_');
  if (role === 'producer') return 'producer';
  if (role === 'team' || role === 'staff') return 'team';
  if (role === 'webmaster' || role === 'web_master') return 'webmaster';
  if (role === 'social_media_manager' || role === 'social_media') {
    return 'social_media_manager';
  }
  return 'host';
}

function normalizeRoles(value) {
  if (Array.isArray(value)) {
    return value.map((role) => String(role || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeRoles(parsed);
    } catch {
      // Fall back to comma/newline-separated labels.
    }

    return trimmed
      .split(/[\n,]+/)
      .map((role) => role.trim())
      .filter(Boolean);
  }

  return [];
}

function normalizeStudioRoles(value) {
  const supported = new Set(['host', 'producer']);
  const values = Array.isArray(value)
    ? value
    : typeof value === 'string'
      ? (() => {
          const trimmed = value.trim();
          if (!trimmed) return [];
          try {
            const parsed = JSON.parse(trimmed);
            if (Array.isArray(parsed)) return parsed;
          } catch {
            // Fall back to comma/newline-separated values.
          }
          return trimmed.split(/[\n,]+/);
        })()
      : [];

  return [
    ...new Set(
      values
        .map((role) =>
          String(role || '').trim().toLowerCase().replace(/[\s-]+/g, '_')
        )
        .filter((role) => supported.has(role))
    ),
  ];
}

function normalizeImages(value) {
  if (Array.isArray(value)) {
    return value.map((image) => String(image || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeImages(parsed);
    } catch {
      // Fall back to newline-separated values.
    }

    return trimmed
      .split(/\r?\n/)
      .map((image) => image.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizePerson(value = {}, index = 0) {
  const name = String(value.name || '').trim();
  const slug = String(value.slug || value.person_id || slugifyPerson(name)).trim();
  const personId = String(value.person_id || slug).trim();
  const sortOrder = Number.isFinite(Number(value.sort_order))
    ? Math.trunc(Number(value.sort_order))
    : index;

  return {
    person_id: personId,
    slug,
    role: normalizeRole(value.role),
    name,
    title: String(value.title || '').trim(),
    roles: normalizeRoles(value.roles || value.roles_json),
    studioRoles: normalizeStudioRoles(
      value.studioRoles || value.studio_roles || value.studio_roles_json
    ),
    images: normalizeImages(value.images || value.images_json),
    bioShort: String(value.bioShort || value.bio_short || '').trim(),
    bioFull: String(value.bioFull || value.bio_full || '').trim(),
    active: value.active === false || value.active === 'false' ? false : true,
    needsBio: value.needsBio === true || value.needs_bio === true,
    needsImages: value.needsImages === true || value.needs_images === true,
    sort_order: sortOrder,
    updated_at: value.updated_at || '',
  };
}

function staticPeopleRows() {
  return staticPeople.map((person, index) =>
    normalizePerson({ ...person, sort_order: index }, index)
  );
}

function fromDynamoItem(item = {}) {
  return normalizePerson({
    person_id: item.person_id?.S,
    slug: item.slug?.S,
    role: item.role?.S,
    name: item.name?.S,
    title: item.title?.S,
    roles_json: item.roles_json?.S,
    studio_roles_json: item.studio_roles_json?.S,
    images_json: item.images_json?.S,
    bio_short: item.bio_short?.S,
    bio_full: item.bio_full?.S,
    active: item.active?.BOOL,
    needs_bio: item.needs_bio?.BOOL,
    needs_images: item.needs_images?.BOOL,
    sort_order: item.sort_order?.N,
    updated_at: item.updated_at?.S || '',
  });
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
    updated_at: { S: person.updated_at || new Date().toISOString() },
  };
}

function sortPeople(a, b) {
  return (
    (ROLE_ORDER[a.role] ?? 99) - (ROLE_ORDER[b.role] ?? 99) ||
    a.sort_order - b.sort_order ||
    a.name.localeCompare(b.name)
  );
}

async function listPeopleFromDynamo() {
  const rows = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: getPeopleTableName(),
      ProjectionExpression:
        '#id, #slug, #role, #name, #title, #roles_json, #studio_roles_json, #images_json, #bio_short, #bio_full, #active, #needs_bio, #needs_images, #sort_order, #updated_at',
      ExpressionAttributeNames: {
        '#id': 'person_id',
        '#slug': 'slug',
        '#role': 'role',
        '#name': 'name',
        '#title': 'title',
        '#roles_json': 'roles_json',
        '#studio_roles_json': 'studio_roles_json',
        '#images_json': 'images_json',
        '#bio_short': 'bio_short',
        '#bio_full': 'bio_full',
        '#active': 'active',
        '#needs_bio': 'needs_bio',
        '#needs_images': 'needs_images',
        '#sort_order': 'sort_order',
        '#updated_at': 'updated_at',
      },
      ...(exclusiveStartKey ? { ExclusiveStartKey: exclusiveStartKey } : {}),
    });

    for (const item of response.Items || []) {
      rows.push(fromDynamoItem(item));
    }

    exclusiveStartKey = response.LastEvaluatedKey;
  } while (exclusiveStartKey);

  return rows.sort(sortPeople);
}

export async function listPeople(options = {}) {
  const allowStaticFallback = options.allowStaticFallback !== false;
  const includeInactive = options.includeInactive === true;

  if (!isDynamoPeopleConfigured()) {
    if (allowStaticFallback) {
      const people = staticPeopleRows().sort(sortPeople);
      return {
        people: includeInactive ? people : people.filter((person) => person.active),
        source: 'static',
        configured: false,
      };
    }
    assertDynamoPeopleReady();
  }

  assertDynamoPeopleReady();
  const people = await listPeopleFromDynamo();
  const visiblePeople = people.filter((person) => person.active);

  if (
    allowStaticFallback &&
    (!people.length || (!includeInactive && !visiblePeople.length))
  ) {
    const fallbackPeople = staticPeopleRows().sort(sortPeople);
    return {
      people: includeInactive
        ? fallbackPeople
        : fallbackPeople.filter((person) => person.active),
      source: 'static',
      configured: true,
    };
  }

  return {
    people: includeInactive ? people : visiblePeople,
    source: 'dynamo',
    configured: true,
  };
}

export async function getPersonBySlug(slug, options = {}) {
  const cleanSlug = String(slug || '').trim();
  if (!cleanSlug) return null;

  const result = await listPeople({
    allowStaticFallback: options.allowStaticFallback !== false,
    includeInactive: options.includeInactive === true,
  });
  const staticFallback =
    options.allowStaticFallback === false
      ? null
      : staticPeopleRows().find(
          (person) =>
            person.slug === cleanSlug &&
            (options.includeInactive === true || person.active)
        ) || null;

  return {
    person:
      result.people.find((person) => person.slug === cleanSlug) ||
      staticFallback ||
      null,
    source: result.source,
    configured: result.configured,
  };
}

export async function savePerson(value = {}) {
  assertDynamoPeopleReady();

  const sortOrder = Number.isFinite(Number(value.sort_order))
    ? Math.trunc(Number(value.sort_order))
    : Date.now();
  const person = normalizePerson({
    ...value,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  });

  if (!person.person_id || !person.slug || !person.name) {
    throw new Error('Person name and slug are required');
  }

  if ((person.images || []).length > MAX_PERSON_IMAGES) {
    throw new Error(
      `Each team profile can have up to ${MAX_PERSON_IMAGES} photos.`
    );
  }

  const oversizedImage = (person.images || []).find(
    (image) => image.startsWith('data:') && image.length > MAX_STORED_IMAGE_LENGTH
  );
  if (oversizedImage) {
    throw new Error('One team image is too large. Please upload a smaller image.');
  }

  await dynamoDbRequest('PutItem', {
    TableName: getPeopleTableName(),
    Item: toDynamoItem(person),
  });

  return person;
}

export async function updatePersonSelfProfile(personId, value = {}) {
  assertDynamoPeopleReady();
  const cleanPersonId = String(personId || '').trim();
  if (!cleanPersonId) throw new Error('Person id is required');

  const images = normalizeImages(value.images).slice(0, MAX_PERSON_IMAGES);
  if (images.some((image) => !isAllowedSelfProfileImage(image))) {
    throw new Error(
      'Profile photos must be uploaded images or site paths under /images/.'
    );
  }
  const imageBytes = Buffer.byteLength(JSON.stringify(images), 'utf8');
  if (imageBytes > 330000) {
    throw new Error(
      'The combined profile photos are too large. Remove or resize a photo.'
    );
  }

  const bioShort = String(value.bioShort || '').trim().slice(0, 1200);
  const bioFull = String(value.bioFull || '').trim().slice(0, 12000);
  const updatedAt = new Date().toISOString();
  const response = await dynamoDbRequest('UpdateItem', {
    TableName: getPeopleTableName(),
    Key: { person_id: { S: cleanPersonId } },
    UpdateExpression:
      'SET #bio_short = :bio_short, #bio_full = :bio_full, #images_json = :images_json, #needs_bio = :needs_bio, #needs_images = :needs_images, #updated_at = :updated_at',
    ConditionExpression: 'attribute_exists(#person_id)',
    ExpressionAttributeNames: {
      '#person_id': 'person_id',
      '#bio_short': 'bio_short',
      '#bio_full': 'bio_full',
      '#images_json': 'images_json',
      '#needs_bio': 'needs_bio',
      '#needs_images': 'needs_images',
      '#updated_at': 'updated_at',
    },
    ExpressionAttributeValues: {
      ':bio_short': { S: bioShort },
      ':bio_full': { S: bioFull },
      ':images_json': { S: JSON.stringify(images) },
      ':needs_bio': { BOOL: !bioShort || !bioFull },
      ':needs_images': { BOOL: images.length === 0 },
      ':updated_at': { S: updatedAt },
    },
    ReturnValues: 'ALL_NEW',
  });

  return fromDynamoItem(response.Attributes || {});
}

export async function deletePerson(personId) {
  assertDynamoPeopleReady();
  const cleanId = String(personId || '').trim();
  if (!cleanId) throw new Error('Person id is required');

  await dynamoDbRequest('DeleteItem', {
    TableName: getPeopleTableName(),
    Key: { person_id: { S: cleanId } },
  });

  return { person_id: cleanId };
}

export function getStaticPeopleSeed() {
  return staticPeopleRows();
}
