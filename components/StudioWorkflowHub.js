import Head from 'next/head';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import AssignmentTurnedInRoundedIcon from '@mui/icons-material/AssignmentTurnedInRounded';
import FactCheckRoundedIcon from '@mui/icons-material/FactCheckRounded';
import StudioLayout, { useStudioSession } from './StudioLayout';
import {
  buildProductionHubModel,
  buildQuestionnaireHubModel,
  filterQuestionnaireHubRows,
  getProductionHubEpisodeHref,
  getQuestionnaireHubEpisodeHref,
  getStudioWorkflowHubLoadRequest,
  getStudioWorkflowHubRequest,
} from '../lib/studioWorkflowHubs.mjs';
import styles from '../styles/StudioWorkflowHub.module.css';

const STATUS_LABELS = {
  planning: 'Ready to start',
  in_progress: 'In progress',
  submitted: 'With producer',
  submitted_with_gaps: 'With producer · known gaps',
  needs_changes: 'Changes requested',
  accepted: 'Accepted',
};

const QUESTIONNAIRE_LABELS = {
  not_shared: 'Not shared',
  awaiting_response: 'Awaiting guest',
  received: 'Response received',
};

const QUESTIONNAIRE_FILTERS = [
  { value: 'all', label: 'All', count: 'total' },
  { value: 'not_shared', label: 'Not shared', count: 'not_shared' },
  {
    value: 'awaiting_response',
    label: 'Awaiting',
    count: 'awaiting_response',
  },
  { value: 'received', label: 'Received', count: 'received' },
];

function formatDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) {
    return 'Date pending';
  }
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return 'Date pending';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function SummaryGrid({ items, label }) {
  return (
    <dl className={styles.summaryGrid} aria-label={label}>
      {items.map((item) => (
        <div className={styles.summaryCard} key={item.label}>
          <dt>{item.label}</dt>
          <dd>{item.value}</dd>
        </div>
      ))}
    </dl>
  );
}

function QuestionnaireSummaryFilters({ summary, value, onChange }) {
  return (
    <div
      className={styles.questionnaireSummaryFilters}
      role="group"
      aria-label="Filter questionnaires by status"
    >
      {QUESTIONNAIRE_FILTERS.map((filter) => {
        const selected = value === filter.value;
        return (
          <button
            type="button"
            className={`${styles.questionnaireSummaryFilter} ${
              selected ? styles.questionnaireSummaryFilterActive : ''
            }`}
            aria-pressed={selected}
            onClick={() => onChange(filter.value)}
            key={filter.value}
          >
            <span>{filter.label}</span>
            <strong>{summary[filter.count] || 0}</strong>
          </button>
        );
      })}
    </div>
  );
}

function QuestionnaireTableRow({ episode, hrefFor }) {
  const state = episode.workflow.questionnaire_state;
  const hostNames = episode.host_names.length
    ? episode.host_names.join(' + ')
    : 'Host assignment pending';
  const href = hrefFor(getQuestionnaireHubEpisodeHref(episode));

  return (
    <tr>
      <th scope="row" className={styles.questionnaireEpisodeCell}>
        <span className={styles.mobileCellLabel} aria-hidden="true">
          Episode
        </span>
        <span>
          <strong>{episode.title}</strong>
          <small>{episode.season || 'Current season'}</small>
        </span>
      </th>
      <td>
        <span className={styles.mobileCellLabel} aria-hidden="true">
          Hosts
        </span>
        <span>{hostNames}</span>
      </td>
      <td>
        <span className={styles.mobileCellLabel} aria-hidden="true">
          Guest prep
        </span>
        <span>
          <strong
            className={`${styles.questionnaireStatus} ${
              styles[`questionnaire_${state}`]
            }`}
          >
            {QUESTIONNAIRE_LABELS[state] || 'Not shared'}
          </strong>
          {episode.workflow.questionnaire_overdue ? (
            <small className={styles.questionnaireAttention}>
              Workflow step overdue
            </small>
          ) : null}
        </span>
      </td>
      <td>
        <span className={styles.mobileCellLabel} aria-hidden="true">
          Air date
        </span>
        <time dateTime={episode.target_release_date || undefined}>
          {formatDate(episode.target_release_date)}
        </time>
      </td>
      <td className={styles.questionnaireActionCell}>
        <span className={styles.mobileCellLabel} aria-hidden="true">
          Action
        </span>
        <Link
          href={href}
          aria-label={`Open ${episode.title} questionnaire`}
          className={styles.questionnaireAction}
        >
          Open
          <ArrowForwardRoundedIcon aria-hidden="true" />
        </Link>
      </td>
    </tr>
  );
}

