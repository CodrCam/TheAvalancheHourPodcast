function getHeader(req, name) {
  const value = req.headers?.[name.toLowerCase()] || req.headers?.[name];
  return Array.isArray(value) ? value[0] : value || '';
}

function getRequestIp(req) {
  const forwardedFor = getHeader(req, 'x-forwarded-for');
  if (forwardedFor) return forwardedFor.split(',')[0].trim();

  return req.socket?.remoteAddress || '';
}

export function logAdminAction(req, principal, action, details = {}) {
  const entry = {
    event: 'admin_audit',
    timestamp: new Date().toISOString(),
    action,
    actor: principal?.username || 'unknown',
    role: principal?.role || 'unknown',
    auth_provider: principal?.authProvider || 'unknown',
    ip: getRequestIp(req),
    ...details,
  };

  console.info(JSON.stringify(entry));
}
