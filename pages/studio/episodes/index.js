import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import StudioLayout from '../../../components/StudioLayout';
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
  production_lead: 'Production lead',
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
  const [error, setError] = useState('');
  const [calendarError, setCalendarError] = useState('');
  const [viewMonth, setViewMonth] = useState(monthStart(new Date()));

  useEffect(() => {
    let alive = true;

    function applyCalendarEntries(entries) {
      if (!alive) return;
      const nextEntries = Array.isArray(entries) ? entries : [];
      setCalendarEntries(nextEntries);
      if (nextEntries[0]?.target_release_date) {
        const firstDate = new Date(
          `${nextEntries[0].target_release_date}T12:00:00`
        );
        if (!Number.isNaN(firstDate.getTime())) {
          setViewMonth(monthStart(firstDate));
        }
      }
    }

    async function loadCalendarForUnconnectedProfile() {
      try {
        const response = await fetch('/api/studio/episodes?scope=calendar', {
          credentials: 'same-origin',
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error || 'Could not load the episode calendar.'
          );
        }
        applyCalendarEntries(data.calendar);
      } catch (err) {
        if (alive) {
          setCalendarError(
            err.message || 'Could not load the episode calendar.'
          );
        }
      }
    }

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
            await loadCalendarForUnconnectedProfile();
            return;
          }
          throw new Error(data.error || 'Could not load your episodes.');
        }
        if (alive) {
          setEpisodes(data.episodes || []);
          applyCalendarEntries(data.calendar);
          setProfileName(data.profile_connection?.person_name || '');
          setNotConnected(false);
        }
      } catch (err) {
        if (alive) setError(err.message || 'Could not load your episodes.');
      } finally {
        if (alive) {
          setLoading(false);
          setCalendarLoading(false);
        }
      }
    }
    loadEpisodes();
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

  return (
    <StudioLayout>
      <div className={styles.workspace}>
        <nav
          className={styles.episodeWorkspaceTabs}
          aria-label="Host Studio sections"
        >
          <Link
            href="/studio/episodes"
            className={styles.episodeWorkspaceTabActive}
            aria-current="page"
          >
            Episodes
          </Link>
          <Link href="/studio/episodes/ideas">Ideas &amp; requests</Link>
        </nav>
        <header className={styles.pageHeader}>
          <div>
            <span className={styles.eyebrow}>Season workflow · Step 3</span>
            <h1>Host Studio</h1>
            <p>
              Find every episode connected to you as a host, producer, or
              creator. Open an assigned Studio below, or pitch and track a new
              episode in Ideas &amp; requests.
            </p>
          </div>
          {!loading && !notConnected && profileName ? (
            <Link
              href="/studio/episodes/ideas?new=1"
              className={styles.primaryButton}
            >
              <AddRoundedIcon aria-hidden="true" />
              Pitch an episode
            </Link>
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
            available in your Host Studio below.
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

        <section id="my-episodes" className={styles.queue}>
          <div className={styles.queueHeader}>
            <h2>Your episodes</h2>
          </div>
          {loading ? (
            <div className={styles.emptyState}>Loading your assignments…</div>
          ) : notConnected ? (
            <div className={styles.emptyState}>
              <h2>Your account is not connected to a team profile</h2>
              <p>
                Your episode assignments are safe, but Host Studio cannot match
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
                href={`/studio/episodes/${encodeURIComponent(
                  episode.episode_id
                )}`}
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
                    {episode.completion.host_percent}% host-ready
                  </strong>
                  <span className={styles.progressTrack}>
                    <span
                      style={{
                        width: `${episode.completion.host_percent}%`,
                      }}
                    />
                  </span>
                </div>
                <span>Open Host Studio →</span>
              </Link>
            ))
          ) : (
            <div className={styles.emptyState}>
              {profileName
                ? `${profileName} is connected, but no episodes currently list this profile as a host, producer, production lead, or creator.`
                : 'Your account is connected, but no episodes are connected to this profile yet.'}
            </div>
          )}
        </section>
      </div>
    </StudioLayout>
  );
}
