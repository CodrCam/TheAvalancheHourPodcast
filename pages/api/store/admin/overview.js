import {
  ADMIN_PERMISSIONS,
  getAdminPrincipalAsync,
  hasPermission,
} from '../../../../lib/adminAuth';
import { listInventory } from '../../../../lib/inventoryStore';
import { listOrders } from '../../../../lib/orderStore';
import { getAllCatalogSkuEntries, getSkuCatalog } from '../../../../lib/productCatalog';
import { getHomeContent } from '../../../../lib/siteContentStore';

const LOW_STOCK_THRESHOLD = 2;

function healthCheck(id, label, ok, status, detail, tone = ok ? 'good' : 'bad') {
  return {
    id,
    label,
    ok,
    status,
    detail,
    tone,
  };
}

function cleanOrder(order = {}) {
  return {
    order_id: order.order_id || '',
    created_at: order.created_at || '',
    fulfillment_status: order.fulfillment_status || 'new',
    status: order.status || '',
    amount_cents: Number(order.amount_cents) || 0,
    customer_name: order.customer_name || order.shipping_name || '',
    customer_email: order.customer_email || '',
    shipping_city: order.shipping_city || '',
    shipping_state: order.shipping_state || '',
    items: Array.isArray(order.items) ? order.items : [],
  };
}

function normalizeInventoryRow(row = {}) {
  const sku = String(row.sku || row.sku_key || '').trim();
  return {
    sku,
    name: String(row.name || row.product_name || '').trim(),
    hidden: row.hidden === true || row.hidden === 'true',
    quantity: Math.max(0, Number(row.quantity) || 0),
    updated_at: row.updated_at || '',
  };
}

function latestDate(values = []) {
  const sorted = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());

  return sorted[0]?.toISOString() || '';
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const principal = await getAdminPrincipalAsync(req);
  if (!principal) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  if (
    !hasPermission(principal.role, ADMIN_PERMISSIONS.ORDERS_READ) ||
    !hasPermission(principal.role, ADMIN_PERMISSIONS.INVENTORY_READ)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const [ordersResult, inventoryResult, siteContentResult] = await Promise.allSettled([
    listOrders({ limit: 1000, sort: 'desc' }),
    listInventory(),
    getHomeContent({ allowDefault: true }),
  ]);

  const ordersOk = ordersResult.status === 'fulfilled';
  const inventoryOk = inventoryResult.status === 'fulfilled';
  const siteContentOk =
    siteContentResult.status === 'fulfilled' &&
    siteContentResult.value.configured === true &&
    siteContentResult.value.source === 'dynamo';
  const orders = ordersOk ? ordersResult.value.map(cleanOrder) : [];
  const inventory = inventoryOk
    ? inventoryResult.value.map(normalizeInventoryRow)
    : [];
  const emailConfigured = !!(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const lastOrder = orders[0] || null;
  const lastInventoryUpdate = latestDate(inventory.map((row) => row.updated_at));

  const checks = [
    healthCheck(
      'inventory',
      'Inventory database',
      inventoryOk,
      inventoryOk ? 'Connected' : 'Issue',
      inventoryOk
        ? `${inventory.length} inventory rows loaded.`
        : 'Could not read inventory from DynamoDB.'
    ),
    healthCheck(
      'orders',
      'Orders database',
      ordersOk,
      ordersOk ? 'Connected' : 'Issue',
      ordersOk
        ? `${orders.length} orders loaded.`
        : 'Could not read orders from DynamoDB.'
    ),
    healthCheck(
      'email',
      'Order email notifications',
      emailConfigured,
      emailConfigured ? 'Configured' : 'Needs setup',
      emailConfigured
        ? 'New order emails can be sent.'
        : 'EMAIL_USER or EMAIL_PASS is missing.',
      emailConfigured ? 'good' : 'warn'
    ),
    healthCheck(
      'site_content',
      'Homepage content',
      siteContentOk,
      siteContentOk ? 'Managed' : 'Using defaults',
      siteContentOk
        ? 'Homepage CTA content is loading from DynamoDB.'
        : 'Homepage CTA is using static fallback content.',
      siteContentOk ? 'good' : 'warn'
    ),
    healthCheck(
      'last_order',
      'Last order recorded',
      true,
      lastOrder ? lastOrder.created_at : 'No orders yet',
      lastOrder
        ? lastOrder.customer_name || lastOrder.customer_email || 'Customer'
        : 'No orders were found in the orders table.',
      lastOrder ? 'good' : 'neutral'
    ),
    healthCheck(
      'last_inventory_update',
      'Last inventory update',
      true,
      lastInventoryUpdate || 'No timestamp',
      lastInventoryUpdate
        ? 'Inventory rows include recent update timestamps.'
        : 'No inventory update timestamps were found.',
      lastInventoryUpdate ? 'good' : 'neutral'
    ),
  ];
  const overallTone =
    !ordersOk || !inventoryOk
      ? 'bad'
      : emailConfigured && siteContentOk
        ? 'good'
        : 'warn';

  try {
    const catalogEntries = getAllCatalogSkuEntries();
    const catalogMap = getSkuCatalog();

    const inventoryBySku = new Map(inventory.map((row) => [row.sku, row]));
    const catalogRows = catalogEntries.map((entry) => {
      const row = inventoryBySku.get(entry.sku);
      return {
        sku: entry.sku,
        label: entry.label,
        productName: entry.productName,
        quantity: row ? row.quantity : 0,
        hidden: row ? row.hidden : false,
        updated_at: row?.updated_at || '',
      };
    });
    const unusedRows = inventory.filter((row) => !catalogMap.has(row.sku));

    const newOrders = orders.filter((order) => order.fulfillment_status === 'new');
    const processingOrders = orders.filter(
      (order) => order.fulfillment_status === 'processing'
    );
    const unshippedOrders = orders.filter(
      (order) => order.fulfillment_status !== 'shipped'
    );
    const lowStock = catalogRows
      .filter(
        (row) =>
          !row.hidden &&
          row.quantity > 0 &&
          row.quantity <= LOW_STOCK_THRESHOLD
      )
      .sort((a, b) => a.quantity - b.quantity || a.sku.localeCompare(b.sku));
    const soldOut = catalogRows
      .filter((row) => !row.hidden && row.quantity <= 0)
      .sort((a, b) => a.sku.localeCompare(b.sku));
    const standby = catalogRows
      .filter((row) => row.hidden)
      .sort((a, b) => a.sku.localeCompare(b.sku));

    return res.status(200).json({
      generated_at: new Date().toISOString(),
      orders: {
        new: newOrders.length,
        processing: processingOrders.length,
        unshipped: unshippedOrders.length,
        unshipped_recent: unshippedOrders.slice(0, 5),
      },
      inventory: {
        catalog_skus: catalogRows.length,
        unused_skus: unusedRows.length,
        low_stock: lowStock.length,
        sold_out: soldOut.length,
        standby: standby.length,
        low_stock_rows: lowStock.slice(0, 8),
        sold_out_rows: soldOut.slice(0, 8),
        standby_rows: standby.slice(0, 8),
      },
      operations: {
        csv_export_ready: unshippedOrders.length > 0,
        next_order_action_count: unshippedOrders.length,
        inventory_attention_count: lowStock.length + soldOut.length,
      },
      health: {
        overall:
          overallTone === 'good'
            ? 'Operational'
            : overallTone === 'warn'
              ? 'Needs attention'
              : 'Issue detected',
        tone: overallTone,
        checks,
      },
    });
  } catch (err) {
    console.error('admin overview error:', err);
    return res.status(500).json({ error: 'Failed to load admin overview' });
  }
}
