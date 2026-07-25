import Link from 'next/link';
import { useEffect, useState } from 'react';
import NotificationsRoundedIcon from '@mui/icons-material/NotificationsRounded';

export default function NotificationBell({ href, className = '' }) {
  const [unreadCount, setUnreadCount] = useState(0);

  useEffect(() => {
    let alive = true;
    async function loadCount() {
      try {
        const response = await fetch('/api/studio/notifications?limit=1', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (alive && response.ok) {
          setUnreadCount(Number(data.unread_count) || 0);
        }
      } catch {
        // The main Studio remains available if notifications are unavailable.
      }
    }
    loadCount();
    return () => {
      alive = false;
    };
  }, []);

  return (
    <Link
      href={href}
      className={className}
      aria-label={
        unreadCount
          ? `Notifications, ${unreadCount} unread`
          : 'Notifications'
      }
    >
      <NotificationsRoundedIcon aria-hidden="true" />
      <span>Notifications</span>
      {unreadCount ? (
        <strong aria-hidden="true">
          {unreadCount > 99 ? '99+' : unreadCount}
        </strong>
      ) : null}
    </Link>
  );
}
