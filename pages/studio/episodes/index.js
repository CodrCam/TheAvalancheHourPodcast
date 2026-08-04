import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
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

export default function HostEpisodesPage() {
  const [episodes, setEpisodes] = useState([]);
  const [profileName, setProfileName] = useState('');
  const [notConnected, setNotConnected] = useState(false);
  const [canManageAccess, setCanManageAccess] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

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

  return (
    <StudioLayout>
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
                  Ask a Studio manager to connect your account in Host Access.
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
