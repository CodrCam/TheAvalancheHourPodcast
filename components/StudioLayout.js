import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import HomeRoundedIcon from '@mui/icons-material/HomeRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import ManageAccountsRoundedIcon from '@mui/icons-material/ManageAccountsRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import styles from '../styles/Studio.module.css';

const BASE_NAV_ITEMS = [
  {
    href: '/studio',
    label: 'Home',
    icon: HomeRoundedIcon,
    permission: 'studio:read',
  },
  {
    href: '/studio/resources',
    label: 'Resources',
    icon: MenuBookRoundedIcon,
    permission: 'resources:read',
    activePaths: ['/studio/resources', '/studio/manage/resources'],
  },
  {
    href: '/studio/episodes',
    label: 'My Episodes',
    icon: PodcastsRoundedIcon,
    permission: 'episodes:read',
    section: 'my_work',
  },
  {
    href: '/studio/profile',
    label: 'My Profile',
    icon: AccountCircleRoundedIcon,
    permission: 'profile:self:read',
    section: 'my_work',
  },
  {
    href: '/studio/mic-kits',
    label: 'Mic Kits',
    icon: HeadsetMicRoundedIcon,
    permission: 'mic_kits:read',
    section: 'my_work',
  },
];

const MANAGER_NAV_ITEMS = [
  {
    href: '/studio/manage/episodes',
    label: 'Episode Calendar',
    icon: CalendarMonthRoundedIcon,
    permission: 'episodes:manage',
    manager: true,
  },
  {
    href: '/studio/manage/access',
    label: 'Host Access',
    icon: ManageAccountsRoundedIcon,
    permission: 'studio_access:manage',
    manager: true,
  },
];

function formatGroup(group) {
  return String(group || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export default function StudioLayout({
  children,
  hasUnsavedChanges = false,
  unsavedChangesMessage = 'You have unpublished changes. Leave this page and discard them?',
  requiredPermission = '',
  accessDeniedRedirect = '/studio',
}) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [sessionState, setSessionState] = useState('loading');

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      try {
        const response = await fetch('/api/studio/session', {
          credentials: 'same-origin',
        });
        const data = await response.json();

        if (!alive) return;
        if (!response.ok || !data.user) {
          setSessionState('denied');
          router.replace('/admin/login');
          return;
        }

        if (
          requiredPermission &&
          !data.user.permissions?.includes(requiredPermission)
        ) {
          setSessionState('denied');
          router.replace(accessDeniedRedirect);
          return;
        }

        setSession(data.user);
        setSessionState('ready');
      } catch {
        if (!alive) return;
        setSessionState('denied');
        router.replace('/admin/login');
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

  const navItems = useMemo(() => {
    const permissions = new Set(session?.permissions || []);
    return [
      ...BASE_NAV_ITEMS.filter(
        (item) => !item.permission || permissions.has(item.permission)
      ),
      ...MANAGER_NAV_ITEMS.filter((item) =>
        permissions.has(item.permission)
      ),
    ];
  }, [session]);
  const studioHomeHref = session?.permissions?.includes('studio:read')
    ? '/studio'
    : '/studio/mic-kits';

  function confirmNavigation(event, href) {
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
      <main className={styles.sessionLoading}>
        <img src="/images/logo.png" alt="" />
        <p>{sessionState === 'loading' ? 'Opening Host Studio…' : 'Redirecting…'}</p>
      </main>
    );
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <Link
          href={studioHomeHref}
          className={styles.brand}
          onClick={(event) => confirmNavigation(event, studioHomeHref)}
        >
          <span className={styles.brandMark}>
            <img src="/images/logo.png" alt="" />
          </span>
          <span>
            <span className={styles.brandEyebrow}>The Avalanche Hour</span>
            <span className={styles.brandTitle}>Host Studio</span>
          </span>
        </Link>

        <nav aria-label="Host Studio navigation" className={styles.nav}>
          <span className={styles.navLabel}>Studio</span>
          {navItems.map((item, index) => {
            const active =
              item.activePaths?.some((path) =>
                router.pathname.startsWith(path)
              ) ||
              (item.href === '/studio'
                ? router.pathname === item.href
                : router.pathname.startsWith(item.href));
            const beginsManagerSection =
              item.manager && !navItems[index - 1]?.manager;
            const beginsMyWorkSection =
              item.section === 'my_work' &&
              navItems[index - 1]?.section !== 'my_work';
            const Icon = item.icon;

            return (
              <div
                key={item.href}
                className={
                  item.manager ? styles.navItemManager : styles.navItemBase
                }
              >
                {beginsMyWorkSection ? (
                  <span className={styles.navLabelSecondary}>My Work</span>
                ) : null}
                {beginsManagerSection ? (
                  <span className={styles.navLabelSecondary}>Manage</span>
                ) : null}
                <Link
                  href={item.href}
                  className={`${styles.navLink} ${
                    active ? styles.navLinkActive : ''
                  }`}
                  aria-current={active ? 'page' : undefined}
                  onClick={(event) => confirmNavigation(event, item.href)}
                >
                  <Icon aria-hidden="true" />
                  <span>{item.label}</span>
                </Link>
              </div>
            );
          })}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <strong>
              {(session.groups || []).map(formatGroup).join(' + ')}
            </strong>
            <span>{session.display_name || session.username}</span>
          </div>
          <div className={styles.footerActions}>
            <Link
              href="/"
              target="_blank"
              rel="noopener noreferrer"
              className={styles.footerLink}
            >
              <OpenInNewRoundedIcon aria-hidden="true" />
              View website
            </Link>
            <form action="/api/store/admin/auth/logout" method="post">
              <button type="submit" className={styles.signOutButton}>
                <LogoutRoundedIcon aria-hidden="true" />
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
