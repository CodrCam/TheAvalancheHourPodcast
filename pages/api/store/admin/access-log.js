import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { listAccessSessions } from '../../../../lib/accessLogStore';

const ALLOWED_RANGES = new Set(['7', '30', '90', 'all']);

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

  const requestedDays = String(req.query?.days || '30');
  const days = ALLOWED_RANGES.has(requestedDays) ? requestedDays : '30';
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    return res.status(200).json(
      await listAccessSessions({ days: days === 'all' ? 'all' : Number(days) })
    );
  } catch (error) {
    console.error('admin access log error:', error);
    return res.status(500).json({ error: 'Failed to load the access log.' });
  }
}
