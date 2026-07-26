export const ACCESS_PERMISSIONS = {
  ORDERS_READ: 'orders:read',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_EXPORT: 'orders:export',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_UPDATE: 'products:update',
  PRODUCTS_PUBLISH: 'products:publish',
  PRODUCT_MEDIA_UPDATE: 'product_media:update',
  SPONSORS_READ: 'sponsors:read',
  SPONSORS_UPDATE: 'sponsors:update',
  SPONSOR_READS_READ: 'sponsor_reads:read',
  SPONSOR_READS_UPDATE: 'sponsor_reads:update',
  PEOPLE_READ: 'people:read',
  PEOPLE_UPDATE: 'people:update',
  BANNERS_READ: 'banners:read',
  BANNERS_UPDATE: 'banners:update',
  USERS_MANAGE: 'users:manage',
  AUDIT_READ: 'audit:read',
  STUDIO_READ: 'studio:read',
  RESOURCES_READ: 'resources:read',
  RESOURCES_UPDATE: 'resources:update',
  RESOURCES_PUBLISH: 'resources:publish',
  ANNOUNCEMENTS_UPDATE: 'announcements:update',
  EPISODES_READ: 'episodes:read',
  EPISODES_UPDATE: 'episodes:update',
  EPISODES_SUBMIT: 'episodes:submit',
  EPISODES_MANAGE: 'episodes:manage',
  PROFILE_SELF_READ: 'profile:self:read',
  PROFILE_SELF_UPDATE: 'profile:self:update',
  PROFILES_READ: 'profiles:read',
  PROFILES_UPDATE: 'profiles:update',
  STUDIO_ACCESS_MANAGE: 'studio_access:manage',
  MIC_KITS_READ: 'mic_kits:read',
  MIC_KITS_REQUEST: 'mic_kits:request',
  MIC_KITS_MANAGE: 'mic_kits:manage',
  NOTIFICATIONS_READ: 'notifications:read',
  NOTIFICATIONS_UPDATE: 'notifications:update',
  INTAKE_READ: 'intake:read',
  INTAKE_CREATE: 'intake:create',
  INTAKE_MANAGE: 'intake:manage',
};

export const ACCESS_GROUPS = {
  ADMIN: 'admin',
  LOGISTICS: 'logistics',
  STUDIO_MANAGER: 'studio_manager',
  HOST: 'host',
};

const GROUP_PRIORITY = [
  ACCESS_GROUPS.ADMIN,
  ACCESS_GROUPS.STUDIO_MANAGER,
  ACCESS_GROUPS.LOGISTICS,
  ACCESS_GROUPS.HOST,
];

const HOST_PERMISSIONS = [
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
  ACCESS_PERMISSIONS.INTAKE_READ,
  ACCESS_PERMISSIONS.INTAKE_CREATE,
];

export const GROUP_PERMISSIONS = {
  [ACCESS_GROUPS.ADMIN]: Object.values(ACCESS_PERMISSIONS),
  [ACCESS_GROUPS.LOGISTICS]: [
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
    ACCESS_PERMISSIONS.PEOPLE_READ,
    ACCESS_PERMISSIONS.BANNERS_READ,
    ACCESS_PERMISSIONS.RESOURCES_READ,
    ACCESS_PERMISSIONS.MIC_KITS_READ,
    ACCESS_PERMISSIONS.MIC_KITS_REQUEST,
    ACCESS_PERMISSIONS.INTAKE_READ,
    ACCESS_PERMISSIONS.INTAKE_CREATE,
  ],
  [ACCESS_GROUPS.STUDIO_MANAGER]: [
    ...HOST_PERMISSIONS,
    ACCESS_PERMISSIONS.RESOURCES_UPDATE,
    ACCESS_PERMISSIONS.RESOURCES_PUBLISH,
    ACCESS_PERMISSIONS.ANNOUNCEMENTS_UPDATE,
    ACCESS_PERMISSIONS.EPISODES_MANAGE,
    ACCESS_PERMISSIONS.PROFILES_READ,
    ACCESS_PERMISSIONS.PROFILES_UPDATE,
    ACCESS_PERMISSIONS.STUDIO_ACCESS_MANAGE,
    ACCESS_PERMISSIONS.SPONSOR_READS_READ,
    ACCESS_PERMISSIONS.SPONSOR_READS_UPDATE,
    ACCESS_PERMISSIONS.INTAKE_MANAGE,
  ],
  [ACCESS_GROUPS.HOST]: HOST_PERMISSIONS,
};

export function normalizeAccessGroups(value) {
  const values = Array.isArray(value) ? value : [value];
  const validGroups = new Set(Object.values(ACCESS_GROUPS));

  return [
    ...new Set(
      values
        .map((group) => String(group || '').trim())
        .filter((group) => validGroups.has(group))
    ),
  ];
}

export function getPermissionsForGroups(groups) {
  const permissions = new Set();

  for (const group of normalizeAccessGroups(groups)) {
    for (const permission of GROUP_PERMISSIONS[group] || []) {
      permissions.add(permission);
    }
  }

  return [...permissions];
}

export function getPrimaryAccessGroup(groups) {
  const normalizedGroups = normalizeAccessGroups(groups);
  return (
    GROUP_PRIORITY.find((group) => normalizedGroups.includes(group)) || null
  );
}

export function hasAccessPermission(groups, permission) {
  return getPermissionsForGroups(groups).includes(permission);
}
