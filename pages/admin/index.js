import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

const card = {
  border: '1px solid #e5e7eb',
  borderRadius: 8,
  background: '#fff',
  padding: 16,
};

const sectionGrid = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
  gap: 16,
  marginTop: 18,
};

const muted = {
  color: '#64748b',
  fontSize: 13,
};

function formatDate(value) {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '-';
  }
}

function formatOrderCustomer(order) {
  return (
    order.customer_name ||
    order.customer_email ||
    [order.shipping_city, order.shipping_state].filter(Boolean).join(', ') ||
    'Customer'
  );
}

function StatusPill({ children, tone = 'neutral' }) {
  const colors = {
    good: ['#dcfce7', '#166534'],
    warn: ['#fef3c7', '#92400e'],
    bad: ['#fee2e2', '#991b1b'],
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

function EmptyLine({ children = 'Nothing needs attention.' }) {
  return <p style={{ ...muted, margin: '8px 0 0' }}>{children}</p>;
}

function ActionList({ rows, kind }) {
  if (!rows?.length) return <EmptyLine />;

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {rows.map((row) => (
        <div
          key={kind === 'order' ? row.order_id : row.sku}
          style={{
            borderTop: '1px solid #f1f5f9',
            paddingTop: 10,
            display: 'grid',
            gap: 3,
          }}
        >
          {kind === 'order' ? (
            <>
              <strong>{formatOrderCustomer(row)}</strong>
              <span style={muted}>{row.fulfillment_status}</span>
              <span style={muted}>{formatDate(row.created_at)}</span>
            </>
          ) : (
            <>
              <strong>{row.label || row.sku}</strong>
              <span style={muted}>
                {row.sku} · {row.quantity} available
              </span>
            </>
          )}
        </div>
      ))}
    </div>
  );
}

function AdminSectionCard({ href, title, description, meta }) {
  return (
    <Link
      href={href}
      style={{
        ...card,
        display: 'block',
        color: 'inherit',
        textDecoration: 'none',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <h2 style={{ margin: 0, fontSize: 18 }}>{title}</h2>
        {meta ? <StatusPill tone={meta.tone}>{meta.label}</StatusPill> : null}
      </div>
      <p style={{ ...muted, margin: '10px 0 0' }}>{description}</p>
    </Link>
  );
}

function HealthPanel({ health }) {
  const checks = Array.isArray(health?.checks) ? health.checks : [];

  return (
    <div style={card}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          gap: 12,
          alignItems: 'baseline',
        }}
      >
        <h2 style={{ margin: 0, fontSize: 18 }}>Store Health</h2>
        <StatusPill tone={health?.tone || 'neutral'}>
          {health?.overall || 'Unknown'}
        </StatusPill>
      </div>
      <p style={{ ...muted, margin: '8px 0 0' }}>
        Quick checks for the store systems that process inventory, orders, and
        notifications.
      </p>
      <div style={{ display: 'grid', gap: 10, marginTop: 12 }}>
        {checks.map((check) => (
          <div
            key={check.id}
            style={{
              borderTop: '1px solid #f1f5f9',
              paddingTop: 10,
              display: 'grid',
              gap: 3,
            }}
          >
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                justifyContent: 'space-between',
                gap: 8,
              }}
            >
              <strong>{check.label}</strong>
              <StatusPill tone={check.tone || (check.ok ? 'good' : 'bad')}>
                {check.id === 'last_order' || check.id === 'last_inventory_update'
                  ? formatDate(check.status) !== '-'
                    ? formatDate(check.status)
                    : check.status
                  : check.status}
              </StatusPill>
            </div>
            <span style={muted}>{check.detail}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function AdminHome() {
  const [overview, setOverview] = useState(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');

  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/overview', {
        credentials: 'same-origin',
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to load overview');
      setOverview(data);
    } catch (err) {
      setMessage(err.message || 'Failed to load overview.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const attentionSummary = useMemo(() => {
    const unshipped = overview?.orders?.unshipped || 0;
    const inventoryAttention =
      (overview?.inventory?.low_stock || 0) + (overview?.inventory?.sold_out || 0);

    return {
      unshipped,
      inventoryAttention,
      ordersTone: unshipped > 0 ? 'warn' : 'good',
      inventoryTone: inventoryAttention > 0 ? 'warn' : 'good',
    };
  }, [overview]);

  return (
    <AdminLayout>
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12,
        }}
      >
        <div>
          <h1 style={{ marginBottom: 4 }}>Admin Overview</h1>
          <div style={muted}>
            {overview?.generated_at
              ? `Updated ${formatDate(overview.generated_at)}`
              : 'Store operations'}
          </div>
        </div>
        <button
          type="button"
          onClick={refresh}
          style={{
            border: '1px solid #cbd5e1',
            borderRadius: 6,
            padding: '8px 12px',
            background: '#fff',
            cursor: 'pointer',
            fontWeight: 700,
          }}
        >
          Refresh
        </button>
      </div>

      {message ? <p style={{ color: '#991b1b' }}>{message}</p> : null}

      {loading ? (
        <p>Loading...</p>
      ) : overview ? (
        <>
          <section style={sectionGrid}>
            <HealthPanel health={overview.health} />

            <div style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'baseline',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>Orders Needing Action</h2>
                <StatusPill tone={attentionSummary.ordersTone}>
                  {attentionSummary.unshipped
                    ? `${attentionSummary.unshipped} open`
                    : 'Clear'}
                </StatusPill>
              </div>
              <p style={{ ...muted, margin: '8px 0 0' }}>
                New and processing orders that still need shipping follow-up.
              </p>
              <ActionList
                rows={overview.orders.unshipped_recent}
                kind="order"
              />
              <div style={{ marginTop: 12 }}>
                <Link href="/admin/orders">Open orders</Link>
              </div>
            </div>

            <div style={card}>
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  gap: 12,
                  alignItems: 'baseline',
                }}
              >
                <h2 style={{ margin: 0, fontSize: 18 }}>Inventory Attention</h2>
                <StatusPill tone={attentionSummary.inventoryTone}>
                  {attentionSummary.inventoryAttention
                    ? `${attentionSummary.inventoryAttention} items`
                    : 'Clear'}
                </StatusPill>
              </div>
              <p style={{ ...muted, margin: '8px 0 0' }}>
                Low stock and sold-out catalog items that may need restocking or
                hiding.
              </p>
              <ActionList rows={overview.inventory.low_stock_rows} kind="sku" />
              {!overview.inventory.low_stock_rows?.length &&
              overview.inventory.sold_out_rows?.length ? (
                <ActionList rows={overview.inventory.sold_out_rows} kind="sku" />
              ) : null}
              <div style={{ marginTop: 12 }}>
                <Link href="/admin/inventory">Open inventory</Link>
              </div>
            </div>
          </section>

          <section style={sectionGrid}>
            <AdminSectionCard
              href="/admin/orders"
              title="Orders"
              description="Review fulfillment, update shipping status, and download the order sheet."
              meta={{
                tone: attentionSummary.ordersTone,
                label: overview.orders.unshipped
                  ? `${overview.orders.new} new`
                  : 'Ready',
              }}
            />

            <AdminSectionCard
              href="/admin/inventory"
              title="Inventory"
              description="Adjust stock, add products, and move unavailable items into standby."
              meta={{
                tone: attentionSummary.inventoryTone,
                label: overview.inventory.low_stock
                  ? `${overview.inventory.low_stock} low`
                  : 'Ready',
              }}
            />

            <AdminSectionCard
              href="/admin/site-content"
              title="Homepage Content"
              description="Update the support message, community spotlight, and Instagram call to action."
              meta={{
                tone: 'good',
                label: 'Editable',
              }}
            />

            <AdminSectionCard
              href="/admin/sponsors"
              title="Sponsors"
              description="Add sponsors, update logo paths, change tiers, and turn sponsors on or off."
              meta={{
                tone: 'good',
                label: 'Editable',
              }}
            />
          </section>
        </>
      ) : null}
    </AdminLayout>
  );
}
