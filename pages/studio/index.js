import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import AccountCircleRoundedIcon from '@mui/icons-material/AccountCircleRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import StudioLayout, {
  useStudioSession,
} from '../../components/StudioLayout';
import { buildMicKitAutomation } from '../../lib/micKitAutomation.mjs';
import {
  buildStudioToday,
  filterStudioTodayActions,
  isViewerMicKitRequestActionable,
} from '../../lib/studioToday.mjs';
import styles from '../../styles/Studio.module.css';

const QUICK_LINKS = [
  {
    href: '/studio/inbox',
    label: 'Team Follow-ups',
    detail: 'Track a blocker, question, or decision',
    icon: InboxRoundedIcon,
    permission: 'intake:read',
  },
  {
    href: '/studio/episodes',
    label: 'My Episodes',
    detail: 'Open your production packages',
    icon: PodcastsRoundedIcon,
    permission: 'episodes:read',
  },
  {
    href: '/studio/resources',
    label: 'Team Guide',
    detail: 'Find recording and delivery help',
    icon: MenuBookRoundedIcon,
    permission: 'resources:read',
  },
  {
    href: '/studio/profile',
    label: 'My Profile',
    detail: 'Update your public bio and photos',
    icon: AccountCircleRoundedIcon,
    permission: 'profile:self:read',
  },
  {
    href: '/studio/mic-kits',
    label: 'Mic Kits',
    detail: 'Request or track a recording kit',
    icon: HeadsetMicRoundedIcon,
    permission: 'mic_kits:read',
  },
  {
    href: '/studio/manage/episodes',
    label: 'Episode Calendar',
    detail: 'Manage the production schedule',
    icon: ScheduleRoundedIcon,
    permission: 'episodes:manage',
  },
  {
    href: '/admin/orders',
    label: 'Orders',
    detail: 'Review fulfillment and shipping',
    icon: Inventory2RoundedIcon,
    permission: 'orders:read',
  },
];

async function fetchStudioData(url) {
  const response = await fetch(url, { credentials: 'same-origin' });
  const data = await response.json();
  if (!response.ok) {
    const error = new Error(data.error || 'Could not load this workspace data.');
    error.code = data.code || '';
    throw error;
  }
  return data;
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function titleDate() {
  return new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
  });
}

function inventoryItemName(item = {}) {
  return (
    [item.productName, item.label].filter(Boolean).join(' · ') ||
    item.name ||
    item.sku ||
    'Inventory item'
  );
}

function inventoryItemStatus(item = {}) {
  if (item.attention_status === 'sold_out' || Number(item.quantity) <= 0) {
    return 'Sold out';
  }
  const quantity = Math.max(0, Number(item.quantity) || 0);
  return `${quantity} ${quantity === 1 ? 'unit' : 'units'} left`;
}

