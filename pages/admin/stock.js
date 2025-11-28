// pages/admin/stock.js
import { useEffect, useState } from 'react';
import AdminLayout from '../../components/AdminLayout';

function StockTable({ inventory }) {
  if (!inventory.length) {
    return <p>No inventory rows found.</p>;
  }

  return (
    <table
      style={{
        width: '100%',
        borderCollapse: 'collapse',
        fontSize: 13,
        marginTop: 8,
      }}
    >
      <thead>
        <tr>
          <th style={th}>SKU</th>
          <th style={th}>Quantity</th>
        </tr>
      </thead>
      <tbody>
        {inventory.map((row) => (
          <tr key={row.sku}>
            <td style={tdMono}>{row.sku}</td>
            <td style={td}>{row.quantity}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AdminStockPage() {
  const [inventory, setInventory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    async function load() {
      setLoading(true);
      setErrorMsg('');
      try {
        const res = await fetch('/api/store/admin/stock');
        const data = await res.json();
        if (!res.ok) {
          throw new Error(data.error || 'Failed to load inventory');
        }
        const list = Array.isArray(data.inventory) ? data.inventory : [];
        setInventory(list);
      } catch (err) {
        console.error('admin stock error', err);
        setErrorMsg(err.message || 'Failed to load inventory.');
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <AdminLayout>
      <h1>Inventory Snapshot</h1>
      <p style={{ fontSize: 14, maxWidth: 640 }}>
        Read-only view of current inventory pulled from the database. Use{' '}
        <strong>Inventory</strong> in the admin menu to edit SKUs, names, and
        quantities.
      </p>

      {loading ? (
        <p>Loading…</p>
      ) : errorMsg ? (
        <p style={{ color: 'red', fontSize: 13 }}>{errorMsg}</p>
      ) : (
        <StockTable inventory={inventory} />
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
};

const tdMono = {
  ...td,
  fontFamily: 'Menlo, Monaco, Consolas, "Courier New", monospace',
};