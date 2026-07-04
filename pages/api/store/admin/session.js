// pages/api/store/admin/session.js
import { getAdminPrincipalAsync } from '../../../../lib/adminAuth';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await getAdminPrincipalAsync(req);

  if (!principal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  return res.status(200).json({
    user: {
      username: principal.username,
      role: principal.role,
      permissions: principal.permissions,
    },
  });
}
