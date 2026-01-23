// pages/admin/inventory.js
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

// Human-readable labels for each SKU
const SKU_LABELS = {
  'recap-cord-blue-grey': 'ReCaps Corduroy — Blue/Grey',
  'recap-cord-sage-purp': 'ReCaps Corduroy — Sage/Purple',
  'recap-cord-yellow': 'ReCaps Corduroy — Yellow',
  'recap-cord-teal': 'ReCaps Corduroy — Teal',
  'recap-pom-blue': 'ReCaps Pom — Blue',
  'recap-pom-green': 'ReCaps Pom — Green',
  'recap-pom-brown': 'ReCaps Pom — Brown',
  'recap-cuff-black': 'ReCaps Beanie — Black',
  'recap-cuff-blue': 'ReCaps Beanie — Blue',
  'recap-cuff-purp': 'ReCaps Beanie — Purple',
  'recap-trucker-gold-dirt': 'ReCaps Foam Trucker — Gold/Dirt',
  'strap-20-black': 'Voile Strap 20" — Black',
  'strap-25-blue': 'Voile Strap 25" — Blue',
  'hoodie-blue-storm-s': 'Hoodie Blue Storm — S',
  'hoodie-blue-storm-m': 'Hoodie Blue Storm — M',
  'hoodie-blue-storm-l': 'Hoodie Blue Storm — L',
  'hoodie-blue-storm-xl': 'Hoodie Blue Storm — XL',
  'hoodie-dark-grey-heather-s': 'Hoodie Dark Grey Heather — S',
  'hoodie-dark-grey-heather-m': 'Hoodie Dark Grey Heather — M',
  'hoodie-dark-grey-heather-l': 'Hoodie Dark Grey Heather — L',
  'hoodie-dark-grey-heather-xl': 'Hoodie Dark Grey Heather — XL',
  'free-range-tote': 'Free Range Canvas Tote',
  'ah-hat-black-camo': 'Avalanche Hour Hat — Black Camo',
  'ah-hat-blue': 'Avalanche Hour Hat — Blue',
  'ah-hat-blue-mesh': 'Avalanche Hour Hat — Blue Mesh',
  'ah-hat-green-cord': 'Avalanche Hour Hat — Green Corduroy (Brooke Maushund)',
  'ah-sticker-logo': 'Avalanche Hour Sticker — New Logo',
};

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

export default function AdminInventoryPage() {
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState({});
  const [newSku, setNewSku] = useState('');
  const [newQty, setNewQty] = useState('');

  // Load inventory from API
  async function refresh() {
    setLoading(true);
    setMessage('');
    try {
      const res = await fetch('/api/store/admin/stock');
      const data = await res.json();

      // Support both {inventory: [...] } and old {stock: [...]}
      const list = Array.isArray(data.inventory)
        ? data.inventory
        : Array.isArray(data.stock)
        ? data.stock
        : [];
      setRows(list);
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

  // Call update-stock API with an absolute quantity
  async function setQuantity(sku, quantity) {
    const q = Math.max(0, parseInt(quantity, 10) || 0);
    setMessage('');

    try {
      const res = await fetch('/api/store/admin/update-stock', {
        method: 'PATCH', // absolute set
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sku, quantity: q }),
      });

      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || 'Failed to update quantity');
      }

      setRows((prev) => {
        const exists = prev.some((r) => (r.sku || r.sku_key) === sku);
        if (exists) {
          return prev.map((r) =>
            (r.sku || r.sku_key) === sku ? { ...r, quantity: q } : r
          );
        }
        // new SKU
        return [...prev, { sku, quantity: q }].sort((a, b) =>
          (a.sku || a.sku_key).localeCompare(b.sku || b.sku_key)
        );
      });

      setPending((prev) => ({ ...prev, [sku]: '' }));
    } catch (err) {
      console.error(err);
      setMessage(err.message || 'Failed to update quantity.');
    }
  }

  function handleSetClick(sku) {
    const currentRow = rows.find((r) => (r.sku || r.sku_key) === sku);
    const fallbackQty = currentRow ? currentRow.quantity : 0;
    const val =
      pending[sku] !== undefined && pending[sku] !== ''
        ? pending[sku]
        : fallbackQty;
    setQuantity(sku, val);
  }

  async function handleAddSku(e) {
    e.preventDefault();
    if (!newSku.trim()) return;
    await setQuantity(newSku.trim(), newQty || 0);
    setNewSku('');
    setNewQty('');
  }

  return (
    <AdminLayout>
      <h1>Inventory</h1>
      {message && <p>{message}</p>}

      {/* Add / Set SKU block */}
      <section
        style={{
          marginBottom: 24,
          padding: 16,
          borderRadius: 8,
          border: '1px solid #eee',
        }}
      >
        <h2 style={{ marginTop: 0 }}>Add / Set SKU</h2>
        <form
          onSubmit={handleAddSku}
          style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}
        >
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            SKU
            <input
              type="text"
              value={newSku}
              onChange={(e) => setNewSku(e.target.value)}
              placeholder="e.g. recap-cord-blue-grey"
              style={{ minWidth: 220 }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column' }}>
            Quantity
            <input
              type="number"
              min="0"
              value={newQty}
              onChange={(e) => setNewQty(e.target.value)}
              placeholder="e.g. 10"
              style={{ width: 100 }}
            />
          </label>
          <button type="submit" style={{ alignSelf: 'flex-end' }}>
            Save
          </button>
        </form>
      </section>

      {/* Inventory table */}
      {loading ? (
        <p>Loading…</p>
      ) : rows.length === 0 ? (
        <p>No inventory rows found.</p>
      ) : (
        <section>
          <h2>Current Inventory</h2>
          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              marginTop: 8,
            }}
          >
            <thead>
              <tr>
                <th style={th}>SKU</th>
                <th style={th}>Name</th>
                <th style={th}>Quantity</th>
                <th style={th}>Set Quantity</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const sku = row.sku || row.sku_key;
                return (
                  <tr key={sku}>
                    <td style={td}>{sku}</td>
                    <td style={td}>{SKU_LABELS[sku] || '—'}</td>
                    <td style={td}>{row.quantity}</td>
                    <td style={td}>
                      <input
                        type="number"
                        min="0"
                        value={
                          pending[sku] !== undefined
                            ? pending[sku]
                            : row.quantity
                        }
                        onChange={(e) =>
                          setPending((prev) => ({
                            ...prev,
                            [sku]: e.target.value,
                          }))
                        }
                        style={{ width: 80, marginRight: 4 }}
                      />
                      <button type="button" onClick={() => handleSetClick(sku)}>
                        Set
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </section>
      )}
    </AdminLayout>
  );
}