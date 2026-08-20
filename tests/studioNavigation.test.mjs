import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ACCESS_GROUPS,
  getPermissionsForGroups,
} from '../lib/accessControl.mjs';
import {
  getVisibleStudioNavigationItems,
  isStudioNavigationItemActive,
  STUDIO_NAV_ITEMS,
  STUDIO_NAV_SECTIONS,
} from '../lib/studioNavigation.mjs';

function visibleHrefs(groups, features = {}, capabilities = {}) {
  return getVisibleStudioNavigationItems(
    getPermissionsForGroups(groups),
    features,
    capabilities
  ).map((item) => item.href);
}

test('keeps Season Mastermind out of navigation while its runtime flag is off', () => {
  for (const group of Object.values(ACCESS_GROUPS)) {
    assert.equal(
      visibleHrefs([group]).includes('/studio/mastermind'),
      false,
      group
    );
  }
});

test('shows enabled Season Mastermind only to planning roles', () => {
  const features = { season_mastermind: true };
  for (const group of [
    ACCESS_GROUPS.HOST,
    ACCESS_GROUPS.STUDIO_MANAGER,
    ACCESS_GROUPS.ADMIN,
  ]) {
    assert.equal(
      visibleHrefs([group], features).includes('/studio/mastermind'),
      true,
      group
    );
  }
  assert.equal(
    visibleHrefs([ACCESS_GROUPS.LOGISTICS], features).includes(
      '/studio/mastermind'
    ),
    false
  );
});

test('keeps role-relevant workflow links primary and planning in one disclosure', () => {
  const items = getVisibleStudioNavigationItems(
    getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    { season_mastermind: true },
    { producer_tasks: true }
  );

  const primaryWork = items.filter(
    (item) => item.section === 'work' && !item.disclosure
  );

  assert.deepEqual(
    primaryWork.map((item) => [item.label, item.href]),
    [
      ['Host Studio', '/studio/episodes'],
      ['Guest Questionnaires', '/studio/questionnaires'],
      ['Producer Tasks', '/studio/production'],
    ]
  );

  const mastermind = items.find((item) => item.href === '/studio/mastermind');
  assert.equal(mastermind.section, 'planning_admin');
  assert.equal(mastermind.disclosure, 'planning_admin');
});

test('preserves every existing Studio and operations destination', () => {
  assert.deepEqual(
    STUDIO_NAV_ITEMS.map((item) => item.href),
    [
      '/studio',
      '/studio/episodes',
      '/studio/questionnaires',
      '/studio/production',
      '/studio/resources',
      '/studio/inbox',
      '/studio/profile',
      '/studio/mic-kits',
      '/studio/mastermind',
      '/studio/manage/episodes',
      '/studio/manage/sponsor-reads',
      '/admin/products',
      '/admin/orders',
      '/admin/site-content',
      '/admin/people',
      '/admin/sponsors',
      '/admin/mic-kits',
      '/admin/access-log',
      '/admin/system-health',
      '/studio/manage/access',
    ]
  );
});

test('keeps infrequent Host & Team Access at the bottom of the navigation', () => {
  for (const group of [
    ACCESS_GROUPS.STUDIO_MANAGER,
    ACCESS_GROUPS.ADMIN,
  ]) {
    const items = getVisibleStudioNavigationItems(
      getPermissionsForGroups([group]),
      { season_mastermind: true }
    );
    const accessItem = items.at(-1);

    assert.equal(accessItem.href, '/studio/manage/access', group);
    assert.equal(accessItem.label, 'Host & Team Access', group);
    assert.equal(accessItem.disclosure, 'planning_admin', group);
  }
});

test('uses no more than three navigation sections for every role', () => {
  assert.deepEqual(Object.keys(STUDIO_NAV_SECTIONS), [
    'overview',
    'work',
    'planning_admin',
  ]);

  for (const group of Object.values(ACCESS_GROUPS)) {
    const sections = new Set(
      getVisibleStudioNavigationItems(
        getPermissionsForGroups([group]),
        { season_mastermind: true },
        { producer_tasks: true }
      ).map((item) => item.section)
    );
    assert.equal(sections.size <= 3, true, group);
  }
});

