import Link from 'next/link';
import { useRouter } from 'next/router';
import { useEffect, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import DownloadRoundedIcon from '@mui/icons-material/DownloadRounded';
import FilterAltOffRoundedIcon from '@mui/icons-material/FilterAltOffRounded';
import MenuBookRoundedIcon from '@mui/icons-material/MenuBookRounded';
import PeopleAltRoundedIcon from '@mui/icons-material/PeopleAltRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import ViewKanbanRoundedIcon from '@mui/icons-material/ViewKanbanRounded';
import ViewListRoundedIcon from '@mui/icons-material/ViewListRounded';
import EpisodeStudioSettingsDrawer from './EpisodeStudioSettingsDrawer';
import StudioLayout, { useStudioSession } from './StudioLayout';
import {
  MASTERMIND_BOARD_STATUSES,
  MASTERMIND_EPISODE_TYPES,
  MASTERMIND_STATUS_OPTIONS,
  buildMastermindCalendarDays,
  buildMastermindMutation,
  buildMastermindSeasonMutation,
  filterMastermindPlans,
  groupMastermindBoard,
  groupMastermindResearch,
  listMastermindHostOptions,
  listMastermindProducerOptions,
  mastermindMonthStart,
  mastermindPlanDraft,
  mastermindSeasonDraft,
  normalizeMastermindPlan,
  normalizeSeasonMastermindData,
  shiftMastermindMonth,
  summarizeMastermindPlans,
} from '../lib/seasonMastermindPresentation.mjs';
import styles from '../styles/SeasonMastermind.module.css';

const VIEW_OPTIONS = [
  { id: 'list', label: 'List', icon: ViewListRoundedIcon },
  { id: 'board', label: 'Board', icon: ViewKanbanRoundedIcon },
  { id: 'calendar', label: 'Calendar', icon: CalendarMonthRoundedIcon },
  { id: 'research', label: 'Research', icon: MenuBookRoundedIcon },
];

const RESEARCH_OPTIONS = [
  { id: 'topics', label: 'Topics' },
  { id: 'guests', label: 'Guests' },
  { id: 'sources', label: 'Sources' },
];

const STATUS_LABELS = Object.fromEntries(
  MASTERMIND_STATUS_OPTIONS.map((status) => [status.id, status.label])
);
const TYPE_LABELS = Object.fromEntries(
  MASTERMIND_EPISODE_TYPES.map((type) => [type.id, type.label])
);
const SAFE_HANDOFF_ID = /^[A-Za-z0-9][A-Za-z0-9._:@/+=#-]{0,179}$/;
const MAX_LOAD_RETRIES = 3;

function episodeStudioHref(value, { preview = false } = {}) {
  const episodeId = String(value || '').trim();
  if (!SAFE_HANDOFF_ID.test(episodeId)) return '';
  return preview
    ? `/dev/episode-studio-usability-preview?source_mastermind_plan=${encodeURIComponent(
        episodeId
      )}`
    : `/studio/episodes/${encodeURIComponent(episodeId)}`;
}

function formatDate(value, fallback = 'Date pending') {
  if (!value) return fallback;
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return fallback;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatMonth(value) {
  return value.toLocaleDateString(undefined, {
    month: 'long',
    year: 'numeric',
  });
}

function formatQualityFlag(value) {
  const labels = {
    inferred_january_2027: 'January year inferred as 2027 from season order',
    air_date_year_corrected_from_2026_to_2027:
      'January year corrected from 2026 to 2027 using season order',
    restored_episode_number_11_10: 'Episode number restored from Excel 11.1',
    restored_episode_number_11_20: 'Episode number restored from Excel 11.2',
    episode_number_trailing_zero_restored:
      'Trailing zero in the episode number restored after Excel removed it',
    tentative_assignment: 'Workbook marks this assignment as tentative',
  };
  return labels[value] || String(value || '').replaceAll('_', ' ');
}

function firstMonthForSeason(workspace, seasonId) {
  const firstDate = workspace.plans
    .filter((plan) => plan.season_id === seasonId && plan.target_air_date)
    .map((plan) => plan.target_air_date)
    .sort()[0];
  const season = workspace.seasons.find(
    (candidate) => candidate.season_id === seasonId
  );
  return mastermindMonthStart(firstDate || season?.starts_on || new Date());
}

function mergeUniqueRecords(current = [], incoming = [], keyFor) {
  const records = new Map();
  [...current, ...incoming].forEach((record) => {
    const key = keyFor(record);
    if (key) records.set(key, record);
  });
  return [...records.values()];
}

function mergeMastermindPages(current, incoming) {
  return {
    ...current,
    seasons: mergeUniqueRecords(
      current.seasons,
      incoming.seasons,
      (season) => season.season_id
    ),
    plans: mergeUniqueRecords(
      current.plans,
      incoming.plans,
      (plan) => plan.episode_plan_id
    ),
    directory: {
      hosts: mergeUniqueRecords(
        current.directory.hosts,
        incoming.directory.hosts,
        (host) => mastermindHostKey(host)
      ),
      producers: mergeUniqueRecords(
        current.directory.producers,
        incoming.directory.producers,
        (producer) => producer.person_id
      ),
      guests: mergeUniqueRecords(
        current.directory.guests,
        incoming.directory.guests,
        (guest) => guest.guest_id || guest.display_name
      ),
      topics: mergeUniqueRecords(
        current.directory.topics,
        incoming.directory.topics,
        (topic) => topic.topic_id || topic.slug || topic.label
      ),
      sources: mergeUniqueRecords(
        current.directory.sources,
        incoming.directory.sources,
        (source) => source.source_id || source.canonical_url || source.title
      ),
    },
    page: incoming.page,
  };
}

function formatRole(value) {
  return String(value || 'host')
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

function safePublicUrl(value) {
  return /^https:\/\//i.test(String(value || '')) ? value : '';
}

function stateFromPreview(previewData, featureEnabled) {
  if (!featureEnabled) return 'disabled';
  if (!previewData) return 'loading';
  if (previewData.preview_state === 'loading') return 'loading';
  if (previewData.preview_state === 'waking') return 'waking';
  if (previewData.preview_state === 'error') return 'error';
  return 'ready';
}

function WorkspaceState({ kind, title, detail, action = null }) {
  return (
    <section
      className={`${styles.workspaceState} ${styles[`state_${kind}`] || ''}`}
      role={kind === 'error' ? 'alert' : 'status'}
      aria-live={kind === 'error' ? 'assertive' : 'polite'}
    >
      <span className={styles.stateMark} aria-hidden="true">
        {kind === 'error' ? '!' : kind === 'empty' ? '—' : '•'}
      </span>
      <div>
        <h2>{title}</h2>
        <p>{detail}</p>
        {action}
      </div>
    </section>
  );
}

function SeasonEditor({
  draft,
  error,
  mode,
  onCancel,
  onChange,
  onSubmit,
  saving,
}) {
  return (
    <section className={styles.firstSeason} aria-label="Planning season editor">
      <div className={styles.firstSeasonIntro}>
        <span className={styles.sectionEyebrow}>
          {mode === 'edit' ? 'Season settings' : 'Start together'}
        </span>
        <h2>{mode === 'edit' ? 'Edit planning season' : 'Create a planning season'}</h2>
        <p>
          {mode === 'edit'
            ? 'Correct the shared date window or editorial goal without rebuilding its episode plans.'
            : 'Give the shared board a clear date window and editorial goal. Episode plans can be added immediately afterward.'}
        </p>
      </div>
      <form className={styles.seasonForm} onSubmit={onSubmit}>
        {error ? (
          <p className={styles.formError} role="alert">
            {error}
          </p>
        ) : null}
        <label className={styles.fullField}>
          <span>Season name</span>
          <input
            type="text"
            maxLength={80}
            required
            value={draft.label}
            placeholder="Season 11"
            onChange={(event) => onChange({ label: event.target.value })}
          />
        </label>
        <label>
          <span>Starts</span>
          <input
            type="date"
            required
            value={draft.starts_on}
            onChange={(event) => onChange({ starts_on: event.target.value })}
          />
        </label>
        <label>
          <span>Ends</span>
          <input
            type="date"
            min={draft.starts_on || undefined}
            required
            value={draft.ends_on}
            onChange={(event) => onChange({ ends_on: event.target.value })}
          />
        </label>
        <label className={styles.fullField}>
          <span>Planning goal</span>
          <textarea
            rows={3}
            maxLength={2400}
            value={draft.planning_goal}
            placeholder="What should this season help listeners understand or do?"
            onChange={(event) =>
              onChange({ planning_goal: event.target.value })
            }
          />
        </label>
        <div className={`${styles.seasonActions} ${styles.fullField}`}>
          {onCancel ? (
            <button
              type="button"
              className={styles.secondaryAction}
              onClick={onCancel}
              disabled={saving}
            >
              Cancel
            </button>
          ) : null}
          <button
            type="submit"
            className={styles.primaryAction}
            disabled={
              saving ||
              !draft.label.trim() ||
              !draft.starts_on ||
              !draft.ends_on
            }
          >
            <AddRoundedIcon aria-hidden="true" />
            {saving
              ? mode === 'edit'
                ? 'Saving season…'
                : 'Creating season…'
              : mode === 'edit'
                ? 'Save season'
                : 'Create season'}
          </button>
        </div>
      </form>
    </section>
  );
}

function summarizeGuestStatuses(guests = []) {
  if (!guests.length) return 'Guest open';
  const counts = guests.reduce((summary, guest) => {
    const status = String(guest.invitation_status || 'candidate')
      .replaceAll('_', ' ')
      .trim();
    summary.set(status, (summary.get(status) || 0) + 1);
    return summary;
  }, new Map());
  return [...counts.entries()]
    .map(([status, count]) => `${count} ${status}`)
    .join(' · ');
}

function PlanCard({ plan, onOpen }) {
  const researchCount = plan.topics.length + plan.sources.length;
  const guestStatus = summarizeGuestStatuses(plan.guests);
  return (
    <button
      type="button"
      className={styles.planCard}
      onClick={() => onOpen(plan)}
      aria-label={`Open ${plan.working_title}`}
    >
      <span className={styles.cardTopline}>
        <span className={styles.typeBadge}>
          {TYPE_LABELS[plan.episode_type] || 'Regular episode'}
        </span>
        <time dateTime={plan.target_air_date || undefined}>
          {formatDate(plan.target_air_date, 'Unscheduled')}
        </time>
      </span>
      <strong>{plan.working_title}</strong>
      <span className={styles.cardPremise}>
        {plan.premise || 'Add the editorial premise.'}
      </span>
      <span className={styles.cardHosts}>
        <PeopleAltRoundedIcon aria-hidden="true" />
        {plan.hosts.length
          ? plan.hosts.map((host) => host.host_display_name).join(', ')
          : 'Host open'}
      </span>
      <span className={styles.cardSignals}>
        <span>{guestStatus}</span>
        <span>{researchCount} research links</span>
        <span>{plan.sponsor_commitments.length} sponsor items</span>
      </span>
    </button>
  );
}

function BoardView({ plans, statusFilter, onOpen }) {
  const statuses =
    statusFilter === 'archived'
      ? MASTERMIND_STATUS_OPTIONS.filter((status) => status.id === 'archived')
      : !['active', 'all', ''].includes(statusFilter)
        ? MASTERMIND_BOARD_STATUSES.filter(
            (status) => status.id === statusFilter
          )
        : MASTERMIND_BOARD_STATUSES;
  const columns = groupMastermindBoard(plans, statuses);
  return (
    <section
      className={styles.boardScroller}
      aria-label="Episode planning board"
      aria-describedby="mastermind-board-scroll-help"
      tabIndex={0}
    >
      <p className={styles.srOnly} id="mastermind-board-scroll-help">
        The planning columns scroll horizontally when they do not fit on screen.
      </p>
      <div className={styles.board}>
        {columns.map((column) => (
          <section className={styles.boardColumn} key={column.id}>
            <header>
              <span className={styles.statusDot} data-status={column.id} />
              <h2>{column.label}</h2>
              <span className={styles.countBadge}>{column.plans.length}</span>
            </header>
            <div className={styles.cardStack}>
              {column.plans.map((plan) => (
                <PlanCard
                  key={plan.episode_plan_id}
                  plan={plan}
                  onOpen={onOpen}
                />
              ))}
              {!column.plans.length ? (
                <p className={styles.columnEmpty}>No plans here</p>
              ) : null}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function ListView({ plans, onOpen }) {
  const rows = [...plans].sort((left, right) => {
    const leftDate = left.target_air_date || '9999-12-31';
    const rightDate = right.target_air_date || '9999-12-31';
    return (
      leftDate.localeCompare(rightDate) ||
      left.working_title.localeCompare(right.working_title)
    );
  });

  return (
    <section className={styles.listPanel} aria-labelledby="mastermind-list-title">
      <header className={styles.listHeader}>
        <div>
          <span className={styles.sectionEyebrow}>Season run of show</span>
          <h2 id="mastermind-list-title">Every episode plan</h2>
        </div>
        <span>{rows.length} plans</span>
      </header>
      <div className={styles.listScroll} tabIndex={0}>
        <table className={styles.planTable}>
          <thead>
            <tr>
              <th scope="col">No.</th>
              <th scope="col">Episode</th>
              <th scope="col">Air date</th>
              <th scope="col">Host</th>
              <th scope="col">Guest</th>
              <th scope="col">Status</th>
              <th scope="col">Sponsor</th>
              <th scope="col">Next step</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((plan) => (
              <tr key={plan.episode_plan_id}>
                <td data-label="No.">{plan.source_episode_number || '—'}</td>
                <td data-label="Episode">
                  <button type="button" onClick={() => onOpen(plan)}>
                    <strong>{plan.working_title}</strong>
                    <span>{TYPE_LABELS[plan.episode_type]}</span>
                  </button>
                </td>
                <td data-label="Air date">
                  <time dateTime={plan.target_air_date || undefined}>
                    {formatDate(plan.target_air_date, 'Unscheduled')}
                  </time>
                </td>
                <td data-label="Host">
                  {plan.hosts.length
                    ? plan.hosts
                        .map((host) => host.host_display_name)
                        .join(', ')
                    : 'Open'}
                </td>
                <td data-label="Guest">
                  {plan.guests.length
                    ? plan.guests.map((guest) => guest.display_name).join(', ')
                    : 'Open'}
                </td>
                <td data-label="Status">
                  <span className={styles.listStatus} data-status={plan.status}>
                    {STATUS_LABELS[plan.status]}
                  </span>
                </td>
                <td data-label="Sponsor">
                  {plan.sponsor_commitments.length
                    ? plan.sponsor_commitments
                        .map((commitment) => commitment.sponsor_display_name)
                        .join(', ')
                    : '—'}
                </td>
                <td data-label="Next step">
                  <button
                    type="button"
                    className={styles.rowAction}
                    onClick={() => onOpen(plan)}
                  >
                    {plan.linked_episode_id
                      ? 'Open Studio'
                      : plan.status === 'ready'
                        ? 'Create Studio'
                        : 'Review plan'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function CalendarView({ plans, month, onMonthChange, onOpen }) {
  const days = buildMastermindCalendarDays(month, plans);
  const unscheduled = plans.filter((plan) => !plan.target_air_date);
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(
    2,
    '0'
  )}`;
  const agendaPlans = plans
    .filter((plan) => plan.target_air_date?.startsWith(monthKey))
    .sort((left, right) =>
      `${left.target_air_date}:${left.working_title}`.localeCompare(
        `${right.target_air_date}:${right.working_title}`
      )
    );
  const todayKey = new Date().toLocaleDateString('en-CA');
  return (
    <section className={styles.calendarPanel}>
      <header className={styles.calendarToolbar}>
        <div>
          <span className={styles.sectionEyebrow}>Shared schedule</span>
          <h2>{formatMonth(month)}</h2>
        </div>
        <div className={styles.monthActions}>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMastermindMonth(month, -1))}
            aria-label="Previous month"
          >
            <ArrowBackRoundedIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.todayButton}
            onClick={() => onMonthChange(mastermindMonthStart(new Date()))}
          >
            Today
          </button>
          <button
            type="button"
            onClick={() => onMonthChange(shiftMastermindMonth(month, 1))}
            aria-label="Next month"
          >
            <ArrowForwardRoundedIcon aria-hidden="true" />
          </button>
        </div>
      </header>

      <div className={styles.calendarLayout}>
        <div
          className={styles.calendarScroll}
          role="region"
          tabIndex={0}
          aria-label={`${formatMonth(month)} planning calendar grid`}
        >
          <section
            className={styles.calendarGrid}
            aria-label={`${formatMonth(month)} episode plans`}
          >
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div className={styles.weekday} aria-hidden="true" key={day}>
                {day}
              </div>
            ))}
            {days.map((day) => (
              <div
                className={`${styles.calendarDay} ${
                  day.inMonth ? '' : styles.outsideMonth
                } ${day.key === todayKey ? styles.today : ''}`}
                key={day.key}
              >
                <span className={styles.srOnly}>
                  {formatDate(day.key)}, {day.plans.length} plans
                </span>
                <time dateTime={day.key}>{day.date.getDate()}</time>
                <div className={styles.calendarPlans}>
                  {day.plans.map((plan) => (
                    <button
                      type="button"
                      key={plan.episode_plan_id}
                      tabIndex={-1}
                      data-status={plan.status}
                      onClick={() => onOpen(plan)}
                      aria-label={`Open ${plan.working_title}, ${formatDate(
                        plan.target_air_date
                      )}, ${STATUS_LABELS[plan.status]}, ${
                        TYPE_LABELS[plan.episode_type]
                      }`}
                    >
                      <span>{plan.working_title}</span>
                      <small>{TYPE_LABELS[plan.episode_type]}</small>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </section>
        </div>

        <aside
          className={styles.calendarAgenda}
          aria-labelledby="mastermind-month-lineup-title"
        >
          <header className={styles.calendarAgendaHeader}>
            <div>
              <span className={styles.sectionEyebrow}>Month lineup</span>
              <h3
                id="mastermind-month-lineup-title"
                aria-live="polite"
                aria-atomic="true"
              >
                {formatMonth(month)}
              </h3>
            </div>
            <span className={styles.calendarAgendaCount}>
              {agendaPlans.length} {agendaPlans.length === 1 ? 'plan' : 'plans'}
            </span>
          </header>
          <div className={styles.calendarAgendaList}>
            {agendaPlans.length ? (
              agendaPlans.map((plan) => (
                <button
                  type="button"
                  key={plan.episode_plan_id}
                  data-status={plan.status}
                  onClick={() => onOpen(plan)}
                  aria-label={`Open ${plan.working_title}, ${formatDate(
                    plan.target_air_date
                  )}, ${STATUS_LABELS[plan.status]}, ${
                    TYPE_LABELS[plan.episode_type]
                  }`}
                >
                  <time dateTime={plan.target_air_date}>
                    {formatDate(plan.target_air_date)}
                  </time>
                  <strong>{plan.working_title}</strong>
                  <span>
                    {STATUS_LABELS[plan.status]} ·{' '}
                    {TYPE_LABELS[plan.episode_type]}
                  </span>
                </button>
              ))
            ) : (
              <p>No dated plans in this month.</p>
            )}
          </div>
        </aside>
      </div>

      {unscheduled.length ? (
        <section className={styles.unscheduled}>
          <h3>Still needs an air date</h3>
          <div>
            {unscheduled.map((plan) => (
              <button
                type="button"
                key={plan.episode_plan_id}
                onClick={() => onOpen(plan)}
              >
                <span>{plan.working_title}</span>
                <small>{STATUS_LABELS[plan.status]}</small>
              </button>
            ))}
          </div>
        </section>
      ) : null}
    </section>
  );
}

function ResearchView({ plans, mode, onModeChange, onOpen }) {
  const groups = groupMastermindResearch(plans, mode);
  return (
    <section className={styles.researchPanel}>
      <header className={styles.researchHeader}>
        <div>
          <span className={styles.sectionEyebrow}>Planning index</span>
          <h2>Find the thinking behind the season</h2>
          <p>
            Reuse reviewed public research and see where an episode still needs
            context.
          </p>
        </div>
        <div
          className={styles.segmentedControl}
          role="group"
          aria-label="Group research plans by"
        >
          {RESEARCH_OPTIONS.map((option) => (
            <button
              type="button"
              aria-pressed={mode === option.id}
              className={mode === option.id ? styles.selectedSegment : ''}
              onClick={() => onModeChange(option.id)}
              key={option.id}
            >
              {option.label}
            </button>
          ))}
        </div>
      </header>
      <div className={styles.researchGrid}>
        {groups.map((group) => (
          <section
            className={`${styles.researchGroup} ${
              group.id.startsWith('needs-') ? styles.researchGap : ''
            }`}
            key={group.id}
          >
            <header>
              <h3>{group.label}</h3>
              <span>{group.plans.length}</span>
            </header>
            <div>
              {group.plans.map((plan) => (
                <button
                  type="button"
                  onClick={() => onOpen(plan)}
                  key={plan.episode_plan_id}
                >
                  <strong>{plan.working_title}</strong>
                  <span>
                    {STATUS_LABELS[plan.status]} ·{' '}
                    {formatDate(plan.target_air_date, 'Unscheduled')}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
      </div>
    </section>
  );
}

function RelationshipSection({ plan, preview = false, showHosts = true }) {
  const linkedEpisodeHref = episodeStudioHref(plan.linked_episode_id, {
    preview,
  });
  return (
    <div className={styles.relationshipSections}>
      <section>
        <h3>People</h3>
        <dl className={styles.detailList}>
          {showHosts ? (
            <div>
              <dt>Hosts</dt>
              <dd>
                {plan.hosts.length
                  ? plan.hosts.map((host) => (
                      <span
                        className={styles.detailChip}
                        key={host.host_person_id || host.host_display_name}
                      >
                        {host.host_display_name} · {formatRole(host.host_role)}
                      </span>
                    ))
                  : 'Not assigned'}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>Guest candidates</dt>
            <dd>
              {plan.guests.length
                ? plan.guests.map((guest) => (
                    <span className={styles.detailChip} key={guest.guest_id || guest.display_name}>
                      {guest.display_name} ·{' '}
                      {guest.invitation_status.replaceAll('_', ' ')}
                    </span>
                  ))
                : 'No reviewed candidate yet'}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Research</h3>
        <dl className={styles.detailList}>
          <div>
            <dt>Topics</dt>
            <dd>
              {plan.topics.length
                ? plan.topics.map((topic) => (
                    <span className={styles.detailChip} key={topic.topic_id || topic.label}>
                      {topic.label}
                    </span>
                  ))
                : 'Topics needed'}
            </dd>
          </div>
          <div>
            <dt>Public sources</dt>
            <dd className={styles.sourceList}>
              {plan.sources.length
                ? plan.sources.map((source) => {
                    const url = safePublicUrl(source.canonical_url);
                    return url ? (
                      <a
                        href={url}
                        target="_blank"
                        rel="noopener noreferrer"
                        key={source.source_id || source.title}
                      >
                        {source.title}
                        {source.publisher ? ` · ${source.publisher}` : ''}
                      </a>
                    ) : (
                      <span key={source.source_id || source.title}>
                        {source.title}
                      </span>
                    );
                  })
                : 'Sources needed'}
            </dd>
          </div>
        </dl>
      </section>

      <section>
        <h3>Sponsors & handoff</h3>
        <dl className={styles.detailList}>
          <div>
            <dt>Commitments</dt>
            <dd>
              {plan.sponsor_commitments.length
                ? plan.sponsor_commitments.map((commitment) => (
                    <span
                      className={styles.detailChip}
                      key={
                        commitment.commitment_id ||
                        commitment.sponsor_display_name
                      }
                    >
                      {commitment.sponsor_display_name} ·{' '}
                      {commitment.commitment_status.replaceAll('_', ' ')}
                    </span>
                  ))
                : 'No commitments'}
            </dd>
          </div>
          <div>
            <dt>Connected work</dt>
            <dd className={styles.handoffLinks}>
              {plan.source_intake_item_id ? (
                <Link href={`/studio/inbox?item=${encodeURIComponent(plan.source_intake_item_id)}`}>
                  Team Follow-up
                </Link>
              ) : null}
              {linkedEpisodeHref ? (
                <Link href={linkedEpisodeHref}>
                  Episode Studio
                </Link>
              ) : null}
              {plan.linked_episode_id && !linkedEpisodeHref ? (
                <span>Episode Studio link unavailable</span>
              ) : null}
              {!plan.source_intake_item_id && !plan.linked_episode_id
                ? 'No handoff yet'
                : null}
            </dd>
          </div>
        </dl>
      </section>

      {plan.source_sheet ||
      plan.source_episode_number ||
      plan.recording_note ||
      plan.source_status_note ||
      plan.source_host_note ||
      plan.source_guest_note ||
      plan.source_quality_flags.length ? (
        <section>
          <h3>Workbook record</h3>
          <dl className={styles.detailList}>
            <div>
              <dt>Source</dt>
              <dd>
                {plan.source_sheet || 'Season 11 workbook'}
                {plan.source_row ? ` · row ${plan.source_row}` : ''}
                {plan.source_episode_number
                  ? ` · episode ${plan.source_episode_number}`
                  : ''}
              </dd>
            </div>
            {plan.recording_note ? (
              <div>
                <dt>Recording note</dt>
                <dd>{plan.recording_note}</dd>
              </div>
            ) : null}
            {plan.source_host_note ? (
              <div>
                <dt>Original host cell</dt>
                <dd>{plan.source_host_note}</dd>
              </div>
            ) : null}
            {plan.source_guest_note ? (
              <div>
                <dt>Original guest cell</dt>
                <dd>{plan.source_guest_note}</dd>
              </div>
            ) : null}
            {plan.source_status_note ? (
              <div>
                <dt>Source status</dt>
                <dd>{plan.source_status_note}</dd>
              </div>
            ) : null}
            {plan.source_quality_flags.length ? (
              <div>
                <dt>Import review</dt>
                <dd>
                  {plan.source_quality_flags.map((flag) => (
                    <span className={styles.detailChip} key={flag}>
                      {formatQualityFlag(flag)}
                    </span>
                  ))}
                </dd>
              </div>
            ) : null}
          </dl>
        </section>
      ) : null}
    </div>
  );
}

function SeasonMastermindContent({
  previewData = null,
  onUnsavedChanges = null,
}) {
  const router = useRouter();
  const preview = previewData !== null;
  const studioSession = useStudioSession();
  const featureEnabled = preview
    ? previewData.featureEnabled !== false &&
      previewData.preview_state !== 'disabled'
    : studioSession?.features?.season_mastermind === true;
  const initialWorkspace = normalizeSeasonMastermindData(previewData || {}, {
    preview,
  });
  const requestedSeasonId = previewData?.selected_season_id || '';
  const initialSeasonId = initialWorkspace.seasons.some(
    (season) => season.season_id === requestedSeasonId
  )
    ? requestedSeasonId
    : initialWorkspace.seasons[0]?.season_id || '';
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [loadState, setLoadState] = useState(() =>
    stateFromPreview(previewData, featureEnabled)
  );
  const [loadError, setLoadError] = useState(
    previewData?.preview_state === 'error'
      ? previewData.error || 'Season Mastermind could not be opened.'
      : ''
  );
  const [retryCount, setRetryCount] = useState(0);
  const [reloadKey, setReloadKey] = useState(0);
  const [view, setView] = useState(previewData?.view || 'list');
  const [seasonId, setSeasonId] = useState(initialSeasonId);
  const [query, setQuery] = useState('');
  const [searchDraft, setSearchDraft] = useState('');
  const [hostFilter, setHostFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('active');
  const [typeFilter, setTypeFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');
  const [researchMode, setResearchMode] = useState('topics');
  const [calendarMonth, setCalendarMonth] = useState(() =>
    mastermindMonthStart(
      initialWorkspace.plans.find((plan) => plan.target_air_date)
        ?.target_air_date || new Date()
    )
  );
  const [drawerMode, setDrawerMode] = useState('');
  const [selectedPlanId, setSelectedPlanId] = useState('');
  const [draft, setDraft] = useState(mastermindPlanDraft());
  const [initialDraft, setInitialDraft] = useState(mastermindPlanDraft());
  const [saving, setSaving] = useState(false);
  const [drawerError, setDrawerError] = useState('');
  const [conflictState, setConflictState] = useState('');
  const [latestPlan, setLatestPlan] = useState(null);
  const [reviewingLatest, setReviewingLatest] = useState(false);
  const [message, setMessage] = useState('');
  const [seasonDraft, setSeasonDraft] = useState(mastermindSeasonDraft());
  const [seasonEditorMode, setSeasonEditorMode] = useState('');
  const [seasonSaving, setSeasonSaving] = useState(false);
  const [seasonError, setSeasonError] = useState('');
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadMoreError, setLoadMoreError] = useState('');
  const [scopeLoading, setScopeLoading] = useState(false);
  const [scopeError, setScopeError] = useState('');
  const [intakeHandoffId, setIntakeHandoffId] = useState('');
  const [producerPersonId, setProducerPersonId] = useState('');
  const [episodeHandoffBusy, setEpisodeHandoffBusy] = useState(false);
  const [episodeHandoff, setEpisodeHandoff] = useState(null);
  const episodeHandoffLock = useRef(false);

  useEffect(() => {
    if (preview || !featureEnabled) return undefined;
    const controller = new AbortController();
    let alive = true;
    const wakeTimer = window.setTimeout(() => {
      if (alive) setLoadState('waking');
    }, 1100);

    async function loadWorkspace() {
      setLoadState('loading');
      setLoadError('');
      try {
        const response = await fetch('/api/studio/mastermind', {
          credentials: 'same-origin',
          signal: controller.signal,
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok || data.ok === false) {
          const error = new Error(
            data.error || 'Season Mastermind could not be opened.'
          );
          error.code = data.code || '';
          throw error;
        }
        if (!alive) return;
        const normalized = normalizeSeasonMastermindData(data);
        const nextSeasonId = normalized.seasons[0]?.season_id || '';
        setWorkspace(normalized);
        setSeasonId(nextSeasonId);
        setCalendarMonth(firstMonthForSeason(normalized, nextSeasonId));
        setLoadState('ready');
      } catch (error) {
        if (!alive || error.name === 'AbortError') return;
        setLoadError(
          error.code === 'PROFILE_NOT_CONNECTED'
            ? 'Your Studio account is not connected to a team profile yet.'
            : error.message || 'Season Mastermind could not be opened.'
        );
        setLoadState('error');
      } finally {
        window.clearTimeout(wakeTimer);
      }
    }

    loadWorkspace();
    return () => {
      alive = false;
      window.clearTimeout(wakeTimer);
      controller.abort();
    };
  }, [featureEnabled, preview, reloadKey]);

  const selectedPlan = workspace.plans.find(
    (plan) => plan.episode_plan_id === selectedPlanId
  );
  const seasonPlans = useMemo(
    () =>
      workspace.plans.filter((plan) => plan.season_id === seasonId),
    [seasonId, workspace.plans]
  );
  const hostOptions = useMemo(
    () => listMastermindHostOptions(seasonPlans, workspace.directory),
    [seasonPlans, workspace.directory]
  );
  const assignmentHostOptions = useMemo(
    () =>
      listMastermindHostOptions(workspace.plans, workspace.directory).filter(
        (host) => host.personId
      ),
    [workspace.directory, workspace.plans]
  );
  const producerOptions = useMemo(
    () => listMastermindProducerOptions(workspace.directory),
    [workspace.directory]
  );
  const visiblePlans = useMemo(
    () =>
      filterMastermindPlans(workspace.plans, {
        seasonId,
        query,
        hostKey: hostFilter,
        status: statusFilter,
        episodeType: typeFilter,
        targetDate: dateFilter,
      }),
    [
      dateFilter,
      hostFilter,
      query,
      seasonId,
      statusFilter,
      typeFilter,
      workspace.plans,
    ]
  );
  const summaryPlans = preview ? visiblePlans : seasonPlans;
  const summary = useMemo(
    () =>
      summarizeMastermindPlans(
        summaryPlans.filter((plan) => plan.status !== 'archived')
      ),
    [summaryPlans]
  );
  const summaryTotal = preview
    ? visiblePlans.length
    : Number.isInteger(workspace.page?.total_plans)
      ? workspace.page.total_plans
      : summary.total;
  const partialSummary = !preview && workspace.page?.has_more === true;
  const draftDirty = JSON.stringify(draft) !== JSON.stringify(initialDraft);
  const draftNeedsTargetDate =
    ['scheduled', 'recording', 'published'].includes(draft.status) &&
    !draft.target_air_date;
  const drawerOpen = Boolean(drawerMode);
  const selectedPlanIsLinked = Boolean(selectedPlan?.linked_episode_id);
  const hasUnsavedChanges =
    drawerOpen && draftDirty && workspace.canManage && !selectedPlanIsLinked;
  const hasFilters = Boolean(
    query ||
      searchDraft ||
      hostFilter ||
      !['', 'active'].includes(statusFilter) ||
      typeFilter ||
      dateFilter
  );
  const canHandoffEpisode =
    workspace.canManage &&
    studioSession?.permissions?.includes('mastermind:manage') &&
    studioSession?.permissions?.includes('episodes:manage');
  const linkedEpisodeHref = episodeStudioHref(
    selectedPlan?.linked_episode_id || episodeHandoff?.episodeId,
    { preview }
  );
  const linkedEpisodeIdIsUnsafe = Boolean(
    selectedPlan?.linked_episode_id &&
      !episodeStudioHref(selectedPlan.linked_episode_id, { preview })
  );
  const selectedProducerIsCurrent = producerOptions.some(
    (producer) => producer.id === producerPersonId
  );

  useEffect(() => {
    onUnsavedChanges?.(hasUnsavedChanges);
    return () => onUnsavedChanges?.(false);
  }, [hasUnsavedChanges, onUnsavedChanges]);

  useEffect(() => {
    if (
      preview ||
      !router.isReady ||
      loadState !== 'ready' ||
      !workspace.canManage ||
      drawerOpen ||
      intakeHandoffId
    ) {
      return;
    }
    const rawSource = Array.isArray(router.query.from_intake)
      ? router.query.from_intake[0]
      : router.query.from_intake;
    const sourceId = String(rawSource || '').trim();
    if (!SAFE_HANDOFF_ID.test(sourceId) || !seasonId) return;
    const nextDraft = {
      ...mastermindPlanDraft({}, seasonId),
      source_intake_item_id: sourceId,
    };
    const frame = window.requestAnimationFrame(() => {
      setSelectedPlanId('');
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setIntakeHandoffId(sourceId);
      setDrawerMode('create');
      setDrawerError('');
      setConflictState('');
      setLatestPlan(null);
      setMessage('');
      setProducerPersonId('');
      setEpisodeHandoff(null);
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    drawerOpen,
    intakeHandoffId,
    loadState,
    preview,
    router.isReady,
    router.query.from_intake,
    seasonId,
    workspace.canManage,
  ]);

  function openPlan(plan) {
    const nextDraft = mastermindPlanDraft(plan);
    setSelectedPlanId(plan.episode_plan_id);
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setDrawerMode('view');
    setDrawerError('');
    setConflictState('');
    setLatestPlan(null);
    setMessage('');
    setIntakeHandoffId('');
    setProducerPersonId('');
    setEpisodeHandoff(null);
  }

  function openNewPlan() {
    if (!seasonId) return;
    const nextDraft = mastermindPlanDraft({}, seasonId);
    setSelectedPlanId('');
    setDraft(nextDraft);
    setInitialDraft(nextDraft);
    setDrawerMode('create');
    setDrawerError('');
    setConflictState('');
    setLatestPlan(null);
    setMessage('');
    setIntakeHandoffId('');
    setProducerPersonId('');
    setEpisodeHandoff(null);
  }

  function openNewSeason() {
    setSeasonDraft(mastermindSeasonDraft());
    setSeasonEditorMode('create');
    setSeasonError('');
  }

  function openEditSeason() {
    const season = workspace.seasons.find(
      (candidate) => candidate.season_id === seasonId
    );
    if (!season) return;
    setSeasonDraft(mastermindSeasonDraft(season));
    setSeasonEditorMode('edit');
    setSeasonError('');
  }

  function closeDrawer() {
    if (
      hasUnsavedChanges &&
      !window.confirm('Discard the unsaved changes to this episode plan?')
    ) {
      return;
    }
    setDrawerMode('');
    setDrawerError('');
    setConflictState('');
    setLatestPlan(null);
    setMessage('');
    setProducerPersonId('');
    setEpisodeHandoff(null);
    if (intakeHandoffId && !preview) {
      router.replace('/studio/mastermind', undefined, { shallow: true });
    }
    setIntakeHandoffId('');
  }

  function clearFilters() {
    const reset = {
      query: '',
      hostFilter: '',
      statusFilter: 'active',
      typeFilter: '',
      dateFilter: '',
    };
    setQuery('');
    setSearchDraft('');
    setHostFilter('');
    setStatusFilter('active');
    setTypeFilter('');
    setDateFilter('');
    requestPlanScope(reset);
  }

  function planScopeParams(overrides = {}, page = 1) {
    const scope = {
      seasonId,
      query,
      hostFilter,
      statusFilter,
      typeFilter,
      dateFilter,
      ...overrides,
    };
    const params = new URLSearchParams({
      page: String(page),
      page_size: '50',
    });
    if (scope.seasonId) params.set('season_id', scope.seasonId);
    if (scope.query.trim()) params.set('query', scope.query.trim());
    if (scope.typeFilter) params.set('episode_type', scope.typeFilter);
    if (scope.statusFilter === 'archived') {
      params.set('status', 'archived');
      params.set('include_archived', 'true');
    } else if (!['', 'active', 'all'].includes(scope.statusFilter)) {
      params.set('status', scope.statusFilter);
    }
    const hostPersonId = hostOptions.find(
      (host) => host.id === scope.hostFilter
    )?.personId;
    if (hostPersonId) params.set('host_person_id', hostPersonId);
    if (scope.dateFilter) {
      params.set('from_date', scope.dateFilter);
      params.set('to_date', scope.dateFilter);
    }
    return params.toString();
  }

  async function requestPlanScope(
    overrides = {},
    { page = 1, append = false } = {}
  ) {
    if (preview) return;
    if (append) {
      if (loadingMore) return;
      setLoadingMore(true);
      setLoadMoreError('');
    } else {
      if (scopeLoading) return;
      setScopeLoading(true);
      setScopeError('');
    }
    try {
      const queryString = planScopeParams(overrides, page);
      const response = await fetch(`/api/studio/mastermind?${queryString}`, {
        credentials: 'same-origin',
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'More episode plans could not be loaded.');
      }
      const nextPage = normalizeSeasonMastermindData(data);
      setWorkspace((current) =>
        append
          ? mergeMastermindPages(current, nextPage)
          : {
              ...nextPage,
              seasons: mergeUniqueRecords(
                current.seasons,
                nextPage.seasons,
                (season) => season.season_id
              ),
              directory: {
                ...nextPage.directory,
                hosts: mergeUniqueRecords(
                  current.directory.hosts,
                  nextPage.directory.hosts,
                  (host) => mastermindHostKey(host)
                ),
              },
            }
      );
    } catch (error) {
      const detail = error.message || 'Episode plans could not be loaded.';
      if (append) setLoadMoreError(detail);
      else setScopeError(detail);
    } finally {
      if (append) setLoadingMore(false);
      else setScopeLoading(false);
    }
  }

  async function loadMorePlans() {
    if (preview || loadingMore || !workspace.page?.has_more) return;
    await requestPlanScope({}, {
      page: (workspace.page?.number || 1) + 1,
      append: true,
    });
  }

  function applySearch(event) {
    event.preventDefault();
    const nextQuery = searchDraft.trim();
    setQuery(nextQuery);
    requestPlanScope({ query: nextQuery });
  }

  async function createEpisodeStudioFromPlan() {
    if (
      !selectedPlan ||
      !canHandoffEpisode ||
      episodeHandoffBusy ||
      episodeHandoffLock.current ||
      draftDirty ||
      !selectedProducerIsCurrent ||
      selectedPlan.status !== 'ready'
    ) {
      return;
    }
    episodeHandoffLock.current = true;
    setEpisodeHandoffBusy(true);
    setEpisodeHandoff(null);
    setDrawerError('');
    try {
      if (preview) {
        const episodeId = `preview-episode-${selectedPlan.episode_plan_id}`;
        const nextPlan = normalizeMastermindPlan({
          ...selectedPlan,
          linked_episode_id: episodeId,
          status: 'scheduled',
        });
        setWorkspace((current) => ({
          ...current,
          plans: current.plans.map((plan) =>
            plan.episode_plan_id === nextPlan.episode_plan_id ? nextPlan : plan
          ),
        }));
        setEpisodeHandoff({
          kind: 'linked',
          episodeId,
          retryable: false,
          message: 'Preview Episode Studio created and linked locally.',
        });
        return;
      }
      const response = await fetch(
        '/api/studio/mastermind/handoffs/episode',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            episode_plan_id: selectedPlan.episode_plan_id,
            season_id: selectedPlan.season_id,
            producer_person_id: producerPersonId,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const error = new Error(
          data.error || 'The Episode Studio could not be created.'
        );
        error.code = String(data.code || 'EPISODE_HANDOFF_FAILED');
        error.status = response.status;
        throw error;
      }
      const episodeId = String(data.episode?.episode_id || '').trim();
      const responseEpisodeId = SAFE_HANDOFF_ID.test(episodeId)
        ? episodeId
        : '';
      if (
        response.status === 202 &&
        data.code === 'EPISODE_CREATED_LINK_PENDING' &&
        data.link_pending === true
      ) {
        setEpisodeHandoff({
          kind: 'pending',
          episodeId: responseEpisodeId,
          retryable: data.retryable !== false,
          message:
            data.message ||
            'The Episode Studio exists, but the planning link still needs repair.',
        });
        return;
      }
      if (
        ![200, 201].includes(response.status) ||
        data.link_pending === true
      ) {
        const error = new Error(
          'Episode Studio returned an unexpected handoff response. Your plan is still open; retry to confirm the link.'
        );
        error.code = 'EPISODE_HANDOFF_RESPONSE_INVALID';
        error.status = response.status;
        throw error;
      }
      const planEpisodeId = String(data.plan?.linked_episode_id || '').trim();
      const linkedEpisodeId = responseEpisodeId ||
        (SAFE_HANDOFF_ID.test(planEpisodeId) ? planEpisodeId : '');
      if (!linkedEpisodeId) {
        const error = new Error(
          'The handoff was confirmed, but no safe Episode Studio destination was returned. Retry to confirm the link.'
        );
        error.code = 'EPISODE_HANDOFF_DESTINATION_MISSING';
        error.status = response.status;
        throw error;
      }
      const responseRevision = Number.parseInt(data.plan?.revision, 10);
      const nextPlan = normalizeMastermindPlan({
        ...selectedPlan,
        revision:
          Number.isInteger(responseRevision) && responseRevision > 0
            ? responseRevision
            : selectedPlan.revision,
        status: data.plan?.status || selectedPlan.status,
        linked_episode_id: linkedEpisodeId,
      });
      setWorkspace((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.episode_plan_id === nextPlan.episode_plan_id ? nextPlan : plan
        ),
      }));
      setEpisodeHandoff({
        kind: 'linked',
        episodeId: nextPlan.linked_episode_id,
        retryable: false,
        message: response.status === 201 || data.created === true
          ? 'Episode Studio created and linked.'
          : 'Episode Studio link confirmed.',
      });
    } catch (error) {
      setEpisodeHandoff({
        kind: 'error',
        episodeId: '',
        retryable: true,
        message: error.message || 'The Episode Studio could not be created.',
      });
    } finally {
      episodeHandoffLock.current = false;
      setEpisodeHandoffBusy(false);
    }
  }

  function setHostAssignment(personId, checked) {
    setDraft((current) => ({
      ...current,
      host_person_ids: checked
        ? [...new Set([...current.host_person_ids, personId])]
        : current.host_person_ids.filter((candidate) => candidate !== personId),
    }));
  }

  async function savePlan(event, draftOverride = null) {
    event.preventDefault();
    if (!workspace.canManage || saving) return;
    if (drawerMode !== 'create' && selectedPlan?.linked_episode_id) {
      setDrawerError(
        'This plan is read only after handoff. Make production changes in its linked Episode Studio.'
      );
      return;
    }
    setSaving(true);
    setDrawerError('');
    setMessage('');
    const action = drawerMode === 'create' ? 'create_plan' : 'update_plan';
    try {
      const mutation = buildMastermindMutation(
        action,
        draftOverride || draft,
        selectedPlan
      );
      if (preview) {
        const previewHosts = mutation.input.host_person_ids
          .map((personId) => {
            const option = assignmentHostOptions.find(
              (host) => host.personId === personId
            );
            return option
              ? {
                  host_person_id: personId,
                  host_display_name: option.label,
                  host_role: 'host',
                  assignment_status: 'proposed',
                }
              : null;
          })
          .filter(Boolean);
        const nextPlan = normalizeMastermindPlan({
          ...(selectedPlan || {}),
          ...mutation.input,
          hosts: previewHosts,
          episode_plan_id:
            selectedPlan?.episode_plan_id ||
            `preview-plan-${workspace.plans.length + 1}`,
          revision: (selectedPlan?.revision || 0) + 1,
        });
        setWorkspace((current) => ({
          ...current,
          plans:
            action === 'create_plan'
              ? [...current.plans, nextPlan]
              : current.plans.map((plan) =>
                  plan.episode_plan_id === nextPlan.episode_plan_id
                    ? nextPlan
                    : plan
                ),
        }));
        setSelectedPlanId(nextPlan.episode_plan_id);
        const nextDraft = mastermindPlanDraft(nextPlan);
        setDraft(nextDraft);
        setInitialDraft(nextDraft);
        setDrawerMode('view');
        setConflictState('');
        setLatestPlan(null);
        setMessage(
          action === 'create_plan'
            ? 'Preview plan created locally.'
            : 'Preview plan updated locally.'
        );
        return;
      }

      const response = await fetch(
        intakeHandoffId
          ? '/api/studio/mastermind/handoffs/intake'
          : '/api/studio/mastermind',
        {
          method: 'POST',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(
            intakeHandoffId
              ? { item_id: intakeHandoffId, plan: mutation.input }
              : mutation
          ),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        const error = new Error(data.error || 'The episode plan could not be saved.');
        error.code = data.code || '';
        error.status = response.status;
        throw error;
      }
      if (!data.plan) {
        setDrawerMode('');
        setReloadKey((current) => current + 1);
        return;
      }
      const nextPlan = normalizeMastermindPlan(data.plan);
      setWorkspace((current) => ({
        ...current,
        plans: mergeUniqueRecords(
          current.plans.filter(
            (plan) => plan.episode_plan_id !== nextPlan.episode_plan_id
          ),
          [nextPlan],
          (plan) => plan.episode_plan_id
        ),
      }));
      setSelectedPlanId(nextPlan.episode_plan_id);
      const nextDraft = mastermindPlanDraft(nextPlan);
      setDraft(nextDraft);
      setInitialDraft(nextDraft);
      setDrawerMode('view');
      setConflictState('');
      setLatestPlan(null);
      setMessage(
        intakeHandoffId
          ? data.created === false
            ? 'Existing research plan opened. The Follow-up discussion stayed private.'
            : 'Research plan created. The Follow-up discussion stayed private.'
          : action === 'create_plan'
          ? 'Episode plan created.'
          : 'Episode plan updated.'
      );
      if (intakeHandoffId) {
        setIntakeHandoffId('');
        router.replace('/studio/mastermind', undefined, { shallow: true });
      }
    } catch (error) {
      setDrawerError(
        error.status === 409 || error.code === 'REVISION_CONFLICT'
          ? 'Someone changed this plan first. Your draft is still here.'
          : error.message || 'The episode plan could not be saved.'
      );
      setConflictState(
        error.status === 409 || error.code === 'REVISION_CONFLICT'
          ? 'stale'
          : ''
      );
      setLatestPlan(null);
    } finally {
      setSaving(false);
    }
  }

  async function markPlanReady() {
    if (
      !selectedPlan ||
      selectedPlan.linked_episode_id ||
      !workspace.canManage ||
      saving ||
      !['idea', 'researching'].includes(selectedPlan.status)
    ) {
      return;
    }
    const readyDraft = { ...draft, status: 'ready' };
    setDraft(readyDraft);
    await savePlan({ preventDefault() {} }, readyDraft);
  }

  async function reviewLatestPlan() {
    if (!selectedPlan || reviewingLatest) return;
    setReviewingLatest(true);
    setDrawerError('');
    try {
      let latest;
      if (preview) {
        latest = normalizeMastermindPlan({
          ...selectedPlan,
          revision: selectedPlan.revision + 1,
        });
      } else {
        for (let page = 1; page <= 10 && !latest; page += 1) {
          const queryString = new URLSearchParams({
            season_id: selectedPlan.season_id,
            page: String(page),
            page_size: '50',
          }).toString();
          const response = await fetch(`/api/studio/mastermind?${queryString}`, {
            credentials: 'same-origin',
          });
          const data = await response.json().catch(() => ({}));
          if (!response.ok || data.ok === false) {
            throw new Error(
              data.error || 'The latest plan could not be loaded.'
            );
          }
          const normalized = normalizeSeasonMastermindData(data);
          latest = normalized.plans.find(
            (plan) => plan.episode_plan_id === selectedPlan.episode_plan_id
          );
          if (normalized.page.has_more !== true) break;
        }
      }
      if (!latest) {
        throw new Error('The latest episode plan is no longer available.');
      }
      setWorkspace((current) => ({
        ...current,
        plans: current.plans.map((plan) =>
          plan.episode_plan_id === latest.episode_plan_id ? latest : plan
        ),
      }));
      setLatestPlan(latest);
      setConflictState('reviewed');
      setMessage(
        'Latest revision loaded. Your draft is preserved; review it, then retry.'
      );
    } catch (error) {
      setDrawerError(
        error.message || 'The latest plan could not be loaded.'
      );
    } finally {
      setReviewingLatest(false);
    }
  }

  async function createSeason(event) {
    event.preventDefault();
    if (!workspace.canManage || seasonSaving) return;
    setSeasonSaving(true);
    setSeasonError('');
    setMessage('');
    try {
      const currentSeason =
        seasonEditorMode === 'edit'
          ? workspace.seasons.find(
              (candidate) => candidate.season_id === seasonId
            )
          : null;
      const mutation = buildMastermindSeasonMutation(
        seasonDraft,
        currentSeason || {}
      );
      if (preview) {
        const nextSeason = normalizeSeasonMastermindData({
          seasons: [
            {
              ...(currentSeason || {}),
              ...mutation.input,
              season_id:
                currentSeason?.season_id ||
                `preview-season-${workspace.seasons.length + 1}`,
              status: 'planning',
              revision: (currentSeason?.revision || 0) + 1,
            },
          ],
        }).seasons[0];
        setWorkspace((current) => ({
          ...current,
          seasons: mergeUniqueRecords(
            current.seasons.filter(
              (season) => season.season_id !== nextSeason.season_id
            ),
            [nextSeason],
            (season) => season.season_id
          ),
        }));
        setSeasonId(nextSeason.season_id);
        setCalendarMonth(
          mastermindMonthStart(nextSeason.starts_on || new Date())
        );
        setSeasonDraft(mastermindSeasonDraft());
        setSeasonEditorMode('');
        setMessage(
          currentSeason
            ? 'Preview season updated locally.'
            : 'Preview season created locally.'
        );
        return;
      }

      const response = await fetch('/api/studio/mastermind', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mutation),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || data.ok === false) {
        throw new Error(data.error || 'The planning season could not be created.');
      }
      if (!data.season) {
        setReloadKey((current) => current + 1);
        return;
      }
      const nextSeason = normalizeSeasonMastermindData({
        seasons: [data.season],
      }).seasons[0];
      setWorkspace((current) => ({
        ...current,
        seasons: mergeUniqueRecords(
          current.seasons.filter(
            (season) => season.season_id !== nextSeason.season_id
          ),
          [nextSeason],
          (season) => season.season_id
        ),
      }));
      setSeasonId(nextSeason.season_id);
      setCalendarMonth(
        mastermindMonthStart(nextSeason.starts_on || new Date())
      );
      setSeasonDraft(mastermindSeasonDraft());
      setSeasonEditorMode('');
      setMessage(
        mutation.action === 'update_season'
          ? 'Planning season updated.'
          : 'Planning season created.'
      );
    } catch (error) {
      setSeasonError(
        error.message || 'The planning season could not be created.'
      );
    } finally {
      setSeasonSaving(false);
    }
  }

  let content;
  if (!featureEnabled) {
    content = (
      <div className={styles.page}>
        <WorkspaceState
          kind="empty"
          title="Season Mastermind is not enabled"
          detail="The planning surface stays off until its private read API, authorization checks, and cost bounds are ready."
          action={
            <Link className={styles.stateAction} href="/studio">
              Return to Studio home
            </Link>
          }
        />
      </div>
    );
  } else if (loadState === 'loading' || loadState === 'waking') {
    content = (
      <div className={styles.page}>
        <WorkspaceState
          kind="loading"
          title={
            loadState === 'waking'
              ? 'Waking Season Mastermind…'
              : 'Opening Season Mastermind…'
          }
          detail={
            loadState === 'waking'
              ? 'Aurora may be resuming from its Free Plan pause. This first connection can take a little longer.'
              : 'Loading the shared season plan and your authorized view.'
          }
        />
      </div>
    );
  } else if (loadState === 'error') {
    content = (
      <div className={styles.page}>
        <WorkspaceState
          kind="error"
          title="Season Mastermind did not open"
          detail={loadError}
          action={
            preview || retryCount >= MAX_LOAD_RETRIES ? null : (
              <button
                type="button"
                className={styles.stateAction}
                onClick={() => {
                  setRetryCount((current) => current + 1);
                  setReloadKey((current) => current + 1);
                }}
              >
                <RefreshRoundedIcon aria-hidden="true" />
                Try again
              </button>
            )
          }
        />
      </div>
    );
  } else if (!workspace.configured) {
    content = (
      <div className={styles.page}>
        <WorkspaceState
          kind="empty"
          title="The planning backend is not connected yet"
          detail="The website surface is ready, but its dedicated Lambda and Aurora connection must be configured before anyone can load plans."
        />
      </div>
    );
  } else {
    content = (
      <div className={styles.page}>
        <header className={styles.hero}>
          <div>
            <span className={styles.eyebrow}>Shared season planning</span>
            <h1>Season Mastermind</h1>
            <p>
              Shape the season together without copying plans into separate host
              sheets.
            </p>
          </div>
          <div className={styles.heroActions}>
            <span className={styles.accessPill}>
              {preview
                ? 'Local Season 11 sample · resets on refresh'
                : workspace.canManage
                  ? 'Planning team'
                  : 'Your assigned plans'}
            </span>
            {workspace.canManage ? (
              <div className={styles.heroButtonGroup}>
                {!preview && seasonId ? (
                  <Link
                    className={styles.heroSecondaryAction}
                    href={`/api/studio/mastermind/export?season_id=${encodeURIComponent(
                      seasonId
                    )}`}
                  >
                    <DownloadRoundedIcon aria-hidden="true" />
                    Export CSV
                  </Link>
                ) : null}
                {seasonId ? (
                  <button
                    type="button"
                    className={styles.heroSecondaryAction}
                    onClick={openEditSeason}
                  >
                    Edit season
                  </button>
                ) : null}
                <button
                  type="button"
                  className={styles.heroSecondaryAction}
                  onClick={openNewSeason}
                >
                  New season
                </button>
                <button
                  type="button"
                  className={styles.primaryAction}
                  onClick={openNewPlan}
                  disabled={!seasonId}
                >
                  <AddRoundedIcon aria-hidden="true" />
                  New episode plan
                </button>
              </div>
            ) : null}
          </div>
        </header>

        {workspace.seasons.length && seasonEditorMode ? (
          <SeasonEditor
            draft={seasonDraft}
            error={seasonError}
            mode={seasonEditorMode}
            saving={seasonSaving}
            onChange={(patch) =>
              setSeasonDraft((current) => ({ ...current, ...patch }))
            }
            onCancel={() => {
              setSeasonEditorMode('');
              setSeasonError('');
            }}
            onSubmit={createSeason}
          />
        ) : null}

        {!workspace.seasons.length ? (
          workspace.canManage ? (
            <SeasonEditor
              draft={seasonDraft}
              error={seasonError}
              mode="create"
              saving={seasonSaving}
              onChange={(patch) =>
                setSeasonDraft((current) => ({ ...current, ...patch }))
              }
              onSubmit={createSeason}
            />
          ) : (
            <WorkspaceState
              kind="empty"
              title="No planning season yet"
              detail="A Studio manager has not opened a shared planning season yet. Your assigned plans will appear here once they do."
            />
          )
        ) : (
          <>
            <section className={styles.summaryGrid} aria-label="Season summary">
              {[
                ['Plans matched', summaryTotal],
                [partialSummary ? 'Researching loaded' : 'Researching', summary.researching],
                [partialSummary ? 'Ready loaded' : 'Ready', summary.ready],
                [partialSummary ? 'Scheduled loaded' : 'Scheduled', summary.scheduled],
                [partialSummary ? 'Gaps loaded' : 'Research gaps', summary.gaps],
              ].map(([label, value]) => (
                <div className={styles.summaryCard} key={label}>
                  <strong>{value}</strong>
                  <span>{label}</span>
                </div>
              ))}
            </section>

            {workspace.canManage &&
            workspace.workbook_index_summary.indexed_nonempty_cells ? (
              <details className={styles.workbookCoverage}>
                <summary>
                  Workbook coverage ·{' '}
                  {workspace.workbook_index_summary.indexed_nonempty_cells} of{' '}
                  {workspace.workbook_index_summary.expected_nonempty_cells}{' '}
                  populated cells reconciled
                </summary>
                <p>
                  The {summaryTotal} schedule rows are shown in this List and
                  planning Calendar. The private index also accounts for{' '}
                  {workspace.workbook_index_summary.host_goal_count} host goals,{' '}
                  {
                    workspace.workbook_index_summary
                      .historical_production_lead_count
                  }{' '}
                  historical production leads,{' '}
                  {workspace.workbook_index_summary.guest_idea_count} guest
                  ideas, and{' '}
                  {workspace.workbook_index_summary.intake_submission_count}{' '}
                  intake records. Contact, shipping, questionnaire answers, and
                  restricted links stay out of the planning view.
                </p>
              </details>
            ) : null}

            <section className={styles.controls} aria-label="Plan controls">
              <div className={styles.viewTabs} role="group" aria-label="Plan view">
                {VIEW_OPTIONS.map((option) => {
                  const Icon = option.icon;
                  return (
                    <button
                      type="button"
                      aria-pressed={view === option.id}
                      className={view === option.id ? styles.activeView : ''}
                      onClick={() => setView(option.id)}
                      key={option.id}
                    >
                      <Icon aria-hidden="true" />
                      {option.label}
                    </button>
                  );
                })}
              </div>

              <details className={styles.filterDisclosure}>
                <summary>
                  <span>
                    <SearchRoundedIcon aria-hidden="true" />
                    <strong>Search &amp; filters</strong>
                    <small>
                      Find a plan or narrow the season, host, status, type, or
                      date.
                    </small>
                  </span>
                  <span className={styles.filterDisclosureState}>
                    <span className={styles.filterStateClosed}>
                      {hasFilters ? 'Filters active' : 'Show'}
                    </span>
                    <span className={styles.filterStateOpen}>Hide</span>
                  </span>
                </summary>
                <form className={styles.filters} onSubmit={applySearch}>
                  <label className={styles.searchField}>
                    <span>Search plans</span>
                    <SearchRoundedIcon aria-hidden="true" />
                    <input
                      type="search"
                      value={searchDraft}
                      disabled={scopeLoading}
                      onChange={(event) => setSearchDraft(event.target.value)}
                      placeholder="Title, premise, takeaway…"
                    />
                  </label>
                  <button
                    type="submit"
                    className={styles.applySearch}
                    disabled={scopeLoading || searchDraft.trim() === query}
                  >
                    {scopeLoading ? 'Loading…' : 'Search'}
                  </button>
                  <label>
                    <span>Season</span>
                    <select
                      value={seasonId}
                      disabled={scopeLoading}
                      onChange={(event) => {
                        const nextSeasonId = event.target.value;
                        setSeasonId(nextSeasonId);
                        setCalendarMonth(
                          firstMonthForSeason(workspace, nextSeasonId)
                        );
                        requestPlanScope({ seasonId: nextSeasonId });
                      }}
                    >
                      {workspace.seasons.map((season) => (
                        <option value={season.season_id} key={season.season_id}>
                          {season.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Host</span>
                    <select
                      value={hostFilter}
                      disabled={scopeLoading}
                      onChange={(event) => {
                        const nextHostFilter = event.target.value;
                        setHostFilter(nextHostFilter);
                        requestPlanScope({ hostFilter: nextHostFilter });
                      }}
                    >
                      <option value="">All hosts</option>
                      {hostOptions.map((host) => (
                        <option value={host.id} key={host.id}>
                          {host.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Status</span>
                    <select
                      value={statusFilter}
                      disabled={scopeLoading}
                      onChange={(event) => {
                        const nextStatusFilter = event.target.value;
                        setStatusFilter(nextStatusFilter);
                        requestPlanScope({ statusFilter: nextStatusFilter });
                      }}
                    >
                      <option value="active">All active</option>
                      {MASTERMIND_STATUS_OPTIONS.map((status) => (
                        <option value={status.id} key={status.id}>
                          {status.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Type</span>
                    <select
                      value={typeFilter}
                      disabled={scopeLoading}
                      onChange={(event) => {
                        const nextTypeFilter = event.target.value;
                        setTypeFilter(nextTypeFilter);
                        requestPlanScope({ typeFilter: nextTypeFilter });
                      }}
                    >
                      <option value="">All types</option>
                      {MASTERMIND_EPISODE_TYPES.map((type) => (
                        <option value={type.id} key={type.id}>
                          {type.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Air date</span>
                    <input
                      type="date"
                      value={dateFilter}
                      disabled={scopeLoading}
                      onChange={(event) => {
                        const nextDateFilter = event.target.value;
                        setDateFilter(nextDateFilter);
                        if (nextDateFilter) {
                          setCalendarMonth(
                            mastermindMonthStart(nextDateFilter)
                          );
                        }
                        requestPlanScope({ dateFilter: nextDateFilter });
                      }}
                    />
                  </label>
                  {hasFilters ? (
                    <button
                      type="button"
                      className={styles.clearFilters}
                      onClick={clearFilters}
                      disabled={scopeLoading}
                    >
                      <FilterAltOffRoundedIcon aria-hidden="true" />
                      Clear
                    </button>
                  ) : null}
                </form>
              </details>
            </section>

            {scopeError ? (
              <p className={styles.formError} role="alert">
                {scopeError}
              </p>
            ) : null}

            <section
              className={styles.calendarBoundary}
              aria-label="Planning calendar boundary"
            >
              <strong>Mastermind dates are planning-only.</strong>
              <span>
                An episode appears on the Studio production calendar only after
                a producer or admin with planning access reviews the plan and
                creates its Episode Studio.
              </span>
            </section>

            {message ? (
              <p className={styles.pageMessage} role="status">
                <CheckCircleOutlineRoundedIcon aria-hidden="true" />
                {message}
              </p>
            ) : null}

            {!seasonPlans.length && !hasFilters ? (
              <WorkspaceState
                kind="empty"
                title="No episode plans in this season"
                detail={
                  workspace.canManage
                    ? 'Start with one clear premise; hosts, research, and sponsor commitments can be connected next.'
                    : 'No plans are assigned to you in this season yet.'
                }
                action={
                  workspace.canManage ? (
                    <button
                      type="button"
                      className={styles.stateAction}
                      onClick={openNewPlan}
                    >
                      <AddRoundedIcon aria-hidden="true" />
                      Create the first plan
                    </button>
                  ) : null
                }
              />
            ) : !visiblePlans.length ? (
              <WorkspaceState
                kind="empty"
                title="No plans match these filters"
                detail="Clear one or more filters to see the rest of the season."
                action={
                  <button
                    type="button"
                    className={styles.stateAction}
                    onClick={clearFilters}
                  >
                    <FilterAltOffRoundedIcon aria-hidden="true" />
                    Clear filters
                  </button>
                }
              />
            ) : (
              <div className={styles.viewPanel}>
                {view === 'list' ? (
                  <ListView plans={visiblePlans} onOpen={openPlan} />
                ) : null}
                {view === 'board' ? (
                  <BoardView
                    plans={visiblePlans}
                    statusFilter={statusFilter}
                    onOpen={openPlan}
                  />
                ) : null}
                {view === 'calendar' ? (
                  <CalendarView
                    plans={visiblePlans}
                    month={calendarMonth}
                    onMonthChange={setCalendarMonth}
                    onOpen={openPlan}
                  />
                ) : null}
                {view === 'research' ? (
                  <ResearchView
                    plans={visiblePlans}
                    mode={researchMode}
                    onModeChange={setResearchMode}
                    onOpen={openPlan}
                  />
                ) : null}
              </div>
            )}
            {workspace.page?.has_more ? (
              <section className={styles.loadMorePanel} aria-live="polite">
                <div>
                  <strong>
                    {workspace.plans.length} of {workspace.page.total_plans}{' '}
                    plans loaded
                  </strong>
                  <span>
                    Load another page only when you need it; Aurora is never
                    polled in the background.
                  </span>
                  {loadMoreError ? (
                    <span className={styles.loadMoreError}>{loadMoreError}</span>
                  ) : null}
                </div>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={loadMorePlans}
                  disabled={loadingMore}
                >
                  {loadingMore ? 'Loading…' : 'Load 50 more'}
                </button>
              </section>
            ) : null}
          </>
        )}

        <EpisodeStudioSettingsDrawer
          open={drawerOpen}
          onClose={closeDrawer}
          closeDisabled={saving || episodeHandoffBusy}
          title={
            intakeHandoffId
              ? 'Start research plan'
              : drawerMode === 'create'
              ? 'New episode plan'
              : selectedPlan?.working_title || 'Episode plan'
          }
          description={
            intakeHandoffId
              ? 'Review only the public planning fields. The Follow-up details and discussion remain private.'
              : selectedPlanIsLinked
                ? 'Planning is locked after handoff. The linked Episode Studio is now the production source of truth.'
              : workspace.canManage
              ? 'Keep the editorial plan concise and non-sensitive.'
              : 'Read-only planning details for an episode assigned to you.'
          }
          eyebrow={
            drawerMode === 'create'
              ? 'Season planning'
              : TYPE_LABELS[selectedPlan?.episode_type] || 'Season planning'
          }
          closeLabel="Close episode plan"
          footer={
            workspace.canManage && !selectedPlanIsLinked ? (
              <>
                <button
                  type="button"
                  className={styles.secondaryAction}
                  onClick={closeDrawer}
                  disabled={saving || episodeHandoffBusy}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  form="mastermind-plan-form"
                  className={styles.primaryAction}
                  disabled={
                    saving ||
                    episodeHandoffBusy ||
                    Boolean(conflictState) ||
                    !draft.season_id ||
                    !draft.working_title.trim() ||
                    !draft.premise.trim() ||
                    draftNeedsTargetDate ||
                    (drawerMode !== 'create' && !draftDirty)
                  }
                >
                  {saving
                    ? 'Saving…'
                    : drawerMode === 'create'
                      ? 'Create plan'
                      : 'Save changes'}
                </button>
              </>
            ) : null
          }
        >
          {workspace.canManage && !selectedPlanIsLinked ? (
            <form
              id="mastermind-plan-form"
              className={styles.planForm}
              onSubmit={savePlan}
            >
              {drawerError ? (
                <p className={styles.formError} role="alert">
                  {drawerError}
                </p>
              ) : null}
              {conflictState ? (
                <section className={styles.conflictPanel} aria-live="polite">
                  <div>
                    <strong>Review before overwriting</strong>
                    <p>
                      Load the newest revision without replacing the values in
                      this form. Retry becomes available after that review.
                    </p>
                    {latestPlan ? (
                      <small>
                        Latest: revision {latestPlan.revision} ·{' '}
                        {STATUS_LABELS[latestPlan.status]} ·{' '}
                        {formatDate(latestPlan.target_air_date, 'Unscheduled')}
                      </small>
                    ) : null}
                  </div>
                  <div className={styles.conflictActions}>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={reviewLatestPlan}
                      disabled={reviewingLatest}
                    >
                      {reviewingLatest ? 'Loading latest…' : 'Review latest'}
                    </button>
                    <button
                      type="submit"
                      className={styles.primaryAction}
                      disabled={saving || conflictState !== 'reviewed'}
                    >
                      {saving ? 'Retrying…' : 'Retry save'}
                    </button>
                  </div>
                </section>
              ) : null}
              {message ? (
                <p className={styles.formMessage} role="status">
                  {message}
                </p>
              ) : null}
              <div className={styles.formGrid}>
                <label className={styles.fullField}>
                  <span>Working title</span>
                  <input
                    type="text"
                    value={draft.working_title}
                    maxLength={180}
                    required
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        working_title: event.target.value,
                      }))
                    }
                  />
                </label>
                <label>
                  <span>Season</span>
                  <select
                    value={draft.season_id}
                    required
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        season_id: event.target.value,
                      }))
                    }
                  >
                    {workspace.seasons.map((season) => (
                      <option value={season.season_id} key={season.season_id}>
                        {season.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Editorial format</span>
                  <select
                    value={draft.episode_type}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        episode_type: event.target.value,
                      }))
                    }
                  >
                    {MASTERMIND_EPISODE_TYPES.map((type) => (
                      <option value={type.id} key={type.id}>
                        {type.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Workflow status</span>
                  <select
                    value={draft.status}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        status: event.target.value,
                      }))
                    }
                  >
                    {MASTERMIND_STATUS_OPTIONS.map((status) => (
                      <option value={status.id} key={status.id}>
                        {status.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>Target air date</span>
                  <input
                    type="date"
                    value={draft.target_air_date}
                    aria-invalid={draftNeedsTargetDate || undefined}
                    aria-describedby={
                      draftNeedsTargetDate
                        ? 'mastermind-target-date-error'
                        : undefined
                    }
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        target_air_date: event.target.value,
                      }))
                    }
                  />
                  {draftNeedsTargetDate ? (
                    <small
                      className={styles.fieldError}
                      id="mastermind-target-date-error"
                    >
                      Scheduled, recording, and published plans need an air date.
                    </small>
                  ) : null}
                </label>
                <fieldset
                  className={`${styles.fullField} ${styles.hostAssignmentField}`}
                >
                  <legend>Hosts</legend>
                  <p>
                    Assigned plans appear in each host&apos;s view. Leave every host
                    unchecked to keep an early idea manager-only.
                  </p>
                  {assignmentHostOptions.length ? (
                    <div className={styles.hostAssignmentGrid}>
                      {assignmentHostOptions.map((host) => (
                        <label key={host.personId}>
                          <input
                            type="checkbox"
                            checked={draft.host_person_ids.includes(host.personId)}
                            onChange={(event) =>
                              setHostAssignment(
                                host.personId,
                                event.target.checked
                              )
                            }
                          />
                          <span>{host.label}</span>
                        </label>
                      ))}
                    </div>
                  ) : (
                    <p className={styles.formHint}>
                      No reviewed hosts are available in the directory yet.
                    </p>
                  )}
                </fieldset>
                <label className={styles.fullField}>
                  <span>Editorial premise</span>
                  <textarea
                    value={draft.premise}
                    maxLength={6000}
                    rows={5}
                    required
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        premise: event.target.value,
                      }))
                    }
                  />
                </label>
                <label className={styles.fullField}>
                  <span>Listener takeaway</span>
                  <textarea
                    value={draft.listener_takeaway}
                    maxLength={2400}
                    rows={3}
                    onChange={(event) =>
                      setDraft((current) => ({
                        ...current,
                        listener_takeaway: event.target.value,
                      }))
                    }
                  />
                </label>
              </div>
              {selectedPlan ? (
                <RelationshipSection
                  plan={selectedPlan}
                  preview={preview}
                  showHosts={false}
                />
              ) : null}
              {selectedPlan ? (
                <section className={styles.episodeHandoffPanel}>
                  <div>
                    <span className={styles.sectionEyebrow}>Production handoff</span>
                    <h3>Episode Studio</h3>
                    <p>
                      {linkedEpisodeIdIsUnsafe
                        ? 'This plan has a production link, but the destination is not safe to open. Ask a Studio manager to repair it.'
                        : linkedEpisodeHref
                        ? 'The production workspace is linked and ready to open.'
                        : selectedPlan.status !== 'ready'
                          ? 'Move this plan to Ready after its premise, date, and hosts are reviewed.'
                          : !canHandoffEpisode
                            ? 'A Studio manager with Episode Studio access must complete this handoff.'
                          : draftDirty
                            ? 'Save these plan changes before creating the production workspace.'
                            : !selectedPlan.target_air_date ||
                                !selectedPlan.hosts.length
                              ? 'A target air date and at least one mapped host are required.'
                              : !producerOptions.length
                                ? 'No current producers are available. Add a producer role before creating this workspace.'
                                : !selectedProducerIsCurrent
                                  ? 'Choose the producer who will own the production queue before creating this workspace.'
                              : 'Create one deterministic Episode Studio. Retrying cannot duplicate it.'}
                    </p>
                    {canHandoffEpisode &&
                    ['idea', 'researching'].includes(selectedPlan.status) &&
                    !selectedPlan.linked_episode_id ? (
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={markPlanReady}
                        disabled={
                          saving ||
                          !draft.target_air_date ||
                          !draft.host_person_ids.length ||
                          !draft.working_title.trim() ||
                          !draft.premise.trim()
                        }
                      >
                        {saving ? 'Saving…' : 'Review & mark ready'}
                      </button>
                    ) : null}
                    {canHandoffEpisode &&
                    selectedPlan.status === 'ready' &&
                    !selectedPlan.linked_episode_id ? (
                      <label className={styles.producerPicker}>
                        <span>Producer</span>
                        <select
                          value={producerPersonId}
                          disabled={
                            episodeHandoffBusy ||
                            episodeHandoff?.kind === 'pending'
                          }
                          onChange={(event) =>
                            setProducerPersonId(event.target.value)
                          }
                        >
                          <option value="">Choose a producer</option>
                          {producerOptions.map((producer) => (
                            <option value={producer.id} key={producer.id}>
                              {producer.label}
                            </option>
                          ))}
                        </select>
                        <small>
                          Required so the Episode Studio enters a named
                          producer&apos;s task queue.
                        </small>
                      </label>
                    ) : null}
                    {episodeHandoff ? (
                      <p
                        className={
                          episodeHandoff.kind === 'error'
                            ? styles.handoffError
                            : episodeHandoff.kind === 'pending'
                              ? styles.handoffPending
                              : styles.handoffStatus
                        }
                        role={
                          episodeHandoff.kind === 'error' ? 'alert' : 'status'
                        }
                      >
                        {episodeHandoff.message}
                      </p>
                    ) : null}
                  </div>
                  <div className={styles.handoffActions}>
                    {linkedEpisodeHref ? (
                      <Link
                        className={styles.secondaryAction}
                        href={linkedEpisodeHref}
                      >
                        Open Episode Studio
                      </Link>
                    ) : null}
                    {canHandoffEpisode &&
                    selectedPlan.status === 'ready' &&
                    !selectedPlan.linked_episode_id &&
                    episodeHandoff?.kind !== 'linked' &&
                    (episodeHandoff?.kind !== 'pending' ||
                      episodeHandoff.retryable !== false) ? (
                      <button
                        type="button"
                        className={styles.secondaryAction}
                        onClick={createEpisodeStudioFromPlan}
                        disabled={
                          episodeHandoffBusy ||
                          draftDirty ||
                          !selectedProducerIsCurrent ||
                          !selectedPlan.target_air_date ||
                          !selectedPlan.hosts.length
                        }
                      >
                        {episodeHandoffBusy
                          ? episodeHandoff?.kind === 'pending'
                            ? 'Repairing…'
                            : 'Creating…'
                          : episodeHandoff?.kind === 'pending'
                            ? 'Repair link'
                            : 'Create Episode Studio'}
                      </button>
                    ) : null}
                  </div>
                </section>
              ) : null}
              <p className={styles.formNote}>
                Guest, research, and sponsor relationships remain read only in
                this first surface. Host assignments are saved with the core plan.
              </p>
            </form>
          ) : selectedPlan ? (
            <div className={styles.readOnlyDrawer}>
              <section className={styles.overviewCard}>
                <span>{STATUS_LABELS[selectedPlan.status]}</span>
                <h3>{selectedPlan.working_title}</h3>
                <p>{selectedPlan.premise || 'Premise pending.'}</p>
                {selectedPlan.listener_takeaway ? (
                  <blockquote>{selectedPlan.listener_takeaway}</blockquote>
                ) : null}
                <time dateTime={selectedPlan.target_air_date || undefined}>
                  {formatDate(selectedPlan.target_air_date)}
                </time>
              </section>
              <RelationshipSection plan={selectedPlan} preview={preview} />
              {selectedPlanIsLinked ? (
                <section className={styles.episodeHandoffPanel}>
                  <div>
                    <span className={styles.sectionEyebrow}>
                      Production source of truth
                    </span>
                    <h3>Episode Studio</h3>
                    <p>
                      This locked snapshot records what planning handed off.
                      Open Episode Studio for the current production title,
                      date, assignments, and status.
                    </p>
                    {linkedEpisodeIdIsUnsafe ? (
                      <p className={styles.handoffError} role="alert">
                        The stored Episode Studio link is not safe to open. Ask
                        a Studio manager to repair it.
                      </p>
                    ) : null}
                  </div>
                  {linkedEpisodeHref ? (
                    <div className={styles.handoffActions}>
                      <Link
                        className={styles.secondaryAction}
                        href={linkedEpisodeHref}
                      >
                        Open Episode Studio
                      </Link>
                    </div>
                  ) : null}
                </section>
              ) : null}
            </div>
          ) : null}
        </EpisodeStudioSettingsDrawer>
      </div>
    );
  }

  return content;
}

export default function SeasonMastermindWorkspace({
  previewData = null,
  previewInStudio = false,
}) {
  const preview = previewData !== null;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const content = (
    <SeasonMastermindContent
      previewData={previewData}
      onUnsavedChanges={setHasUnsavedChanges}
    />
  );
  if (preview && !previewInStudio) return content;
  return (
    <StudioLayout
      requiredPermission="mastermind:read"
      hasUnsavedChanges={hasUnsavedChanges}
      unsavedChangesMessage="Leave Season Mastermind and discard the unsaved episode-plan changes?"
      wide
    >
      {content}
    </StudioLayout>
  );
}
