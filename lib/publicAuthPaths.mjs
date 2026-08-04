const PUBLIC_AUTH_PATHS = new Set([
  '/admin/login',
  '/admin/auth/callback',
  '/api/store/admin/auth/login',
  '/api/store/admin/auth/logout',
  '/api/store/admin/auth/password-recovery/start',
  '/api/store/admin/auth/password-recovery/confirm',
  '/studio/guest-questionnaire',
]);

export function isPublicAuthPath(pathname) {
  return PUBLIC_AUTH_PATHS.has(pathname);
}
