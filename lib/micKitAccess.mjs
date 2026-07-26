import { ACCESS_PERMISSIONS } from './accessControl.mjs';

export function getMicKitAccessForPermissions(permissions = []) {
  const granted = new Set(
    Array.isArray(permissions) ? permissions : []
  );

  return {
    canRead: granted.has(ACCESS_PERMISSIONS.MIC_KITS_READ),
    canRequest: granted.has(ACCESS_PERMISSIONS.MIC_KITS_REQUEST),
    canManage: granted.has(ACCESS_PERMISSIONS.MIC_KITS_MANAGE),
  };
}
