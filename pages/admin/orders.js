// pages/admin/orders.js
import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';

const STATUS_LABELS = {
  new: 'New',
  processing: 'Processing',
  shipped: 'Shipped',
};

function formatMoney(cents) {
  if (typeof cents !== 'number') return '—';
  return `$${(cents / 100).toFixed(2)}`;
}

// Build a human-readable item label including variant options
function formatItemLabel(it) {
  if (!it || typeof it !== 'object') return 'Item';

  const qty = it.qty || it.quantity || 1;
  const name = it.name || it.sku || it.id || 'Item';

  const opt = it.options || {};
  const parts = [];
  if (opt.style) parts.push(opt.style);
  if (opt.size) parts.push(opt.size);
  if (opt.color) parts.push(opt.color);

  const variant =
    parts.length > 0 ? ` (${parts.join(' / ')})` : '';

  return `${qty}× ${name}${variant}`;
}

function OrdersSearch({
  searchTerm,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexWrap: 'wrap',
        gap: '8px',
        marginBottom: '12px',
        alignItems: 'center',
      }}
    >
      <input
        type="text"
        placeholder="Search by order, name, email, city…"
        value={searchTerm}
        onChange={(e) => onSearchChange(e.target.value)}
        style={{
          minWidth: '220px',
          padding: '6px 8px',
          borderRadius: 4,
          border: '1px solid #ccc',
        }}
      />
      <select
        value={statusFilter}
        onChange={(e) => onStatusFilterChange(e.target.value)}
        style={{
          padding: '6px 8px',
          borderRadius: 4,
          border: '1px solid #ccc',
        }}
      >
        <option value="all">All fulfillment statuses</option>
        <option value="new">New</option>
        <option value="processing">Processing</option>
        <option value="shipped">Shipped</option>
      </select>
      <a
        href="/api/store/admin/orders-export"
        style={{
          marginLeft: 'auto',
          textDecoration: 'none',
          padding: '6px 10px',
          borderRadius: 4,
          border: '1px solid #ccc',
          background: '#f8f8f8',
          fontSize: 13,
        }}
      >
        Download CSV
      </a>
    </div>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/orders');
      const data = await res.json();
      const list = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list);
    } catch (err) {
      console.error(err);
      setMessage('Failed to load orders.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  async function updateStatus(orderId, status) {
    setUpdatingId(orderId);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/orders', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order_id: orderId, fulfillment_status: status }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to update status');
      }
      setOrders((prev) =>
        prev.map((o) =>
          o.order_id === orderId ? { ...o, fulfillment_status: status } : o
        )
      );
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to update status.');
    } finally {
      setUpdatingId(null);
    }
  }

  const filteredOrders = useMemo(() => {
    const query = (searchTerm || '').toLowerCase().trim();

    return orders.filter((o) => {
      if (statusFilter !== 'all') {
        const fs = (o.fulfillment_status || 'new').toLowerCase();
        if (fs !== statusFilter) return false;
      }

      if (!query) return true;

      const haystack = [
        o.order_id,
        o.customer_email,
        o.customer_name,
        o.shipping_name,
        o.shipping_city,
        o.shipping_state,
        o.shipping_postal_code,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [orders, searchTerm, statusFilter]);

  return (
    <AdminLayout>
      <h1>Orders</h1>

      {message && <p>{message}</p>}

      <OrdersSearch
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        statusFilter={statusFilter}
        onStatusFilterChange={setStatusFilter}
      />

      {loading ? (
        <p>Loading…</p>
      ) : filteredOrders.length === 0 ? (
        <p>No orders found.</p>
      ) : (
        <>
          <p style={{ fontSize: 13, color: '#555', marginBottom: 8 }}>
            Showing {filteredOrders.length} of {orders.length} orders
          </p>
          <table
            style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}
          >
            <thead>
              <tr>
                <th style={th}>Created</th>
                <th style={th}>Order</th>
                <th style={th}>Payment</th>
                <th style={th}>Fulfillment</th>
                <th style={th}>Total</th>
                <th style={th}>Customer</th>
                <th style={th}>Ship To</th>
                <th style={th}>Contact</th>
                <th style={th}>Items</th>
              </tr>
            </thead>
            <tbody>
              {filteredOrders.map((o) => (
                <tr key={o.order_id}>
                  <td style={td}>
                    {o.created_at
                      ? new Date(o.created_at).toLocaleString()
                      : '—'}
                  </td>
                  <td style={td}>
                    <div>{o.order_id}</div>
                  </td>
                  <td style={td}>
                    <span>{o.status || '—'}</span>
                  </td>
                  <td style={td}>
                    <select
                      value={o.fulfillment_status || 'new'}
                      onChange={(e) => updateStatus(o.order_id, e.target.value)}
                      disabled={updatingId === o.order_id}
                    >
                      {Object.entries(STATUS_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td style={td}>{formatMoney(o.amount_cents)}</td>
                  <td style={td}>{o.customer_name || '—'}</td>
                  <td style={td}>
                    {o.shipping_name && <div>{o.shipping_name}</div>}
                    {o.shipping_address1 && <div>{o.shipping_address1}</div>}
                    {o.shipping_address2 && <div>{o.shipping_address2}</div>}
                    {(o.shipping_city ||
                      o.shipping_state ||
                      o.shipping_postal_code) && (
                      <div>
                        {[o.shipping_city, o.shipping_state, o.shipping_postal_code]
                          .filter(Boolean)
                          .join(', ')}
                      </div>
                    )}
                    {o.shipping_country && <div>{o.shipping_country}</div>}
                  </td>
                  <td style={td}>{o.customer_email || '—'}</td>
                  <td style={td}>
                    {Array.isArray(o.items)
                      ? o.items.map((it) => formatItemLabel(it)).join(', ')
                      : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </AdminLayout>
  );
}

const th = {
  textAlign: 'left',
  padding: '6px 4px',
  borderBottom: '1px solid #ddd',
};

const td = {
  padding: '6px 4px',
  borderBottom: '1px solid #f3f3f3',
  verticalAlign: 'top',
};