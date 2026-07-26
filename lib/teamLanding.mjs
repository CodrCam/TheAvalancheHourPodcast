import { ACCESS_GROUPS, normalizeAccessGroups } from './accessControl.mjs';

export function getTeamLandingForGroups(groups) {
  const normalized = normalizeAccessGroups(groups);

  if (
    normalized.includes(ACCESS_GROUPS.ADMIN) ||
    normalized.includes(ACCESS_GROUPS.STUDIO_MANAGER) ||
    normalized.includes(ACCESS_GROUPS.HOST)
  ) {
    return '/studio';
  }

  if (normalized.includes(ACCESS_GROUPS.LOGISTICS)) {
    return '/admin/orders';
  }

  return '/admin/login?error=unauthorized_group';
}
