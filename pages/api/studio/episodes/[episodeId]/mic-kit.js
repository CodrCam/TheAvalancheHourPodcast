import { ADMIN_PERMISSIONS } from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import { requireEpisodeStudioAccess } from '../../../../../lib/episodeStudioAccess';
import { getHostDraftObserverMutationBlocker } from '../../../../../lib/episodeStudioDraftAccess.mjs';
import {
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  applyEpisodeMicKitPlanUpdate,
  buildEpisodeMicKitPlanRows,
  connectEpisodeMicKitRequestToPlan,
  getEpisodeGuestMicKitRequestCoverage,
  getEpisodeMicKitRequestCoverage,
  findEpisodeMicKitRequest,
  isActiveEpisodeMicKitRequestCoverage,
} from '../../../../../lib/episodeMicKitPresentation.mjs';
import { upsertEpisodeMicKitEquipmentReviewRequest } from '../../../../../lib/episodeMicKitRequests.mjs';
import { normalizeEpisodeStudio } from '../../../../../lib/episodeStudioPresentation.mjs';
import { saveEpisodeStudio } from '../../../../../lib/episodeStudioStore';
import {
  getMicKitTracker,
  saveMicKitTracker,
} from '../../../../../lib/micKitStore';
import { listPeople } from '../../../../../lib/peopleStore';
import { publishMicKitNotifications } from '../../../../../lib/micKitEvents';
import { listStudioBindings } from '../../../../../lib/studioAccessStore';

const HOST_LOCKED_STATUSES = new Set([
  'submitted',
  'submitted_with_gaps',
  'accepted',
]);

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function microphonePlanDeliverable(episode) {
  return episode.deliverables.find(
    (deliverable) => deliverable.id === EPISODE_MIC_KIT_DELIVERABLE_ID
  );
}

function actorLabel(principal = {}) {
  return (
    cleanText(principal.displayName, 120) ||
    cleanText(principal.username, 240) ||
    'Studio team member'
  );
}

function requestableHostPersonIds(access) {
  const actorPersonId = access.binding?.person_id || '';
  if (access.canManage || access.roles.includes('producer')) {
    return access.episode.host_person_ids;
  }
  return access.roles.includes('host') &&
    access.episode.host_person_ids.includes(actorPersonId)
    ? [actorPersonId]
    : [];
}

function canRequestForGuest(access) {
  return Boolean(
    access.canManage ||
      access.roles.includes('producer') ||
      access.roles.includes('host')
  );
}

function currentCoordinatorPersonIds(episode) {
  return [
    ...new Set(
      [
        ...(Array.isArray(episode.host_person_ids)
          ? episode.host_person_ids
          : []),
        episode.producer_person_id,
      ].filter(Boolean)
    ),
  ].slice(0, 10);
}

async function participantIdentity(access, participantType, hostPersonId) {
  if (participantType === 'guest') {
    const guestPlan = microphonePlanDeliverable(access.episode)
      ?.guest_mic_kit_plan;
    return {
      requesterName:
        cleanText(guestPlan?.guest_name, 120) || 'Episode guest',
      requesterPersonId: '',
      requesterSubject: '',
      requesterEmail: '',
    };
  }

  const [peopleResult, bindingsResult] = await Promise.all([
    listPeople({ allowStaticFallback: true, includeInactive: true }),
    listStudioBindings(),
  ]);
  const person = (peopleResult.people || []).find(
    (candidate) => candidate.person_id === hostPersonId
  );
  const binding = (bindingsResult.bindings || []).find(
    (candidate) =>
      candidate.person_id === hostPersonId && candidate.active !== false
  );
  return {
    requesterName: cleanText(person?.name, 120) || 'Episode host',
    requesterPersonId: hostPersonId,
    requesterSubject: cleanText(binding?.user_sub, 160),
    requesterEmail: cleanText(binding?.account_email, 240).toLowerCase(),
  };
}

