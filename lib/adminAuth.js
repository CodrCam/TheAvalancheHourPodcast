import {
  getCognitoIdTokenFromRequest,
  getCognitoTokenFromRequest,
  getDisplayNameFromCognitoPayload,
  getGroupsFromCognitoPayload,
  getUsernameFromCognitoPayload,
  verifyCognitoAccessToken,
  verifyCognitoToken,
} from './cognitoAuth';
import {
  ACCESS_GROUPS,
  ACCESS_PERMISSIONS,
  getPermissionsForGroups,
  getPrimaryAccessGroup,
  hasAccessPermission,
} from './accessControl.mjs';

export const ADMIN_PERMISSIONS = ACCESS_PERMISSIONS;
export const ADMIN_ROLES = ACCESS_GROUPS;

export function getRolePermissions(role) {
  return getPermissionsForGroups([role]);
}

export function hasPermission(groups, permission) {
  return hasAccessPermission(groups, permission);
}

export async function getAccessPrincipalAsync(req) {
  try {
    const token = getCognitoTokenFromRequest(req);
    const payload = await verifyCognitoAccessToken(token);
    let identityPayload = payload;
    const idToken = getCognitoIdTokenFromRequest(req);

    if (idToken && idToken !== token) {
      try {
        const verifiedIdentity = await verifyCognitoToken(idToken);
        if (
          verifiedIdentity?.sub &&
          verifiedIdentity.sub === payload?.sub
        ) {
          identityPayload = verifiedIdentity;
        }
      } catch {
        // The access token still authorizes the request. Identity details can
        // safely fall back when a separate ID token is stale or unavailable.
      }
    }
    const groups = getGroupsFromCognitoPayload(payload);
    const role = getPrimaryAccessGroup(groups);

    if (!role) return null;

    return {
      role,
      groups,
      username: getUsernameFromCognitoPayload(identityPayload),
      displayName: getDisplayNameFromCognitoPayload(identityPayload),
      subject: payload?.sub || '',
      permissions: getPermissionsForGroups(groups),
      authProvider: 'cognito',
    };
  } catch (err) {
    console.warn('Cognito access-token verification failed:', err.message);
    return null;
  }
}

const ADMIN_WORKSPACE_PERMISSIONS = [
  ADMIN_PERMISSIONS.ORDERS_READ,
  ADMIN_PERMISSIONS.INVENTORY_READ,
  ADMIN_PERMISSIONS.PRODUCTS_READ,
  ADMIN_PERMISSIONS.SPONSORS_READ,
  ADMIN_PERMISSIONS.PEOPLE_READ,
  ADMIN_PERMISSIONS.BANNERS_READ,
];

export async function getAdminPrincipalAsync(req) {
  const principal = await getAccessPrincipalAsync(req);
  if (!principal) return null;

  return ADMIN_WORKSPACE_PERMISSIONS.some((permission) =>
    principal.permissions.includes(permission)
  )
    ? principal
    : null;
}

export async function requirePermissionAsync(req, res, permission) {
  const principal = await getAccessPrincipalAsync(req);

  if (!principal) {
    res.status(401).json({ error: 'Unauthorized' });
    return null;
  }

  if (!principal.permissions.includes(permission)) {
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
