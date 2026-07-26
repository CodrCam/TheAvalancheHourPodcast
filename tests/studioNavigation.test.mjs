import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_GROUPS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';
import {
  getVisibleStudioNavigationItems,
} from '../lib/studioNavigation.mjs';

function visibleHrefs(groups) {
  return getVisibleStudioNavigationItems(
    getPermissionsForGroups(groups)
  ).map((item) => item.href);
}

test('host-only navigation does not expose operations or management links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.HOST]);

  assert.equal(hrefs.includes('/studio/episodes'), true);
  assert.equal(hrefs.includes('/studio/manage/episodes'), false);
  assert.equal(hrefs.some((href) => href.startsWith('/admin')), false);
});

test('Studio managers keep management links without gaining operations links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.STUDIO_MANAGER]);

  assert.equal(hrefs.includes('/studio/manage/episodes'), true);
  assert.equal(hrefs.includes('/studio/manage/access'), true);
  assert.equal(hrefs.includes('/admin/products'), false);
});

test('combined Studio and logistics users keep both navigation surfaces', () => {
  const hrefs = visibleHrefs([
    ACCESS_GROUPS.STUDIO_MANAGER,
    ACCESS_GROUPS.LOGISTICS,
  ]);

  assert.equal(hrefs.includes('/studio/manage/episodes'), true);
  assert.equal(hrefs.includes('/admin'), true);
  assert.equal(hrefs.includes('/admin/products'), true);
  assert.equal(hrefs.includes('/admin/orders'), true);
  assert.equal(hrefs.includes('/admin/system-health'), false);
});

test('admins see Studio, management, inventory, and system operations links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.ADMIN]);

  for (const href of [
    '/studio/episodes',
    '/studio/manage/episodes',
    '/admin',
    '/admin/products',
    '/admin/orders',
    '/admin/system-health',
  ]) {
    assert.equal(hrefs.includes(href), true, href);
  }
});
