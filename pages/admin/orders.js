// pages/admin/orders.js
import { useEffect, useState, useMemo } from 'react';
import AdminLayout from '../../components/AdminLayout';

const STATUS_LABELS = {
  new: 'New',
  processing: 'Processing',
  shipped: 'Shipped',
};

const card = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  padding: 16,
};

const summaryGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))',
  gap: 12,
  margin: '16px 0',
};

const muted = {
  color: '#64748b',
  fontSize: 13,
};

const fieldLabel = {
  color: '#64748b',
  fontSize: 11,
  fontWeight: 800,
  letterSpacing: 0.8,
  textTransform: 'uppercase',
};

function formatMoney(cents) {
  const amount = Number(cents);
  if (!Number.isFinite(amount)) return '—';
  return (amount / 100).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD',
  });
}

function formatDateTime(value) {
  if (!value) return '—';

  try {
    return new Date(value).toLocaleString();
  } catch {
    return '—';
  }
}

function getStatusTone(status) {
  const normalized = String(status || '').toLowerCase();
  if (
    normalized === 'shipped' ||
    normalized === 'paid' ||
    normalized === 'succeeded'
  ) {
    return 'good';
  }
  if (normalized === 'new' || normalized === 'requires_attention') return 'warn';
  return 'neutral';
}

function getOrderCustomer(order = {}) {
  return (
    order.customer_name ||
    order.shipping_name ||
    order.customer_email ||
    'Customer'
  );
}

function getShippingLines(order = {}) {
  const cityLine = [
    order.shipping_city,
    order.shipping_state,
    order.shipping_postal_code,
  ]
    .filter(Boolean)
    .join(', ');

  return [
    order.shipping_name,
    order.shipping_address1,
    order.shipping_address2,
    cityLine,
    order.shipping_country,
  ].filter(Boolean);
}

function getItemDetails(it) {
  if (!it || typeof it !== 'object') {
    return {
      qty: 1,
      name: 'Item',
      variant: '',
      sku: '',
    };
  }

  const qty = it.qty || it.quantity || 1;
  const name = it.name || it.product_name || it.sku || it.id || 'Item';

  const opt = it.options || {};
  const parts = [];
  if (opt.style) parts.push(opt.style);
  if (opt.size) parts.push(opt.size);
  if (opt.color) parts.push(opt.color);

  return {
    qty,
    name,
    variant: parts.join(' / '),
    sku: it.sku || it.id || '',
  };
}

function formatItemSearchLabel(it) {
  const item = getItemDetails(it);
  return [item.qty, item.name, item.variant, item.sku].filter(Boolean).join(' ');
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
    </div>
  );
}

