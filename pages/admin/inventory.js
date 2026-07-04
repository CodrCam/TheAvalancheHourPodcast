import { useEffect, useMemo, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';
import {
  getAllCatalogSkuEntries,
  getSkuCatalog,
} from '../../lib/productCatalog';

const catalogEntries = getAllCatalogSkuEntries();
const catalogMap = getSkuCatalog();

const styles = {
  toolbar: {
    display: 'grid',
    gridTemplateColumns: 'minmax(220px, 1fr) minmax(180px, auto) minmax(150px, auto) minmax(160px, auto) auto',
    gap: 12,
    alignItems: 'end',
    marginBottom: 18,
  },
  summary: {
    display: 'grid',
    gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
    gap: 12,
    margin: '14px 0 22px',
  },
  summaryItem: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 12,
    background: '#fff',
  },
  panel: {
    border: '1px solid #e5e7eb',
    borderRadius: 8,
    padding: 16,
    marginBottom: 18,
    background: '#fff',
  },
  table: {
    width: '100%',
    borderCollapse: 'collapse',
    marginTop: 8,
    fontSize: 14,
  },
  th: {
    textAlign: 'left',
    padding: '10px 8px',
    borderBottom: '1px solid #d1d5db',
    color: '#2c3e50',
    whiteSpace: 'nowrap',
  },
  td: {
    padding: '10px 8px',
    borderBottom: '1px solid #f3f4f6',
    verticalAlign: 'middle',
  },
  input: {
    minHeight: 34,
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: '6px 8px',
  },
  button: {
    minHeight: 34,
    border: '1px solid #cbd5e1',
    borderRadius: 6,
    padding: '6px 10px',
    background: '#fff',
    cursor: 'pointer',
    fontWeight: 600,
  },
  primaryButton: {
    minHeight: 34,
    border: '1px solid #2563eb',
    borderRadius: 6,
    padding: '6px 12px',
    background: '#2563eb',
    color: '#fff',
    cursor: 'pointer',
    fontWeight: 700,
  },
};

function normalizeRow(row) {
  const sku = String(row.sku || row.sku_key || '').trim();
  return {
    sku,
    name: String(row.name || row.product_name || '').trim(),
    hidden: row.hidden === true || row.hidden === 'true',
    quantity: Math.max(0, Number(row.quantity) || 0),
    updated_at: row.updated_at || null,
  };
}

function getBadge(row) {
  if (!row.inCatalog) return { label: 'Unused SKU', bg: '#fef3c7', color: '#92400e' };
  if (row.hidden) return { label: 'Standby', bg: '#e0e7ff', color: '#3730a3' };
  if (row.quantity <= 0) return { label: 'Sold out', bg: '#fee2e2', color: '#991b1b' };
  if (row.quantity <= 2) return { label: 'Low stock', bg: '#ffedd5', color: '#9a3412' };
  return { label: 'In stock', bg: '#dcfce7', color: '#166534' };
}

function getStatusSortRank(row) {
  if (!row.inCatalog) return 5;
  if (row.hidden) return 4;
  if (row.quantity <= 0) return 3;
  if (row.quantity <= 2) return 1;
  return 0;
}

function StatusBadge({ row }) {
  const badge = getBadge(row);
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        borderRadius: 999,
        background: badge.bg,
        color: badge.color,
        padding: '3px 9px',
        fontSize: 12,
        fontWeight: 700,
        whiteSpace: 'nowrap',
      }}
    >
      {badge.label}
    </span>
  );
}

