import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';

test('Mastermind-linked Episode Studios cannot leave a dead planning link', async () => {
  const [route, workspace] = await Promise.all([
    readFile(
      new URL('../pages/api/studio/episodes/[episodeId].js', import.meta.url),
      'utf8'
    ),
    readFile(
      new URL('../components/EpisodeStudioWorkspace.js', import.meta.url),
      'utf8'
    ),
  ]);
  const deleteBranch = route.indexOf("if (req.method === 'DELETE')");
  const linkedGuard = route.indexOf(
    'MASTERMIND_LINKED_STUDIO_DELETE_BLOCKED',
    deleteBranch
  );
  const tombstoneWrite = route.indexOf('deleted_at: new Date().toISOString()', deleteBranch);

  assert.ok(deleteBranch >= 0);
  assert.ok(linkedGuard > deleteBranch);
  assert.ok(tombstoneWrite > linkedGuard);
  assert.match(workspace, /episode\.source_mastermind_plan_id \? \(/);
  assert.match(workspace, /Permanent deletion is protected/);
  assert.match(workspace, /planning handoff\s+never points to a missing episode/);
});
