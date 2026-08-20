import test from 'node:test';
import assert from 'node:assert/strict';
import {
  episodeScheduleHref,
  listEpisodeScheduleMonth,
} from '../lib/episodeSchedulePresentation.mjs';

const episodes = [
  {
    episode_id: 'january-late',
    title: 'January Late',
    target_release_date: '2027-01-21',
  },
  {
    episode_id: 'december',
    title: 'December',
    target_release_date: '2026-12-30',
  },
  {
    episode_id: 'january-early-z',
    title: 'Zulu',
    target_release_date: '2027-01-07',
  },
  {
    episode_id: 'january-early-a',
    title: 'Alpha',
    target_release_date: '2027-01-07',
  },
  { episode_id: 'undated', title: 'Undated', target_release_date: '' },
];

test('lists only the selected calendar month in chronological title order', () => {
  assert.deepEqual(
    listEpisodeScheduleMonth(episodes, new Date(2027, 0, 1)).map(
      (episode) => episode.episode_id
    ),
    ['january-early-a', 'january-early-z', 'january-late']
  );
});

test('keeps adjacent and undated episodes out of the selected month', () => {
  assert.deepEqual(
    listEpisodeScheduleMonth(episodes, new Date(2026, 11, 1)).map(
      (episode) => episode.episode_id
    ),
    ['december']
  );
  assert.deepEqual(listEpisodeScheduleMonth(episodes, new Date('invalid')), []);
});

test('keeps live and local-preview episode destinations in their own routes', () => {
  assert.equal(
    episodeScheduleHref('/studio/episodes', {
      episode_id: 'package',
      workflow: { required_task_count: 0 },
    }),
    '/studio/episodes/package'
  );
  assert.equal(
    episodeScheduleHref('/studio/episodes', {
      episode_id: 'production',
      workflow: { required_task_count: 4 },
    }),
    '/studio/episodes/production/production'
  );
  assert.equal(
    episodeScheduleHref(
      '/studio/episodes',
      {
        episode_id: 'production',
        workflow: { required_task_count: 4 },
      },
      '/dev/episode-studio-usability-preview'
    ),
    '/dev/episode-studio-usability-preview?workspace=production'
  );
});
