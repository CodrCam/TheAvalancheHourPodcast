import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getEpisodeStudioMembership,
  getEpisodeCompletion,
  mergeEpisodeStudioManagerValues,
  mergeHostDeliverableValues,
} from '../../../../lib/episodeStudioPresentation.mjs';
import {
  getEpisodeStudio,
  saveEpisodeStudio,
} from '../../../../lib/episodeStudioStore';
import { sendEpisodeSubmissionNotification } from '../../../../lib/episodeStudioNotifications';
import { listPeople } from '../../../../lib/peopleStore';
import { getPersonStudioCapabilities } from '../../../../lib/peopleStudioCapabilities.mjs';
import {
  getStudioBindingForSubject,
  listStudioBindings,
} from '../../../../lib/studioAccessStore';
import {
  pickStudioDisplayName,
  resolveStudioMessageAuthors,
} from '../../../../lib/studioIdentityPresentation.mjs';
import crypto from 'crypto';

const HOST_LOCKED_STATUSES = [
  'submitted',
  'submitted_with_gaps',
  'accepted',
];
const PRODUCER_REVIEW_STATUSES = [
  'in_progress',
  'needs_changes',
  'accepted',
];

async function getPeopleDirectory() {
  const [result, bindingsResult] = await Promise.all([
    listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    }),
    listStudioBindings(),
  ]);
  const bindingsByPerson = new Map(
    bindingsResult.bindings.map((binding) => [binding.person_id, binding])
  );
  const people = result.people.map((person) => ({
    person_id: person.person_id,
    name: person.name,
    capabilities: getPersonStudioCapabilities(person),
    account_email:
      bindingsByPerson.get(person.person_id)?.account_email || '',
  }));
  const peopleById = new Map(
    people.map((person) => [person.person_id, person])
  );
  const peopleBySubject = new Map();

  for (const binding of bindingsResult.bindings) {
    if (!binding.active) continue;
    const person = peopleById.get(binding.person_id);
    if (!person) continue;
    if (binding.user_sub) peopleBySubject.set(binding.user_sub, person);
  }

  return {
    peopleById,
    peopleBySubject,
    hosts: people.filter((person) => person.capabilities.host),
    producers: people.filter((person) => person.capabilities.producer),
  };
}

function getPrincipalAuthorName(principal, binding, directory) {
  const person =
    (binding && directory.peopleById.get(binding.person_id)) ||
    directory.peopleBySubject.get(principal.subject);
  return pickStudioDisplayName(
    [person?.name, principal.displayName, principal.username],
    'Studio producer'
  );
}

function resolveMessageAuthors(
  episode,
  directory,
  principal,
  currentAuthorName
) {
  const namesByIdentifier = new Map(
    [...directory.peopleBySubject].map(([identifier, person]) => [
      identifier,
      person.name,
    ])
  );

  return {
    ...episode,
    messages: resolveStudioMessageAuthors(episode.messages, {
      namesByIdentifier,
      currentIdentifiers: [principal.subject, principal.username],
      currentAuthorName,
    }),
  };
}

