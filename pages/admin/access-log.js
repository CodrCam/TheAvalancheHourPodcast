import { useEffect, useMemo, useState } from 'react';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import LoginRoundedIcon from '@mui/icons-material/LoginRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import AdminLayout from '../../components/AdminLayout';
import styles from '../../styles/AdminAccessLog.module.css';

const RANGE_OPTIONS = [
  { value: '7', label: 'Last 7 days' },
  { value: '30', label: 'Last 30 days' },
  { value: '90', label: 'Last 90 days' },
  { value: 'all', label: 'All history' },
];

const STATUS_LABELS = {
  active: 'Active now',
  signed_out: 'Signed out',
  expired: 'Expired',
  idle: 'Idle',
};

function formatDateTime(value) {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
}

function formatRelativeTime(value, now = Date.now()) {
  const time = new Date(value || '').getTime();
  if (!time || Number.isNaN(time)) return 'Never';
  const seconds = Math.max(0, Math.round((now - time) / 1000));
  if (seconds < 60) return 'Just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  if (seconds < 7 * 86400) return `${Math.floor(seconds / 86400)}d ago`;
  return new Date(time).toLocaleDateString();
}

function formatDuration(value) {
  const seconds = Math.max(0, Number(value) || 0);
  if (seconds < 60) return '< 1 min';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  if (hours < 24) {
    return remainingMinutes ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
  }
  const days = Math.floor(hours / 24);
  const remainingHours = hours % 24;
  return remainingHours ? `${days}d ${remainingHours}h` : `${days}d`;
}

