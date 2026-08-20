import crypto from 'crypto';
import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  SeasonMastermindServiceError,
} from '../../../../lib/seasonMastermindClient.mjs';
import { normalizeSeasonMastermindOverview } from '../../../../lib/seasonMastermindOverview.mjs';

function overviewActorId(principal = {}) {
  const subject = String(principal.subject || '').trim();
  if (!subject) return '';
  const digest = crypto
    .createHash('sha256')
    .update(`season-mastermind-overview:${subject}`, 'utf8')
    .digest('hex');
  return `overview:${digest}`;
}

function errorResponse(error) {
  if (error instanceof SeasonMastermindServiceError) {
    return {
      status: error.status || 500,
      body: {
        ok: false,
        code: error.code || 'MASTERMIND_OVERVIEW_FAILED',
        error: error.message,
      },
    };
  }
  return {
    status: 500,
    body: {
      ok: false,
      code: 'MASTERMIND_OVERVIEW_FAILED',
      error: 'The current season overview could not be loaded.',
    },
  };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');

  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MASTERMIND_READ
  );
  if (!principal) return;

  if (Object.keys(req.query || {}).length) {
    return res.status(400).json({
      ok: false,
      code: 'MASTERMIND_OVERVIEW_QUERY_UNSUPPORTED',
      error: 'The current season overview does not accept filters.',
    });
  }

  if (!isSeasonMastermindConfigured()) {
    return res.status(503).json({
      ok: false,
      configured: false,
      code: 'MASTERMIND_NOT_CONFIGURED',
      error: 'Season Mastermind is not enabled in this environment.',
    });
  }

  const personId = overviewActorId(principal);
  if (!personId) {
    return res.status(401).json({
      ok: false,
      code: 'STUDIO_IDENTITY_INVALID',
      error: 'The signed-in Studio identity is incomplete.',
    });
  }

  try {
    const result = await invokeSeasonMastermind({
      operation: 'get_season_overview',
      actor: {
        person_id: personId,
        can_manage: principal.permissions.includes(
          ADMIN_PERMISSIONS.MASTERMIND_MANAGE
        ),
      },
      input: {},
    });
    return res.status(200).json({
      ok: true,
      configured: true,
      ...normalizeSeasonMastermindOverview(result),
    });
  } catch (error) {
    if (!(error instanceof SeasonMastermindServiceError)) {
      console.error('season mastermind overview failed:', error);
    }
    const response = errorResponse(error);
    return res.status(response.status).json(response.body);
  }
}
