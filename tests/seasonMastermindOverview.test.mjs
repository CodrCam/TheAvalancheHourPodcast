import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';
import {
  normalizeSeasonMastermindOverview,
  SEASON_OVERVIEW_EPISODE_TYPES,
  SEASON_OVERVIEW_PLAN_STATUSES,
} from '../lib/seasonMastermindOverview.mjs';

test('normalizes only the public current-season overview contract', () => {
  const overview = normalizeSeasonMastermindOverview({
    season: {
      season_id: 'private-season-id',
      label: ' Season 11 ',
      starts_on: '2026-10-01',
      ends_on: '2027-05-31',
      status: 'planning',
      planning_goal: ' Build one coherent season. ',
      created_by_person_id: 'private-creator',
    },
    planning: {
      total: 2,
      undated: 99,
      by_status: {
        idea: 3,
        ready: '2.9',
        archived: 900,
      },
      by_type: {
        regular: 4,
        unknown_private_type: 800,
      },
      hosts: [{ email: 'private@example.com' }],
    },
    source_intake_item_id: 'private-intake-id',
    linked_episode_id: 'private-episode-id',
  });

  assert.deepEqual(overview, {
    season: {
      label: 'Season 11',
      starts_on: '2026-10-01',
      ends_on: '2027-05-31',
      status: 'planning',
      planning_goal: 'Build one coherent season.',
    },
    planning: {
      total: 5,
      undated: 5,
      by_status: {
        idea: 3,
        researching: 0,
        ready: 2,
        scheduled: 0,
        recording: 0,
        published: 0,
      },
      by_type: {
        regular: 4,
        slabs_and_sluffs: 0,
        special: 0,
      },
    },
  });
  assert.deepEqual(
    Object.keys(overview.planning.by_status),
    SEASON_OVERVIEW_PLAN_STATUSES
  );
  assert.deepEqual(
    Object.keys(overview.planning.by_type),
    SEASON_OVERVIEW_EPISODE_TYPES
  );
});

test('fails closed on an invalid or archived season while keeping bounded counts', () => {
  const overview = normalizeSeasonMastermindOverview({
    season: {
      label: 'Archived season',
      starts_on: 'not-a-date',
      ends_on: '2027-05-31',
      status: 'archived',
      planning_goal: 'Should not render.',
    },
    planning: {
      total: -20,
      undated: Number.POSITIVE_INFINITY,
      by_status: { idea: Number.NaN },
      by_type: { special: -1 },
    },
  });

  assert.equal(overview.season, null);
  assert.equal(overview.planning.total, 0);
  assert.equal(overview.planning.undated, 0);
  assert.equal(
    Object.values(overview.planning.by_status).every((value) => value === 0),
    true
  );
  assert.equal(
    Object.values(overview.planning.by_type).every((value) => value === 0),
    true
  );
});

test('overview route is GET-only, permission checked, default-off, and server scoped', async () => {
  const route = await readFile(
    new URL('../pages/api/studio/mastermind/overview.js', import.meta.url),
    'utf8'
  );

  assert.match(route, /req\.method !== 'GET'/);
  assert.match(route, /ADMIN_PERMISSIONS\.MASTERMIND_READ/);
  assert.match(route, /isSeasonMastermindConfigured\(\)/);
  assert.match(route, /Object\.keys\(req\.query \|\| \{\}\)\.length/);
  assert.match(route, /operation: 'get_season_overview'/);
  assert.match(route, /input: \{\}/);
  assert.match(route, /createHash\('sha256'\)/);
  assert.match(route, /normalizeSeasonMastermindOverview\(result\)/);
  assert.match(route, /Cache-Control', 'private, no-store'/);
  assert.match(route, /X-Content-Type-Options', 'nosniff'/);
  assert.doesNotMatch(route, /getStudioBindingForSubject/);
  assert.doesNotMatch(route, /\.\.\.result/);
});
