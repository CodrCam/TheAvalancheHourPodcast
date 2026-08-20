export const MASTERMIND_STATUS_OPTIONS = Object.freeze([
  { id: 'idea', label: 'Idea' },
  { id: 'researching', label: 'Researching' },
  { id: 'ready', label: 'Ready' },
  { id: 'scheduled', label: 'Scheduled' },
  { id: 'recording', label: 'Recording' },
  { id: 'published', label: 'Published' },
  { id: 'archived', label: 'Archived' },
]);

export const MASTERMIND_BOARD_STATUSES = Object.freeze(
  MASTERMIND_STATUS_OPTIONS.filter((status) => status.id !== 'archived')
);

export const MASTERMIND_EPISODE_TYPES = Object.freeze([
  { id: 'regular', label: 'Regular episode' },
  { id: 'slabs_and_sluffs', label: 'Slabs and Sluffs' },
  { id: 'special', label: 'Special episode' },
]);

const VALID_STATUSES = new Set(
  MASTERMIND_STATUS_OPTIONS.map((status) => status.id)
);
const VALID_TYPES = new Set(
  MASTERMIND_EPISODE_TYPES.map((type) => type.id)
);

function cleanText(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanDate(value) {
  const date = cleanText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  return Number.isNaN(parsed.getTime()) ||
    parsed.toISOString().slice(0, 10) !== date
    ? ''
    : date;
}

function arrayFrom(...values) {
  return values.find((value) => Array.isArray(value)) || [];
}

function normalizeHost(host = {}) {
  if (typeof host === 'string') {
    return {
      host_person_id: '',
      host_display_name: cleanText(host),
      host_role: 'host',
      assignment_status: 'proposed',
    };
  }
  return {
    host_person_id: cleanText(host.host_person_id || host.person_id),
    host_display_name: cleanText(
      host.host_display_name || host.display_name || host.name
    ),
    host_role: cleanText(host.host_role || host.role, 'host'),
    assignment_status: cleanText(
      host.assignment_status || host.status,
      'proposed'
    ),
  };
}

function normalizeProducer(producer = {}) {
  if (typeof producer === 'string') {
    return {
      person_id: '',
      display_name: cleanText(producer),
    };
  }
  return {
    person_id: cleanText(producer.person_id || producer.producer_person_id),
    display_name: cleanText(
      producer.display_name || producer.name || producer.producer_display_name
    ),
  };
}

function normalizeGuest(guest = {}) {
  if (typeof guest === 'string') {
    return {
      guest_id: '',
      display_name: cleanText(guest),
      public_affiliation: '',
      public_profile_url: '',
      public_context: '',
      guest_role: 'primary',
      invitation_status: 'candidate',
      public_angle: '',
    };
  }
  return {
    guest_id: cleanText(guest.guest_id || guest.id),
    display_name: cleanText(
      guest.display_name || guest.name
    ),
    public_affiliation: cleanText(guest.public_affiliation),
    public_profile_url: cleanText(guest.public_profile_url),
    public_context: cleanText(guest.public_context),
    guest_role: cleanText(guest.guest_role, 'primary'),
    invitation_status: cleanText(
      guest.invitation_status || guest.status,
      'candidate'
    ),
    public_angle: cleanText(guest.public_angle),
  };
}

function normalizeTopic(topic = {}) {
  if (typeof topic === 'string') {
    return {
      topic_id: '',
      label: cleanText(topic),
      slug: '',
      relevance_note: '',
    };
  }
  return {
    topic_id: cleanText(topic.topic_id || topic.id),
    label: cleanText(topic.label || topic.name),
    slug: cleanText(topic.slug),
    relevance_note: cleanText(topic.relevance_note),
  };
}

function normalizeSource(source = {}) {
  if (typeof source === 'string') {
    return {
      source_id: '',
      title: cleanText(source),
      publisher: '',
      canonical_url: '',
      source_kind: 'website',
      public_summary: '',
      use_note: '',
    };
  }
  return {
    source_id: cleanText(source.source_id || source.id),
    title: cleanText(source.title || source.label),
    publisher: cleanText(source.publisher),
    canonical_url: cleanText(source.canonical_url || source.url),
    source_kind: cleanText(source.source_kind || source.kind, 'website'),
    public_summary: cleanText(source.public_summary),
    use_note: cleanText(source.use_note),
  };
}

function normalizeSponsor(commitment = {}) {
  if (typeof commitment === 'string') {
    return {
      commitment_id: '',
      sponsor_display_name: cleanText(commitment),
      commitment_kind: 'sponsor_read',
      placement: 'unspecified',
      commitment_status: 'proposed',
      due_on: '',
      public_copy_note: '',
      date_locked: false,
    };
  }
  return {
    commitment_id: cleanText(commitment.commitment_id || commitment.id),
    sponsor_display_name: cleanText(
      commitment.sponsor_display_name || commitment.display_name
    ),
    commitment_kind: cleanText(
      commitment.commitment_kind || commitment.kind,
      'sponsor_read'
    ),
    placement: cleanText(commitment.placement, 'unspecified'),
    commitment_status: cleanText(
      commitment.commitment_status || commitment.status,
      'proposed'
    ),
    due_on: cleanDate(commitment.due_on),
    public_copy_note: cleanText(commitment.public_copy_note),
    date_locked: commitment.date_locked === true,
  };
}

function normalizeQualityFlags(value) {
  if (!Array.isArray(value)) return [];
  return [...new Set(value.map((flag) => cleanText(flag)).filter(Boolean))];
}

export function normalizeMastermindPlan(
  plan = {},
  index = 0,
  { preview = false } = {}
) {
  const status = cleanText(plan.status, 'idea');
  const episodeType = cleanText(plan.episode_type, 'regular');
  const revision = Number.parseInt(plan.revision, 10);
  return {
    episode_plan_id: cleanText(
      plan.episode_plan_id || plan.plan_id || plan.id,
      preview ? `preview-plan-${index + 1}` : ''
    ),
    season_id: cleanText(plan.season_id),
    working_title: cleanText(
      plan.working_title || plan.title,
      preview ? 'Untitled plan' : ''
    ),
    premise: cleanText(plan.premise),
    listener_takeaway: cleanText(plan.listener_takeaway),
    episode_type: VALID_TYPES.has(episodeType) ? episodeType : 'regular',
    status: VALID_STATUSES.has(status) ? status : 'idea',
    target_air_date: cleanDate(plan.target_air_date),
    source_episode_number: cleanText(plan.source_episode_number),
    recording_note: cleanText(plan.recording_note),
    source_status_note: cleanText(plan.source_status_note),
    source_host_note: cleanText(plan.source_host_note),
    source_guest_note: cleanText(plan.source_guest_note),
    source_sheet: cleanText(
      plan.source_sheet,
      plan.source_schedule_row ? 'Schedule' : ''
    ),
    source_row: Math.max(
      0,
      Number.parseInt(plan.source_row || plan.source_schedule_row, 10) || 0
    ),
    source_quality_flags: normalizeQualityFlags(plan.source_quality_flags),
    source_intake_item_id: cleanText(plan.source_intake_item_id),
    linked_episode_id: cleanText(plan.linked_episode_id),
    owner_person_id: cleanText(plan.owner_person_id),
    revision: Number.isInteger(revision) && revision > 0 ? revision : 1,
    hosts: arrayFrom(plan.hosts, plan.host_assignments)
      .map(normalizeHost)
      .filter((host) => host.host_display_name),
    guests: arrayFrom(plan.guests, plan.guest_candidates)
      .map(normalizeGuest)
      .filter((guest) => guest.display_name),
    topics: arrayFrom(plan.topics)
      .map(normalizeTopic)
      .filter((topic) => topic.label),
    sources: arrayFrom(plan.sources, plan.research_sources)
      .map(normalizeSource)
      .filter((source) => source.title),
    sponsor_commitments: arrayFrom(
      plan.sponsor_commitments,
      plan.sponsors
    )
      .map(normalizeSponsor)
      .filter((commitment) => commitment.sponsor_display_name),
  };
}

function normalizeSeason(season = {}, index = 0, { preview = false } = {}) {
  return {
    season_id: cleanText(
      season.season_id || season.id,
      preview ? `preview-season-${index + 1}` : ''
    ),
    label: cleanText(
      season.label || season.name,
      preview ? `Season ${index + 1}` : ''
    ),
    starts_on: cleanDate(season.starts_on),
    ends_on: cleanDate(season.ends_on),
    status: cleanText(season.status, 'planning'),
    planning_goal: cleanText(season.planning_goal),
    revision: Math.max(1, Number.parseInt(season.revision, 10) || 1),
  };
}

function normalizeWorkbookIndexSummary(index = {}) {
  const coverage = index.coverage || {};
  const guestIdeas = index.guestIdeas || {};
  const expected = Number.parseInt(coverage.expectedNonemptyCellCount, 10);
  const indexed = Number.parseInt(coverage.indexedNonemptyCellCount, 10);
  const sheets = Number.parseInt(coverage.sheetCount, 10);
  return {
    workbook: cleanText(index.workbook),
    expected_nonempty_cells:
      Number.isInteger(expected) && expected >= 0 ? expected : 0,
    indexed_nonempty_cells:
      Number.isInteger(indexed) && indexed >= 0 ? indexed : 0,
    sheet_count: Number.isInteger(sheets) && sheets >= 0 ? sheets : 0,
    host_goal_count: arrayFrom(index.hostGoals).length,
    historical_production_lead_count: arrayFrom(
      index.historicalProductionLeads
    ).length,
    guest_idea_count:
      arrayFrom(guestIdeas.curated).length +
      arrayFrom(guestIdeas.publicSuggestions).length,
    intake_submission_count: arrayFrom(index.intakeSubmissions).length,
  };
}

export function normalizeSeasonMastermindData(
  data = {},
  { preview = false } = {}
) {
  const directory = data.directory || {};
  const directoryHosts = Array.isArray(directory)
    ? directory
    : arrayFrom(directory.hosts);
  const plans = arrayFrom(data.plans)
    .map((plan, index) => normalizeMastermindPlan(plan, index, { preview }))
    .filter((plan) => plan.episode_plan_id && plan.working_title);
  const pageNumber = Number.parseInt(data.page?.number, 10);
  const pageSize = Number.parseInt(data.page?.size, 10);
  const totalPlans = Number.parseInt(data.page?.total_plans, 10);
  return {
    configured: data.configured !== false,
    canManage: data.canManage === true,
    viewer_person_id: cleanText(data.viewer_person_id),
    seasons: arrayFrom(data.seasons)
      .map((season, index) => normalizeSeason(season, index, { preview }))
      .filter((season) => season.season_id && season.label),
    plans,
    page: {
      number: Number.isInteger(pageNumber) && pageNumber > 0 ? pageNumber : 1,
      size:
        Number.isInteger(pageSize) && pageSize > 0 ? pageSize : plans.length,
      total_plans:
        Number.isInteger(totalPlans) && totalPlans >= plans.length
          ? totalPlans
          : plans.length,
      has_more: data.page?.has_more === true,
    },
    workbook_index_summary: normalizeWorkbookIndexSummary(
      data.workbook_index
    ),
    directory: {
      hosts: directoryHosts
        .map(normalizeHost)
        .filter((host) => host.host_display_name),
      producers: arrayFrom(directory.producers)
        .map(normalizeProducer)
        .filter((producer) => producer.person_id && producer.display_name),
      guests: arrayFrom(directory.guests).map(normalizeGuest),
      topics: arrayFrom(directory.topics).map(normalizeTopic),
      sources: arrayFrom(directory.sources).map(normalizeSource),
    },
  };
}

export function listMastermindProducerOptions(directory = {}) {
  return arrayFrom(directory.producers)
    .map(normalizeProducer)
    .filter((producer) => producer.person_id && producer.display_name)
    .map((producer) => ({
      id: producer.person_id,
      label: producer.display_name,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function mastermindHostKey(host = {}) {
  const personId = cleanText(host.host_person_id || host.person_id);
  if (personId) return `person:${personId}`;
  return `name:${cleanText(
    host.host_display_name || host.display_name || host.name
  ).toLowerCase()}`;
}

export function listMastermindHostOptions(plans = [], directory = {}) {
  const hosts = [
    ...arrayFrom(directory.hosts),
    ...plans.flatMap((plan) => arrayFrom(plan.hosts)),
  ];
  const options = new Map();
  hosts.forEach((host, index) => {
    const normalized = normalizeHost(host, index);
    const key = mastermindHostKey(normalized);
    if (key !== 'name:' && !options.has(key)) options.set(key, normalized);
  });
  return [...options.entries()]
    .map(([id, host]) => ({
      id,
      label: host.host_display_name,
      personId: host.host_person_id,
    }))
    .sort((left, right) => left.label.localeCompare(right.label));
}

export function filterMastermindPlans(plans = [], filters = {}) {
  const query = cleanText(filters.query).toLowerCase();
  return plans.filter((plan) => {
    if (filters.seasonId && plan.season_id !== filters.seasonId) return false;
    if (filters.status === 'active' && plan.status === 'archived') return false;
    if (
      filters.status &&
      !['active', 'all'].includes(filters.status) &&
      plan.status !== filters.status
    ) {
      return false;
    }
    if (filters.episodeType && plan.episode_type !== filters.episodeType) {
      return false;
    }
    if (filters.targetDate && plan.target_air_date !== filters.targetDate) {
      return false;
    }
    if (
      filters.hostKey &&
      !plan.hosts.some((host) => mastermindHostKey(host) === filters.hostKey)
    ) {
      return false;
    }
    if (!query) return true;
    const searchText = [
      plan.working_title,
      plan.premise,
      plan.listener_takeaway,
      plan.source_episode_number,
      plan.recording_note,
      plan.source_status_note,
      plan.source_host_note,
      plan.source_guest_note,
      ...plan.hosts.map((host) => host.host_display_name),
      ...plan.guests.map((guest) => guest.display_name),
      ...plan.topics.map((topic) => topic.label),
      ...plan.sources.map((source) => source.title),
      ...plan.sponsor_commitments.map(
        (commitment) => commitment.sponsor_display_name
      ),
    ]
      .join(' ')
      .toLowerCase();
    return searchText.includes(query);
  });
}

export function summarizeMastermindPlans(plans = []) {
  return {
    total: plans.length,
    researching: plans.filter((plan) => plan.status === 'researching').length,
    ready: plans.filter((plan) => plan.status === 'ready').length,
    scheduled: plans.filter((plan) => plan.status === 'scheduled').length,
    gaps: plans.filter(
      (plan) => plan.topics.length === 0 || plan.sources.length === 0
    ).length,
  };
}

export function groupMastermindBoard(plans = [], statuses = null) {
  const visibleStatuses = statuses || MASTERMIND_BOARD_STATUSES;
  return visibleStatuses.map((status) => ({
    ...status,
    plans: plans.filter((plan) => plan.status === status.id),
  }));
}

function localDate(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  const date = cleanDate(value);
  return date ? new Date(`${date}T12:00:00`) : null;
}

export function mastermindMonthStart(value = new Date()) {
  const date = localDate(value) || localDate(new Date());
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

export function shiftMastermindMonth(value, amount) {
  const start = mastermindMonthStart(value);
  return new Date(start.getFullYear(), start.getMonth() + amount, 1);
}

export function mastermindDateKey(value) {
  const date = localDate(value);
  if (!date) return '';
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function buildMastermindCalendarDays(month, plans = []) {
  const first = mastermindMonthStart(month);
  const start = new Date(first);
  start.setDate(first.getDate() - first.getDay());
  const plansByDate = new Map();
  plans.forEach((plan) => {
    if (!plan.target_air_date) return;
    const entries = plansByDate.get(plan.target_air_date) || [];
    entries.push(plan);
    plansByDate.set(plan.target_air_date, entries);
  });

  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    const key = mastermindDateKey(date);
    return {
      key,
      date,
      inMonth: date.getMonth() === first.getMonth(),
      plans: plansByDate.get(key) || [],
    };
  });
}

const RESEARCH_CONFIG = {
  topics: {
    relation: 'topics',
    id: 'topic_id',
    label: 'label',
    emptyId: 'needs-topics',
    emptyLabel: 'Needs topics',
  },
  guests: {
    relation: 'guests',
    id: 'guest_id',
    label: 'display_name',
    emptyId: 'needs-guests',
    emptyLabel: 'Guest not selected',
  },
  sources: {
    relation: 'sources',
    id: 'source_id',
    label: 'title',
    emptyId: 'needs-sources',
    emptyLabel: 'Sources needed',
  },
};

export function groupMastermindResearch(plans = [], mode = 'topics') {
  const config = RESEARCH_CONFIG[mode] || RESEARCH_CONFIG.topics;
  const groups = new Map();
  plans.forEach((plan) => {
    const relations = arrayFrom(plan[config.relation]);
    const entries = relations.length
      ? relations
      : [{ [config.id]: config.emptyId, [config.label]: config.emptyLabel }];
    entries.forEach((entry, index) => {
      const label = cleanText(entry[config.label], config.emptyLabel);
      const id = cleanText(entry[config.id], `${mode}-${label}-${index}`);
      if (!groups.has(id)) groups.set(id, { id, label, plans: [] });
      const group = groups.get(id);
      if (
        !group.plans.some(
          (candidate) => candidate.episode_plan_id === plan.episode_plan_id
        )
      ) {
        group.plans.push(plan);
      }
    });
  });
  return [...groups.values()].sort((left, right) => {
    if (left.id.startsWith('needs-')) return 1;
    if (right.id.startsWith('needs-')) return -1;
    return left.label.localeCompare(right.label);
  });
}

export function mastermindPlanDraft(plan = {}, fallbackSeasonId = '') {
  return {
    season_id: cleanText(plan.season_id, fallbackSeasonId),
    working_title: cleanText(plan.working_title),
    premise: cleanText(plan.premise),
    listener_takeaway: cleanText(plan.listener_takeaway),
    episode_type: VALID_TYPES.has(plan.episode_type)
      ? plan.episode_type
      : 'regular',
    status: VALID_STATUSES.has(plan.status) ? plan.status : 'idea',
    target_air_date: cleanDate(plan.target_air_date),
    owner_person_id: cleanText(plan.owner_person_id),
    source_intake_item_id: cleanText(plan.source_intake_item_id),
    host_person_ids: arrayFrom(plan.host_person_ids, plan.hosts)
      .map((host) =>
        typeof host === 'string'
          ? cleanText(host)
          : cleanText(host.host_person_id || host.person_id)
      )
      .filter(Boolean),
  };
}

export function mastermindSeasonDraft(season = {}) {
  return {
    label: cleanText(season.label),
    starts_on: cleanDate(season.starts_on),
    ends_on: cleanDate(season.ends_on),
    planning_goal: cleanText(season.planning_goal),
  };
}

export function buildMastermindSeasonMutation(draft = {}, current = {}) {
  const season = mastermindSeasonDraft(draft);
  if (!season.label || !season.starts_on || !season.ends_on) {
    throw new Error('Season name, start date, and end date are required.');
  }
  if (season.ends_on < season.starts_on) {
    throw new Error('Season end date must be on or after its start date.');
  }
  const seasonId = cleanText(current.season_id);
  if (!seasonId) return { action: 'create_season', input: season };
  return {
    action: 'update_season',
    input: {
      ...season,
      season_id: seasonId,
      revision: Math.max(1, Number.parseInt(current.revision, 10) || 1),
    },
  };
}

export function buildMastermindMutation(action, draft = {}, current = {}) {
  if (!['create_plan', 'update_plan'].includes(action)) {
    throw new Error('Unsupported Season Mastermind action.');
  }
  const plan = mastermindPlanDraft(draft);
  if (!plan.season_id || !plan.working_title || !plan.premise) {
    throw new Error('Season, working title, and premise are required.');
  }
  if (action === 'create_plan') return { action, input: plan };
  const episodePlanId = cleanText(current.episode_plan_id);
  if (!episodePlanId) throw new Error('The episode plan ID is required.');
  return {
    action,
    input: {
      ...plan,
      episode_plan_id: episodePlanId,
      revision: Math.max(1, Number.parseInt(current.revision, 10) || 1),
    },
  };
}
