import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { getStudioGuide } from '../../../lib/studioGuideStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.RESOURCES_READ
  );
  if (!principal) return;

  try {
    const result = await getStudioGuide({ forHosts: true });
    return res.status(200).json({
      ok: true,
      ...result,
      canEdit: principal.permissions.includes(
        ADMIN_PERMISSIONS.RESOURCES_UPDATE
      ),
    });
  } catch (err) {
    console.error('studio resources GET error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to load Host Studio resources.',
    });
  }
}
