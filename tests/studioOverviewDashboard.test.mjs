import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { buildStudioOperationsInsightModel } from '../lib/studioOperationsInsights.mjs';
import {
  STUDIO_PREVIEW_EPISODES,
  STUDIO_PREVIEW_SEASON,
  STUDIO_PREVIEW_SESSION,
} from '../lib/studioPreviewFixtures.mjs';

test('builds Caleb a team-wide Season 11 operating picture', () => {
  const model = buildStudioOperationsInsightModel({
    episodes: STUDIO_PREVIEW_EPISODES,
    season: STUDIO_PREVIEW_SEASON,
    permissions: STUDIO_PREVIEW_SESSION.permissions,
    capabilities: STUDIO_PREVIEW_SESSION.capabilities,
  });

  assert.equal(model.scope, 'team');
  assert.deepEqual(
    {
      studios: model.season.reported_episode_studios,
      planned: model.season.planned_slots,
      host_drafts: model.metrics.host_drafts,
      producer_review: model.metrics.producer_review,
      attention: model.metrics.attention,
    },
    {
      studios: 3,
      planned: 38,
      host_drafts: 2,
      producer_review: 1,
      attention: 1,
    }
  );
  assert.equal(model.workload.some((row) => row.name === 'Caleb Merrill'), true);
});

test('Studio home leads with one overview and removes the duplicated season explainer', async () => {
  const [page, dashboard] = await Promise.all([
    readFile(new URL('../pages/studio/index.js', import.meta.url), 'utf8'),
    readFile(
      new URL('../components/StudioOverviewDashboard.js', import.meta.url),
      'utf8'
    ),
  ]);

  assert.match(page, /<StudioOverviewDashboard/);
  assert.doesNotMatch(page, /seasonWorkflow\.map/);
  assert.doesNotMatch(page, /Master sheet translated/);
  assert.match(dashboard, /The season at a glance/);
  assert.match(dashboard, /Production pulse/);
  assert.match(dashboard, /Who is carrying what/);
  assert.match(dashboard, /Three clear workspaces/);
  assert.match(dashboard, /Host Studio/);
  assert.match(dashboard, /Producer Tasks/);
  assert.match(dashboard, /Season Mastermind/);
  assert.doesNotMatch(dashboard, /rows\.slice\(0, 10\)/);
  assert.match(dashboard, /All named assignments/);
  assert.match(dashboard, /intentionally not showing zero counts/);
  assert.match(page, /dataState=\{episodeDataState\}/);
});

test('overview remains aggregate-only while the manager API supplies safe teammate names', async () => {
  const [dashboard, route] = await Promise.all([
    readFile(
      new URL('../components/StudioOverviewDashboard.js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../pages/api/studio/episodes/index.js', import.meta.url),
      'utf8'
    ),
  ]);

  assert.doesNotMatch(dashboard, /producer_email|account_email|shipping|guest_email/);
  assert.match(route, /producer_name:/);
  assert.match(route, /directory\.peopleById\.get\(episode\.producer_person_id\)/);
});
