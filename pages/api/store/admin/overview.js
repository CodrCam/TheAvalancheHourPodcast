import {
  ADMIN_PERMISSIONS,
  getAdminPrincipalAsync,
} from '../../../../lib/adminAuth';
import { listInventory } from '../../../../lib/inventoryStore';
import { listOrders } from '../../../../lib/orderStore';
import { getAllCatalogSkuEntries, getSkuCatalog } from '../../../../lib/productCatalog';
import { listEpisodeStudios } from '../../../../lib/episodeStudioStore';
import { getEpisodeCompletion } from '../../../../lib/episodeStudioPresentation.mjs';
import { listPeople } from '../../../../lib/peopleStore';

const LOW_STOCK_THRESHOLD = 2;

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
    !principal.permissions.includes(ADMIN_PERMISSIONS.ORDERS_READ) ||
    !principal.permissions.includes(ADMIN_PERMISSIONS.INVENTORY_READ)
  ) {
    return res.status(403).json({ error: 'Forbidden' });
  }

  const canManageEpisodes = principal.permissions.includes(
    ADMIN_PERMISSIONS.EPISODES_MANAGE
  );
  const [
    ordersResult,
    inventoryResult,
    episodeStudiosResult,
    peopleResult,
  ] = await Promise.allSettled([
    listOrders({ limit: 1000, sort: 'desc' }),
    listInventory(),
    canManageEpisodes
      ? listEpisodeStudios()
      : Promise.resolve({ episodes: [], configured: false }),
    canManageEpisodes
      ? listPeople({ allowStaticFallback: true, includeInactive: true })
      : Promise.resolve({ people: [] }),
  ]);

  const ordersOk = ordersResult.status === 'fulfilled';
  const inventoryOk = inventoryResult.status === 'fulfilled';
  const episodeStudios =
    episodeStudiosResult.status === 'fulfilled'
      ? episodeStudiosResult.value.episodes
      : [];
  const people =
    peopleResult.status === 'fulfilled' ? peopleResult.value.people : [];
  const peopleById = new Map(
    people.map((person) => [person.person_id, person.name])
  );
  const orders = ordersOk ? ordersResult.value.map(cleanOrder) : [];
  const inventory = inventoryOk
    ? inventoryResult.value.map(normalizeInventoryRow)
    : [];
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
      capabilities: {
        can_manage_episodes: canManageEpisodes,
      },
      episode_studios: canManageEpisodes
        ? {
            scheduled: episodeStudios.length,
            producer_queue: episodeStudios.filter((episode) =>
              ['submitted', 'submitted_with_gaps'].includes(episode.status)
            ).length,
            off_track: episodeStudios.filter(
              (episode) =>
                episode.status !== 'accepted' &&
                episode.delivery_health === 'off_track'
            ).length,
            upcoming: episodeStudios
              .filter((episode) => episode.status !== 'accepted')
              .sort(
                (a, b) =>
                  Number(b.delivery_health === 'off_track') -
                    Number(a.delivery_health === 'off_track') ||
                  String(a.target_release_date || '9999').localeCompare(
                    String(b.target_release_date || '9999')
                  )
              )
              .slice(0, 6)
              .map((episode) => ({
                episode_id: episode.episode_id,
                title: episode.title,
                target_release_date: episode.target_release_date,
                due_date: episode.due_date,
                status: episode.status,
                delivery_health: episode.delivery_health,
                delivery_health_updated_at:
                  episode.delivery_health_updated_at,
                delivery_health_updated_by_name:
                  episode.delivery_health_updated_by_name,
                host_names: episode.host_person_ids.map(
                  (personId) => peopleById.get(personId) || personId
                ),
                completion: getEpisodeCompletion(episode),
              })),
          }
        : null,
    });
  } catch (err) {
    console.error('admin overview error:', err);
    return res.status(500).json({ error: 'Failed to load admin overview' });
  }
}
