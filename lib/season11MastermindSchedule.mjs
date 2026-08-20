export const SEASON_11_MASTERMIND_SEASON_ID =
  '11111111-1111-4111-8111-111111111111';

export const SEASON_11_SCHEDULE_SOURCE = Object.freeze({
  workbook: 'The Avalanche Hour Season 11 Mastermind.xlsx',
  sheet: 'Schedule',
  range: 'A3:J40',
  imported_rows: 38,
});

export const SEASON_11_SCHEDULE_HOSTS = Object.freeze([
  { person_id: '', name: 'Anna Heuberger' },
  { person_id: '', name: 'Anna Keeling' },
  { person_id: '', name: 'Brendan Cronin' },
  { person_id: 'brooke-maushund', name: 'Brooke Maushund' },
  { person_id: 'brooke-edwards', name: 'Brooke Edwards' },
  { person_id: 'bruce-jamieson', name: 'Bruce Jamieson' },
  { person_id: 'caleb-merrill', name: 'Caleb Merrill' },
  { person_id: '', name: 'Dallas Glass' },
  { person_id: 'dom-baker', name: 'Dom Baker' },
  { person_id: '', name: 'Gabrielle Antonioli' },
  { person_id: 'jake-hutchinson', name: 'Jake Hutchinson' },
  { person_id: 'jason-antin', name: 'Jason Antin' },
  { person_id: 'joe-stock', name: 'Joe Stock' },
  { person_id: 'kim-vinet', name: 'Kim Vinet' },
  { person_id: 'lynne-wolfe', name: 'Lynne Wolfe' },
  { person_id: 'matthias-walcher', name: 'Matthias Walcher' },
  { person_id: '', name: 'Morgan Dinsdale' },
  { person_id: '', name: 'Nikki Champion' },
  { person_id: '', name: 'Pascal Haegli' },
  { person_id: 'sara-boilen', name: 'Sara Boilen' },
  { person_id: 'sean-zimmerman-wall', name: 'Sean Zimmerman-Wall' },
  { person_id: 'sierra-bishop', name: 'Sierra Bishop' },
]);

const HOSTS_BY_NAME = new Map(
  SEASON_11_SCHEDULE_HOSTS.map((host) => [host.name, host])
);

