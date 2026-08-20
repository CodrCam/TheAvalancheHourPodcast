import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

const [dashboardSource, routeSource] = await Promise.all([
  readFile(
    new URL('../pages/admin/studios/index.js', import.meta.url),
    'utf8'
  ),
  readFile(
    new URL('../pages/api/studio/episodes/index.js', import.meta.url),
    'utf8'
  ),
]);

test('the Studio manager route fails closed before rendering creation tools', () => {
  assert.match(
    dashboardSource,
    /studioLayout \? \{ requiredPermission: 'episodes:manage' \} : \{\}/
  );
});

test('manual Episode Studio creation is an audited exception, not a parallel default', () => {
  assert.match(dashboardSource, /creation_exception_kind/);
  assert.match(dashboardSource, /creation_exception_reason/);
  assert.match(dashboardSource, /Why this episode cannot start from a reviewed Mastermind plan/);
  assert.match(dashboardSource, /!form\.producer_person_id/);

  assert.match(routeSource, /\['legacy', 'urgent_exception'\]/);
  assert.match(routeSource, /creationExceptionReason\.length < 10/);
  assert.match(routeSource, /creationExceptionReason\.length > 500/);
  assert.match(routeSource, /creation_path: 'manual_exception'/);
  assert.match(routeSource, /creation_exception_reason: creationExceptionReason/);
  assert.match(routeSource, /!producerPersonId/);
});
