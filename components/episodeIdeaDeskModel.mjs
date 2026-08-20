export const EPISODE_IDEA_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'reviewing',
  'needs_changes',
  'approved',
  'future',
]);

export const EPISODE_IDEA_HORIZONS = Object.freeze([
  'current_season',
  'next_season',
  'future',
]);

export const EPISODE_IDEA_STATUS_META = Object.freeze({
  draft: {
    label: 'Private draft',
    detail: 'Only you can see and work on this pitch until it is submitted.',
  },
  submitted: {
    label: 'Awaiting review',
    detail: 'The pitch is ready for a Studio manager to review.',
  },
  reviewing: {
    label: 'In review',
    detail: 'A Studio manager is reviewing the planning fields.',
  },
  needs_changes: {
    label: 'Host input needed',
    detail: 'Update the pitch, then send it back for review.',
  },
  approved: {
    label: 'Approved for planning',
    detail: 'This pitch has moved into the shared planning workflow.',
  },
  future: {
    label: 'Future idea pile',
    detail: 'The idea is worth keeping, but not for the current plan.',
  },
});

export const EPISODE_IDEA_HORIZON_LABELS = Object.freeze({
  current_season: 'This season if space opens',
  next_season: 'Next season',
  future: 'Someday / future pile',
});

export const EPISODE_IDEA_FILTERS = Object.freeze([
  { value: 'all', label: 'All ideas', count: 'total' },
  { value: 'draft', label: 'Drafts', count: 'drafts' },
  { value: 'review', label: 'Review queue', count: 'review_queue' },
  {
    value: 'needs_changes',
    label: 'Needs changes',
    count: 'needs_changes',
  },
  { value: 'approved', label: 'Approved', count: 'approved' },
  { value: 'future', label: 'Future', count: 'future' },
]);

export const EMPTY_EPISODE_IDEA = Object.freeze({
  working_title: '',
  premise: '',
  listener_takeaway: '',
  research_notes: '',
  proposed_guest: '',
  preferred_air_date: '',
  planning_horizon: 'current_season',
});

export function createEpisodeIdeaRequestId(cryptoSource = globalThis.crypto) {
  if (typeof cryptoSource?.randomUUID === 'function') {
    return cryptoSource.randomUUID().toLowerCase();
  }
  const bytes = new Uint8Array(16);
  if (typeof cryptoSource?.getRandomValues === 'function') {
    cryptoSource.getRandomValues(bytes);
  } else {
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = Math.floor(Math.random() * 256);
    }
  }
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map((value) => value.toString(16).padStart(2, '0'));
  return [
    hex.slice(0, 4).join(''),
    hex.slice(4, 6).join(''),
    hex.slice(6, 8).join(''),
    hex.slice(8, 10).join(''),
    hex.slice(10, 16).join(''),
  ].join('-');
}

const STATUS_ALIASES = Object.freeze({
  in_review: 'reviewing',
  changes_requested: 'needs_changes',
  deferred: 'future',
});

const CAPABILITY_KEYS = Object.freeze([
  'can_edit',
  'can_submit',
  'can_start_review',
  'can_request_changes',
  'can_approve',
  'can_defer',
  'can_reopen',
]);

