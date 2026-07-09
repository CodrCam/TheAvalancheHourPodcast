import {
  getCognitoTokenFromRequest,
  getRoleFromCognitoPayload,
  getUsernameFromCognitoPayload,
  verifyCognitoToken,
} from './cognitoAuth';

export const ADMIN_PERMISSIONS = {
  ORDERS_READ: 'orders:read',
  ORDERS_UPDATE: 'orders:update',
  ORDERS_EXPORT: 'orders:export',
  INVENTORY_READ: 'inventory:read',
  INVENTORY_UPDATE: 'inventory:update',
  PRODUCTS_READ: 'products:read',
  PRODUCTS_UPDATE: 'products:update',
  SPONSORS_READ: 'sponsors:read',
  SPONSORS_UPDATE: 'sponsors:update',
  BANNERS_READ: 'banners:read',
  BANNERS_UPDATE: 'banners:update',
  USERS_MANAGE: 'users:manage',
  AUDIT_READ: 'audit:read',
};

export const ADMIN_ROLES = {
  ADMIN: 'admin',
  LOGISTICS: 'logistics',
};

const ROLE_PERMISSIONS = {
  [ADMIN_ROLES.ADMIN]: Object.values(ADMIN_PERMISSIONS),
  [ADMIN_ROLES.LOGISTICS]: [
    ADMIN_PERMISSIONS.ORDERS_READ,
    ADMIN_PERMISSIONS.ORDERS_UPDATE,
    ADMIN_PERMISSIONS.ORDERS_EXPORT,
    ADMIN_PERMISSIONS.INVENTORY_READ,
    ADMIN_PERMISSIONS.INVENTORY_UPDATE,
    ADMIN_PERMISSIONS.PRODUCTS_READ,
    ADMIN_PERMISSIONS.SPONSORS_READ,
    ADMIN_PERMISSIONS.BANNERS_READ,
  ],
};

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role, permission) {
  return getRolePermissions(role).includes(permission);
}

export async function getAdminPrincipalAsync(req) {
  try {
    const token = getCognitoTokenFromRequest(req);
    const payload = await verifyCognitoToken(token);
    const role = getRoleFromCognitoPayload(payload);

    if (!role) return null;

    return {
      role,
      username: getUsernameFromCognitoPayload(payload),
      permissions: getRolePermissions(role),
      authProvider: 'cognito',
    };
  } catch (err) {
    console.warn('Cognito admin auth failed:', err.message);
    return null;
  }
}

export async function requirePermissionAsync(req, res, permission) {
  const principal = await getAdminPrincipalAsync(req);

  if (!principal) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (!hasPermission(principal.role, permission)) {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }

  return principal;
}

export async function requireAdminAsync(req, res) {
  return Boolean(
    await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.USERS_MANAGE)
  );
}
