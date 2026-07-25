import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  buildUspsClickNShipCsv,
  listUspsClickNShipShipments,
} from '../../../../lib/micKitShipping.mjs';
import { getMicKitTracker } from '../../../../lib/micKitStore';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.MIC_KITS_MANAGE
  );
  if (!principal) return;

  try {
    const result = await getMicKitTracker();
    const today = new Date().toISOString().slice(0, 10);
    const shipments = listUspsClickNShipShipments(result.tracker, {
      today,
    });
    const csv = buildUspsClickNShipCsv(result.tracker, { today });

    logAdminAction(req, principal, 'mic_kit.shipping_export', {
      provider: 'usps_click_n_ship',
      shipment_count: shipments.length,
    });

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="usps-click-n-ship-mic-kits-${today}.csv"`
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('mic kit shipping export error:', error);
    return res.status(500).json({
      ok: false,
      error: 'Could not prepare the shipping spreadsheet.',
    });
  }
}
