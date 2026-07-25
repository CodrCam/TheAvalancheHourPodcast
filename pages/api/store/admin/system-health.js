import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { getAdminSystemHealth } from '../../../../lib/adminSystemHealth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.AUDIT_READ
  );
  if (!principal) return;

  try {
    return res.status(200).json(await getAdminSystemHealth());
  } catch (err) {
    console.error('system health error:', err);
    return res.status(500).json({ error: 'Failed to load system health.' });
  }
}
