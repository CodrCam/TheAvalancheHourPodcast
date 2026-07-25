import { listEpisodeStudios } from './episodeStudioStore';
import { listInventory } from './inventoryStore';
import { listOrders } from './orderStore';
import { getHomeContent } from './siteContentStore';

function check(id, label, ok, status, detail, tone = ok ? 'good' : 'bad') {
  return { id, label, ok, status, detail, tone };
}

function latestDate(values = []) {
  const dates = values
    .filter(Boolean)
    .map((value) => new Date(value))
    .filter((date) => !Number.isNaN(date.getTime()))
    .sort((a, b) => b.getTime() - a.getTime());
  return dates[0]?.toISOString() || '';
}

export async function getAdminSystemHealth() {
  const [ordersResult, inventoryResult, contentResult, episodesResult] =
    await Promise.allSettled([
      listOrders({ limit: 1000, sort: 'desc' }),
      listInventory(),
      getHomeContent({ allowDefault: true }),
      listEpisodeStudios(),
    ]);

  const ordersOk = ordersResult.status === 'fulfilled';
  const inventoryOk = inventoryResult.status === 'fulfilled';
  const contentOk =
    contentResult.status === 'fulfilled' &&
    contentResult.value.configured === true &&
    contentResult.value.source === 'dynamo';
  const episodesOk =
    episodesResult.status === 'fulfilled' &&
    episodesResult.value.configured === true;
  const emailOk = Boolean(process.env.EMAIL_USER && process.env.EMAIL_PASS);
  const orders = ordersOk ? ordersResult.value : [];
  const inventory = inventoryOk ? inventoryResult.value : [];
  const episodes = episodesOk ? episodesResult.value.episodes : [];
  const lastOrder = orders[0] || null;
  const lastInventoryUpdate = latestDate(
    inventory.map((row) => row.updated_at)
  );

  const checks = [
    check(
      'inventory',
      'Inventory database',
      inventoryOk,
      inventoryOk ? 'Connected' : 'Issue',
      inventoryOk
        ? `${inventory.length} inventory rows loaded.`
        : 'Could not read inventory from DynamoDB.'
    ),
    check(
      'orders',
      'Orders database',
      ordersOk,
      ordersOk ? 'Connected' : 'Issue',
      ordersOk
        ? `${orders.length} orders loaded.`
        : 'Could not read orders from DynamoDB.'
    ),
    check(
      'site_content',
      'Website content',
      contentOk,
      contentOk ? 'Managed' : 'Using defaults',
      contentOk
        ? 'Homepage content is loading from DynamoDB.'
        : 'Homepage content is using its safe static fallback.',
      contentOk ? 'good' : 'warn'
    ),
    check(
      'episode_studios',
      'Episode Studio calendar',
      episodesOk,
      episodesOk ? 'Connected' : 'Issue',
      episodesOk
        ? `${episodes.length} Episode Studios loaded.`
        : 'Could not read Episode Studios from the site-content table.'
    ),
    check(
      'email',
      'Email notifications',
      emailOk,
      emailOk ? 'Configured' : 'Needs setup',
      emailOk
        ? 'Order and producer-handoff emails can be sent.'
        : 'EMAIL_USER or EMAIL_PASS is missing.',
      emailOk ? 'good' : 'warn'
    ),
    check(
      'last_order',
      'Last order recorded',
      true,
      lastOrder?.created_at || 'No orders yet',
      lastOrder
        ? lastOrder.customer_name ||
            lastOrder.customer_email ||
            'Customer order'
        : 'No orders were found.',
      lastOrder ? 'good' : 'neutral'
    ),
    check(
      'last_inventory_update',
      'Last inventory update',
      true,
      lastInventoryUpdate || 'No timestamp',
      lastInventoryUpdate
        ? 'Inventory includes update timestamps.'
        : 'No inventory update timestamp was found.',
      lastInventoryUpdate ? 'good' : 'neutral'
    ),
  ];

  const hasFailure = checks.some((item) => item.tone === 'bad');
  const hasWarning = checks.some((item) => item.tone === 'warn');

  return {
    generated_at: new Date().toISOString(),
    overall: hasFailure
      ? 'Issue detected'
      : hasWarning
        ? 'Needs attention'
        : 'Operational',
    tone: hasFailure ? 'bad' : hasWarning ? 'warn' : 'good',
    checks,
  };
}
