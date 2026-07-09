import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import {
  applyInventoryDelta,
  deleteInventorySku,
  setInventoryHidden,
  setInventoryQuantity,
} from '../../../../lib/inventoryStore';

export const config = { api: { bodyParser: true } };

function normalizeBody(req, mode) {
  // mode: 'delta' for PUT, 'set' for PATCH
  const b = req.body || {};
  if (Array.isArray(b.items)) return b.items;
  if (mode === 'delta') return b.sku ? [{ sku: b.sku, delta: Number(b.delta) }] : [];
  if (mode === 'set') {
    return b.sku
      ? [
          {
            sku: b.sku,
            quantity: Number(b.quantity),
            name: b.name,
            hidden: b.hidden,
          },
        ]
      : [];
  }
  return [];
}

export default async function handler(req, res) {
  // Allow PUT (delta), PATCH (set), POST (visibility), and DELETE (remove custom row)
  if (!['PUT', 'PATCH', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PUT,PATCH,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  if (
    !(await requirePermissionAsync(
      req,
      res,
      ADMIN_PERMISSIONS.INVENTORY_UPDATE
    ))
  ) {
    return;
  }

  // Require JSON
  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(400).json({ ok: false, error: 'Content-Type must be application/json' });
  }

  if (req.method === 'DELETE') {
    const sku = String(req.body?.sku || '').trim();
    if (!sku) {
      return res.status(400).json({ ok: false, error: 'No SKU provided' });
    }

    try {
      const deleted = await deleteInventorySku(sku);
      return res.status(200).json({ ok: true, deleted });
    } catch (err) {
      console.error('admin stock delete error:', err);
      return res.status(500).json({ ok: false, error: 'delete failed' });
    }
  }

  if (req.method === 'POST') {
    const action = String(req.body?.action || '').trim();
    const sku = String(req.body?.sku || '').trim();
    if (action !== 'visibility' || !sku) {
      return res.status(400).json({ ok: false, error: 'Invalid action' });
    }

    try {
      const updated = await setInventoryHidden(sku, !!req.body?.hidden);
      return res.status(200).json({ ok: true, updated });
    } catch (err) {
      console.error('admin stock visibility error:', err);
      return res.status(500).json({ ok: false, error: 'visibility update failed' });
    }
  }

  const mode = req.method === 'PUT' ? 'delta' : 'set';
  const items = normalizeBody(req, mode).filter(Boolean);

  if (!items.length) {
    return res.status(400).json({ ok: false, error: 'No items provided' });
  }

  try {
    const updated = [];

    if (mode === 'delta') {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const delta = Number(it.delta);
        if (!sku || !Number.isFinite(delta)) continue;
        updated.push(await applyInventoryDelta(sku, delta));
      }
    } else {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const q = Number(it.quantity);
        if (!sku || !Number.isFinite(q)) continue;
        const name = String(it.name || '').trim();
        const options = { name };
        if (typeof it.hidden === 'boolean') {
          options.hidden = it.hidden;
        }
        updated.push(await setInventoryQuantity(sku, q, options));
      }
    }

    return res.status(200).json({ ok: true, updated });
  } catch (err) {
    console.error('admin stock update error:', err);
    return res.status(500).json({ ok: false, error: 'update failed' });
  }
}
