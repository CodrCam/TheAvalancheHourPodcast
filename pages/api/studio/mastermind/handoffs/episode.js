import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import {
  EpisodeStudioCreationError,
  ensureEpisodeStudioFromMastermindPlan,
  getEpisodeStudioCreationDirectory,
} from '../../../../../lib/episodeStudioCreationRuntime';
import { publishEpisodeNotifications } from '../../../../../lib/episodeStudioEvents';
import { episodeStudioSummary } from '../../../../../lib/episodeStudioPresentation.mjs';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  SeasonMastermindServiceError,
} from '../../../../../lib/seasonMastermindClient.mjs';
import {
  handoffReadyPlanToEpisodeStudio,
  SeasonMastermindHandoffError,
} from '../../../../../lib/seasonMastermindHandoffs.mjs';
import { getStudioBindingForSubject } from '../../../../../lib/studioAccessStore';

export const config = { api: { bodyParser: { sizeLimit: '16kb' } } };

function isJsonRequest(req) {
  return (
    String(req.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase() === 'application/json'
  );
}

function errorResponse(error) {
  if (
    error instanceof SeasonMastermindHandoffError ||
    error instanceof EpisodeStudioCreationError ||
    error instanceof SeasonMastermindServiceError
  ) {
    return {
      status: Number(error.status) || 500,
      code: error.code || 'EPISODE_HANDOFF_FAILED',
      message: error.message,
    };
  }
  return {
    status: 500,
    code: 'EPISODE_HANDOFF_FAILED',
    message: 'The Episode Studio handoff could not be completed.',
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MASTERMIND_MANAGE
  );
  if (!principal) return;
  if (!principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_MANAGE)) {
    return res.status(403).json({ ok: false, error: 'Forbidden' });
  }
  if (!isJsonRequest(req)) {
    return res.status(400).json({
      ok: false,
      code: 'CONTENT_TYPE_REQUIRED',
      error: 'Content-Type must be application/json',
    });
  }
  if (!isSeasonMastermindConfigured()) {
    return res.status(503).json({
      ok: false,
      code: 'MASTERMIND_NOT_CONFIGURED',
      error: 'Season Mastermind is not enabled in this environment.',
    });
  }

  const episodePlanId = String(req.body?.episode_plan_id || '').trim();
  const seasonId = String(req.body?.season_id || '').trim();
  const producerPersonId = String(
    req.body?.producer_person_id || ''
  ).trim();
  if (!producerPersonId) {
    return res.status(400).json({
      ok: false,
      code: 'EPISODE_PRODUCER_REQUIRED',
      error: 'Choose a current producer before creating an Episode Studio.',
    });
  }
  try {
    const [binding, directory] = await Promise.all([
      getStudioBindingForSubject(principal.subject),
      getEpisodeStudioCreationDirectory(),
    ]);
    if (!binding?.person_id) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your signed-in account is not connected to a Host Studio profile yet.',
      });
    }
    const actor = {
      person_id: String(binding.person_id),
      can_manage: true,
    };
    const result = await handoffReadyPlanToEpisodeStudio(
      {
        episodePlanId,
        seasonId,
        producerPersonId,
        actor,
        principal,
        creatorBinding: binding,
        directory,
      },
      {
        invokeMastermind: invokeSeasonMastermind,
        ensureEpisodeStudio: ensureEpisodeStudioFromMastermindPlan,
        publishNotifications: publishEpisodeNotifications,
      }
    );
    const summary = episodeStudioSummary(result.episode);

    if (result.outcome === 'link_pending') {
      logAdminAction(req, principal, 'studio.mastermind.handoff_episode', {
        episode_plan_id: episodePlanId,
        episode_id: result.episode.episode_id,
        outcome: 'link_pending',
        episode_created: result.episode_created,
        link_error_code: result.link_error_code,
      });
      return res.status(202).json({
        ok: true,
        code: 'EPISODE_CREATED_LINK_PENDING',
        message:
          result.link_retryable !== false
            ? 'The Episode Studio exists, but its Season Mastermind link still needs repair. Retry this handoff; the Episode Studio will not be duplicated.'
            : 'The Episode Studio exists, but its Season Mastermind link conflicts with another record. Open the Studio and resolve the planning link manually.',
        link_pending: true,
        retryable: result.link_retryable !== false,
        episode: summary,
        episode_created: result.episode_created,
        idempotent: result.episode_idempotent,
      });
    }

    logAdminAction(req, principal, 'studio.mastermind.handoff_episode', {
      episode_plan_id: episodePlanId,
      episode_id: result.episode.episode_id,
      outcome: 'linked',
      episode_created: result.episode_created,
      link_idempotent: result.link_idempotent,
      notification_failed: result.notification_failed,
    });
    return res.status(result.episode_created ? 201 : 200).json({
      ok: true,
      code: result.episode_created
        ? 'EPISODE_HANDOFF_CREATED'
        : 'EPISODE_HANDOFF_ALREADY_COMPLETE',
      link_pending: false,
      created: result.episode_created,
      idempotent:
        result.episode_idempotent || result.link_idempotent || false,
      episode: summary,
      plan: result.plan,
    });
  } catch (error) {
    const response = errorResponse(error);
    if (response.status >= 500) {
      console.error('mastermind Episode Studio handoff failed:', error);
    }
    logAdminAction(req, principal, 'studio.mastermind.handoff_episode', {
      episode_plan_id: episodePlanId,
      outcome: 'failed_before_episode_creation',
      error_code: response.code,
    });
    return res.status(response.status).json({
      ok: false,
      code: response.code,
      error: response.message,
    });
  }
}
