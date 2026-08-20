import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const inboxSource = await readFile(
  new URL('../pages/studio/inbox.js', import.meta.url),
  'utf8'
);

test('shows the planning review only for a selected episode request a manager can review', () => {
  assert.match(inboxSource, /import \{ isEpisodeRequestItem \}/);
  assert.match(
    inboxSource,
    /\{canManage && isEpisodeRequestItem\(selected\) \? \(/
  );
  assert.match(inboxSource, /!canStartMastermind \? \(/);
  assert.match(inboxSource, /Review planning fields/);
});

test('posts only manager-reviewed planning fields from the authoritative selected item', () => {
  const handoffStart = inboxSource.indexOf(
    "'/api/studio/mastermind/handoffs/intake'"
  );
  const handoffEnd = inboxSource.indexOf(
    'setMastermindOutcome',
    handoffStart
  );
  assert.notEqual(handoffStart, -1);
  assert.notEqual(handoffEnd, -1);
  const handoff = inboxSource.slice(handoffStart, handoffEnd);

  assert.match(handoff, /item_id: selected\.item_id/);
  for (const field of [
    'season_id',
    'working_title',
    'premise',
    'listener_takeaway',
    'episode_type',
    'target_air_date',
    'owner_person_id',
    'host_person_ids',
  ]) {
    assert.match(handoff, new RegExp(`${field}: mastermindReview\\.${field}|${field}:`));
  }
  assert.doesNotMatch(
    handoff,
    /selected\.(?:title|details|comments|status|priority|target_date)/
  );
});

test('prefills the review from the allowlisted structured pitch without copying private intake data', () => {
  assert.match(inboxSource, /buildMastermindReviewPrefill/);
  assert.match(inboxSource, /item\?\.episode_request/);
  assert.match(inboxSource, /request\.working_title/);
  assert.match(inboxSource, /request\.premise/);
  assert.match(inboxSource, /request\.listener_takeaway/);
  assert.match(inboxSource, /request\.preferred_air_date/);
  const helperStart = inboxSource.indexOf(
    'export function buildMastermindReviewPrefill'
  );
  const helperEnd = inboxSource.indexOf('\nfunction formatDateTime', helperStart);
  const helper = inboxSource.slice(helperStart, helperEnd);
  assert.doesNotMatch(helper, /details|comments|email|shipping|contact/);
});

test('explains idempotent outcomes and preserves the source request status', () => {
  assert.match(inboxSource, /data\.created === true/);
  assert.match(inboxSource, /No duplicate was created/);
  assert.match(inboxSource, /request status is unchanged/);
  assert.match(inboxSource, /request details,[\s\S]*comments,[\s\S]*status are never copied/);
  assert.doesNotMatch(inboxSource, /from_intake/);
});
