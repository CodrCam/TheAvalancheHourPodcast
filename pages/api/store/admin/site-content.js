import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getHomeContent,
  saveHomeContent,
} from '../../../../lib/siteContentStore';

export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.BANNERS_READ
      : ADMIN_PERMISSIONS.BANNERS_UPDATE;

  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) {
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await getHomeContent({ allowDefault: true });
      return res.status(200).json({ ok: true, ...result });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const result = await saveHomeContent(req.body?.content || {});
    logAdminAction(req, principal, 'site_content.save', {
      content_key: result.content?.content_key || 'homepage_cta',
      spotlight_enabled: result.content?.spotlight_enabled,
      instagram_enabled: result.content?.instagram_enabled,
    });
    return res.status(200).json({ ok: true, ...result });
  } catch (err) {
    console.error('admin site content error:', err);
    return res.status(500).json({
      ok: false,
      error: 'Failed to load or save site content',
    });
  }
}