function formatGroup(group) {
  return String(group || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function SummaryCard({ icon: Icon, label, value, detail }) {
  return (
    <article className={styles.summaryCard}>
      <span className={styles.summaryIcon}>
        <Icon aria-hidden="true" />
      </span>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>
      </div>
    </article>
  );
}

async function fetchAccessLog(selectedRange) {
  const response = await fetch(
    `/api/store/admin/access-log?days=${encodeURIComponent(selectedRange)}`,
    { credentials: 'same-origin' }
  );
  const body = await response.json();
  if (!response.ok) {
    throw new Error(body.error || 'Could not load the access log.');
  }
  return body;
}

export default function AccessLogPage() {
  const [range, setRange] = useState('30');
  const [query, setQuery] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function loadAccessLog(selectedRange = range) {
    setLoading(true);
    setError('');
    try {
      setData(await fetchAccessLog(selectedRange));
    } catch (loadError) {
      setError(loadError.message || 'Could not load the access log.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let alive = true;

    async function loadSelectedRange() {
      try {
        const body = await fetchAccessLog(range);
        if (alive) setData(body);
      } catch (loadError) {
        if (alive) {
          setError(loadError.message || 'Could not load the access log.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadSelectedRange();
    return () => {
      alive = false;
    };
  }, [range]);

  const filteredUsers = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return data?.users || [];
    return (data?.users || []).filter((user) =>
      [
        user.display_name,
        user.username,
        user.role,
        ...(user.groups || []),
      ]
        .join(' ')
        .toLowerCase()
        .includes(needle)
    );
  }, [data, query]);

  const filteredSessions = useMemo(() => {
    const visibleAccounts = new Set(
      filteredUsers.map((user) => user.subject || user.username)
    );
    return (data?.sessions || [])
      .filter((session) =>
        visibleAccounts.has(session.subject || session.username)
      )
      .slice(0, 100);
  }, [data, filteredUsers]);

  const summary = data?.summary || {};
  const rangeLabel =
    RANGE_OPTIONS.find((option) => option.value === range)?.label ||
    'Selected period';

  return (
    <AdminLayout requiredPermission="audit:read">
      <header className={styles.header}>
        <div>
          <span>Admin security</span>
          <h1>Access Log</h1>
          <p>
            See which Cognito accounts authenticated at the Team Studio sign-in,
            the access groups they used, and how long their sessions were
            observed.
          </p>
        </div>
        <button
          type="button"
          onClick={() => loadAccessLog(range)}
          disabled={loading}
        >
          <RefreshRoundedIcon aria-hidden="true" />
          {loading ? 'Refreshing…' : 'Refresh'}
        </button>
      </header>

      <div className={styles.toolbar}>
        <label className={styles.searchField}>
          <SearchRoundedIcon aria-hidden="true" />
          <span className={styles.srOnly}>Search accounts</span>
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search name, email, or access group"
          />
        </label>
        <label className={styles.rangeField}>
          <span>Period</span>
          <select
            value={range}
            onChange={(event) => {
              setLoading(true);
              setError('');
              setRange(event.target.value);
            }}
          >
            {RANGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? <p className={styles.error}>{error}</p> : null}
      {data && !data.configured ? (
        <section className={styles.notice}>
          <HistoryRoundedIcon aria-hidden="true" />
          <div>
            <strong>Access logging is waiting for DynamoDB.</strong>
            <p>
              Configure the existing site-content table and DynamoDB credentials
              to begin recording successful Cognito sessions.
            </p>
          </div>
        </section>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Access summary">
        <SummaryCard
          icon={PeopleAltRoundedIcon}
          label="Accounts observed"
          value={summary.unique_users ?? '—'}
          detail={rangeLabel}
        />
        <SummaryCard
          icon={LoginRoundedIcon}
          label="Sign-ins"
          value={summary.login_count ?? '—'}
          detail="Successful Cognito logins"
        />
        <SummaryCard
          icon={HistoryRoundedIcon}
          label="Active now"
          value={summary.active_now ?? '—'}
          detail="Seen in the last 7 minutes"
        />
        <SummaryCard
          icon={ScheduleRoundedIcon}
          label="Observed time"
          value={
            summary.total_duration_seconds === undefined
              ? '—'
              : formatDuration(summary.total_duration_seconds)
          }
          detail="Across all sessions"
        />
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Who has signed in</span>
            <h2>Accounts</h2>
          </div>
          <small>
            {filteredUsers.length} of {data?.users?.length || 0}
          </small>
        </div>

        {loading && !data ? (
          <p className={styles.empty}>Loading account activity…</p>
        ) : filteredUsers.length ? (
          <div className={styles.accountList}>
            {filteredUsers.map((user) => (
              <article
                className={styles.accountRow}
                key={user.subject || user.username}
              >
                <div className={styles.identity}>
                  <span className={styles.avatar} aria-hidden="true">
                    {initials(user.display_name) || '?'}
                  </span>
                  <div>
                    <strong>{user.display_name}</strong>
                    <span>{user.username}</span>
                  </div>
                </div>
                <div className={styles.groupList}>
                  {(user.groups || []).length ? (
                    user.groups.map((group) => (
                      <span key={group}>{formatGroup(group)}</span>
                    ))
                  ) : (
                    <span>No app group</span>
                  )}
                </div>
                <div className={styles.metric}>
                  <span>Sign-ins</span>
                  <strong>{user.login_count}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Avg. session</span>
                  <strong>{formatDuration(user.average_duration_seconds)}</strong>
                </div>
                <div className={styles.metric}>
                  <span>Last seen</span>
                  <strong>{formatRelativeTime(user.last_seen_at)}</strong>
                </div>
                <span
                  className={`${styles.presence} ${
                    user.active ? styles.presenceActive : ''
                  }`}
                >
                  {user.active ? 'Active' : 'Offline'}
                </span>
              </article>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            {query
              ? 'No accounts match that search.'
              : 'No successful sign-ins were recorded in this period.'}
          </p>
        )}
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHeader}>
          <div>
            <span>Most recent first</span>
            <h2>Session history</h2>
          </div>
          <small>Showing up to 100 sessions</small>
        </div>

        {filteredSessions.length ? (
          <div className={styles.tableWrap}>
            <table>
              <thead>
                <tr>
                  <th>Account</th>
                  <th>Signed in</th>
                  <th>Last seen</th>
                  <th>Duration</th>
                  <th>Client</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredSessions.map((session) => (
                  <tr key={session.session_key}>
                    <td>
                      <strong>{session.display_name}</strong>
                      <span>{session.username}</span>
                    </td>
                    <td>{formatDateTime(session.login_at)}</td>
                    <td>{formatDateTime(session.last_seen_at)}</td>
                    <td>{formatDuration(session.duration_seconds)}</td>
                    <td>
                      <strong>{session.client}</strong>
                      <span>{session.ip || 'IP unavailable'}</span>
                    </td>
                    <td>
                      <span
                        className={`${styles.status} ${
                          styles[`status_${session.status}`] || ''
                        }`}
                      >
                        {STATUS_LABELS[session.status] || session.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className={styles.empty}>No session history to show.</p>
        )}
      </section>

      <p className={styles.footnote}>
        Duration runs from sign-in to sign-out or the last visible-page
        heartbeat. “Active now” means a valid session checked in during the
        last seven minutes. This log begins collecting data after deployment;
        Cognito does not backfill earlier app sessions.
      </p>
    </AdminLayout>
  );
}
