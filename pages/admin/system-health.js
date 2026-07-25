import { useEffect, useState } from 'react';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ErrorRoundedIcon from '@mui/icons-material/ErrorRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import AdminLayout from '../../components/AdminLayout';
import styles from '../../styles/AdminHealth.module.css';

function formatStatus(check) {
  if (!['last_order', 'last_inventory_update'].includes(check.id)) {
    return check.status;
  }
  const date = new Date(check.status);
  if (Number.isNaN(date.getTime())) return check.status;
  return date.toLocaleString();
}

function StatusIcon({ tone }) {
  if (tone === 'bad') return <ErrorRoundedIcon aria-hidden="true" />;
  if (tone === 'warn') return <WarningAmberRoundedIcon aria-hidden="true" />;
  return <CheckCircleRoundedIcon aria-hidden="true" />;
}

export default function SystemHealthPage() {
  const [health, setHealth] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function refresh() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/store/admin/system-health', {
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load system health.');
      }
      setHealth(data);
    } catch (err) {
      setError(err.message || 'Could not load system health.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  return (
    <AdminLayout>
      <header className={styles.header}>
        <div>
          <span>Admin diagnostics</span>
          <h1>System Health</h1>
          <p>
            A quiet place for Cameron and Caleb to verify the website systems
            without crowding the daily operations overview.
          </p>
        </div>
        <button type="button" onClick={refresh} disabled={loading}>
          <RefreshRoundedIcon aria-hidden="true" />
          {loading ? 'Checking…' : 'Run checks'}
        </button>
      </header>

      {error ? <p className={styles.error}>{error}</p> : null}

      <section
        className={`${styles.overall} ${
          styles[`tone_${health?.tone || 'neutral'}`]
        }`}
      >
        <StatusIcon tone={health?.tone} />
        <div>
          <span>Overall status</span>
          <strong>{health?.overall || (loading ? 'Checking…' : 'Unknown')}</strong>
          <p>
            {health?.generated_at
              ? `Last checked ${new Date(health.generated_at).toLocaleString()}`
              : 'Running the current connection checks.'}
          </p>
        </div>
      </section>

      <section className={styles.checkGrid}>
        {(health?.checks || []).map((check) => (
          <article
            key={check.id}
            className={`${styles.checkCard} ${
              styles[`tone_${check.tone || 'neutral'}`]
            }`}
          >
            <div className={styles.checkIcon}>
              <StatusIcon tone={check.tone} />
            </div>
            <div>
              <span>{formatStatus(check)}</span>
              <h2>{check.label}</h2>
              <p>{check.detail}</p>
            </div>
          </article>
        ))}
      </section>
    </AdminLayout>
  );
}