// These are the 38 planning rows in Schedule!A3:J40. January rows 16-20
// retained dates from the prior calendar year even though they sit between
// December 2026 and February 2027. The local planning fixture corrects only
// that year and records the correction in source_quality_flags. Excel also
// collapsed numeric 11.10 and 11.20 to 11.1 and 11.2; those trailing zeroes
// are restored below so every episode label is distinct.
const SCHEDULE_ROWS = Object.freeze([
  { row: 3, number: 'SS1', episode: 'Slabs n Sluffs 1', airDate: '2026-10-01', hostNote: 'Sara, Dom', hostNames: ['Sara Boilen', 'Dom Baker'], guestNote: 'Recorded ISSW Between Two Flakes', flags: ['guest_cell_contains_recording_note'] },
  { row: 4, number: '11.1', airDate: '2026-10-07', hostNote: 'Sean Zwall', hostNames: ['Sean Zimmerman-Wall'], guestNote: 'Nikola Brebric and Stele Stefanac- Croatia Mtn Rescue Service', guestNames: ['Nikola Brebric', 'Stele Stefanac'], statusNote: 'RECORDING FINISHED', flags: ['host_name_normalized', 'guest_affiliation_split_from_name'] },
  { row: 5, number: '', airDate: '2026-10-14', hostNote: 'Morgan Dinsdale', hostNames: ['Morgan Dinsdale'], guestNote: 'Emma', guestNames: ['Emma'], flags: ['episode_number_missing', 'working_title_derived_from_guest'] },
  { row: 6, number: '11.2', airDate: '2026-10-21', hostNote: 'Brooke M', hostNames: ['Brooke Maushund'], guestNote: 'Julianna Garcia', guestNames: ['Julianna Garcia'], flags: ['host_name_expanded_from_schedule_summary', 'working_title_derived_from_guest'] },
  { row: 7, number: 'SS2', episode: 'Slabs n Sluffs 2', airDate: '2026-11-02', hostNote: 'Sara, Dom, Caleb?', hostNames: ['Sara Boilen', 'Dom Baker', 'Caleb Merrill'], proposedHosts: ['Caleb Merrill'], flags: ['host_name_expanded_from_schedule_summary', 'host_assignment_needs_confirmation'] },
  { row: 8, number: '11.3', airDate: '2026-11-11', hostNote: 'Bruce Jamieson', hostNames: ['Bruce Jamieson'], guestNote: 'Larry Stainer & HP Stettler', guestNames: ['Larry Stainer', 'HP Stettler'], ad: 'IPA Collective', flags: ['working_title_derived_from_guest'] },
  { row: 9, number: '11.4', airDate: '2026-11-18', hostNote: 'Gabrielle Antonioli', hostNames: ['Gabrielle Antonioli'], guestNote: '?', flags: ['guest_needs_confirmation', 'working_title_is_schedule_placeholder'] },
  { row: 10, number: '11.5', airDate: '2026-11-25', hostNote: 'Dallas Glass', hostNames: ['Dallas Glass'], guestNote: 'Mike Ferrari', guestNames: ['Mike Ferrari'], flags: ['working_title_derived_from_guest'] },
  { row: 11, number: 'SS3', episode: 'Slabs n Sluffs 3', airDate: '2026-11-30', ad: 'Peak Visor 10-15 min highlight', adLocked: true, flags: ['ad_date_locked_by_bold_workbook_format'] },
  { row: 12, number: '11.6', airDate: '2026-12-09', hostNote: 'Nikki Champion', hostNames: ['Nikki Champion'], guestNote: 'Johanna Kelly', guestNames: ['Johanna Kelly'], flags: ['working_title_derived_from_guest'] },
  { row: 13, number: '11.7', airDate: '2026-12-16', hostNote: 'Jake Hutchinson', hostNames: ['Jake Hutchinson'], guestNote: 'Kowboy- Brett Kobernik', guestNames: ['Brett Kobernik'], flags: ['guest_name_normalized', 'working_title_derived_from_guest'] },
  { row: 14, number: '11.8', airDate: '2026-12-23', hostNote: 'Joe Stock', hostNames: ['Joe Stock'], guestNote: '" on the boat" Andrew McClean? Or other Ice Axe exped?', guestNames: ['Andrew McClean'], ad: 'IPA Collective', flags: ['guest_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 15, number: '11.9', airDate: '2026-12-30', hostNote: 'Shiny', hostNames: ['Brooke Edwards'], flags: ['host_name_expanded_from_schedule_summary', 'working_title_is_schedule_placeholder'] },
  { row: 16, number: 'SS4', episode: 'Slabs n Sluffs 4', airDate: '2027-01-05', flags: ['air_date_year_corrected_from_2026_to_2027'] },
  { row: 17, number: '11.10', airDate: '2027-01-07', hostNote: 'Lynne Wolfe', hostNames: ['Lynne Wolfe'], guestNote: 'Jed Workman', guestNames: ['Jed Workman'], flags: ['air_date_year_corrected_from_2026_to_2027', 'episode_number_trailing_zero_restored', 'working_title_derived_from_guest'] },
  { row: 18, number: '11.11', airDate: '2027-01-14', hostNote: 'Jason Antin', hostNames: ['Jason Antin'], ad: 'IPA Collective', flags: ['air_date_year_corrected_from_2026_to_2027', 'working_title_is_schedule_placeholder'] },
  { row: 19, number: '11.12', airDate: '2027-01-21', hostNote: 'Kim Vinet', hostNames: ['Kim Vinet'], guestNote: 'Florina Beglinger', guestNames: ['Florina Beglinger'], flags: ['air_date_year_corrected_from_2026_to_2027', 'working_title_derived_from_guest'] },
  { row: 20, number: '11.13', airDate: '2027-01-28', hostNote: 'Sierra Bishop', hostNames: ['Sierra Bishop'], guestNote: 'Irene Henninger', guestNames: ['Irene Henninger'], recordingNote: '10/3/26 (end of ISSW)', flags: ['air_date_year_corrected_from_2026_to_2027', 'working_title_derived_from_guest'] },
  { row: 21, number: 'SS5', episode: 'Slabs n Sluffs 5', airDate: '2027-02-02' },
  { row: 22, number: '11.14', airDate: '2027-02-10', hostNote: 'Sean Z Wall', hostNames: ['Sean Zimmerman-Wall'], guestNote: 'Rachel Reimer?', guestNames: ['Rachel Reimer'], flags: ['host_name_normalized', 'guest_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 23, number: '11.15', airDate: '2027-02-17', hostNote: 'Matthias/Anna', hostNames: ['Matthias Walcher', 'Anna Heuberger'], proposedHosts: ['Matthias Walcher', 'Anna Heuberger'], flags: ['host_names_expanded_from_schedule_summary', 'host_assignment_needs_confirmation', 'working_title_is_schedule_placeholder'] },
  { row: 24, number: '11.16', airDate: '2027-02-24', hostNote: 'Caleb', hostNames: ['Caleb Merrill'], flags: ['host_name_expanded_from_schedule_summary', 'working_title_is_schedule_placeholder'] },
  { row: 25, number: 'SS6', episode: 'Slabs n Sluffs 6', airDate: '2027-03-01' },
  { row: 26, number: '11.17', airDate: '2027-03-10', hostNote: 'Anna Keeling?', hostNames: ['Anna Keeling'], proposedHosts: ['Anna Keeling'], guestNote: 'Penny Goddard', guestNames: ['Penny Goddard'], flags: ['host_assignment_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 27, number: '11.18', airDate: '2027-03-17', hostNote: 'Brendan Cronin?', hostNames: ['Brendan Cronin'], proposedHosts: ['Brendan Cronin'], guestNote: 'Dave Hamre', guestNames: ['Dave Hamre'], flags: ['host_assignment_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 28, number: '11.19', airDate: '2027-03-24', hostNote: 'Shiny', hostNames: ['Brooke Edwards'], flags: ['host_name_expanded_from_schedule_summary', 'working_title_is_schedule_placeholder'] },
  { row: 29, number: '11.20', airDate: '2027-03-31', hostNote: 'Jake Hutchinson', hostNames: ['Jake Hutchinson'], guestNote: 'Kelly Elder?', guestNames: ['Kelly Elder'], flags: ['episode_number_trailing_zero_restored', 'guest_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 30, number: 'SS7', episode: 'Slabs n Sluffs 7', airDate: '2027-04-05' },
  { row: 31, number: '11.21', airDate: '2027-04-07', hostNote: 'Bruce Jamieson', hostNames: ['Bruce Jamieson'], flags: ['working_title_is_schedule_placeholder'] },
  { row: 32, number: '11.22', airDate: '2027-04-14', hostNote: 'Gabrielle Antonioli', hostNames: ['Gabrielle Antonioli'], flags: ['working_title_is_schedule_placeholder'] },
  { row: 33, number: '11.23', airDate: '2027-04-21', hostNote: 'Lynne Wolfe', hostNames: ['Lynne Wolfe'], flags: ['working_title_is_schedule_placeholder'] },
  { row: 34, number: '11.24', airDate: '2027-04-28', hostNote: 'Joe Stock', hostNames: ['Joe Stock'], flags: ['working_title_is_schedule_placeholder'] },
  { row: 35, number: 'SS8', episode: 'Slabs n Sluffs 8', airDate: '2027-05-03' },
  { row: 36, number: '11.25', airDate: '2027-05-05', hostNote: 'Pascal Haegli?', hostNames: ['Pascal Haegli'], proposedHosts: ['Pascal Haegli'], flags: ['host_assignment_needs_confirmation', 'working_title_is_schedule_placeholder'] },
  { row: 37, number: '11.26', airDate: '2027-05-12', hostNote: 'Joe Stock', hostNames: ['Joe Stock'], flags: ['working_title_is_schedule_placeholder'] },
  { row: 38, number: '11.27', airDate: '2027-05-19', hostNote: 'Sierra Bishop', hostNames: ['Sierra Bishop'], guestNote: 'Gregg Oliveri Ep or TBC', guestNames: ['Gregg Oliveri'], flags: ['guest_needs_confirmation', 'working_title_derived_from_guest'] },
  { row: 39, number: '11.28', airDate: '2027-05-26', hostNote: 'Caleb', hostNames: ['Caleb Merrill'], flags: ['host_name_expanded_from_schedule_summary', 'working_title_is_schedule_placeholder'] },
  { row: 40, number: 'SS9', episode: 'Slabs n Sluffs Season Wrap', airDate: '2027-05-31' },
]);

function planUuid(row) {
  return `21100000-0000-4000-8000-${String(row).padStart(12, '0')}`;
}

function titleFor(row) {
  if (row.episode) return `${row.number} · ${row.episode}`;
  const prefix = row.number ? `Episode ${row.number}` : 'Unnumbered episode';
  if (row.guestNote && row.guestNote !== '?') {
    return `${prefix} · ${row.guestNote}`.slice(0, 180);
  }
  return `${prefix} · Editorial subject open`;
}

function premiseFor(row) {
  const guest = row.guestNote
    ? row.guestNote === '?'
      ? 'Guest or editorial subject is still open.'
      : `Workbook guest/topic note: ${row.guestNote}.`
    : 'Guest or editorial subject is still open.';
  const host = row.hostNote
    ? `Workbook host plan: ${row.hostNote}.`
    : 'Host assignment is still open.';
  return `${guest} ${host}`;
}

function hostsFor(row) {
  const proposed = new Set(row.proposedHosts || []);
  return (row.hostNames || []).map((name, index) => {
    const host = HOSTS_BY_NAME.get(name);
    if (!host) throw new Error(`Unknown Season 11 schedule host: ${name}`);
    return {
      host_person_id: host.person_id,
      host_display_name: host.name,
      host_role: index === 0 ? 'lead_host' : 'co_host',
      assignment_status:
        proposed.has(name) || !host.person_id ? 'proposed' : 'confirmed',
    };
  });
}

function guestsFor(row) {
  const uncertain = /\?|\bTBC\b|\bor other\b/i.test(row.guestNote || '');
  const recorded =
    row.statusNote === 'RECORDING FINISHED' ||
    /^recorded\b/i.test(row.guestNote || '');
  return (row.guestNames || []).map((name, index) => ({
    guest_id: `s11-schedule-row-${row.row}-guest-${index + 1}`,
    display_name: name,
    public_affiliation:
      row.row === 4 ? 'Croatia Mountain Rescue Service' : '',
    public_profile_url: '',
    public_context: row.guestNote || '',
    guest_role: index === 0 ? 'primary' : 'co_guest',
    invitation_status: recorded
      ? 'recorded'
      : uncertain
        ? 'candidate'
        : 'approved',
    public_angle: row.guestNote || '',
  }));
}

function sponsorsFor(row) {
  if (!row.ad) return [];
  const peakVisor = row.ad.startsWith('Peak Visor');
  return [
    {
      commitment_id: `s11-schedule-row-${row.row}-sponsor-1`,
      sponsor_display_name: peakVisor ? 'Peak Visor' : row.ad,
      commitment_kind: peakVisor ? 'promotion' : 'sponsor_read',
      placement: 'episode',
      commitment_status: 'proposed',
      due_on: row.airDate,
      public_copy_note: peakVisor ? '10-15 minute highlight' : '',
      date_locked: row.adLocked === true,
    },
  ];
}

export const SEASON_11_SCHEDULE_PLANS = Object.freeze(
  SCHEDULE_ROWS.map((row) => {
    const hasUnmappedHost = (row.hostNames || []).some(
      (name) => !HOSTS_BY_NAME.get(name)?.person_id
    );
    return {
      episode_plan_id: planUuid(row.row),
      season_id: SEASON_11_MASTERMIND_SEASON_ID,
      working_title: titleFor(row),
      premise: premiseFor(row),
      listener_takeaway: '',
      episode_type: row.number.startsWith('SS')
        ? 'slabs_and_sluffs'
        : 'regular',
      // A date in the workbook reserves space only in the planning calendar.
      // It must not imply that an Episode Studio exists or place the episode
      // on the production calendar. Managers review each imported row before
      // moving it to Ready and explicitly creating the Episode Studio.
      status:
        row.statusNote === 'RECORDING FINISHED' ? 'recording' : 'researching',
      target_air_date: row.airDate,
      revision: 1,
      source_episode_number: row.number,
      source_schedule_row: row.row,
      source_host_note: row.hostNote || '',
      source_guest_note: row.guestNote || '',
      recording_note: row.recordingNote || '',
      source_status_note: row.statusNote || '',
      source_quality_flags: Object.freeze([
        ...(row.flags || []),
        ...(hasUnmappedHost ? ['host_not_mapped_to_current_roster'] : []),
      ]),
      hosts: hostsFor(row),
      guests: guestsFor(row),
      topics: [],
      sources: [],
      sponsor_commitments: sponsorsFor(row),
    };
  })
);
