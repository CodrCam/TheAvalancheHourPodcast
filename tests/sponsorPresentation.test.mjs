import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addEpisodeAssignment,
  extractSpotifyEpisodeId,
  groupSponsorsForDisplay,
  normalizeEpisodeAssignments,
  updateSponsorDraft,
} from '../lib/sponsorPresentation.mjs';

test('extracts Spotify episode IDs from standard and localized links', () => {
  assert.equal(
    extractSpotifyEpisodeId(
      'https://open.spotify.com/episode/1HUTXoWJtCH7ojnp0CVgJE?si=test'
    ),
    '1HUTXoWJtCH7ojnp0CVgJE'
  );
  assert.equal(
    extractSpotifyEpisodeId(
      'https://open.spotify.com/intl-de/episode/abc123#details'
    ),
    'abc123'
  );
  assert.equal(
    extractSpotifyEpisodeId('spotify:episode:rawEpisode123'),
    'rawEpisode123'
  );
  assert.equal(extractSpotifyEpisodeId('rawEpisode123'), 'rawEpisode123');
  assert.equal(
    extractSpotifyEpisodeId('https://example.com/episode/notSpotify123'),
    ''
  );
  assert.equal(extractSpotifyEpisodeId('not an episode'), '');
});

test('adds episode assignments once without mutating the source', () => {
  const existing = ['first123'];
  const added = addEpisodeAssignment(
    existing,
    'https://open.spotify.com/episode/second456?si=test'
  );

  assert.deepEqual(added, ['first123', 'second456']);
  assert.deepEqual(existing, ['first123']);
  assert.deepEqual(addEpisodeAssignment(added, 'second456'), added);
});

test('normalizes loaded episode assignments without duplicates', () => {
  const source = [
    'first123',
    ' https://open.spotify.com/episode/second456?si=test ',
    'first123',
    'not an episode',
  ];

  assert.deepEqual(normalizeEpisodeAssignments(source), [
    'first123',
    'second456',
  ]);
  assert.equal(source.length, 4);
});

test('groups sponsors by placement tier and sorts each tier by display order', () => {
  const grouped = groupSponsorsForDisplay([
    { name: 'Later Partner', tier: 'partner', sort_order: 4 },
    { name: 'Episode', tier: 'episode', sort_order: 1 },
    { name: 'Legacy', tier: 'legacy', sort_order: 2 },
    { name: 'First Partner', tier: 'partner', sort_order: 1 },
    { name: 'Fallback Partner', tier: 'unknown', sort_order: 2 },
  ]);

  assert.deepEqual(
    grouped.partner.map((sponsor) => sponsor.name),
    ['First Partner', 'Fallback Partner', 'Later Partner']
  );
  assert.deepEqual(
    grouped.legacy.map((sponsor) => sponsor.name),
    ['Legacy']
  );
  assert.deepEqual(
    grouped.episode.map((sponsor) => sponsor.name),
    ['Episode']
  );
});

test('keeps deriving a new sponsor ID until the ID is edited manually', () => {
  const firstKeystroke = updateSponsorDraft(
    { sponsor_id: '', id: '', id_manually_edited: false },
    { name: 'A' }
  );
  const fullName = updateSponsorDraft(firstKeystroke, {
    name: 'Acme & Sons',
  });
  const manualId = updateSponsorDraft(fullName, {
    sponsor_id: 'acme-listener-offer',
    id_manually_edited: true,
  });
  const renamed = updateSponsorDraft(manualId, {
    name: 'Acme Outdoor Supply',
  });

  assert.equal(firstKeystroke.sponsor_id, 'a');
  assert.equal(fullName.sponsor_id, 'acme-and-sons');
  assert.equal(manualId.id, 'acme-listener-offer');
  assert.equal(renamed.sponsor_id, 'acme-listener-offer');
});
