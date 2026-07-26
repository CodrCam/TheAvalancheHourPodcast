import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getCatalogProductById,
  listCatalogProducts,
  saveCatalogProduct,
} from '../../../../lib/productCatalogStore';
import {
  normalizeCatalogProductInput,
} from '../../../../lib/productCatalogAdmin.mjs';
import {
  buildCatalogInventoryTransactItems,
  getInventoryForSkus,
} from '../../../../lib/inventoryStore';
import { isProductImageStorageConfigured } from '../../../../lib/productImageStorage';

export const config = { api: { bodyParser: { sizeLimit: '2mb' } } };

function mergeInventory(product, inventoryBySku) {
  return {
    ...product,
    skuEntries: (product.skuEntries || []).map((entry) => {
      const inventory = inventoryBySku.get(entry.sku);
      return {
        ...entry,
        quantity: inventory?.quantity || 0,
        hidden: inventory?.hidden === true,
        inventoryUpdatedAt: inventory?.updated_at || null,
      };
    }),
  };
}

async function loadProductsWithInventory() {
  const products = await listCatalogProducts({ includeBackendOnly: true });
  const skus = products.flatMap((product) =>
    (product.skuEntries || []).map((entry) => entry.sku)
  );
  const inventory = await getInventoryForSkus(skus);
  const inventoryBySku = new Map(inventory.map((row) => [row.sku, row]));
  return products.map((product) => mergeInventory(product, inventoryBySku));
}

export default async function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.PRODUCTS_READ
      : ADMIN_PERMISSIONS.PRODUCTS_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    if (req.method === 'GET') {
      return res.status(200).json({
        ok: true,
        products: await loadProductsWithInventory(),
        canUpdate: principal.permissions.includes(
          ADMIN_PERMISSIONS.PRODUCTS_UPDATE
        ),
        canPublish: principal.permissions.includes(
          ADMIN_PERMISSIONS.PRODUCTS_PUBLISH
        ),
        canUpdateMedia: principal.permissions.includes(
          ADMIN_PERMISSIONS.PRODUCT_MEDIA_UPDATE
        ),
        mediaStorageConfigured: isProductImageStorageConfigured(),
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const rawProduct = req.body?.product || {};
    const requestedId = String(rawProduct.id || '').trim();
    const previous = requestedId
      ? await getCatalogProductById(requestedId)
      : null;
    const product = normalizeCatalogProductInput(rawProduct, { existing: previous });

    if (
      product.status === 'live' &&
      !principal.permissions.includes(ADMIN_PERMISSIONS.PRODUCTS_PUBLISH)
    ) {
      return res.status(403).json({
        ok: false,
        error: 'You can save drafts, but do not have permission to publish.',
      });
    }

    const inventorySkus = [
      ...(product.skuEntries || []).map((entry) => entry.sku),
      ...(previous?.skuEntries || []).map((entry) => entry.sku),
    ];
    const inventoryBeforeSave = await getInventoryForSkus(inventorySkus);
    const inventoryTransactItems = buildCatalogInventoryTransactItems(
      product,
      previous,
      inventoryBeforeSave
    );
    const saved = await saveCatalogProduct(product, {
      createOnly: req.body?.create === true,
      requireExisting: req.body?.create === false,
      expectedVersion: rawProduct.version,
      additionalTransactItems: inventoryTransactItems,
    });
    const inventory = await getInventoryForSkus(
      saved.skuEntries.map((entry) => entry.sku)
    );
    const inventoryBySku = new Map(inventory.map((row) => [row.sku, row]));
    const result = mergeInventory(saved, inventoryBySku);

    logAdminAction(req, principal, 'product.save', {
      product_id: saved.id,
      slug: saved.slug,
      status: saved.status,
      sku_count: saved.skuEntries.length,
      media_count: saved.media.length,
      created: !previous,
      inventory_synced: true,
    });
    return res.status(previous ? 200 : 201).json({
      ok: true,
      product: result,
      warning: null,
    });
  } catch (err) {
    console.error('admin products error:', err);
    const isConflict = /conditional|already exists|changed/i.test(
      String(err.message || '')
    );
    const isValidation = /required|add |price|sku|image|url slug|too many/i.test(
      String(err.message || '')
    );
    return res.status(isConflict ? 409 : isValidation ? 400 : 500).json({
      ok: false,
      error: isConflict
        ? 'This product or one of its stock rows changed in another session. Refresh before saving again.'
        : err.message || 'Failed to save product.',
    });
  }
}
