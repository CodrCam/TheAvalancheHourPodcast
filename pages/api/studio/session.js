import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { getStudioSupportContact } from '../../../lib/studioSupportContact.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MIC_KITS_READ
  );
  if (!principal) return;

  res.setHeader('Cache-Control', 'private, no-store');
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
