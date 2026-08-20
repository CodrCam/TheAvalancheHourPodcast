import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { LOCAL_SEASON_MASTERMIND_PREVIEW } from '../lib/seasonMastermindLocalPreview.mjs';

const episodeListRoute = fs.readFileSync(
  new URL('../pages/api/studio/episodes/index.js', import.meta.url),
  'utf8'
);
const handoffRoute = fs.readFileSync(
  new URL(
    '../pages/api/studio/mastermind/handoffs/episode.js',
    import.meta.url
  ),
  'utf8'
);

test('workbook schedule remains planning-only until explicit handoff', () => {
  assert.equal(
    LOCAL_SEASON_MASTERMIND_PREVIEW.plans.every(
      (plan) => !plan.linked_episode_id
    ),
    true
  );
  assert.doesNotMatch(
    episodeListRoute,
    /season11MastermindSchedule|LOCAL_SEASON_MASTERMIND_PREVIEW/
  );
  assert.match(handoffRoute, /EPISODE_PRODUCER_REQUIRED/);
  assert.match(handoffRoute, /ensureEpisodeStudioFromMastermindPlan/);
  assert.match(handoffRoute, /MASTERMIND_MANAGE/);
  assert.match(handoffRoute, /EPISODES_MANAGE/);
});
