import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  applyInventoryDelta,
  deleteInventorySku,
  setInventoryHidden,
  setInventoryQuantity,
} from '../../../../lib/inventoryStore';
import {
  getProductSkuEntries,
  getSkuCatalog,
} from '../../../../lib/productCatalog';
import {
  isDynamoProductCatalogConfigured,
  listCatalogProducts,
} from '../../../../lib/productCatalogStore';

export const config = { api: { bodyParser: true } };
async function getManagedCatalogSkuMap() {
  if (!isDynamoProductCatalogConfigured()) return getSkuCatalog();
  const products = await listCatalogProducts({ includeBackendOnly: true });
  return new Map(
    products.flatMap((product) =>
      getProductSkuEntries(product).map((entry) => [entry.sku, entry])
    )
  );
}

function normalizeBody(req, mode) {
  // mode: 'delta' for PUT, 'set' for PATCH
  const b = req.body || {};
  if (Array.isArray(b.items)) return b.items;
  if (mode === 'delta') return b.sku ? [{ sku: b.sku, delta: Number(b.delta) }] : [];
  if (mode === 'set') {
    if (!b.sku) return [];
    return [
      {
        sku: b.sku,
        quantity: Number(b.quantity),
        name: b.name,
        hidden: b.hidden,
        create: b.create,
        ...(Object.prototype.hasOwnProperty.call(b, 'expected_updated_at')
          ? { expected_updated_at: b.expected_updated_at }
          : {}),
      },
    ];
  }
  return [];
}

export default async function handler(req, res) {
  // Allow PUT (delta), PATCH (set), POST (visibility), and DELETE (remove custom row)
  if (!['PUT', 'PATCH', 'POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'PUT,PATCH,POST,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const principal = await requirePermissionAsync(
    req,
    res,
    ADMIN_PERMISSIONS.INVENTORY_UPDATE
  );
  if (!principal) {
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
      const catalogSkuMap = await getManagedCatalogSkuMap();
      if (catalogSkuMap.has(sku)) {
        return res.status(400).json({
          ok: false,
          error:
            'Catalog SKUs cannot be removed. Move the item to standby instead.',
        });
      }
      const deleteOptions = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'expected_updated_at'
      )
        ? { expectedUpdatedAt: req.body.expected_updated_at }
        : {};
      const deleted = await deleteInventorySku(sku, deleteOptions);
      logAdminAction(req, principal, 'inventory.delete', { sku });
      return res.status(200).json({ ok: true, deleted });
    } catch (err) {
      console.error('admin stock delete error:', err);
      const isConflict = /conditional/i.test(String(err.message || ''));
      return res.status(isConflict ? 409 : 500).json({
        ok: false,
        error: isConflict
          ? 'This inventory row changed. Refresh before removing it.'
          : 'Delete failed',
      });
    }
  }

  if (req.method === 'POST') {
    const action = String(req.body?.action || '').trim();
    const sku = String(req.body?.sku || '').trim();
    if (action !== 'visibility' || !sku) {
      return res.status(400).json({ ok: false, error: 'Invalid action' });
    }

    try {
      const visibilityOptions = Object.prototype.hasOwnProperty.call(
        req.body || {},
        'expected_updated_at'
      )
        ? { expectedUpdatedAt: req.body.expected_updated_at }
        : {};
      const updated = await setInventoryHidden(
        sku,
        !!req.body?.hidden,
        visibilityOptions
      );
      logAdminAction(req, principal, 'inventory.visibility', {
        sku,
        hidden: updated.hidden,
      });
      return res.status(200).json({ ok: true, updated });
    } catch (err) {
      console.error('admin stock visibility error:', err);
      const isConflict = /conditional/i.test(String(err.message || ''));
      return res.status(isConflict ? 409 : 500).json({
        ok: false,
        error: isConflict
          ? 'This inventory row changed. Refresh before updating availability.'
          : 'Visibility update failed',
      });
    }
  }

  const mode = req.method === 'PUT' ? 'delta' : 'set';
  const items = normalizeBody(req, mode).filter(Boolean);

  if (!items.length) {
    return res.status(400).json({ ok: false, error: 'No items provided' });
  }
  if (items.length > 1) {
    return res.status(400).json({
      ok: false,
      error:
        'Update one inventory row per request so each change can be confirmed safely.',
    });
  }

  for (const item of items) {
    const sku = String(item?.sku || '').trim();
    if (!sku) {
      return res.status(400).json({ ok: false, error: 'SKU is required' });
    }

    if (mode === 'delta') {
      if (!Number.isInteger(Number(item.delta))) {
        return res
          .status(400)
          .json({ ok: false, error: 'Inventory delta must be a whole number' });
      }
      continue;
    }

    const quantity = Number(item.quantity);
    if (!Number.isInteger(quantity) || quantity < 0) {
      return res.status(400).json({
        ok: false,
        error: 'Inventory quantity must be a non-negative whole number',
      });
    }
    if (item.create === true && !String(item.name || '').trim()) {
      return res.status(400).json({
        ok: false,
        error: 'A product name is required to start tracking this SKU',
      });
    }
  }

  try {
    const newItems = items.filter((item) => item.create === true);
    if (newItems.length) {
      const catalogSkuMap = await getManagedCatalogSkuMap();
      const detachedItem = newItems.find(
        (item) => !catalogSkuMap.has(String(item.sku || '').trim())
      );
      if (detachedItem) {
        return res.status(400).json({
          ok: false,
          error:
            'Create the product and its variant first, then start tracking its stock.',
        });
      }
    }

    const updated = [];

    if (mode === 'delta') {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const delta = Number(it.delta);
        updated.push(await applyInventoryDelta(sku, delta));
      }
    } else {
      for (const it of items) {
        const sku = String(it.sku || '').trim();
        const q = Number(it.quantity);
        const name = String(it.name || '').trim();
        const options = {
          name,
          createOnly: it.create === true,
          ...(Object.prototype.hasOwnProperty.call(it, 'expected_updated_at')
            ? { expectedUpdatedAt: it.expected_updated_at }
            : {}),
        };
        if (typeof it.hidden === 'boolean') {
          options.hidden = it.hidden;
        }
        updated.push(await setInventoryQuantity(sku, q, options));
      }
    }

    logAdminAction(req, principal, 'inventory.quantity', {
      mode,
      item_count: updated.length,
      skus: updated.map((row) => row.sku),
    });
    return res.status(200).json({ ok: true, updated });
  } catch (err) {
    console.error('admin stock update error:', err);
    const isConflict = /conditional/i.test(String(err.message || ''));
    return res.status(isConflict ? 409 : 500).json({
      ok: false,
      error: isConflict
        ? 'This inventory row changed. Refresh before saving your quantity.'
        : 'Update failed',
    });
  }
}
