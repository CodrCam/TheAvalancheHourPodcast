// pages/admin/index.js
import Link from 'next/link';

export default function AdminHome() {
  return (
    <main style={{ padding: 24, maxWidth: 800, margin: '0 auto' }}>
      <h1>Admin</h1>
      <p>Internal tools for The Avalanche Hour store.</p>

      <section style={{ marginTop: 16 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Store tools</h2>
        <nav>
          <ul style={{ listStyle: 'disc', paddingLeft: 20, lineHeight: 1.7 }}>
            <li>
              <Link href="/admin/inventory">
                Inventory (edit SKUs &amp; quantities)
              </Link>
            </li>
            <li>
              <Link href="/admin/orders">
                Orders (fulfillment &amp; export)
              </Link>
            </li>
          </ul>
        </nav>
      </section>

      <section style={{ marginTop: 24 }}>
        <h2 style={{ fontSize: 18, marginBottom: 8 }}>Shipping workflow</h2>
        <p style={{ fontSize: 14, maxWidth: 640 }}>
          Typical flow for packing &amp; shipping:
        </p>
        <ol style={{ fontSize: 14, paddingLeft: 20, lineHeight: 1.6 }}>
          <li>Open <strong>Orders</strong> and mark anything already shipped as <em>Shipped</em>.</li>
          <li>Click <em>Download CSV</em> to export all unshipped orders.</li>
          <li>Upload the CSV into Pirate Ship and buy labels.</li>
          <li>After labels are printed, set the orders to <em>Shipped</em> in the admin.</li>
        </ol>
      </section>
    </main>
  );
}