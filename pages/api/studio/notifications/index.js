import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import {
  listStudioNotifications,
  markAllStudioNotificationsRead,
  markStudioNotificationRead,
  markStudioNotificationsSeen,
  getStudioNotificationSetupIssue,
} from '../../../../lib/studioNotificationStore';
import {
  filterNotificationsForPrincipal,
} from '../../../../lib/studioNotificationAccess';
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
  res.setHeader('Cache-Control', 'no-store, private');
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
        cursor: req.query.cursor,
      });
      const visible = await filterNotificationsForPrincipal(
        result.notifications,
        {
          personId: binding.person_id,
          permissions: principal.permissions,
        }
      );
      return res.status(200).json({
        ok: true,
        ...result,
        ...visible,
      });
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
      const visible = await filterNotificationsForPrincipal(
        [notification],
        {
          personId: binding.person_id,
          permissions: principal.permissions,
        }
      );
      if (!visible.notifications.length) {
        return res.status(404).json({
          ok: false,
          error: 'Notification not found.',
        });
      }
      return res.status(200).json({
        ok: true,
        notification: visible.notifications[0],
      });
    }
    if (req.body?.action === 'mark_seen') {
      const result = await markStudioNotificationsSeen(
        binding.person_id,
        req.body?.notification_ids
      );
      return res.status(200).json({ ok: true, ...result });
    }
    return res.status(400).json({
      ok: false,
      error: 'Choose a valid notification action.',
    });
  } catch (error) {
    const setupIssue = getStudioNotificationSetupIssue(error);
    if (setupIssue) {
      console.warn(
        JSON.stringify({
          event: 'studio_notification_setup_required',
          code: setupIssue.code,
          reason: setupIssue.reason,
        })
      );
      return res.status(503).json({
        ok: false,
        code: setupIssue.code,
        setup_required: true,
        error:
          'Notifications are temporarily unavailable while setup is completed.',
      });
    }
    const notFound = /not found/i.test(String(error.message || ''));
    const invalidCursor = /cursor is invalid/i.test(
      String(error.message || '')
    );
    return res.status(notFound ? 404 : invalidCursor ? 400 : 500).json({
      ok: false,
      error: notFound
        ? 'Notification not found.'
        : invalidCursor
          ? 'The notification page cursor is invalid.'
        : 'Could not update notifications.',
    });
  }
}
