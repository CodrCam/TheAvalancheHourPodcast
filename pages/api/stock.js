import {
  getInventoryForSkus,
  listInventory,
} from '../../lib/inventoryStore';

export default async function handler(req, res) {
  // Only GET is allowed for this public route
  if (req.method !== 'GET') {
    res.setHeader('Allow', ['GET']);
    return res.status(405).json({ error: `Method ${req.method} Not Allowed` });
  }

  // Parse optional ?sku=a,b,c
  const list = (req.query.sku || '')
    .split(',')
    .map(s => s.trim())
    .filter(Boolean);

  try {
    const rows = list.length
      ? await getInventoryForSkus(list)
      : await listInventory();

    return res.status(200).json({ ok: true, data: rows });
  } catch (err) {
    // If the table doesn't exist yet, tell us plainly.
    if (String(err.message).includes('relation "inventory" does not exist')) {
      return res.status(200).json({
        ok: false,
        needs_setup: true,
        error: 'inventory table not found',
      });
    }
    console.error(err);
    return res.status(500).json({ ok: false, error: err.message });
  }
}
