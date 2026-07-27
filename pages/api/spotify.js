import {
  cleanSpotifyEpisodes,
  fetchSpotifyAccessToken,
  fetchSpotifyEpisodes,
} from '../../lib/spotifyEpisodes.mjs';

const CACHE_TTL_MS = 30 * 60 * 1000;
let episodeCache = null;
let inFlightRequest = null;

function getCachedEpisodes(allowStale = false) {
  if (!episodeCache) return null;
  if (
    !allowStale &&
    Date.now() - episodeCache.timestamp >= CACHE_TTL_MS
  ) {
    return null;
  }
  return episodeCache.data;
}

async function loadEpisodes() {
  if (inFlightRequest) return inFlightRequest;

  const request = (async () => {
    const token = await fetchSpotifyAccessToken({
      clientId: process.env.SPOTIFY_CLIENT_ID,
      clientSecret: process.env.SPOTIFY_CLIENT_SECRET,
    });
    const episodes = cleanSpotifyEpisodes(
      await fetchSpotifyEpisodes(token)
    );
    episodeCache = {
      data: episodes,
      timestamp: Date.now(),
    };
    return episodes;
  })();

  inFlightRequest = request;
  try {
    return await request;
  } finally {
    if (inFlightRequest === request) inFlightRequest = null;
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
  setEpisodeCacheHeaders(res);

  try {
    const cached = getCachedEpisodes();
    if (cached) {
      res.setHeader('X-Spotify-Data-Source', 'memory-cache');
      return res.status(200).json(cached);
    }

    const episodes = await loadEpisodes();
    res.setHeader('X-Spotify-Data-Source', 'spotify');
    res.setHeader(
      'Server-Timing',
      `spotify;dur=${(performance.now() - apiStart).toFixed(1)}`
    );
    return res.status(200).json(episodes);
  } catch (error) {
    const stale = getCachedEpisodes(true);
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
