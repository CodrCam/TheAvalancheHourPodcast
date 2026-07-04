import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { listInventory } from '../../../../lib/inventoryStore';

export const config = {
  api: { bodyParser: true },
};

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (!(await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.INVENTORY_READ))) {
    return;
  }

  try {
    const inventory = await listInventory();
    return res.status(200).json({
      inventory,
    });
  } catch (err) {
    console.error('admin stock GET error:', err);
    return res.status(500).json({ error: 'Failed to load inventory' });
  }
}
