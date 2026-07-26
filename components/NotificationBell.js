import Link from 'next/link';
import { useRouter } from 'next/router';
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import DoneAllRoundedIcon from '@mui/icons-material/DoneAllRounded';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';
import styles from '../styles/NotificationBell.module.css';

function relativeTime(value, now = Date.now()) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.round((time - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  const days = Math.round(hours / 24);
  if (Math.abs(days) < 30) return formatter.format(days, 'day');
  const months = Math.round(days / 30);
  return formatter.format(months, 'month');
}

function exactTime(value) {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? ''
    : date.toLocaleString(undefined, {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
}

export default function NotificationBell({
  href,
  className = '',
  previewData = null,
}) {
  const router = useRouter();
  const rootRef = useRef(null);
  const headingRef = useRef(null);
  const buttonRef = useRef(null);
  const [open, setOpen] = useState(false);
  const previewMode = Boolean(previewData);
  const [groups, setGroups] = useState(previewData?.groups || []);
  const [notifications, setNotifications] = useState(
    previewData?.notifications || []
  );
  const [unreadCount, setUnreadCount] = useState(
    Number(previewData?.unread_count) || 0
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadNotifications = useCallback(async () => {
    if (previewMode) return previewData;
    setLoading(true);
    try {
      const response = await fetch('/api/studio/notifications?limit=24', {
        credentials: 'same-origin',
        cache: 'no-store',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load notifications.');
      }
      setGroups(data.groups || []);
      setNotifications(data.notifications || []);
      setUnreadCount(Number(data.unread_count) || 0);
      setError('');
      return data;
    } catch (loadError) {
      setError(
        loadError.message || 'Notifications are temporarily unavailable.'
      );
      return null;
    } finally {
      setLoading(false);
    }
  }, [previewData, previewMode]);

  const markSeen = useCallback(async (values) => {
    const ids = (values || [])
      .filter((notification) => !notification.seen_at)
      .map((notification) => notification.notification_id);
    if (!ids.length) return;
    if (previewMode) {
      const seenAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          ids.includes(notification.notification_id)
            ? { ...notification, seen_at: seenAt }
            : notification
        )
      );
      return;
    }
    try {
      const response = await fetch('/api/studio/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_seen',
          notification_ids: ids,
        }),
      });
      if (!response.ok) return;
      const seenAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) =>
          ids.includes(notification.notification_id)
            ? { ...notification, seen_at: notification.seen_at || seenAt }
            : notification
        )
      );
    } catch {
      // Seen state can retry on the next open without blocking navigation.
    }
  }, [previewMode]);

  useEffect(() => {
    const initialRefresh = window.setTimeout(loadNotifications, 0);
    const refresh = () => {
      if (document.visibilityState === 'visible') loadNotifications();
    };
    const interval = window.setInterval(refresh, 60000);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      window.clearTimeout(initialRefresh);
      window.clearInterval(interval);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [loadNotifications]);

  useEffect(() => {
    if (!open) return undefined;
    const closeOnOutsideClick = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    const closeOnEscape = (event) => {
      if (event.key !== 'Escape') return;
      setOpen(false);
      buttonRef.current?.focus();
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    document.addEventListener('keydown', closeOnEscape);
    headingRef.current?.focus();
    return () => {
      document.removeEventListener('pointerdown', closeOnOutsideClick);
      document.removeEventListener('keydown', closeOnEscape);
    };
  }, [open]);

  useEffect(() => {
    const close = () => setOpen(false);
    router.events.on('routeChangeStart', close);
    return () => router.events.off('routeChangeStart', close);
  }, [router.events]);

  async function togglePopover() {
    const nextOpen = !open;
    setOpen(nextOpen);
    if (!nextOpen) return;
    const data = await loadNotifications();
    await markSeen(data?.notifications || notifications);
  }

  async function markRead(notification) {
    if (notification.read_at) return;
    if (previewMode) {
      const readAt = new Date().toISOString();
      const next = { ...notification, read_at: readAt, seen_at: readAt };
      setNotifications((current) =>
        current.map((candidate) =>
          candidate.notification_id === notification.notification_id
            ? next
            : candidate
        )
      );
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          unread_count: group.notifications.some(
            (candidate) =>
              candidate.notification_id === notification.notification_id &&
              !candidate.read_at
          )
            ? Math.max(0, group.unread_count - 1)
            : group.unread_count,
          notifications: group.notifications.map((candidate) =>
            candidate.notification_id === notification.notification_id
              ? next
              : candidate
          ),
        }))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
      return;
    }
    try {
      const response = await fetch('/api/studio/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'mark_read',
          notification_id: notification.notification_id,
        }),
      });
      const data = await response.json();
      if (!response.ok) return;
      setNotifications((current) =>
        current.map((candidate) =>
          candidate.notification_id === notification.notification_id
            ? data.notification
            : candidate
        )
      );
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          unread_count: group.notifications.some(
            (candidate) =>
              candidate.notification_id === notification.notification_id &&
              !candidate.read_at
          )
            ? Math.max(0, group.unread_count - 1)
            : group.unread_count,
          notifications: group.notifications.map((candidate) =>
            candidate.notification_id === notification.notification_id
              ? data.notification
              : candidate
          ),
        }))
      );
      setUnreadCount((current) => Math.max(0, current - 1));
    } catch {
      // The destination still performs its own authorization check.
    }
  }

  async function markAllRead() {
    if (previewMode) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || readAt,
          seen_at: notification.seen_at || readAt,
        }))
      );
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          unread_count: 0,
          notifications: group.notifications.map((notification) => ({
            ...notification,
            read_at: notification.read_at || readAt,
            seen_at: notification.seen_at || readAt,
          })),
        }))
      );
      setUnreadCount(0);
      return;
    }
    try {
      const response = await fetch('/api/studio/notifications', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'mark_all_read' }),
      });
      const data = await response.json();
      if (!response.ok) return;
      const readAt = data.read_at || new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || readAt,
          seen_at: notification.seen_at || readAt,
        }))
      );
      setGroups((current) =>
        current.map((group) => ({
          ...group,
          unread_count: 0,
          notifications: group.notifications.map((notification) => ({
            ...notification,
            read_at: notification.read_at || readAt,
            seen_at: notification.seen_at || readAt,
          })),
        }))
      );
      setUnreadCount(0);
    } catch {
      setError('Could not mark notifications read.');
    }
  }

  return (
    <div
      ref={rootRef}
      className={`${styles.root} ${className}`}
      data-notification-bell
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.bell}
        aria-label={
          unreadCount
            ? `Notifications, ${unreadCount} unread`
            : 'Notifications'
        }
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="notification-popover"
        onClick={togglePopover}
      >
        <NotificationsRoundedIcon aria-hidden="true" />
        {unreadCount ? (
          <span className={styles.badge} aria-hidden="true">
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        ) : null}
      </button>
      <span className={styles.liveCount} aria-live="polite">
        {unreadCount ? `${unreadCount} unread notifications` : ''}
      </span>

      {open ? (
        <section
          id="notification-popover"
          className={styles.popover}
          role="dialog"
          aria-labelledby="notification-popover-title"
        >
          <header className={styles.header}>
            <div>
              <span>Studio activity</span>
              <h2
                id="notification-popover-title"
                ref={headingRef}
                tabIndex={-1}
              >
                Notifications
              </h2>
            </div>
            <button
              type="button"
              onClick={markAllRead}
              disabled={!unreadCount}
            >
              <DoneAllRoundedIcon aria-hidden="true" />
              Mark all read
            </button>
          </header>

          <div className={styles.feed}>
            {error ? (
              <p className={styles.feedback} role="status">
                {error}
              </p>
            ) : loading && !groups.length ? (
              <p className={styles.feedback}>Loading activity…</p>
            ) : groups.length ? (
              groups.slice(0, 8).map((group) => (
                <details
                  key={group.group_key}
                  className={`${styles.group} ${
                    group.unread_count ? styles.unread : ''
                  }`}
                  open={group.notification_count === 1}
                >
                  <summary>
                    <span className={styles.groupDot} aria-hidden="true" />
                    <span>
                      <strong>{group.latest_title}</strong>
                      <small>
                        {group.notification_count > 1
                          ? `${group.notification_count} updates · `
                          : ''}
                        <time
                          dateTime={group.latest_at}
                          title={exactTime(group.latest_at)}
                        >
                          {relativeTime(group.latest_at)}
                        </time>
                      </small>
                    </span>
                    {group.unread_count ? (
                      <em>{group.unread_count} new</em>
                    ) : null}
                  </summary>
                  <div className={styles.events}>
                    {group.notifications.map((notification) => (
                      <article
                        key={notification.notification_id}
                        className={
                          notification.read_at ? styles.read : styles.eventUnread
                        }
                      >
                        <Link
                          href={notification.deep_link}
                          onClick={() => markRead(notification)}
                        >
                          <strong>{notification.title}</strong>
                          <span>{notification.preview}</span>
                          <time
                            dateTime={notification.created_at}
                            title={exactTime(notification.created_at)}
                          >
                            {relativeTime(notification.created_at)}
                          </time>
                        </Link>
                        {!notification.read_at ? (
                          <button
                            type="button"
                            onClick={() => markRead(notification)}
                            aria-label={`Mark “${notification.title}” read`}
                          >
                            Mark read
                          </button>
                        ) : null}
                      </article>
                    ))}
                  </div>
                </details>
              ))
            ) : (
              <p className={styles.feedback}>
                You’re caught up. New production activity will appear here.
              </p>
            )}
          </div>

          <footer className={styles.footer}>
            <Link href={href}>View all notifications</Link>
          </footer>
        </section>
      ) : null}
    </div>
  );
}
