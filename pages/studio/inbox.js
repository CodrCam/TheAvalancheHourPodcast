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
import StudioLayout from '../../components/StudioLayout';
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
          throw new Error(data.error || 'Could not open the Team Inbox.');
        }
        if (!alive) return;
        const nextItems = data.items || [];
        setItems(nextItems);
        setAssignees(data.assignees || []);
        setCanManage(data.canManage === true);
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
          setError(loadError.message || 'Could not open the Team Inbox.');
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
    setManagerNote('');
    setComment('');
    setMessage('');
    setError('');
    if (!previewData) {
      router.replace(
        { pathname: '/studio/inbox', query: { item: itemId } },
        undefined,
        { shallow: true }
      );
    }
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
        throw new Error(data.error || 'Could not add this Team Inbox item.');
      }
      setItems((current) => [data.item, ...current]);
      setForm(EMPTY_ITEM);
      setShowCreate(false);
      setSelectedId(data.item.item_id);
      setMessage('Added to the Team Inbox.');
      router.replace(
        { pathname: '/studio/inbox', query: { item: data.item.item_id } },
        undefined,
        { shallow: true }
      );
    } catch (createError) {
      setError(createError.message || 'Could not add this Team Inbox item.');
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

  async function saveTriage(event) {
    event.preventDefault();
    if (!selected || saving || !canManage) return;
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
    } catch (triageError) {
      setError(triageError.message || 'Could not save this triage update.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <InboxFrame preview={Boolean(previewData)}>
      <header className={styles.pageHeader}>
        <div>
          <span className={styles.eyebrow}>One shared place to ask</span>
          <h1>Team Inbox</h1>
          <p>
            Capture blockers, requests, questions, and good ideas where the
            whole team can see the answer and the next step.
          </p>
        </div>
        <button
          type="button"
          className={styles.primaryButton}
          onClick={() => setShowCreate((current) => !current)}
        >
          <AddRoundedIcon aria-hidden="true" />
          {showCreate ? 'Close form' : 'Add to inbox'}
        </button>
      </header>

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

      {showCreate ? (
        <form className={styles.intakeCreate} onSubmit={createItem}>
          <div className={styles.intakeSectionHeading}>
            <div>
              <span className={styles.eyebrow}>New team item</span>
              <h2>What should the team know?</h2>
            </div>
            <span>Visible to the signed-in team.</span>
          </div>
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
              <input
                value={form.title}
                maxLength={180}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                placeholder="What needs attention?"
                required
              />
            </label>
            <label>
              Starting priority
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
              Details and desired outcome
              <textarea
                value={form.details}
                maxLength={6000}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    details: event.target.value,
                  }))
                }
                placeholder="Give enough context for someone else to understand the issue, what you have tried, and what a useful answer would look like."
                required
              />
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
              {saving ? 'Adding…' : 'Add to Team Inbox'}
            </button>
          </div>
        </form>
      ) : null}

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
      {!configured ? (
        <p className={styles.intakeError}>
          Team Inbox storage is not configured yet.
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
            <h2>Shared queue</h2>
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
                        <em>{STUDIO_INTAKE_KIND_LABELS[item.kind]}</em>
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
              <strong>No items match these filters.</strong>
              <span>Try another filter or add the first item.</span>
            </div>
          )}
        </section>

        <section className={styles.intakeDetailPanel}>
          {selected ? (
            <>
              <div className={styles.intakeDetailHeader}>
                <div>
                  <span className={styles.intakeDetailBadges}>
                    <em>{STUDIO_INTAKE_KIND_LABELS[selected.kind]}</em>
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
                      <span className={styles.eyebrow}>Caleb / manager</span>
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
                      Optional update for the team
                      <textarea
                        value={managerNote}
                        maxLength={2400}
                        onChange={(event) =>
                          setManagerNote(event.target.value)
                        }
                        placeholder="Share the decision, owner, timing, or what happens next."
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

              <section className={styles.intakeDiscussion}>
                <div className={styles.intakeSectionHeading}>
                  <div>
                    <span className={styles.eyebrow}>Shared context</span>
                    <h3>Updates and answers</h3>
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
                    No updates yet. Add context, an answer, or the next step.
                  </p>
                )}
                <form
                  className={styles.intakeCommentForm}
                  onSubmit={postComment}
                >
                  <label htmlFor="team-inbox-comment">Add an update</label>
                  <textarea
                    id="team-inbox-comment"
                    value={comment}
                    maxLength={2400}
                    onChange={(event) => setComment(event.target.value)}
                    placeholder="Answer the question, add context, or record a decision…"
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={saving || comment.trim().length < 2}
                  >
                    <SendRoundedIcon aria-hidden="true" />
                    Post update
                  </button>
                </form>
              </section>
            </>
          ) : (
            <div className={styles.intakeEmpty}>
              <InboxRoundedIcon aria-hidden="true" />
              <strong>Select an item to see the full context.</strong>
            </div>
          )}
        </section>
      </div>
    </InboxFrame>
  );
}
