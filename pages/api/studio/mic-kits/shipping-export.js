import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  buildPirateShipCsv,
  listPirateShipSpreadsheetShipments,
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

  let auditDetails = {
    provider: 'pirate_ship_spreadsheet',
    outcome: 'failed',
    shipment_count: 0,
    kit_ids: [],
    request_ids: [],
  };
  try {
    const result = await getMicKitTracker();
    const today = new Date().toISOString().slice(0, 10);
    const shipments = listPirateShipSpreadsheetShipments(result.tracker, {
      today,
    });
    const csv = buildPirateShipCsv(result.tracker, { today });

    auditDetails = {
      ...auditDetails,
      outcome: 'succeeded',
      shipment_count: shipments.length,
      kit_ids: shipments.map((shipment) => shipment.kit_id),
      request_ids: shipments.map((shipment) => shipment.request_id),
    };
    logAdminAction(
      req,
      principal,
      'mic_kit.shipping_export',
      auditDetails
    );

    res.setHeader('Cache-Control', 'private, no-store');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="pirate-ship-mic-kits-${today}.csv"`
    );
    return res.status(200).send(`\uFEFF${csv}`);
  } catch (error) {
    console.error('mic kit shipping export error:', error);
    logAdminAction(
      req,
      principal,
      'mic_kit.shipping_export',
      auditDetails
    );
    return res.status(500).json({
      ok: false,
      error: 'Could not prepare the shipping spreadsheet.',
    });
  }
}
