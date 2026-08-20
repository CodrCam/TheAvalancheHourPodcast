import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { logAdminAction } from '../../../lib/adminAudit';
import {
  buildEpisodeIdeaIntakeItem,
  canViewEpisodeIdea,
  createEpisodeIdeaRecord,
  episodeIdeaApprovalReplayState,
  episodeIdeaPlanningFollowUpMatches,
  projectEpisodeIdea,
  reviewEpisodeIdea,
  submitEpisodeIdea,
  summarizeEpisodeIdeas,
  updateEpisodeIdeaDraft,
} from '../../../lib/episodeIdea.mjs';
import { getPersonStudioCapabilities } from '../../../lib/peopleStudioCapabilities.mjs';
import { getPersonById } from '../../../lib/peopleStore';
import { getStudioBindingForSubject } from '../../../lib/studioAccessStore';
import {
  approveStudioEpisodeIdea,
  bindStudioEpisodeIdeaCreation,
  createDeterministicStudioEpisodeIdeaId,
  createStudioEpisodeIdea,
  getStudioEpisodeIdea,
  listStudioEpisodeIdeas,
  normalizeStudioEpisodeIdeaRequestId,
  saveStudioEpisodeIdea,
} from '../../../lib/studioEpisodeIdeaStore';
import { getStudioIntakeItem } from '../../../lib/studioIntakeStore';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

const OWNER_ACTIONS = new Set(['save_draft', 'submit']);
const MANAGER_ACTIONS = new Set([
  'start_review',
  'request_changes',
  'approve',
  'defer',
  'reopen',
]);

function isJsonRequest(req) {
  return (
    String(req.headers['content-type'] || '')
      .split(';', 1)[0]
      .trim()
      .toLowerCase() === 'application/json'
  );
}

function hasPermission(principal, permission) {
  return (principal?.permissions || []).includes(permission);
}

async function viewerFor(principal) {
  const binding = await getStudioBindingForSubject(principal.subject);
  if (!binding?.person_id) return null;
  const result = await getPersonById(binding.person_id, {
    allowStaticFallback: true,
    includeInactive: true,
  });
  const person = result?.person || null;
  const capabilities = getPersonStudioCapabilities(person || {});
  return {
    person_id: String(binding.person_id),
    name:
      String(person?.name || '').trim() ||
      String(principal.displayName || '').trim() ||
      String(principal.username || '').trim() ||
      'Team member',
    is_producer: person?.active === true && capabilities.producer === true,
  };
}

function responseContext(principal, viewer) {
  const canManage = hasPermission(principal, ADMIN_PERMISSIONS.INTAKE_MANAGE);
  const canReview = canManage || viewer.is_producer;
  return {
    canManage,
    canReview,
    canViewTeam: canReview,
    viewerPersonId: viewer.person_id,
  };
}

function projectedIdea(idea, context) {
  return projectEpisodeIdea(idea, {
    viewerPersonId: context.viewerPersonId,
    canManage: context.canManage,
  });
}

