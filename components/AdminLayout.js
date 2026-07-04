// components/AdminLayout.js
import Link from 'next/link';
import { useEffect, useState } from 'react';

function formatRole(role) {
  if (!role) return 'Checking access';
  return role.charAt(0).toUpperCase() + role.slice(1);
}

export default function AdminLayout({ children }) {
  const [session, setSession] = useState(null);

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      try {
        const res = await fetch('/api/store/admin/session', {
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (alive && res.ok) setSession(data.user || null);
      } catch {
        if (alive) setSession(null);
      }
    }

    loadSession();

    return () => {
      alive = false;
    };
  }, []);

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <aside style={{ width: 220, padding: 16, borderRight: '1px solid #eee' }}>
        <h2>Admin</h2>
        <div
          style={{
            display: 'inline-block',
            marginBottom: 16,
            padding: '4px 8px',
            borderRadius: 999,
            background: '#f2f4f7',
            color: '#344054',
            fontSize: 12,
            fontWeight: 700,
          }}
        >
          {formatRole(session?.role)}
        </div>
        <nav>
          <ul style={{ paddingLeft: 18, lineHeight: 1.7 }}>
            <li>
              <Link href="/admin">Overview</Link>
            </li>
            <li>
              <Link href="/admin/inventory">Inventory</Link>
            </li>
            <li>
              <Link href="/admin/orders">Orders</Link>
            </li>
          </ul>
        </nav>
        <form action="/api/store/admin/auth/logout" method="post">
          <button
            type="submit"
            style={{
              marginTop: 24,
              padding: '8px 10px',
              width: '100%',
              border: '1px solid #d0d5dd',
              borderRadius: 6,
              background: '#fff',
              color: '#344054',
              cursor: 'pointer',
              fontWeight: 700,
            }}
          >
            Sign out
          </button>
        </form>
      </aside>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
