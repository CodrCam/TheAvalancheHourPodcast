import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import FriendlyDateField from '../../../components/FriendlyDateField';
import PlainTextArea from '../../../components/PlainTextArea';
import StudioLayout from '../../../components/StudioLayout';
import {
  EMPTY_EPISODE_REQUEST_FORM,
  buildEpisodeRequestItem,
} from '../../../lib/episodeRequest.mjs';
import styles from '../../../styles/EpisodeStudio.module.css';

const STATUS_LABELS = {
  planning: 'Ready to start',
  in_progress: 'In progress',
  submitted: 'With the producer',
  submitted_with_gaps: 'With producer · known gaps',
  needs_changes: 'Changes requested',
  accepted: 'Accepted',
};

const RELATIONSHIP_LABELS = {
  host: 'Host',
  producer: 'Producer',
  creator: 'Created by you',
  workflow_assignee: 'Workflow owner',
};

function formatDate(value) {
  if (!value) return 'Date pending';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function monthStart(value = new Date()) {
  return new Date(value.getFullYear(), value.getMonth(), 1);
}

function monthLabel(value) {
  return value.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function dateKey(value) {
  const year = value.getFullYear();
  const month = String(value.getMonth() + 1).padStart(2, '0');
  const day = String(value.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function calendarDays(viewMonth) {
  const first = monthStart(viewMonth);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    return {
      date,
      key: dateKey(date),
      inMonth: date.getMonth() === viewMonth.getMonth(),
    };
  });
}

export default function HostEpisodesPage() {
  const [episodes, setEpisodes] = useState([]);
  const [calendarEntries, setCalendarEntries] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [notConnected, setNotConnected] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [calendarLoading, setCalendarLoading] = useState(true);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [requestForm, setRequestForm] = useState(
    EMPTY_EPISODE_REQUEST_FORM
  );
  const [requestSaving, setRequestSaving] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [requestSuccess, setRequestSuccess] = useState(null);
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [viewMonth, setViewMonth] = useState(monthStart(new Date()));

  useEffect(() => {
    let alive = true;
    async function loadEpisodes() {
      try {
        const response = await fetch('/api/studio/episodes?scope=mine', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          if (data.code === 'PROFILE_NOT_CONNECTED') {
            setNotConnected(true);
            setCanManageAccess(data.can_manage_access === true);
            return;
          }
          throw new Error(data.error || 'Could not load your episodes.');
        }
        if (alive) {
          setEpisodes(data.episodes || []);
          setProfileName(data.profile_connection?.person_name || '');
          setNotConnected(false);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your episodes.');
      } finally {
        if (alive) setLoading(false);
      }
    }
    loadEpisodes();
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => {
    let alive = true;
    async function loadCalendar() {
      try {
        const response = await fetch('/api/studio/episodes?scope=calendar', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not load the episode calendar.');
        }
        if (!alive) return;
        const nextEntries = data.calendar || [];
        setCalendarEntries(nextEntries);
        if (nextEntries[0]?.target_release_date) {
          const firstDate = new Date(
            `${nextEntries[0].target_release_date}T12:00:00`
          );
          if (!Number.isNaN(firstDate.getTime())) {
            setViewMonth(monthStart(firstDate));
          }
        }
      } catch (err) {
        if (alive) {
          setCalendarError(
            err.message || 'Could not load the episode calendar.'
          );
        }
      } finally {
        if (alive) setCalendarLoading(false);
      }
    }
    loadCalendar();
    return () => {
      alive = false;
    };
  }, []);

  const stats = useMemo(
    () => ({
      total: episodes.length,
      inProgress: episodes.filter((episode) =>
        ['planning', 'in_progress', 'needs_changes'].includes(episode.status)
      ).length,
      withProducer: episodes.filter((episode) =>
        ['submitted', 'submitted_with_gaps'].includes(episode.status)
      ).length,
      accepted: episodes.filter((episode) => episode.status === 'accepted')
        .length,
      offTrack: episodes.filter(
        (episode) =>
          (episode.effective_delivery_health || episode.delivery_health) ===
          'off_track'
      ).length,
    }),
    [episodes]
  );
  const visibleCalendarDays = useMemo(
    () => calendarDays(viewMonth),
    [viewMonth]
  );
  const calendarEntriesByDate = useMemo(() => {
    const entriesByDate = new Map();
    for (const entry of calendarEntries) {
      const entries = entriesByDate.get(entry.target_release_date) || [];
      entries.push(entry);
      entriesByDate.set(entry.target_release_date, entries);
    }
    return entriesByDate;
  }, [calendarEntries]);
  const requestDirty =
    showRequestForm &&
    Object.values(requestForm).some((value) => String(value || '').trim());

  function closeRequestForm() {
    setRequestForm(EMPTY_EPISODE_REQUEST_FORM);
    setShowRequestForm(false);
    setRequestError('');
  }

  async function submitEpisodeRequest(event) {
    event.preventDefault();
    if (requestSaving) return;
    setRequestSaving(true);
    setRequestError('');
    setRequestSuccess(null);
    try {
      const item = buildEpisodeRequestItem(requestForm);
      const response = await fetch('/api/studio/intake', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ item }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not send this episode request.');
      }
      setRequestSuccess(data.item);
      setRequestForm(EMPTY_EPISODE_REQUEST_FORM);
      setShowRequestForm(false);
    } catch (err) {
      setRequestError(err.message || 'Could not send this episode request.');
    } finally {
      setRequestSaving(false);
    }
  }

  return (
    <StudioLayout
      hasUnsavedChanges={requestDirty}
      unsavedChangesMessage="Discard this episode request?"
    >
      <div className={styles.workspace}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Production workspace</span>
            <h1>My Episodes</h1>
            <p>
              Find every episode connected to you as a host, producer, or
              creator. Open the shared form to prepare material and keep the
              production team current.
            </p>
          </div>
          {!loading && !notConnected && profileName ? (
            <button
              type="button"
              className={styles.primaryButton}
              onClick={() => {
                if (showRequestForm) {
                  closeRequestForm();
                } else {
                  setRequestError('');
                  setRequestSuccess(null);
                  setShowRequestForm(true);
                }
              }}
            >
              <AddRoundedIcon aria-hidden="true" />
              {showRequestForm ? 'Cancel request' : 'Request an episode'}
            </button>
          ) : null}
        </header>

        <section className={styles.summaryGrid} aria-label="Episode summary">
          <div className={styles.summaryCard}>
            <span>My episodes</span>
            <strong>{stats.total}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>In progress</span>
            <strong>{stats.inProgress}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>With producer</span>
            <strong>{stats.withProducer}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Accepted</span>
            <strong>{stats.accepted}</strong>
          </div>
          <div
            className={`${styles.summaryCard} ${
              stats.offTrack ? styles.summaryCardAlert : ''
            }`}
          >
            <span>Off track</span>
            <strong>{stats.offTrack}</strong>
          </div>
        </section>

        {error ? <p className={styles.errorCard}>{error}</p> : null}
        {requestError ? (
          <p className={styles.errorCard} role="alert">
            {requestError}
          </p>
        ) : null}
        {requestSuccess ? (
          <div className={styles.successCard} role="status">
            <strong>Episode request sent.</strong>{' '}
            A manager can now review and schedule it in Team follow-ups.{' '}
            <Link href={`/studio/inbox?item=${requestSuccess.item_id}`}>
              Open the request
            </Link>
            .
          </div>
        ) : null}

        {showRequestForm ? (
          <form className={styles.createPanel} onSubmit={submitEpisodeRequest}>
            <h2>Request an episode</h2>
            <p>
              Share the story and listener value. This creates a tracked team
              request; a manager will confirm the schedule and create the
              Episode Studio.
            </p>
            <div className={styles.createGrid}>
              <label>
                Working episode title
                <input
                  value={requestForm.working_title}
                  maxLength={150}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      working_title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Decision-making in persistent slab terrain"
                  autoFocus
                  required
                />
              </label>
              <label>
                Proposed guest
                <input
                  value={requestForm.proposed_guest}
                  maxLength={180}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      proposed_guest: event.target.value,
                    }))
                  }
                  placeholder="Name or organization (optional)"
                />
              </label>
              <label>
                Preferred air date
                <FriendlyDateField
                  value={requestForm.preferred_air_date}
                  onChange={(event) =>
                    setRequestForm((current) => ({
                      ...current,
                      preferred_air_date: event.target.value,
                    }))
                  }
                  ariaLabel="preferred air date"
                />
              </label>
              <div className={styles.requestVisibilityNote}>
                <strong>Visible to the signed-in team</strong>
                <span>
                  Keep private guest contact details out of the pitch. They can
                  be added after the Studio is approved.
                </span>
              </div>
              <label className={styles.fullField}>
                Pitch and listener takeaway
                <small>
                  Explain the story, why it matters now, and what the audience
                  should learn.
                </small>
                <PlainTextArea
                  value={requestForm.pitch}
                  maxLength={5000}
                  minLength={10}
                  onValueChange={(pitch) =>
                    setRequestForm((current) => ({ ...current, pitch }))
                  }
                  required
                />
              </label>
            </div>
            <div className={styles.createActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={closeRequestForm}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={
                  requestSaving ||
                  requestForm.working_title.trim().length < 3 ||
                  requestForm.pitch.trim().length < 10
                }
              >
                <SendRoundedIcon aria-hidden="true" />
                {requestSaving ? 'Sending…' : 'Send episode request'}
              </button>
            </div>
          </form>
        ) : null}

        <section
          className={`${styles.calendarPanel} ${styles.readOnlyCalendar}`}
          aria-labelledby="upcoming-calendar-title"
        >
          <div className={styles.calendarToolbar}>
            <div>
              <span className={styles.eyebrow}>Read-only schedule</span>
              <h2 id="upcoming-calendar-title">{monthLabel(viewMonth)}</h2>
            </div>
            <div>
              <button
                type="button"
                onClick={() => setViewMonth(monthStart(new Date()))}
                className={styles.calendarToday}
              >
                Today
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() - 1, 1)
                  )
                }
                aria-label="Previous month"
              >
                <ChevronLeftRoundedIcon aria-hidden="true" />
              </button>
              <button
                type="button"
                onClick={() =>
                  setViewMonth(
                    (current) =>
                      new Date(current.getFullYear(), current.getMonth() + 1, 1)
                  )
                }
                aria-label="Next month"
              >
                <ChevronRightRoundedIcon aria-hidden="true" />
              </button>
            </div>
          </div>
          <p className={styles.readOnlyCalendarNote}>
            See the upcoming air schedule without opening another host&apos;s
            work. Calendar entries are not links; Studios assigned to you stay
            available in My Episodes below.
          </p>
          {calendarError ? (
            <p className={styles.readOnlyCalendarError} role="alert">
              {calendarError}
            </p>
          ) : calendarLoading ? (
            <p className={styles.readOnlyCalendarStatus}>
              Loading the upcoming schedule…
            </p>
          ) : (
            <div className={styles.calendarScroll}>
              <div className={styles.calendarGrid}>
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                  (day) => (
                    <div key={day} className={styles.weekday}>
                      {day}
                    </div>
                  )
                )}
                {visibleCalendarDays.map((day) => (
                  <div
                    key={day.key}
                    className={`${styles.calendarDay} ${
                      !day.inMonth ? styles.calendarDayMuted : ''
                    }`}
                  >
                    <span className={styles.readOnlyCalendarDayNumber}>
                      {day.date.getDate()}
                    </span>
                    {(calendarEntriesByDate.get(day.key) || []).map(
                      (entry, index) => (
                        <article
                          key={`${entry.target_release_date}-${entry.title}-${index}`}
                          className={styles.readOnlyCalendarEpisode}
                        >
                          <strong>{entry.title}</strong>
                          <span>{entry.season || 'Upcoming episode'}</span>
                        </article>
                      )
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        <section className={styles.queue}>
          <div className={styles.queueHeader}>
            <h2>Episode Studios</h2>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading your assignments…</div>
          ) : notConnected ? (
            <div className={styles.emptyState}>
              <h2>Your account is not connected to a team profile</h2>
              <p>
                Your episode assignments are safe, but My Episodes cannot match
                them to this login until the one-time profile connection is
                complete.
              </p>
              {canManageAccess ? (
                <Link
                  href="/studio/manage/access"
                  className={styles.primaryButton}
                >
                  Connect my account
                </Link>
              ) : (
                <p>
                  Ask a Studio manager to connect your account in Host &amp; Team
                  Access.
                </p>
              )}
            </div>
          ) : episodes.length ? (
            episodes.map((episode) => (
              <Link
                key={episode.episode_id}
                href={`/studio/episodes/${episode.episode_id}${
                  episode.workflow?.required_task_count ? '/production' : ''
                }`}
                className={`${styles.episodeRow} ${
                  (episode.effective_delivery_health ||
                    episode.delivery_health) === 'off_track'
                    ? styles.episodeRowOffTrack
                    : ''
                }`}
              >
                <div>
                  <strong>{episode.title}</strong>
                  <span>{episode.host_names.join(' + ')}</span>
                  {episode.my_roles?.length ? (
                    <div
                      className={styles.relationshipBadges}
                      aria-label="Your relationship to this episode"
                    >
                      {episode.my_roles.map((relationship) => (
                        <span key={relationship}>
                          {RELATIONSHIP_LABELS[relationship] || relationship}
                        </span>
                      ))}
                    </div>
                  ) : null}
                  {(episode.effective_delivery_health ||
                    episode.delivery_health) === 'off_track' ? (
                    <span className={styles.healthBadge}>Off track</span>
                  ) : null}
                </div>
                <div>
                  <strong>{formatDate(episode.target_release_date)}</strong>
                  <span>Air date</span>
                </div>
                <div>
                  <strong>
                    {episode.deletion_pending
                      ? 'Deletion pending'
                      : STATUS_LABELS[episode.status] || episode.status}
                  </strong>
                  <span>Status</span>
                </div>
                <div className={styles.rowProgress}>
                  <strong>
                    {episode.workflow?.required_task_count
                      ? `${episode.workflow.completion_percent}% production complete`
                      : `${episode.completion.host_percent}% host-ready`}
                  </strong>
                  {episode.workflow?.next_due_task ? (
                    <span>
                      Next: {episode.workflow.next_due_task.label} ·{' '}
                      {formatDate(episode.workflow.next_due_task.due_date)}
                    </span>
                  ) : null}
                  <span className={styles.progressTrack}>
                    <span
                      style={{
                        width: `${
                          episode.workflow?.required_task_count
                            ? episode.workflow.completion_percent
                            : episode.completion.host_percent
                        }%`,
                      }}
                    />
                  </span>
                </div>
                <span>
                  {episode.workflow?.required_task_count
                    ? 'Open production →'
                    : 'Open package →'}
                </span>
              </Link>
            ))
          ) : (
            <div className={styles.emptyState}>
              {profileName
                ? `${profileName} is connected, but no episodes currently list this profile as a host, producer, or creator.`
                : 'Your account is connected, but no episodes are connected to this profile yet.'}
            </div>
          )}
        </section>
      </div>
    </StudioLayout>
  );
}
