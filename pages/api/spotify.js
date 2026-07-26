import {
  cleanSpotifyEpisodes,
  fetchSpotifyAccessToken,
  fetchSpotifyEpisodes,
  parseSpotifyEpisodeLimit,
} from '../../lib/spotifyEpisodes.mjs';

const CACHE_TTL_MS = 30 * 60 * 1000;
const cacheByScope = new Map();
const inFlightByScope = new Map();

function scopeKey(limit) {
  return limit ? `latest:${limit}` : 'all';
}

function getCachedEpisodes(limit, allowStale = false) {
  const full = cacheByScope.get('all');
  const exact = cacheByScope.get(scopeKey(limit));
  const entry = full || exact;
  if (!entry) return null;
  if (!allowStale && Date.now() - entry.timestamp >= CACHE_TTL_MS) {
    return null;
  }
  return limit ? entry.data.slice(0, limit) : entry.data;
}

async function loadEpisodes(limit) {
  const key = scopeKey(limit);
  if (inFlightByScope.has(key)) return inFlightByScope.get(key);

  const request = (async () => {
    const token = await fetchSpotifyAccessToken({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });
    const episodes = cleanSpotifyEpisodes(
      await fetchSpotifyEpisodes(token, { limit })
    );
    cacheByScope.set(key, {
      data: episodes,
      timestamp: Date.now(),
    });
    return episodes;
  })();

  inFlightByScope.set(key, request);
  try {
    return await request;
  } finally {
    inFlightByScope.delete(key);
  }
}

function setEpisodeCacheHeaders(res) {
  res.setHeader(
    'Cache-Control',
    'public, s-maxage=1800, stale-while-revalidate=86400, stale-if-error=86400'
  );
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiStart = performance.now();
  const limit = parseSpotifyEpisodeLimit(req.query?.limit);
  setEpisodeCacheHeaders(res);

  try {
    const cached = getCachedEpisodes(limit);
    if (cached) {
      res.setHeader('X-Spotify-Data-Source', 'memory-cache');
      return res.status(200).json(cached);
    }

    const episodes = await loadEpisodes(limit);
    res.setHeader('X-Spotify-Data-Source', 'spotify');
    res.setHeader(
      'Server-Timing',
      `spotify;dur=${(performance.now() - apiStart).toFixed(1)}`
    );
    return res.status(200).json(episodes);
  } catch (error) {
    const stale = getCachedEpisodes(limit, true);
    if (stale) {
      res.setHeader('X-Spotify-Data-Source', 'stale-memory-cache');
      res.setHeader('Warning', '110 - "Response is stale"');
      return res.status(200).json(stale);
    }

    console.error('Spotify episode request failed:', error.message);
    return res.status(500).json({
      error: 'Failed to fetch episodes',
      message: 'Episodes are temporarily unavailable. Please try again shortly.',
    });
  }
}
