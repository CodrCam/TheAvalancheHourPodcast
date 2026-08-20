import { isEpisodeRequestItem } from './episodeRequest.mjs';

export const EPISODE_IDEA_STATUSES = Object.freeze([
  'draft',
  'submitted',
  'reviewing',
  'needs_changes',
  'approved',
  'future',
]);

export const EPISODE_IDEA_STATUS_LABELS = Object.freeze({
  draft: 'Private draft',
  submitted: 'Awaiting review',
  reviewing: 'In review',
  needs_changes: 'Host input needed',
  approved: 'Approved for planning',
  future: 'Future idea pile',
});

export const EPISODE_IDEA_HORIZONS = Object.freeze([
  'current_season',
  'next_season',
  'future',
]);

export const EPISODE_IDEA_HORIZON_LABELS = Object.freeze({
  current_season: 'This season if space opens',
  next_season: 'Next season',
  future: 'Someday / future pile',
});

const OWNER_EDITABLE_STATUSES = new Set(['draft', 'needs_changes']);
const TEAM_VISIBLE_STATUSES = new Set(
  EPISODE_IDEA_STATUSES.filter((status) => status !== 'draft')
);

function cleanText(value, maxLength) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '')
    .trim()
    .slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9._:@/+=#-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanPersonId(value) {
  const normalized = String(value ?? '').trim();
  return /[\u0000-\u001f\u007f]/.test(normalized) ? '' : normalized;
}

