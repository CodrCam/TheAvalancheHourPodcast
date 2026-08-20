import Link from 'next/link';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import ChecklistRoundedIcon from '@mui/icons-material/ChecklistRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import PodcastsRoundedIcon from '@mui/icons-material/PodcastsRounded';
import QuizRoundedIcon from '@mui/icons-material/QuizRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import styles from '../styles/StudioOverviewDashboard.module.css';

function formatDate(value, includeYear = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    ...(includeYear ? { year: 'numeric' } : {}),
  });
}

function safePercent(value) {
  return Math.max(0, Math.min(100, Number(value) || 0));
}

function MetricCard({ label, value, detail, href, onClick, tone = 'default' }) {
  const content = (
    <>
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{detail}</small>
      {href || onClick ? <ArrowForwardRoundedIcon aria-hidden="true" /> : null}
    </>
  );
  const className = `${styles.metricCard} ${
    tone === 'attention' ? styles.metricCardAttention : ''
  }`;

  if (onClick) {
    return (
      <button
        type="button"
        className={`${className} ${styles.metricCardButton}`}
        onClick={onClick}
      >
        {content}
      </button>
    );
  }

  return href ? (
    <Link href={href} className={className}>
      {content}
    </Link>
  ) : (
    <div className={className}>{content}</div>
  );
}

function ProgressBar({ value, label }) {
  const percent = safePercent(value);
  return (
    <div
      className={styles.progressTrack}
      role="progressbar"
      aria-label={label}
      aria-valuemin="0"
      aria-valuemax="100"
      aria-valuenow={percent}
    >
      <span style={{ width: `${percent}%` }} />
    </div>
  );
}

function PlanningStatus({
  state,
  planning,
  loadAttempts,
  onLoad,
  enabled,
}) {
  if (state === 'ready' && planning) {
    return (
      <div className={styles.planningTotals}>
        <span><strong>{planning.by_status?.idea || 0}</strong> ideas</span>
        <span><strong>{planning.by_status?.researching || 0}</strong> researching</span>
        <span><strong>{planning.by_status?.ready || 0}</strong> ready</span>
        <span><strong>{planning.undated || 0}</strong> undated</span>
      </div>
    );
  }

  if (!enabled) {
    return <p className={styles.planningResting}>Planning totals are not connected.</p>;
  }

  if (state === 'loading') {
    return <p className={styles.planningResting}>Opening the live season plan…</p>;
  }

  if (state === 'unavailable' && loadAttempts >= 2) {
    return <p className={styles.planningResting}>Live totals are resting. Operational data remains current.</p>;
  }

  return (
    <button type="button" className={styles.loadPlanningButton} onClick={onLoad}>
      {state === 'unavailable' ? 'Retry live plan once' : 'Load live planning totals'}
    </button>
  );
}

