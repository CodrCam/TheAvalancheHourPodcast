export const CURRENT_SEASON = Object.freeze({
  label: 'Season 11',
  starts_on: '2026-10-01',
  ends_on: '2027-05-31',
  status: 'planning',
  schedule_slots: 38,
  regular_slots: 29,
  slabs_and_sluffs_slots: 9,
  regular_monthly_goal: 4,
  cadence:
    'Slabs n Sluffs monthly from October through May, with weekly regular episodes during the core winter season.',
});

const EPISODE_STATUSES = Object.freeze([
  'planning',
  'in_progress',
  'submitted',
  'submitted_with_gaps',
  'needs_changes',
  'accepted',
]);

function safeCount(value) {
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0) return 0;
  return Math.min(Math.trunc(number), 100_000);
}

export function summarizeCurrentSeasonEpisodes(
  episodes = [],
  calendar = [],
  season = CURRENT_SEASON
) {
  const rows = (Array.isArray(episodes) ? episodes : []).filter(
    (episode) =>
      episode &&
      episode.season === season.label &&
      !episode.archived &&
      !episode.deleted_at &&
      !episode.deletion_finalized_at
  );
  const byStatus = Object.fromEntries(
    EPISODE_STATUSES.map((status) => [
      status,
      rows.filter((episode) => episode.status === status).length,
    ])
  );
  const nextReleases = (Array.isArray(calendar) ? calendar : [])
    .filter(
      (entry) =>
        entry &&
        entry.season === season.label &&
        /^\d{4}-\d{2}-\d{2}$/.test(String(entry.target_release_date || ''))
    )
    .slice(0, 4)
    .map((entry) => ({
      title: String(entry.title || '').trim().slice(0, 220),
      target_release_date: entry.target_release_date,
    }))
    .filter((entry) => entry.title);

  return {
    label: season.label,
    starts_on: season.starts_on,
    ends_on: season.ends_on,
    status: season.status,
    schedule_slots: safeCount(season.schedule_slots),
    regular_slots: safeCount(season.regular_slots),
    slabs_and_sluffs_slots: safeCount(season.slabs_and_sluffs_slots),
    regular_monthly_goal: safeCount(season.regular_monthly_goal),
    cadence: season.cadence,
    episode_studios: rows.length,
    by_status: byStatus,
    next_releases: nextReleases,
  };
}

export function buildStudioSeasonWorkflow({
  permissions = [],
  features = {},
  capabilities = {},
} = {}) {
  const allowed = new Set(Array.isArray(permissions) ? permissions : []);
  const canReadEpisodes = allowed.has('episodes:read');
  const canUseProducerTasks =
    canReadEpisodes &&
    (allowed.has('episodes:manage') || capabilities?.producer_tasks === true);
  const canReadMastermind =
    allowed.has('mastermind:read') && features?.season_mastermind === true;

  return [
    {
      id: 'plan',
      number: '01',
      label: 'Season Mastermind',
      detail: 'Shape the schedule, ideas, hosts, and research before production starts.',
      href: canReadMastermind ? '/studio/mastermind' : '',
      action: canReadMastermind ? 'Open season plan' : 'Planning backend not connected',
      available: canReadMastermind,
    },
    {
      id: 'prepare',
      number: '02',
      label: 'Guest Questionnaires',
      detail: 'Prepare and track the private guest intake attached to each episode.',
      href: canReadEpisodes ? '/studio/questionnaires' : '',
      action: canReadEpisodes ? 'Open questionnaire hub' : 'Episode access required',
      available: canReadEpisodes,
    },
    {
      id: 'record',
      number: '03',
      label: 'Host Studio',
      detail: 'One place for hosts to prepare, record, and hand off their episode package.',
      href: canReadEpisodes ? '/studio/episodes' : '',
      action: canReadEpisodes ? 'Open Host Studio' : 'Episode access required',
      available: canReadEpisodes,
    },
    ...(canUseProducerTasks
      ? [
          {
            id: 'produce',
            number: '04',
            label: 'Producer Task Manager',
            detail:
              'Turn submitted packages into an assigned, deadline-driven production queue.',
            href: '/studio/production',
            action: 'Open production tasks',
            available: true,
          },
        ]
      : []),
  ];
}