export default function AdminInventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState({});
  const [pendingNames, setPendingNames] = useState({});
  const [customSku, setCustomSku] = useState('');
  const [newName, setNewName] = useState('');
  const [newQty, setNewQty] = useState('');
  const [query, setQuery] = useState('');
  const [productFilter, setProductFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');
  const [sortMode, setSortMode] = useState('status');

  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/stock');
      const data = await res.json();
      const list = Array.isArray(data.inventory)
        ? data.inventory
        : Array.isArray(data.stock)
        ? data.stock
        : [];
      setRows(list.map(normalizeRow));
    } catch (err) {
      console.error(err);
      setMessage('Failed to load inventory.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const mergedRows = useMemo(() => {
    const bySku = new Map();

    for (const entry of catalogEntries) {
      bySku.set(entry.sku, {
        sku: entry.sku,
        name: '',
        hidden: false,
        quantity: 0,
        label: entry.label,
        productName: entry.productName,
        inCatalog: true,
        missingInventoryRow: true,
      });
    }

    for (const row of rows) {
      const catalogEntry = catalogMap.get(row.sku);
      bySku.set(row.sku, {
        ...row,
        label: catalogEntry?.label || row.name || '',
        productName: catalogEntry?.productName || '',
        inCatalog: !!catalogEntry,
        missingInventoryRow: false,
      });
    }

    return [...bySku.values()].sort((a, b) => {
      if (a.inCatalog !== b.inCatalog) return a.inCatalog ? -1 : 1;
      return a.sku.localeCompare(b.sku);
    });
  }, [rows]);

  const productOptions = useMemo(() => {
    const names = new Set();
    for (const row of mergedRows) {
      if (row.inCatalog && row.productName) names.add(row.productName);
    }
    return [...names].sort((a, b) => a.localeCompare(b));
  }, [mergedRows]);

  const filteredRows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return mergedRows.filter((row) => {
      const badge = getBadge(row).label.toLowerCase();
      const text = `${row.sku} ${row.label} ${row.name} ${row.productName}`.toLowerCase();
      const matchesQuery = !q || text.includes(q);
      const matchesProduct =
        productFilter === 'all' ||
        (productFilter === '__unused' && !row.inCatalog) ||
        row.productName === productFilter;
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'sold-out' &&
          row.quantity <= 0 &&
          row.inCatalog &&
          !row.hidden) ||
        (statusFilter === 'standby' && row.hidden && row.inCatalog) ||
        (statusFilter === 'low' &&
          row.quantity > 0 &&
          row.quantity <= 2 &&
          !row.hidden) ||
        (statusFilter === 'unused' && !row.inCatalog) ||
        (statusFilter === 'in-stock' && badge === 'in stock');
      return matchesQuery && matchesProduct && matchesStatus;
    }).sort((a, b) => {
      if (sortMode === 'product') {
        const productCompare = String(a.productName || a.name || '').localeCompare(
          String(b.productName || b.name || '')
        );
        if (productCompare !== 0) return productCompare;
      }
      if (sortMode === 'quantity-desc') {
        if (b.quantity !== a.quantity) return b.quantity - a.quantity;
      }
      if (sortMode === 'quantity-asc') {
        if (a.quantity !== b.quantity) return a.quantity - b.quantity;
      }
      if (sortMode === 'status') {
        const statusCompare = getStatusSortRank(a) - getStatusSortRank(b);
        if (statusCompare !== 0) return statusCompare;
      }
      return a.sku.localeCompare(b.sku);
    });
  }, [mergedRows, productFilter, query, sortMode, statusFilter]);

  const summary = useMemo(() => {
    return {
      catalog: mergedRows.filter((row) => row.inCatalog).length,
      unused: mergedRows.filter((row) => !row.inCatalog).length,
      soldOut: mergedRows.filter(
        (row) => row.inCatalog && !row.hidden && row.quantity <= 0
      ).length,
      hidden: mergedRows.filter((row) => row.inCatalog && row.hidden).length,
      low: mergedRows.filter(
        (row) =>
          row.inCatalog && !row.hidden && row.quantity > 0 && row.quantity <= 2
      ).length,
    };
  }, [mergedRows]);

  async function setQuantity(sku, quantity, name) {
    const cleanSku = String(sku || '').trim();
    const cleanName = String(name || '').trim();
    const q = Math.max(0, parseInt(quantity, 10) || 0);
    if (!cleanSku) return;
    setMessage('');

    try {
      const body = { sku: cleanSku, quantity: q };
      if (cleanName) body.name = cleanName;
      if (q > 0) body.hidden = false;

      const res = await fetch('/api/store/admin/update-stock', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to update quantity');
      }

      setRows((prev) => {
        const exists = prev.some((r) => r.sku === cleanSku);
        const next = exists
          ? prev.map((r) =>
              r.sku === cleanSku
                ? {
                    ...r,
                    quantity: q,
                    name: cleanName || r.name || '',
                    hidden: q > 0 ? false : r.hidden,
                  }
                : r
            )
          : [...prev, { sku: cleanSku, name: cleanName, quantity: q }];
        return next.sort((a, b) => a.sku.localeCompare(b.sku));
      });

      setPending((prev) => ({ ...prev, [cleanSku]: '' }));
      setPendingNames((prev) => ({ ...prev, [cleanSku]: '' }));
      setMessage(`Saved ${cleanSku} at ${q}.`);
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to update quantity.');
    }
  }

  function handleSetClick(sku) {
    const currentRow = mergedRows.find((r) => r.sku === sku);
    const fallbackQty = currentRow ? currentRow.quantity : 0;
    const val =
      pending[sku] !== undefined && pending[sku] !== ''
        ? pending[sku]
        : fallbackQty;
    const fallbackName = currentRow ? currentRow.name || currentRow.label : '';
    const name =
      pendingNames[sku] !== undefined && pendingNames[sku] !== ''
        ? pendingNames[sku]
        : fallbackName;
    setQuantity(sku, val, currentRow?.inCatalog ? undefined : name);
  }

  async function handleAddSku(e) {
    e.preventDefault();
    const sku = customSku.trim();
    const name = newName.trim();
    if (!sku) return;
    if (!name) {
      setMessage('Add a product name before saving a new inventory row.');
      return;
    }
    await setQuantity(sku, newQty || 0, name);
    setCustomSku('');
    setNewName('');
    setNewQty('');
  }

  async function handleRemoveSku(sku) {
    const cleanSku = String(sku || '').trim();
    if (!cleanSku) return;
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/update-stock', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku: cleanSku }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to remove SKU');
      }

      setRows((prev) => prev.filter((row) => row.sku !== cleanSku));
      setPending((prev) => {
        const next = { ...prev };
        delete next[cleanSku];
        return next;
      });
      setPendingNames((prev) => {
        const next = { ...prev };
        delete next[cleanSku];
        return next;
      });
      setMessage(`Removed ${cleanSku}.`);
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to remove SKU.');
    }
  }

  async function setVisibility(sku, hidden) {
    const cleanSku = String(sku || '').trim();
    if (!cleanSku) return;
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/update-stock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'visibility',
          sku: cleanSku,
          hidden: !!hidden,
        }),
      });
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to update visibility');
      }

      setRows((prev) =>
        prev.map((row) =>
          row.sku === cleanSku ? { ...row, hidden: !!hidden } : row
        )
      );
      setMessage(`${hidden ? 'Moved' : 'Restored'} ${cleanSku} ${hidden ? 'to standby' : 'from standby'}.`);
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to update visibility.');
    }
  }

  return (
    <AdminLayout>
      <h1>Inventory</h1>
      {message && <p>{message}</p>}

      <section style={styles.summary}>
        <div style={styles.summaryItem}>
          <strong>{summary.catalog}</strong>
          <div>Catalog SKUs</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>{summary.soldOut}</strong>
          <div>Sold out</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>{summary.low}</strong>
          <div>Low stock</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>{summary.hidden}</strong>
          <div>Standby</div>
        </div>
        <div style={styles.summaryItem}>
          <strong>{summary.unused}</strong>
          <div>Unused SKUs</div>
        </div>
      </section>

      <section style={styles.panel}>
        <h2 style={{ marginTop: 0 }}>Add Inventory Row</h2>
        <form
          onSubmit={handleAddSku}
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(200px, 0.8fr) minmax(240px, 1.2fr) 120px auto',
            gap: 12,
            alignItems: 'end',
          }}
        >
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            New SKU
            <input
              type="text"
              value={customSku}
              onChange={(e) => setCustomSku(e.target.value)}
              placeholder="e.g. new-shirt-black-m"
              style={styles.input}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Product Name
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="e.g. New Shirt - Black - M"
              style={styles.input}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Quantity
            <input
              type="number"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="0"
              style={{ ...styles.input, width: 90 }}
            />
          </label>
          <button type="submit" style={styles.primaryButton}>
            Save
          </button>
        </form>
      </section>

      <section>
        <div style={styles.toolbar}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Search inventory
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="SKU, product, color, size"
              style={styles.input}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Status
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All</option>
              <option value="in-stock">In stock</option>
              <option value="low">Low stock</option>
              <option value="sold-out">Sold out</option>
              <option value="standby">Standby</option>
              <option value="unused">Unused SKUs</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Product
            <select
              value={productFilter}
              onChange={(e) => setProductFilter(e.target.value)}
              style={styles.input}
            >
              <option value="all">All products</option>
              {productOptions.map((name) => (
                <option key={name} value={name}>
                  {name}
                </option>
              ))}
              <option value="__unused">Unused SKUs</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
            Sort
            <select
              value={sortMode}
              onChange={(e) => setSortMode(e.target.value)}
              style={styles.input}
            >
              <option value="status">Status priority</option>
              <option value="product">Product name</option>
              <option value="quantity-desc">Quantity high to low</option>
              <option value="quantity-asc">Quantity low to high</option>
              <option value="sku">SKU</option>
            </select>
          </label>
          <button type="button" onClick={refresh} style={styles.button}>
            Refresh
          </button>
        </div>

        {loading ? (
          <p>Loading...</p>
        ) : filteredRows.length === 0 ? (
          <p>No inventory rows match the current filters.</p>
        ) : (
          <table style={styles.table}>
            <thead>
              <tr>
                <th style={styles.th}>SKU</th>
                <th style={styles.th}>Product</th>
                <th style={styles.th}>Status</th>
                <th style={styles.th}>Quantity</th>
                <th style={styles.th}>Set Quantity</th>
                <th style={styles.th}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.map((row) => (
                <tr key={row.sku}>
                  <td style={styles.td}>
                    <code>{row.sku}</code>
                    {!row.inCatalog ? (
                      <div style={{ color: '#92400e', fontSize: 12, marginTop: 3 }}>
                        Not used by the current store catalog.
                      </div>
                    ) : null}
                  </td>
                  <td style={styles.td}>
                    {row.inCatalog ? (
                      row.label || '-'
                    ) : (
                      <input
                        type="text"
                        value={
                          pendingNames[row.sku] !== undefined
                            ? pendingNames[row.sku]
                            : row.name || row.label || ''
                        }
                        onChange={(e) =>
                          setPendingNames((prev) => ({
                            ...prev,
                            [row.sku]: e.target.value,
                          }))
                        }
                        placeholder="Product name"
                        style={{ ...styles.input, minWidth: 220 }}
                      />
                    )}
                  </td>
                  <td style={styles.td}>
                    <StatusBadge row={row} />
                  </td>
                  <td style={styles.td}>{row.quantity}</td>
                  <td style={styles.td}>
                    <input
                      type="number"
                      min="0"
                      value={
                        pending[row.sku] !== undefined
                          ? pending[row.sku]
                          : row.quantity
                      }
                      onChange={(e) =>
                        setPending((prev) => ({
                          ...prev,
                          [row.sku]: e.target.value,
                        }))
                      }
                      style={{ ...styles.input, width: 84, marginRight: 6 }}
                    />
                    <button
                      type="button"
                      onClick={() => handleSetClick(row.sku)}
                      style={styles.button}
                    >
                      Set
                    </button>
                    {row.quantity !== 0 ? (
                      <button
                        type="button"
                        onClick={() => setQuantity(row.sku, 0)}
                        style={{ ...styles.button, marginLeft: 6 }}
                      >
                        Set 0
                      </button>
                    ) : null}
                  </td>
                  <td style={styles.td}>
                    {!row.inCatalog ? (
                      <button
                        type="button"
                        onClick={() => handleRemoveSku(row.sku)}
                        style={{
                          ...styles.button,
                          borderColor: '#fca5a5',
                          color: '#991b1b',
                        }}
                      >
                        Remove
                      </button>
                    ) : row.hidden ? (
                      <button
                        type="button"
                        onClick={() => setVisibility(row.sku, false)}
                        style={styles.button}
                      >
                        Restore from standby
                      </button>
                    ) : row.quantity <= 0 ? (
                      <button
                        type="button"
                        onClick={() => setVisibility(row.sku, true)}
                        style={styles.button}
                      >
                        Move to standby
                      </button>
                    ) : (
                      <span style={{ color: '#94a3b8' }}>Available</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </AdminLayout>
  );
}