function responsePayload(access, trackerResult) {
  const deliverable = microphonePlanDeliverable(access.episode);
  const hostDraftReadOnly = Boolean(
    getHostDraftObserverMutationBlocker({
      status: access.episode.status,
      canHost: access.roles.includes('host'),
      canManage: access.canManage,
    })
  );
  const viewerHostPersonId =
    access.roles.includes('host') &&
    access.episode.host_person_ids.includes(access.binding?.person_id || '')
      ? access.binding.person_id
      : '';
  const requestCoverage = getEpisodeMicKitRequestCoverage(
    trackerResult.tracker,
    {
      episodeId: access.episode.episode_id,
      hostPersonIds: access.episode.host_person_ids,
    }
  );
  const guestRequestCoverage = getEpisodeGuestMicKitRequestCoverage(
    trackerResult.tracker,
    { episodeId: access.episode.episode_id }
  );
  const participantPlans = buildEpisodeMicKitPlanRows({
    plans: deliverable?.mic_kit_plans,
    hostPersonIds: access.episode.host_person_ids,
    requestCoverage,
    guestPlan: deliverable?.guest_mic_kit_plan,
    guestRequestCoverage,
  });
  const plans = participantPlans.filter(
    (plan) => plan.participant_type !== 'guest'
  );
  const guestPlan =
    participantPlans.find((plan) => plan.participant_type === 'guest') ||
    null;
  return {
    ok: true,
    episode_id: access.episode.episode_id,
    episode_updated_at: access.episode.updated_at,
    tracker_configured: trackerResult.configured,
    tracker_updated_at: trackerResult.tracker.updated_at,
    required: deliverable?.required === true,
    complete:
      plans.length > 0 &&
      plans.every((plan) => plan.resolved === true) &&
      (!guestPlan || guestPlan.resolved === true),
    viewer_host_person_id: viewerHostPersonId,
    can_edit: Boolean(
      viewerHostPersonId &&
        !HOST_LOCKED_STATUSES.has(access.episode.status)
    ),
    can_coordinate_requests: Boolean(
      !hostDraftReadOnly &&
        (requestableHostPersonIds(access).length || canRequestForGuest(access))
    ),
    requestable_host_person_ids: hostDraftReadOnly
      ? []
      : requestableHostPersonIds(access),
    can_request_guest: !hostDraftReadOnly && canRequestForGuest(access),
    host_draft_read_only: hostDraftReadOnly,
    plans,
    guest_plan: guestPlan,
    request_coverage: requestCoverage,
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const episodeId = cleanText(req.query.episodeId, 120);
  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.MIC_KITS_READ
      : req.method === 'POST'
        ? ADMIN_PERMISSIONS.MIC_KITS_REQUEST
        : ADMIN_PERMISSIONS.EPISODES_UPDATE;
  const access = await requireEpisodeStudioAccess(
    req,
    res,
    episodeId,
    permission
  );
  if (!access) return;

  try {
    const trackerResult = await getMicKitTracker();
    if (req.method === 'GET') {
      return res.status(200).json(responsePayload(access, trackerResult));
    }
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({
        ok: false,
        error: 'Content-Type must be application/json',
      });
    }

    if (req.method === 'POST') {
      const hostDraftBlocker = getHostDraftObserverMutationBlocker({
        status: access.episode.status,
        canHost: access.roles.includes('host'),
        canManage: access.canManage,
      });
      if (hostDraftBlocker) {
        return res
          .status(hostDraftBlocker.status)
          .json({ ok: false, ...hostDraftBlocker });
      }
      if (HOST_LOCKED_STATUSES.has(access.episode.status)) {
        return res.status(409).json({
          ok: false,
          error:
            'This episode package is locked while it is with the producer.',
        });
      }
      if (!trackerResult.configured) {
        return res.status(503).json({
          ok: false,
          error: 'Mic-kit requests are temporarily unavailable.',
        });
      }
      const action = cleanText(req.body?.action, 60);
      if (action !== 'request_participant_kit') {
        return res.status(400).json({
          ok: false,
          error: 'Choose a valid microphone request action.',
        });
      }
      const participantType =
        req.body?.participant_type === 'guest' ? 'guest' : 'host';
      const hostPersonId =
        participantType === 'host'
          ? cleanText(req.body?.host_person_id, 120)
          : '';
      if (
        participantType === 'host' &&
        !requestableHostPersonIds(access).includes(hostPersonId)
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'You can only request a microphone kit for an authorized episode host.',
        });
      }
      if (participantType === 'guest' && !canRequestForGuest(access)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      const identity = await participantIdentity(
        access,
        participantType,
        hostPersonId
      );
      const requestResult = upsertEpisodeMicKitEquipmentReviewRequest({
        tracker: trackerResult.tracker,
        episodeId: access.episode.episode_id,
        recordingDate: access.episode.recording_date,
        participantType,
        ...identity,
        coordinatorPersonIds: currentCoordinatorPersonIds(access.episode),
      });
      if (!requestResult.request) {
        return res.status(400).json({
          ok: false,
          error: 'Could not identify the participant for this request.',
        });
      }

      let nextTrackerResult = trackerResult;
      if (requestResult.created || requestResult.reopened) {
        const expectedTrackerUpdatedAt = cleanText(
          req.body?.expected_tracker_updated_at,
          50
        );
        if (expectedTrackerUpdatedAt !== trackerResult.tracker.updated_at) {
          return res.status(409).json({
            ok: false,
            error:
              'The mic-kit queue changed in another session. Refresh and try again.',
          });
        }
        nextTrackerResult = await saveMicKitTracker(requestResult.tracker, {
          expectedUpdatedAt: trackerResult.tracker.updated_at,
          updatedBy: actorLabel(access.principal),
        });
        try {
          await publishMicKitNotifications({
            previousTracker: trackerResult.tracker,
            tracker: nextTrackerResult.tracker,
            action: requestResult.created
              ? 'create_request'
              : 'update_request',
            actorName: actorLabel(access.principal),
            actorPersonId: access.binding?.person_id || '',
            managerPersonIds: String(
              process.env.STUDIO_MIC_KIT_MANAGER_PERSON_IDS || ''
            )
              .split(',')
              .map((personId) => personId.trim())
              .filter(Boolean),
          });
        } catch (notificationError) {
          console.error(
            'episode mic-kit request notification generation failed:',
            notificationError
          );
        }
      }

      const deliverable =
        microphonePlanDeliverable(access.episode) || {
          id: EPISODE_MIC_KIT_DELIVERABLE_ID,
          required: true,
        };
      const connectedDeliverable = connectEpisodeMicKitRequestToPlan({
        deliverable,
        hostPersonIds: access.episode.host_person_ids,
        participantType,
        hostPersonId,
        guestName: identity.requesterName,
        requestId: requestResult.request.request_id,
      });
      const hasDeliverable = access.episode.deliverables.some(
        (candidate) => candidate.id === EPISODE_MIC_KIT_DELIVERABLE_ID
      );
      const nextEpisode = normalizeEpisodeStudio({
        ...access.episode,
        deliverables: hasDeliverable
          ? access.episode.deliverables.map((candidate) =>
              candidate.id === EPISODE_MIC_KIT_DELIVERABLE_ID
                ? connectedDeliverable
                : candidate
            )
          : [...access.episode.deliverables, connectedDeliverable],
      });
      let responseAccess = access;
      let episodeLinkDeferred = false;
      if (
        JSON.stringify(deliverable) !== JSON.stringify(connectedDeliverable)
      ) {
        try {
          const savedEpisode = await saveEpisodeStudio(nextEpisode, {
            expectedUpdatedAt: access.episode.updated_at,
          });
          responseAccess = { ...access, episode: savedEpisode.episode };
        } catch (episodeError) {
          if (!/conditional/i.test(String(episodeError?.message || ''))) {
            throw episodeError;
          }
          episodeLinkDeferred = true;
        }
      }

      logAdminAction(req, access.principal, 'mic_kit.episode_request', {
        episode_id: access.episode.episode_id,
        participant_type: participantType,
        host_person_id: hostPersonId,
        request_id: requestResult.request.request_id,
        created: requestResult.created,
        reopened: requestResult.reopened,
        episode_link_deferred: episodeLinkDeferred,
      });
      return res
        .status(requestResult.created || requestResult.reopened ? 201 : 200)
        .json({
          ...responsePayload(responseAccess, nextTrackerResult),
          created_request_id: requestResult.request.request_id,
          request_created: requestResult.created,
          request_reopened: requestResult.reopened,
          episode_link_deferred: episodeLinkDeferred,
        });
    }

    const actorPersonId = access.binding?.person_id || '';
    if (
      !access.roles.includes('host') ||
      !access.episode.host_person_ids.includes(actorPersonId)
    ) {
      return res.status(403).json({
        ok: false,
        error: 'Only an assigned host can update their microphone plan.',
      });
    }
    if (HOST_LOCKED_STATUSES.has(access.episode.status)) {
      return res.status(409).json({
        ok: false,
        error:
          'This episode package is locked while it is with the producer.',
      });
    }
    if (
      Object.prototype.hasOwnProperty.call(req.body || {}, 'host_person_id') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'person_id') ||
      Object.prototype.hasOwnProperty.call(req.body || {}, 'actor_person_id')
    ) {
      return res.status(400).json({
        ok: false,
        error:
          'The microphone plan owner comes from the signed-in Studio profile.',
      });
    }

    const expectedUpdatedAt = cleanText(
      req.body?.expected_updated_at,
      50
    );
    if (
      !expectedUpdatedAt ||
      expectedUpdatedAt !== access.episode.updated_at
    ) {
      return res.status(409).json({
        ok: false,
        error:
          'This Episode Studio changed in another session. Refresh before saving the microphone plan.',
      });
    }

    const choice = cleanText(req.body?.choice, 40);
    const requestId = cleanText(req.body?.request_id, 120);
    if (choice === 'request_kit') {
      if (!trackerResult.configured) {
        return res.status(503).json({
          ok: false,
          error:
            'Mic-kit requests are not configured. Choose another plan or contact the producer.',
        });
      }
      const linkedRequest = findEpisodeMicKitRequest(trackerResult.tracker, {
        requestId,
        episodeId: access.episode.episode_id,
        hostPersonId: actorPersonId,
      });
      if (
        !linkedRequest ||
        !isActiveEpisodeMicKitRequestCoverage(linkedRequest)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Choose your active mic-kit request for this episode before connecting it.',
        });
      }
    }

    const deliverable = microphonePlanDeliverable(access.episode);
    const micKitPlans = applyEpisodeMicKitPlanUpdate({
      plans: deliverable?.mic_kit_plans,
      hostPersonIds: access.episode.host_person_ids,
      actorPersonId,
      update: {
        choice,
        request_id: requestId,
        equipment_note: req.body?.equipment_note,
      },
    });
    const nextEpisode = normalizeEpisodeStudio({
      ...access.episode,
      deliverables: access.episode.deliverables.map((candidate) =>
        candidate.id === EPISODE_MIC_KIT_DELIVERABLE_ID
          ? { ...candidate, mic_kit_plans: micKitPlans }
          : candidate
      ),
    });
    const saved = await saveEpisodeStudio(nextEpisode, {
      expectedUpdatedAt,
    });
    logAdminAction(req, access.principal, 'episode_studio.mic_plan_update', {
      episode_id: access.episode.episode_id,
      host_person_id: actorPersonId,
      choice,
      request_id: choice === 'request_kit' ? requestId : '',
    });

    return res.status(200).json(
      responsePayload(
        { ...access, episode: saved.episode },
        trackerResult
      )
    );
  } catch (error) {
    const message = String(error.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Microphone plan:/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'This Episode Studio changed in another session. Refresh before saving the microphone plan.'
        : validation
          ? message
          : 'Could not load or save the microphone plan.',
    });
  }
}
