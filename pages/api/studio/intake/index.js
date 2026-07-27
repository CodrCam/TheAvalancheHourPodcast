import crypto from 'crypto';
import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import { listPeople } from '../../../../lib/peopleStore';
import { getStudioBindingForSubject } from '../../../../lib/studioAccessStore';
import {
  addStudioIntakeComment,
  mergeStudioIntakeManagerValues,
  summarizeStudioIntake,
} from '../../../../lib/studioIntakePresentation.mjs';
import {
  createStudioIntakeItem,
  getStudioIntakeItem,
  listStudioIntakeItems,
  saveStudioIntakeItem,
} from '../../../../lib/studioIntakeStore';

export const config = { api: { bodyParser: { sizeLimit: '64kb' } } };

async function actorFor(principal) {
  const binding = await getStudioBindingForSubject(principal.subject);
  return {
    person_id: binding?.person_id || '',
    name:
      String(principal.displayName || '').trim() ||
      String(principal.username || '').trim() ||
      'Team member',
    role: principal.role || '',
  };
}

async function assigneeDirectory() {
  const result = await listPeople({
    allowStaticFallback: true,
    includeInactive: false,
  });
  return result.people
    .filter((person) => person.active !== false)
    .map((person) => ({
      person_id: person.person_id,
      name: person.name,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

function isConflict(error) {
  return /changed elsewhere|refresh this item/i.test(
    String(error?.message || '')
  );
}

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const action = String(req.body?.action || '');
  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.INTAKE_READ
      : req.method === 'PATCH' && action === 'update'
        ? ADMIN_PERMISSIONS.INTAKE_MANAGE
        : ADMIN_PERMISSIONS.INTAKE_CREATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;
  res.setHeader('Cache-Control', 'no-store, private');

  try {
    const canManage = principal.permissions.includes(
      ADMIN_PERMISSIONS.INTAKE_MANAGE
    );
    if (req.method === 'GET') {
      const [result, actor, assignees] = await Promise.all([
        listStudioIntakeItems(),
        actorFor(principal),
        canManage ? assigneeDirectory() : Promise.resolve([]),
      ]);
      return res.status(200).json({
        ok: true,
        ...result,
        summary: summarizeStudioIntake(result.items),
        canManage,
        viewer_person_id: actor.person_id,
        assignees,
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const actor = await actorFor(principal);
    if (req.method === 'POST') {
      const input = req.body?.item || {};
      const kind = String(input.kind || '');
      const requestedPriority = String(input.priority || '');
      const priority =
        kind === 'blocker'
          ? 'high'
          : ['normal', 'high'].includes(requestedPriority)
            ? requestedPriority
            : 'normal';
      const result = await createStudioIntakeItem({
        kind,
        title: input.title,
        details: input.details,
        priority,
        status: 'new',
        target_date: '',
        assigned_to_person_id: '',
        assigned_to_name: '',
        created_by_person_id: actor.person_id,
        created_by_name: actor.name,
        created_by_role: actor.role,
        comments: [],
        archived: false,
      });
      logAdminAction(req, principal, 'studio.intake_create', {
        item_id: result.item.item_id,
        kind: result.item.kind,
        priority: result.item.priority,
      });
      return res.status(201).json({
        ok: true,
        ...result,
        canManage,
      });
    }

    const itemId = String(req.body?.item_id || '').trim();
    const current = await getStudioIntakeItem(itemId);
    if (!current.item || current.item.archived) {
      return res
        .status(404)
        .json({ ok: false, error: 'Team follow-up not found.' });
    }
    const expectedUpdatedAt = String(
      req.body?.expected_updated_at || ''
    ).trim();

    if (action === 'comment') {
      const next = addStudioIntakeComment(current.item, {
        comment_id: `comment-${crypto.randomUUID()}`,
        body: req.body?.body,
        author_person_id: actor.person_id,
        author_name: actor.name,
        author_role: actor.role,
        created_at: new Date().toISOString(),
      });
      const saved = await saveStudioIntakeItem(next, {
        expectedUpdatedAt,
      });
      logAdminAction(req, principal, 'studio.intake_comment', {
        item_id: saved.item.item_id,
      });
      return res.status(200).json({ ok: true, ...saved, canManage });
    }

    if (action === 'update' && canManage) {
      const update = req.body?.item || {};
      const assignees = await assigneeDirectory();
      const assignedPersonId = String(
        update.assigned_to_person_id || ''
      ).trim();
      const assignedPerson = assignedPersonId
        ? assignees.find(
            (person) => person.person_id === assignedPersonId
          )
        : null;
      if (assignedPersonId && !assignedPerson) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a current team member for this item.',
        });
      }
      let next = mergeStudioIntakeManagerValues(current.item, {
        ...update,
        assigned_to_person_id: assignedPersonId,
        assigned_to_name: assignedPerson?.name || '',
      });
      if (String(req.body?.note || '').trim()) {
        next = addStudioIntakeComment(next, {
          comment_id: `comment-${crypto.randomUUID()}`,
          body: req.body.note,
          author_person_id: actor.person_id,
          author_name: actor.name,
          author_role: actor.role,
          created_at: new Date().toISOString(),
        });
      }
      const saved = await saveStudioIntakeItem(next, {
        expectedUpdatedAt,
      });
      logAdminAction(req, principal, 'studio.intake_update', {
        item_id: saved.item.item_id,
        status: saved.item.status,
        priority: saved.item.priority,
        assigned_to_person_id: saved.item.assigned_to_person_id,
      });
      return res.status(200).json({
        ok: true,
        ...saved,
        canManage,
        summary: summarizeStudioIntake([saved.item]),
      });
    }

    return res.status(400).json({
      ok: false,
      error: 'Choose a valid follow-up action.',
    });
  } catch (error) {
    console.error('studio intake error:', error);
    const conflict = isConflict(error);
    const validation = /Team follow-up:|choose a current/i.test(
      String(error?.message || '')
    );
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? error.message
        : validation
          ? error.message
          : 'Could not update the team follow-up.',
    });
  }
}
