import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_GROUPS,
  ACCESS_PERMISSIONS,
  getPermissionsForGroups,
  getPrimaryAccessGroup,
  hasAccessPermission,
  normalizeAccessGroups,
} from '../lib/accessControl.mjs';

test('keeps host access limited to the Studio and the host own profile', () => {
  const permissions = getPermissionsForGroups([ACCESS_GROUPS.HOST]);

  assert.deepEqual(permissions, [
    ACCESS_PERMISSIONS.STUDIO_READ,
    ACCESS_PERMISSIONS.RESOURCES_READ,
    ACCESS_PERMISSIONS.EPISODES_READ,
    ACCESS_PERMISSIONS.EPISODES_UPDATE,
    ACCESS_PERMISSIONS.EPISODES_SUBMIT,
    ACCESS_PERMISSIONS.PROFILE_SELF_READ,
    ACCESS_PERMISSIONS.PROFILE_SELF_UPDATE,
  ]);
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.PROFILES_UPDATE),
    false
  );
  assert.equal(permissions.includes(ACCESS_PERMISSIONS.ORDERS_READ), false);
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.EPISODES_MANAGE),
    false
  );
});

test('gives Studio managers host access plus Studio management permissions', () => {
  const permissions = getPermissionsForGroups([
    ACCESS_GROUPS.STUDIO_MANAGER,
  ]);

  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.RESOURCES_READ),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.RESOURCES_PUBLISH),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.EPISODES_MANAGE),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.PROFILES_UPDATE),
    true
  );
  assert.equal(permissions.includes(ACCESS_PERMISSIONS.ORDERS_READ), false);
});

test('combines logistics and Studio manager permissions for a multi-group user', () => {
  const groups = [
    ACCESS_GROUPS.LOGISTICS,
    ACCESS_GROUPS.STUDIO_MANAGER,
  ];
  const permissions = getPermissionsForGroups(groups);

  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.ORDERS_UPDATE),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.INVENTORY_UPDATE),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.RESOURCES_PUBLISH),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.PROFILES_UPDATE),
    true
  );
  assert.equal(
    permissions.includes(ACCESS_PERMISSIONS.USERS_MANAGE),
    false
  );
});

test('treats admin as the all-permissions group', () => {
  const permissions = getPermissionsForGroups([ACCESS_GROUPS.ADMIN]);

  assert.deepEqual(
    new Set(permissions),
    new Set(Object.values(ACCESS_PERMISSIONS))
  );
});

test('normalizes duplicate and unknown group names', () => {
  assert.deepEqual(
    normalizeAccessGroups([
      ACCESS_GROUPS.HOST,
      'unknown',
      ACCESS_GROUPS.HOST,
      '',
    ]),
    [ACCESS_GROUPS.HOST]
  );
});

test('uses the strongest group only as a display label, not for permissions', () => {
  const groups = [
    ACCESS_GROUPS.LOGISTICS,
    ACCESS_GROUPS.STUDIO_MANAGER,
  ];

  assert.equal(
    getPrimaryAccessGroup(groups),
    ACCESS_GROUPS.STUDIO_MANAGER
  );
  assert.equal(
    hasAccessPermission(groups, ACCESS_PERMISSIONS.ORDERS_UPDATE),
    true
  );
  assert.equal(
    hasAccessPermission(groups, ACCESS_PERMISSIONS.RESOURCES_PUBLISH),
    true
  );
});
