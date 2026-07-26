import Link from 'next/link';
import { useCallback, useEffect, useMemo, useState } from 'react';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import TaskAltRoundedIcon from '@mui/icons-material/TaskAltRounded';
import AdminLayout from './AdminLayout';
import StudioLayout from './StudioLayout';
import {
  groupStudioNotifications,
} from '../lib/studioNotificationPresentation.mjs';
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
  if (
    notification.type.includes('approved') ||
    notification.type.includes('complete')
  ) {
    return TaskAltRoundedIcon;
  }
  return NotificationsNoneRoundedIcon;
}

function exactTime(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  });
}

function relativeTime(value) {
  const time = new Date(value).getTime();
  if (!Number.isFinite(time)) return '';
  const seconds = Math.round((time - Date.now()) / 1000);
  const formatter = new Intl.RelativeTimeFormat(undefined, {
    numeric: 'auto',
  });
  if (Math.abs(seconds) < 60) return formatter.format(seconds, 'second');
  const minutes = Math.round(seconds / 60);
  if (Math.abs(minutes) < 60) return formatter.format(minutes, 'minute');
  const hours = Math.round(minutes / 60);
  if (Math.abs(hours) < 24) return formatter.format(hours, 'hour');
  return formatter.format(Math.round(hours / 24), 'day');
}

function mergeNotifications(current, incoming) {
  const byId = new Map(
    current.map((notification) => [
      notification.notification_id,
      notification,
    ])
  );
  for (const notification of incoming) {
    byId.set(notification.notification_id, notification);
  }
  return [...byId.values()].sort((a, b) =>
    b.created_at.localeCompare(a.created_at)
  );
}

