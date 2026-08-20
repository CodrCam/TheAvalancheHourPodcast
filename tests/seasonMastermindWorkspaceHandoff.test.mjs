import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const workspaceSource = await readFile(
  new URL('../components/SeasonMastermindWorkspace.js', import.meta.url),
  'utf8'
);
const stylesheetSource = await readFile(
  new URL('../styles/SeasonMastermind.module.css', import.meta.url),
  'utf8'
);
const mastermindApiSource = await readFile(
  new URL('../pages/api/studio/mastermind.js', import.meta.url),
  'utf8'
);

function sourceBetween(start, end) {
  const startIndex = workspaceSource.indexOf(start);
  const endIndex = workspaceSource.indexOf(end, startIndex + start.length);
  assert.notEqual(startIndex, -1, `Missing source marker: ${start}`);
  assert.notEqual(endIndex, -1, `Missing source marker: ${end}`);
  return workspaceSource.slice(startIndex, endIndex);
}

test('Mastermind exposes a manager-only Ready-plan handoff with an in-flight lock', () => {
  const handoff = sourceBetween(
    'async function createEpisodeStudioFromPlan()',
    'function setHostAssignment('
  );

  assert.match(
    workspaceSource,
    /workspace\.canManage\s*&&\s*studioSession\?\.permissions\?\.includes\('mastermind:manage'\)\s*&&\s*studioSession\?\.permissions\?\.includes\('episodes:manage'\)/
  );
  assert.match(handoff, /!canHandoffEpisode/);
  assert.match(handoff, /selectedPlan\.status !== 'ready'/);
  assert.match(handoff, /episodeHandoffLock\.current/);
  assert.match(handoff, /episodeHandoffLock\.current = true/);
  assert.match(handoff, /episodeHandoffLock\.current = false/);
  assert.match(
    handoff,
    /episode_plan_id: selectedPlan\.episode_plan_id,\s*season_id: selectedPlan\.season_id,\s*producer_person_id: producerPersonId/
  );
  assert.match(handoff, /!selectedProducerIsCurrent/);
  assert.doesNotMatch(handoff, /setDraft\(/);
  assert.doesNotMatch(handoff, /setInitialDraft\(/);
  assert.doesNotMatch(handoff, /setDrawerMode\(/);
});

test('Mastermind requires a reviewed current producer for the new Studio queue', () => {
  assert.match(workspaceSource, /listMastermindProducerOptions/);
  assert.match(workspaceSource, /<span>Producer<\/span>/);
  assert.match(workspaceSource, /<option value="">Choose a producer<\/option>/);
  assert.match(
    workspaceSource,
    /Required so the Episode Studio enters a named\s*producer&apos;s task queue\./
  );
  assert.match(workspaceSource, /!selectedProducerIsCurrent/);
  assert.doesNotMatch(workspaceSource, /Choose later/);
  assert.match(stylesheetSource, /\.producerPicker/);

  assert.match(mastermindApiSource, /capabilities: getPersonStudioCapabilities/);
  assert.match(mastermindApiSource, /producers: people/);
  assert.match(mastermindApiSource, /producers: directory\.producers/);
  assert.match(
    mastermindApiSource,
    /normalizeMastermindMutation\(req\.body, \{\s*directory: directory\.hosts/
  );
});

test('Mastermind distinguishes linked and link-pending API outcomes', () => {
  const handoff = sourceBetween(
    'async function createEpisodeStudioFromPlan()',
    'function setHostAssignment('
  );

  assert.match(handoff, /response\.status === 202/);
  assert.match(handoff, /data\.code === 'EPISODE_CREATED_LINK_PENDING'/);
  assert.match(handoff, /!\[200, 201\]\.includes\(response\.status\)/);
  assert.match(handoff, /response\.status === 201 \|\| data\.created === true/);
  assert.match(handoff, /kind: 'pending'/);
  assert.match(handoff, /kind: 'linked'/);
  assert.match(handoff, /status: 'scheduled'/);
  assert.match(
    handoff,
    /status: data\.plan\?\.status \|\| selectedPlan\.status/
  );
  assert.match(workspaceSource, />\s*Open Episode Studio\s*</);
  assert.match(workspaceSource, /\? 'Repair link'/);
  assert.match(stylesheetSource, /\.handoffPending/);
});

test('Episode Studio destinations are validated before a drawer link is rendered', () => {
  assert.match(
    workspaceSource,
    /function episodeStudioHref\([\s\S]*SAFE_HANDOFF_ID\.test\(episodeId\)[\s\S]*encodeURIComponent\(episodeId\)/
  );
  assert.match(
    workspaceSource,
    /const linkedEpisodeHref = episodeStudioHref\(plan\.linked_episode_id/
  );
  assert.match(workspaceSource, /href=\{linkedEpisodeHref\}/);
  assert.match(workspaceSource, /Episode Studio link unavailable/);
  assert.doesNotMatch(
    workspaceSource,
    /href=\{`\/studio\/episodes\/\$\{encodeURIComponent\(plan\.linked_episode_id\)/
  );
  assert.match(handoffResponseGuard(), /EPISODE_HANDOFF_DESTINATION_MISSING/);
});

test('a linked plan becomes a read-only pointer to Episode Studio', () => {
  assert.match(
    workspaceSource,
    /const selectedPlanIsLinked = Boolean\(selectedPlan\?\.linked_episode_id\)/
  );
  assert.match(
    workspaceSource,
    /workspace\.canManage && !selectedPlanIsLinked \? \(/
  );
  assert.match(
    workspaceSource,
    /This locked snapshot records what planning handed off\.\s*Open Episode Studio for the current production title,\s*date, assignments, and status\./
  );
});

function handoffResponseGuard() {
  return sourceBetween(
    "const episodeId = String(data.episode?.episode_id || '').trim();",
    'const nextPlan = normalizeMastermindPlan('
  );
}
