import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import {
  recordAccessSession,
  touchAccessSession,
} from '../../../lib/accessLogStore';
import { getStudioSupportContact } from '../../../lib/studioSupportContact.mjs';

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MIC_KITS_READ
  );
  if (!principal) return;

  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const touched = await touchAccessSession(principal);
    if (!touched) await recordAccessSession(req, principal);
  } catch (error) {
    console.error('access session heartbeat failed:', error);
  }

  if (req.method === 'POST') {
    return res.status(204).end();
  }

  return res.status(200).json({
    support_contact: getStudioSupportContact(),
    user: {
      username: principal.username,
      display_name: principal.displayName,
      role: principal.role,
      groups: principal.groups,
      permissions: principal.permissions,
    },
  });
}
