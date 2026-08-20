import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

const [workspaceSource, episodeApiSource, stylesheetSource] = await Promise.all([
  readFile(
    new URL('../components/EpisodeStudioWorkspace.js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../pages/api/studio/episodes/[episodeId].js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../styles/EpisodeStudio.module.css', import.meta.url),
    'utf8'
  ),
]);

test('Host Studio presents planning, host review, and producer submission as separate stages', () => {
  assert.match(workspaceSource, /planning: 'Host research & review'/);
  assert.match(workspaceSource, /in_progress: 'Host review in progress'/);
  assert.match(workspaceSource, /Host Studio process/);
  assert.match(workspaceSource, /Research, verify, and assemble the episode/);
  assert.match(workspaceSource, /Editorial plan received/);
  assert.match(workspaceSource, /Host research &amp; review/);
  assert.match(workspaceSource, /Explicitly submit to producer/);
  assert.match(workspaceSource, /Step 3 · Submit to producer/);
  assert.match(stylesheetSource, /\.hostWorkflowGuide/);
});

test('host review is explicit, invalidates with package changes, and precedes submit', () => {
  assert.match(workspaceSource, /getHostResearchReviewFingerprint/);
  assert.match(workspaceSource, /I completed the host research review/);
  assert.match(
    workspaceSource,
    /Changing package material will require confirmation again\./
  );
  assert.match(
    workspaceSource,
    /host_research_review_confirmed: true/
  );
  assert.match(stylesheetSource, /\.hostResearchReviewPanel/);

  const guardIndex = episodeApiSource.indexOf(
    "req.body?.host_research_review_confirmed !== true"
  );
  const trackerIndex = episodeApiSource.indexOf('await getMicKitTracker()');
  assert.notEqual(guardIndex, -1);
  assert.notEqual(trackerIndex, -1);
  assert.ok(guardIndex < trackerIndex);
  assert.match(episodeApiSource, /HOST_RESEARCH_REVIEW_REQUIRED/);
});

test('review copy keeps private questionnaire-only responses in the restricted workspace', () => {
  const start = workspaceSource.indexOf(
    'className={styles.hostResearchReviewPanel}'
  );
  const end = workspaceSource.indexOf(
    "{checklistMode === 'view' ? (",
    start
  );
  assert.notEqual(start, -1);
  assert.notEqual(end, -1);
  const reviewPanel = workspaceSource.slice(start, end);

  assert.match(reviewPanel, /Private\s*questionnaire-only responses remain/);
  assert.doesNotMatch(
    reviewPanel,
    /contact_email|contact_phone|shipping_address|mic_kit_shipping/
  );
});

test('review PATCH applies corrected-response readiness before the accepted transition', () => {
  const reviewBranch = episodeApiSource.indexOf(
    "(canReview && action === 'review')"
  );
  const readiness = episodeApiSource.indexOf(
    'getEpisodeAcceptancePatchBlocker({',
    reviewBranch
  );
  const acceptedTransition = episodeApiSource.indexOf(
    'nextEpisode = {',
    readiness
  );

  assert.ok(reviewBranch > 0);
  assert.ok(readiness > reviewBranch);
  assert.ok(acceptedTransition > readiness);
  assert.match(
    episodeApiSource.slice(readiness, acceptedTransition),
    /EPISODE_ACCEPTANCE_REVIEWS_INCOMPLETE|acceptancePatchBlocker\.code/
  );
});
