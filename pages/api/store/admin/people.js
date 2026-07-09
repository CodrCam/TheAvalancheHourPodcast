import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  deletePerson,
  listPeople,
  savePerson,
} from '../../../../lib/peopleStore';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.PEOPLE_READ
      : ADMIN_PERMISSIONS.PEOPLE_UPDATE;

  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) {
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await listPeople({
        allowStaticFallback: true,
        includeInactive: true,
      });
      return res.status(200).json({ ok: true, ...result });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    if (req.method === 'DELETE') {
      const deleted = await deletePerson(req.body?.person_id || req.body?.slug);
      logAdminAction(req, principal, 'person.delete', {
        person_id: deleted.person_id,
      });
      return res.status(200).json({ ok: true, deleted });
    }

    const person = await savePerson(req.body?.person || {});
    logAdminAction(req, principal, 'person.save', {
      person_id: person.person_id,
      name: person.name,
      role: person.role,
      active: person.active,
      image_count: person.images?.length || 0,
    });
    return res.status(200).json({ ok: true, person });
  } catch (err) {
    console.error('admin people error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Failed to update people',
    });
  }
}
