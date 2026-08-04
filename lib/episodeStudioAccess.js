import { ADMIN_PERMISSIONS, requirePermissionAsync } from './adminAuth';
import {
  getEpisodeStudioMembership,
} from './episodeStudioPresentation.mjs';
import { getEpisodeStudio } from './episodeStudioStore';
import { getStudioBindingForSubject } from './studioAccessStore';

export async function requireEpisodeStudioAccess(
  req,
  res,
  episodeId,
  permission = ADMIN_PERMISSIONS.EPISODES_READ
) {
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return null;
  const result = await getEpisodeStudio(episodeId);
  if (!result.episode) {
    res.status(404).json({ ok: false, error: 'Episode Studio not found.' });
    return null;
  }
  if (result.episode.deleted_at) {
    res.status(409).json({
      ok: false,
      code: 'EPISODE_STUDIO_DELETION_PENDING',
      error:
        'This Episode Studio is being deleted, so its files and related requests are locked.',
    });
    return null;
  }
  const binding = await getStudioBindingForSubject(principal.subject);
  const roles = binding
    ? getEpisodeStudioMembership(result.episode, {
        person_id: binding.person_id,
        username: principal.username,
        subject: principal.subject,
        account_email: binding.account_email,
        identifiers: [binding.user_sub],
      })
    : [];
  const canManage = principal.permissions.includes(
    ADMIN_PERMISSIONS.EPISODES_MANAGE
  );
  if (!canManage && !roles.length) {
    res.status(403).json({
      ok: false,
      error: 'This Episode Studio is not assigned to your account.',
    });
    return null;
  }
  return {
    principal,
    binding,
    roles,
    canManage,
    episode: result.episode,
  };
}
