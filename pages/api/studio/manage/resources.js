import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getStudioGuide,
  publishStudioGuide,
  saveStudioGuideDraft,
} from '../../../../lib/studioGuideStore';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

function getActor(principal) {
  return (
    String(principal?.username || principal?.subject || '').trim() || 'unknown'
  );
}

export default async function handler(req, res) {
  if (!['GET', 'PUT', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PUT,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'PATCH'
      ? ADMIN_PERMISSIONS.RESOURCES_PUBLISH
      : ADMIN_PERMISSIONS.RESOURCES_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    if (req.method === 'GET') {
      const result = await getStudioGuide({
        forHosts: false,
        includeDraft: true,
      });
      return res.status(200).json({
        ok: true,
        ...result,
        canPublish: principal.permissions.includes(
          ADMIN_PERMISSIONS.RESOURCES_PUBLISH
        ),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const actor = getActor(principal);

    if (req.method === 'PUT') {
      const result = await saveStudioGuideDraft(req.body?.guide || {}, {
        expectedDraftUpdatedAt: req.body?.expected_draft_updated_at || '',
        updatedBy: actor,
      });
      logAdminAction(req, principal, 'studio_resources.draft_save', {
        section_count: result.guide.sections.length,
        published_section_count: result.guide.sections.filter(
          (section) => section.published
        ).length,
      });

      return res.status(200).json({ ok: true, ...result });
    }

    const result = await publishStudioGuide(req.body?.guide || {}, {
      expectedUpdatedAt: req.body?.expected_updated_at || '',
      expectedDraftUpdatedAt: req.body?.expected_draft_updated_at || '',
      updatedBy: actor,
    });
    logAdminAction(req, principal, 'studio_resources.publish', {
      section_count: result.guide.sections.length,
      published_section_count: result.guide.sections.filter(
        (section) => section.published
      ).length,
    });

    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('studio resources manage error:', err);
    const isConflict = /conditional|changed/i.test(String(err.message || ''));
    const isValidation = String(err.message || '').startsWith('Studio guide:');
    const conflictMessage =
      req.method === 'PUT'
        ? 'The draft changed in another session. Refresh before saving.'
        : 'The guide or draft changed in another session. Refresh before publishing.';
    return res.status(isConflict ? 409 : isValidation ? 400 : 500).json({
      ok: false,
      error: isConflict
        ? conflictMessage
        : err.message || 'Failed to update Host Studio resources.',
    });
  }
}
