const SEASON_STATUSES = new Set([
  'planning',
  'active',
  'complete',
  'archived',
]);

export const SEASON_OVERVIEW_PLAN_STATUSES = Object.freeze([
  'idea',
  'researching',
  'ready',
  'scheduled',
  'recording',
  'published',
]);

export const SEASON_OVERVIEW_EPISODE_TYPES = Object.freeze([
  'regular',
  'slabs_and_sluffs',
  'special',
]);

function cleanText(value, maximum) {
  return String(value ?? '')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maximum);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : '';
}

function count(value) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed <= 0) return 0;
  return Math.min(Number.MAX_SAFE_INTEGER, Math.trunc(parsed));
}

function countMap(value, allowedKeys) {
  const source = value && typeof value === 'object' ? value : {};
  return Object.fromEntries(
    allowedKeys.map((key) => [key, count(source[key])])
  );
}

function sumCounts(value) {
  return Object.values(value).reduce((total, current) => total + current, 0);
}

function normalizeSeason(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const label = cleanText(value.label, 80);
  const startsOn = cleanDate(value.starts_on);
  const endsOn = cleanDate(value.ends_on);
  const status = cleanText(value.status, 20);
  if (
    !label ||
    !startsOn ||
    !endsOn ||
    endsOn < startsOn ||
    !SEASON_STATUSES.has(status) ||
    status === 'archived'
  ) {
    return null;
  }
  return {
    label,
    starts_on: startsOn,
    ends_on: endsOn,
    status,
    planning_goal: cleanText(value.planning_goal, 2400),
  };
}

export function normalizeSeasonMastermindOverview(value = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const planningSource =
    source.planning &&
    typeof source.planning === 'object' &&
    !Array.isArray(source.planning)
      ? source.planning
      : {};
  const byStatus = countMap(
    planningSource.by_status,
    SEASON_OVERVIEW_PLAN_STATUSES
  );
  const byType = countMap(
    planningSource.by_type,
    SEASON_OVERVIEW_EPISODE_TYPES
  );
  const total = Math.max(
    count(planningSource.total),
    sumCounts(byStatus),
    sumCounts(byType)
  );

  return {
    season: normalizeSeason(source.season),
    planning: {
      total,
      undated: Math.min(total, count(planningSource.undated)),
      by_status: byStatus,
      by_type: byType,
    },
  };
}
