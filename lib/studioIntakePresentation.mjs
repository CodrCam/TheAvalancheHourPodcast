export const STUDIO_INTAKE_KINDS = [
  'blocker',
  'request',
  'idea',
  'question',
];

export const STUDIO_INTAKE_STATUSES = [
  'new',
  'reviewing',
  'planned',
  'in_progress',
  'waiting',
  'resolved',
];

export const STUDIO_INTAKE_PRIORITIES = ['normal', 'high', 'urgent'];

export const STUDIO_INTAKE_KIND_LABELS = {
  blocker: 'Blocker',
  request: 'Request',
  idea: 'Idea',
  question: 'Question',
};

export const STUDIO_INTAKE_STATUS_LABELS = {
  new: 'New',
  reviewing: 'Reviewing',
  planned: 'Planned',
  in_progress: 'In progress',
  waiting: 'Waiting',
  resolved: 'Resolved',
};

function cleanText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value) {
  return cleanText(value, 180)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : '';
}

function cleanDateTime(value) {
  const date = new Date(String(value || ''));
  return Number.isNaN(date.getTime()) ? '' : date.toISOString();
}

function normalizeComment(value = {}) {
  return {
    comment_id: cleanId(value.comment_id),
    body: cleanText(value.body, 2400),
    author_person_id: cleanId(value.author_person_id),
    author_name: cleanText(value.author_name, 180),
    author_role: cleanText(value.author_role, 80),
    created_at: cleanDateTime(value.created_at),
  };
}

export function normalizeStudioIntakeItem(value = {}, fallback = {}) {
  const selected = (field) =>
    Object.prototype.hasOwnProperty.call(value, field)
      ? value[field]
      : fallback[field];
  const kind = STUDIO_INTAKE_KINDS.includes(selected('kind'))
    ? selected('kind')
    : 'request';
  const status = STUDIO_INTAKE_STATUSES.includes(selected('status'))
    ? selected('status')
    : 'new';
  const priority = STUDIO_INTAKE_PRIORITIES.includes(selected('priority'))
    ? selected('priority')
    : kind === 'blocker'
      ? 'high'
      : 'normal';

  return {
    schema_version: 1,
    item_id: cleanId(selected('item_id')),
    kind,
    title: cleanText(selected('title'), 180),
    details: cleanText(selected('details'), 6000),
    status,
    priority,
    target_date: cleanDate(selected('target_date')),
    assigned_to_person_id: cleanId(selected('assigned_to_person_id')),
    assigned_to_name: cleanText(selected('assigned_to_name'), 180),
    created_by_person_id: cleanId(selected('created_by_person_id')),
    created_by_name: cleanText(selected('created_by_name'), 180),
    created_by_role: cleanText(selected('created_by_role'), 80),
    created_at: cleanDateTime(selected('created_at')),
    updated_at: cleanDateTime(selected('updated_at')),
    resolved_at:
      status === 'resolved' ? cleanDateTime(selected('resolved_at')) : '',
    archived: selected('archived') === true,
    comments: (Array.isArray(selected('comments'))
      ? selected('comments')
      : []
    )
      .slice(-80)
      .map(normalizeComment)
      .filter(
        (comment) =>
          comment.comment_id &&
          comment.body &&
          comment.author_name &&
          comment.created_at
      ),
  };
}

export function validateStudioIntakeItem(value = {}) {
  const item = normalizeStudioIntakeItem(value);
  if (!item.item_id) {
    throw new Error('Team Inbox: item ID is required.');
  }
  if (item.title.length < 3) {
    throw new Error('Team Inbox: add a clear title.');
  }
  if (item.details.length < 10) {
    throw new Error('Team Inbox: add enough detail for someone to respond.');
  }
  if (!item.created_by_name || !item.created_at || !item.updated_at) {
    throw new Error('Team Inbox: creator details are required.');
  }
  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(item)
  ).length;
  if (serializedBytes > 300000) {
    throw new Error('Team Inbox: this item has grown too large.');
  }
  return item;
}

export function mergeStudioIntakeManagerValues(
  itemValue,
  updateValue = {},
  { now = new Date().toISOString() } = {}
) {
  const item = normalizeStudioIntakeItem(itemValue);
  const update =
    updateValue && typeof updateValue === 'object' ? updateValue : {};
  const allowedFields = [
    'status',
    'priority',
    'target_date',
    'assigned_to_person_id',
    'assigned_to_name',
    'archived',
  ];
  const allowedUpdate = {};
  for (const field of allowedFields) {
    if (Object.prototype.hasOwnProperty.call(update, field)) {
      allowedUpdate[field] = update[field];
    }
  }
  const nextStatus = STUDIO_INTAKE_STATUSES.includes(allowedUpdate.status)
    ? allowedUpdate.status
    : item.status;

  return normalizeStudioIntakeItem(
    {
      ...item,
      ...allowedUpdate,
      status: nextStatus,
      resolved_at:
        nextStatus === 'resolved'
          ? item.resolved_at || now
          : '',
    },
    item
  );
}

export function addStudioIntakeComment(
  itemValue,
  commentValue = {}
) {
  const item = normalizeStudioIntakeItem(itemValue);
  const comment = normalizeComment(commentValue);
  if (
    !comment.comment_id ||
    comment.body.length < 2 ||
    !comment.author_name ||
    !comment.created_at
  ) {
    throw new Error('Team Inbox: write a short update before posting.');
  }

  return normalizeStudioIntakeItem({
    ...item,
    comments: [...item.comments, comment].slice(-80),
  });
}

export function sortStudioIntakeItems(values = []) {
  const statusOrder = {
    new: 0,
    reviewing: 1,
    in_progress: 2,
    planned: 3,
    waiting: 4,
    resolved: 5,
  };
  const priorityOrder = { urgent: 0, high: 1, normal: 2 };

  return (Array.isArray(values) ? values : [])
    .map((item) => normalizeStudioIntakeItem(item))
    .filter((item) => item.item_id && !item.archived)
    .sort(
      (a, b) =>
        (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) ||
        (priorityOrder[a.priority] ?? 9) -
          (priorityOrder[b.priority] ?? 9) ||
        String(a.target_date || '9999').localeCompare(
          String(b.target_date || '9999')
        ) ||
        String(b.updated_at).localeCompare(String(a.updated_at))
    );
}

export function summarizeStudioIntake(values = []) {
  const items = sortStudioIntakeItems(values);
  const open = items.filter((item) => item.status !== 'resolved');
  return {
    total: items.length,
    open: open.length,
    new: open.filter((item) => item.status === 'new').length,
    blockers: open.filter((item) => item.kind === 'blocker').length,
    unassigned: open.filter((item) => !item.assigned_to_person_id).length,
    resolved: items.filter((item) => item.status === 'resolved').length,
  };
}

export function selectVisibleStudioIntakeItem(
  visibleItems = [],
  selectedId = ''
) {
  const items = Array.isArray(visibleItems) ? visibleItems : [];
  return (
    items.find((item) => item?.item_id === selectedId) ||
    items[0] ||
    null
  );
}
