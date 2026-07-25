import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { logAdminAction } from '../../../lib/adminAudit';
import {
  listPeople,
  updatePersonSelfProfile,
} from '../../../lib/peopleStore';
import { getStudioBindingForSubject } from '../../../lib/studioAccessStore';

function editableProfile(person = {}) {
  return {
    person_id: person.person_id,
    slug: person.slug,
    name: person.name,
    title: person.title,
    bioShort: person.bioShort,
    bioFull: person.bioFull,
    images: person.images || [],
    public_url: `/hosts/${person.slug}`,
    updated_at: person.updated_at || '',
  };
}

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.PROFILE_SELF_READ
      : ADMIN_PERMISSIONS.PROFILE_SELF_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    const binding = await getStudioBindingForSubject(principal.subject);
    if (!binding) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your Host Studio account is not connected to a public profile yet.',
        can_manage_access: principal.permissions.includes(
          ADMIN_PERMISSIONS.STUDIO_ACCESS_MANAGE
        ),
      });
    }

    if (req.method === 'GET') {
      const result = await listPeople({
        allowStaticFallback: false,
        includeInactive: true,
      });
      const person = result.people.find(
        (candidate) => candidate.person_id === binding.person_id
      );
      if (!person) {
        return res.status(404).json({
          ok: false,
          error: 'The connected public profile could not be found.',
        });
      }
      return res.status(200).json({
        ok: true,
        profile: editableProfile(person),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const profile = await updatePersonSelfProfile(
      binding.person_id,
      req.body?.profile || {}
    );
    logAdminAction(req, principal, 'profile.self_update', {
      person_id: binding.person_id,
      image_count: profile.images?.length || 0,
    });
    return res.status(200).json({
      ok: true,
      profile: editableProfile(profile),
    });
  } catch (err) {
    console.error('studio self-profile error:', err);
    const validation = /photo|image|profile|person id/i.test(
      String(err.message || '')
    );
    return res.status(validation ? 400 : 500).json({
      ok: false,
      error: err.message || 'Failed to update your public profile.',
    });
  }
}
