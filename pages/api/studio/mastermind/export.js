import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  SeasonMastermindServiceError,
} from '../../../../lib/seasonMastermindClient.mjs';
import { buildSeasonMastermindCsv } from '../../../../lib/seasonMastermindExport.mjs';
import { normalizeSeasonMastermindData } from '../../../../lib/seasonMastermindPresentation.mjs';
import {
  MastermindInputError,
  normalizeMastermindListInput,
} from '../../../../lib/seasonMastermindRequest.mjs';
import { getStudioBindingForSubject } from '../../../../lib/studioAccessStore';

const MAX_EXPORT_PAGES = 10;
const MAX_EXPORT_BYTES = 2 * 1024 * 1024;

function errorResponse(error) {
  if (
    error instanceof MastermindInputError ||
    error instanceof SeasonMastermindServiceError
  ) {
    return {
      status: Number(error.status) || 500,
      code: error.code || 'MASTERMIND_EXPORT_FAILED',
      message: error.message,
    };
  }
  return {
    status: 500,
    code: 'MASTERMIND_EXPORT_FAILED',
    message: 'The Season Mastermind export could not be prepared.',
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
    ADMIN_PERMISSIONS.MASTERMIND_MANAGE
  );
  if (!principal) return;
  if (!isSeasonMastermindConfigured()) {
    return res.status(503).json({
      ok: false,
      code: 'MASTERMIND_NOT_CONFIGURED',
      error: 'Season Mastermind is not enabled in this environment.',
    });
  }

  let audit = {
    season_id: String(req.query?.season_id || '').trim(),
    outcome: 'failed',
    plan_count: 0,
  };
  try {
    const binding = await getStudioBindingForSubject(principal.subject);
    if (!binding?.person_id) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your signed-in account is not connected to a Host Studio profile yet.',
      });
    }
    const actor = { person_id: String(binding.person_id), can_manage: true };
    const baseInput = normalizeMastermindListInput(
      {
        season_id: req.query?.season_id,
        include_archived: 'true',
        page_size: 50,
      },
      actor
    );
    const seasons = new Map();
    const plans = [];
    let exhausted = false;

    for (let page = 1; page <= MAX_EXPORT_PAGES; page += 1) {
      const result = await invokeSeasonMastermind({
        operation: 'list_mastermind',
        actor,
        input: { ...baseInput, page, page_size: 50 },
      });
      const normalized = normalizeSeasonMastermindData(result);
      normalized.seasons.forEach((season) =>
        seasons.set(season.season_id, season)
      );
      plans.push(...normalized.plans);
      if (normalized.page.has_more !== true) {
        exhausted = true;
        break;
      }
    }

    if (!exhausted) {
      return res.status(409).json({
        ok: false,
        code: 'MASTERMIND_EXPORT_BOUNDED',
        error:
          'This season has more than 500 plans. Narrow the season before exporting.',
      });
    }
    const csv = buildSeasonMastermindCsv({
      seasons: [...seasons.values()],
      plans,
    });
    if (Buffer.byteLength(csv, 'utf8') > MAX_EXPORT_BYTES) {
      return res.status(409).json({
        ok: false,
        code: 'MASTERMIND_EXPORT_TOO_LARGE',
        error: 'This season export is larger than the safe download limit.',
      });
    }

    audit = { ...audit, outcome: 'succeeded', plan_count: plans.length };
    logAdminAction(req, principal, 'studio.mastermind.export', audit);
    const today = new Date().toISOString().slice(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="season-mastermind-${today}.csv"`
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    const response = errorResponse(error);
    if (response.status >= 500) {
      console.error('season mastermind export failed:', error);
    }
    logAdminAction(req, principal, 'studio.mastermind.export', audit);
    return res.status(response.status).json({
      ok: false,
      code: response.code,
      error: response.message,
    });
  }
}
