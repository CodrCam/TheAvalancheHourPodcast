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

function EpisodeActionList({ rows = [] }) {
  if (!rows.length) {
    return (
      <EmptyLine>
        No episodes are scheduled yet. Create the first one from Episode
        Studios.
      </EmptyLine>
    );
  }

  return (
    <div style={{ display: 'grid', gap: 10, marginTop: 10 }}>
      {rows.map((episode) => (
        <Link
          key={episode.episode_id}
          href={`/admin/studios/${episode.episode_id}`}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) auto',
            gap: 12,
            padding: episode.delivery_health === 'off_track' ? 10 : '10px 0 0',
            color: 'inherit',
            textDecoration: 'none',
            border:
              episode.delivery_health === 'off_track'
                ? '1px solid #fed7c5'
                : 0,
            borderTop:
              episode.delivery_health === 'off_track'
                ? '1px solid #fed7c5'
                : '1px solid #f1f5f9',
            borderRadius: episode.delivery_health === 'off_track' ? 10 : 0,
            background:
              episode.delivery_health === 'off_track'
                ? '#fff7f1'
                : 'transparent',
          }}
        >
          <div style={{ minWidth: 0 }}>
            <strong>{episode.title}</strong>
            <span style={{ ...muted, display: 'block', marginTop: 3 }}>
              {episode.host_names.join(' + ') || 'Host assignment pending'}
            </span>
            <span style={{ ...muted, display: 'block', marginTop: 2 }}>
              {episode.completion.host_percent}% host-ready ·{' '}
              {episode.completion.producer_approved
                ? 'producer approved'
                : 'approval pending'}
            </span>
            {episode.delivery_health === 'off_track' ? (
              <StatusPill tone="bad">Off track</StatusPill>
            ) : null}
          </div>
          <div style={{ textAlign: 'right' }}>
            <strong style={{ fontSize: 13 }}>
              {episode.target_release_date
                ? new Date(
                    `${episode.target_release_date}T12:00:00`
                  ).toLocaleDateString(undefined, {
                    month: 'short',
                    day: 'numeric',
                  })
                : 'Unscheduled'}
            </strong>
            <span style={{ ...muted, display: 'block', marginTop: 3 }}>
              release
            </span>
          </div>
        </Link>
      ))}
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
              : 'Team operations'}
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
                <h2 style={{ margin: 0, fontSize: 18 }}>Stock attention</h2>
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
                <Link href="/admin/products?view=stock">Review stock</Link>
              </div>
            </div>

            {overview.capabilities?.can_manage_episodes ? (
              <div style={{ ...card, gridColumn: '1 / -1' }}>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    gap: 12,
                    alignItems: 'baseline',
                  }}
                >
                  <h2 style={{ margin: 0, fontSize: 18 }}>
                    Episode Production
                  </h2>
                  <StatusPill
                    tone={
                      overview.episode_studios?.off_track
                        ? 'bad'
                        : overview.episode_studios?.producer_queue
                          ? 'warn'
                          : 'good'
                    }
                  >
                    {overview.episode_studios?.off_track
                      ? `${overview.episode_studios.off_track} off track`
                      : overview.episode_studios?.producer_queue
                        ? `${overview.episode_studios.producer_queue} ready`
                        : 'On track'}
                  </StatusPill>
                </div>
                <p style={{ ...muted, margin: '8px 0 0' }}>
                  Upcoming releases, assigned hosts, and packages ready for the
                  producer.
                </p>
                <EpisodeActionList
                  rows={overview.episode_studios?.upcoming || []}
                />
                <div style={{ marginTop: 12 }}>
                  <Link href="/admin/studios">Open production calendar</Link>
                </div>
              </div>
            ) : null}
          </section>
        </>
      ) : null}
    </AdminLayout>
  );
}
