// components/AdminLayout.js
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import ReceiptLongRoundedIcon from '@mui/icons-material/ReceiptLongRounded';
import ArticleRoundedIcon from '@mui/icons-material/ArticleRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HandshakeRoundedIcon from '@mui/icons-material/HandshakeRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import LogoutRoundedIcon from '@mui/icons-material/LogoutRounded';
import styles from '../styles/AdminLayout.module.css';

function formatRole(role) {
  if (!role) return 'Checking access';
  return String(role)
    .split(/[_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

const NAV_ITEMS = [
  { href: '/admin', label: 'Overview', icon: DashboardRoundedIcon },
  { href: '/admin/inventory', label: 'Inventory', icon: Inventory2RoundedIcon },
  { href: '/admin/orders', label: 'Orders', icon: ReceiptLongRoundedIcon },
  { href: '/admin/site-content', label: 'Site Content', icon: ArticleRoundedIcon },
  { href: '/admin/people', label: 'Hosts & Team', icon: GroupsRoundedIcon },
  { href: '/admin/sponsors', label: 'Sponsors', icon: HandshakeRoundedIcon },
];

export default function AdminLayout({
  children,
  hasUnsavedChanges = false,
  unsavedChangesMessage = 'You have unsaved changes. Leave this page and discard them?',
}) {
  const [session, setSession] = useState(null);
  const router = useRouter();

  useEffect(() => {
    let alive = true;

    async function loadSession() {
      try {
        const res = await fetch('/api/store/admin/session', {
          credentials: 'same-origin',
        });
        const data = await res.json();
        if (alive && res.ok) setSession(data.user || null);
      } catch {
        if (alive) setSession(null);
      }
    }

    loadSession();

    return () => {
      alive = false;
    };
  }, []);

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

        <nav className={styles.nav} aria-label="Admin navigation">
          <span className={styles.navLabel}>Workspace</span>
          <ul className={styles.navList}>
            {NAV_ITEMS.map((item) => {
              const isActive =
                item.href === '/admin'
                  ? router.pathname === item.href
                  : router.pathname.startsWith(item.href);
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
            })}
          </ul>
        </nav>

        <div className={styles.sidebarFooter}>
          <div className={styles.account}>
            <span className={styles.accountRole}>{formatRole(session?.role)}</span>
            <span className={styles.accountName}>
              {session?.username || 'Secure admin session'}
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
