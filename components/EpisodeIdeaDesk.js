import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import LightbulbOutlinedIcon from '@mui/icons-material/LightbulbOutlined';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded';
import PlainTextArea from './PlainTextArea';
import StudioLayout from './StudioLayout';
import {
  buildEpisodeIdeaMutation,
  canEpisodeIdea,
  createEpisodeIdeaRequestId,
  EMPTY_EPISODE_IDEA,
  EPISODE_IDEA_FILTERS,
  EPISODE_IDEA_HORIZON_LABELS,
  EPISODE_IDEA_STATUS_META,
  episodeIdeaDraft,
  filterEpisodeIdeas,
  getEpisodeIdeaFollowUpHref,
  normalizeEpisodeIdea,
  normalizeEpisodeIdeaDeskPayload,
  summarizeEpisodeIdeas,
  validateEpisodeIdea,
} from './episodeIdeaDeskModel.mjs';
import styles from '../styles/EpisodeIdeaDesk.module.css';

const EMPTY_DESK = normalizeEpisodeIdeaDeskPayload({
  configured: true,
  items: [],
});

const ACTION_SUCCESS = {
  create_draft: 'Draft saved.',
  submit_new: 'Pitch submitted for review.',
  save_draft: 'Pitch changes saved.',
  submit: 'Pitch returned to the review queue.',
  start_review: 'Review started.',
  request_changes: 'Changes requested from the host.',
  approve: 'Pitch approved and moved into Team follow-ups.',
  defer: 'Idea saved for a future planning window.',
  reopen: 'Idea reopened for review.',
};

