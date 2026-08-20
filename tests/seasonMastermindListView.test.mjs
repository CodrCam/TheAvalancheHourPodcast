import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';

const workspaceSource = fs.readFileSync(
  new URL('../components/SeasonMastermindWorkspace.js', import.meta.url),
  'utf8'
);
const stylesheetSource = fs.readFileSync(
  new URL('../styles/SeasonMastermind.module.css', import.meta.url),
  'utf8'
);

test('Season Mastermind defaults to a compact full-season list', () => {
  assert.match(workspaceSource, /id: 'list', label: 'List'/);
  assert.match(workspaceSource, /useState\(previewData\?\.view \|\| 'list'\)/);
  assert.match(workspaceSource, /<table className=\{styles\.planTable\}>/);
  assert.match(workspaceSource, /Every episode plan/);
  assert.match(workspaceSource, /plan\.source_episode_number \|\| '—'/);
  assert.match(workspaceSource, /plan\.sponsor_commitments/);
  assert.match(workspaceSource, /Mastermind dates are planning-only\./);
  assert.match(workspaceSource, /Workbook coverage/);
  assert.match(workspaceSource, /Contact, shipping, questionnaire answers/);
  assert.match(workspaceSource, /plan\.status === 'ready'[\s\S]*'Create Studio'/);
  assert.match(workspaceSource, /async function markPlanReady\(\)/);
  assert.match(workspaceSource, /Review & mark ready/);
});

test('list remains semantic on desktop and converts to labeled cards on phones', () => {
  assert.match(stylesheetSource, /\.planTable th/);
  assert.match(stylesheetSource, /content: attr\(data-label\)/);
  assert.match(stylesheetSource, /\.listScroll:focus-visible/);
});
