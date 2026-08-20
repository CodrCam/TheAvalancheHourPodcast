import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import BlockRoundedIcon from '@mui/icons-material/BlockRounded';
import ChatBubbleOutlineRoundedIcon from '@mui/icons-material/ChatBubbleOutlineRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import InboxRoundedIcon from '@mui/icons-material/InboxRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PlainTextArea from '../../components/PlainTextArea';
import StudioLayout from '../../components/StudioLayout';
import { isEpisodeRequestItem } from '../../lib/episodeRequest.mjs';
import {
  STUDIO_INTAKE_KIND_LABELS,
  STUDIO_INTAKE_STATUS_LABELS,
  selectVisibleStudioIntakeItem,
  summarizeStudioIntake,
} from '../../lib/studioIntakePresentation.mjs';
import styles from '../../styles/Studio.module.css';

const EMPTY_ITEM = {
  kind: 'request',
  title: '',
  details: '',
  priority: 'normal',
};

const EMPTY_MASTERMIND_REVIEW = {
  season_id: '',
  working_title: '',
  premise: '',
  listener_takeaway: '',
  episode_type: 'regular',
  target_air_date: '',
  owner_person_id: '',
};

const KIND_COPY = {
  blocker: 'Something is stopping the work',
  request: 'I need help or a team decision',
  idea: 'A useful improvement to consider',
  question: 'I need an answer or clarification',
};

const KIND_ICONS = {
  blocker: BlockRoundedIcon,
  request: AssignmentTurnedInRoundedIcon,
  idea: LightbulbOutlinedIcon,
  question: HelpOutlineRoundedIcon,
};

export function buildMastermindReviewPrefill(
  item = {},
  { seasonId = '', hosts = [] } = {}
) {
  const request =
    item?.episode_request && typeof item.episode_request === 'object'
      ? item.episode_request
      : {};
  const legacyTitle = String(item?.title || '').replace(
    /^Episode request:\s*/i,
    ''
  );
  const creatorId = String(
    request.owner_person_id || item?.created_by_person_id || ''
  );
  const ownerAvailable = (Array.isArray(hosts) ? hosts : []).some(
    (host) => String(host?.person_id || '') === creatorId
  );
  return {
    ...EMPTY_MASTERMIND_REVIEW,
    season_id: seasonId,
    working_title: String(request.working_title || legacyTitle).slice(0, 180),
    premise: String(request.premise || '').slice(0, 6000),
    listener_takeaway: String(request.listener_takeaway || '').slice(0, 2400),
    target_air_date: String(request.preferred_air_date || ''),
    owner_person_id: ownerAvailable ? creatorId : '',
  };
}

