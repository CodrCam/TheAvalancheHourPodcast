// pages/api/debug-order-insert.js
import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../lib/adminAuth';
import { upsertOrder } from '../../lib/orderStore';

export default async function handler(req, res) {
  if (!(await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.USERS_MANAGE))) {
    return;
  }

  try {
    const result = await upsertOrder({
      order_id: 'debug-order-1',
      stripe_payment_intent_id: 'pi_debug_123',
      status: 'paid',
      fulfillment_status: 'new',
      amount_cents: 1234,
      items: [{ sku: 'test-sku', qty: 1 }],
    });

    return res.status(200).json(result);
  } catch (err) {
    console.error('debug-order-insert error:', err);
    return res.status(500).json({ error: String(err) });
  }
}
