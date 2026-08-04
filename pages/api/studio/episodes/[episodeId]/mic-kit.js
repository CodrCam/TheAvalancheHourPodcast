import { ADMIN_PERMISSIONS } from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import { requireEpisodeStudioAccess } from '../../../../../lib/episodeStudioAccess';
import {
  EPISODE_MIC_KIT_DELIVERABLE_ID,
  applyEpisodeMicKitPlanUpdate,
  buildEpisodeMicKitPlanRows,
  getEpisodeGuestMicKitRequestCoverage,
  getEpisodeMicKitRequestCoverage,
  findEpisodeMicKitRequest,
  isActiveEpisodeMicKitRequestCoverage,
} from '../../../../../lib/episodeMicKitPresentation.mjs';
import { normalizeEpisodeStudio } from '../../../../../lib/episodeStudioPresentation.mjs';
import { saveEpisodeStudio } from '../../../../../lib/episodeStudioStore';
import { getMicKitTracker } from '../../../../../lib/micKitStore';

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

function responsePayload(access, trackerResult) {
  const deliverable = microphonePlanDeliverable(access.episode);
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
    plans,
    guest_plan: guestPlan,
    request_coverage: requestCoverage,
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const episodeId = cleanText(req.query.episodeId, 120);
  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.MIC_KITS_READ
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
