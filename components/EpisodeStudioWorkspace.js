import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import AdminLayout from './AdminLayout';
import FriendlyDateField from './FriendlyDateField';
import StudioLayout from './StudioLayout';
import {
  areProducerDirectionsComplete,
  getEpisodeCompletion,
  isDeliverableComplete,
  mergeEpisodeStudioServerFields,
  PRODUCER_DIRECTIONS_MIN_LENGTH,
} from '../lib/episodeStudioPresentation.mjs';
import styles from '../styles/EpisodeStudio.module.css';

const STATUS_LABELS = {
  planning: 'Planning',
  in_progress: 'Host in progress',
  submitted: 'Ready for production',
  submitted_with_gaps: 'Producer working · known gaps',
  needs_changes: 'Changes requested',
  accepted: 'Accepted by producer',
};

const LOCKED_HOST_STATUSES = [
  'submitted',
  'submitted_with_gaps',
  'accepted',
];

const PRODUCER_DIRECTIONS_PLACEHOLDER = `FINAL CUT
Describe the intended pace, tone, story arc, and any moments that must stay.

AUDIO / EDITS
mission-ridge_interview_jordan_raw.wav | 00:18:42–00:19:07 | CUT | Duplicate answer; join to “Our morning starts…”

IMAGES
mission-ridge_photo-01_jordan-ridgeline.jpg | COVER | Crop 16:9; keep Jordan and the full ridgeline visible | Photo: Alex Rivera | Permission confirmed

FACT CHECK / PRONUNCIATION / DO NOT USE
List anything the producer must verify, pronounce carefully, or leave out.`;

const DELIVERY_HEALTH_FIELDS = [
  'delivery_health',
  'delivery_health_updated_at',
  'delivery_health_updated_by_person_id',
  'delivery_health_updated_by_name',
  'delivery_health_updated_by_role',
  'updated_at',
];

const REVIEW_RESPONSE_FIELDS = [
  'status',
  'producer_feedback',
  'reviewed_at',
  'updated_at',
];

const MESSAGE_RESPONSE_FIELDS = ['messages', 'updated_at'];

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function materialPlaceholder(deliverable) {
  if (deliverable.id === 'recording-files') {
    return 'Paste the Riverside studio or recording link';
  }
  if (deliverable.id === 'photos') {
    return 'Paste the Google Drive image-folder link';
  }
  if (deliverable.type === 'url') {
    return 'Paste the Google Drive, Riverside, or document link';
  }
  return 'Fill this in for the producer…';
}

