import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_GROUPS,
  ACCESS_PERMISSIONS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';
import {
  isAllowedSelfProfileImage,
  profileBioToPlainText,
} from '../lib/peoplePresentation.mjs';
import { safeJsonLdStringify } from '../lib/structuredData.mjs';

const FINANCIAL_AND_SITE_ADMIN_PERMISSIONS = [
  ACCESS_PERMISSIONS.ORDERS_READ,
  ACCESS_PERMISSIONS.ORDERS_UPDATE,
  ACCESS_PERMISSIONS.ORDERS_EXPORT,
  ACCESS_PERMISSIONS.INVENTORY_READ,
  ACCESS_PERMISSIONS.INVENTORY_UPDATE,
  ACCESS_PERMISSIONS.PRODUCTS_READ,
  ACCESS_PERMISSIONS.PRODUCTS_UPDATE,
  ACCESS_PERMISSIONS.PRODUCTS_PUBLISH,
  ACCESS_PERMISSIONS.PRODUCT_MEDIA_UPDATE,
  ACCESS_PERMISSIONS.SPONSORS_READ,
  ACCESS_PERMISSIONS.SPONSORS_UPDATE,
  ACCESS_PERMISSIONS.PEOPLE_READ,
  ACCESS_PERMISSIONS.PEOPLE_UPDATE,
  ACCESS_PERMISSIONS.BANNERS_READ,
  ACCESS_PERMISSIONS.BANNERS_UPDATE,
  ACCESS_PERMISSIONS.USERS_MANAGE,
  ACCESS_PERMISSIONS.AUDIT_READ,
];

for (const group of [ACCESS_GROUPS.HOST, ACCESS_GROUPS.STUDIO_MANAGER]) {
  test(`${group} cannot reach financial or site-administration permissions`, () => {
    const permissions = new Set(getPermissionsForGroups([group]));
    const leaked = FINANCIAL_AND_SITE_ADMIN_PERMISSIONS.filter((permission) =>
      permissions.has(permission)
    );

    assert.deepEqual(leaked, []);
  });
}

test('a host cannot manage assignments, access bindings, or published resources', () => {
  const permissions = new Set(
    getPermissionsForGroups([ACCESS_GROUPS.HOST])
  );
  const privilegedStudioPermissions = [
    ACCESS_PERMISSIONS.EPISODES_MANAGE,
    ACCESS_PERMISSIONS.STUDIO_ACCESS_MANAGE,
    ACCESS_PERMISSIONS.RESOURCES_UPDATE,
    ACCESS_PERMISSIONS.RESOURCES_PUBLISH,
    ACCESS_PERMISSIONS.PROFILES_READ,
    ACCESS_PERMISSIONS.PROFILES_UPDATE,
    ACCESS_PERMISSIONS.MIC_KITS_MANAGE,
  ];

  assert.deepEqual(
    privilegedStudioPermissions.filter((permission) =>
      permissions.has(permission)
    ),
    []
  );
});

test('common stored-HTML payloads cannot survive the public profile render path', () => {
  const payload =
    '</script><script>alert(1)</script><img src=x onerror=alert(2)><svg onload=alert(3)>';
  const plainText = profileBioToPlainText(payload);
  const jsonLd = safeJsonLdStringify({ description: payload });

  assert.equal(plainText.includes('<script'), false);
  assert.equal(plainText.includes('<img'), false);
  assert.equal(plainText.includes('<svg'), false);
  assert.equal(jsonLd.includes('</script>'), false);
  assert.equal(jsonLd.includes('<script>'), false);
});

test('self-service images cannot trigger scripts, remote tracking, or same-site actions', () => {
  const unsafeImages = [
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'https://tracker.example/pixel',
    '//tracker.example/pixel',
    '/api/store/admin/auth/logout',
    '/images/../api/store/admin/auth/logout',
  ];

  assert.deepEqual(
    unsafeImages.filter((image) => isAllowedSelfProfileImage(image)),
    []
  );
});