function StatusPill({ children, tone = 'neutral' }) {
  const colors = {
    good: ['#dcfce7', '#166534'],
    warn: ['#fef3c7', '#92400e'],
    neutral: ['#f1f5f9', '#334155'],
  };
  const [background, color] = colors[tone] || colors.neutral;
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background,
        color,
        padding: '3px 9px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

function SummaryCard({ label, value, detail, tone }) {
  return (
    <div style={card}>
      <div style={{ ...muted, marginBottom: 6 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: '#1e293b' }}>
        {value}
      </div>
      {detail ? (
        <div style={{ marginTop: 8 }}>
          <StatusPill tone={tone}>{detail}</StatusPill>
        </div>
      ) : null}
    </div>
  );
}

function OrderItems({ items }) {
  if (!Array.isArray(items) || items.length === 0) {
    return <p style={{ ...muted, margin: '8px 0 0' }}>No items listed.</p>;
  }

  return (
    <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
      {items.map((rawItem, index) => {
        const item = getItemDetails(rawItem);
        return (
          <div
            key={`${item.sku || item.name}-${index}`}
            style={{
              display: 'grid',
              gridTemplateColumns: '48px minmax(0, 1fr)',
              gap: 10,
              alignItems: 'start',
              padding: '10px 0',
              borderTop: index === 0 ? 'none' : '1px solid #f1f5f9',
            }}
          >
            <div
              style={{
                borderRadius: 6,
                background: '#eff6ff',
                color: '#1d4ed8',
                fontWeight: 800,
                textAlign: 'center',
                padding: '6px 0',
              }}
            >
              {item.qty}x
            </div>
            <div>
              <div style={{ fontWeight: 800, color: '#1e293b' }}>
                {item.name}
              </div>
              {item.variant ? (
                <div style={{ color: '#475569', marginTop: 3 }}>
                  {item.variant}
                </div>
              ) : null}
              {item.sku ? (
                <div style={{ ...muted, marginTop: 3 }}>SKU: {item.sku}</div>
              ) : null}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ShippingAddress({ order }) {
  const lines = getShippingLines(order);

  if (!lines.length) {
    return <p style={{ ...muted, margin: '8px 0 0' }}>No shipping address.</p>;
  }

  return (
    <address
      style={{
        marginTop: 10,
        color: '#1e293b',
        fontStyle: 'normal',
        lineHeight: 1.55,
      }}
    >
      {lines.map((line) => (
        <div key={line}>{line}</div>
      ))}
    </address>
  );
}

function OrderCard({
  order,
  updatingId,
  deletingId,
  deleteArmedId,
  canDelete,
  onStatusChange,
  onArmDelete,
  onCancelDelete,
  onDelete,
}) {
  const fulfillmentStatus = order.fulfillment_status || 'new';
  const paymentStatus = order.status || '—';
  const deleteArmed = deleteArmedId === order.order_id;
  const isDeleting = deletingId === order.order_id;

  return (
    <article style={{ ...card, padding: 0, overflow: 'hidden' }}>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr) auto',
          gap: 14,
          padding: 16,
          borderBottom: '1px solid #f1f5f9',
        }}
      >
        <div>
          <div style={{ ...muted, marginBottom: 4 }}>{order.order_id}</div>
          <h2 style={{ margin: 0, fontSize: 20, color: '#1e293b' }}>
            {getOrderCustomer(order)}
          </h2>
          <div style={{ ...muted, marginTop: 6 }}>
            {formatDateTime(order.created_at)}
            {order.customer_email ? ` · ${order.customer_email}` : ''}
          </div>
        </div>
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-end',
            gap: 8,
          }}
        >
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            <StatusPill tone={getStatusTone(fulfillmentStatus)}>
              {STATUS_LABELS[fulfillmentStatus] || fulfillmentStatus}
            </StatusPill>
            <StatusPill tone={getStatusTone(paymentStatus)}>
              {paymentStatus}
            </StatusPill>
          </div>
          <strong style={{ fontSize: 18, color: '#1e293b' }}>
            {formatMoney(order.amount_cents)}
          </strong>
          {canDelete ? (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {deleteArmed ? (
                <>
                  <button
                    type="button"
                    onClick={() => onDelete(order.order_id)}
                    disabled={isDeleting}
                    style={{
                      border: '1px solid #dc2626',
                      borderRadius: 6,
                      background: '#dc2626',
                      color: '#fff',
                      cursor: isDeleting ? 'default' : 'pointer',
                      fontWeight: 800,
                      padding: '7px 10px',
                    }}
                  >
                    {isDeleting ? 'Deleting...' : 'Confirm delete'}
                  </button>
                  <button
                    type="button"
                    onClick={onCancelDelete}
                    disabled={isDeleting}
                    style={{
                      border: '1px solid #cbd5e1',
                      borderRadius: 6,
                      background: '#fff',
                      color: '#334155',
                      cursor: isDeleting ? 'default' : 'pointer',
                      fontWeight: 700,
                      padding: '7px 10px',
                    }}
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={() => onArmDelete(order.order_id)}
                  style={{
                    border: '1px solid #fecaca',
                    borderRadius: 6,
                    background: '#fff',
                    color: '#b91c1c',
                    cursor: 'pointer',
                    fontWeight: 700,
                    padding: '7px 10px',
                  }}
                >
                  Delete order
                </button>
              )}
            </div>
          ) : null}
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: 18,
          padding: 16,
        }}
      >
        <section>
          <div style={fieldLabel}>Items ordered</div>
          <OrderItems items={order.items} />
        </section>

        <section>
          <div style={fieldLabel}>Shipping address</div>
          <ShippingAddress order={order} />
          <div style={{ marginTop: 14 }}>
            <label style={{ ...fieldLabel, display: 'block', marginBottom: 6 }}>
              Fulfillment
            </label>
            <select
              value={fulfillmentStatus}
              onChange={(e) => onStatusChange(order.order_id, e.target.value)}
              disabled={updatingId === order.order_id}
              style={{
                width: '100%',
                maxWidth: 220,
                padding: '7px 8px',
                borderRadius: 6,
                border: '1px solid #cbd5e1',
                background: '#fff',
              }}
            >
              {Object.entries(STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </section>
      </div>
    </article>
  );
}

export default function AdminOrdersPage() {
  const [orders, setOrders] = useState([]);
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [updatingId, setUpdatingId] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [deleteArmedId, setDeleteArmedId] = useState(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const [ordersRes, sessionRes] = await Promise.all([
        fetch('/api/store/admin/orders', { credentials: 'same-origin' }),
        fetch('/api/store/admin/session', { credentials: 'same-origin' }),
      ]);
      const data = await ordersRes.json();
      if (!ordersRes.ok) {
        throw new Error(data.error || 'Failed to load orders');
      }
      const sessionData = await sessionRes.json().catch(() => ({}));
      const list = Array.isArray(data.orders) ? data.orders : [];
      setOrders(list);
      if (sessionRes.ok) setSession(sessionData.user || null);
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to load orders.');
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

  async function deleteOrderById(orderId) {
    setDeletingId(orderId);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/orders', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ order_id: orderId }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Failed to delete order');
      }
      setOrders((prev) => prev.filter((order) => order.order_id !== orderId));
      setDeleteArmedId(null);
      setMessage('Order deleted.');
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to delete order.');
    } finally {
      setDeletingId(null);
    }
  }

  const summary = useMemo(() => {
    const counts = {
      total: orders.length,
      new: 0,
      processing: 0,
      shipped: 0,
      unshipped: 0,
      revenueCents: 0,
    };

    orders.forEach((order) => {
      const status = (order.fulfillment_status || 'new').toLowerCase();
      if (status === 'new') counts.new += 1;
      if (status === 'processing') counts.processing += 1;
      if (status === 'shipped') counts.shipped += 1;
      if (status !== 'shipped') counts.unshipped += 1;
      counts.revenueCents += Number(order.amount_cents) || 0;
    });

    return counts;
  }, [orders]);

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
        o.shipping_address1,
        o.shipping_address2,
        o.shipping_city,
        o.shipping_state,
        o.shipping_postal_code,
        ...(Array.isArray(o.items) ? o.items.map(formatItemSearchLabel) : []),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [orders, searchTerm, statusFilter]);

  const canSeeRevenue =
    session?.role === 'admin' ||
    (Array.isArray(session?.permissions) &&
      session.permissions.includes('users:manage'));
  const canDeleteOrders = canSeeRevenue;

  return (
    <AdminLayout>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          justifyContent: 'space-between',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Orders</h1>
          <p style={{ ...muted, margin: 0 }}>
            Review fulfillment, update shipping status, and export the shipping
            sheet.
          </p>
        </div>
        <form action="/api/store/admin/orders-export" method="get">
          <button
            type="submit"
            style={{
              padding: '8px 12px',
              borderRadius: 6,
              border: '1px solid #cbd5e1',
              background: '#fff',
              color: '#1e293b',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            Download CSV
          </button>
        </form>
      </div>

      {message && <p>{message}</p>}

      <section style={summaryGrid}>
        <SummaryCard
          label="Unshipped Orders"
          value={summary.unshipped}
          detail={summary.unshipped ? 'Needs attention' : 'Clear'}
          tone={summary.unshipped ? 'warn' : 'good'}
        />
        <SummaryCard
          label="New"
          value={summary.new}
          detail="Not started"
          tone={summary.new ? 'warn' : 'good'}
        />
        <SummaryCard
          label="Processing"
          value={summary.processing}
          detail="Being packed"
          tone={summary.processing ? 'neutral' : 'good'}
        />
        <SummaryCard
          label="Shipped"
          value={summary.shipped}
          detail={`${summary.total} total`}
          tone="neutral"
        />
        {canSeeRevenue ? (
          <SummaryCard
            label="Historical Revenue"
            value={formatMoney(summary.revenueCents)}
            detail="Admin only"
            tone="neutral"
          />
        ) : null}
      </section>

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
          <div style={{ display: 'grid', gap: 14 }}>
            {filteredOrders.map((order) => (
              <OrderCard
                key={order.order_id}
                order={order}
                updatingId={updatingId}
                deletingId={deletingId}
                deleteArmedId={deleteArmedId}
                canDelete={canDeleteOrders}
                onStatusChange={updateStatus}
                onArmDelete={setDeleteArmedId}
                onCancelDelete={() => setDeleteArmedId(null)}
                onDelete={deleteOrderById}
              />
            ))}
          </div>
        </>
      )}
    </AdminLayout>
  );
}
