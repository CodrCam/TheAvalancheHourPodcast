import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanSpotifyEpisodes,
  fetchSpotifyEpisodes,
  fetchSpotifyJson,
} from '../lib/spotifyEpisodes.mjs';

function response(status, body, headers = {}) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers: {
      get(name) {
        return headers[String(name).toLowerCase()] ?? null;
      },
    },
    async json() {
      return body;
    },
  };
}

test('retries temporary Spotify failures and honors Retry-After', async () => {
  const statuses = [503, 200];
  const delays = [];
  const result = await fetchSpotifyJson(
    'https://api.spotify.test/episodes',
    {},
    {
      requestTimeoutMs: 0,
      fetchImpl: async () =>
        response(statuses.shift(), { items: ['ready'] }, { 'retry-after': '1' }),
      sleep: async (ms) => delays.push(ms),
    }
  );

  assert.deepEqual(result, { items: ['ready'] });
  assert.deepEqual(delays, [1000]);
});

test('does not retry a non-transient Spotify rejection', async () => {
  let calls = 0;
  await assert.rejects(
    fetchSpotifyJson(
      'https://api.spotify.test/episodes',
      {},
      {
        requestTimeoutMs: 0,
        fetchImpl: async () => {
          calls += 1;
          return response(401, {});
        },
        sleep: async () => {},
      }
    ),
    /Spotify request failed \(401\)/
  );
  assert.equal(calls, 1);
});

test('episode requests always fetch the full bounded catalog', async () => {
  const offsets = [];
  const episodes = await fetchSpotifyEpisodes('token', {
    limit: 3,
    requestTimeoutMs: 0,
    fetchImpl: async (url) => {
      const parsed = new URL(url);
      const offset = Number(parsed.searchParams.get('offset'));
      const limit = Number(parsed.searchParams.get('limit'));
      offsets.push(offset);
      return response(200, {
        total: 120,
        items: Array.from(
          { length: Math.min(limit, 120 - offset) },
          (_, index) => ({ id: String(offset + index) })
        ),
      });
    },
  });

  assert.deepEqual(offsets.sort((a, b) => a - b), [0, 50, 100]);
  assert.equal(episodes.length, 120);
  assert.equal(episodes[119].id, '119');
});

test('public Spotify route ignores legacy limits and returns the full catalog', async () => {
  const originalFetch = globalThis.fetch;
  const originalClientId = process.env.SPOTIFY_CLIENT_ID;
  const originalClientSecret = process.env.SPOTIFY_CLIENT_SECRET;
  const offsets = [];

  process.env.SPOTIFY_CLIENT_ID = 'test-client';
  process.env.SPOTIFY_CLIENT_SECRET = 'test-secret';
  globalThis.fetch = async (url) => {
    if (url === 'https://accounts.spotify.com/api/token') {
      return response(200, { access_token: 'token' });
    }

    const parsed = new URL(url);
    const offset = Number(parsed.searchParams.get('offset'));
    const limit = Number(parsed.searchParams.get('limit'));
    offsets.push(offset);
    return response(200, {
      total: 120,
      items: Array.from(
        { length: Math.min(limit, 120 - offset) },
        (_, index) => ({
          id: String(offset + index),
          release_date: '2026-01-01',
        })
      ),
    });
  };

  try {
    const { default: handler } = await import(
      `../pages/api/spotify.js?full-catalog-test=${Date.now()}`
    );
    const result = {
      headers: {},
      statusCode: null,
      body: null,
    };
    const res = {
      setHeader(name, value) {
        result.headers[name] = value;
      },
      status(statusCode) {
        result.statusCode = statusCode;
        return {
          json(body) {
            result.body = body;
            return body;
          },
        };
      },
    };

    await handler({ method: 'GET', query: { limit: '3' } }, res);

    assert.equal(result.statusCode, 200);
    assert.equal(result.body.length, 120);
    assert.deepEqual(offsets.sort((a, b) => a - b), [0, 50, 100]);
  } finally {
    globalThis.fetch = originalFetch;
    if (originalClientId === undefined) {
      delete process.env.SPOTIFY_CLIENT_ID;
    } else {
      process.env.SPOTIFY_CLIENT_ID = originalClientId;
    }
    if (originalClientSecret === undefined) {
      delete process.env.SPOTIFY_CLIENT_SECRET;
    } else {
      process.env.SPOTIFY_CLIENT_SECRET = originalClientSecret;
    }
  }
});

test('cleans and sorts episode data for public responses', () => {
  const episodes = cleanSpotifyEpisodes([
    {
      id: 'older',
      name: '',
      release_date: '2025-01-01',
      duration_ms: '1200',
      images: null,
    },
    {
      id: 'newer',
      name: 'New episode',
      release_date: '2026-01-01',
      explicit: true,
    },
    null,
  ]);

  assert.deepEqual(
    episodes.map((episode) => episode.id),
    ['newer', 'older']
  );
  assert.equal(episodes[1].name, 'Untitled Episode');
  assert.equal(episodes[1].duration_ms, 1200);
  assert.deepEqual(episodes[1].images, []);
});