function WorkloadTable({ rows }) {
  if (!rows.length) {
    return (
      <p className={styles.emptyWorkload}>
        Named assignments appear here as Episode Studios are connected to the team directory.
      </p>
    );
  }

  return (
    <div className={styles.workloadTableWrap}>
      <table className={styles.workloadTable}>
        <thead>
          <tr>
            <th scope="col">Person</th>
            <th scope="col">Role</th>
            <th scope="col">Episodes</th>
            <th scope="col">Current stage</th>
            <th scope="col">Attention</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => {
            const activeStage = row.producer_review
              ? `${row.producer_review} with producer`
              : row.production_active
                ? `${row.production_active} in production`
                : row.host_drafts
                  ? `${row.host_drafts} host drafts`
                  : 'On schedule';
            return (
              <tr key={`${row.role}:${row.name}`}>
                <th scope="row">{row.name}</th>
                <td>{row.role === 'producer' ? 'Producer' : 'Host'}</td>
                <td>{row.episode_count}</td>
                <td>{activeStage}</td>
                <td>
                  <span className={row.attention ? styles.attentionCount : ''}>
                    {row.attention}
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function StudioOverviewDashboard({
  model,
  season,
  planning = null,
  planningState = 'disabled',
  planningLoadAttempts = 0,
  onLoadPlanning = () => {},
  mastermindEnabled = false,
  dataState = 'ready',
  loading = false,
  nextActionCount = 0,
  dueThisWeek = 0,
  onShowAllActions = () => {},
  hrefFor = (href) => href,
}) {
  const producerOperations = model.visibility.producer_operations;
  const teamScope = model.scope === 'team';
  const dataReady = dataState === 'ready';
  const schedule = model.metrics.schedule_coverage;
  const health = model.health;
  const personal = model.workload_meta.personal;
  const nextReleases = Array.isArray(season?.next_releases)
    ? season.next_releases.slice(0, 3)
    : [];
  const metricCards = [
    {
      label: 'Studios created',
      value: loading
        ? '—'
        : `${model.season.reported_episode_studios}/${model.season.planned_slots}`,
      detail: `${model.season.open_slots} plans not handed off yet`,
      href: mastermindEnabled ? hrefFor('/studio/mastermind') : undefined,
    },
    {
      label: 'Host research',
      value: loading ? '—' : model.metrics.host_drafts,
      detail: 'Packages still with hosts',
      href: hrefFor('/studio/episodes'),
    },
    ...(producerOperations
      ? [
          {
            label: 'Producer review',
            value: loading ? '—' : model.metrics.producer_review,
            detail: 'Submitted packages waiting',
            href: hrefFor('/studio/production'),
          },
          {
            label: 'In production',
            value: loading ? '—' : model.metrics.production_active,
            detail: 'Accepted and moving',
            href: hrefFor('/studio/production'),
          },
        ]
      : []),
    {
      label: 'Needs attention',
      value: loading ? '—' : model.metrics.attention,
      detail: `${health.overdue} overdue · ${health.off_track} off track`,
      href: producerOperations
        ? hrefFor(teamScope ? '/studio/production' : '/studio/episodes')
        : hrefFor('/studio/episodes'),
      tone: model.metrics.attention ? 'attention' : 'default',
    },
    {
      label: teamScope ? 'Team actions' : 'My next actions',
      value: loading ? '—' : nextActionCount,
      detail: `${dueThisWeek} due in the next seven days`,
      onClick: onShowAllActions,
    },
  ];
  const productionStages = [
    {
      id: 'host',
      label: 'Host research',
      detail: 'Drafting and verification',
      count: model.metrics.host_drafts,
      href: '/studio/episodes',
    },
    ...(producerOperations
      ? [
          {
            id: 'review',
            label: 'Producer review',
            detail: 'Submitted packages',
            count: model.metrics.producer_review,
            href: '/studio/production',
          },
          {
            id: 'production',
            label: 'Production',
            detail: 'Edit and delivery work',
            count: model.metrics.production_active,
            href: '/studio/production',
          },
          {
            id: 'complete',
            label: 'Complete',
            detail: 'Finished in this scope',
            count: model.metrics.production_completed,
            href: '/studio/production',
          },
        ]
      : []),
  ];
  const workspaceCards = [
    ...(mastermindEnabled
      ? [
          {
            id: 'planning',
            eyebrow: 'Plan',
            title: 'Season Mastermind',
            detail: 'Ideas, research, schedule, hosts, and the approved handoff into an Episode Studio.',
            action: 'Open season planning',
            href: '/studio/mastermind',
            icon: ViewKanbanRoundedIcon,
          },
        ]
      : []),
    {
      id: 'host',
      eyebrow: 'Prepare',
      title: 'Host Studio',
      detail: 'Pitch and track episode ideas, then research, build, record, and submit each approved episode package.',
      action: 'Open host work',
      href: '/studio/episodes',
      icon: PodcastsRoundedIcon,
      secondary: {
        href: '/studio/episodes/ideas',
        label: 'Open the Idea Desk',
      },
    },
    ...(producerOperations
      ? [
          {
            id: 'production',
            eyebrow: 'Produce',
            title: 'Producer Tasks',
            detail: 'Only submitted work enters this queue. Review, deadlines, production, and lead handoff live here.',
            action: 'Open producer queue',
            href: '/studio/production',
            icon: ChecklistRoundedIcon,
          },
        ]
      : []),
  ];

  return (
    <section className={styles.dashboard} aria-labelledby="studio-overview-title">
      <header className={styles.hero}>
        <div className={styles.heroCopy}>
          <span className={styles.eyebrow}>{season?.label || 'Season 11'} · Studio overview</span>
          <h1 id="studio-overview-title">The season at a glance</h1>
          <p>
            See schedule coverage, handoff pressure, and team workload before opening the workspace where the work happens.
          </p>
          <div className={styles.heroMeta}>
            <span>{teamScope ? 'Team operations view' : producerOperations ? 'My assigned production' : 'My episode work'}</span>
            <span>{formatDate(model.season.starts_on, true)} – {formatDate(model.season.ends_on, true)}</span>
            {season?.regular_slots || season?.slabs_and_sluffs_slots ? (
              <span>{season.regular_slots || 0} regular · {season.slabs_and_sluffs_slots || 0} Slabs n Sluffs</span>
            ) : null}
          </div>
        </div>
        <div className={styles.heroActions}>
          {producerOperations ? (
            <Link href={hrefFor('/studio/production')} className={styles.primaryAction}>
              Open producer queue
              <ArrowForwardRoundedIcon aria-hidden="true" />
            </Link>
          ) : (
            <Link href={hrefFor('/studio/episodes')} className={styles.primaryAction}>
              Open Host Studio
              <ArrowForwardRoundedIcon aria-hidden="true" />
            </Link>
          )}
          {mastermindEnabled ? (
            <Link href={hrefFor('/studio/mastermind')} className={styles.secondaryAction}>
              Open season plan
            </Link>
          ) : null}
        </div>
      </header>

      {dataReady ? (
        <>
          <div className={styles.metrics} aria-label={`${season?.label || 'Season 11'} operational summary`}>
            {metricCards.map((metric) => (
              <MetricCard key={metric.label} {...metric} />
            ))}
          </div>

          <div className={styles.insightGrid}>
        <section className={styles.panel} aria-labelledby="pipeline-title">
          <header className={styles.panelHeader}>
            <div>
              <span>Production pulse</span>
              <h2 id="pipeline-title">Where episodes are now</h2>
            </div>
            <Link href={hrefFor(producerOperations ? '/studio/production' : '/studio/episodes')}>
              View details
            </Link>
          </header>
          <ol className={styles.pipeline}>
            {productionStages.map((stage, index) => (
              <li key={stage.id}>
                <Link href={hrefFor(stage.href)}>
                  <span className={styles.pipelineNumber}>{index + 1}</span>
                  <span>
                    <strong>{stage.label}</strong>
                    <small>{stage.detail}</small>
                  </span>
                  <em>{loading ? '—' : stage.count}</em>
                </Link>
              </li>
            ))}
          </ol>
          <div className={styles.planStrip}>
            <div>
              <span>Season planning</span>
              <strong>{model.season.reported_episode_studios} Episode Studios created from {model.season.planned_slots} planned slots</strong>
            </div>
            <ProgressBar
              value={model.season.created_percent}
              label={`${model.season.created_percent}% of planned Season 11 slots have an Episode Studio`}
            />
            <PlanningStatus
              state={planningState}
              planning={planning}
              loadAttempts={planningLoadAttempts}
              onLoad={onLoadPlanning}
              enabled={mastermindEnabled}
            />
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="health-title">
          <header className={styles.panelHeader}>
            <div>
              <span>Season health</span>
              <h2 id="health-title">Coverage and risk</h2>
            </div>
          </header>
          <div className={styles.healthList}>
            <div>
              <span className={styles.healthIcon}><CalendarMonthRoundedIcon aria-hidden="true" /></span>
              <span><strong>Air dates</strong><small>{schedule.scheduled} set · {schedule.unscheduled} unscheduled</small></span>
              <em>{schedule.percent}%</em>
            </div>
            <div>
              <span className={styles.healthIcon}><WarningAmberRoundedIcon aria-hidden="true" /></span>
              <span><strong>Delivery risk</strong><small>{health.overdue} overdue · {health.blocked} blocked</small></span>
              <em className={health.off_track ? styles.healthAlert : ''}>{health.off_track} off track</em>
            </div>
            <div>
              <span className={styles.healthIcon}><QuizRoundedIcon aria-hidden="true" /></span>
              <span><strong>Guest questionnaires</strong><small>{model.questionnaire_summary.pending} awaiting return · {model.questionnaire_summary.not_shared} not sent</small></span>
              <em>{model.questionnaire_summary.received} received</em>
            </div>
            <div>
              <span className={styles.healthIcon}><GroupsRoundedIcon aria-hidden="true" /></span>
              <span><strong>Assignments</strong><small>Episodes missing a host or producer</small></span>
              <em className={health.unassigned ? styles.healthAlert : ''}>{health.unassigned}</em>
            </div>
          </div>
          <div className={styles.nextReleases}>
            <span>Next releases</span>
            {nextReleases.length ? (
              nextReleases.map((release) => (
                <div key={`${release.target_release_date}:${release.title}`}>
                  <time dateTime={release.target_release_date}>{formatDate(release.target_release_date)}</time>
                  <strong>{release.title}</strong>
                </div>
              ))
            ) : (
              <p>Upcoming air dates appear here as Episode Studios are scheduled.</p>
            )}
          </div>
        </section>
          </div>

          {teamScope ? (
            <section className={`${styles.panel} ${styles.workloadPanel}`} aria-labelledby="workload-title">
              <header className={styles.panelHeader}>
                <div>
                  <span>Team capacity</span>
                  <h2 id="workload-title">Who is carrying what</h2>
                </div>
                <small>All named assignments · counts only · no private guest or production notes</small>
              </header>
              <WorkloadTable rows={model.workload} />
            </section>
          ) : personal ? (
            <section className={`${styles.panel} ${styles.personalPanel}`} aria-labelledby="personal-workload-title">
              <div>
                <span>My workload</span>
                <h2 id="personal-workload-title">{personal.episode_count} connected episodes</h2>
              </div>
              <div className={styles.personalMetrics}>
                <span><strong>{personal.as_host}</strong> hosting</span>
                {producerOperations ? <span><strong>{personal.as_producer}</strong> producing</span> : null}
                {producerOperations ? <span><strong>{personal.actionable}</strong> actionable</span> : null}
              </div>
            </section>
          ) : null}
        </>
      ) : (
        <div
          className={styles.dataStatePanel}
          role={dataState === 'loading' ? 'status' : 'alert'}
        >
          <strong>
            {dataState === 'loading'
              ? `Loading ${season?.label || 'Season 11'} operations…`
              : dataState === 'profile_not_connected'
                ? 'Connect this login to a team profile'
                : 'Operational insights are unavailable'}
          </strong>
          <p>
            {dataState === 'loading'
              ? 'The dashboard will appear when the current Episode Studios are ready.'
              : dataState === 'profile_not_connected'
                ? 'A Studio manager needs to make the one-time connection before personal episode work and accurate counts can appear.'
                : 'Episode Studio data did not load, so this page is intentionally not showing zero counts or a clean bill of health. Refresh to try again.'}
          </p>
        </div>
      )}

      <section className={styles.workspaceDirectory} aria-labelledby="workspace-directory-title">
        <header className={styles.directoryHeader}>
          <div>
            <span>Where to work</span>
            <h2 id="workspace-directory-title">Three clear workspaces</h2>
          </div>
          <p>Start here, then open the workspace that matches the job in front of you.</p>
        </header>
        <div className={styles.workspaceCards}>
          {workspaceCards.map((card) => {
            const Icon = card.icon;
            return (
              <article key={card.id} className={styles.workspaceCard}>
                <span className={styles.workspaceIcon}><Icon aria-hidden="true" /></span>
                <span className={styles.workspaceEyebrow}>{card.eyebrow}</span>
                <h3>{card.title}</h3>
                <p>{card.detail}</p>
                <div>
                  <Link href={hrefFor(card.href)}>
                    {card.action}
                    <ArrowForwardRoundedIcon aria-hidden="true" />
                  </Link>
                  {card.secondary ? (
                    <Link href={hrefFor(card.secondary.href)} className={styles.workspaceSecondary}>
                      {card.secondary.label}
                    </Link>
                  ) : null}
                </div>
              </article>
            );
          })}
        </div>
      </section>
    </section>
  );
}
