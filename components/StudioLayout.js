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
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import NotificationBell from './NotificationBell';
import {
  getVisibleStudioNavigationItems,
  STUDIO_NAV_SECTIONS,
} from '../lib/studioNavigation.mjs';
import styles from '../styles/Studio.module.css';

const NAV_ICONS = {
  home: HomeRoundedIcon,
  resources: MenuBookRoundedIcon,
  episodes: PodcastsRoundedIcon,
  profile: AccountCircleRoundedIcon,
  mic_kits: HeadsetMicRoundedIcon,
  calendar: CalendarMonthRoundedIcon,
  access: ManageAccountsRoundedIcon,
  sponsor_reads: CampaignRoundedIcon,
  admin: DashboardRoundedIcon,
  products: CategoryRoundedIcon,
  orders: ReceiptLongRoundedIcon,
  site_content: ArticleRoundedIcon,
  people: GroupsRoundedIcon,
  sponsors: HandshakeRoundedIcon,
  mic_kit_checkout: HeadsetMicRoundedIcon,
  system_health: HealthAndSafetyRoundedIcon,
};

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
    return getVisibleStudioNavigationItems(session?.permissions);
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
          {navItems.map((item, index) => {
            const active =
              item.activePaths?.some((path) =>
                router.pathname.startsWith(path)
              ) ||
              (item.exact
                ? router.pathname === item.href
                : router.pathname.startsWith(item.href));
            const beginsSection =
              item.section && navItems[index - 1]?.section !== item.section;
            const Icon = NAV_ICONS[item.icon] || HomeRoundedIcon;

            return (
              <div
                key={item.href}
                className={styles.navItemBase}
              >
                {beginsSection ? (
                  <span
                    className={
                      index === 0
                        ? styles.navLabel
                        : styles.navLabelSecondary
                    }
                  >
                    {STUDIO_NAV_SECTIONS[item.section] || item.section}
                  </span>
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
        <header className={styles.topBar} aria-label="Studio utilities">
          <span
            className={styles.futureMessagingSlot}
            data-future-messaging-slot
            aria-hidden="true"
          />
          {session.permissions?.includes('notifications:read') ? (
            <NotificationBell href="/studio/notifications" />
          ) : null}
        </header>
        <div className={styles.mainInner}>{children}</div>
      </main>
    </div>
  );
}
