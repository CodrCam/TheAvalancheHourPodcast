import assert from 'node:assert/strict';
import test from 'node:test';
import {
  cleanSpotifyEpisodes,
  fetchSpotifyEpisodes,
  fetchSpotifyJson,
  parseSpotifyEpisodeLimit,
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

test('accepts only bounded latest-episode limits', () => {
  assert.equal(parseSpotifyEpisodeLimit('3'), 3);
  assert.equal(parseSpotifyEpisodeLimit(['12']), 12);
  assert.equal(parseSpotifyEpisodeLimit('0'), null);
  assert.equal(parseSpotifyEpisodeLimit('51'), null);
  assert.equal(parseSpotifyEpisodeLimit('all'), null);
});

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

test('latest episode requests use one bounded Spotify page', async () => {
  const urls = [];
  const episodes = await fetchSpotifyEpisodes('token', {
    limit: 3,
    requestTimeoutMs: 0,
    fetchImpl: async (url) => {
      urls.push(url);
      return response(200, {
        total: 250,
        items: [{ id: '3' }, { id: '2' }, { id: '1' }],
      });
    },
  });

  assert.equal(urls.length, 1);
  assert.match(urls[0], /limit=3/);
  assert.deepEqual(
    episodes.map((episode) => episode.id),
    ['3', '2', '1']
  );
});

test('full episode requests fetch the remaining bounded pages', async () => {
  const offsets = [];
  const episodes = await fetchSpotifyEpisodes('token', {
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