function formatDate(value, { includeYear = true } = {}) {
  if (!value) return 'No date proposed';
  const date = new Date(
    /^\d{4}-\d{2}-\d{2}$/.test(value) ? `${value}T12:00:00` : value
  );
  if (Number.isNaN(date.getTime())) return 'No date proposed';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function relativeUpdated(value) {
  if (!value) return 'Update time unavailable';
  const timestamp = new Date(value).getTime();
  if (Number.isNaN(timestamp)) return 'Update time unavailable';
  const elapsed = Date.now() - timestamp;
  const absolute = Math.abs(elapsed);
  if (absolute < 60 * 60 * 1000) {
    const minutes = Math.max(1, Math.round(absolute / (60 * 1000)));
    return `${elapsed >= 0 ? '' : 'in '}${minutes} min${minutes === 1 ? '' : 's'}${
      elapsed >= 0 ? ' ago' : ''
    }`;
  }
  if (absolute < 24 * 60 * 60 * 1000) {
    const hours = Math.round(absolute / (60 * 60 * 1000));
    return `${elapsed >= 0 ? '' : 'in '}${hours} hr${hours === 1 ? '' : 's'}${
      elapsed >= 0 ? ' ago' : ''
    }`;
  }
  return formatDate(value);
}

function statusActionLabel(item, canReview) {
  if (canEpisodeIdea(item, 'edit')) return 'Edit';
  if (
    canReview &&
    [
      'start_review',
      'request_changes',
      'approve',
      'defer',
      'reopen',
    ].some((action) => canEpisodeIdea(item, action))
  ) {
    return 'Review';
  }
  return 'View';
}

function SummaryFilters({ summary, value, onChange, loading }) {
  return (
    <div
      className={styles.summaryFilters}
      role="group"
      aria-label="Filter episode ideas by status"
    >
      {EPISODE_IDEA_FILTERS.map((filter) => {
        const selected = value === filter.value;
        return (
          <button
            type="button"
            className={`${styles.summaryFilter} ${
              selected ? styles.summaryFilterActive : ''
            }`}
            aria-pressed={selected}
            onClick={() => onChange(filter.value)}
            key={filter.value}
          >
            <span>{filter.label}</span>
            <strong>{loading ? '—' : summary[filter.count] || 0}</strong>
          </button>
        );
      })}
    </div>
  );
}

function StatusBadge({ status }) {
  const meta = EPISODE_IDEA_STATUS_META[status] ||
    EPISODE_IDEA_STATUS_META.draft;
  return (
    <span className={styles.statusBadge} data-status={status}>
      {meta.label}
    </span>
  );
}

function IdeaRow({ item, canReview, hrefFor, onOpen, onNavigate }) {
  const followUpHref = getEpisodeIdeaFollowUpHref(item);
  const status = EPISODE_IDEA_STATUS_META[item.status];
  const actionLabel = statusActionLabel(item, canReview);
  return (
    <tr>
      <th scope="row" className={styles.ideaCell}>
        <span className={styles.mobileLabel} aria-hidden="true">
          Idea
        </span>
        <span>
          <strong>{item.working_title || 'Untitled episode idea'}</strong>
          <small>
            {item.proposed_guest
              ? `Guest: ${item.proposed_guest}`
              : item.premise || 'Pitch details still being drafted.'}
          </small>
        </span>
      </th>
      <td>
        <span className={styles.mobileLabel} aria-hidden="true">
          Status
        </span>
        <span className={styles.statusCell}>
          <StatusBadge status={item.status} />
          <small>{status?.detail}</small>
        </span>
      </td>
      <td>
        <span className={styles.mobileLabel} aria-hidden="true">
          Timing
        </span>
        <span className={styles.timingCell}>
          <strong>
            {EPISODE_IDEA_HORIZON_LABELS[item.planning_horizon]}
          </strong>
          <time dateTime={item.preferred_air_date || undefined}>
            {formatDate(item.preferred_air_date)}
          </time>
        </span>
      </td>
      <td>
        <span className={styles.mobileLabel} aria-hidden="true">
          Owner / updated
        </span>
        <span className={styles.ownerCell}>
          <strong>{item.owner_name || 'Owner not listed'}</strong>
          <small>{relativeUpdated(item.updated_at)}</small>
        </span>
      </td>
      <td className={styles.actionCell}>
        <span className={styles.mobileLabel} aria-hidden="true">
          Next step
        </span>
        <span className={styles.rowActions}>
          <button
            type="button"
            className={styles.rowButton}
            onClick={() => onOpen(item)}
            aria-label={`${actionLabel} ${item.working_title || 'episode idea'}`}
          >
            {actionLabel}
          </button>
          {followUpHref ? (
            <Link
              href={hrefFor(followUpHref)}
              className={styles.rowLink}
              aria-label={`Open ${item.working_title} in Team follow-ups`}
              onClick={onNavigate}
            >
              Follow-up
              <ArrowForwardRoundedIcon aria-hidden="true" />
            </Link>
          ) : null}
        </span>
      </td>
    </tr>
  );
}

function IdeaEditor({
  mode,
  item,
  draft,
  initialDraft,
  decisionNote,
  canReview,
  busyAction,
  error,
  hrefFor,
  onDraftChange,
  onDecisionNoteChange,
  onAction,
  onClose,
  onNavigate,
}) {
  const creating = mode === 'create';
  const status = item?.status || 'draft';
  const statusMeta = EPISODE_IDEA_STATUS_META[status];
  const editable = creating || canEpisodeIdea(item, 'edit');
  const followUpHref = item ? getEpisodeIdeaFollowUpHref(item) : '';
  const changed = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const managerActions = canReview
    ? [
        ['start_review', 'Start review'],
        ['request_changes', 'Request changes'],
        ['approve', 'Approve pitch'],
        ['defer', 'Move to future'],
        ['reopen', 'Reopen'],
      ].filter(([action]) => canEpisodeIdea(item, action))
    : [];

  function update(field, value) {
    onDraftChange((current) => ({ ...current, [field]: value }));
  }

  return (
    <section
      className={styles.editor}
      aria-labelledby="idea-editor-title"
      data-status={status}
    >
      <header className={styles.editorHeader}>
        <div>
          <span className={styles.eyebrow}>
            {creating ? 'New pitch' : statusMeta?.label}
          </span>
          <h2 id="idea-editor-title">
            {creating
              ? 'Pitch an episode'
              : item.working_title || 'Episode idea'}
          </h2>
          <p>
            {creating
              ? 'Save an early thought privately, or send a clear pitch into the manager review queue.'
              : statusMeta?.detail}
          </p>
        </div>
        <button
          type="button"
          className={styles.iconButton}
          onClick={() => onClose({ changed: changed || Boolean(decisionNote) })}
          aria-label="Close idea details"
          disabled={Boolean(busyAction)}
        >
          <CloseRoundedIcon aria-hidden="true" />
        </button>
      </header>

      {item?.decision_note ? (
        <div className={styles.decisionNote}>
          <strong>Latest planning note</strong>
          <p>{item.decision_note}</p>
        </div>
      ) : null}

      {error ? (
        <p className={styles.error} role="alert">
          {error}
        </p>
      ) : null}

      <form
        className={styles.ideaForm}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className={styles.formGrid}>
          <label className={styles.fullField}>
            <span>Working title</span>
            <input
              value={draft.working_title}
              maxLength={180}
              onChange={(event) => update('working_title', event.target.value)}
              disabled={!editable || Boolean(busyAction)}
              autoFocus={creating}
            />
          </label>
          <label>
            <span>Proposed guest</span>
            <input
              value={draft.proposed_guest}
              maxLength={180}
              onChange={(event) => update('proposed_guest', event.target.value)}
              disabled={!editable || Boolean(busyAction)}
              placeholder="Name or organization (optional)"
            />
          </label>
          <label>
            <span>Planning window</span>
            <select
              value={draft.planning_horizon}
              onChange={(event) =>
                update('planning_horizon', event.target.value)
              }
              disabled={!editable || Boolean(busyAction)}
            >
              {Object.entries(EPISODE_IDEA_HORIZON_LABELS).map(
                ([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                )
              )}
            </select>
          </label>
          <label>
            <span>Preferred air date</span>
            <input
              type="date"
              value={draft.preferred_air_date}
              onChange={(event) =>
                update('preferred_air_date', event.target.value)
              }
              disabled={!editable || Boolean(busyAction)}
            />
          </label>
          <label className={styles.fullField}>
            <span>Editorial premise</span>
            <small>What is the story, problem, or field decision?</small>
            <PlainTextArea
              value={draft.premise}
              maxLength={6000}
              onValueChange={(value) => update('premise', value)}
              disabled={!editable || Boolean(busyAction)}
              expandable={false}
              rows={4}
            />
          </label>
          <label className={styles.fullField}>
            <span>Listener takeaway</span>
            <small>What should a listener understand or do differently?</small>
            <PlainTextArea
              value={draft.listener_takeaway}
              maxLength={2400}
              onValueChange={(value) => update('listener_takeaway', value)}
              disabled={!editable || Boolean(busyAction)}
              expandable={false}
              rows={3}
            />
          </label>
          <label className={styles.fullField}>
            <span>Early research notes</span>
            <small>
              Add public leads and questions. Keep private guest contact details
              out of this planning record.
            </small>
            <PlainTextArea
              value={draft.research_notes}
              maxLength={6000}
              onValueChange={(value) => update('research_notes', value)}
              disabled={!editable || Boolean(busyAction)}
              expandable={false}
              rows={4}
            />
          </label>
        </div>

        {managerActions.length ? (
          <label className={styles.reviewNote}>
            <span>Decision note</span>
            <small>
              Required when requesting changes or moving an idea to the future.
            </small>
            <PlainTextArea
              value={decisionNote}
              maxLength={2400}
              onValueChange={onDecisionNoteChange}
              disabled={Boolean(busyAction)}
              expandable={false}
              rows={3}
            />
          </label>
        ) : null}

        <div className={styles.editorActions}>
          <div>
            {creating ? (
              <>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  onClick={() => onAction('create_draft')}
                  disabled={Boolean(busyAction)}
                >
                  {busyAction === 'create_draft' ? 'Saving…' : 'Save draft'}
                </button>
                <button
                  type="button"
                  className={styles.primaryButton}
                  onClick={() => onAction('submit_new')}
                  disabled={Boolean(busyAction)}
                >
                  {busyAction === 'submit_new'
                    ? 'Submitting…'
                    : 'Submit pitch'}
                </button>
              </>
            ) : (
              <>
                {editable ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    onClick={() => onAction('save_draft')}
                    disabled={Boolean(busyAction) || !changed}
                  >
                    {busyAction === 'save_draft'
                      ? 'Saving…'
                      : 'Save changes'}
                  </button>
                ) : null}
                {canEpisodeIdea(item, 'submit') ? (
                  <button
                    type="button"
                    className={styles.primaryButton}
                    onClick={() => onAction('submit')}
                    disabled={Boolean(busyAction)}
                  >
                    {busyAction === 'submit'
                      ? 'Submitting…'
                      : status === 'needs_changes'
                        ? 'Resubmit pitch'
                        : 'Submit for review'}
                  </button>
                ) : null}
              </>
            )}
          </div>

          {managerActions.length ? (
            <div className={styles.managerActions}>
              {managerActions.map(([action, label]) => (
                <button
                  type="button"
                  className={
                    action === 'approve'
                      ? styles.approveButton
                      : styles.reviewButton
                  }
                  onClick={() => onAction(action)}
                  disabled={Boolean(busyAction)}
                  key={action}
                >
                  {busyAction === action ? 'Saving…' : label}
                </button>
              ))}
            </div>
          ) : null}

          {followUpHref ? (
            <Link
              href={hrefFor(followUpHref)}
              className={styles.followUpLink}
              onClick={onNavigate}
            >
              Open approved follow-up
              <ArrowForwardRoundedIcon aria-hidden="true" />
            </Link>
          ) : null}
        </div>
      </form>
    </section>
  );
}

export default function EpisodeIdeaDesk({
  previewData = null,
  previewSession = null,
  previewPath = '',
  previewHrefMap = null,
}) {
  const router = useRouter();
  const preview = previewData !== null;
  const [desk, setDesk] = useState(() =>
    previewData ? normalizeEpisodeIdeaDeskPayload(previewData) : EMPTY_DESK
  );
  const [loadState, setLoadState] = useState(preview ? 'ready' : 'loading');
  const [loadError, setLoadError] = useState('');
  const [filter, setFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('status');
  const [editorMode, setEditorMode] = useState('');
  const [selectedIdeaId, setSelectedIdeaId] = useState('');
  const [draft, setDraft] = useState(EMPTY_EPISODE_IDEA);
  const [initialDraft, setInitialDraft] = useState(EMPTY_EPISODE_IDEA);
  const [decisionNote, setDecisionNote] = useState('');
  const [actionError, setActionError] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [message, setMessage] = useState('');
  const [creationRequestId, setCreationRequestId] = useState('');
  const openedQueryRef = useRef(false);

  const selectedIdea = desk.items.find(
    (item) => item.idea_id === selectedIdeaId
  );
  const rows = useMemo(
    () => filterEpisodeIdeas(desk.items, { filter, query, sort }),
    [desk.items, filter, query, sort]
  );
  const dirty =
    Boolean(editorMode) &&
    (JSON.stringify(draft) !== JSON.stringify(initialDraft) ||
      Boolean(decisionNote.trim()));

  const hrefFor = useCallback(
    (href) => previewHrefMap?.[href] || href,
    [previewHrefMap]
  );

  function confirmUnsavedNavigation(event) {
    if (
      !dirty ||
      event.defaultPrevented ||
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }
    if (!window.confirm('Discard the unsaved changes to this episode idea?')) {
      event.preventDefault();
    }
  }

  const loadDesk = useCallback(
    async ({ signal, quiet = false } = {}) => {
      if (preview) return;
      if (!quiet) setLoadState('loading');
      setLoadError('');
      try {
        const response = await fetch('/api/studio/episode-ideas', {
          credentials: 'same-origin',
          signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok && data.configured !== false) {
          const error = new Error(data.error || 'Could not load the Idea Desk.');
          error.code = data.code || '';
          throw error;
        }
        setDesk(normalizeEpisodeIdeaDeskPayload(data));
        setLoadState('ready');
      } catch (error) {
        if (error.name === 'AbortError') return;
        setLoadError(
          error.code === 'PROFILE_NOT_CONNECTED'
            ? 'Connect this login to a team profile before opening personal episode ideas.'
            : error.message || 'Could not load the Idea Desk.'
        );
        setLoadState('error');
      }
    },
    [preview]
  );

  useEffect(() => {
    if (preview) return undefined;
    const controller = new AbortController();
    const frame = window.requestAnimationFrame(() => {
      loadDesk({ signal: controller.signal });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      controller.abort();
    };
  }, [loadDesk, preview]);

  useEffect(() => {
    if (
      openedQueryRef.current ||
      !router.isReady ||
      String(router.query.new || '') !== '1'
    ) {
      return;
    }
    openedQueryRef.current = true;
    setCreationRequestId(createEpisodeIdeaRequestId());
    setEditorMode('create');
    setSelectedIdeaId('');
    setDraft({ ...EMPTY_EPISODE_IDEA });
    setInitialDraft({ ...EMPTY_EPISODE_IDEA });
    setDecisionNote('');
    setActionError('');
  }, [router.isReady, router.query.new]);

  function openCreate() {
    if (
      dirty &&
      !window.confirm('Discard the unsaved changes to this episode idea?')
    ) {
      return;
    }
    setCreationRequestId(createEpisodeIdeaRequestId());
    setEditorMode('create');
    setSelectedIdeaId('');
    setDraft({ ...EMPTY_EPISODE_IDEA });
    setInitialDraft({ ...EMPTY_EPISODE_IDEA });
    setDecisionNote('');
    setActionError('');
    setMessage('');
  }

  function openIdea(item) {
    if (
      dirty &&
      selectedIdeaId !== item.idea_id &&
      !window.confirm('Discard the unsaved changes to this episode idea?')
    ) {
      return;
    }
    const nextDraft = episodeIdeaDraft(item);
    setEditorMode('item');
    setCreationRequestId('');
    setSelectedIdeaId(item.idea_id);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setDecisionNote('');
    setActionError('');
    setMessage('');
  }

  function closeEditor({ changed = dirty } = {}) {
    if (
      changed &&
      !window.confirm('Discard the unsaved changes to this episode idea?')
    ) {
      return;
    }
    setEditorMode('');
    setCreationRequestId('');
    setSelectedIdeaId('');
    setDraft({ ...EMPTY_EPISODE_IDEA });
    setInitialDraft({ ...EMPTY_EPISODE_IDEA });
    setDecisionNote('');
    setActionError('');
    if (!preview && String(router.query.new || '') === '1') {
      router.replace('/studio/episodes/ideas', undefined, { shallow: true });
    }
  }

  function replaceIdea(nextItem, suppliedSummary) {
    const normalized = normalizeEpisodeIdea(nextItem);
    setDesk((current) => {
      const existing = current.items.some(
        (item) => item.idea_id === normalized.idea_id
      );
      const items = existing
        ? current.items.map((item) =>
            item.idea_id === normalized.idea_id ? normalized : item
          )
        : [normalized, ...current.items];
      return {
        ...current,
        items,
        summary: summarizeEpisodeIdeas(items, suppliedSummary),
      };
    });
    setSelectedIdeaId(normalized.idea_id);
    const nextDraft = episodeIdeaDraft(normalized);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setDecisionNote('');
    setEditorMode('item');
  }

  function previewMutation(action) {
    const current = selectedIdea || {};
    const statusByAction = {
      create_draft: 'draft',
      submit_new: 'submitted',
      save_draft: current.status || 'draft',
      submit: 'submitted',
      start_review: 'reviewing',
      request_changes: 'needs_changes',
      approve: 'approved',
      defer: 'future',
      reopen: 'submitted',
    };
    const ideaId = current.idea_id || `preview-idea-${Date.now()}`;
    const nextStatus = statusByAction[action];
    const hostEditable = ['draft', 'needs_changes'].includes(nextStatus);
    const managerReviewable = ['submitted', 'reviewing'].includes(nextStatus);
    replaceIdea({
      ...current,
      ...draft,
      idea_id: ideaId,
      status: nextStatus,
      owner_name: current.owner_name || 'Preview Host',
      decision_note: decisionNote || current.decision_note || '',
      source_intake_item_id:
        nextStatus === 'approved'
          ? current.source_intake_item_id || 'preview-approved-follow-up'
          : current.source_intake_item_id || '',
      created_at: current.created_at || new Date().toISOString(),
      updated_at: new Date().toISOString(),
      capabilities: {
        can_edit: hostEditable,
        can_submit: hostEditable,
        can_start_review: nextStatus === 'submitted',
        can_request_changes: managerReviewable,
        can_approve: managerReviewable,
        can_defer: managerReviewable,
        can_reopen: nextStatus === 'future',
      },
    });
  }

  async function performAction(action) {
    if (busyAction) return;
    const creating = editorMode === 'create';
    const submit = ['submit_new', 'submit', 'approve'].includes(action);
    const validation = ['create_draft', 'submit_new', 'save_draft', 'submit', 'approve'].includes(
      action
    )
      ? validateEpisodeIdea(draft, { submit })
      : '';
    if (validation) {
      setActionError(validation);
      return;
    }
    if (
      ['request_changes', 'defer'].includes(action) &&
      decisionNote.trim().length < 2
    ) {
      setActionError('Add a short decision note before choosing this action.');
      return;
    }

    setBusyAction(action);
    setActionError('');
    setMessage('');
    try {
      if (preview) {
        previewMutation(action);
        setMessage(ACTION_SUCCESS[action] || 'Idea updated.');
        return;
      }
      const method = creating ? 'POST' : 'PATCH';
      const response = await fetch('/api/studio/episode-ideas', {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          buildEpisodeIdeaMutation({
            method,
            action,
            item: selectedIdea,
            draft,
            decisionNote,
            requestId: creationRequestId,
          })
        ),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(
          response.status === 409
            ? 'This idea changed elsewhere. Refresh the desk before trying again.'
            : data.error || 'Could not update this episode idea.'
        );
      }
      if (data.item || data.idea) {
        replaceIdea(data.item || data.idea, data.summary);
        setCreationRequestId('');
      } else {
        await loadDesk({ quiet: true });
        setEditorMode('');
      }
      setMessage(ACTION_SUCCESS[action] || 'Idea updated.');
    } catch (error) {
      setActionError(error.message || 'Could not update this episode idea.');
    } finally {
      setBusyAction('');
    }
  }

  function clearFilters() {
    setFilter('all');
    setQuery('');
    setSort('status');
  }

  return (
    <StudioLayout
      requiredPermission="episodes:read"
      hasUnsavedChanges={dirty}
      unsavedChangesMessage="Discard the unsaved changes to this episode idea?"
      previewSession={previewSession}
      previewPath={previewPath}
      previewHrefMap={previewHrefMap}
      wide
    >
      <Head>
        <title>Idea Desk | The Avalanche Hour</title>
      </Head>
      <div className={styles.page}>
        <Link
          href={hrefFor('/studio')}
          className={styles.backLink}
          onClick={confirmUnsavedNavigation}
        >
          <ArrowBackRoundedIcon aria-hidden="true" />
          Studio overview
        </Link>

        <nav className={styles.localNav} aria-label="Host Studio sections">
          <Link
            href={hrefFor('/studio/episodes')}
            onClick={confirmUnsavedNavigation}
          >
            Episodes
          </Link>
          <Link
            href={hrefFor('/studio/episodes/ideas')}
            className={styles.localNavActive}
            aria-current="page"
            onClick={confirmUnsavedNavigation}
          >
            Ideas &amp; requests
          </Link>
        </nav>

        <header className={styles.hero}>
          <span className={styles.heroIcon}>
            <LightbulbOutlinedIcon aria-hidden="true" />
          </span>
          <div>
            <span className={styles.eyebrow}>Host Studio · Before production</span>
            <h1>Idea Desk</h1>
            <p>
              Capture a pitch, shape the listener value, and follow the manager
              decision before an Episode Studio is created.
            </p>
            <span className={styles.scopePill}>
              {desk.scope === 'team' ? 'Team planning view' : 'Your episode ideas'}
            </span>
          </div>
          <button
            type="button"
            className={styles.heroAction}
            onClick={openCreate}
            disabled={loadState === 'loading' || !desk.configured}
          >
            <AddRoundedIcon aria-hidden="true" />
            Pitch an episode
          </button>
        </header>

        <SummaryFilters
          summary={desk.summary}
          value={filter}
          onChange={setFilter}
          loading={loadState === 'loading'}
        />

        <p className={styles.liveMessage} role="status" aria-live="polite">
          {message}
        </p>

        {editorMode ? (
          <IdeaEditor
            mode={editorMode}
            item={selectedIdea}
            draft={draft}
            initialDraft={initialDraft}
            decisionNote={decisionNote}
            canReview={desk.canReview}
            busyAction={busyAction}
            error={actionError}
            hrefFor={hrefFor}
            onDraftChange={setDraft}
            onDecisionNoteChange={setDecisionNote}
            onAction={performAction}
            onClose={closeEditor}
            onNavigate={confirmUnsavedNavigation}
          />
        ) : null}

        {loadState === 'error' ? (
          <section className={styles.stateCard} role="alert">
            <RefreshRoundedIcon aria-hidden="true" />
            <div>
              <h2>Idea Desk could not load</h2>
              <p>{loadError}</p>
              <button type="button" onClick={() => loadDesk()}>
                Try again
              </button>
            </div>
          </section>
        ) : !desk.configured ? (
          <section className={styles.stateCard}>
            <ScheduleRoundedIcon aria-hidden="true" />
            <div>
              <h2>Idea Desk is not configured yet</h2>
              <p>
                Existing Episode Studios are still available. A Studio manager
                can finish the planning-service setup before hosts save pitches
                here.
              </p>
              <Link href={hrefFor('/studio/episodes')}>Open your episodes</Link>
            </div>
          </section>
        ) : (
          <section aria-labelledby="idea-list-title">
            <div className={styles.sectionHeading}>
              <div>
                <span className={styles.eyebrow}>Planning pipeline</span>
                <h2 id="idea-list-title">Ideas and decisions</h2>
                <p>
                  Drafts stay editable until submission. Approved pitches link
                  to their safe Team follow-up record.
                </p>
              </div>
              <strong role="status" aria-live="polite">
                {loadState === 'loading'
                  ? 'Loading ideas…'
                  : `${rows.length} of ${desk.summary.total} showing`}
              </strong>
            </div>

            <div className={styles.toolbar}>
              <label className={styles.searchField}>
                <span>Search title, guest, owner, or premise</span>
                <input
                  type="search"
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search episode ideas"
                  autoComplete="off"
                />
              </label>
              <label>
                <span>Sort</span>
                <select
                  value={sort}
                  onChange={(event) => setSort(event.target.value)}
                >
                  <option value="status">Action and status</option>
                  <option value="recent">Recently updated</option>
                  <option value="air_date">Preferred air date</option>
                </select>
              </label>
            </div>

            {loadState === 'loading' ? (
              <div className={styles.stateCard} role="status">
                <LightbulbOutlinedIcon aria-hidden="true" />
                <div>
                  <h2>Loading episode ideas…</h2>
                  <p>The authorized planning view will appear here.</p>
                </div>
              </div>
            ) : !desk.items.length ? (
              <div className={styles.emptyState}>
                <LightbulbOutlinedIcon aria-hidden="true" />
                <h3>No episode ideas in motion</h3>
                <p>
                  Save an early thought as a draft, or submit a complete pitch
                  for manager review.
                </p>
                <button type="button" onClick={openCreate}>
                  <AddRoundedIcon aria-hidden="true" />
                  Pitch an episode
                </button>
              </div>
            ) : !rows.length ? (
              <div className={styles.emptyState}>
                <EditNoteRoundedIcon aria-hidden="true" />
                <h3>No ideas match these filters</h3>
                <p>Clear the search and status filter to see the full desk.</p>
                <button type="button" onClick={clearFilters}>
                  Clear filters
                </button>
              </div>
            ) : (
              <div className={styles.tableFrame}>
                <table className={styles.ideaTable}>
                  <caption className={styles.visuallyHidden}>
                    Episode ideas visible to this Studio login
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Idea</th>
                      <th scope="col">Status</th>
                      <th scope="col">Timing</th>
                      <th scope="col">Owner / updated</th>
                      <th scope="col">Next step</th>
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((item) => (
                      <IdeaRow
                        item={item}
                        canReview={desk.canReview}
                        hrefFor={hrefFor}
                        onOpen={openIdea}
                        onNavigate={confirmUnsavedNavigation}
                        key={item.idea_id}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        )}

        <section className={styles.workflowNote} aria-label="Idea Desk workflow">
          <CheckCircleRoundedIcon aria-hidden="true" />
          <div>
            <strong>One clear handoff</strong>
            <p>
              The Idea Desk holds the pitch and decision. After approval, Team
              follow-ups carries the planning handoff; the Episode Studio takes
              over only when production begins.
            </p>
          </div>
        </section>
      </div>
    </StudioLayout>
  );
}
