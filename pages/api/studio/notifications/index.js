import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import {
  listStudioNotifications,
  markAllStudioNotificationsRead,
  markStudioNotificationRead,
} from '../../../../lib/studioNotificationStore';
import { getStudioBindingForSubject } from '../../../../lib/studioAccessStore';

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.NOTIFICATIONS_READ
      : ADMIN_PERMISSIONS.NOTIFICATIONS_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;
  try {
    const binding = await getStudioBindingForSubject(principal.subject);
    if (!binding?.active || !binding.person_id) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Connect this signed-in account to a Studio profile before using notifications.',
      });
    }
    if (req.method === 'GET') {
      const result = await listStudioNotifications(binding.person_id, {
        limit: req.query.limit,
      });
      return res.status(200).json({ ok: true, ...result });
    }
    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }
    if (req.body?.action === 'mark_all_read') {
      const result = await markAllStudioNotificationsRead(binding.person_id);
      return res.status(200).json({ ok: true, ...result });
    }
    if (req.body?.action === 'mark_read') {
      const notification = await markStudioNotificationRead(
        binding.person_id,
        req.body?.notification_id,
        req.body?.read !== false
      );
      return res.status(200).json({ ok: true, notification });
    }
    return res.status(400).json({
      ok: false,
      error: 'Choose a valid notification action.',
    });
  } catch (error) {
    const notFound = /not found/i.test(String(error.message || ''));
    return res.status(notFound ? 404 : 500).json({
      ok: false,
      error: notFound
        ? 'Notification not found.'
        : 'Could not update notifications.',
    });
  }
}
