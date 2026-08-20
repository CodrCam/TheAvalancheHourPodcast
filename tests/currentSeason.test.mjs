import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import {
  CURRENT_SEASON,
  buildStudioSeasonWorkflow,
  summarizeCurrentSeasonEpisodes,
} from '../lib/currentSeason.mjs';

test('keeps the shared Season 11 facts small and workbook-safe', () => {
  assert.deepEqual(
    {
      label: CURRENT_SEASON.label,
      dates: [CURRENT_SEASON.starts_on, CURRENT_SEASON.ends_on],
      slots: [
        CURRENT_SEASON.schedule_slots,
        CURRENT_SEASON.regular_slots,
        CURRENT_SEASON.slabs_and_sluffs_slots,
      ],
    },
    {
      label: 'Season 11',
      dates: ['2026-10-01', '2027-05-31'],
      slots: [38, 29, 9],
    }
  );
  for (const privateField of [
    'email',
    'address',
    'shipping',
    'consent',
    'equipment',
    'notes',
  ]) {
    assert.equal(privateField in CURRENT_SEASON, false);
  }
});

test('summarizes only active Season 11 Episode Studios and safe releases', () => {
  const summary = summarizeCurrentSeasonEpisodes(
    [
      { season: 'Season 11', status: 'planning' },
      { season: 'Season 11', status: 'submitted' },
      { season: 'Season 11', status: 'accepted', archived: true },
      { season: 'Season 10', status: 'accepted' },
    ],
    [
      {
        title: 'First storm',
        season: 'Season 11',
        target_release_date: '2026-10-07',
        producer_email: 'must-not-survive@example.com',
      },
      {
        title: 'Old season',
        season: 'Season 10',
        target_release_date: '2026-10-08',
      },
    ]
  );

  assert.equal(summary.episode_studios, 2);
  assert.equal(summary.by_status.planning, 1);
  assert.equal(summary.by_status.submitted, 1);
  assert.deepEqual(summary.next_releases, [
    { title: 'First storm', target_release_date: '2026-10-07' },
  ]);
  assert.equal(JSON.stringify(summary).includes('must-not-survive'), false);
});

test('builds one ordered, role-safe four-stage workflow', () => {
  const host = buildStudioSeasonWorkflow({
    permissions: ['episodes:read', 'mastermind:read'],
    features: { season_mastermind: true },
    capabilities: { producer_tasks: true },
  });
  assert.deepEqual(
    host.map((stage) => stage.id),
    ['plan', 'prepare', 'record', 'produce']
  );
  assert.deepEqual(
    host.map((stage) => stage.href),
    [
      '/studio/mastermind',
      '/studio/questionnaires',
      '/studio/episodes',
      '/studio/production',
    ]
  );

  const featureOff = buildStudioSeasonWorkflow({
    permissions: ['episodes:read', 'mastermind:read'],
  });
  assert.equal(featureOff[0].available, false);
  assert.equal(featureOff[0].href, '');
  assert.equal(featureOff.slice(1).every((stage) => stage.available), true);
  assert.equal(
    featureOff.some((stage) => stage.id === 'produce'),
    false
  );

  const manager = buildStudioSeasonWorkflow({
    permissions: ['episodes:read', 'episodes:manage'],
  });
  assert.equal(manager.some((stage) => stage.id === 'produce'), true);
});

test('Studio home loads Aurora planning totals only after an explicit action', async () => {
  const [source, dashboard] = await Promise.all([
    readFile(new URL('../pages/studio/index.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../components/StudioOverviewDashboard.js', import.meta.url),
      'utf8'
    ),
  ]);
  const automaticRequests = source.slice(
    source.indexOf('const requests = {'),
    source.indexOf('const entries = Object.entries(requests);')
  );
  const explicitLoader = source.slice(
    source.indexOf('async function loadMastermindOverview()'),
    source.indexOf('const today = useMemo(')
  );

  assert.doesNotMatch(automaticRequests, /mastermind\/overview/);
  assert.match(explicitLoader, /mastermind\/overview/);
  assert.match(dashboard, /Load live planning totals/);
  assert.match(source, /mastermindLoadAttempts >= 2/);
});
