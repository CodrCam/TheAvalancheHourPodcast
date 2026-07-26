import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildSlabsAndSluffsCampaign,
  isSlabsAndSluffsEpisode,
} from '../lib/slabsAndSluffsCampaign.mjs';

test('recognizes the title variants used for Slabs and Sluffs', () => {
  for (const title of [
    'Slabs and Sluffs with Dom and Sara',
    "Slabs 'n Sluffs — February",
    'Slabs & Slufs: Listener Calls',
  ]) {
    assert.equal(isSlabsAndSluffsEpisode({ title }), true, title);
  }
  assert.equal(
    isSlabsAndSluffsEpisode({ title: 'A regular Avalanche Hour episode' }),
    false
  );
});

test('opens the listener call line two weeks before a scheduled episode', () => {
  const campaign = buildSlabsAndSluffsCampaign({
    now: new Date('2026-02-14T18:00:00Z'),
    scheduledEpisodes: [
      {
        title: 'Slabs and Sluffs · February',
        target_release_date: '2026-02-28',
      },
    ],
  });

  assert.deepEqual(campaign, {
    phase: 'upcoming',
    release_date: '2026-02-28',
    episode_title: 'Slabs and Sluffs · February',
    episode_url: '',
  });
});

test('does not promote an upcoming episode before its two-week window', () => {
  const campaign = buildSlabsAndSluffsCampaign({
    now: new Date('2026-02-13T18:00:00Z'),
    scheduledEpisodes: [
      {
        title: 'Slabs and Sluffs · February',
        target_release_date: '2026-02-28',
      },
    ],
  });

  assert.equal(campaign, null);
});

test('highlights a newly published Slabs and Sluffs episode', () => {
  const campaign = buildSlabsAndSluffsCampaign({
    now: new Date('2026-03-05T18:00:00Z'),
    publishedEpisodes: [
      {
        name: 'Slabs and Sluffs with Dom and Sara · February',
        release_date: '2026-02-28',
        external_urls: {
          spotify: 'https://open.spotify.com/episode/episode-one',
        },
      },
    ],
  });

  assert.equal(campaign.phase, 'recent');
  assert.equal(campaign.release_date, '2026-02-28');
  assert.equal(
    campaign.episode_url,
    'https://open.spotify.com/episode/episode-one'
  );
});

test('an upcoming episode takes priority over a recent release', () => {
  const campaign = buildSlabsAndSluffsCampaign({
    now: new Date('2026-03-20T18:00:00Z'),
    scheduledEpisodes: [
      {
        title: 'Slabs and Sluffs · March',
        target_release_date: '2026-03-31',
      },
    ],
    publishedEpisodes: [
      {
        name: 'Slabs and Sluffs · February',
        release_date: '2026-03-18',
      },
    ],
  });

  assert.equal(campaign.phase, 'upcoming');
  assert.equal(campaign.release_date, '2026-03-31');
});

test('keeps the campaign hidden outside release windows', () => {
  const campaign = buildSlabsAndSluffsCampaign({
    now: new Date('2026-07-26T18:00:00Z'),
    publishedEpisodes: [
      {
        name: 'Slabs and Sluffs · June',
        release_date: '2026-06-30',
      },
    ],
  });

  assert.equal(campaign, null);
});
