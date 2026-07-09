// pages/api/store/admin/orders.js
import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import {
  listOrders,
  deleteOrder,
  updateFulfillmentStatus,
} from '../../../../lib/orderStore';

export default async function handler(req, res) {
  // Allow GET (list orders), PATCH (update fulfillment_status), and DELETE.
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', ['GET', 'PATCH', 'DELETE']);
    return res.status(405).json({ error: `Method ${req.method} not allowed` });
  }

  if (req.method === 'GET') {
    if (!(await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.ORDERS_READ))) {
      return;
    }
    return handleGet(req, res);
  }

  if (req.method === 'PATCH') {
    if (
      !(await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.ORDERS_UPDATE))
    ) {
      return;
    }
    return handlePatch(req, res);
  }

  if (req.method === 'DELETE') {
    if (
      !(await requirePermissionAsync(req, res, ADMIN_PERMISSIONS.USERS_MANAGE))
    ) {
      return;
    }
    return handleDelete(req, res);
  }
}

async function handleGet(_req, res) {
  try {
    const orders = await listOrders({ limit: 200, sort: 'desc' });
    return res.status(200).json({ orders });
  } catch (err) {
    console.error('admin orders fetch error:', err);
    return res.status(500).json({ error: 'Failed to fetch orders' });
  }
}

async function handlePatch(req, res) {
  try {
    const { order_id, fulfillment_status } = req.body || {};

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const allowed = ['new', 'processing', 'shipped'];
    const statusNorm =
      typeof fulfillment_status === 'string'
        ? fulfillment_status.toLowerCase()
        : '';

    if (!allowed.includes(statusNorm)) {
      return res.status(400).json({
        error: `Invalid fulfillment_status. Expected one of: ${allowed.join(
          ', '
        )}`,
      });
    }

    const order = await updateFulfillmentStatus(order_id, statusNorm);
    return res.status(200).json({ order });
  } catch (err) {
    if (err.code === 'ORDER_NOT_FOUND' || String(err.message).includes('conditional')) {
      return res.status(404).json({ error: 'Order not found' });
    }
    console.error('admin orders patch error:', err);
    return res.status(500).json({ error: 'Failed to update fulfillment status' });
  }
}

async function handleDelete(req, res) {
  try {
    const { order_id } = req.body || {};

    if (!order_id || typeof order_id !== 'string') {
      return res.status(400).json({ error: 'order_id is required' });
    }

    const order = await deleteOrder(order_id);
    return res.status(200).json({ order });
  } catch (err) {
    if (err.code === 'ORDER_NOT_FOUND' || String(err.message).includes('conditional')) {
      return res.status(404).json({ error: 'Order not found' });
    }
    console.error('admin orders delete error:', err);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
}