function getDeliveryHealthActorRole(principal, binding, episode) {
  if (binding?.person_id === episode.producer_person_id) return 'producer';
  if (episode.host_person_ids.includes(binding?.person_id)) return 'host';
  if (principal.groups.includes('admin')) return 'admin';
  if (principal.groups.includes('studio_manager')) return 'studio_manager';
  return 'host';
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.EPISODES_READ
      : ADMIN_PERMISSIONS.EPISODES_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    const episodeId = String(req.query.episodeId || '').trim();
    const result = await getEpisodeStudio(episodeId);
    if (!result.episode) {
      return res
        .status(404)
        .json({ ok: false, error: 'Episode Studio not found.' });
    }

    const canManage = principal.permissions.includes(
      ADMIN_PERMISSIONS.EPISODES_MANAGE
    );
    const binding = await getStudioBindingForSubject(principal.subject);
    const episodeMembership = binding
      ? getEpisodeStudioMembership(result.episode, {
          person_id: binding.person_id,
          username: principal.username,
          subject: principal.subject,
          account_email: binding.account_email,
          identifiers: [binding.user_sub],
        })
      : [];
    const assigned = canManage || episodeMembership.length > 0;
    if (!assigned) {
      return res.status(403).json({
        ok: false,
        error: 'This Episode Studio is not assigned to your account.',
      });
    }

    const directory = await getPeopleDirectory();
    const { peopleById } = directory;
    const currentAuthorName = getPrincipalAuthorName(
      principal,
      binding,
      directory
    );
    const hostNames = result.episode.host_person_ids.map(
      (personId) => peopleById.get(personId)?.name || personId
    );

    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        configured: result.configured,
        canManage,
        episode: resolveMessageAuthors(
          result.episode,
          directory,
          principal,
          currentAuthorName
        ),
        completion: getEpisodeCompletion(result.episode),
        host_names: hostNames,
        people: canManage
          ? directory.hosts.map(({ person_id, name }) => ({
              person_id,
              name,
            }))
          : [],
        producers: canManage
          ? directory.producers.map(
              ({ person_id, name, account_email }) => ({
                person_id,
                name,
                account_email,
              })
            )
          : [],
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const action = String(req.body?.action || 'save').trim();
    const allowedActions = new Set([
      'save',
      'submit',
      'set_delivery_health',
      'message',
      'review',
      'update',
    ]);
    if (!allowedActions.has(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a valid Episode Studio action.',
      });
    }
    const expectedUpdatedAt = String(req.body?.expected_updated_at || '');
    let nextEpisode;
    let notification = null;
    const previousDeliveryHealth = result.episode.delivery_health;

    if (action === 'set_delivery_health') {
      if (result.episode.status === 'accepted') {
        return res.status(409).json({
          ok: false,
          error:
            'Accepted episodes are complete. Reopen the episode before changing its delivery outlook.',
        });
      }
      const deliveryHealth = String(req.body?.delivery_health || '');
      if (!['on_track', 'off_track'].includes(deliveryHealth)) {
        return res.status(400).json({
          ok: false,
          error: 'Choose On track or Off track.',
        });
      }
      nextEpisode = {
        ...result.episode,
        delivery_health: deliveryHealth,
        delivery_health_updated_at: new Date().toISOString(),
        delivery_health_updated_by_person_id: binding?.person_id || '',
        delivery_health_updated_by_name: currentAuthorName,
        delivery_health_updated_by_role: getDeliveryHealthActorRole(
          principal,
          binding,
          result.episode
        ),
      };
    } else if (action === 'message') {
      const body = String(req.body?.message || '').trim().slice(0, 2400);
      if (body.length < 2) {
        return res.status(400).json({
          ok: false,
          error: 'Write a message before posting it.',
        });
      }
      nextEpisode = {
        ...result.episode,
        messages: [
          ...(result.episode.messages || []),
          {
            message_id: `message-${crypto.randomUUID()}`,
            body,
            author_name: currentAuthorName,
            author_role: canManage ? 'producer' : 'host',
            created_at: new Date().toISOString(),
          },
        ].slice(-100),
      };
    } else if (canManage && action === 'review') {
      const status = String(req.body?.status || '');
      if (!PRODUCER_REVIEW_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ ok: false, error: 'Choose a valid producer status.' });
      }
      if (
        status === 'accepted' &&
        !['submitted', 'submitted_with_gaps'].includes(result.episode.status)
      ) {
        return res.status(409).json({
          ok: false,
          error: 'Hosts must submit the episode package before it is accepted.',
        });
      }
      if (
        status === 'needs_changes' &&
        !String(req.body?.producer_feedback || '').trim()
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Add a producer note before requesting changes.',
        });
      }
      nextEpisode = {
        ...result.episode,
        status,
        producer_feedback: req.body?.producer_feedback || '',
        reviewed_at: new Date().toISOString(),
      };
    } else if (canManage && action === 'update') {
      const proposed = mergeEpisodeStudioManagerValues(
        result.episode,
        req.body?.episode
      );
      if (
        !proposed.host_person_ids.length ||
        proposed.host_person_ids.some(
          (personId) => !peopleById.get(personId)?.capabilities.host
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Every assignment must point to a host profile.',
        });
      }
      if (
        proposed.producer_person_id &&
        !peopleById.get(proposed.producer_person_id)?.capabilities.producer
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a valid producer profile.',
        });
      }
      const selectedProducer = peopleById.get(proposed.producer_person_id);
      if (!proposed.producer_email && selectedProducer?.account_email) {
        proposed.producer_email = selectedProducer.account_email;
      }
      nextEpisode = proposed;
    } else {
      if (!principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_UPDATE)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (
        action === 'submit' &&
        !principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_SUBMIT)
      ) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (HOST_LOCKED_STATUSES.includes(result.episode.status)) {
        return res.status(409).json({
          ok: false,
          error:
            'This episode is with the producer. A producer must request changes before hosts can edit it again.',
        });
      }

      const hostDeliverables = mergeHostDeliverableValues(
        result.episode,
        req.body?.deliverables || []
      );
      nextEpisode = normalizeEpisodeStudio(
        {
          ...hostDeliverables,
          producer_directions: Object.prototype.hasOwnProperty.call(
            req.body || {},
            'producer_directions'
          )
            ? req.body.producer_directions
            : result.episode.producer_directions,
        },
        result.episode
      );
      if (action === 'submit') {
        const completion = getEpisodeCompletion(nextEpisode);
        const submissionMode = String(req.body?.submission_mode || 'complete');
        const provisional = submissionMode === 'with_gaps';

        if (
          (!provisional && !completion.can_submit) ||
          (provisional && !completion.can_submit_with_gaps)
        ) {
          return res.status(400).json({
            ok: false,
            code: 'EPISODE_INCOMPLETE',
            error: provisional
              ? 'Complete the producer handoff brief, then acknowledge every missing item and explain the plan to resolve it.'
              : 'Complete every required item and the producer handoff brief before sending this episode to the producer.',
            completion,
          });
        }

        nextEpisode.status = provisional
          ? 'submitted_with_gaps'
          : 'submitted';
        nextEpisode.submitted_at = new Date().toISOString();
        nextEpisode.producer_feedback = '';
      } else if (result.episode.status === 'planning') {
        nextEpisode.status = 'in_progress';
      }
    }

    const saved = await saveEpisodeStudio(nextEpisode, {
      expectedUpdatedAt,
    });
    const submitted =
      action === 'submit' &&
      ['submitted', 'submitted_with_gaps'].includes(saved.episode.status);

    if (submitted) {
      try {
        notification = await sendEpisodeSubmissionNotification(saved.episode, {
          hostNames,
          provisional: saved.episode.status === 'submitted_with_gaps',
        });
      } catch (notificationError) {
        console.error(
          'episode studio producer notification failed:',
          notificationError
        );
        notification = {
          sent: false,
          reason:
            'The episode was submitted, but the producer email could not be sent.',
        };
      }
    }

    logAdminAction(req, principal, `episode_studio.${action}`, {
      episode_id: saved.episode.episode_id,
      status: saved.episode.status,
      completion: getEpisodeCompletion(saved.episode).percent,
      ...(action === 'set_delivery_health'
        ? {
            previous_delivery_health: previousDeliveryHealth,
            delivery_health: saved.episode.delivery_health,
            delivery_health_updated_by_name:
              saved.episode.delivery_health_updated_by_name,
            delivery_health_updated_by_role:
              saved.episode.delivery_health_updated_by_role,
          }
        : {}),
    });

    return res.status(200).json({
      ok: true,
      episode: resolveMessageAuthors(
        saved.episode,
        directory,
        principal,
        currentAuthorName
      ),
      completion: getEpisodeCompletion(saved.episode),
      host_names: saved.episode.host_person_ids.map(
        (personId) => peopleById.get(personId)?.name || personId
      ),
      canManage,
      notification,
    });
  } catch (err) {
    console.error('episode studio detail error:', err);
    const message = String(err.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Episode Studio:|required|invalid|HTTPS/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'This Episode Studio changed in another session. Refresh before saving.'
        : message || 'Failed to update the Episode Studio.',
    });
  }
}