function text(value, maxLength = 6000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function id(value) {
  return text(value, 180);
}

function date(value) {
  const next = text(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(next)) return '';
  const parsed = new Date(`${next}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === next
    ? next
    : '';
}

function dateTime(value) {
  const parsed = new Date(String(value || ''));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function canonicalStatus(value) {
  const selected = text(value, 40).toLowerCase();
  const canonical = STATUS_ALIASES[selected] || selected;
  return EPISODE_IDEA_STATUSES.includes(canonical) ? canonical : 'draft';
}

function canonicalHorizon(value) {
  const selected = text(value, 40).toLowerCase();
  return EPISODE_IDEA_HORIZONS.includes(selected)
    ? selected
    : 'current_season';
}

function normalizeCapabilities(value) {
  const source = value && typeof value === 'object' ? value : {};
  const listed = new Set(Array.isArray(value) ? value : []);
  return Object.fromEntries(
    CAPABILITY_KEYS.map((key) => {
      const action = key.replace(/^can_/, '');
      return [key, source[key] === true || listed.has(key) || listed.has(action)];
    })
  );
}

export function normalizeEpisodeIdea(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    idea_id: id(source.idea_id),
    status: canonicalStatus(source.status),
    working_title: text(source.working_title, 180),
    premise: text(source.premise),
    listener_takeaway: text(source.listener_takeaway, 2400),
    research_notes: text(source.research_notes),
    proposed_guest: text(source.proposed_guest, 180),
    preferred_air_date: date(source.preferred_air_date),
    planning_horizon: canonicalHorizon(source.planning_horizon),
    decision_note: text(source.decision_note, 2400),
    owner_name: text(source.owner_name, 180),
    source_intake_item_id: id(source.source_intake_item_id),
    created_at: dateTime(source.created_at),
    updated_at: dateTime(source.updated_at),
    capabilities: normalizeCapabilities(source.capabilities),
  };
}

export function episodeIdeaDraft(value = {}) {
  const idea = normalizeEpisodeIdea(value);
  return {
    working_title: idea.working_title,
    premise: idea.premise,
    listener_takeaway: idea.listener_takeaway,
    research_notes: idea.research_notes,
    proposed_guest: idea.proposed_guest,
    preferred_air_date: idea.preferred_air_date,
    planning_horizon: idea.planning_horizon,
  };
}

export function episodeIdeaInput(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    working_title: text(source.working_title, 180),
    premise: text(source.premise),
    listener_takeaway: text(source.listener_takeaway, 2400),
    research_notes: text(source.research_notes),
    proposed_guest: text(source.proposed_guest, 180),
    preferred_air_date: date(source.preferred_air_date),
    planning_horizon: canonicalHorizon(source.planning_horizon),
  };
}

export function validateEpisodeIdea(value = {}, { submit = false } = {}) {
  const idea = episodeIdeaInput(value);
  if (idea.working_title.length < 3) {
    return 'Add a working title with at least 3 characters.';
  }
  if (submit && idea.premise.length < 10) {
    return 'Add a clear premise with at least 10 characters before submitting.';
  }
  return '';
}

function count(value, fallback) {
  const parsed = Number(value);
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : fallback;
}

export function summarizeEpisodeIdeas(values = [], supplied = {}) {
  const items = (Array.isArray(values) ? values : []).map(normalizeEpisodeIdea);
  const derived = Object.fromEntries(
    EPISODE_IDEA_STATUSES.map((status) => [
      status,
      items.filter((item) => item.status === status).length,
    ])
  );
  const summary = supplied && typeof supplied === 'object' ? supplied : {};
  const drafts = count(summary.drafts, derived.draft);
  const submitted = count(summary.submitted, derived.submitted);
  const reviewing = count(summary.reviewing, derived.reviewing);
  const needsChanges = count(summary.needs_changes, derived.needs_changes);
  const approved = count(summary.approved, derived.approved);
  const future = count(summary.future, derived.future);
  return {
    total: count(
      summary.total,
      drafts + submitted + reviewing + needsChanges + approved + future
    ),
    drafts,
    submitted,
    reviewing,
    review_queue: submitted + reviewing,
    needs_changes: needsChanges,
    approved,
    future,
  };
}

export function normalizeEpisodeIdeaDeskPayload(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const items = (Array.isArray(source.items) ? source.items : [])
    .map(normalizeEpisodeIdea)
    .filter((item) => item.idea_id);
  return {
    configured: source.configured !== false,
    scope: source.scope === 'team' ? 'team' : 'mine',
    canManage: source.canManage === true,
    canReview: source.canReview === true,
    viewer_person_id: id(source.viewer_person_id),
    items,
    summary: summarizeEpisodeIdeas(items, source.summary),
  };
}

export function canEpisodeIdea(item = {}, action = '') {
  const key = String(action || '').startsWith('can_')
    ? String(action)
    : `can_${String(action || '')}`;
  return normalizeEpisodeIdea(item).capabilities[key] === true;
}

function matchesFilter(item, filter) {
  if (!filter || filter === 'all') return true;
  if (filter === 'review') {
    return item.status === 'submitted' || item.status === 'reviewing';
  }
  return item.status === filter;
}

function time(value) {
  const parsed = new Date(String(value || '')).getTime();
  return Number.isNaN(parsed) ? 0 : parsed;
}

export function filterEpisodeIdeas(
  values = [],
  { filter = 'all', query = '', sort = 'status' } = {}
) {
  const normalizedQuery = text(query, 180).toLocaleLowerCase();
  const statusOrder = {
    needs_changes: 0,
    submitted: 1,
    reviewing: 2,
    draft: 3,
    approved: 4,
    future: 5,
  };
  const items = (Array.isArray(values) ? values : [])
    .map(normalizeEpisodeIdea)
    .filter((item) => {
      if (!matchesFilter(item, filter)) return false;
      if (!normalizedQuery) return true;
      return [
        item.working_title,
        item.proposed_guest,
        item.premise,
        item.owner_name,
      ].some((value) => value.toLocaleLowerCase().includes(normalizedQuery));
    });

  return items.sort((left, right) => {
    if (sort === 'recent') {
      return time(right.updated_at) - time(left.updated_at);
    }
    if (sort === 'air_date') {
      return (
        String(left.preferred_air_date || '9999').localeCompare(
          String(right.preferred_air_date || '9999')
        ) || time(right.updated_at) - time(left.updated_at)
      );
    }
    return (
      (statusOrder[left.status] ?? 9) - (statusOrder[right.status] ?? 9) ||
      time(right.updated_at) - time(left.updated_at)
    );
  });
}

export function getEpisodeIdeaFollowUpHref(value = {}) {
  const item = normalizeEpisodeIdea(value);
  if (
    item.status !== 'approved' ||
    !/^[a-zA-Z0-9][a-zA-Z0-9._:-]{0,179}$/.test(
      item.source_intake_item_id
    )
  ) {
    return '';
  }
  return `/studio/inbox?item=${encodeURIComponent(
    item.source_intake_item_id
  )}`;
}

export function buildEpisodeIdeaMutation({
  method,
  action,
  item,
  draft,
  decisionNote = '',
  requestId = '',
} = {}) {
  const selectedMethod = String(method || '').toUpperCase();
  const selectedAction = text(action, 40);
  const idea = episodeIdeaInput(draft);
  if (selectedMethod === 'POST') {
    return {
      action: selectedAction,
      request_id: text(requestId, 80).toLowerCase(),
      idea,
    };
  }

  const current = normalizeEpisodeIdea(item);
  const payload = {
    action: selectedAction,
    idea_id: current.idea_id,
    expected_updated_at: current.updated_at,
  };
  if (['save_draft', 'submit', 'approve'].includes(selectedAction)) {
    payload.idea = idea;
  }
  const note = text(decisionNote, 2400);
  if (note) payload.decision_note = note;
  return payload;
}
