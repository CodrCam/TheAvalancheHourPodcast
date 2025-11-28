// pages/api/store/cart-validate.js
import { validateItemsWithInventory } from '../../../lib/cartValidation';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!req.headers['content-type']?.includes('application/json')) {
    return res.status(400).json({ error: 'Content-Type must be application/json' });
  }

  const items = Array.isArray(req.body?.items) ? req.body.items : [];
  if (!items.length) {
    return res.status(200).json({ ok: true, problems: [] });
  }

  try {
    const result = await validateItemsWithInventory(items);
    // result = { ok, problems }
    return res.status(200).json(result);
  } catch (err) {
    console.error('cart-validate error', err);
    return res.status(500).json({ error: 'Inventory lookup failed' });
  }
}