function errorStatus(error) {
  const message = String(error?.message || '');
  if (/changed elsewhere|refresh this idea/i.test(message)) return 409;
  if (/creation request was already used/i.test(message)) return 409;
  if (/not configured/i.test(message)) return 503;
  if (/^Episode idea:/i.test(message)) return 400;
  return 500;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'private, no-store');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.EPISODES_READ
  );
  if (!principal) return;

  try {
    const viewer = await viewerFor(principal);
    if (!viewer) {
      return res.status(409).json({
        ok: false,
        code: 'PROFILE_NOT_CONNECTED',
        error:
          'Your signed-in account is not connected to a Host Studio profile yet.',
      });
    }
    const context = responseContext(principal, viewer);

    if (req.method === 'GET') {
      const result = await listStudioEpisodeIdeas();
      const visible = (result.ideas || []).filter((idea) =>
        canViewEpisodeIdea(idea, {
          viewerPersonId: context.viewerPersonId,
          canViewTeam: context.canViewTeam,
        })
      );
      return res.status(200).json({
        ok: true,
        configured: result.configured,
        scope: context.canViewTeam ? 'team' : 'mine',
        canManage: context.canManage,
        canReview: context.canReview,
        viewer_person_id: context.viewerPersonId,
        ideas: visible.map((idea) => projectedIdea(idea, context)),
        items: visible.map((idea) => projectedIdea(idea, context)),
        summary: summarizeEpisodeIdeas(visible),
      });
    }

    if (!isJsonRequest(req)) {
      return res.status(400).json({
        ok: false,
        code: 'CONTENT_TYPE_REQUIRED',
        error: 'Content-Type must be application/json',
      });
    }

    if (req.method === 'POST') {
      if (!hasPermission(principal, ADMIN_PERMISSIONS.INTAKE_CREATE)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const action = String(req.body?.action || 'create_draft');
      if (!['create_draft', 'submit_new'].includes(action)) {
        return res.status(400).json({
          ok: false,
          error: 'Choose whether to save a draft or submit a new idea.',
        });
      }
      const requestId = normalizeStudioEpisodeIdeaRequestId(
        req.body?.request_id
      );
      if (!requestId) {
        return res.status(400).json({
          ok: false,
          code: 'EPISODE_IDEA_REQUEST_ID_REQUIRED',
          error: 'Refresh the Idea Desk and try creating the pitch again.',
        });
      }
      const ideaId = createDeterministicStudioEpisodeIdeaId({
        ownerPersonId: viewer.person_id,
        requestId,
      });
      const idea = bindStudioEpisodeIdeaCreation(createEpisodeIdeaRecord(
        req.body?.idea || {},
        viewer,
        {
          ideaId,
          submit: action === 'submit_new',
        }
      ), {
        requestId,
      });
      const saved = await createStudioEpisodeIdea(idea);
      const responseIdea = projectedIdea(saved.idea, context);
      logAdminAction(req, principal, 'studio.episode_idea_create', {
        idea_id: saved.idea.idea_id,
        status: saved.idea.status,
        outcome: saved.idempotent ? 'idempotent' : 'created',
      });
      return res.status(saved.idempotent ? 200 : 201).json({
        ok: true,
        configured: saved.configured,
        idempotent: saved.idempotent,
        idea: responseIdea,
        item: responseIdea,
      });
    }

    const action = String(req.body?.action || '').trim();
    if (!OWNER_ACTIONS.has(action) && !MANAGER_ACTIONS.has(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a valid episode-idea action.',
      });
    }
    const ideaId = String(req.body?.idea_id || '').trim();
    const current = await getStudioEpisodeIdea(ideaId);
    if (current.configured === false) {
      return res.status(503).json({
        ok: false,
        code: 'EPISODE_IDEA_STORAGE_UNAVAILABLE',
        error: 'The Episode Idea Desk is not configured yet.',
      });
    }
    if (!current.idea || current.idea.archived) {
      return res
        .status(404)
        .json({ ok: false, error: 'Episode idea not found.' });
    }

    let next;
    let saved;
    if (OWNER_ACTIONS.has(action)) {
      if (!hasPermission(principal, ADMIN_PERMISSIONS.INTAKE_CREATE)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (current.idea.owner_person_id !== viewer.person_id) {
        return res.status(403).json({
          ok: false,
          error: 'Only the host who created this idea can edit or submit it.',
        });
      }
      next = updateEpisodeIdeaDraft(current.idea, req.body?.idea || current.idea);
      if (action === 'submit') next = submitEpisodeIdea(next);
    } else {
      if (!context.canManage) {
        return res.status(403).json({
          ok: false,
          error: 'Only a Studio manager can make planning decisions.',
        });
      }
      if (action === 'approve') {
        const intake = buildEpisodeIdeaIntakeItem(current.idea);
        if (current.idea.status === 'approved') {
          const existing = await getStudioIntakeItem(intake.item_id);
          if (
            episodeIdeaApprovalReplayState(current.idea, existing.item) ===
            'complete'
          ) {
            const responseIdea = projectedIdea(current.idea, context);
            logAdminAction(req, principal, 'studio.episode_idea_approve', {
              idea_id: current.idea.idea_id,
              status: current.idea.status,
              source_intake_item_id: current.idea.source_intake_item_id,
              outcome: 'idempotent',
            });
            return res.status(200).json({
              ok: true,
              configured: current.configured,
              idempotent: true,
              idea: responseIdea,
              item: responseIdea,
            });
          }
          return res.status(409).json({
            ok: false,
            code: 'EPISODE_IDEA_APPROVAL_REPAIR_REQUIRED',
            error:
              'This idea says it was approved, but its planning Follow-up is missing or no longer matches. A Studio manager must repair the link before retrying.',
          });
        }
        next = reviewEpisodeIdea(current.idea, action, viewer, {
          decisionNote: req.body?.decision_note,
          sourceIntakeItemId: intake.item_id,
        });
        const existing = await getStudioIntakeItem(intake.item_id);
        if (existing.configured === false) {
          throw new Error('Episode idea storage is not configured.');
        }
        if (existing.item) {
          if (!episodeIdeaPlanningFollowUpMatches(existing.item, next)) {
            throw new Error(
              'Episode idea: the planning Follow-up ID is already used by a different record.'
            );
          }
          saved = await saveStudioEpisodeIdea(next, {
            expectedUpdatedAt: req.body?.expected_updated_at,
          });
        } else {
          saved = await approveStudioEpisodeIdea(next, intake, {
            expectedUpdatedAt: req.body?.expected_updated_at,
          });
        }
        next = saved.idea;
      } else {
        next = reviewEpisodeIdea(current.idea, action, viewer, {
          decisionNote: req.body?.decision_note,
        });
      }
    }

    if (!saved) {
      saved = await saveStudioEpisodeIdea(next, {
        expectedUpdatedAt: req.body?.expected_updated_at,
      });
    }
    const responseIdea = projectedIdea(saved.idea, context);
    logAdminAction(req, principal, `studio.episode_idea_${action}`, {
      idea_id: saved.idea.idea_id,
      status: saved.idea.status,
      source_intake_item_id: saved.idea.source_intake_item_id,
    });
    return res.status(200).json({
      ok: true,
      configured: saved.configured,
      idea: responseIdea,
      item: responseIdea,
    });
  } catch (error) {
    const status = errorStatus(error);
    if (status >= 500) console.error('studio episode idea error:', error);
    return res.status(status).json({
      ok: false,
      error:
        status >= 500
          ? 'The Episode Idea Desk could not complete that request.'
          : error.message,
    });
  }
}