test('groups secondary team tools away from primary role workflows', () => {
  const items = getVisibleStudioNavigationItems(
    getPermissionsForGroups([ACCESS_GROUPS.HOST]),
    { season_mastermind: true }
  );

  assert.deepEqual(
    items
      .filter((item) => item.section === 'work' && !item.disclosure)
      .map((item) => item.label),
    ['Host Studio', 'Guest Questionnaires']
  );
  assert.deepEqual(
    items
      .filter((item) => item.disclosure === 'team_tools')
      .map((item) => item.label),
    ['Resources', 'Follow-ups', 'My Profile', 'Mic Kits']
  );
  assert.deepEqual(
    items
      .filter((item) => item.disclosure === 'planning_admin')
      .map((item) => item.label),
    ['Season Mastermind']
  );
});

test('ordinary host navigation hides Producer Tasks and management links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.HOST]);

  assert.equal(hrefs.includes('/studio/episodes'), true);
  assert.equal(hrefs.includes('/studio/questionnaires'), true);
  assert.equal(hrefs.includes('/studio/production'), false);
  assert.equal(hrefs.includes('/studio/inbox'), true);
  assert.equal(hrefs.includes('/studio/manage/episodes'), false);
  assert.equal(hrefs.some((href) => href.startsWith('/admin')), false);
});

test('sessions with producer capability can see Producer Tasks without management permission', () => {
  const hrefs = visibleHrefs(
    [ACCESS_GROUPS.HOST],
    {},
    { producer_tasks: true }
  );

  assert.equal(hrefs.includes('/studio/production'), true);
  assert.equal(hrefs.includes('/studio/manage/episodes'), false);
});

test('resolves nested workflow routes to one active navigation destination', () => {
  const item = (href) => STUDIO_NAV_ITEMS.find((entry) => entry.href === href);

  assert.equal(
    isStudioNavigationItemActive(
      item('/studio/questionnaires'),
      '/studio/episodes/[episodeId]/questionnaire?preview=1'
    ),
    true
  );
  assert.equal(
    isStudioNavigationItemActive(
      item('/studio/episodes'),
      '/studio/episodes/[episodeId]/questionnaire'
    ),
    false
  );
  assert.equal(
    isStudioNavigationItemActive(
      item('/studio/production'),
      '/studio/episodes/[episodeId]/production'
    ),
    true
  );
  assert.equal(
    isStudioNavigationItemActive(
      item('/studio/episodes'),
      '/studio/episodes/[episodeId]/production'
    ),
    false
  );
  assert.equal(
    isStudioNavigationItemActive(
      item('/studio/resources'),
      '/studio/manage/resources/[resourceId]'
    ),
    true
  );
  assert.equal(isStudioNavigationItemActive(item('/studio'), '/studio'), true);
  assert.equal(
    isStudioNavigationItemActive(item('/studio'), '/studio/episodes'),
    false
  );
});

test('Studio managers keep management links without gaining operations links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.STUDIO_MANAGER]);

  assert.equal(hrefs.includes('/studio/manage/episodes'), true);
  assert.equal(hrefs.includes('/studio/inbox'), true);
  assert.equal(hrefs.includes('/studio/manage/access'), true);
  assert.equal(hrefs.includes('/admin/products'), false);
});

test('combined Studio and logistics users keep both navigation surfaces', () => {
  const hrefs = visibleHrefs([
    ACCESS_GROUPS.STUDIO_MANAGER,
    ACCESS_GROUPS.LOGISTICS,
  ]);

  assert.equal(hrefs.includes('/studio/manage/episodes'), true);
  assert.equal(hrefs.includes('/admin'), false);
  assert.equal(hrefs.includes('/admin/products'), true);
  assert.equal(hrefs.includes('/admin/orders'), true);
  assert.equal(hrefs.includes('/admin/access-log'), false);
  assert.equal(hrefs.includes('/admin/system-health'), false);
});

test('admins see Studio, management, inventory, and system operations links', () => {
  const hrefs = visibleHrefs([ACCESS_GROUPS.ADMIN]);

  for (const href of [
    '/studio/episodes',
    '/studio/manage/episodes',
    '/admin/products',
    '/admin/orders',
    '/admin/access-log',
    '/admin/system-health',
  ]) {
    assert.equal(hrefs.includes(href), true, href);
  }
});