function formatDateTime(value) {
  const date = new Date(value || '');
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function InboxFrame({ preview, children }) {
  if (preview) return children;
  return (
    <StudioLayout requiredPermission="intake:read" wide>
      {children}
    </StudioLayout>
  );
}

export default function StudioInboxPage({ previewData = null }) {
  const router = useRouter();
  const [items, setItems] = useState(previewData?.items || []);
  const [assignees, setAssignees] = useState(previewData?.assignees || []);
  const [canManage, setCanManage] = useState(
    previewData?.canManage === true
  );
  const [canStartMastermind, setCanStartMastermind] = useState(
    previewData?.canStartMastermind === true
  );
  const [configured, setConfigured] = useState(
    previewData?.configured !== false
  );
  const [viewerPersonId, setViewerPersonId] = useState(
    previewData?.viewer_person_id || ''
  );
  const [selectedId, setSelectedId] = useState(
    previewData?.items?.[0]?.item_id || ''
  );
  const [showCreate, setShowCreate] = useState(
    previewData?.showCreate === true
  );
  const [form, setForm] = useState(EMPTY_ITEM);
  const [statusFilter, setStatusFilter] = useState('open');
  const [kindFilter, setKindFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [managerDrafts, setManagerDrafts] = useState({});
  const [managerNote, setManagerNote] = useState('');
  const [comment, setComment] = useState('');
  const [mastermindReviewOpen, setMastermindReviewOpen] = useState(false);
  const [mastermindSourceId, setMastermindSourceId] = useState('');
  const [mastermindReview, setMastermindReview] = useState(
    EMPTY_MASTERMIND_REVIEW
  );
  const [mastermindSeasons, setMastermindSeasons] = useState([]);
  const [mastermindHosts, setMastermindHosts] = useState([]);
  const [mastermindLoading, setMastermindLoading] = useState(false);
  const [mastermindSaving, setMastermindSaving] = useState(false);
  const [mastermindError, setMastermindError] = useState('');
  const [mastermindOutcome, setMastermindOutcome] = useState(null);
  const [loading, setLoading] = useState(!previewData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');

  useEffect(() => {
    if (previewData) return undefined;
    let alive = true;
    async function loadItems() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch('/api/studio/intake', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not open team follow-ups.');
        }
        if (!alive) return;
        const nextItems = data.items || [];
        setItems(nextItems);
        setAssignees(data.assignees || []);
        setCanManage(data.canManage === true);
        setCanStartMastermind(data.canStartMastermind === true);
        setConfigured(data.configured !== false);
        setViewerPersonId(data.viewer_person_id || '');
        const requestedId = new URLSearchParams(window.location.search).get(
          'item'
        );
        setSelectedId((current) => {
          const preferred = requestedId || current;
          return nextItems.some((item) => item.item_id === preferred)
            ? preferred
            : nextItems[0]?.item_id || '';
        });
      } catch (loadError) {
        if (alive) {
          setError(loadError.message || 'Could not open team follow-ups.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }
    if (router.isReady) loadItems();
    return () => {
      alive = false;
    };
  }, [previewData, router.isReady]);

  const summary = useMemo(() => summarizeStudioIntake(items), [items]);
  const filteredItems = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return items.filter((item) => {
      if (statusFilter === 'open' && item.status === 'resolved') return false;
      if (statusFilter === 'resolved' && item.status !== 'resolved') {
        return false;
      }
      if (kindFilter !== 'all' && item.kind !== kindFilter) return false;
      return (
        !needle ||
        [item.title, item.details, item.created_by_name, item.assigned_to_name]
          .join(' ')
          .toLowerCase()
          .includes(needle)
      );
    });
  }, [items, kindFilter, query, statusFilter]);
  const selected = selectVisibleStudioIntakeItem(
    filteredItems,
    selectedId
  );
  const mastermindReviewMatchesSelected = Boolean(
    selected && mastermindSourceId === selected.item_id
  );
  const managerDraft = selected
    ? managerDrafts[selected.item_id] || {
        status: selected.status,
        priority: selected.priority,
        target_date: selected.target_date || '',
        assigned_to_person_id: selected.assigned_to_person_id || '',
      }
    : {};
  function updateManagerDraft(patch) {
    if (!selected) return;
    setManagerDrafts((current) => ({
      ...current,
      [selected.item_id]: {
        ...managerDraft,
        ...patch,
      },
    }));
  }

  function replaceItem(nextItem) {
    setItems((current) =>
      current.map((item) =>
        item.item_id === nextItem.item_id ? nextItem : item
      )
    );
  }

  function selectItem(itemId) {
    setSelectedId(itemId);
    setShowCreate(false);
    setManagerNote('');
    setComment('');
    setMessage('');
    setError('');
    closeMastermindReview();
    if (!previewData) {
      router.replace(
        { pathname: '/studio/inbox', query: { item: itemId } },
        undefined,
        { shallow: true }
      );
    }
  }

  function openCreateForm() {
    setShowCreate(true);
    window.requestAnimationFrame(() =>
      document
        .getElementById('follow-up-detail')
        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    );
  }

  async function createItem(event) {
    event.preventDefault();
    if (saving) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/intake', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not create this follow-up.');
      }
      setItems((current) => [data.item, ...current]);
      setForm(EMPTY_ITEM);
      setShowCreate(false);
      setSelectedId(data.item.item_id);
      setMessage('Follow-up created. It will stay visible until it is resolved.');
      router.replace(
        { pathname: '/studio/inbox', query: { item: data.item.item_id } },
        undefined,
        { shallow: true }
      );
    } catch (createError) {
      setError(createError.message || 'Could not create this follow-up.');
    } finally {
      setSaving(false);
    }
  }

  async function postComment(event) {
    event.preventDefault();
    if (!selected || saving || comment.trim().length < 2) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/intake', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'comment',
          item_id: selected.item_id,
          body: comment,
          expected_updated_at: selected.updated_at,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not post this update.');
      }
      replaceItem(data.item);
      setComment('');
      setMessage('Update posted.');
    } catch (commentError) {
      setError(commentError.message || 'Could not post this update.');
    } finally {
      setSaving(false);
    }
  }

  async function persistTriage() {
    if (!selected || saving || !canManage) return false;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch('/api/studio/intake', {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update',
          item_id: selected.item_id,
          item: managerDraft,
          note: managerNote,
          expected_updated_at: selected.updated_at,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not save this triage update.');
      }
      replaceItem(data.item);
      setManagerDrafts((current) => {
        const next = { ...current };
        delete next[data.item.item_id];
        return next;
      });
      setManagerNote('');
      setMessage('Triage update saved.');
      return true;
    } catch (triageError) {
      setError(triageError.message || 'Could not save this triage update.');
      return false;
    } finally {
      setSaving(false);
    }
  }

  async function saveTriage(event) {
    event.preventDefault();
    await persistTriage();
  }

  function closeMastermindReview() {
    setMastermindReviewOpen(false);
    setMastermindSourceId('');
    setMastermindReview(buildMastermindReviewPrefill(selected));
    setMastermindSeasons([]);
    setMastermindHosts([]);
    setMastermindLoading(false);
    setMastermindSaving(false);
    setMastermindError('');
    setMastermindOutcome(null);
  }

  async function openMastermindReview() {
    if (
      !selected ||
      !isEpisodeRequestItem(selected) ||
      !canManage ||
      !canStartMastermind ||
      mastermindLoading
    ) {
      return;
    }
    setMastermindReviewOpen(true);
    setMastermindSourceId(selected.item_id);
    setMastermindReview(EMPTY_MASTERMIND_REVIEW);
    setMastermindSeasons([]);
    setMastermindHosts([]);
    setMastermindError('');
    setMastermindOutcome(null);
    if (previewData) {
      const seasons = Array.isArray(previewData.mastermindSeasons)
        ? previewData.mastermindSeasons
        : [];
      const hosts = Array.isArray(previewData.mastermindHosts)
        ? previewData.mastermindHosts
        : [];
      setMastermindSeasons(seasons);
      setMastermindHosts(hosts);
      setMastermindReview(
        buildMastermindReviewPrefill(selected, {
          seasonId: seasons[0]?.season_id || '',
          hosts,
        })
      );
      if (!seasons.length) {
        setMastermindError(
          'Create or restore an active planning season before reviewing this request.'
        );
      }
      return;
    }

    setMastermindLoading(true);
    try {
      const response = await fetch('/api/studio/mastermind', {
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(
          data.error || 'Could not open the Season Mastermind review.'
        );
      }
      const seasons = (Array.isArray(data.seasons) ? data.seasons : [])
        .filter((season) => season?.season_id && season?.label)
        .map((season) => ({
          season_id: String(season.season_id),
          label: String(season.label),
          status: String(season.status || ''),
        }));
      const hosts = (
        Array.isArray(data.directory?.hosts) ? data.directory.hosts : []
      )
        .map((host) => ({
          person_id: String(host.person_id || host.host_person_id || ''),
          name: String(host.name || host.host_display_name || ''),
        }))
        .filter((host) => host.person_id && host.name);
      const currentSeason =
        seasons.find((season) => season.label === 'Season 11') ||
        seasons.find((season) =>
          ['active', 'planning'].includes(season.status)
        ) ||
        seasons[0];
      setMastermindSeasons(seasons);
      setMastermindHosts(hosts);
      setMastermindReview(
        buildMastermindReviewPrefill(selected, {
          seasonId: currentSeason?.season_id || '',
          hosts,
        })
      );
      if (!currentSeason) {
        setMastermindError(
          'Create or restore an active planning season before reviewing this request.'
        );
      }
    } catch (reviewError) {
      setMastermindError(
        reviewError.message || 'Could not open the Season Mastermind review.'
      );
    } finally {
      setMastermindLoading(false);
    }
  }

  async function submitMastermindReview(event) {
    event.preventDefault();
    if (
      !selected ||
      !isEpisodeRequestItem(selected) ||
      !canManage ||
      !canStartMastermind ||
      mastermindSaving ||
      mastermindOutcome ||
      !mastermindReviewMatchesSelected
    ) {
      return;
    }
    setMastermindSaving(true);
    setMastermindError('');
    try {
      if (previewData) {
        setMastermindOutcome({
          created: true,
          plan: {
            episode_plan_id: 'preview-reviewed-request',
            ...mastermindReview,
          },
        });
        return;
      }
      const response = await fetch(
        '/api/studio/mastermind/handoffs/intake',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            item_id: selected.item_id,
            plan: {
              season_id: mastermindReview.season_id,
              working_title: mastermindReview.working_title,
              premise: mastermindReview.premise,
              listener_takeaway: mastermindReview.listener_takeaway,
              episode_type: mastermindReview.episode_type,
              target_air_date: mastermindReview.target_air_date,
              owner_person_id: mastermindReview.owner_person_id,
              host_person_ids: mastermindReview.owner_person_id
                ? [mastermindReview.owner_person_id]
                : [],
            },
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        if (
          response.status === 409 &&
          /plan_conflict|soft_link_conflict/i.test(String(data.code || ''))
        ) {
          throw new Error(
            'This request already has a research plan with different reviewed fields. Open Season Mastermind to review the existing plan; this request was not changed.'
          );
        }
        throw new Error(
          data.error || 'Could not create the reviewed research plan.'
        );
      }
      setMastermindOutcome({
        created: data.created === true,
        plan: data.plan || null,
      });
    } catch (reviewError) {
      setMastermindError(
        reviewError.message || 'Could not create the reviewed research plan.'
      );
    } finally {
      setMastermindSaving(false);
    }
  }

  return (
    <InboxFrame preview={Boolean(previewData)}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>Work that needs a next step</span>
          <h1>Team follow-ups</h1>
          <p>
            Episode requests from Host Studio arrive here beside blockers,
            unanswered questions, decisions, and useful ideas. Use the team
            chat for ordinary conversation.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => {
            if (showCreate) {
              setShowCreate(false);
              return;
            }
            openCreateForm();
          }}
        >
          <AddRoundedIcon aria-hidden="true" />
          {showCreate ? 'Cancel new follow-up' : 'Create follow-up'}
        </button>
      </header>

      <section className={styles.intakePurpose}>
        <div>
          <strong>Put it here</strong>
          <span>
            When someone needs to own it, answer it, remember it, or resolve it.
          </span>
        </div>
        <div>
          <strong>Keep it in team chat</strong>
          <span>
            When it is casual conversation or does not need a tracked next step.
          </span>
        </div>
      </section>

      <section className={styles.intakeMetrics} aria-label="Inbox summary">
        <div>
          <span>Open</span>
          <strong>{loading ? '—' : summary.open}</strong>
        </div>
        <div>
          <span>New</span>
          <strong>{loading ? '—' : summary.new}</strong>
        </div>
        <div className={summary.blockers ? styles.intakeMetricAlert : ''}>
          <span>Blockers</span>
          <strong>{loading ? '—' : summary.blockers}</strong>
        </div>
        <div>
          <span>Unassigned</span>
          <strong>{loading ? '—' : summary.unassigned}</strong>
        </div>
      </section>

      {!configured ? (
        <p className={styles.intakeError}>
          Team follow-up storage is not configured yet.
        </p>
      ) : null}

      <section className={styles.intakeToolbar} aria-label="Inbox filters">
        <label>
          Search
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Title, details, or teammate"
          />
        </label>
        <label>
          Status
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="open">Open</option>
            <option value="all">All</option>
            <option value="resolved">Resolved</option>
          </select>
        </label>
        <label>
          Type
          <select
            value={kindFilter}
            onChange={(event) => setKindFilter(event.target.value)}
          >
            <option value="all">All types</option>
            {Object.entries(STUDIO_INTAKE_KIND_LABELS).map(
              ([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              )
            )}
          </select>
        </label>
      </section>

      <div className={styles.intakeLayout}>
        <section className={styles.intakeListPanel}>
          <div className={styles.intakePanelTitle}>
            <span>{filteredItems.length} showing</span>
            <h2>Follow-up queue</h2>
          </div>
          {loading ? (
            <p className={styles.intakeEmpty}>Opening the shared queue…</p>
          ) : filteredItems.length ? (
            <div className={styles.intakeList}>
              {filteredItems.map((item) => {
                const Icon = KIND_ICONS[item.kind] || InboxRoundedIcon;
                return (
                  <button
                    key={item.item_id}
                    type="button"
                    className={`${styles.intakeListItem} ${
                      selectedId === item.item_id
                        ? styles.intakeListItemActive
                        : ''
                    } ${
                      item.kind === 'blocker' && item.status !== 'resolved'
                        ? styles.intakeListItemBlocker
                        : ''
                    }`}
                    onClick={() => selectItem(item.item_id)}
                  >
                    <span className={styles.intakeItemIcon}>
                      <Icon aria-hidden="true" />
                    </span>
                    <span className={styles.intakeListCopy}>
                      <span className={styles.intakeListMeta}>
                        <em>
                          {isEpisodeRequestItem(item)
                            ? 'Episode request'
                            : STUDIO_INTAKE_KIND_LABELS[item.kind]}
                        </em>
                        <small>
                          {STUDIO_INTAKE_STATUS_LABELS[item.status]}
                        </small>
                      </span>
                      <strong>{item.title}</strong>
                      <small>
                        {item.assigned_to_name
                          ? `With ${item.assigned_to_name}`
                          : `From ${item.created_by_name}`}
                      </small>
                    </span>
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </button>
                );
              })}
            </div>
          ) : (
            <div className={styles.intakeEmpty}>
              <InboxRoundedIcon aria-hidden="true" />
              <strong>
                {items.length
                  ? 'No follow-ups match these filters.'
                  : 'The follow-up queue is clear.'}
              </strong>
              <span>
                {items.length
                  ? 'Adjust the search or filters to see another item.'
                  : 'New blockers, questions, and decisions will appear here.'}
              </span>
            </div>
          )}
        </section>

        <section className={styles.intakeDetailPanel} id="follow-up-detail">
          {error ? (
            <p className={styles.intakeError} role="alert">
              {error}
            </p>
          ) : null}
          {message ? (
            <p className={styles.intakeSuccess} role="status">
              {message}
            </p>
          ) : null}
          {showCreate ? (
            <form className={styles.intakeCreateInline} onSubmit={createItem}>
              <div className={styles.intakeSectionHeading}>
                <div>
                  <span className={styles.eyebrow}>New follow-up</span>
                  <h2>What needs a tracked next step?</h2>
                </div>
                <span>Visible to the signed-in team.</span>
              </div>
              <p className={styles.intakeCreateGuidance}>
                You do not need to choose a recipient. This enters the shared
                queue; a manager can assign an owner and target date afterward.
              </p>
              <div className={styles.intakeKindPicker}>
                {Object.keys(KIND_COPY).map((kind) => {
                  const Icon = KIND_ICONS[kind];
                  return (
                    <label
                      key={kind}
                      className={
                        form.kind === kind ? styles.intakeKindActive : ''
                      }
                    >
                      <input
                        type="radio"
                        name="inbox-kind"
                        value={kind}
                        checked={form.kind === kind}
                        onChange={() =>
                          setForm((current) => ({ ...current, kind }))
                        }
                      />
                      <Icon aria-hidden="true" />
                      <span>
                        <strong>{STUDIO_INTAKE_KIND_LABELS[kind]}</strong>
                        <small>{KIND_COPY[kind]}</small>
                      </span>
                    </label>
                  );
                })}
              </div>
              <div className={styles.intakeFormGrid}>
                <label>
                  Short title
                  <small>Name the thing that needs attention.</small>
                  <input
                    value={form.title}
                    maxLength={180}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        title: event.target.value,
                      }))
                    }
                    required
                  />
                </label>
                <label>
                  Starting priority
                  <small>Blockers start high automatically.</small>
                  <select
                    value={form.kind === 'blocker' ? 'high' : form.priority}
                    disabled={form.kind === 'blocker'}
                    onChange={(event) =>
                      setForm((current) => ({
                        ...current,
                        priority: event.target.value,
                      }))
                    }
                  >
                    <option value="normal">Normal</option>
                    <option value="high">High</option>
                  </select>
                </label>
                <label className={styles.intakeFullField}>
                  Context and desired outcome
                  <small>
                    Explain what happened, what has already been tried, and what
                    answer or action would resolve it.
                  </small>
                  <PlainTextArea
                    value={form.details}
                    maxLength={6000}
                    onValueChange={(details) =>
                      setForm((current) => ({ ...current, details }))
                    }
                    required
                  />
                  <small>
                    Line breaks and pasted lists stay as entered—no Markdown
                    needed.
                  </small>
                </label>
              </div>
              <div className={styles.intakeFormActions}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => {
                    setForm(EMPTY_ITEM);
                    setShowCreate(false);
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={styles.primaryButton}
                  disabled={
                    saving ||
                    form.title.trim().length < 3 ||
                    form.details.trim().length < 10
                  }
                >
                  <SendRoundedIcon aria-hidden="true" />
                  {saving ? 'Creating…' : 'Create follow-up'}
                </button>
              </div>
            </form>
          ) : selected ? (
            <>
              <div className={styles.intakeDetailHeader}>
                <div>
                  <span className={styles.intakeDetailBadges}>
                    <em>
                      {isEpisodeRequestItem(selected)
                        ? 'Episode request'
                        : STUDIO_INTAKE_KIND_LABELS[selected.kind]}
                    </em>
                    <em data-priority={selected.priority}>
                      {selected.priority}
                    </em>
                    <em>{STUDIO_INTAKE_STATUS_LABELS[selected.status]}</em>
                  </span>
                  <h2>{selected.title}</h2>
                  <p>
                    Submitted by {selected.created_by_name} ·{' '}
                    {formatDateTime(selected.created_at)}
                  </p>
                </div>
              </div>
              <p className={styles.intakeDetails}>{selected.details}</p>

              <dl className={styles.intakeFacts}>
                <div>
                  <dt>Owner</dt>
                  <dd>{selected.assigned_to_name || 'Unassigned'}</dd>
                </div>
                <div>
                  <dt>Target</dt>
                  <dd>{formatDate(selected.target_date) || 'Not set'}</dd>
                </div>
                <div>
                  <dt>Updates</dt>
                  <dd>{selected.comments.length}</dd>
                </div>
                <div>
                  <dt>Your item</dt>
                  <dd>
                    {viewerPersonId &&
                    viewerPersonId === selected.created_by_person_id
                      ? 'Yes'
                      : 'No'}
                  </dd>
                </div>
              </dl>

              {canManage ? (
                <form
                  className={styles.intakeTriage}
                  onSubmit={saveTriage}
                >
                  <div className={styles.intakeSectionHeading}>
                    <div>
                      <span className={styles.eyebrow}>Studio manager</span>
                      <h3>Triage and next step</h3>
                    </div>
                    <TuneRoundedIcon aria-hidden="true" />
                  </div>
                  <div className={styles.intakeTriageGrid}>
                    <label>
                      Status
                      <select
                        value={managerDraft.status || 'new'}
                        onChange={(event) =>
                          updateManagerDraft({
                            status: event.target.value,
                          })
                        }
                      >
                        {Object.entries(STUDIO_INTAKE_STATUS_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label>
                      Priority
                      <select
                        value={managerDraft.priority || 'normal'}
                        onChange={(event) =>
                          updateManagerDraft({
                            priority: event.target.value,
                          })
                        }
                      >
                        <option value="normal">Normal</option>
                        <option value="high">High</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </label>
                    <label>
                      Owner
                      <select
                        value={managerDraft.assigned_to_person_id || ''}
                        onChange={(event) =>
                          updateManagerDraft({
                            assigned_to_person_id: event.target.value,
                          })
                        }
                      >
                        <option value="">Unassigned</option>
                        {assignees.map((person) => (
                          <option
                            key={person.person_id}
                            value={person.person_id}
                          >
                            {person.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Target date
                      <input
                        type="date"
                        value={managerDraft.target_date || ''}
                        onChange={(event) =>
                          updateManagerDraft({
                            target_date: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label className={styles.intakeFullField}>
                      Optional decision note
                      <small>
                        Record the owner, timing, decision, or next step if it
                        changed.
                      </small>
                      <PlainTextArea
                        value={managerNote}
                        maxLength={2400}
                        onValueChange={setManagerNote}
                      />
                    </label>
                  </div>
                  <div className={styles.intakeFormActions}>
                    <button
                      type="submit"
                      className={styles.primaryButton}
                      disabled={saving}
                    >
                      {saving ? 'Saving…' : 'Save triage'}
                    </button>
                  </div>
                </form>
              ) : null}

              {canManage && isEpisodeRequestItem(selected) ? (
                <section
                  className={styles.intakeTriage}
                  aria-labelledby="mastermind-request-review-title"
                >
                  <div className={styles.intakeSectionHeading}>
                    <div>
                      <span className={styles.eyebrow}>
                        Episode request · planning handoff
                      </span>
                      <h3 id="mastermind-request-review-title">
                        Review for Season Mastermind
                      </h3>
                    </div>
                    <LightbulbOutlinedIcon aria-hidden="true" />
                  </div>
                  <p className={styles.intakeCreateGuidance}>
                    Approve a small set of public planning fields before this
                    request becomes a research plan. The request details,
                    comments, contact information, and status are never copied
                    or changed by this handoff.
                  </p>

                  {!canStartMastermind ? (
                    <p className={styles.intakeCreateGuidance}>
                      Season Mastermind is not available for this account or
                      environment yet. The episode request remains safely in
                      this queue.
                    </p>
                  ) : !mastermindReviewOpen ||
                    !mastermindReviewMatchesSelected ? (
                    <div className={styles.intakeFormActions}>
                      <button
                        type="button"
                        className={styles.secondaryButton}
                        onClick={openMastermindReview}
                        disabled={mastermindLoading}
                      >
                        <LightbulbOutlinedIcon aria-hidden="true" />
                        Review planning fields
                      </button>
                    </div>
                  ) : (
                    <form onSubmit={submitMastermindReview}>
                      {mastermindError ? (
                        <p className={styles.intakeError} role="alert">
                          {mastermindError}
                        </p>
                      ) : null}
                      {mastermindOutcome ? (
                        <div>
                          <p className={styles.intakeSuccess} role="status">
                            {mastermindOutcome.created
                              ? 'Research plan created. The episode request and its status are unchanged.'
                              : 'This request already has a research plan. No duplicate was created, and the request status is unchanged.'}
                          </p>
                          <div className={styles.intakeFormActions}>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={closeMastermindReview}
                            >
                              Close review
                            </button>
                            <button
                              type="button"
                              className={styles.primaryButton}
                              onClick={() =>
                                router.push(
                                  previewData
                                    ? '/dev/season-mastermind-preview'
                                    : '/studio/mastermind'
                                )
                              }
                            >
                              Open Season Mastermind
                              <ArrowForwardRoundedIcon aria-hidden="true" />
                            </button>
                          </div>
                        </div>
                      ) : mastermindLoading ? (
                        <p className={styles.intakeCreateGuidance} role="status">
                          Opening current seasons and host options…
                        </p>
                      ) : (
                        <>
                          <div className={styles.intakeTriageGrid}>
                            <label>
                              Planning season
                              <small>
                                Choose the authoritative season record.
                              </small>
                              <select
                                value={mastermindReview.season_id}
                                onChange={(event) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    season_id: event.target.value,
                                  }))
                                }
                                required
                              >
                                <option value="">Choose a season</option>
                                {mastermindSeasons.map((season) => (
                                  <option
                                    key={season.season_id}
                                    value={season.season_id}
                                  >
                                    {season.label}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              Episode type
                              <small>Set the public season format.</small>
                              <select
                                value={mastermindReview.episode_type}
                                onChange={(event) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    episode_type: event.target.value,
                                  }))
                                }
                              >
                                <option value="regular">Regular episode</option>
                                <option value="slabs_and_sluffs">
                                  Slabs and Sluffs
                                </option>
                                <option value="special">Special episode</option>
                              </select>
                            </label>
                            <label className={styles.intakeFullField}>
                              Reviewed public working title
                              <small>
                                Enter the approved title; the request title is
                                intentionally not copied.
                              </small>
                              <input
                                value={mastermindReview.working_title}
                                maxLength={180}
                                onChange={(event) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    working_title: event.target.value,
                                  }))
                                }
                                required
                              />
                            </label>
                            <label className={styles.intakeFullField}>
                              Reviewed public premise
                              <small>
                                Summarize the approved editorial angle without
                                private request discussion or contact details.
                              </small>
                              <PlainTextArea
                                value={mastermindReview.premise}
                                maxLength={6000}
                                onValueChange={(premise) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    premise,
                                  }))
                                }
                                required
                              />
                            </label>
                            <label className={styles.intakeFullField}>
                              Reviewed listener takeaway
                              <small>
                                Optional public-facing value for the audience.
                              </small>
                              <PlainTextArea
                                value={mastermindReview.listener_takeaway}
                                maxLength={2400}
                                onValueChange={(listener_takeaway) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    listener_takeaway,
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Target air date
                              <small>Optional until the schedule is firm.</small>
                              <input
                                type="date"
                                value={mastermindReview.target_air_date}
                                onChange={(event) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    target_air_date: event.target.value,
                                  }))
                                }
                              />
                            </label>
                            <label>
                              Plan owner and proposed host
                              <small>
                                Optional; choose one current host or assign
                                later in Mastermind.
                              </small>
                              <select
                                value={mastermindReview.owner_person_id}
                                onChange={(event) =>
                                  setMastermindReview((current) => ({
                                    ...current,
                                    owner_person_id: event.target.value,
                                  }))
                                }
                              >
                                <option value="">Assign later</option>
                                {mastermindHosts.map((host) => (
                                  <option
                                    key={host.person_id}
                                    value={host.person_id}
                                  >
                                    {host.name}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                          <p className={styles.intakeCreateGuidance}>
                            Creating the plan is idempotent: retrying the same
                            reviewed handoff opens the existing plan instead of
                            creating a duplicate.
                          </p>
                          <div className={styles.intakeFormActions}>
                            <button
                              type="button"
                              className={styles.secondaryButton}
                              onClick={closeMastermindReview}
                              disabled={mastermindSaving}
                            >
                              Cancel
                            </button>
                            <button
                              type="submit"
                              className={styles.primaryButton}
                              disabled={
                                mastermindSaving ||
                                !mastermindReview.season_id ||
                                !mastermindReview.working_title.trim() ||
                                !mastermindReview.premise.trim()
                              }
                            >
                              <LightbulbOutlinedIcon aria-hidden="true" />
                              {mastermindSaving
                                ? 'Creating research plan…'
                                : 'Create research plan'}
                            </button>
                          </div>
                        </>
                      )}
                    </form>
                  )}
                </section>
              ) : null}

              <section className={styles.intakeDiscussion}>
                <div className={styles.intakeSectionHeading}>
                  <div>
                    <span className={styles.eyebrow}>Follow-up history</span>
                    <h3>Answers, decisions, and next steps</h3>
                  </div>
                  <ChatBubbleOutlineRoundedIcon aria-hidden="true" />
                </div>
                {selected.comments.length ? (
                  <div className={styles.intakeComments}>
                    {selected.comments.map((entry) => (
                      <article key={entry.comment_id}>
                        <header>
                          <strong>{entry.author_name}</strong>
                          <time dateTime={entry.created_at}>
                            {formatDateTime(entry.created_at)}
                          </time>
                        </header>
                        <p>{entry.body}</p>
                      </article>
                    ))}
                  </div>
                ) : (
                  <p className={styles.intakeNoComments}>
                    No updates yet. Add the answer, decision, or next step when
                    one exists.
                  </p>
                )}
                <form
                  className={styles.intakeCommentForm}
                  onSubmit={postComment}
                >
                  <label htmlFor="team-inbox-comment">
                    Add a follow-up update
                    <small>
                      Keep casual conversation in team chat. Record only the
                      durable answer, decision, or change here.
                    </small>
                  </label>
                  <PlainTextArea
                    id="team-inbox-comment"
                    value={comment}
                    maxLength={2400}
                    onValueChange={setComment}
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={saving || comment.trim().length < 2}
                  >
                    <SendRoundedIcon aria-hidden="true" />
                    Save update
                  </button>
                </form>
              </section>
            </>
          ) : (
            <div
              className={`${styles.intakeEmpty} ${styles.intakeEmptyDetail}`}
            >
              <InboxRoundedIcon aria-hidden="true" />
              <strong>
                {items.length
                  ? 'Choose a follow-up from the queue.'
                  : 'Nothing is waiting on the team.'}
              </strong>
              <span>
                {items.length
                  ? 'Its owner, context, decisions, and updates will appear here.'
                  : 'Create a follow-up when something needs an owner, answer, or durable next step.'}
              </span>
              {!items.length && !loading ? (
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={openCreateForm}
                >
                  <AddRoundedIcon aria-hidden="true" />
                  Create the first follow-up
                </button>
              ) : null}
            </div>
          )}
        </section>
      </div>
    </InboxFrame>
  );
}
