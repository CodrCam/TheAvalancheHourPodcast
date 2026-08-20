import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import { isEpisodeRequestItem } from '../../../../../lib/episodeRequest.mjs';
import { getEpisodeStudioCreationDirectory } from '../../../../../lib/episodeStudioCreationRuntime';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  SeasonMastermindServiceError,
} from '../../../../../lib/seasonMastermindClient.mjs';
import {
  handoffStudioIntakeToMastermind,
  SeasonMastermindHandoffError,
} from '../../../../../lib/seasonMastermindHandoffs.mjs';
import { getStudioBindingForSubject } from '../../../../../lib/studioAccessStore';
import { getStudioIntakeItem } from '../../../../../lib/studioIntakeStore';

export const config = { api: { bodyParser: { sizeLimit: '32kb' } } };

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
    error instanceof SeasonMastermindServiceError
  ) {
    return {
      status: Number(error.status) || 500,
      code: error.code || 'MASTERMIND_HANDOFF_FAILED',
      message: error.message,
    };
  }
  return {
    status: 500,
    code: 'MASTERMIND_HANDOFF_FAILED',
    message: 'The reviewed Follow-up handoff could not be completed.',
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
  if (!principal.permissions.includes(ADMIN_PERMISSIONS.INTAKE_MANAGE)) {
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

  const itemId = String(req.body?.item_id || '').trim();
  try {
    const [binding, source] = await Promise.all([
      getStudioBindingForSubject(principal.subject),
      getStudioIntakeItem(itemId),
    ]);
    if (!binding?.person_id) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your signed-in account is not connected to a Host Studio profile yet.',
      });
    }
    if (source.configured === false) {
      return res.status(503).json({
        ok: false,
        code: 'INTAKE_NOT_CONFIGURED',
        error: 'Team Follow-up storage is not configured.',
      });
    }
    if (!source.item || source.item.archived) {
      return res.status(404).json({
        ok: false,
        code: 'INTAKE_NOT_FOUND',
        error: 'Team Follow-up not found.',
      });
    }
    if (!isEpisodeRequestItem(source.item)) {
      return res.status(409).json({
        ok: false,
        code: 'EPISODE_REQUEST_REQUIRED',
        error:
          'Only an Episode request can begin a Season Mastermind planning handoff.',
      });
    }

    const directory = await getEpisodeStudioCreationDirectory();
    const actor = {
      person_id: String(binding.person_id),
      can_manage: true,
    };
    const result = await handoffStudioIntakeToMastermind(
      {
        sourceItem: source.item,
        approved: req.body?.plan || {},
        actor,
        directory: directory.hosts,
      },
      { invokeMastermind: invokeSeasonMastermind }
    );
    const created = result.created === true;
    const plan = result.plan || null;
    logAdminAction(req, principal, 'studio.mastermind.handoff_intake', {
      item_id: source.item.item_id,
      episode_plan_id:
        plan?.episode_plan_id || result.requested_plan_id || '',
      outcome: created ? 'created' : 'idempotent',
      source_status: source.item.status,
    });
    return res.status(created ? 201 : 200).json({
      ok: true,
      code: created
        ? 'MASTERMIND_PLAN_CREATED'
        : 'MASTERMIND_PLAN_ALREADY_EXISTS',
      created,
      idempotent: !created,
      source_status_preserved: true,
      plan,
    });
  } catch (error) {
    const response = errorResponse(error);
    if (response.status >= 500) {
      console.error('studio intake mastermind handoff failed:', error);
    }
    logAdminAction(req, principal, 'studio.mastermind.handoff_intake', {
      item_id: itemId,
      outcome: 'failed',
      error_code: response.code,
    });
    return res.status(response.status).json({
      ok: false,
      code: response.code,
      error: response.message,
    });
  }
}
