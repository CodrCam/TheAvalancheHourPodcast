import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import { listPeople } from '../../../../lib/peopleStore';
import { personHasStudioCapability } from '../../../../lib/peopleStudioCapabilities.mjs';
import {
  deleteStudioBinding,
  listStudioBindings,
  saveStudioBinding,
} from '../../../../lib/studioAccessStore';

function validAccountEmail(value = '') {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.STUDIO_ACCESS_MANAGE
  );
  if (!principal) return;

  try {
    if (req.method === 'GET') {
      const [peopleResult, bindingResult] = await Promise.all([
        listPeople({ allowStaticFallback: true, includeInactive: true }),
        listStudioBindings(),
      ]);
      const bindingByPerson = new Map(
        bindingResult.bindings
          .filter((binding) => binding.active)
          .map((binding) => [binding.person_id, binding])
      );
      const currentBinding =
        bindingResult.bindings.find(
          (binding) =>
            binding.active && binding.user_sub === principal.subject
        ) || null;
      const people = peopleResult.people
        .filter((person) => personHasStudioCapability(person, 'host'))
        .map((person) => ({
          person_id: person.person_id,
          slug: person.slug,
          name: person.name,
          title: person.title,
          active: person.active,
          image: person.images?.[0] || '',
          binding: bindingByPerson.get(person.person_id) || null,
        }));

      return res.status(200).json({
        ok: true,
        people,
        configured:
          bindingResult.configured && peopleResult.source === 'dynamo',
        profiles_ready: peopleResult.source === 'dynamo',
        current_account: {
          person_id: currentBinding?.person_id || '',
          label: principal.displayName || principal.username,
        },
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    if (req.method === 'DELETE') {
      const deleted = await deleteStudioBinding(req.body?.person_id);
      logAdminAction(req, principal, 'studio_access.unbind', deleted);
      return res.status(200).json({ ok: true, deleted });
    }

    const peopleResult = await listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    });
    if (peopleResult.source !== 'dynamo') {
      return res.status(409).json({
        ok: false,
        error:
          'The team profile database must be seeded before accounts can be connected.',
      });
    }
    const action = String(req.body?.action || 'connect').trim();
    const personId = String(
      action === 'connect_self'
        ? req.body?.person_id
        : req.body?.binding?.person_id
    ).trim();
    if (
      !peopleResult.people.some(
        (person) =>
          person.person_id === personId &&
          personHasStudioCapability(person, 'host')
      )
    ) {
      return res
        .status(404)
        .json({ ok: false, error: 'Host profile not found.' });
    }

    if (action === 'connect_self') {
      const bindingResult = await listStudioBindings();
      const existingForPerson = bindingResult.bindings.find(
        (item) => item.person_id === personId && item.active
      );
      if (
        existingForPerson &&
        existingForPerson.user_sub !== principal.subject
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'That profile is already connected to another account. Disconnect it before reconnecting.',
        });
      }

      const binding = await saveStudioBinding({
        person_id: personId,
        user_sub: principal.subject,
        account_email: validAccountEmail(principal.username),
        active: true,
      });
      logAdminAction(req, principal, 'studio_access.bind_self', {
        person_id: binding.person_id,
        account_email: binding.account_email,
      });
      return res.status(200).json({ ok: true, binding });
    }

    const binding = await saveStudioBinding(req.body?.binding || {});
    logAdminAction(req, principal, 'studio_access.bind', {
      person_id: binding.person_id,
      account_email: binding.account_email,
    });
    return res.status(200).json({ ok: true, binding });
  } catch (err) {
    console.error('studio access manage error:', err);
    const conflict = /another account|already connected/i.test(
      String(err.message || '')
    );
    const validation = /required|invalid|already connected|not found/i.test(
      String(err.message || '')
    );
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: err.message || 'Failed to update Host Studio access.',
    });
  }
}
