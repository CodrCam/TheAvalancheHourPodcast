import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import {
  recordAccessSession,
  touchAccessSession,
} from '../../../lib/accessLogStore';
import { getStudioSupportContact } from '../../../lib/studioSupportContact.mjs';
import { isSeasonMastermindConfigured } from '../../../lib/seasonMastermindClient.mjs';
import { getPersonById } from '../../../lib/peopleStore';
import { getStudioBindingForSubject } from '../../../lib/studioAccessStore';
import { deriveStudioSessionCapabilities } from '../../../lib/studioSessionCapabilities.mjs';

async function getSessionCapabilities(principal) {
  const managerCapabilities = deriveStudioSessionCapabilities({
    permissions: principal.permissions,
  });
  if (managerCapabilities.producer_tasks) return managerCapabilities;
  if (!principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_READ)) {
    return managerCapabilities;
  }

  const binding = await getStudioBindingForSubject(principal.subject);
  if (!binding?.person_id) return managerCapabilities;

  const personResult = await getPersonById(binding.person_id, {
    allowStaticFallback: true,
    includeInactive: true,
  });
  const personCapabilities = deriveStudioSessionCapabilities({
    permissions: principal.permissions,
    personId: binding.person_id,
    person: personResult?.person,
  });
  return personCapabilities;
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MIC_KITS_READ
  );
  if (!principal) return;

  res.setHeader('Cache-Control', 'private, no-store');
  try {
    const touched = await touchAccessSession(principal);
    if (!touched) await recordAccessSession(req, principal);
  } catch (error) {
    console.error('access session heartbeat failed:', error);
  }

  if (req.method === 'POST') {
    return res.status(204).end();
  }

  let capabilities = deriveStudioSessionCapabilities({
    permissions: principal.permissions,
  });
  try {
    capabilities = await getSessionCapabilities(principal);
  } catch (error) {
    console.error('studio session capability lookup failed:', error);
  }

  return res.status(200).json({
    support_contact: getStudioSupportContact(),
    user: {
      username: principal.username,
      display_name: principal.displayName,
      role: principal.role,
      groups: principal.groups,
      permissions: principal.permissions,
      capabilities,
      features: {
        season_mastermind:
          isSeasonMastermindConfigured() ||
          process.env.NODE_ENV !== 'production',
      },
    },
  });
}
