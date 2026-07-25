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
    ACCESS_PERMISSIONS.MIC_KITS_READ,
    ACCESS_PERMISSIONS.MIC_KITS_REQUEST,
    ACCESS_PERMISSIONS.NOTIFICATIONS_READ,
    ACCESS_PERMISSIONS.NOTIFICATIONS_UPDATE,
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

test('makes the mic kit board visible to every role while limiting logistics controls', () => {
  for (const group of Object.values(ACCESS_GROUPS)) {
    const permissions = getPermissionsForGroups([group]);
    assert.equal(
      permissions.includes(ACCESS_PERMISSIONS.MIC_KITS_READ),
      true,
      `${group} should be able to read the mic kit board`
    );
    assert.equal(
      permissions.includes(ACCESS_PERMISSIONS.MIC_KITS_REQUEST),
      true,
      `${group} should be able to request a mic kit`
    );
  }

  assert.equal(
    getPermissionsForGroups([ACCESS_GROUPS.HOST]).includes(
      ACCESS_PERMISSIONS.MIC_KITS_MANAGE
    ),
    false
  );
  assert.equal(
    getPermissionsForGroups([ACCESS_GROUPS.ADMIN]).includes(
      ACCESS_PERMISSIONS.MIC_KITS_MANAGE
    ),
    true
  );
  for (const group of [
    ACCESS_GROUPS.STUDIO_MANAGER,
    ACCESS_GROUPS.LOGISTICS,
    ACCESS_GROUPS.HOST,
  ]) {
    assert.equal(
      getPermissionsForGroups([group]).includes(
        ACCESS_PERMISSIONS.MIC_KITS_MANAGE
      ),
      false,
      `${group} should not be able to operate the admin checkout desk`
    );
  }
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