export default function EpisodeStudioWorkspace({ admin = false }) {
  const router = useRouter();
  const episodeId = String(router.query.episodeId || '');
  const [episode, setEpisode] = useState(null);
  const [hostNames, setHostNames] = useState([]);
  const [people, setPeople] = useState([]);
  const [producers, setProducers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    if (!router.isReady || !episodeId) return;
    let alive = true;

    async function loadEpisode() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/studio/episodes/${encodeURIComponent(episodeId)}`,
          { credentials: 'same-origin' }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not open this Episode Studio.');
        }
        if (!alive) return;
        setEpisode(data.episode);
        setHostNames(data.host_names || []);
        setPeople(data.people || []);
        setProducers(data.producers || []);
        setCanManage(data.canManage === true);
        setBaseline(JSON.stringify(data.episode));
      } catch (err) {
        if (alive) setError(err.message || 'Could not open this Episode Studio.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadEpisode();
    return () => {
      alive = false;
    };
  }, [episodeId, router.isReady]);

  const completion = useMemo(
    () => getEpisodeCompletion(episode || {}),
    [episode]
  );
  const producerDirectionsComplete = areProducerDirectionsComplete(
    episode?.producer_directions
  );
  const producerDirectionsLength = String(
    episode?.producer_directions || ''
  ).trim().length;
  const healthLocked = episode?.status === 'accepted';
  const offTrack =
    !healthLocked && episode?.delivery_health === 'off_track';
  const dirty = Boolean(episode && JSON.stringify(episode) !== baseline);
  const lockedForHost =
    !canManage && LOCKED_HOST_STATUSES.includes(episode?.status);
  const Layout = admin ? AdminLayout : StudioLayout;
  const listHref = admin
    ? '/admin/studios'
    : canManage
      ? '/studio/manage/episodes'
      : '/studio/episodes';

  function replaceEpisode(nextEpisode) {
    setEpisode(nextEpisode);
    setBaseline(JSON.stringify(nextEpisode));
  }

  function updateEpisode(patch) {
    setEpisode((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
  }

  function updateDeliverable(deliverableId, patch) {
    setEpisode((current) => ({
      ...current,
      deliverables: current.deliverables.map((deliverable) =>
        deliverable.id === deliverableId
          ? { ...deliverable, ...patch }
          : deliverable
      ),
    }));
    setMessage('');
    setError('');
  }

  function mergeServerFields(serverEpisode, fields) {
    setEpisode((current) =>
      mergeEpisodeStudioServerFields(current, serverEpisode, fields)
    );
    setBaseline((current) => {
      try {
        return JSON.stringify(
          mergeEpisodeStudioServerFields(
            JSON.parse(current || '{}'),
            serverEpisode,
            fields
          )
        );
      } catch {
        return current;
      }
    });
  }

  async function sendUpdate(
    body,
    successMessage,
    { mergeFields = [] } = {}
  ) {
    if (!episode || saving) return null;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episode.episode_id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            expected_updated_at: episode.updated_at,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update this Episode Studio.');
      }
      if (mergeFields.length) {
        mergeServerFields(data.episode, mergeFields);
      } else {
        replaceEpisode(data.episode);
      }
      setHostNames(data.host_names || hostNames);
      const notificationNote =
        data.notification && !data.notification.sent
          ? ` ${data.notification.reason}`
          : '';
      setMessage(`${successMessage}${notificationNote}`);
      return data;
    } catch (err) {
      setError(err.message || 'Could not update this Episode Studio.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function setDeliveryHealth(deliveryHealth) {
    if (!episode || saving || healthLocked) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episode.episode_id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_delivery_health',
            delivery_health: deliveryHealth,
            expected_updated_at: episode.updated_at,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Could not update the episode delivery outlook.'
        );
      }

      mergeServerFields(data.episode, DELIVERY_HEALTH_FIELDS);
      setMessage(
        deliveryHealth === 'off_track'
          ? 'The episode is now visibly marked Off track.'
          : 'The episode is back On track.'
      );
    } catch (err) {
      setError(
        err.message || 'Could not update the episode delivery outlook.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (canManage) {
      await sendUpdate(
        { action: 'update', episode },
        'Episode Studio saved.'
      );
      return;
    }
    await sendUpdate(
      {
        action: 'save',
        deliverables: episode.deliverables,
        producer_directions: episode.producer_directions,
      },
      'Draft saved.'
    );
  }

  async function submitEpisode(submissionMode) {
    const provisional = submissionMode === 'with_gaps';
    const confirmed = window.confirm(
      provisional
        ? 'Send this episode to the producer with the acknowledged missing items?'
        : 'Send this complete episode package to the producer?'
    );
    if (!confirmed) return;

    await sendUpdate(
      {
        action: 'submit',
        submission_mode: submissionMode,
        deliverables: episode.deliverables,
        producer_directions: episode.producer_directions,
      },
      provisional
        ? 'The producer has been notified about this episode and its known gaps.'
        : 'The complete episode package has been sent to the producer.'
    );
  }

  async function reviewEpisode(status) {
    const actionLabel =
      status === 'accepted' ? 'accept this episode package' : 'request changes';
    if (!window.confirm(`Confirm you want to ${actionLabel}?`)) return;
    await sendUpdate(
      {
        action: 'review',
        status,
        producer_feedback: episode.producer_feedback,
      },
      status === 'accepted'
        ? 'Episode package accepted.'
        : 'The episode is open for host revisions.',
      { mergeFields: REVIEW_RESPONSE_FIELDS }
    );
  }

  async function postMessage(event) {
    event.preventDefault();
    const body = messageDraft.trim();
    if (!body) return;
    const data = await sendUpdate(
      { action: 'message', message: body },
      'Update posted to the episode discussion.',
      { mergeFields: MESSAGE_RESPONSE_FIELDS }
    );
    if (data) setMessageDraft('');
  }

  return (
    <Layout
      hasUnsavedChanges={dirty || Boolean(messageDraft.trim())}
      unsavedChangesMessage="You have unsaved episode material. Leave and discard it?"
    >
      <div className={styles.workspace}>
        <Link href={listHref} className={styles.backLink}>
          <ArrowBackRoundedIcon aria-hidden="true" />
          {admin || canManage ? 'Production calendar' : 'My episodes'}
        </Link>

        {loading ? (
          <section className={styles.loadingCard}>Opening Episode Studio…</section>
        ) : error && !episode ? (
          <section className={styles.errorCard}>{error}</section>
        ) : episode ? (
          <>
            <header className={styles.workspaceHeader}>
              <div>
                <span className={styles.eyebrow}>Episode Studio</span>
                <h1>{episode.title}</h1>
                <p>
                  {hostNames.join(' + ') || 'Host assignment pending'} ·{' '}
                  {episode.season || 'Season 11'}
                </p>
              </div>
              <span
                className={`${styles.statusPill} ${
                  styles[`status_${episode.status}`] || ''
                }`}
              >
                {STATUS_LABELS[episode.status] || episode.status}
              </span>
            </header>

            <section
              className={`${styles.healthPanel} ${
                offTrack ? styles.healthPanelOffTrack : ''
              }`}
            >
              <div className={styles.healthCopy}>
                <span className={styles.eyebrow}>Delivery outlook</span>
                <strong>
                  {healthLocked
                    ? 'Delivery complete'
                    : offTrack
                      ? 'Off track'
                      : 'On track'}
                </strong>
                <p>
                  {healthLocked
                    ? 'The producer has accepted this episode package, so its delivery outlook is complete.'
                    : offTrack
                    ? 'The expected host-package date is at risk. This signal is visible to the production team; add details to the discussion when you are ready.'
                    : 'The team currently expects this episode package to arrive by its planned due date.'}
                </p>
                {!healthLocked &&
                episode.delivery_health_updated_by_name ? (
                  <small>
                    {offTrack ? 'Flagged' : 'Marked on track'} by{' '}
                    {episode.delivery_health_updated_by_name}
                    {episode.delivery_health_updated_at
                      ? ` · ${formatDateTime(
                          episode.delivery_health_updated_at
                        )}`
                      : ''}
                  </small>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={offTrack}
                className={`${styles.healthSwitch} ${
                  offTrack ? styles.healthSwitchActive : ''
                }`}
                disabled={saving || healthLocked}
                onClick={() =>
                  setDeliveryHealth(offTrack ? 'on_track' : 'off_track')
                }
              >
                <span className={styles.healthSwitchTrack} aria-hidden="true">
                  <span />
                </span>
                <span>
                  {healthLocked
                    ? 'Accepted'
                    : offTrack
                      ? 'Mark on track'
                      : 'Flag off track'}
                </span>
              </button>
            </section>

            <section className={styles.productionStrip}>
              <div>
                <span>Release</span>
                <strong>{formatDate(episode.target_release_date)}</strong>
              </div>
              <div>
                <span>Host package due</span>
                <strong>{formatDate(episode.due_date)}</strong>
              </div>
              <div>
                <span>Required material</span>
                <strong>
                  {completion.completed} of {completion.required}
                </strong>
              </div>
              <div className={styles.progressCell}>
                <span>{completion.percent}% assembled</span>
                <span className={styles.progressTrack}>
                  <span style={{ width: `${completion.percent}%` }} />
                </span>
              </div>
            </section>

            {episode.producer_feedback ? (
              <section className={styles.feedbackBanner}>
                <strong>Producer note</strong>
                <p>{episode.producer_feedback}</p>
              </section>
            ) : null}

            <section className={styles.discussionPanel}>
              <div className={styles.discussionHeading}>
                <div>
                  <span className={styles.eyebrow}>Episode discussion</span>
                  <h2>Keep decisions with the work</h2>
                </div>
                <span>
                  {(episode.messages || []).length}{' '}
                  {(episode.messages || []).length === 1
                    ? 'update'
                    : 'updates'}
                </span>
              </div>
              {(episode.messages || []).length ? (
                <div className={styles.messageList}>
                  {episode.messages.map((entry) => (
                    <article
                      key={entry.message_id}
                      className={
                        entry.author_role === 'producer'
                          ? styles.producerMessage
                          : ''
                      }
                    >
                      <div>
                        <strong>{entry.author_name}</strong>
                        <span>
                          {entry.author_role === 'producer'
                            ? 'Producer'
                            : 'Host'}
                        </span>
                        <time dateTime={entry.created_at}>
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : ''}
                        </time>
                      </div>
                      <p>{entry.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.discussionEmpty}>
                  No updates yet. Use this space for questions, decisions, and
                  anything the next person needs to know.
                </p>
              )}
              <form
                className={styles.messageComposer}
                onSubmit={postMessage}
              >
                <label htmlFor="episode-message">Add an update</label>
                <div>
                  <textarea
                    id="episode-message"
                    value={messageDraft}
                    onChange={(event) =>
                      setMessageDraft(event.target.value)
                    }
                    placeholder="Ask a question, record a decision, or leave context for the team…"
                    maxLength={2400}
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={saving || messageDraft.trim().length < 2}
                  >
                    <ForumRoundedIcon aria-hidden="true" />
                    Post update
                  </button>
                </div>
              </form>
            </section>

            {canManage ? (
              <section className={styles.producerPanel}>
                <div className={styles.panelHeading}>
                  <div>
                    <span className={styles.eyebrow}>Producer setup</span>
                    <h2>Schedule and assignments</h2>
                  </div>
                  <span>Changes publish when you save.</span>
                </div>
                <div className={styles.producerGrid}>
                  <label>
                    Episode title
                    <input
                      value={episode.title}
                      onChange={(event) =>
                        updateEpisode({ title: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Season
                    <input
                      value={episode.season}
                      onChange={(event) =>
                        updateEpisode({ season: event.target.value })
                      }
                    />
                  </label>
                  <label>
                    Release date
                    <FriendlyDateField
                      value={episode.target_release_date}
                      onChange={(event) =>
                        updateEpisode({
                          target_release_date: event.target.value,
                        })
                      }
                      ariaLabel="release date"
                    />
                  </label>
                  <label>
                    Host package due
                    <FriendlyDateField
                      value={episode.due_date}
                      onChange={(event) =>
                        updateEpisode({ due_date: event.target.value })
                      }
                      ariaLabel="host package due date"
                    />
                  </label>
                  <label>
                    Producer
                    <select
                      value={episode.producer_person_id || ''}
                      onChange={(event) => {
                        const producerPersonId = event.target.value;
                        const producer = producers.find(
                          (candidate) =>
                            candidate.person_id === producerPersonId
                        );
                        updateEpisode({
                          producer_person_id: producerPersonId,
                          producer_email:
                            producer?.account_email ||
                            episode.producer_email,
                        });
                      }}
                    >
                      <option value="">Choose later</option>
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
                      value={episode.producer_email}
                      onChange={(event) =>
                        updateEpisode({ producer_email: event.target.value })
                      }
                      placeholder="caleb@example.com"
                    />
                  </label>
                </div>
                <div className={styles.assignmentPicker}>
                  <strong>Assigned hosts</strong>
                  <div>
                    {people.map((person) => {
                      const assigned = episode.host_person_ids.includes(
                        person.person_id
                      );
                      return (
                        <label
                          key={person.person_id}
                          className={assigned ? styles.assignmentActive : ''}
                        >
                          <input
                            type="checkbox"
                            checked={assigned}
                            onChange={(event) => {
                              const ids = event.target.checked
                                ? [
                                    ...episode.host_person_ids,
                                    person.person_id,
                                  ]
                                : episode.host_person_ids.filter(
                                    (personId) =>
                                      personId !== person.person_id
                                  );
                              updateEpisode({ host_person_ids: ids });
                            }}
                          />
                          {person.name}
                        </label>
                      );
                    })}
                  </div>
                </div>
              </section>
            ) : null}

            <section className={styles.formIntro}>
              <div>
                <span className={styles.eyebrow}>Host production form</span>
                <h2>Assemble the episode</h2>
                <p>
                  Link the actual material, then remove the guesswork. Use
                  exact filenames and tell the producer what each asset is,
                  where it belongs, and what the finished episode should do.
                </p>
              </div>
              <strong>{completion.missing.length} required items remain</strong>
            </section>

            <section
              className={`${styles.handoffPanel} ${
                producerDirectionsComplete ? styles.handoffPanelComplete : ''
              }`}
            >
              <div className={styles.handoffHeading}>
                <div>
                  <span className={styles.eyebrow}>Required producer brief</span>
                  <h2>Make the final cut unambiguous</h2>
                  <p>
                    A link says where the files live. This brief tells the
                    producer exactly which files to use and what the finished
                    episode should become.
                  </p>
                </div>
                <span className={styles.handoffStatus}>
                  {producerDirectionsComplete ? (
                    <CheckCircleRoundedIcon aria-hidden="true" />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon aria-hidden="true" />
                  )}
                  {producerDirectionsComplete
                    ? 'Brief ready'
                    : 'Brief required'}
                </span>
              </div>

              <div className={styles.handoffStandards}>
                <div>
                  <strong>Find it</strong>
                  <span>Exact filename, version, and source folder</span>
                </div>
                <div>
                  <strong>Edit it</strong>
                  <span>Timestamp range, action, and intended result</span>
                </div>
                <div>
                  <strong>Place it</strong>
                  <span>Image order, use, crop, caption, and credit</span>
                </div>
                <div>
                  <strong>Protect it</strong>
                  <span>Permission, restrictions, facts, and pronunciation</span>
                </div>
              </div>

              <label className={styles.handoffField}>
                <span>
                  Producer handoff brief and asset map
                  <small>Required for every submission</small>
                </span>
                <textarea
                  value={episode.producer_directions || ''}
                  disabled={lockedForHost}
                  onChange={(event) =>
                    updateEpisode({
                      producer_directions: event.target.value,
                    })
                  }
                  placeholder={PRODUCER_DIRECTIONS_PLACEHOLDER}
                  aria-label="Producer handoff brief and asset map"
                  maxLength={6000}
                />
              </label>
              <div className={styles.handoffFooter}>
                <span>
                  Never write “the good photo” or “latest cut.” Name the exact
                  asset.
                </span>
                <span
                  className={
                    producerDirectionsComplete
                      ? styles.handoffCountComplete
                      : ''
                  }
                >
                  {producerDirectionsLength < PRODUCER_DIRECTIONS_MIN_LENGTH
                    ? `${
                        PRODUCER_DIRECTIONS_MIN_LENGTH -
                        producerDirectionsLength
                      } more characters for a usable brief`
                    : 'Enough detail to submit'}
                </span>
              </div>
            </section>

            <div className={styles.deliverableList}>
              {episode.deliverables.map((deliverable, index) => {
                const complete = isDeliverableComplete(deliverable);
                const missingRequired = deliverable.required && !complete;
                return (
                  <article
                    key={deliverable.id}
                    className={`${styles.deliverableCard} ${
                      complete ? styles.deliverableComplete : ''
                    }`}
                  >
                    <div className={styles.deliverableNumber}>
                      {complete ? (
                        <CheckCircleRoundedIcon aria-hidden="true" />
                      ) : (
                        <RadioButtonUncheckedRoundedIcon aria-hidden="true" />
                      )}
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className={styles.deliverableBody}>
                      <div className={styles.deliverableHeading}>
                        <div>
                          <h3>{deliverable.label}</h3>
                          <p>{deliverable.description}</p>
                        </div>
                        <span>
                          {deliverable.required ? 'Required' : 'Optional'}
                        </span>
                      </div>

                      {deliverable.type === 'url' ? (
                        <div className={styles.urlField}>
                          <input
                            type="url"
                            value={deliverable.value}
                            disabled={lockedForHost}
                            onChange={(event) =>
                              updateDeliverable(deliverable.id, {
                                value: event.target.value,
                              })
                            }
                            placeholder={materialPlaceholder(deliverable)}
                            aria-label={deliverable.label}
                          />
                          {complete ? (
                            <a
                              href={deliverable.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${deliverable.label}`}
                            >
                              <OpenInNewRoundedIcon aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <textarea
                          value={deliverable.value}
                          disabled={lockedForHost}
                          onChange={(event) =>
                            updateDeliverable(deliverable.id, {
                              value: event.target.value,
                            })
                          }
                          placeholder={materialPlaceholder(deliverable)}
                          aria-label={deliverable.label}
                        />
                      )}

                      {canManage ? (
                        <label className={styles.requirementToggle}>
                          <input
                            type="checkbox"
                            checked={deliverable.required}
                            onChange={(event) =>
                              updateDeliverable(deliverable.id, {
                                required: event.target.checked,
                              })
                            }
                          />
                          Require this item before a complete handoff
                        </label>
                      ) : null}

                      {missingRequired && !canManage && !lockedForHost ? (
                        <div className={styles.gapPanel}>
                          <label className={styles.gapCheck}>
                            <input
                              type="checkbox"
                              checked={deliverable.missing_acknowledged}
                              onChange={(event) =>
                                updateDeliverable(deliverable.id, {
                                  missing_acknowledged: event.target.checked,
                                })
                              }
                            />
                            I know this is missing and will resolve it after
                            the producer begins work.
                          </label>
                          {deliverable.missing_acknowledged ? (
                            <div className={styles.gapFields}>
                              <label>
                                Resolution plan
                                <input
                                  value={deliverable.missing_note}
                                  onChange={(event) =>
                                    updateDeliverable(deliverable.id, {
                                      missing_note: event.target.value,
                                    })
                                  }
                                  placeholder="What is missing, and how will it be delivered?"
                                />
                              </label>
                              <label>
                                Expected by
                                <FriendlyDateField
                                  value={deliverable.expected_by}
                                  onChange={(event) =>
                                    updateDeliverable(deliverable.id, {
                                      expected_by: event.target.value,
                                    })
                                  }
                                  ariaLabel={`${deliverable.label} expected date`}
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {canManage &&
                      missingRequired &&
                      deliverable.missing_acknowledged ? (
                        <div className={styles.gapPanel}>
                          <strong>Known gap acknowledged by the host</strong>
                          <p>
                            {deliverable.missing_note}
                            {deliverable.expected_by
                              ? ` Expected by ${formatDate(
                                  deliverable.expected_by
                                )}.`
                              : ''}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

            {error ? <p className={styles.errorCard}>{error}</p> : null}
            {message ? <p className={styles.successCard}>{message}</p> : null}

            {canManage ? (
              <section className={styles.reviewPanel}>
                <div>
                  <span className={styles.eyebrow}>Producer review</span>
                  <h2>Move the episode forward</h2>
                  <textarea
                    value={episode.producer_feedback}
                    onChange={(event) =>
                      updateEpisode({ producer_feedback: event.target.value })
                    }
                    placeholder="Feedback for the assigned hosts…"
                    aria-label="Producer feedback"
                  />
                </div>
                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={
                      saving || !episode.producer_feedback.trim()
                    }
                    onClick={() => reviewEpisode('needs_changes')}
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={
                      saving ||
                      !['submitted', 'submitted_with_gaps'].includes(
                        episode.status
                      )
                    }
                    onClick={() => reviewEpisode('accepted')}
                  >
                    <CheckCircleRoundedIcon aria-hidden="true" />
                    Accept package
                  </button>
                </div>
              </section>
            ) : null}

            <section className={styles.actionDock}>
              <div>
                <strong>
                  {dirty
                    ? 'You have unpublished episode material'
                    : lockedForHost
                      ? 'This package is with the producer'
                      : 'Everything here is saved'}
                </strong>
                <span>
                  {completion.can_submit
                    ? 'All required material is ready.'
                    : `${completion.missing.length} required items are still missing.`}
                </span>
              </div>
              <div>
                {!lockedForHost ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving || !dirty}
                    onClick={saveDraft}
                  >
                    <SaveRoundedIcon aria-hidden="true" />
                    {canManage ? 'Save Studio' : 'Save draft'}
                  </button>
                ) : null}
                {!canManage && !lockedForHost ? (
                  <>
                    <button
                      type="button"
                      className={styles.gapSubmitButton}
                      disabled={saving || !completion.can_submit_with_gaps}
                      onClick={() => submitEpisode('with_gaps')}
                    >
                      <WarningAmberRoundedIcon aria-hidden="true" />
                      Send with known gaps
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={saving || !completion.can_submit}
                      onClick={() => submitEpisode('complete')}
                    >
                      <SendRoundedIcon aria-hidden="true" />
                      Send to producer
                    </button>
                  </>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </Layout>
  );
}
