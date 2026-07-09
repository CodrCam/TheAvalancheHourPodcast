// lib/adminAuth.js
import crypto from 'crypto';
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

export function timingSafeEqual(a = '', b = '') {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ab.length !== bb.length) {
    const dummy = crypto.randomBytes(32);
    crypto.timingSafeEqual(dummy, dummy);
    return false;
  }
  return crypto.timingSafeEqual(ab, bb);
}

function parseBasicAuth(header = '') {
  if (!header.startsWith('Basic ')) return null;

  try {
    const [, encoded] = header.split(' ');
    const decoded = Buffer.from(encoded || '', 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator === -1) return null;

    return {
      username: decoded.slice(0, separator),
      password: decoded.slice(separator + 1),
    };
  } catch {
    return null;
  }
}

function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  return Array.isArray(value) ? value[0] : value || '';
}

function credentialMatches(provided, expected) {
  if (!provided || !expected?.username || !expected?.password) return false;

  return (
    timingSafeEqual(String(provided.username), String(expected.username)) &&
    timingSafeEqual(String(provided.password), String(expected.password))
  );
}

function tokenMatches(provided, expected) {
  return Boolean(
    provided && expected && timingSafeEqual(String(provided), String(expected))
  );
}

function getConfiguredPrincipals() {
  if (process.env.ALLOW_LEGACY_ADMIN_AUTH !== 'true') {
    return [];
  }

  return [
    {
      role: ADMIN_ROLES.ADMIN,
      username: process.env.ADMIN_USER || '',
      password: process.env.ADMIN_PASS || '',
      token: process.env.ADMIN_TOKEN || '',
    },
    {
      role: ADMIN_ROLES.LOGISTICS,
      username: process.env.LOGISTICS_USER || '',
      password: process.env.LOGISTICS_PASS || '',
      token: process.env.LOGISTICS_TOKEN || '',
    },
  ];
}

export function getRolePermissions(role) {
  return ROLE_PERMISSIONS[role] || [];
}

export function hasPermission(role, permission) {
  return getRolePermissions(role).includes(permission);
}

export function getAdminPrincipal(req) {
  const basic = parseBasicAuth(getHeader(req, 'authorization'));
  const provided =
    getHeader(req, 'x-admin-token') ||
    getHeader(req, 'x-adminkey') ||
    (req.cookies && req.cookies['admin_token']) ||
    '';

  for (const principal of getConfiguredPrincipals()) {
    if (
      credentialMatches(basic, principal) ||
      tokenMatches(provided, principal.token)
    ) {
      return {
        role: principal.role,
        username: principal.username || principal.role,
        permissions: getRolePermissions(principal.role),
      };
    }
  }

  return null;
}

export async function getAdminPrincipalAsync(req) {
  const envPrincipal = getAdminPrincipal(req);
  if (envPrincipal) return envPrincipal;

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

export function requirePermission(req, res, permission) {
  const principal = getAdminPrincipal(req);

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

export function requireAdmin(req, res) {
  return Boolean(requirePermission(req, res, ADMIN_PERMISSIONS.USERS_MANAGE));
}

export async function requireAdminAsync(req, res) {
  return Boolean(
    await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.USERS_MANAGE)
  );
}