function cleanDate(value) {
  const normalized = cleanText(value, 10);
  if (!normalized) return '';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return '';
  const parsed = new Date(`${normalized}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === normalized
    ? normalized
    : '';
}

function cleanDateTime(value) {
  if (!value) return '';
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function selected(value, fallback, field) {
  return Object.prototype.hasOwnProperty.call(value || {}, field)
    ? value[field]
    : fallback?.[field];
}

export function normalizeEpisodeIdeaInput(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const planningHorizon = EPISODE_IDEA_HORIZONS.includes(
    source.planning_horizon
  )
    ? source.planning_horizon
    : 'current_season';
  return {
    working_title: cleanText(source.working_title, 180),
    premise: cleanText(source.premise, 6000),
    listener_takeaway: cleanText(source.listener_takeaway, 2400),
    research_notes: cleanText(source.research_notes, 6000),
    proposed_guest: cleanText(source.proposed_guest, 180),
    preferred_air_date: cleanDate(source.preferred_air_date),
    planning_horizon: planningHorizon,
  };
}

export function validateEpisodeIdeaInput(
  value = {},
  { forSubmission = false } = {}
) {
  const input = normalizeEpisodeIdeaInput(value);
  if (input.working_title.length < 3) {
    throw new Error(
      'Episode idea: add a working title with at least 3 characters.'
    );
  }
  if (forSubmission && input.premise.length < 10) {
    throw new Error(
      'Episode idea: describe the premise in at least 10 characters before submitting it.'
    );
  }
  if (
    String(value?.preferred_air_date || '').trim() &&
    !input.preferred_air_date
  ) {
    throw new Error('Episode idea: choose a valid preferred air date.');
  }
  if (
    String(value?.planning_horizon || '').trim() &&
    !EPISODE_IDEA_HORIZONS.includes(value.planning_horizon)
  ) {
    throw new Error('Episode idea: choose a valid planning horizon.');
  }
  return input;
}

export function normalizeEpisodeIdea(value = {}, fallback = {}) {
  const source = value && typeof value === 'object' ? value : {};
  const base = fallback && typeof fallback === 'object' ? fallback : {};
  const input = normalizeEpisodeIdeaInput({
    working_title: selected(source, base, 'working_title'),
    premise: selected(source, base, 'premise'),
    listener_takeaway: selected(source, base, 'listener_takeaway'),
    research_notes: selected(source, base, 'research_notes'),
    proposed_guest: selected(source, base, 'proposed_guest'),
    preferred_air_date: selected(source, base, 'preferred_air_date'),
    planning_horizon: selected(source, base, 'planning_horizon'),
  });
  const requestedStatus = selected(source, base, 'status');
  const status = EPISODE_IDEA_STATUSES.includes(requestedStatus)
    ? requestedStatus
    : 'draft';

  return {
    schema_version: 1,
    idea_id: cleanId(selected(source, base, 'idea_id')),
    ...input,
    status,
    decision_note: cleanText(selected(source, base, 'decision_note'), 2400),
    owner_person_id: cleanPersonId(selected(source, base, 'owner_person_id')),
    owner_name: cleanText(selected(source, base, 'owner_name'), 180),
    reviewed_by_person_id: cleanPersonId(
      selected(source, base, 'reviewed_by_person_id')
    ),
    reviewed_by_name: cleanText(
      selected(source, base, 'reviewed_by_name'),
      180
    ),
    source_intake_item_id: cleanId(
      selected(source, base, 'source_intake_item_id')
    ),
    creation_request_id: cleanText(
      selected(source, base, 'creation_request_id'),
      80
    ).toLowerCase(),
    creation_fingerprint: cleanText(
      selected(source, base, 'creation_fingerprint'),
      64
    ).toLowerCase(),
    created_at: cleanDateTime(selected(source, base, 'created_at')),
    updated_at: cleanDateTime(selected(source, base, 'updated_at')),
    submitted_at: cleanDateTime(selected(source, base, 'submitted_at')),
    decided_at: cleanDateTime(selected(source, base, 'decided_at')),
    archived: selected(source, base, 'archived') === true,
  };
}

export function validateEpisodeIdea(value = {}, options = {}) {
  const idea = normalizeEpisodeIdea(value);
  validateEpisodeIdeaInput(idea, options);
  if (!idea.idea_id) {
    throw new Error('Episode idea: idea ID is required.');
  }
  if (!idea.owner_person_id || !idea.owner_name) {
    throw new Error('Episode idea: a connected owner profile is required.');
  }
  if (!idea.created_at || !idea.updated_at) {
    throw new Error('Episode idea: timestamps are required.');
  }
  if (
    Boolean(idea.creation_request_id) !== Boolean(idea.creation_fingerprint) ||
    (idea.creation_request_id &&
      !/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(
        idea.creation_request_id
      )) ||
    (idea.creation_fingerprint &&
      !/^[0-9a-f]{64}$/.test(idea.creation_fingerprint))
  ) {
    throw new Error('Episode idea: creation request metadata is invalid.');
  }
  if (idea.status !== 'draft') {
    validateEpisodeIdeaInput(idea, { forSubmission: true });
  }
  const bytes = new TextEncoder().encode(JSON.stringify(idea)).length;
  if (bytes > 300000) {
    throw new Error('Episode idea: this draft has grown too large.');
  }
  return idea;
}

export function createEpisodeIdeaRecord(
  input,
  actor,
  { ideaId, submit = false, now = new Date().toISOString() } = {}
) {
  const fields = validateEpisodeIdeaInput(input, {
    forSubmission: submit,
  });
  return validateEpisodeIdea({
    idea_id: ideaId,
    ...fields,
    status: submit ? 'submitted' : 'draft',
    owner_person_id: actor?.person_id,
    owner_name: actor?.name,
    created_at: now,
    updated_at: now,
    submitted_at: submit ? now : '',
  });
}

export function updateEpisodeIdeaDraft(currentValue, input = {}) {
  const current = validateEpisodeIdea(currentValue);
  if (!OWNER_EDITABLE_STATUSES.has(current.status)) {
    throw new Error(
      'Episode idea: this idea is read-only while the team reviews it.'
    );
  }
  const fields = validateEpisodeIdeaInput(input);
  return validateEpisodeIdea({ ...current, ...fields }, {
    forSubmission: false,
  });
}

export function submitEpisodeIdea(
  currentValue,
  { now = new Date().toISOString() } = {}
) {
  const current = validateEpisodeIdea(currentValue);
  if (!OWNER_EDITABLE_STATUSES.has(current.status)) {
    throw new Error('Episode idea: only an editable host draft can be submitted.');
  }
  validateEpisodeIdeaInput(current, { forSubmission: true });
  return validateEpisodeIdea({
    ...current,
    status: 'submitted',
    submitted_at: now,
    decision_note: '',
    reviewed_by_person_id: '',
    reviewed_by_name: '',
    decided_at: '',
  });
}

export function reviewEpisodeIdea(
  currentValue,
  action,
  actor,
  { decisionNote = '', sourceIntakeItemId = '', now = new Date().toISOString() } = {}
) {
  const current = validateEpisodeIdea(currentValue);
  const note = cleanText(decisionNote, 2400);
  const reviewer = {
    reviewed_by_person_id: actor?.person_id,
    reviewed_by_name: actor?.name,
  };
  if (!reviewer.reviewed_by_person_id || !reviewer.reviewed_by_name) {
    throw new Error('Episode idea: a connected reviewer profile is required.');
  }

  if (action === 'start_review') {
    if (current.status !== 'submitted') {
      throw new Error('Episode idea: only a submitted idea can enter review.');
    }
    return validateEpisodeIdea({
      ...current,
      ...reviewer,
      status: 'reviewing',
      decision_note: '',
    });
  }

  if (action === 'request_changes') {
    if (!['submitted', 'reviewing'].includes(current.status)) {
      throw new Error('Episode idea: this idea is not awaiting a review decision.');
    }
    if (note.length < 3) {
      throw new Error('Episode idea: explain what the host should update.');
    }
    return validateEpisodeIdea({
      ...current,
      ...reviewer,
      status: 'needs_changes',
      decision_note: note,
      decided_at: now,
    });
  }

  if (action === 'approve') {
    if (!['submitted', 'reviewing'].includes(current.status)) {
      throw new Error('Episode idea: this idea is not ready for approval.');
    }
    if (!cleanId(sourceIntakeItemId)) {
      throw new Error('Episode idea: the planning Follow-up link is required.');
    }
    return validateEpisodeIdea({
      ...current,
      ...reviewer,
      status: 'approved',
      decision_note: note,
      source_intake_item_id: sourceIntakeItemId,
      decided_at: now,
    });
  }

  if (action === 'defer') {
    if (!['submitted', 'reviewing', 'needs_changes'].includes(current.status)) {
      throw new Error('Episode idea: this idea cannot be moved to the future pile.');
    }
    if (note.length < 3) {
      throw new Error(
        'Episode idea: add a short reason or future-season reminder.'
      );
    }
    return validateEpisodeIdea({
      ...current,
      ...reviewer,
      status: 'future',
      planning_horizon:
        current.planning_horizon === 'current_season'
          ? 'next_season'
          : current.planning_horizon,
      decision_note: note,
      decided_at: now,
    });
  }

  if (action === 'reopen') {
    if (current.status !== 'future') {
      throw new Error('Episode idea: only a future idea can return to review.');
    }
    return validateEpisodeIdea({
      ...current,
      ...reviewer,
      status: 'submitted',
      decision_note: '',
      decided_at: '',
      submitted_at: now,
    });
  }

  throw new Error('Episode idea: choose a valid review action.');
}

export function canViewEpisodeIdea(
  ideaValue,
  { viewerPersonId = '', canViewTeam = false } = {}
) {
  const idea = normalizeEpisodeIdea(ideaValue);
  const ownsIdea = Boolean(viewerPersonId) &&
    idea.owner_person_id === cleanPersonId(viewerPersonId);
  return ownsIdea || (canViewTeam && TEAM_VISIBLE_STATUSES.has(idea.status));
}

export function projectEpisodeIdea(
  ideaValue,
  { viewerPersonId = '', canManage = false } = {}
) {
  const idea = validateEpisodeIdea(ideaValue);
  const ownsIdea = idea.owner_person_id === cleanPersonId(viewerPersonId);
  const ownerCanEdit = ownsIdea && OWNER_EDITABLE_STATUSES.has(idea.status);
  const reviewable = ['submitted', 'reviewing'].includes(idea.status);
  return {
    idea_id: idea.idea_id,
    working_title: idea.working_title,
    premise: idea.premise,
    listener_takeaway: idea.listener_takeaway,
    research_notes: idea.research_notes,
    proposed_guest: idea.proposed_guest,
    preferred_air_date: idea.preferred_air_date,
    planning_horizon: idea.planning_horizon,
    status: idea.status,
    decision_note: idea.decision_note,
    owner_name: idea.owner_name,
    reviewed_by_name: idea.reviewed_by_name,
    source_intake_item_id: idea.source_intake_item_id,
    created_at: idea.created_at,
    updated_at: idea.updated_at,
    submitted_at: idea.submitted_at,
    decided_at: idea.decided_at,
    capabilities: {
      can_edit: ownerCanEdit,
      can_submit: ownerCanEdit,
      can_start_review: canManage && idea.status === 'submitted',
      can_request_changes: canManage && reviewable,
      can_approve: canManage && reviewable,
      can_defer:
        canManage &&
        ['submitted', 'reviewing', 'needs_changes'].includes(idea.status),
      can_reopen: canManage && idea.status === 'future',
    },
  };
}

export function sortEpisodeIdeas(values = []) {
  const order = {
    submitted: 0,
    reviewing: 1,
    needs_changes: 2,
    approved: 3,
    draft: 4,
    future: 5,
  };
  return (Array.isArray(values) ? values : [])
    .map((value) => normalizeEpisodeIdea(value))
    .filter((idea) => idea.idea_id && !idea.archived)
    .sort(
      (left, right) =>
        (order[left.status] ?? 9) - (order[right.status] ?? 9) ||
        String(right.updated_at).localeCompare(String(left.updated_at)) ||
        left.working_title.localeCompare(right.working_title)
    );
}

export function summarizeEpisodeIdeas(values = []) {
  const ideas = sortEpisodeIdeas(values);
  return {
    total: ideas.length,
    drafts: ideas.filter((idea) => idea.status === 'draft').length,
    submitted: ideas.filter((idea) => idea.status === 'submitted').length,
    reviewing: ideas.filter((idea) => idea.status === 'reviewing').length,
    needs_changes: ideas.filter((idea) => idea.status === 'needs_changes')
      .length,
    approved: ideas.filter((idea) => idea.status === 'approved').length,
    future: ideas.filter((idea) => idea.status === 'future').length,
  };
}

export function episodeIdeaIntakeId(ideaId) {
  const normalized = cleanId(ideaId);
  if (!normalized) throw new Error('Episode idea: idea ID is required.');
  return `episode-idea-${normalized}`.slice(0, 180);
}

export function buildEpisodeIdeaIntakeItem(ideaValue) {
  const idea = validateEpisodeIdea(ideaValue, { forSubmission: true });
  const details = [`Working title: ${idea.working_title}`];
  if (idea.proposed_guest) details.push(`Proposed guest: ${idea.proposed_guest}`);
  if (idea.preferred_air_date) {
    details.push(`Preferred air date: ${idea.preferred_air_date}`);
  }
  details.push(
    `Planning horizon: ${EPISODE_IDEA_HORIZON_LABELS[idea.planning_horizon]}`,
    `Premise:\n${idea.premise}`
  );
  if (idea.listener_takeaway) {
    details.push(`Listener takeaway:\n${idea.listener_takeaway}`);
  }
  if (idea.research_notes) {
    details.push(`Early research notes:\n${idea.research_notes}`);
  }
  return {
    item_id: episodeIdeaIntakeId(idea.idea_id),
    kind: 'request',
    priority: 'normal',
    title: `Episode request: ${idea.working_title}`,
    details: details.join('\n\n').slice(0, 6000),
    episode_request: {
      working_title: idea.working_title,
      premise: idea.premise,
      listener_takeaway: idea.listener_takeaway,
      research_notes: idea.research_notes,
      proposed_guest: idea.proposed_guest,
      preferred_air_date: idea.preferred_air_date,
      planning_horizon: idea.planning_horizon,
      source_episode_idea_id: idea.idea_id,
      owner_person_id: idea.owner_person_id,
    },
    status: 'new',
    target_date: '',
    assigned_to_person_id: '',
    assigned_to_name: '',
    created_by_person_id: idea.owner_person_id,
    created_by_name: idea.owner_name,
    created_by_role: 'host',
    comments: [],
    archived: false,
  };
}

export function episodeIdeaPlanningFollowUpMatches(item = {}, ideaValue = {}) {
  const idea = normalizeEpisodeIdea(ideaValue);
  const source = item && typeof item === 'object' ? item : {};
  const request =
    source.episode_request && typeof source.episode_request === 'object'
      ? source.episode_request
      : {};
  return Boolean(
    isEpisodeRequestItem(source) &&
      source.item_id === idea.source_intake_item_id &&
      request.source_episode_idea_id === idea.idea_id &&
      request.owner_person_id === idea.owner_person_id &&
      request.working_title === idea.working_title &&
      request.premise === idea.premise &&
      request.listener_takeaway === idea.listener_takeaway &&
      request.research_notes === idea.research_notes &&
      request.proposed_guest === idea.proposed_guest &&
      request.preferred_air_date === idea.preferred_air_date &&
      request.planning_horizon === idea.planning_horizon
  );
}

export function episodeIdeaApprovalReplayState(ideaValue = {}, item = null) {
  const idea = validateEpisodeIdea(ideaValue);
  if (idea.status !== 'approved') return 'not_approved';
  const expectedItem = buildEpisodeIdeaIntakeItem(idea);
  if (
    idea.source_intake_item_id !== expectedItem.item_id ||
    !episodeIdeaPlanningFollowUpMatches(item, idea)
  ) {
    return 'repair_required';
  }
  return 'complete';
}
