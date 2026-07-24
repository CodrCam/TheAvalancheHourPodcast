export const SPONSOR_TIER_IDS = [
  'legacy',
  'partner',
  'friend',
  'episode',
];

export function slugifySponsorId(value = '') {
  return String(value)
    .toLowerCase()
    .trim()
    .replace(/&/g, 'and')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function updateSponsorDraft(current = {}, patch = {}) {
  const next = { ...current, ...patch };

  if (
    Object.prototype.hasOwnProperty.call(patch, 'name') &&
    !current.id_manually_edited
  ) {
    const sponsorId = slugifySponsorId(patch.name);
    next.sponsor_id = sponsorId;
    next.id = sponsorId;
  }
  if (Object.prototype.hasOwnProperty.call(patch, 'sponsor_id')) {
    next.id = patch.sponsor_id;
  }

  return next;
}

export function normalizeSponsorTier(value) {
  return SPONSOR_TIER_IDS.includes(value) ? value : 'partner';
}

function getSortOrder(sponsor = {}) {
  const value = Number(sponsor.sort_order);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function sortSponsorsForTier(sponsors = []) {
  return [...sponsors].sort(
    (left, right) =>
      getSortOrder(left) - getSortOrder(right) ||
      String(left.name || '').localeCompare(String(right.name || ''))
  );
}

export function groupSponsorsForDisplay(sponsors = []) {
  const grouped = {
    legacy: [],
    partner: [],
    friend: [],
    episode: [],
  };

  for (const sponsor of sponsors) {
    grouped[normalizeSponsorTier(sponsor.tier)].push(sponsor);
  }

  for (const tier of SPONSOR_TIER_IDS) {
    grouped[tier] = sortSponsorsForTier(grouped[tier]);
  }

  return grouped;
}

export function extractSpotifyEpisodeId(value = '') {
  const text = String(value || '').trim();
  if (!text) return '';

  const validId = (candidate) =>
    /^[a-z0-9]{6,64}$/i.test(String(candidate || ''))
      ? String(candidate)
      : '';
  const spotifyUri = text.match(/^spotify:episode:([a-z0-9]+)$/i);
  if (spotifyUri) return validId(spotifyUri[1]);

  try {
    const url = new URL(text);
    if (
      !['http:', 'https:'].includes(url.protocol) ||
      url.hostname.toLowerCase() !== 'open.spotify.com'
    ) {
      return '';
    }

    const segments = url.pathname.split('/').filter(Boolean);
    const episodeIndex = segments.findIndex(
      (segment) => segment.toLowerCase() === 'episode'
    );
    return episodeIndex >= 0 ? validId(segments[episodeIndex + 1]) : '';
  } catch {
    return validId(text);
  }
}

export function normalizeEpisodeAssignments(episodeIds = []) {
  const normalized = [];

  for (const value of Array.isArray(episodeIds) ? episodeIds : []) {
    const episodeId = extractSpotifyEpisodeId(value);
    if (episodeId && !normalized.includes(episodeId)) {
      normalized.push(episodeId);
    }
  }

  return normalized;
}

export function addEpisodeAssignment(episodeIds = [], value = '') {
  const nextIds = normalizeEpisodeAssignments(episodeIds);
  const episodeId = extractSpotifyEpisodeId(value);

  if (!episodeId || nextIds.includes(episodeId)) {
    return nextIds;
  }

  nextIds.push(episodeId);
  return nextIds;
}
