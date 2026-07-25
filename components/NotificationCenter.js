import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import AdminLayout from './AdminLayout';
import StudioLayout from './StudioLayout';
import styles from '../styles/Notifications.module.css';

function iconFor(notification) {
  if (notification.type === 'episode_discussion_message') {
    return ForumRoundedIcon;
  }
  if (notification.type.includes('sponsor_read')) {
    return CampaignRoundedIcon;
  }
  if (notification.category === 'mic_kit') {
    return HeadsetMicRoundedIcon;
  }
  if (notification.kind === 'reminder') {
    return ScheduleRoundedIcon;
  }
  if (notification.type.includes('approved')) {
    return TaskAltRoundedIcon;
  }
  return NotificationsNoneRoundedIcon;
}

function formatTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function NotificationCenter({ admin = false }) {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const Layout = admin ? AdminLayout : StudioLayout;

  useEffect(() => {
    let alive = true;

    async function loadNotifications() {
      try {
        const response = await fetch('/api/studio/notifications?limit=200', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load notifications.');
        }
        if (!alive) return;
        setNotifications(data.notifications || []);
        setUnreadCount(Number(data.unread_count) || 0);
      } catch (loadError) {
        if (alive) {
          setError(loadError.message || 'Could not load notifications.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadNotifications();
    return () => {
      alive = false;
    };
  }, []);

  const visible = useMemo(
    () =>
      notifications.filter((notification) => {
        if (filter === 'unread') return !notification.read_at;
        if (filter === 'reminders') return notification.kind === 'reminder';
        if (filter === 'episode') return notification.category === 'episode';
        if (filter === 'mic_kit') return notification.category === 'mic_kit';
        return true;
      }),
    [filter, notifications]
  );

  async function updateRead(notification, read = true) {
    if (Boolean(notification.read_at) === read) return;
    try {
      const response = await fetch('/api/studio/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notification_id: notification.notification_id,
          read,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update the notification.');
      }
      setNotifications((current) =>
        current.map((candidate) =>
          candidate.notification_id === notification.notification_id
            ? data.notification
            : candidate
        )
      );
      setUnreadCount((current) =>
        read ? Math.max(0, current - 1) : current + 1
      );
    } catch (updateError) {
      setError(updateError.message || 'Could not update the notification.');
    }
  }

  async function markAllRead() {
    try {
      const response = await fetch('/api/studio/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not mark notifications read.');
      }
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || data.read_at,
        }))
      );
      setUnreadCount(0);
    } catch (updateError) {
      setError(updateError.message || 'Could not mark notifications read.');
    }
  }

  return (
    <Layout requiredPermission="notifications:read">
      <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span>Studio activity</span>
            <h1>Notifications and reminders</h1>
            <p>
              Discussion updates and production events arrive immediately.
              Time-based reminders are generated separately and labeled.
            </p>
          </div>
          <div className={styles.unreadSummary}>
            <strong>{unreadCount}</strong>
            <span>unread</span>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              Mark all read
            </button>
          </div>
        </header>

        <div className={styles.filters} role="group" aria-label="Notification filters">
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
            ['episode', 'Episodes'],
            ['mic_kit', 'Mic kits'],
            ['reminders', 'Reminders'],
          ].map(([value, label]) => (
            <button
              type="button"
              key={value}
              aria-pressed={filter === value}
              onClick={() => setFilter(value)}
            >
              {label}
            </button>
          ))}
        </div>

        {error ? <p className={styles.error}>{error}</p> : null}
        {loading ? (
          <p className={styles.empty}>Loading activity…</p>
        ) : visible.length ? (
          <div className={styles.list}>
            {visible.map((notification) => {
              const Icon = iconFor(notification);
              return (
                <article
                  key={notification.notification_id}
                  className={`${styles.item} ${
                    notification.read_at ? styles.read : styles.unread
                  }`}
                  data-urgency={notification.urgency}
                >
                  <span className={styles.icon}>
                    <Icon aria-hidden="true" />
                  </span>
                  <div className={styles.body}>
                    <div className={styles.itemMeta}>
                      <span>{notification.kind}</span>
                      <time dateTime={notification.created_at}>
                        {formatTime(notification.created_at)}
                      </time>
                    </div>
                    <Link
                      href={notification.deep_link}
                      onClick={() => updateRead(notification, true)}
                    >
                      {notification.title}
                    </Link>
                    <p>{notification.preview}</p>
                    {notification.actor_name ? (
                      <small>From {notification.actor_name}</small>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={styles.readToggle}
                    onClick={() =>
                      updateRead(notification, !Boolean(notification.read_at))
                    }
                  >
                    {notification.read_at ? 'Mark unread' : 'Mark read'}
                  </button>
                </article>
              );
            })}
          </div>
        ) : (
          <p className={styles.empty}>No notifications match this view.</p>
        )}
      </div>
    </Layout>
  );
}
