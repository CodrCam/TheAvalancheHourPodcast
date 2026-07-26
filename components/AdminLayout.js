// components/AdminLayout.js
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationBell from './NotificationBell';
import styles from '../styles/AdminLayout.module.css';

function formatRole(role) {
  if (!role) return 'Checking access';
  return String(role)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function formatGroups(groups, fallbackRole) {
  const values = Array.isArray(groups) && groups.length ? groups : [fallbackRole];
  return values.filter(Boolean).map(formatRole).join(' + ') || 'Checking access';
}

const NAV_SECTIONS = [
  {
    label: 'Workspace',
    items: [
      { href: '/admin', label: 'Overview', icon: DashboardRoundedIcon },
      {
        href: '/admin/products',
        label: 'Products & stock',
        icon: CategoryRoundedIcon,
        permission: 'products:read',
      },
      { href: '/admin/orders', label: 'Orders', icon: ReceiptLongRoundedIcon },
      {
        href: '/admin/site-content',
        label: 'Site Content',
        icon: ArticleRoundedIcon,
      },
      {
        href: '/admin/people',
        label: 'Hosts & Team',
        icon: GroupsRoundedIcon,
      },
      { href: '/admin/sponsors', label: 'Sponsors', icon: HandshakeRoundedIcon },
      {
        href: '/admin/system-health',
        label: 'System Health',
        icon: HealthAndSafetyRoundedIcon,
        permission: 'audit:read',
      },
    ],
  },
  {
    label: 'My Work',
    items: [
      {
        href: '/studio/episodes',
        label: 'My Episodes',
        icon: PodcastsRoundedIcon,
        permission: 'episodes:read',
      },
      {
        href: '/studio/profile',
        label: 'My Profile',
        icon: AccountCircleRoundedIcon,
        permission: 'profile:self:read',
      },
      {
        href: '/admin/mic-kits',
        label: 'Mic Kit Checkout',
        icon: HeadsetMicRoundedIcon,
        permission: 'mic_kits:manage',
      },
    ],
  },
  {
    label: 'Studio',
    items: [
      {
        href: '/admin/studios',
        label: 'Episode Calendar',
        icon: CalendarMonthRoundedIcon,
        permission: 'episodes:manage',
      },
      {
        href: '/admin/sponsor-reads',
        label: 'Sponsor Reads',
        icon: CampaignRoundedIcon,
        permission: 'sponsor_reads:read',
      },
      {
        href: '/studio/resources',
        label: 'Team Resources',
        icon: MenuBookRoundedIcon,
        permission: 'resources:read',
        activePaths: ['/studio/resources', '/studio/manage/resources'],
      },
    ],
  },
];

export default function AdminLayout({
  children,
  hasUnsavedChanges = false,
  unsavedChangesMessage = 'You have unsaved changes. Leave this page and discard them?',
  requiredPermission = '',
  accessDeniedRedirect = '/admin',
}) {
  const [session, setSession] = useState(null);
  const [sessionState, setSessionState] = useState('loading');
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      try {
        const res = await fetch('/api/store/admin/session', {
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (!alive) return;
        if (
          res.ok &&
          data.user &&
          (!requiredPermission ||
            data.user.permissions?.includes(requiredPermission))
        ) {
          setSession(data.user);
          setSessionState('ready');
        } else {
          setSessionState('denied');
          router.replace(
            res.ok && data.user ? accessDeniedRedirect : '/studio'
          );
        }
      } catch {
        if (alive) {
          setSessionState('denied');
          router.replace('/studio');
        }
      }
    }

    loadSession();

    return () => {
      alive = false;
    };
  }, [accessDeniedRedirect, requiredPermission, router]);

  useEffect(() => {
    if (!hasUnsavedChanges) return undefined;

    function warnBeforeUnload(event) {
      event.preventDefault();
      event.returnValue = '';
    }

    window.addEventListener('beforeunload', warnBeforeUnload);
    router.beforePopState(() => window.confirm(unsavedChangesMessage));

    return () => {
      window.removeEventListener('beforeunload', warnBeforeUnload);
      router.beforePopState(() => true);
    };
  }, [hasUnsavedChanges, router, unsavedChangesMessage]);

  function confirmInternalNavigation(event, href) {
    if (
      !hasUnsavedChanges ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey ||
      router.asPath.split(/[?#]/)[0] === href
    ) {
      return;
    }

    if (!window.confirm(unsavedChangesMessage)) {
      event.preventDefault();
    }
  }

  if (sessionState !== 'ready') {
    return (
      <main
        style={{
          minHeight: '100vh',
          display: 'grid',
          placeContent: 'center',
          justifyItems: 'center',
          gap: 12,
          background: '#f6f7f9',
          color: '#475467',
        }}
      >
        <img
          src="/images/logo.png"
          alt=""
          style={{ width: 72, height: 72, objectFit: 'contain' }}
        />
        <p>
          {sessionState === 'loading'
            ? 'Opening Admin Studio…'
            : 'Redirecting to Host Studio…'}
        </p>
      </main>
    );
  }

  const visibleNavSections = NAV_SECTIONS.map((section) => ({
    ...section,
    items: section.items.filter(
      (item) =>
        !item.permission || session?.permissions?.includes(item.permission)
    ),
  })).filter((section) => section.items.length > 0);

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link
          href="/admin"
          className={styles.brand}
          onClick={(event) => confirmInternalNavigation(event, '/admin')}
        >
          <span className={styles.brandMark} aria-hidden="true">
            <img src="/images/logo.png" alt="" />
          </span>
          <span className={styles.brandCopy}>
            <span className={styles.brandEyebrow}>Avalanche Hour</span>
            <span className={styles.brandTitle}>Admin Studio</span>
          </span>
        </Link>

        {session?.permissions?.includes('notifications:read') ? (
          <NotificationBell
            href="/admin/notifications"
            className={styles.notificationBell}
          />
        ) : null}

        <nav className={styles.nav} aria-label="Admin navigation">
          <ul className={styles.navList}>
            {visibleNavSections.flatMap((section) => [
              <li
                key={`${section.label}-label`}
                className={styles.navSectionLabel}
              >
                {section.label}
              </li>,
              ...section.items.map((item) => {
                const isActive =
                  item.activePaths?.some((path) =>
                    router.pathname.startsWith(path)
                  ) ||
                  (item.href === '/admin'
                    ? router.pathname === item.href
                    : router.pathname.startsWith(item.href));
                const Icon = item.icon;

                return (
                  <li key={item.href}>
                    <Link
                      href={item.href}
                      aria-current={isActive ? 'page' : undefined}
                      className={`${styles.navLink} ${
                        isActive ? styles.navLinkActive : ''
                      }`}
                      onClick={(event) =>
                        confirmInternalNavigation(event, item.href)
                      }
                    >
                      <Icon className={styles.navIcon} aria-hidden="true" />
                      <span>{item.label}</span>
                    </Link>
                  </li>
                );
              }),
            ])}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <span className={styles.accountRole}>
              {formatGroups(session?.groups, session?.role)}
            </span>
            <span className={styles.accountName}>
              {session?.display_name ||
                session?.username ||
                'Secure admin session'}
            </span>
          </div>
          <div className={styles.footerActions}>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              <OpenInNewRoundedIcon fontSize="inherit" aria-hidden="true" />
              View site
            </Link>
            <form
              action="/api/store/admin/auth/logout"
              method="post"
              className={styles.signOutForm}
            >
              <button type="submit" className={styles.signOutButton}>
                <LogoutRoundedIcon fontSize="inherit" aria-hidden="true" />
                Sign out
              </button>
            </form>
          </div>
        </div>
      </aside>

      <main className={styles.main}>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
