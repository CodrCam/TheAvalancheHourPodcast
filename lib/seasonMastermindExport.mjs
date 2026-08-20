const COLUMNS = Object.freeze([
  'Season',
  'Episode no.',
  'Status',
  'Editorial format',
  'Target air date',
  'Working title',
  'Editorial premise',
  'Listener takeaway',
  'Hosts',
  'Guests',
  'Topics',
  'Public research sources',
  'Sponsor commitments',
  'Recording note',
  'Workbook status note',
  'Import review flags',
]);

function safeSpreadsheetValue(value) {
  const text = String(value ?? '')
    .replace(/\u0000/g, '')
    .replace(/\r\n?/g, '\n');
  return /^\s*[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  return `"${safeSpreadsheetValue(value).replace(/"/g, '""')}"`;
}

function joinPublic(values) {
  return values.filter(Boolean).join('; ');
}

export function buildSeasonMastermindCsv({ seasons = [], plans = [] } = {}) {
  const seasonLabels = new Map(
    seasons.map((season) => [String(season.season_id || ''), season.label || ''])
  );
  const rows = plans.map((plan) => [
    seasonLabels.get(String(plan.season_id || '')) || '',
    plan.source_episode_number || '',
    plan.status || '',
    plan.episode_type || '',
    plan.target_air_date || '',
    plan.working_title || '',
    plan.premise || '',
    plan.listener_takeaway || '',
    joinPublic(
      (plan.hosts || []).map((host) =>
        joinPublic([
          host.host_display_name,
          host.host_role ? `(${String(host.host_role).replaceAll('_', ' ')})` : '',
        ])
      )
    ),
    joinPublic(
      (plan.guests || []).map((guest) =>
        joinPublic([
          guest.display_name,
          guest.invitation_status
            ? `(${String(guest.invitation_status).replaceAll('_', ' ')})`
            : '',
        ])
      )
    ),
    joinPublic((plan.topics || []).map((topic) => topic.label)),
    joinPublic(
      (plan.sources || []).map((source) =>
        joinPublic([
          source.title,
          source.publisher ? `— ${source.publisher}` : '',
          /^https:\/\//i.test(String(source.canonical_url || ''))
            ? source.canonical_url
            : '',
        ])
      )
    ),
    joinPublic(
      (plan.sponsor_commitments || []).map((commitment) =>
        joinPublic([
          commitment.sponsor_display_name,
          commitment.commitment_status
            ? `(${String(commitment.commitment_status).replaceAll('_', ' ')})`
            : '',
          commitment.placement && commitment.placement !== 'unspecified'
            ? commitment.placement.replaceAll('_', ' ')
            : '',
          commitment.date_locked ? 'date locked' : '',
        ])
      )
    ),
    plan.recording_note || '',
    plan.source_status_note || '',
    joinPublic(
      (plan.source_quality_flags || []).map((flag) =>
        String(flag || '').replaceAll('_', ' ')
      )
    ),
  ]);

  return [
    COLUMNS.map(csvCell).join(','),
    ...rows.map((row) => row.map(csvCell).join(',')),
  ].join('\r\n');
}

export const SEASON_MASTERMIND_EXPORT_COLUMNS = COLUMNS;
