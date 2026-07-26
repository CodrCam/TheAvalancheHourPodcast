import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ACCESS_PERMISSIONS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';
import { getMicKitAccessForPermissions } from '../lib/micKitAccess.mjs';

test('admin mic-kit controls follow account permissions, not the page entry point', () => {
  const access = getMicKitAccessForPermissions(
    getPermissionsForGroups(['admin', 'logistics', 'host'])
  );

  assert.deepEqual(access, {
    canRead: true,
    canRequest: true,
    canManage: true,
  });
});

test('shared mic-kit access does not elevate non-admin team members', () => {
  const hostAccess = getMicKitAccessForPermissions(
    getPermissionsForGroups(['host'])
  );
  const logisticsAccess = getMicKitAccessForPermissions(
    getPermissionsForGroups(['logistics'])
  );

  assert.equal(hostAccess.canManage, false);
  assert.equal(logisticsAccess.canManage, false);
  assert.equal(hostAccess.canRequest, true);
  assert.equal(logisticsAccess.canRequest, true);
});

test('mic-kit access ignores malformed permission collections', () => {
  assert.deepEqual(getMicKitAccessForPermissions('mic_kits:manage'), {
    canRead: false,
    canRequest: false,
    canManage: false,
  });
  assert.equal(
    getMicKitAccessForPermissions([
      ACCESS_PERMISSIONS.MIC_KITS_MANAGE,
    ]).canManage,
    true
  );
});
