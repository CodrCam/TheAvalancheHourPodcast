export const STUDIO_NAV_SECTIONS = Object.freeze({
  studio: 'Studio',
  my_work: 'My Work',
  manage: 'Manage',
  operations: 'Operations',
});

export const STUDIO_NAV_ITEMS = Object.freeze([
  {
    href: '/studio',
    label: 'Home',
    icon: 'home',
    permission: 'studio:read',
    section: 'studio',
    exact: true,
  },
  {
    href: '/studio/resources',
    label: 'Resources',
    icon: 'resources',
    permission: 'resources:read',
    section: 'studio',
    activePaths: ['/studio/resources', '/studio/manage/resources'],
  },
  {
    href: '/studio/inbox',
    label: 'Team Inbox',
    icon: 'inbox',
    permission: 'intake:read',
    section: 'studio',
  },
  {
    href: '/studio/episodes',
    label: 'My Episodes',
    icon: 'episodes',
    permission: 'episodes:read',
    section: 'my_work',
  },
  {
    href: '/studio/profile',
    label: 'My Profile',
    icon: 'profile',
    permission: 'profile:self:read',
    section: 'my_work',
  },
  {
    href: '/studio/mic-kits',
    label: 'Mic Kits',
    icon: 'mic_kits',
    permission: 'mic_kits:read',
    section: 'my_work',
  },
  {
    href: '/studio/manage/episodes',
    label: 'Episode Calendar',
    icon: 'calendar',
    permission: 'episodes:manage',
    section: 'manage',
  },
  {
    href: '/studio/manage/access',
    label: 'Host Access',
    icon: 'access',
    permission: 'studio_access:manage',
    section: 'manage',
  },
  {
    href: '/studio/manage/sponsor-reads',
    label: 'Sponsor Reads',
    icon: 'sponsor_reads',
    permission: 'sponsor_reads:read',
    section: 'manage',
  },
  {
    href: '/admin',
    label: 'Operations overview',
    icon: 'admin',
    anyPermission: [
      'orders:read',
      'inventory:read',
      'products:read',
      'sponsors:read',
      'people:read',
      'banners:read',
    ],
    section: 'operations',
    exact: true,
  },
  {
    href: '/admin/products',
    label: 'Products & stock',
    icon: 'products',
    permission: 'products:read',
    section: 'operations',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    icon: 'orders',
    permission: 'orders:read',
    section: 'operations',
  },
  {
    href: '/admin/site-content',
    label: 'Site Content',
    icon: 'site_content',
    permission: 'banners:read',
    section: 'operations',
  },
  {
    href: '/admin/people',
    label: 'Hosts & Team',
    icon: 'people',
    permission: 'people:read',
    section: 'operations',
  },
  {
    href: '/admin/sponsors',
    label: 'Sponsors',
    icon: 'sponsors',
    permission: 'sponsors:read',
    section: 'operations',
  },
  {
    href: '/admin/mic-kits',
    label: 'Mic Kit Checkout',
    icon: 'mic_kit_checkout',
    permission: 'mic_kits:manage',
    section: 'operations',
  },
  {
    href: '/admin/system-health',
    label: 'System Health',
    icon: 'system_health',
    permission: 'audit:read',
    section: 'operations',
  },
]);

export function getVisibleStudioNavigationItems(permissions = []) {
  const allowed = new Set(Array.isArray(permissions) ? permissions : []);
  return STUDIO_NAV_ITEMS.filter((item) => {
    if (item.permission) return allowed.has(item.permission);
    if (item.anyPermission) {
      return item.anyPermission.some((permission) => allowed.has(permission));
    }
    return true;
  });
}
