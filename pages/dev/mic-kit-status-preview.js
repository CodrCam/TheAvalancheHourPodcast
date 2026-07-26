import { useState } from 'react';
import {
  MIC_KIT_STATUS_LABELS,
  applyMicKitStatus,
} from '../../lib/micKitPresentation.mjs';

const INITIAL_KIT = {
  status: 'in_transit',
  carrier: 'UPS',
  tracking_number: '1Z999AA10123456784',
  tracking_url: 'https://www.ups.com/track',
};

export async function getServerSideProps() {
  if (process.env.NODE_ENV === 'production') return { notFound: true };
  return { props: {} };
}

export default function MicKitStatusPreview() {
  const [kit, setKit] = useState(INITIAL_KIT);
  const available = kit.status === 'available';

  return (
    <main
      style={{
        minHeight: '100vh',
        padding: '64px 20px',
        background: '#eef3f3',
        color: '#102a37',
      }}
    >
      <form
        style={{
          display: 'grid',
          gap: 20,
          width: 'min(100%, 560px)',
          margin: '0 auto',
          padding: 32,
          border: '1px solid #d7e1e3',
          background: '#fff',
          boxShadow: '0 20px 55px rgba(14, 45, 58, 0.1)',
        }}
      >
        <div>
          <span
            style={{
              color: '#e66f3d',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Mic kit editor
          </span>
          <h1 style={{ margin: '8px 0 0', fontSize: 30 }}>TAH US Kit 1</h1>
        </div>
        <label style={{ display: 'grid', gap: 7, fontWeight: 700 }}>
          Status
          <select
            value={kit.status}
            onChange={(event) =>
              setKit((current) =>
                applyMicKitStatus(current, event.target.value)
              )
            }
            style={{ minHeight: 44, padding: '8px 10px' }}
          >
            {Object.entries(MIC_KIT_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </label>
        {[
          ['carrier', 'Carrier'],
          ['tracking_number', 'Tracking number'],
          ['tracking_url', 'Tracking link'],
        ].map(([field, label]) => (
          <label
            key={field}
            style={{ display: 'grid', gap: 7, fontWeight: 700 }}
          >
            {label}
            <input
              value={kit[field]}
              disabled={available}
              onChange={(event) =>
                setKit((current) => ({
                  ...current,
                  [field]: event.target.value,
                }))
              }
              style={{ minHeight: 44, padding: '8px 10px' }}
            />
          </label>
        ))}
        {available ? (
          <p style={{ margin: 0, color: '#526b77', fontSize: 14 }}>
            Available kits have no active shipment tracking.
          </p>
        ) : null}
      </form>
    </main>
  );
}