export function TodayWorkspace({
  previewSession = null,
  previewWorkspace = null,
}) {
  const studioSession = useStudioSession();
  const session = previewSession || studioSession;
  const permissions = useMemo(
    () => new Set(session?.permissions || []),
    [session]
  );
  const canManageEpisodes = permissions.has('episodes:manage');
  const canManageMicKits = permissions.has('mic_kits:manage');
  const canManageIntake = permissions.has('intake:manage');
  const canUpdateInventory = permissions.has('inventory:update');
  const canViewOperations =
    permissions.has('orders:read') && permissions.has('inventory:read');
  const [workspace, setWorkspace] = useState(
    previewWorkspace || {
      guide: null,
      episodes: [],
      micKits: null,
      operations: null,
      intake: null,
    }
  );
  const [loading, setLoading] = useState(!previewWorkspace);
  const [error, setError] = useState('');
  const [profileNotConnected, setProfileNotConnected] = useState(false);
  const [inventoryAlertSku, setInventoryAlertSku] = useState('');
  const [inventoryNotice, setInventoryNotice] = useState('');
  const [queueFilter, setQueueFilter] = useState('priority');
  const queuePanelRef = useRef(null);
  const queueHeadingRef = useRef(null);

  useEffect(() => {
    if (previewWorkspace) return undefined;
    if (!session) return undefined;
    let alive = true;

    async function loadWorkspace() {
      setLoading(true);
      setError('');
      setProfileNotConnected(false);

      const requests = {
        guide: fetchStudioData('/api/studio/resources'),
        episodes: fetchStudioData(
          canManageEpisodes
            ? '/api/studio/episodes?scope=all&include_directory=false'
            : '/api/studio/episodes?scope=mine'
        ),
        micKits: fetchStudioData(
          canManageMicKits
            ? '/api/studio/mic-kits?view=admin&automation=false'
            : '/api/studio/mic-kits'
        ),
        ...(permissions.has('intake:read')
          ? {
              intake: fetchStudioData('/api/studio/intake'),
            }
          : {}),
        ...(canViewOperations
          ? {
              operations: fetchStudioData('/api/store/admin/overview'),
            }
          : {}),
      };
      const entries = Object.entries(requests);
      const results = await Promise.allSettled(
        entries.map(([, request]) => request)
      );
      if (!alive) return;

      const next = {
        guide: null,
        episodes: [],
        micKits: null,
        operations: null,
        intake: null,
      };
      const failures = [];

      results.forEach((result, index) => {
        const key = entries[index][0];
        if (result.status === 'fulfilled') {
          if (key === 'guide') next.guide = result.value.guide || null;
          else if (key === 'episodes') {
            next.episodes = result.value.episodes || [];
          } else {
            next[key] = result.value;
          }
          return;
        }

        if (key === 'episodes' && result.reason?.code === 'PROFILE_NOT_CONNECTED') {
          setProfileNotConnected(true);
          return;
        }
        failures.push(result.reason?.message || `Could not load ${key}.`);
      });

      if (canManageMicKits && next.micKits) {
        next.micKits = {
          ...next.micKits,
          automation: buildMicKitAutomation(
            next.micKits.tracker,
            next.episodes
          ),
        };
      }

      setWorkspace(next);
      setError(
        failures.length === entries.length
          ? 'The Team Studio could not load right now. Please refresh and try again.'
          : ''
      );
      setLoading(false);
    }

    loadWorkspace();
    return () => {
      alive = false;
    };
  }, [
    canManageEpisodes,
    canManageMicKits,
    permissions,
    canViewOperations,
    previewWorkspace,
    session,
  ]);

  const today = useMemo(
    () =>
      buildStudioToday({
        episodes: workspace.episodes,
        canManageEpisodes,
        micKitPayload: workspace.micKits,
        canManageMicKits,
        operations: workspace.operations,
        intakePayload: workspace.intake,
        canManageIntake,
        viewerPersonId: workspace.intake?.viewer_person_id || '',
      }),
    [
      canManageEpisodes,
      canManageIntake,
      canManageMicKits,
      workspace.episodes,
      workspace.intake,
      workspace.micKits,
      workspace.operations,
    ]
  );
  const visibleActions = useMemo(
    () =>
      filterStudioTodayActions(
        today.all_actions || today.actions,
        queueFilter,
        { today: today.date }
      ),
    [queueFilter, today]
  );
  const quickLinks = QUICK_LINKS.filter((link) => {
    if (link.permission) return permissions.has(link.permission);
    return link.anyPermission?.some((permission) =>
      permissions.has(permission)
    );
  });
  const firstName = String(
    session?.display_name || session?.username || 'team'
  )
    .trim()
    .split(/[\s@]/)[0];
  const micKitMetric = canManageMicKits
    ? Number(workspace.micKits?.automation?.metrics?.open_requests) || 0
    : (workspace.micKits?.tracker?.requests || []).filter(
        isViewerMicKitRequestActionable
      ).length;
  const operationsAttention = workspace.operations
    ? (Number(workspace.operations.orders?.unshipped) || 0) +
      (Number(workspace.operations.inventory?.low_stock) || 0) +
      (Number(workspace.operations.inventory?.sold_out) || 0)
    : null;
  const mutedInventoryRows =
    workspace.operations?.inventory?.muted_rows || [];
  const activeEpisodesHref = canManageEpisodes
    ? '/studio/manage/episodes#production-queue'
    : '/studio/episodes#my-episodes';
  const queueLabel =
    queueFilter === 'all'
      ? 'All next actions'
      : queueFilter === 'due_this_week'
        ? 'Due this week'
        : queueFilter === 'operations'
          ? 'Operations attention'
          : 'Priority queue';

  function showQueue(filter) {
    setQueueFilter(filter);
    window.requestAnimationFrame(() => {
      const reduceMotion = window.matchMedia?.(
        '(prefers-reduced-motion: reduce)'
      ).matches;
      queuePanelRef.current?.scrollIntoView({
        behavior: reduceMotion ? 'auto' : 'smooth',
        block: 'start',
      });
      queueHeadingRef.current?.focus({ preventScroll: true });
    });
  }

  async function updateInventoryAlert(item, muted) {
    if (!canUpdateInventory || inventoryAlertSku) return;

    setInventoryAlertSku(item.sku);
    setInventoryNotice('');
    setError('');
    let alertUpdated = false;

    try {
      const response = await fetch('/api/store/admin/update-stock', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'attention_mute',
          sku: item.sku,
          muted,
          expected_updated_at: item.updated_at || '',
        }),
      });
      const data = await response.json();
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'Could not update this inventory alert.');
      }
      alertUpdated = true;

      const operations = await fetchStudioData('/api/store/admin/overview');
      setWorkspace((current) => ({ ...current, operations }));
      setInventoryNotice(
        muted
          ? `${inventoryItemName(item)} is muted until its stock changes.`
          : `${inventoryItemName(item)} is back in the priority queue.`
      );
    } catch (err) {
      setError(
        alertUpdated
          ? 'The alert was updated, but the priority queue could not refresh. Reload the page to see the change.'
          : err.message || 'Could not update this inventory alert.'
      );
    } finally {
      setInventoryAlertSku('');
    }
  }

  return (
    <>
      <section className={styles.todayHeader}>
        <div className={styles.todayHeaderCopy}>
          <span className={styles.eyebrow}>{titleDate()}</span>
          <h1>Today, {firstName}</h1>
          <p>
            {canManageEpisodes
              ? 'The most important production and operations follow-ups are gathered here in priority order.'
              : 'Your episode work, mic-kit status, and fastest paths into the team workspace are gathered here.'}
          </p>
        </div>
        <div className={styles.todayMetrics} aria-label="Today summary">
          <button
            type="button"
            className={`${styles.todayMetric} ${styles.todayMetricInteractive}`}
            onClick={() => showQueue('all')}
            aria-pressed={queueFilter === 'all'}
            disabled={loading}
          >
            <span>Next actions</span>
            <strong>{loading ? '—' : today.metrics.action_count}</strong>
          </button>
          <Link
            href={activeEpisodesHref}
            className={`${styles.todayMetric} ${styles.todayMetricInteractive}`}
            aria-label={`Open ${today.metrics.active_episodes} active episodes`}
          >
            <span>Active episodes</span>
            <strong>{loading ? '—' : today.metrics.active_episodes}</strong>
          </Link>
          <button
            type="button"
            className={`${styles.todayMetric} ${styles.todayMetricInteractive}`}
            onClick={() => showQueue('due_this_week')}
            aria-pressed={queueFilter === 'due_this_week'}
            disabled={loading}
          >
            <span>Due this week</span>
            <strong>{loading ? '—' : today.metrics.due_this_week}</strong>
          </button>
          {operationsAttention === null ? (
            <Link
              href="/studio/mic-kits#request-queue"
              className={`${styles.todayMetric} ${styles.todayMetricInteractive} ${
                today.metrics.off_track ? styles.todayMetricAlert : ''
              }`}
              aria-label={`Open ${micKitMetric} mic-kit requests`}
            >
              <span>Mic-kit requests</span>
              <strong>{loading ? '—' : micKitMetric}</strong>
            </Link>
          ) : (
            <button
              type="button"
              className={`${styles.todayMetric} ${styles.todayMetricInteractive} ${
                today.metrics.off_track ? styles.todayMetricAlert : ''
              }`}
              onClick={() => showQueue('operations')}
              aria-pressed={queueFilter === 'operations'}
              disabled={loading}
            >
              <span>Ops attention</span>
              <strong>{loading ? '—' : operationsAttention}</strong>
            </button>
          )}
        </div>
      </section>

      {workspace.guide?.announcement?.enabled ? (
        <section className={styles.announcement}>
          <span className={styles.announcementIcon}>
            <CampaignRoundedIcon aria-hidden="true" />
          </span>
          <div>
            <h2>{workspace.guide.announcement.title}</h2>
            <p>{workspace.guide.announcement.body}</p>
          </div>
        </section>
      ) : null}

      {error ? (
        <p className={styles.todayError} role="status">
          {error}
        </p>
      ) : null}
      {inventoryNotice ? (
        <p className={styles.todayNotice} role="status">
          {inventoryNotice}
        </p>
      ) : null}

      <div className={styles.todayLayout}>
        <section
          ref={queuePanelRef}
          id="priority-queue"
          className={styles.todayPanel}
        >
          <header className={styles.todayPanelHeader}>
            <div>
              <span>{queueLabel}</span>
              <h2 ref={queueHeadingRef} tabIndex={-1}>
                What needs attention
              </h2>
            </div>
            {!loading ? (
              <strong>
                {visibleActions.length
                  ? queueFilter === 'priority' &&
                    visibleActions.length < today.metrics.action_count
                    ? `${visibleActions.length} of ${today.metrics.action_count}`
                    : `${visibleActions.length} showing`
                  : 'Clear'}
              </strong>
            ) : null}
          </header>

          {loading ? (
            <div className={styles.todayLoading}>
              <span />
              <span />
              <span />
            </div>
          ) : profileNotConnected ? (
            <div className={styles.todayEmpty}>
              <AccountCircleRoundedIcon aria-hidden="true" />
              <div>
                <h3>Connect this login to a team profile</h3>
                <p>
                  A Studio manager needs to make the one-time connection before
                  personal episode work can appear here.
                </p>
              </div>
              {permissions.has('studio_access:manage') ? (
                <Link href="/studio/manage/access">Open Team Access</Link>
              ) : null}
            </div>
          ) : visibleActions.length ? (
            <div className={styles.todayActionList}>
              {visibleActions.map((action) => {
                const actionClassName = `${styles.todayAction} ${
                  action.urgency === 'urgent'
                    ? styles.todayActionUrgent
                    : action.urgency === 'high'
                      ? styles.todayActionHigh
                      : ''
                }`;

                if (action.id === 'operations:inventory') {
                  return (
                    <article
                      key={action.id}
                      className={`${actionClassName} ${styles.todayInventoryAction}`}
                    >
                      <span
                        className={styles.todayActionStatus}
                        aria-hidden="true"
                      />
                      <div className={styles.todayActionCopy}>
                        <strong>{action.title}</strong>
                        <small>{action.detail}</small>
                        <span className={styles.todayActionMeta}>
                          <em>{action.badge}</em>
                        </span>
                        {canUpdateInventory &&
                        (action.inventory_items || []).length ? (
                          <details className={styles.todayInventoryManager}>
                            <summary>Manage individual alerts</summary>
                            <div className={styles.todayInventoryItems}>
                              {action.inventory_items.map((item) => (
                                <div
                                  className={styles.todayInventoryItem}
                                  key={item.sku}
                                >
                                  <span>
                                    <strong>{inventoryItemName(item)}</strong>
                                    <small>
                                      {inventoryItemStatus(item)} · {item.sku}
                                    </small>
                                  </span>
                                  {!item.missing_inventory_row ? (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateInventoryAlert(item, true)
                                      }
                                      disabled={Boolean(inventoryAlertSku)}
                                    >
                                      {inventoryAlertSku === item.sku
                                        ? 'Muting…'
                                        : 'Mute alert'}
                                    </button>
                                  ) : null}
                                </div>
                              ))}
                            </div>
                          </details>
                        ) : null}
                      </div>
                      <Link
                        href={action.href}
                        className={styles.todayInventoryReview}
                      >
                        Review stock
                        <ArrowForwardRoundedIcon aria-hidden="true" />
                      </Link>
                    </article>
                  );
                }

                return (
                  <Link
                    key={action.id}
                    href={action.href}
                    className={actionClassName}
                  >
                    <span
                      className={styles.todayActionStatus}
                      aria-hidden="true"
                    />
                    <span className={styles.todayActionCopy}>
                      <strong>{action.title}</strong>
                      <small>{action.detail}</small>
                      <span className={styles.todayActionMeta}>
                        <em>{action.badge}</em>
                        {action.date ? (
                          <time dateTime={action.date}>
                            {formatDate(action.date)}
                          </time>
                        ) : null}
                      </span>
                    </span>
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          ) : (
            <div className={styles.todayEmpty}>
              <CheckCircleRoundedIcon aria-hidden="true" />
              <div>
                <h3>
                  {queueFilter === 'due_this_week'
                    ? 'Nothing is due this week'
                    : queueFilter === 'operations'
                      ? 'Operations are clear'
                      : 'You are caught up'}
                </h3>
                <p>
                  {queueFilter === 'due_this_week'
                    ? 'There are no dated actions in the next seven days.'
                    : queueFilter === 'operations'
                      ? 'There are no order or inventory follow-ups in your queue right now.'
                      : 'There are no episode, mic-kit, operations, or team follow-ups in your queue right now.'}
                </p>
              </div>
            </div>
          )}
          {!loading && mutedInventoryRows.length ? (
            <details className={styles.todayMutedAlerts}>
              <summary>
                <span>Muted inventory alerts</span>
                <strong>{mutedInventoryRows.length}</strong>
              </summary>
              <p>
                These stay out of the priority count until their stock changes.
              </p>
              <div>
                {mutedInventoryRows.map((item) => (
                  <div className={styles.todayMutedAlert} key={item.sku}>
                    <span>
                      <strong>{inventoryItemName(item)}</strong>
                      <small>
                        {inventoryItemStatus(item)} · {item.sku}
                      </small>
                    </span>
                    {canUpdateInventory ? (
                      <button
                        type="button"
                        onClick={() => updateInventoryAlert(item, false)}
                        disabled={Boolean(inventoryAlertSku)}
                      >
                        {inventoryAlertSku === item.sku
                          ? 'Restoring…'
                          : 'Restore alert'}
                      </button>
                    ) : null}
                  </div>
                ))}
              </div>
            </details>
          ) : null}
        </section>

        <aside className={styles.todaySideStack}>
          <section className={styles.todayPanel}>
            <header className={styles.todayPanelHeader}>
              <div>
                <span>Jump back in</span>
                <h2>Quick paths</h2>
              </div>
            </header>
            <div className={styles.todayQuickLinks}>
              {quickLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={styles.todayQuickLink}
                  >
                    <Icon aria-hidden="true" />
                    <span>
                      <strong>{link.label}</strong>
                      <small>{link.detail}</small>
                    </span>
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </Link>
                );
              })}
            </div>
          </section>

          <Link href="/studio/resources" className={styles.todayGuideCard}>
            <span>Team field guide</span>
            <strong>
              {workspace.guide?.title || 'Recording, handoff, and season help'}
            </strong>
            <small>
              {workspace.guide?.sections?.length || 0} published sections
            </small>
            <ArrowForwardRoundedIcon aria-hidden="true" />
          </Link>
        </aside>
      </div>
    </>
  );
}

export default function StudioHomePage() {
  return (
    <StudioLayout requiredPermission="studio:read">
      <TodayWorkspace />
    </StudioLayout>
  );
}
