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
        canUpdate: principal.permissions.includes(
          ADMIN_PERMISSIONS.SPONSORS_UPDATE
        ),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    if (req.method === 'DELETE') {
      const deleteOptions = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'expected_updated_at'
      )
        ? { expectedUpdatedAt: req.body.expected_updated_at }
        : {};
      const deleted = await deleteSponsor(
        req.body?.sponsor_id || req.body?.id,
        deleteOptions
      );
      logAdminAction(req, principal, 'sponsor.delete', {
        sponsor_id: deleted.sponsor_id,
      });
      return res.status(200).json({ ok: true, deleted });
    }

    const saveOptions = {
      createOnly: req.body?.create === true,
      requireExisting: req.body?.create === false,
      ...(Object.prototype.hasOwnProperty.call(
        req.body || {},
        'expected_updated_at'
      )
        ? { expectedUpdatedAt: req.body.expected_updated_at }
        : {}),
    };
    const sponsor = await saveSponsor(req.body?.sponsor || {}, saveOptions);
    logAdminAction(req, principal, 'sponsor.save', {
      sponsor_id: sponsor.sponsor_id,
      name: sponsor.name,
      tier: sponsor.tier,
      active: sponsor.active,
      episode_count: sponsor.episode_ids?.length || 0,
      has_promo_code: !!sponsor.promo_code,
      logo_type: sponsor.logo?.startsWith('data:')
        ? 'uploaded'
        : sponsor.logo
          ? 'path_or_url'
          : 'none',
    });
    return res.status(200).json({ ok: true, sponsor });
  } catch (err) {
    console.error('admin sponsors error:', err);
    const isConflict = /conditional|already exists|does not exist/i.test(
      String(err.message || '')
    );
    return res.status(isConflict ? 409 : 500).json({
      ok: false,
      error: isConflict
        ? 'That sponsor changed or already exists. Refresh and try again.'
        : err.message || 'Failed to update sponsors',
    });
  }
}
