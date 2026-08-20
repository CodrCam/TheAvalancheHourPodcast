import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import AdminLayout from '../../../components/AdminLayout';
import { EpisodeRecordingFields } from '../../../components/EpisodeRecordingSchedule';
import FriendlyDateField from '../../../components/FriendlyDateField';
import StudioLayout from '../../../components/StudioLayout';
import {
  consumeEpisodeStudioDeletionNotice,
  getEpisodeStudioDeletionNoticeCopy,
} from '../../../lib/episodeStudioDeletionNotice.mjs';
import {
  episodeScheduleHref,
  listEpisodeScheduleMonth,
} from '../../../lib/episodeSchedulePresentation.mjs';
import styles from '../../../styles/EpisodeStudio.module.css';

const STATUS_LABELS = {
  planning: 'Planning',
  in_progress: 'Host in progress',
  submitted: 'Ready for production',
  submitted_with_gaps: 'Known gaps',
  needs_changes: 'Changes requested',
  accepted: 'Accepted',
};

const EMPTY_FORM = {
  title: '',
  season: 'Season 11',
  target_release_date: '',
  due_date: '',
  recording_date: '',
  recording_time: '',
  recording_time_zone: '',
  recording_duration_minutes: 60,
  recording_location: '',
  creation_exception_kind: '',
  creation_exception_reason: '',
  producer_person_id: '',
  producer_email: '',
  host_person_ids: [],
};

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

function formatShortDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(`${value}T12:00:00`);
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function dateDaysBefore(value, days = 10) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const date = new Date(`${value}T12:00:00`);
  date.setDate(date.getDate() - days);
  return dateKey(date);
}

function isEpisodeOffTrack(episode = {}) {
  return (
    (episode.effective_delivery_health || episode.delivery_health) ===
    'off_track'
  );
}

function nextWorkflowLabel(episode = {}) {
  const nextTask = episode.workflow?.next_due_task;
  if (!nextTask) {
    return episode.workflow?.required_task_count
      ? 'Production workflow complete'
      : 'Host package workflow';
  }
  return `${nextTask.label} · ${formatShortDate(nextTask.due_date)}`;
}

