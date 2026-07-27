import Link from 'next/link';
import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
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
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import PhoneRoundedIcon from '@mui/icons-material/PhoneRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import NotificationBell from './NotificationBell';
import {
  getVisibleStudioNavigationItems,
  STUDIO_NAV_SECTIONS,
} from '../lib/studioNavigation.mjs';
import styles from '../styles/Studio.module.css';

const NAV_ICONS = {
  home: HomeRoundedIcon,
  resources: MenuBookRoundedIcon,
  inbox: InboxRoundedIcon,
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

const StudioSessionContext = createContext(null);

export function useStudioSession() {
  return useContext(StudioSessionContext);
}

function formatGroup(group) {
  return String(group || '')
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function clearCompletedAuthParams() {
  if (typeof window === 'undefined') return;

  const url = new URL(window.location.href);
  const hadAuthParams =
    url.searchParams.has('code') || url.searchParams.has('state');

  if (!hadAuthParams) return;

  url.searchParams.delete('code');
  url.searchParams.delete('state');
  const cleanUrl = `${url.pathname}${url.search}${url.hash}`;
  window.history.replaceState(window.history.state, '', cleanUrl);
}

export default function StudioLayout({
  children,
  hasUnsavedChanges = false,
  unsavedChangesMessage = 'You have unpublished changes. Leave this page and discard them?',
  requiredPermission = '',
  accessDeniedRedirect = '/studio',
  wide = false,
}) {
  const router = useRouter();
  const [session, setSession] = useState(null);
  const [supportContact, setSupportContact] = useState(null);
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
        setSupportContact(data.support_contact || null);
        setSessionState('ready');
        clearCompletedAuthParams();
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
        <p>{sessionState === 'loading' ? 'Opening Team Studio…' : 'Redirecting…'}</p>
      </main>
    );
  }

  return (
    <StudioSessionContext.Provider value={session}>
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
            <span className={styles.brandTitle}>Team Studio</span>
          </span>
        </Link>

        <nav aria-label="Team Studio navigation" className={styles.nav}>
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
                className={`${styles.navItemBase} ${
                  item.section === 'manage' || item.section === 'operations'
                    ? styles.navItemManager
                    : ''
                }`}
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
        <header className={styles.topBar} aria-label="Team Studio utilities">
          <span
            className={styles.futureMessagingSlot}
            data-future-messaging-slot
            aria-hidden="true"
          />
          {supportContact ? (
            <details className={styles.technicalHelp}>
              <summary>
                <SupportAgentRoundedIcon aria-hidden="true" />
                Technical help
              </summary>
              <div className={styles.technicalHelpCard}>
                <span>Recording or website issue?</span>
                <strong>Contact {supportContact.name}</strong>
                <p>
                  Technology should never obstruct the recording process. Email,
                  call, or text as soon as something gets in the way.
                </p>
                <a href={`mailto:${supportContact.email}`}>
                  <EmailRoundedIcon aria-hidden="true" />
                  <span>
                    <small>Email</small>
                    {supportContact.email}
                  </span>
                </a>
                <a href={`tel:${supportContact.phone_href}`}>
                  <PhoneRoundedIcon aria-hidden="true" />
                  <span>
                    <small>Call or text</small>
                    {supportContact.phone}
                  </span>
                </a>
              </div>
            </details>
          ) : null}
          {session.permissions?.includes('notifications:read') ? (
            <NotificationBell href="/studio/notifications" />
          ) : null}
        </header>
        <div
          className={`${styles.mainInner} ${
            wide ? styles.mainInnerWide : ''
          }`}
        >
          {children}
        </div>
      </main>
      </div>
    </StudioSessionContext.Provider>
  );
}