export default function NotificationCenter({
  admin = false,
  previewData = null,
  bare = false,
}) {
  const previewMode = Boolean(previewData);
  const [notifications, setNotifications] = useState(
    previewData?.notifications || []
  );
  const [unreadCount, setUnreadCount] = useState(
    Number(previewData?.unread_count) || 0
  );
  const [nextCursor, setNextCursor] = useState('');
  const [filter, setFilter] = useState('all');
  const [loading, setLoading] = useState(!previewMode);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const Layout = admin ? AdminLayout : StudioLayout;

  const loadNotifications = useCallback(async (cursor = '') => {
    if (previewMode) return;
    cursor ? setLoadingMore(true) : setLoading(true);
    try {
      const query = new URLSearchParams({ limit: '50' });
      if (cursor) query.set('cursor', cursor);
      const response = await fetch(
        `/api/studio/notifications?${query.toString()}`,
        {
          credentials: 'same-origin',
          cache: 'no-store',
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load notifications.');
      }
      setNotifications((current) =>
        cursor
          ? mergeNotifications(current, data.notifications || [])
          : data.notifications || []
      );
      setUnreadCount(Number(data.unread_count) || 0);
      setNextCursor(data.next_cursor || '');
      setError('');
    } catch (loadError) {
      setError(loadError.message || 'Could not load notifications.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [previewMode]);

  useEffect(() => {
    if (previewMode) return undefined;
    const initialLoad = window.setTimeout(loadNotifications, 0);
    return () => window.clearTimeout(initialLoad);
  }, [loadNotifications, previewMode]);

  const visibleGroups = useMemo(() => {
    const visible = notifications.filter((notification) => {
      if (filter === 'unread') return !notification.read_at;
      if (filter === 'reminders') return notification.kind === 'reminder';
      if (filter === 'episode') return notification.category === 'episode';
      if (filter === 'mic_kit') return notification.category === 'mic_kit';
      if (filter === 'operations') {
        return ['store', 'access', 'system'].includes(notification.category);
      }
      return true;
    });
    return groupStudioNotifications(visible);
  }, [filter, notifications]);

  async function updateRead(notification, read = true) {
    if (Boolean(notification.read_at) === read) return;
    if (previewMode) {
      const changedAt = read ? new Date().toISOString() : '';
      setNotifications((current) =>
        current.map((candidate) =>
          candidate.notification_id === notification.notification_id
            ? {
                ...candidate,
                read_at: changedAt,
                seen_at: read ? candidate.seen_at || changedAt : candidate.seen_at,
              }
            : candidate
        )
      );
      setUnreadCount((current) =>
        read ? Math.max(0, current - 1) : current + 1
      );
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
    if (previewMode) {
      const readAt = new Date().toISOString();
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || readAt,
          seen_at: notification.seen_at || readAt,
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
      if (!response.ok) {
        throw new Error(data.error || 'Could not mark notifications read.');
      }
      setNotifications((current) =>
        current.map((notification) => ({
          ...notification,
          read_at: notification.read_at || data.read_at,
          seen_at: notification.seen_at || data.read_at,
        }))
      );
      setUnreadCount(0);
    } catch (updateError) {
      setError(updateError.message || 'Could not mark notifications read.');
    }
  }

  const content = (
    <div className={styles.page}>
        <header className={styles.header}>
          <div>
            <span>Studio activity</span>
            <h1>Notifications</h1>
            <p>
              Episode handoffs, production-lead checks, discussion, required
              files, sponsor reads, mic kits, and scheduled reminders stay
              grouped with the record they belong to.
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

        <div
          className={styles.filters}
          role="group"
          aria-label="Notification filters"
        >
          {[
            ['all', 'All'],
            ['unread', 'Unread'],
            ['episode', 'Episodes'],
            ['mic_kit', 'Mic kits'],
            ['reminders', 'Reminders'],
            ['operations', 'Operations'],
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

        {error ? (
          <p className={styles.error} role="status">
            {error}
          </p>
        ) : null}
        {loading ? (
          <p className={styles.empty}>Loading activity…</p>
        ) : visibleGroups.length ? (
          <div className={styles.groupList}>
            {visibleGroups.map((group) => (
              <details
                key={group.group_key}
                className={`${styles.group} ${
                  group.unread_count ? styles.groupUnread : ''
                }`}
                open={group.unread_count > 0}
              >
                <summary>
                  <span>
                    <strong>{group.latest_title}</strong>
                    <small>
                      {group.notification_count}{' '}
                      {group.notification_count === 1 ? 'update' : 'updates'}
                      {' · '}
                      <time
                        dateTime={group.latest_at}
                        title={exactTime(group.latest_at)}
                      >
                        {relativeTime(group.latest_at)}
                      </time>
                    </small>
                  </span>
                  {group.unread_count ? (
                    <em>{group.unread_count} unread</em>
                  ) : (
                    <em>Read</em>
                  )}
                </summary>
                <div className={styles.list}>
                  {group.notifications.map((notification) => {
                    const Icon = iconFor(notification);
                    return (
                      <article
                        key={notification.notification_id}
                        className={`${styles.item} ${
                          notification.read_at
                            ? styles.read
                            : styles.unread
                        }`}
                        data-urgency={notification.urgency}
                        data-intent={notification.intent}
                      >
                        <span className={styles.icon}>
                          <Icon aria-hidden="true" />
                        </span>
                        <div className={styles.body}>
                          <div className={styles.itemMeta}>
                            <span>{notification.intent}</span>
                            <time
                              dateTime={notification.created_at}
                              title={exactTime(notification.created_at)}
                            >
                              {relativeTime(notification.created_at)}
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
                            updateRead(
                              notification,
                              !Boolean(notification.read_at)
                            )
                          }
                        >
                          {notification.read_at
                            ? 'Mark unread'
                            : 'Mark read'}
                        </button>
                      </article>
                    );
                  })}
                </div>
              </details>
            ))}
          </div>
        ) : (
          <p className={styles.empty}>
            No notifications match this view.
          </p>
        )}

        {nextCursor && filter === 'all' ? (
          <button
            type="button"
            className={styles.loadMore}
            onClick={() => loadNotifications(nextCursor)}
            disabled={loadingMore}
          >
            {loadingMore ? 'Loading…' : 'Load older notifications'}
          </button>
        ) : null}
    </div>
  );
  return bare ? (
    content
  ) : (
    <Layout requiredPermission="notifications:read">{content}</Layout>
  );
}
