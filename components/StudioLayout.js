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
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import CategoryRoundedIcon from '@mui/icons-material/CategoryRounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import HealthAndSafetyRoundedIcon from '@mui/icons-material/HealthAndSafetyRounded';
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import EmailRoundedIcon from '@mui/icons-material/EmailRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import SmsRoundedIcon from '@mui/icons-material/SmsRounded';
import SupportAgentRoundedIcon from '@mui/icons-material/SupportAgentRounded';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import NotificationBell from './NotificationBell';
import {
  getVisibleStudioNavigationItems,
  isStudioNavigationItemActive,
  STUDIO_NAV_DISCLOSURES,
  STUDIO_NAV_SECTIONS,
} from '../lib/studioNavigation.mjs';
import styles from '../styles/Studio.module.css';

const NAV_ICONS = {
  home: HomeRoundedIcon,
  resources: MenuBookRoundedIcon,
  inbox: InboxRoundedIcon,
  mastermind: ViewKanbanRoundedIcon,
  questionnaires: QuizRoundedIcon,
  episodes: PodcastsRoundedIcon,
  production: ChecklistRoundedIcon,
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
  access_log: HistoryRoundedIcon,
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
  previewSession = null,
  previewSupportContact = null,
  previewPath = '',
  previewHrefMap = null,
}) {
  const router = useRouter();
  const preview = previewSession !== null;
  const [session, setSession] = useState(previewSession);
  const [supportContact, setSupportContact] = useState(previewSupportContact);
  const [sessionState, setSessionState] = useState(
    preview ? 'ready' : 'loading'
  );
  const [expandedNavGroups, setExpandedNavGroups] = useState({});

  useEffect(() => {
    if (preview) return undefined;
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
  }, [
    accessDeniedRedirect,
    preview,
    previewSession,
    previewSupportContact,
    requiredPermission,
    router,
  ]);

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

  useEffect(() => {
    if (preview || sessionState !== 'ready') return undefined;

    async function heartbeat() {
      if (document.visibilityState !== 'visible') return;
      try {
        await fetch('/api/studio/session', {
          method: 'POST',
          credentials: 'same-origin',
        });
      } catch {
        // A missed heartbeat must not interrupt work in the Studio.
      }
    }

    const interval = window.setInterval(heartbeat, 5 * 60 * 1000);
    document.addEventListener('visibilitychange', heartbeat);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener('visibilitychange', heartbeat);
    };
  }, [preview, sessionState]);

  const navItems = useMemo(() => {
    return getVisibleStudioNavigationItems(
      session?.permissions,
      session?.features,
      session?.capabilities
    );
  }, [session]);
  const logicalStudioHomeHref = session?.permissions?.includes('studio:read')
    ? '/studio'
    : '/studio/mic-kits';
  const studioHomeHref =
    previewHrefMap?.[logicalStudioHomeHref] || logicalStudioHomeHref;
  const currentPath = previewPath || router.pathname;
  const overviewNavItems = navItems.filter(
    (item) => item.section === 'overview'
  );
  const primaryWorkNavItems = navItems.filter(
    (item) => item.section === 'work' && !item.disclosure
  );
  const teamToolNavItems = navItems.filter(
    (item) => item.disclosure === 'team_tools'
  );
  const planningAdminNavItems = navItems.filter(
    (item) => item.disclosure === 'planning_admin'
  );
  const teamToolsActive = teamToolNavItems.some((item) =>
    isStudioNavigationItemActive(item, currentPath)
  );
  const planningAdminActive = planningAdminNavItems.some((item) =>
    isStudioNavigationItemActive(item, currentPath)
  );

  function hrefFor(href) {
    return previewHrefMap?.[href] || href;
  }

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

  function handleNavDisclosureToggle(group, event) {
    const open = event.currentTarget.open;
    setExpandedNavGroups((current) =>
      current[group] === open ? current : { ...current, [group]: open }
    );
  }

  function renderNavigationLink(item, { nested = false } = {}) {
    const active = isStudioNavigationItemActive(item, currentPath);
    const Icon = NAV_ICONS[item.icon] || HomeRoundedIcon;
    const href = hrefFor(item.href);

    return (
      <Link
        href={href}
        key={item.href}
        className={`${styles.navLink} ${
          nested ? styles.navLinkNested : ''
        } ${active ? styles.navLinkActive : ''}`}
        aria-current={active ? 'page' : undefined}
        onClick={(event) => confirmNavigation(event, href)}
      >
        <Icon aria-hidden="true" />
        <span>{item.label}</span>
      </Link>
    );
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
          {overviewNavItems.length ? (
            <div className={styles.navOverview}>
              {overviewNavItems.map((item) => renderNavigationLink(item))}
            </div>
          ) : null}

          {primaryWorkNavItems.length || teamToolNavItems.length ? (
            <div
              className={styles.navSection}
              role="group"
              aria-labelledby="studio-navigation-work"
            >
              <span className={styles.navLabel} id="studio-navigation-work">
                {STUDIO_NAV_SECTIONS.work}
              </span>
              <div className={styles.navPrimaryLinks}>
                {primaryWorkNavItems.map((item) =>
                  renderNavigationLink(item)
                )}
              </div>
              {teamToolNavItems.length ? (
                <details
                  className={styles.navDisclosure}
                  open={
                    expandedNavGroups.team_tools ?? teamToolsActive
                  }
                  onToggle={(event) =>
                    handleNavDisclosureToggle('team_tools', event)
                  }
                >
                  <summary>
                    <span className={styles.navDisclosureTitle}>
                      <MenuBookRoundedIcon aria-hidden="true" />
                      {STUDIO_NAV_DISCLOSURES.team_tools}
                    </span>
                    <small>{teamToolNavItems.length} links</small>
                    <ExpandMoreRoundedIcon
                      className={styles.navDisclosureChevron}
                      aria-hidden="true"
                    />
                  </summary>
                  <div className={styles.navDisclosureLinks}>
                    {teamToolNavItems.map((item) =>
                      renderNavigationLink(item, { nested: true })
                    )}
                  </div>
                </details>
              ) : null}
            </div>
          ) : null}

          {planningAdminNavItems.length ? (
            <details
              className={`${styles.navDisclosure} ${styles.navPlanning}`}
              open={
                expandedNavGroups.planning_admin ?? planningAdminActive
              }
              onToggle={(event) =>
                handleNavDisclosureToggle('planning_admin', event)
              }
            >
              <summary>
                <span className={styles.navDisclosureTitle}>
                  <DashboardRoundedIcon aria-hidden="true" />
                  {STUDIO_NAV_DISCLOSURES.planning_admin}
                </span>
                <small>{planningAdminNavItems.length} links</small>
                <ExpandMoreRoundedIcon
                  className={styles.navDisclosureChevron}
                  aria-hidden="true"
                />
              </summary>
              <div className={styles.navDisclosureLinks}>
                {planningAdminNavItems.map((item) =>
                  renderNavigationLink(item, { nested: true })
                )}
              </div>
            </details>
          ) : null}
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <strong>
              {preview
                ? 'Local UI preview'
                : (session.groups || []).map(formatGroup).join(' + ')}
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
            {!preview ? (
              <form action="/api/store/admin/auth/logout" method="post">
                <button type="submit" className={styles.signOutButton}>
                  <LogoutRoundedIcon aria-hidden="true" />
                  Sign out
                </button>
              </form>
            ) : null}
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
          {preview ? (
            <span className={styles.previewBadge}>Local sample · no live data</span>
          ) : null}
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
                  Start in the WhatsApp group so the answer can help everyone.
                  For a private or urgent issue, use the direct support contact.
                </p>
                <div className={styles.technicalHelpOption}>
                  <WhatsAppIcon aria-hidden="true" />
                  <span>
                    <small>Start here</small>
                    Seek technical help in the team WhatsApp chat
                  </span>
                </div>
                <a href={`mailto:${supportContact.email}`}>
                  <EmailRoundedIcon aria-hidden="true" />
                  <span>
                    <small>Email</small>
                    {supportContact.email}
                  </span>
                </a>
                <a href={`sms:${supportContact.phone_href}`}>
                  <SmsRoundedIcon aria-hidden="true" />
                  <span>
                    <small>Private text support</small>
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
