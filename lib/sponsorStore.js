import { dynamoDbRequest, isDynamoCredentialsConfigured } from './dynamoDb';
import { sponsors, sponsorsById } from '../src/data/sponsors';

const TIER_ORDER = {
  legacy: 0,
  partner: 1,
  friend: 2,
  episode: 3,
};
const MAX_STORED_LOGO_LENGTH = 320000;

function getSponsorsTableName() {
  return process.env.DYNAMODB_SPONSORS_TABLE || '';
}

export function isDynamoSponsorsConfigured() {
  return !!getSponsorsTableName();
}

function assertDynamoSponsorsReady() {
  if (!isDynamoSponsorsConfigured()) {
    throw new Error('DYNAMODB_SPONSORS_TABLE is not configured on the server');
  }
  if (!isDynamoCredentialsConfigured()) {
    throw new Error('AWS credentials are not configured for DynamoDB');
  }
}

function slugify(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function normalizeTier(value) {
  const tier = String(value || '').trim().toLowerCase();
  return ['legacy', 'partner', 'friend', 'episode'].includes(tier)
    ? tier
    : 'partner';
}

function normalizeEpisodeIds(value) {
  if (Array.isArray(value)) {
    return value.map((id) => String(id || '').trim()).filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();
    if (!trimmed) return [];

    try {
      const parsed = JSON.parse(trimmed);
      if (Array.isArray(parsed)) return normalizeEpisodeIds(parsed);
    } catch {
      // Fall back to comma-separated values.
    }

    return trimmed
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
  }

  return [];
}

export function normalizeSponsor(value = {}, index = 0) {
  const name = String(value.name || '').trim();
  const sponsorId = String(value.sponsor_id || value.id || slugify(name)).trim();
  const tier = normalizeTier(value.tier);

  return {
    id: sponsorId,
    sponsor_id: sponsorId,
    name,
    tier,
    url: String(value.url || '').trim(),
    logo: String(value.logo || '').trim(),
    active: value.active === false || value.active === 'false' ? false : true,
    episode_ids: normalizeEpisodeIds(value.episode_ids || value.episode_ids_json),
    sort_order: Number.isFinite(Number(value.sort_order))
      ? Math.trunc(Number(value.sort_order))
      : index,
    updated_at: value.updated_at || '',
  };
}

function staticSponsors() {
  return Object.values(sponsorsById).map((sponsor, index) =>
    normalizeSponsor({ ...sponsor, active: true, sort_order: index }, index)
  );
}

function fromDynamoItem(item = {}) {
  return normalizeSponsor({
    sponsor_id: item.sponsor_id?.S,
    name: item.name?.S,
    tier: item.tier?.S,
    url: item.url?.S,
    logo: item.logo?.S,
    active: item.active?.BOOL,
    episode_ids_json: item.episode_ids_json?.S,
    sort_order: item.sort_order?.N,
    updated_at: item.updated_at?.S || '',
  });
}

function toDynamoItem(sponsor) {
  return {
    sponsor_id: { S: sponsor.sponsor_id },
    name: { S: sponsor.name },
    tier: { S: sponsor.tier },
    url: { S: sponsor.url },
    logo: { S: sponsor.logo },
    active: { BOOL: sponsor.active },
    episode_ids_json: { S: JSON.stringify(sponsor.episode_ids || []) },
    sort_order: { N: String(sponsor.sort_order) },
    updated_at: { S: sponsor.updated_at || new Date().toISOString() },
  };
}

function sortSponsors(a, b) {
  return (
    (TIER_ORDER[a.tier] ?? 99) - (TIER_ORDER[b.tier] ?? 99) ||
    a.sort_order - b.sort_order ||
    a.name.localeCompare(b.name)
  );
}

export function groupSponsorsByTier(items = []) {
  return {
    legacy: items.filter((sponsor) => sponsor.tier === 'legacy'),
    partner: items.filter((sponsor) => sponsor.tier === 'partner'),
    friends: items.filter((sponsor) => sponsor.tier === 'friend'),
    episode: items.filter((sponsor) => sponsor.tier === 'episode'),
  };
}

async function listSponsorsFromDynamo() {
  const rows = [];
  let exclusiveStartKey;

  do {
    const response = await dynamoDbRequest('Scan', {
      TableName: getSponsorsTableName(),
      ProjectionExpression:
        '#id, #name, #tier, #url, #logo, #active, #episode_ids_json, #sort_order, #updated_at',
      ExpressionAttributeNames: {
        '#id': 'sponsor_id',
        '#name': 'name',
        '#tier': 'tier',
        '#url': 'url',
        '#logo': 'logo',
        '#active': 'active',
        '#episode_ids_json': 'episode_ids_json',
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

  return rows.sort(sortSponsors);
}

export async function listSponsors(options = {}) {
  const allowStaticFallback = options.allowStaticFallback !== false;

  if (!isDynamoSponsorsConfigured()) {
    if (allowStaticFallback) {
      return {
        sponsors: staticSponsors().sort(sortSponsors),
        source: 'static',
        configured: false,
      };
    }
    assertDynamoSponsorsReady();
  }

  assertDynamoSponsorsReady();
  return {
    sponsors: await listSponsorsFromDynamo(),
    source: 'dynamo',
    configured: true,
  };
}

export async function saveSponsor(value = {}) {
  assertDynamoSponsorsReady();

  const sortOrder = Number.isFinite(Number(value.sort_order))
    ? Math.trunc(Number(value.sort_order))
    : Date.now();

  const sponsor = normalizeSponsor({
    ...value,
    sort_order: sortOrder,
    updated_at: new Date().toISOString(),
  });

  if (!sponsor.sponsor_id || !sponsor.name) {
    throw new Error('Sponsor name is required');
  }

  if (sponsor.logo.length > MAX_STORED_LOGO_LENGTH) {
    throw new Error('Sponsor logo is too large. Please use a smaller image.');
  }

  await dynamoDbRequest('PutItem', {
    TableName: getSponsorsTableName(),
    Item: toDynamoItem(sponsor),
  });

  return sponsor;
}

export async function deleteSponsor(sponsorId) {
  assertDynamoSponsorsReady();
  const cleanId = String(sponsorId || '').trim();
  if (!cleanId) throw new Error('Sponsor id is required');

  await dynamoDbRequest('DeleteItem', {
    TableName: getSponsorsTableName(),
    Key: { sponsor_id: { S: cleanId } },
  });

  return { sponsor_id: cleanId };
}

export function getStaticSponsorSeed() {
  return [
    ...sponsors.legacy,
    ...sponsors.partner,
    ...sponsors.friends,
  ].map((sponsor, index) =>
    normalizeSponsor({ ...sponsor, active: true, sort_order: index }, index)
  );
}