export function EpisodeStudiosDashboard({
  studioLayout = false,
  previewData = null,
}) {
  const router = useRouter();
  const preview = previewData !== null;
  const [episodes, setEpisodes] = useState(() => previewData?.episodes || []);
  const [people, setPeople] = useState(() => previewData?.people || []);
  const [producers, setProducers] = useState(
    () => previewData?.producers || []
  );
  const [configured, setConfigured] = useState(
    () => previewData?.configured !== false
  );
  const [loading, setLoading] = useState(!preview);
  const [creating, setCreating] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [query, setQuery] = useState('');
  const [viewMonth, setViewMonth] = useState(() => {
    const previewMonth = String(
      previewData?.view_month ||
        previewData?.episodes?.[0]?.target_release_date ||
        ''
    );
    const previewDate = /^\d{4}-\d{2}/.test(previewMonth)
      ? new Date(`${previewMonth.slice(0, 7)}-01T12:00:00`)
      : null;
    return previewDate && !Number.isNaN(previewDate.getTime())
      ? monthStart(previewDate)
      : monthStart(new Date());
  });
  const [error, setError] = useState('');
  const [deletionNotice, setDeletionNotice] = useState(null);
  const createPanelRef = useRef(null);
  const titleInputRef = useRef(null);
  const focusCreateRef = useRef(false);
  const Layout = studioLayout ? StudioLayout : AdminLayout;
  const detailBase = studioLayout ? '/studio/episodes' : '/admin/studios';
  const previewEpisodeHref = preview
    ? previewData.episode_href || '/dev/episode-studio-usability-preview'
    : '';

  function hrefFor(href) {
    return previewData?.href_map?.[href] || href;
  }

  function episodeHref(episode) {
    return episodeScheduleHref(detailBase, episode, previewEpisodeHref);
  }

  async function loadStudios() {
    setLoading(true);
    setError('');
    try {
      const response = await fetch('/api/studio/episodes', {
        credentials: 'same-origin',
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not load Episode Studios.');
      }
      const nextEpisodes = data.episodes || [];
      setEpisodes(nextEpisodes);
      setPeople(data.people || []);
      setProducers(data.producers || []);
      setConfigured(data.configured !== false);
      const today = dateKey(new Date());
      const calendarAnchor =
        nextEpisodes.find(
          (episode) => episode.target_release_date >= today
        ) || nextEpisodes[nextEpisodes.length - 1];
      if (calendarAnchor?.target_release_date) {
        const firstRelease = new Date(
          `${calendarAnchor.target_release_date}T12:00:00`
        );
        if (!Number.isNaN(firstRelease.getTime())) {
          setViewMonth(monthStart(firstRelease));
        }
      }
    } catch (err) {
      setError(err.message || 'Could not load Episode Studios.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (preview) return;
    loadStudios();
  }, [preview]);

  useEffect(() => {
    if (preview) return;
    const notice = consumeEpisodeStudioDeletionNotice(window.sessionStorage);
    const frame = window.requestAnimationFrame(() => {
      setDeletionNotice(notice);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [preview]);

  useEffect(() => {
    if (!showCreate || !focusCreateRef.current) return;
    focusCreateRef.current = false;
    const frame = window.requestAnimationFrame(() => {
      createPanelRef.current?.scrollIntoView({
        behavior: 'smooth',
        block: 'start',
      });
      titleInputRef.current?.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [showCreate]);

  const days = useMemo(() => calendarDays(viewMonth), [viewMonth]);
  const episodesByDate = useMemo(() => {
    const map = new Map();
    for (const episode of episodes) {
      const rows = map.get(episode.target_release_date) || [];
      rows.push(episode);
      map.set(episode.target_release_date, rows);
    }
    return map;
  }, [episodes]);
  const filteredEpisodes = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    const matchingEpisodes = normalized
      ? episodes.filter((episode) =>
          [
            episode.title,
            episode.season,
            episode.status,
            episode.delivery_health,
            ...(episode.host_names || []),
          ]
            .join(' ')
            .toLowerCase()
            .includes(normalized)
        )
      : episodes;

    return [...matchingEpisodes].sort(
      (a, b) =>
        Number(isEpisodeOffTrack(b)) - Number(isEpisodeOffTrack(a)) ||
        String(a.target_release_date || '9999').localeCompare(
          String(b.target_release_date || '9999')
        )
    );
  }, [episodes, query]);
  const monthEpisodes = useMemo(
    () => listEpisodeScheduleMonth(episodes, viewMonth),
    [episodes, viewMonth]
  );
  const stats = useMemo(
    () => {
      const activeEpisodes = episodes.filter(
        (episode) => !episode.deletion_pending
      );
      return {
        scheduled: activeEpisodes.length,
        hostWork: activeEpisodes.filter((episode) =>
          ['planning', 'in_progress', 'needs_changes'].includes(episode.status)
        ).length,
        producerReady: activeEpisodes.filter((episode) =>
          ['submitted', 'submitted_with_gaps'].includes(episode.status)
        ).length,
        accepted: activeEpisodes.filter(
          (episode) => episode.status === 'accepted'
        ).length,
        offTrack: activeEpisodes.filter((episode) =>
          isEpisodeOffTrack(episode)
        ).length,
      };
    },
    [episodes]
  );
  const createDirty =
    showCreate && JSON.stringify(form) !== JSON.stringify(EMPTY_FORM);
  const deletionNoticeCopy = useMemo(
    () =>
      deletionNotice
        ? getEpisodeStudioDeletionNoticeCopy(deletionNotice)
        : null,
    [deletionNotice]
  );

  function toggleHost(personId) {
    setForm((current) => ({
      ...current,
      host_person_ids: current.host_person_ids.includes(personId)
        ? current.host_person_ids.filter((id) => id !== personId)
        : [...current.host_person_ids, personId],
    }));
  }

  function updateReleaseDate(targetReleaseDate) {
    setForm((current) => {
      const previousAutomaticDue = dateDaysBefore(
        current.target_release_date,
        10
      );
      const shouldUpdateDue =
        !current.due_date || current.due_date === previousAutomaticDue;
      return {
        ...current,
        target_release_date: targetReleaseDate,
        due_date: shouldUpdateDue
          ? dateDaysBefore(targetReleaseDate, 10)
          : current.due_date,
      };
    });
  }

  function openCreate(date = '') {
    if (preview) return;
    focusCreateRef.current = true;
    if (date) {
      updateReleaseDate(date);
      const selectedDate = new Date(`${date}T12:00:00`);
      if (!Number.isNaN(selectedDate.getTime())) {
        setViewMonth(monthStart(selectedDate));
      }
    }
    setShowCreate(true);
  }

  async function createStudio(event) {
    event.preventDefault();
    if (preview) return;
    if (
      !form.title.trim() ||
      !form.target_release_date ||
      !form.host_person_ids.length ||
      !form.producer_person_id ||
      !form.creation_exception_kind ||
      form.creation_exception_reason.trim().length < 10
    ) {
      setError(
        'Add a title, air date, host, producer, exception type, and a short reason.'
      );
      return;
    }
    const recordingStarted = Boolean(
      form.recording_date ||
        form.recording_time ||
        form.recording_time_zone ||
        form.recording_location.trim()
    );
    if (
      recordingStarted &&
      (!form.recording_date ||
        !form.recording_time ||
        !form.recording_time_zone)
    ) {
      setError(
        'Complete the recording date, time, and time zone, or leave the recording schedule blank.'
      );
      return;
    }
    setCreating(true);
    setError('');
    try {
      const response = await fetch('/api/studio/episodes', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ episode: form }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not create the Episode Studio.');
      }
      setForm(EMPTY_FORM);
      setShowCreate(false);
      await router.push(`${detailBase}/${data.episode.episode_id}`);
    } catch (err) {
      setError(err.message || 'Could not create the Episode Studio.');
    } finally {
      setCreating(false);
    }
  }

  return (
    <Layout
      {...(studioLayout ? { requiredPermission: 'episodes:manage' } : {})}
      {...(preview
        ? {
            previewSession: previewData.session,
            previewPath: '/studio/manage/episodes',
            previewHrefMap: previewData.href_map,
          }
        : {})}
      hasUnsavedChanges={createDirty}
      unsavedChangesMessage="Discard this new Episode Studio setup?"
      wide
    >
      <div className={styles.workspace}>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Studio manager workspace</span>
            <h1>Schedule &amp; assignments</h1>
            <p>
              Create Episode Studios, place them on the season calendar, and
              assign the hosts and producer before work begins.
            </p>
          </div>
          <button
            type="button"
            className={styles.primaryButton}
            disabled={preview}
            title={
              preview ? 'Creation is disabled in the local preview.' : ''
            }
            onClick={() => {
              if (showCreate) {
                setForm(EMPTY_FORM);
                setShowCreate(false);
              } else {
                openCreate();
              }
            }}
          >
            <AddRoundedIcon aria-hidden="true" />
            New Episode Studio
          </button>
        </header>

        {studioLayout ? (
          <section
            className={styles.creationPathNotice}
            aria-labelledby="episode-creation-path-title"
          >
            <div>
              <span>Season 11 creation path</span>
              <strong id="episode-creation-path-title">
                Move reviewed plans from Mastermind into production.
              </strong>
              <p>
                Episode requests begin in Host Studio, are reviewed in
                Follow-ups, and become Episode Studios from a Ready Mastermind
                plan. Use manual creation only for an approved exception or a
                legacy episode that has no planning record.
              </p>
            </div>
            <div>
              <Link href={hrefFor('/studio/mastermind')}>Open Mastermind</Link>
              <Link href={hrefFor('/studio/inbox')}>Review requests</Link>
            </div>
          </section>
        ) : null}

        <section className={styles.summaryGrid} aria-label="Production summary">
          <div className={styles.summaryCard}>
            <span>Scheduled episodes</span>
            <strong>{stats.scheduled}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>With hosts</span>
            <strong>{stats.hostWork}</strong>
          </div>
          <div className={styles.summaryCard}>
            <span>Producer queue</span>
            <strong>{stats.producerReady}</strong>
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

        {!configured ? (
          <p className={styles.errorCard}>
            Episode Studio storage is not configured. Check the existing
            site-content DynamoDB environment settings.
          </p>
        ) : null}
        {error ? <p className={styles.errorCard}>{error}</p> : null}
        {deletionNoticeCopy ? (
          <section
            className={
              deletionNotice.status === 'deleted'
                ? styles.successCard
                : styles.feedbackBanner
            }
            role="status"
          >
            <strong>{deletionNoticeCopy.heading}</strong>
            <p>{deletionNoticeCopy.body}</p>
          </section>
        ) : null}

        {showCreate ? (
          <form
            ref={createPanelRef}
            className={styles.createPanel}
            onSubmit={createStudio}
          >
            <h2>Create an Episode Studio</h2>
            <p>
              Manual exception path: the air date places it on the calendar,
              and the assigned hosts immediately share one production form.
              Use a Ready Mastermind plan whenever one exists so the planning
              and production records stay linked.
            </p>
            <div className={styles.createGrid}>
              <label>
                Exception type
                <select
                  value={form.creation_exception_kind}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      creation_exception_kind: event.target.value,
                    }))
                  }
                  required
                >
                  <option value="">Choose a reason</option>
                  <option value="legacy">Legacy episode</option>
                  <option value="urgent_exception">Urgent exception</option>
                </select>
              </label>
              <label className={styles.fullField}>
                Exception note
                <textarea
                  value={form.creation_exception_reason}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      creation_exception_reason: event.target.value,
                    }))
                  }
                  minLength={10}
                  maxLength={500}
                  rows={3}
                  placeholder="Why this episode cannot start from a reviewed Mastermind plan"
                  required
                />
              </label>
              <label>
                Working episode title
                <input
                  ref={titleInputRef}
                  value={form.title}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="e.g. Forecasting a persistent slab problem"
                  required
                />
              </label>
              <label>
                Season
                <input
                  value={form.season}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      season: event.target.value,
                    }))
                  }
                />
              </label>
              <label>
                Air date
                <FriendlyDateField
                  value={form.target_release_date}
                  onChange={(event) =>
                    updateReleaseDate(event.target.value)
                  }
                  ariaLabel="air date"
                  required
                />
              </label>
              <label>
                Host package due
                <FriendlyDateField
                  value={form.due_date}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      due_date: event.target.value,
                    }))
                  }
                  ariaLabel="host package due date"
                />
              </label>
              <EpisodeRecordingFields
                schedule={form}
                onChange={(patch) =>
                  setForm((current) => ({ ...current, ...patch }))
                }
              />
              <label>
                Producer
                <select
                  value={form.producer_person_id}
                  onChange={(event) => {
                    const producerPersonId = event.target.value;
                    const producer = producers.find(
                      (candidate) =>
                        candidate.person_id === producerPersonId
                    );
                    setForm((current) => ({
                      ...current,
                      producer_person_id: producerPersonId,
                      producer_email:
                        producer?.account_email || current.producer_email,
                    }));
                  }}
                >
                  <option value="">Choose a producer</option>
                  {producers.map((producer) => (
                    <option
                      key={producer.person_id}
                      value={producer.person_id}
                    >
                      {producer.name}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.fullField}>
                Producer notification email
                <input
                  type="email"
                  value={form.producer_email}
                  onChange={(event) =>
                    setForm((current) => ({
                      ...current,
                      producer_email: event.target.value,
                    }))
                  }
                  placeholder="Leave blank to use the signed-in producer or configured team email"
                />
              </label>
            </div>
            <div className={styles.assignmentPicker}>
              <strong>Assign hosts</strong>
              <div>
                {people.map((person) => (
                  <label
                    key={person.person_id}
                    className={
                      form.host_person_ids.includes(person.person_id)
                        ? styles.assignmentActive
                        : ''
                    }
                    title={
                      person.connected
                        ? 'Host account connected'
                        : 'Profile is not connected to a Cognito account yet'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={form.host_person_ids.includes(person.person_id)}
                      onChange={() => toggleHost(person.person_id)}
                    />
                    {person.name}
                    {!person.connected ? ' · access pending' : ''}
                  </label>
                ))}
              </div>
            </div>
            <div className={styles.createActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                onClick={() => {
                  setForm(EMPTY_FORM);
                  setShowCreate(false);
                }}
              >
                Cancel
              </button>
              <button
                type="submit"
                className={styles.primaryButton}
                disabled={creating}
              >
                {creating ? 'Creating…' : 'Create Studio'}
              </button>
            </div>
          </form>
        ) : null}

        <div className={styles.scheduleMonthShell}>
          <div className={styles.scheduleMonthLayout}>
            <section className={styles.calendarPanel}>
              <div className={styles.calendarToolbar}>
                <h2>{monthLabel(viewMonth)}</h2>
                <div>
                  <button
                    className={styles.calendarToday}
                    type="button"
                    onClick={() => setViewMonth(monthStart(new Date()))}
                  >
                    Today
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setViewMonth(
                        (current) =>
                          new Date(
                            current.getFullYear(),
                            current.getMonth() - 1,
                            1
                          )
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
                          new Date(
                            current.getFullYear(),
                            current.getMonth() + 1,
                            1
                          )
                      )
                    }
                    aria-label="Next month"
                  >
                    <ChevronRightRoundedIcon aria-hidden="true" />
                  </button>
                </div>
              </div>
              <div
                className={styles.calendarScroll}
                role="region"
                tabIndex={0}
                aria-label={`${monthLabel(viewMonth)} calendar grid`}
              >
                <div className={styles.calendarGrid}>
                  {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(
                    (day) => (
                      <div key={day} className={styles.weekday}>
                        {day}
                      </div>
                    )
                  )}
                  {days.map((day) => (
                    <div
                      key={day.key}
                      className={`${styles.calendarDay} ${
                        !day.inMonth ? styles.calendarDayMuted : ''
                      }`}
                    >
                      <button
                        type="button"
                        className={styles.calendarDayTarget}
                        disabled={preview}
                        onClick={() => openCreate(day.key)}
                        aria-label={`Create an episode for ${day.date.toLocaleDateString(
                          undefined,
                          {
                            month: 'long',
                            day: 'numeric',
                            year: 'numeric',
                          }
                        )}`}
                      >
                        <span>{day.date.getDate()}</span>
                        <small>+ episode</small>
                      </button>
                      {(episodesByDate.get(day.key) || []).map((episode) => (
                        <Link
                          key={episode.episode_id}
                          href={episodeHref(episode)}
                          tabIndex={-1}
                          className={`${styles.calendarEpisode} ${
                            isEpisodeOffTrack(episode)
                              ? styles.calendarEpisodeOffTrack
                              : ''
                          }`}
                          aria-label={`Open ${episode.title}`}
                          title={episode.title}
                        >
                          <strong>{episode.title}</strong>
                          <span>
                            {episode.deletion_pending
                              ? 'Deletion scheduled'
                              : isEpisodeOffTrack(episode)
                                ? 'Off track'
                                : episode.workflow?.required_task_count
                                  ? `${episode.workflow.completion_percent}% workflow complete`
                                  : `${episode.completion.host_percent}% host-ready · ${
                                      STATUS_LABELS[episode.status] ||
                                      episode.status
                                    }`}
                          </span>
                        </Link>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
            </section>

            <aside
              className={styles.monthAgenda}
              aria-labelledby="schedule-month-agenda-title"
            >
              <header className={styles.monthAgendaHeader}>
                <div>
                  <span className={styles.eyebrow}>Selected month</span>
                  <h2
                    id="schedule-month-agenda-title"
                    aria-live="polite"
                    aria-atomic="true"
                  >
                    {monthLabel(viewMonth)} assignments
                  </h2>
                </div>
                <span className={styles.monthAgendaCount}>
                  {loading
                    ? 'Loading…'
                    : `${monthEpisodes.length} ${
                        monthEpisodes.length === 1 ? 'episode' : 'episodes'
                      }`}
                </span>
              </header>
              <div className={styles.monthAgendaList}>
                {loading ? (
                  <p className={styles.monthAgendaEmpty}>
                    Loading this month…
                  </p>
                ) : monthEpisodes.length ? (
                  monthEpisodes.map((episode) => (
                    <Link
                      key={episode.episode_id}
                      href={episodeHref(episode)}
                      className={`${styles.monthAgendaRow} ${
                        isEpisodeOffTrack(episode)
                          ? styles.monthAgendaRowOffTrack
                          : ''
                      }`}
                    >
                      <time dateTime={episode.target_release_date}>
                        {formatShortDate(episode.target_release_date)}
                      </time>
                      <strong>{episode.title}</strong>
                      <span>
                        {episode.host_names.length
                          ? episode.host_names.join(' + ')
                          : 'Hosts unassigned'}
                        {episode.producer_name
                          ? ` · ${episode.producer_name}`
                          : ' · Producer unassigned'}
                      </span>
                      <small>
                        {episode.deletion_pending
                          ? 'Deletion scheduled'
                          : isEpisodeOffTrack(episode)
                            ? 'Off track'
                            : STATUS_LABELS[episode.status] || episode.status}
                      </small>
                    </Link>
                  ))
                ) : (
                  <p className={styles.monthAgendaEmpty}>
                    No episodes are scheduled for {monthLabel(viewMonth)}.
                    {!preview ? ' Use a calendar day to create one.' : ''}
                  </p>
                )}
              </div>
            </aside>
          </div>
        </div>

        <section id="production-queue" className={styles.queue}>
          <div className={styles.queueHeader}>
            <h2>Production queue</h2>
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search episodes or hosts…"
              aria-label="Search Episode Studios"
            />
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading the season…</div>
          ) : filteredEpisodes.length ? (
            filteredEpisodes.map((episode) => (
              <Link
                key={episode.episode_id}
                href={episodeHref(episode)}
                className={`${styles.episodeRow} ${
                  isEpisodeOffTrack(episode)
                    ? styles.episodeRowOffTrack
                    : ''
                }`}
              >
                <div>
                  <strong>{episode.title}</strong>
                  <span>{episode.host_names.join(' + ')}</span>
                  {isEpisodeOffTrack(episode) ? (
                    <span className={styles.healthBadge}>Off track</span>
                  ) : null}
                </div>
                <div>
                  <strong>{formatShortDate(episode.target_release_date)}</strong>
                  <span>Air date</span>
                </div>
                <div>
                  <strong>
                    {episode.deletion_pending
                      ? 'Deletion scheduled'
                      : STATUS_LABELS[episode.status] || episode.status}
                  </strong>
                  <span>Status</span>
                </div>
                <div className={styles.rowProgress}>
                  <strong>
                    {episode.deletion_pending
                      ? 'Protected cleanup in progress'
                      : episode.workflow?.required_task_count
                      ? `${episode.workflow.completion_percent}% production complete`
                      : `${episode.completion.host_percent}% host-ready`}
                  </strong>
                  <span>
                    {episode.deletion_pending
                      ? 'Automatic cleanup will remove the private Studio.'
                      : nextWorkflowLabel(episode)}
                  </span>
                  {!episode.deletion_pending ? (
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
                  ) : null}
                </div>
                <span>
                  {episode.deletion_pending
                    ? 'View deletion status →'
                    : episode.workflow?.required_task_count
                    ? 'Open production →'
                    : 'Open package →'}
                </span>
              </Link>
            ))
          ) : (
            <div className={styles.emptyState}>
              {episodes.length
                ? 'No Episode Studios match that search.'
                : 'No episodes are scheduled yet. Create the first Studio to start the production calendar.'}
            </div>
          )}
        </section>
      </div>
    </Layout>
  );
}

export default function EpisodeStudiosAdminPage() {
  return <EpisodeStudiosDashboard />;
}
