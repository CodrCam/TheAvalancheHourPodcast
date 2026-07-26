import test from 'node:test';
import assert from 'node:assert/strict';
import { ACCESS_GROUPS } from '../lib/accessControl.mjs';
import { getTeamLandingForGroups } from '../lib/teamLanding.mjs';

test('admins land on the Team Studio home', () => {
  assert.equal(getTeamLandingForGroups([ACCESS_GROUPS.ADMIN]), '/studio');
});

test('hosts and studio managers land on the Team Studio home', () => {
  assert.equal(getTeamLandingForGroups([ACCESS_GROUPS.HOST]), '/studio');
  assert.equal(
    getTeamLandingForGroups([ACCESS_GROUPS.STUDIO_MANAGER]),
    '/studio'
  );
});

test('a combined host and logistics user lands on the Team Studio home', () => {
  assert.equal(
    getTeamLandingForGroups([
      ACCESS_GROUPS.LOGISTICS,
      ACCESS_GROUPS.HOST,
    ]),
    '/studio'
  );
});

test('logistics-only users land directly in orders', () => {
  assert.equal(
    getTeamLandingForGroups([ACCESS_GROUPS.LOGISTICS]),
    '/admin/orders'
  );
});

test('unknown groups return to login with an authorization error', () => {
  assert.equal(
    getTeamLandingForGroups(['unknown']),
    '/admin/login?error=unauthorized_group'
  );
});
