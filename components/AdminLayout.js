// components/AdminLayout.js
import Link from 'next/link';

export default function AdminLayout({ children }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, padding: 16, borderRight: '1px solid #eee' }}>
        <h2>Admin</h2>
        <nav>
          <ul>
            <li><Link href="/admin/inventory">Inventory</Link></li>
            <li><Link href="/admin/orders">Orders</Link></li>
          </ul>
        </nav>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