function QuestionnaireOperations({ model, hrefFor }) {
  const [statusFilter, setStatusFilter] = useState('all');
  const [query, setQuery] = useState('');
  const [sort, setSort] = useState('urgency');
  const rows = useMemo(
    () =>
      filterQuestionnaireHubRows(model.rows, {
        filter: statusFilter,
        query,
        sort,
      }),
    [model.rows, query, sort, statusFilter]
  );

  function clearFilters() {
    setStatusFilter('all');
    setQuery('');
    setSort('urgency');
  }

  return (
    <>
      <QuestionnaireSummaryFilters
        summary={model.summary}
        value={statusFilter}
        onChange={setStatusFilter}
      />
      {!model.rows.length ? (
        <HubState
          kind="empty"
          message="No Episode Studios are visible to this login. Create or join an episode before preparing its guest questionnaire."
        />
      ) : (
        <section aria-labelledby="questionnaire-operations-heading">
          <div className={styles.questionnaireOperationsHeading}>
            <div>
              <span className={styles.eyebrow}>Authorized operations view</span>
              <h2 id="questionnaire-operations-heading">
                Episode questionnaires
              </h2>
              <p>
                Find an episode, focus the queue by guest-prep status, or sort
                the authorized view without loading any additional data.
              </p>
            </div>
            <strong role="status" aria-live="polite">
              {rows.length} of {model.summary.total} showing
            </strong>
          </div>

          <div className={styles.questionnaireToolbar}>
            <label className={styles.questionnaireSearch}>
              <span>Search title or host</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Episode or host name"
                autoComplete="off"
              />
            </label>
            <label className={styles.questionnaireSort}>
              <span>Sort</span>
              <select
                value={sort}
                onChange={(event) => setSort(event.target.value)}
              >
                <option value="urgency">Urgency and status</option>
                <option value="air_date">Air date · soonest first</option>
              </select>
            </label>
          </div>

          {rows.length ? (
            <div className={styles.questionnaireTableFrame}>
              <table className={styles.questionnaireTable}>
                <caption className={styles.visuallyHidden}>
                  Questionnaire status for authorized Episode Studios
                </caption>
                <thead>
                  <tr>
                    <th scope="col">Episode</th>
                    <th scope="col">Hosts</th>
                    <th scope="col">Guest prep</th>
                    <th scope="col">Air date</th>
                    <th scope="col">
                      <span className={styles.visuallyHidden}>Action</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((episode) => (
                    <QuestionnaireTableRow
                      episode={episode}
                      hrefFor={hrefFor}
                      key={episode.episode_id}
                    />
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <section className={styles.questionnaireNoResults} role="status">
              <strong>No questionnaires match this view</strong>
              <p>Try another status or search, or return to the full queue.</p>
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            </section>
          )}
        </section>
      )}
    </>
  );
}

const PRODUCER_LANE_COPY = {
  review_queue: {
    action: 'Open production board',
    progress: 'Production workflow',
  },
  lead_review_queue: {
    action: 'Open lead review',
    progress: 'Production lead workflow',
  },
  lead_review_watchlist: {
    action: 'View handoff status',
    progress: 'With production lead',
  },
  host_draft: {
    action: 'View host draft',
    progress: 'Host package',
  },
  completed_history: {
    action: 'View completed review',
    progress: 'Production handoff complete',
  },
};

function ProductionRow({ episode, hrefFor }) {
  const workflow = episode.workflow;
  const nextTask = workflow.next_due_task;
  const lane = episode.producer_lane;
  const laneCopy = PRODUCER_LANE_COPY[lane] || PRODUCER_LANE_COPY.host_draft;
  const actionQueue =
    lane === 'review_queue' || lane === 'lead_review_queue';
  const hostDraft = lane === 'host_draft';
  const leadReviewWatch = lane === 'lead_review_watchlist';
  const completion = hostDraft
    ? episode.completion?.host_percent
    : workflow.completion_percent;
  const destination = getProductionHubEpisodeHref(episode);
  const handoffCopy =
    episode.status === 'needs_changes'
      ? 'Changes are back with the host'
      : 'Waiting for host submission';
  return (
    <li>
      <Link
        href={hrefFor(destination)}
        className={`${styles.episodeCard} ${styles.productionCard} ${
          actionQueue && workflow.overdue_count
            ? styles.episodeCardAlert
            : ''
        } ${hostDraft || leadReviewWatch ? styles.watchlistCard : ''}`}
      >
        <div className={styles.cardMain}>
          <span className={styles.cardEyebrow}>
            {episode.season || 'Current season'}
          </span>
          <h2>{episode.title}</h2>
          <p>
            {STATUS_LABELS[episode.status] || episode.status} ·{' '}
            {formatDate(episode.target_release_date)}
          </p>
        </div>
        <div className={styles.workflowProgress}>
          {lane === 'completed_history' ? (
            <span className={styles.completedReview}>
              <strong>{laneCopy.progress}</strong>
              <small>Kept here as completed history</small>
            </span>
          ) : leadReviewWatch ? (
            <span>
              <strong>{laneCopy.progress}</strong>
              <small>This handoff is not in your action queue</small>
            </span>
          ) : completion === null || completion === undefined ? (
            <span>
              <strong>{laneCopy.progress}</strong>
              <small>
                {hostDraft
                  ? 'Completion appears as the host fills the package'
                  : 'Workflow progress is not available yet'}
              </small>
            </span>
          ) : (
            <>
              <span>
                <strong>{completion}% complete</strong>
                <small>
                  {hostDraft
                    ? 'Producer review starts after submission'
                    : `${workflow.completed_required_task_count} of ${workflow.required_task_count} required steps`}
                </small>
              </span>
              <progress
                value={completion}
                max="100"
                aria-label={`${episode.title} ${laneCopy.progress.toLowerCase()} completion`}
              >
                {completion}%
              </progress>
            </>
          )}
        </div>
        <div className={styles.cardFacts}>
          {actionQueue ? (
            <>
              <span>
                <small>Next step</small>
                <strong>{nextTask?.label || 'Workflow complete'}</strong>
                {nextTask?.due_date ? (
                  <em>Due {formatDate(nextTask.due_date)}</em>
                ) : null}
              </span>
              <span>
                <small>Attention</small>
                <strong
                  className={workflow.overdue_count ? styles.alertText : ''}
                >
                  {workflow.overdue_count
                    ? `${workflow.overdue_count} overdue`
                    : 'On track'}
                </strong>
              </span>
            </>
          ) : hostDraft ? (
            <>
              <span>
                <small>Current handoff</small>
                <strong>{handoffCopy}</strong>
              </span>
              <span>
                <small>Producer queue</small>
                <strong>Not active yet</strong>
              </span>
            </>
          ) : leadReviewWatch ? (
            <>
              <span>
                <small>Current handoff</small>
                <strong>Production lead review</strong>
              </span>
              <span>
                <small>Your queue</small>
                <strong>No action required</strong>
              </span>
            </>
          ) : (
            <>
              <span>
                <small>Air date</small>
                <strong>{formatDate(episode.target_release_date)}</strong>
              </span>
              <span>
                <small>Status</small>
                <strong>Accepted</strong>
              </span>
            </>
          )}
        </div>
        <span className={styles.cardAction}>
          {laneCopy.action}
          <ArrowForwardRoundedIcon aria-hidden="true" />
        </span>
      </Link>
    </li>
  );
}

function ProductionSection({
  id,
  eyebrow,
  title,
  description,
  episodes,
  hrefFor,
}) {
  if (!episodes.length) return null;

  return (
    <section aria-labelledby={`${id}-heading`}>
      <div className={styles.sectionHeading}>
        <div>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 id={`${id}-heading`}>{title}</h2>
          <p>{description}</p>
        </div>
        <strong>{episodes.length} showing</strong>
      </div>
      <ul className={styles.episodeList}>
        {episodes.map((episode) => (
          <ProductionRow
            episode={episode}
            hrefFor={hrefFor}
            key={episode.episode_id}
          />
        ))}
      </ul>
    </section>
  );
}

function HubState({ kind, message }) {
  return (
    <section className={styles.stateCard} role={kind === 'error' ? 'alert' : 'status'}>
      <strong>
        {kind === 'loading'
          ? 'Opening the workflow…'
          : kind === 'error'
            ? 'The workflow could not be opened'
            : 'Nothing is assigned here yet'}
      </strong>
      <p>{message}</p>
    </section>
  );
}

function RoleUnavailableState({ hrefFor }) {
  return (
    <section className={styles.stateCard} role="status">
      <strong>Producer Tasks is not enabled for this profile</strong>
      <p>
        This workspace is available to Studio managers and active producer
        profiles. Host episode preparation remains available in Host Studio.
      </p>
      <Link href={hrefFor('/studio')} className={styles.stateAction}>
        Return to Team Studio
        <ArrowForwardRoundedIcon aria-hidden="true" />
      </Link>
    </section>
  );
}

function StudioWorkflowHubContent({ kind, previewEpisodes = null, hrefFor }) {
  const session = useStudioSession();
  const previewData = previewEpisodes !== null;
  const request = useMemo(
    () =>
      previewData
        ? getStudioWorkflowHubRequest(session?.permissions || [])
        : getStudioWorkflowHubLoadRequest(
            kind,
            session?.permissions || [],
            session?.capabilities || {}
          ),
    [kind, previewData, session?.capabilities, session?.permissions]
  );
  const hubAvailable = Boolean(request);
  const [episodes, setEpisodes] = useState(() => previewEpisodes || []);
  const [state, setState] = useState(
    previewData ? 'ready' : hubAvailable ? 'loading' : 'unavailable'
  );
  const [error, setError] = useState('');

  useEffect(() => {
    if (!hubAvailable) return undefined;
    if (previewData) return undefined;
    const controller = new AbortController();
    let alive = true;

    async function loadEpisodes() {
      setState('loading');
      setError('');
      try {
        const response = await fetch(request.url, {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          const requestError = new Error(
            data.error || 'Episode Studio did not return a readable response.'
          );
          requestError.code = data.code || '';
          throw requestError;
        }
        if (!alive) return;
        setEpisodes(Array.isArray(data.episodes) ? data.episodes : []);
        setState('ready');
      } catch (loadError) {
        if (!alive || loadError.name === 'AbortError') return;
        setError(
          loadError.code === 'PROFILE_NOT_CONNECTED'
            ? 'Ask a Studio manager to connect this login to your team profile before opening assigned episodes.'
            : loadError.message || 'Please refresh and try again.'
        );
        setState('error');
      }
    }

    loadEpisodes();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [hubAvailable, previewData, request?.url]);

  const model = useMemo(
    () => {
      if (!hubAvailable) return null;
      return kind === 'questionnaires'
        ? buildQuestionnaireHubModel(episodes)
        : buildProductionHubModel(episodes, {
            canManage: request.canManage,
          });
    },
    [episodes, hubAvailable, kind, request]
  );
  const questionnaireHub = kind === 'questionnaires';
  const title = questionnaireHub
    ? 'Guest Questionnaires'
    : 'Producer Task Manager';
  const Icon = questionnaireHub
    ? FactCheckRoundedIcon
    : AssignmentTurnedInRoundedIcon;
  const summaryItems = !model || questionnaireHub
    ? []
    : [
        { label: 'Producer reviews', value: model.summary.review_queue },
        { label: 'Lead reviews', value: model.summary.lead_review_queue },
        {
          label: 'Open action steps',
          value: model.summary.open_required_tasks,
        },
        {
          label: 'Action queue overdue',
          value: model.summary.overdue_episodes,
        },
      ];

  return (
    <div className={styles.page}>
      <Head>
        <title>{`${title} | The Avalanche Hour`}</title>
      </Head>
      <Link href={hrefFor('/studio')} className={styles.backLink}>
        <ArrowBackRoundedIcon aria-hidden="true" />
        Team Studio home
      </Link>
      <header className={styles.hero}>
        <span className={styles.heroIcon} aria-hidden="true">
          <Icon />
        </span>
        <div>
          <span className={styles.eyebrow}>
            Season workflow · Step {questionnaireHub ? '2' : '4'}
          </span>
          <h1>{title}</h1>
          <p>
            {!hubAvailable
              ? 'This production workspace is reserved for Studio managers and active producer profiles.'
              : questionnaireHub
              ? 'This internal hub starts after an episode exists. Public Be a Guest submissions stay in the team mailbox until a manager reviews them, and each guest-facing questionnaire link remains private.'
              : request.canManage
                ? 'Submitted packages form the producer-review queue. Pending lead reviews stay actionable for managers and assigned leads, while host drafts remain on the watchlist.'
                : 'Submitted producer assignments form your review queue. A pending lead review is actionable only when you are the assigned production lead; otherwise it stays visible as a handoff watch.'}
          </p>
        </div>
        <span className={styles.scopePill}>
          {request?.canManage
            ? 'All team episodes'
            : hubAvailable
              ? 'Your assignments'
              : 'Role unavailable'}
        </span>
      </header>

      {!hubAvailable ? (
        <RoleUnavailableState hrefFor={hrefFor} />
      ) : state === 'loading' ? (
        <HubState kind="loading" message="Loading your authorized episode view." />
      ) : state === 'error' ? (
        <HubState kind="error" message={error} />
      ) : questionnaireHub ? (
        <QuestionnaireOperations model={model} hrefFor={hrefFor} />
      ) : (
        <>
          <SummaryGrid
            items={summaryItems}
            label={`${title} summary`}
          />
          {model.rows.length ? (
            <div className={styles.productionSections}>
              <ProductionSection
                id="producer-review-queue"
                eyebrow="Action queue"
                title="Ready for producer review"
                description="Only submitted host packages appear here or contribute to open and overdue totals."
                episodes={model.sections.review_queue}
                hrefFor={hrefFor}
              />
              <ProductionSection
                id="production-lead-review-queue"
                eyebrow="Lead review queue"
                title="Ready for production lead review"
                description="These producer-accepted packages are waiting for the assigned production lead to complete the handoff."
                episodes={model.sections.lead_review_queue}
                hrefFor={hrefFor}
              />
              <ProductionSection
                id="producer-host-drafts"
                eyebrow="Watchlist"
                title="Host drafts you’re watching"
                description="These assigned packages are still with the host. They are visible for context but are not producer actions yet."
                episodes={model.sections.host_drafts}
                hrefFor={hrefFor}
              />
              <ProductionSection
                id="producer-lead-review-watchlist"
                eyebrow="Handoff watch"
                title="With the production lead"
                description="These accepted packages remain visible to the original producer for context, but only the assigned production lead or a manager receives the action."
                episodes={model.sections.lead_review_watchlist}
                hrefFor={hrefFor}
              />
              <ProductionSection
                id="producer-completed-history"
                eyebrow="History"
                title="Completed production handoffs"
                description="Accepted packages move here only after production lead review is complete."
                episodes={model.sections.completed_history}
                hrefFor={hrefFor}
              />
            </div>
          ) : (
            <HubState
              kind="empty"
              message={
                request.canManage
                  ? 'No Episode Studios are available for production yet.'
                  : 'No visible episodes currently assign you as producer, production lead, or workflow owner.'
              }
            />
          )}
        </>
      )}
    </div>
  );
}

export default function StudioWorkflowHub({
  kind,
  previewSession = null,
  previewEpisodes = null,
  previewPath = '',
  previewHrefMap = null,
}) {
  const preview = previewSession !== null;

  function hrefFor(href) {
    if (previewHrefMap?.[href]) return previewHrefMap[href];
    if (preview && href.endsWith('/questionnaire')) {
      return '/dev/guest-questionnaire-preview';
    }
    if (preview && href.endsWith('/production')) {
      return '/dev/episode-studio-usability-preview?workspace=production';
    }
    if (preview && /^\/studio\/episodes\/[^/]+$/.test(href)) {
      return '/dev/episode-studio-usability-preview?viewer=producer';
    }
    return href;
  }

  return (
    <StudioLayout
      requiredPermission="episodes:read"
      wide
      previewSession={previewSession}
      previewPath={previewPath}
      previewHrefMap={previewHrefMap}
    >
      <StudioWorkflowHubContent
        kind={kind}
        previewEpisodes={previewEpisodes}
        hrefFor={hrefFor}
      />
    </StudioLayout>
  );
}
