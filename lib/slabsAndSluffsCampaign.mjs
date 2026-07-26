const DAY_MS = 24 * 60 * 60 * 1000;

export const SLABS_AND_SLUFFS_PHONE_DISPLAY = '541-406-0221';
export const SLABS_AND_SLUFFS_PHONE_HREF = 'tel:+15414060221';
export const SLABS_AND_SLUFFS_LEAD_DAYS = 14;
export const SLABS_AND_SLUFFS_RECENT_DAYS = 14;

function titleFromEpisode(episode = {}) {
  return String(episode.name || episode.title || '').trim();
}

function normalizedTitle(episode = {}) {
  return titleFromEpisode(episode)
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function dateOnlyMs(value) {
  const date = String(value || '').slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const milliseconds = new Date(`${date}T12:00:00Z`).getTime();
  return Number.isFinite(milliseconds) ? milliseconds : null;
}

function safeSpotifyUrl(episode = {}) {
  const value = String(episode.external_urls?.spotify || '').trim();
  if (!value) return '';
  try {
    const parsed = new URL(value);
    return parsed.protocol === 'https:' &&
      parsed.hostname === 'open.spotify.com'
      ? parsed.toString()
      : '';
  } catch {
    return '';
  }
}

export function isSlabsAndSluffsEpisode(episode = {}) {
  const title = normalizedTitle(episode);
  return /\bslabs?\b/.test(title) && /\bsluf{1,2}s?\b/.test(title);
}

export function buildSlabsAndSluffsCampaign({
  scheduledEpisodes = [],
  publishedEpisodes = [],
  now = new Date(),
  leadDays = SLABS_AND_SLUFFS_LEAD_DAYS,
  recentDays = SLABS_AND_SLUFFS_RECENT_DAYS,
} = {}) {
  const today = dateOnlyMs(
    now instanceof Date ? now.toISOString() : now
  );
  if (today === null) return null;

  const upcoming = (Array.isArray(scheduledEpisodes)
    ? scheduledEpisodes
    : []
  )
    .filter(isSlabsAndSluffsEpisode)
    .map((episode) => ({
      episode,
      date: dateOnlyMs(episode.target_release_date),
    }))
    .filter(
      ({ date }) =>
        date !== null &&
        date >= today &&
        date - today <= Math.max(0, leadDays) * DAY_MS
    )
    .sort((a, b) => a.date - b.date)[0];

  if (upcoming) {
    return {
      phase: 'upcoming',
      release_date: String(
        upcoming.episode.target_release_date || ''
      ).slice(0, 10),
      episode_title: titleFromEpisode(upcoming.episode),
      episode_url: '',
    };
  }

  const recent = (Array.isArray(publishedEpisodes)
    ? publishedEpisodes
    : []
  )
    .filter(isSlabsAndSluffsEpisode)
    .map((episode) => ({
      episode,
      date: dateOnlyMs(episode.release_date),
    }))
    .filter(
      ({ date }) =>
        date !== null &&
        date <= today &&
        today - date <= Math.max(0, recentDays) * DAY_MS
    )
    .sort((a, b) => b.date - a.date)[0];

  if (!recent) return null;

  return {
    phase: 'recent',
    release_date: String(recent.episode.release_date || '').slice(0, 10),
    episode_title: titleFromEpisode(recent.episode),
    episode_url: safeSpotifyUrl(recent.episode),
  };
}
