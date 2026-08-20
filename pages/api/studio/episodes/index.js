import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  createDefaultEpisodeDeliverables,
  episodeStudioSummary,
  getEpisodeStudioMembership,
  upcomingEpisodeCalendarEntries,
} from '../../../../lib/episodeStudioPresentation.mjs';
import {
  createEpisodeStudioId,
  listEpisodeStudios,
  saveEpisodeStudio,
} from '../../../../lib/episodeStudioStore';
import { getDefaultStudioProducerEmail } from '../../../../lib/episodeStudioNotifications';
import { listPeople } from '../../../../lib/peopleStore';
import { getPersonStudioCapabilities } from '../../../../lib/peopleStudioCapabilities.mjs';
import {
  getStudioBindingForSubject,
  listStudioBindings,
} from '../../../../lib/studioAccessStore';
import { publishEpisodeNotifications } from '../../../../lib/episodeStudioEvents';
import { isEpisodeAssetStorageConfigured } from '../../../../lib/episodeAssetStorage';
import { createDefaultEpisodeProductionTasks } from '../../../../lib/episodeProductionPlan.mjs';
import { summarizeCurrentSeasonEpisodes } from '../../../../lib/currentSeason.mjs';

function dateDaysBefore(value, days = 10) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function validEmail(value) {
  const email = String(value || '').trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

async function getStudioDirectory() {
  const [peopleResult, bindingResult] = await Promise.all([
    listPeople({ allowStaticFallback: true, includeInactive: true }),
    listStudioBindings(),
  ]);
  const bindingsByPerson = new Map(
    bindingResult.bindings.map((binding) => [binding.person_id, binding])
  );
  const people = peopleResult.people.map((person) => {
    const binding = bindingsByPerson.get(person.person_id);
    return {
      person_id: person.person_id,
      name: person.name,
      active: person.active,
      image: person.images?.[0] || '',
      connected: Boolean(binding),
      account_email: binding?.account_email || '',
      capabilities: getPersonStudioCapabilities(person),
    };
  });
  const hosts = people.filter(
    (person) => person.active && person.capabilities.host
  );
  const producers = people.filter(
    (person) => person.active && person.capabilities.producer
  );

  return {
    hosts,
    producers,
    peopleById: new Map(people.map((person) => [person.person_id, person])),
  };
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'POST'
      ? ADMIN_PERMISSIONS.EPISODES_MANAGE
      : ADMIN_PERMISSIONS.EPISODES_READ;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;
  res.setHeader('Cache-Control', 'private, no-store');

  try {
    const canManage = principal.permissions.includes(
      ADMIN_PERMISSIONS.EPISODES_MANAGE
    );
    const calendarOnly =
      req.method === 'GET' && req.query.scope === 'calendar';
    const [{ episodes, configured }, directory] = await Promise.all([
      listEpisodeStudios(),
      calendarOnly ? Promise.resolve(null) : getStudioDirectory(),
    ]);

    if (req.method === 'GET') {
      const sharedCalendar = upcomingEpisodeCalendarEntries(episodes);
      const seasonOverview = summarizeCurrentSeasonEpisodes(
        episodes,
        sharedCalendar
      );
      if (calendarOnly) {
        res.setHeader('Cache-Control', 'no-store, private');
        return res.status(200).json({
          ok: true,
          configured,
          calendar: sharedCalendar,
          season_overview: seasonOverview,
        });
      }

      let visibleEpisodes = episodes.filter(
        (episode) => !episode.deletion_finalized_at
      );
      let profileConnection = null;
      let membershipIdentity = null;
      const personalScope = !canManage || req.query.scope === 'mine';
      const includeDirectory =
        canManage &&
        req.query.scope !== 'mine' &&
        req.query.include_directory !== 'false';
      if (personalScope) {
        const binding = await getStudioBindingForSubject(principal.subject);
        if (!binding) {
          return res.status(409).json({
            ok: false,
            code: 'PROFILE_NOT_CONNECTED',
            error:
              'Your signed-in account is not connected to a Host Studio profile yet.',
            can_manage_access: principal.permissions.includes(
              ADMIN_PERMISSIONS.STUDIO_ACCESS_MANAGE
            ),
          });
        }
        membershipIdentity = {
          person_id: binding.person_id,
          username: principal.username,
          subject: principal.subject,
          account_email: binding.account_email,
          identifiers: [binding.user_sub],
        };
        visibleEpisodes = visibleEpisodes.filter(
          (episode) =>
            getEpisodeStudioMembership(episode, membershipIdentity).length > 0 &&
            (canManage || !episode.deleted_at)
        );
        profileConnection = {
          connected: true,
          person_id: binding.person_id,
          person_name:
            directory.peopleById.get(binding.person_id)?.name ||
            binding.person_id,
        };
      }

      return res.status(200).json({
        ok: true,
        configured,
        canManage,
        profile_connection: profileConnection,
        calendar: sharedCalendar,
        season_overview: seasonOverview,
        episodes: visibleEpisodes.map((episode) => ({
          ...episodeStudioSummary(episode),
          producer_name:
            directory.peopleById.get(episode.producer_person_id)?.name || '',
          my_roles: membershipIdentity
            ? getEpisodeStudioMembership(episode, membershipIdentity)
            : [],
          host_names: episode.host_person_ids.map(
            (personId) =>
              directory.peopleById.get(personId)?.name || personId
          ),
        })),
        people: includeDirectory ? directory.hosts : [],
        producers: includeDirectory ? directory.producers : [],
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const input = req.body?.episode || {};
    const hostPersonIds = [
      ...new Set(
        (Array.isArray(input.host_person_ids) ? input.host_person_ids : [])
          .map((personId) => String(personId || '').trim())
          .filter(Boolean)
      ),
    ];
    if (
      !hostPersonIds.length ||
      hostPersonIds.some(
        (personId) => {
          const person = directory.peopleById.get(personId);
          return person?.active !== true || person.capabilities.host !== true;
        }
      )
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Choose at least one valid host profile.',
      });
    }

    const now = new Date().toISOString();
    const episodeId = createEpisodeStudioId(input.title);
    const creatorBinding = await getStudioBindingForSubject(principal.subject);
    const creationExceptionKind = String(
      input.creation_exception_kind || ''
    ).trim();
    const creationExceptionReason = String(
      input.creation_exception_reason || ''
    ).trim();
    if (
      !['legacy', 'urgent_exception'].includes(creationExceptionKind) ||
      creationExceptionReason.length < 10 ||
      creationExceptionReason.length > 500
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'Manual creation requires an approved exception type and a 10–500 character reason.',
      });
    }
    const producerPersonId = String(input.producer_person_id || '').trim();
    const producer = producerPersonId
      ? directory.peopleById.get(producerPersonId)
      : null;
    if (
      !producerPersonId ||
      producer?.active !== true ||
      producer?.capabilities?.producer !== true
    ) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a current producer profile.',
      });
    }
    const producerEmail =
      validEmail(input.producer_email) ||
      validEmail(producer?.account_email) ||
      validEmail(principal.username) ||
      getDefaultStudioProducerEmail();
    const result = await saveEpisodeStudio(
      {
        episode_id: episodeId,
        title: input.title,
        season: input.season || 'Season 11',
        target_release_date: input.target_release_date,
        due_date:
          input.due_date || dateDaysBefore(input.target_release_date, 10),
        recording_date: input.recording_date,
        recording_time: input.recording_time,
        recording_time_zone: input.recording_time_zone,
        recording_duration_minutes: input.recording_duration_minutes,
        recording_location: input.recording_location,
        host_person_ids: hostPersonIds,
        producer_person_id: producerPersonId,
        producer_email: producerEmail,
        producer_feedback: '',
        producer_directions: '',
        canonical_assets_required: isEpisodeAssetStorageConfigured(),
        status: 'planning',
        delivery_health: 'on_track',
        delivery_health_updated_at: '',
        delivery_health_updated_by_person_id: '',
        delivery_health_updated_by_name: '',
        delivery_health_updated_by_role: '',
        deliverables: createDefaultEpisodeDeliverables(),
        production_tasks: createDefaultEpisodeProductionTasks(
          input.target_release_date
        ),
        production_workflow_updated_at: now,
        production_workflow_updated_by_person_id:
          creatorBinding?.person_id || '',
        production_workflow_updated_by_name:
          directory.peopleById.get(creatorBinding?.person_id || '')?.name ||
          principal.username,
        created_by_person_id: creatorBinding?.person_id || '',
        created_by: principal.username,
        created_at: now,
        updated_at: now,
      },
      { create: true }
    );

    const creator = directory.peopleById.get(
      creatorBinding?.person_id || ''
    );
    try {
      await publishEpisodeNotifications({
        previousEpisode: null,
        episode: result.episode,
        action: 'create',
        actorPersonId: creatorBinding?.person_id || '',
        actorName:
          creator?.name ||
          principal.displayName ||
          principal.username ||
          'Studio team',
      });
    } catch (notificationError) {
      console.error(
        'episode assignment notification generation failed:',
        notificationError
      );
    }

    logAdminAction(req, principal, 'episode_studio.create', {
      episode_id: result.episode.episode_id,
      title: result.episode.title,
      host_person_ids: result.episode.host_person_ids,
      target_release_date: result.episode.target_release_date,
      creation_path: 'manual_exception',
      creation_exception_kind: creationExceptionKind,
      creation_exception_reason: creationExceptionReason,
    });

    return res.status(201).json({
      ok: true,
      episode: result.episode,
    });
  } catch (err) {
    console.error('episode studio list/create error:', err);
    const message = String(err.message || '');
    const validation = /Episode Studio:|host profile|required|invalid/i.test(
      message
    );
    const conflict = /conditional/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'That Episode Studio already exists.'
        : message || 'Failed to load Episode Studios.',
    });
  }
}
