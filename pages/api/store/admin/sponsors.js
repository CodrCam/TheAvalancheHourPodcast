import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  deleteSponsor,
  groupSponsorsByTier,
  listSponsors,
  saveSponsor,
} from '../../../../lib/sponsorStore';

export const config = { api: { bodyParser: { sizeLimit: '1mb' } } };

export default async function handler(req, res) {
  if (!['GET', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.SPONSORS_READ
      : ADMIN_PERMISSIONS.SPONSORS_UPDATE;

  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) {
    return;
  }

  try {
    if (req.method === 'GET') {
      const result = await listSponsors({ allowStaticFallback: true });
      return res.status(200).json({
        ok: true,
        ...result,
        tiers: groupSponsorsByTier(result.sponsors),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    if (req.method === 'DELETE') {
      const deleted = await deleteSponsor(req.body?.sponsor_id || req.body?.id);
      logAdminAction(req, principal, 'sponsor.delete', {
        sponsor_id: deleted.sponsor_id,
      });
      return res.status(200).json({ ok: true, deleted });
    }

    const sponsor = await saveSponsor(req.body?.sponsor || {});
    logAdminAction(req, principal, 'sponsor.save', {
      sponsor_id: sponsor.sponsor_id,
      name: sponsor.name,
      tier: sponsor.tier,
      active: sponsor.active,
      episode_count: sponsor.episode_ids?.length || 0,
      logo_type: sponsor.logo?.startsWith('data:')
        ? 'uploaded'
        : sponsor.logo
          ? 'path_or_url'
          : 'none',
    });
    return res.status(200).json({ ok: true, sponsor });
  } catch (err) {
    console.error('admin sponsors error:', err);
    return res.status(500).json({
      ok: false,
      error: err.message || 'Failed to update sponsors',
    });
  }
}
