export const STUDIO_NAV_SECTIONS = Object.freeze({
  overview: 'Overview',
  work: 'Work',
  planning_admin: 'Planning & admin',
});

export const STUDIO_NAV_DISCLOSURES = Object.freeze({
  team_tools: 'Team tools',
  planning_admin: 'Planning & admin',
});

export const STUDIO_NAV_ITEMS = Object.freeze([
  {
    href: '/studio',
    label: 'Overview',
    icon: 'home',
    permission: 'studio:read',
    section: 'overview',
    exact: true,
  },
  {
    href: '/studio/episodes',
    label: 'Host Studio',
    icon: 'episodes',
    permission: 'episodes:read',
    section: 'work',
    excludeActiveSuffixes: ['/questionnaire', '/production'],
  },
  {
    href: '/studio/questionnaires',
    label: 'Guest Questionnaires',
    icon: 'questionnaires',
    permission: 'episodes:read',
    section: 'work',
    activeSuffixes: ['/questionnaire'],
  },
  {
    href: '/studio/production',
    label: 'Producer Tasks',
    icon: 'production',
    permission: 'episodes:read',
    capability: 'producer_tasks',
    capabilityFallbackPermission: 'episodes:manage',
    section: 'work',
    activeSuffixes: ['/production'],
  },
  {
    href: '/studio/resources',
    label: 'Resources',
    icon: 'resources',
    permission: 'resources:read',
    section: 'work',
    disclosure: 'team_tools',
    activePaths: ['/studio/resources', '/studio/manage/resources'],
  },
  {
    href: '/studio/inbox',
    label: 'Follow-ups',
    icon: 'inbox',
    permission: 'intake:read',
    section: 'work',
    disclosure: 'team_tools',
  },
  {
    href: '/studio/profile',
    label: 'My Profile',
    icon: 'profile',
    permission: 'profile:self:read',
    section: 'work',
    disclosure: 'team_tools',
  },
  {
    href: '/studio/mic-kits',
    label: 'Mic Kits',
    icon: 'mic_kits',
    permission: 'mic_kits:read',
    section: 'work',
    disclosure: 'team_tools',
  },
  {
    href: '/studio/mastermind',
    label: 'Season Mastermind',
    icon: 'mastermind',
    permission: 'mastermind:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
    feature: 'season_mastermind',
  },
  {
    href: '/studio/manage/episodes',
    label: 'Schedule & assignments',
    icon: 'calendar',
    permission: 'episodes:manage',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/studio/manage/sponsor-reads',
    label: 'Sponsor Reads',
    icon: 'sponsor_reads',
    permission: 'sponsor_reads:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/products',
    label: 'Products & stock',
    icon: 'products',
    permission: 'products:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: 'orders',
    permission: 'orders:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/site-content',
    label: 'Site Content',
    icon: 'site_content',
    permission: 'banners:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/people',
    label: 'Hosts & Team',
    icon: 'people',
    permission: 'people:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/sponsors',
    label: 'Sponsors',
    icon: 'sponsors',
    permission: 'sponsors:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/mic-kits',
    label: 'Mic Kit Checkout',
    icon: 'mic_kit_checkout',
    permission: 'mic_kits:manage',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/access-log',
    label: 'Access Log',
    icon: 'access_log',
    permission: 'audit:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/admin/system-health',
    label: 'System Health',
    icon: 'system_health',
    permission: 'audit:read',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
  {
    href: '/studio/manage/access',
    label: 'Host & Team Access',
    icon: 'access',
    permission: 'studio_access:manage',
    section: 'planning_admin',
    disclosure: 'planning_admin',
  },
]);

export function getVisibleStudioNavigationItems(
  permissions = [],
  features = {},
  capabilities = {}
) {
  const allowed = new Set(Array.isArray(permissions) ? permissions : []);
  return STUDIO_NAV_ITEMS.filter((item) => {
    if (
      item.feature === 'season_mastermind' &&
      features?.season_mastermind !== true
    ) {
      return false;
    }
    if (
      item.capability &&
      capabilities?.[item.capability] !== true &&
      !allowed.has(item.capabilityFallbackPermission)
    ) {
      return false;
    }
    if (item.permission) return allowed.has(item.permission);
    if (item.anyPermission) {
      return item.anyPermission.some((permission) => allowed.has(permission));
    }
    return true;
  });
}

export function isStudioNavigationItemActive(item = {}, value = '') {
  const currentPath = String(value || '').split(/[?#]/)[0];
  const excluded = item.excludeActiveSuffixes?.some((suffix) =>
    currentPath.endsWith(suffix)
  );
  if (excluded) return false;

  return Boolean(
    item.activeSuffixes?.some((suffix) => currentPath.endsWith(suffix)) ||
      item.activePaths?.some((path) => currentPath.startsWith(path)) ||
      (item.exact
        ? currentPath === item.href
        : currentPath.startsWith(item.href || '__no_route__'))
  );
}
