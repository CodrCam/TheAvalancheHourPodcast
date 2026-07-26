const SPOTIFY_API_BASE = 'https://api.spotify.com/v1';
const SPOTIFY_TOKEN_URL = 'https://accounts.spotify.com/api/token';
const DEFAULT_PAGE_SIZE = 50;
const MAX_EPISODES = 1000;
const MAX_PARALLEL_PAGES = 3;
const DEFAULT_REQUEST_TIMEOUT_MS = 8000;

export const SPOTIFY_SHOW_ID = '1BNdDDvI4drM0vRIn5kKlU';
export const SPOTIFY_RETRYABLE_STATUSES = new Set([
  408,
  429,
  500,
  502,
  503,
  504,
]);

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(response, attempt) {
  const retryAfter = response?.headers?.get?.('retry-after');
  const retryAfterSeconds = Number(retryAfter);
  if (Number.isFinite(retryAfterSeconds) && retryAfterSeconds >= 0) {
    return Math.min(3000, Math.round(retryAfterSeconds * 1000));
  }
  return Math.min(2000, 250 * 2 ** attempt);
}

export function parseSpotifyEpisodeLimit(value) {
  const source = Array.isArray(value) ? value[0] : value;
  if (source === undefined || source === null || source === '') return null;
  const limit = Number(source);
  if (!Number.isInteger(limit) || limit < 1 || limit > DEFAULT_PAGE_SIZE) {
    return null;
  }
  return limit;
}

export async function fetchSpotifyJson(
  url,
  options = {},
  {
    fetchImpl = globalThis.fetch,
    sleep = wait,
    maxRetries = 2,
    requestTimeoutMs = DEFAULT_REQUEST_TIMEOUT_MS,
  } = {}
) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller =
      requestTimeoutMs > 0 && typeof AbortController !== 'undefined'
        ? new AbortController()
        : null;
    const timeout = controller
      ? setTimeout(() => controller.abort(), requestTimeoutMs)
      : null;

    try {
      const response = await fetchImpl(url, {
        ...options,
        ...(controller ? { signal: controller.signal } : {}),
      });

      if (response.ok) {
        return await response.json();
      }

      const error = new Error(`Spotify request failed (${response.status})`);
      error.status = response.status;
      lastError = error;

      if (
        !SPOTIFY_RETRYABLE_STATUSES.has(response.status) ||
        attempt === maxRetries
      ) {
        throw error;
      }

      await sleep(retryDelayMs(response, attempt));
    } catch (error) {
      if (error?.status) throw error;
      lastError = error;
      if (attempt === maxRetries) throw error;
      await sleep(Math.min(2000, 250 * 2 ** attempt));
    } finally {
      if (timeout) clearTimeout(timeout);
    }
  }

  throw lastError || new Error('Spotify request failed');
}

export async function fetchSpotifyAccessToken({
  clientId,
  clientSecret,
  fetchImpl,
  sleep,
  requestTimeoutMs,
} = {}) {
  if (!clientId || !clientSecret) {
    throw new Error('Missing Spotify credentials in environment variables');
  }

  const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString(
    'base64'
  );
  const data = await fetchSpotifyJson(
    SPOTIFY_TOKEN_URL,
    {
      method: 'POST',
      headers: {
        Authorization: `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    },
    { fetchImpl, sleep, requestTimeoutMs }
  );

  if (!data?.access_token) {
    throw new Error('Spotify did not return an access token');
  }
  return data.access_token;
}

function episodePageUrl(showId, limit, offset = 0) {
  const params = new URLSearchParams({
    market: 'US',
    limit: String(limit),
    offset: String(offset),
  });
  return `${SPOTIFY_API_BASE}/shows/${showId}/episodes?${params}`;
}

async function fetchEpisodePage(
  token,
  showId,
  limit,
  offset,
  dependencies
) {
  return fetchSpotifyJson(
    episodePageUrl(showId, limit, offset),
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    },
    dependencies
  );
}

export async function fetchSpotifyEpisodes(
  token,
  {
    limit = null,
    showId = SPOTIFY_SHOW_ID,
    fetchImpl,
    sleep,
    requestTimeoutMs,
  } = {}
) {
  const requestedLimit = parseSpotifyEpisodeLimit(limit);
  const pageSize = requestedLimit || DEFAULT_PAGE_SIZE;
  const dependencies = { fetchImpl, sleep, requestTimeoutMs };
  const firstPage = await fetchEpisodePage(
    token,
    showId,
    pageSize,
    0,
    dependencies
  );
  const firstItems = Array.isArray(firstPage?.items) ? firstPage.items : [];

  if (requestedLimit) return firstItems.slice(0, requestedLimit);

  const reportedTotal = Math.max(
    firstItems.length,
    Math.trunc(Number(firstPage?.total) || firstItems.length)
  );
  const total = Math.min(MAX_EPISODES, reportedTotal);
  const offsets = [];
  for (let offset = DEFAULT_PAGE_SIZE; offset < total; offset += DEFAULT_PAGE_SIZE) {
    offsets.push(offset);
  }

  const pages = [];
  for (let index = 0; index < offsets.length; index += MAX_PARALLEL_PAGES) {
    const batch = offsets.slice(index, index + MAX_PARALLEL_PAGES);
    const results = await Promise.all(
      batch.map((offset) =>
        fetchEpisodePage(
          token,
          showId,
          Math.min(DEFAULT_PAGE_SIZE, total - offset),
          offset,
          dependencies
        )
      )
    );
    pages.push(...results);
  }

  return [
    ...firstItems,
    ...pages.flatMap((page) =>
      Array.isArray(page?.items) ? page.items : []
    ),
  ].slice(0, total);
}

export function cleanSpotifyEpisodes(episodes = []) {
  return episodes
    .filter((episode) => episode?.id)
    .map((episode) => ({
      id: episode.id,
      name: episode.name || 'Untitled Episode',
      description: episode.description || '',
      release_date: episode.release_date || '',
      duration_ms: Number(episode.duration_ms) || 0,
      external_urls: episode.external_urls || {},
      images: Array.isArray(episode.images) ? episode.images : [],
      explicit: episode.explicit === true,
      uri: episode.uri || '',
    }))
    .sort(
      (a, b) =>
        new Date(b.release_date).getTime() -
        new Date(a.release_date).getTime()
    );
}
