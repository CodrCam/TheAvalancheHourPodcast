import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addStudioIntakeComment,
  mergeStudioIntakeManagerValues,
  normalizeStudioIntakeItem,
  selectVisibleStudioIntakeItem,
  sortStudioIntakeItems,
  summarizeStudioIntake,
  validateStudioIntakeItem,
} from '../lib/studioIntakePresentation.mjs';

function item(overrides = {}) {
  return {
    item_id: 'request-one',
    kind: 'request',
    title: 'Add a shared guest release',
    details: 'We need a single place to find the current guest release form.',
    status: 'new',
    priority: 'normal',
    created_by_person_id: 'host-one',
    created_by_name: 'Host One',
    created_at: '2026-07-26T12:00:00.000Z',
    updated_at: '2026-07-26T12:00:00.000Z',
    ...overrides,
  };
}

test('normalizes a team request and raises blockers by default', () => {
  const request = normalizeStudioIntakeItem(item());
  const blocker = normalizeStudioIntakeItem(
    item({ item_id: 'blocker', kind: 'blocker', priority: '' })
  );

  assert.equal(request.status, 'new');
  assert.equal(request.priority, 'normal');
  assert.equal(blocker.priority, 'high');
});

test('preserves only the allowlisted structured episode-request snapshot', () => {
  const request = normalizeStudioIntakeItem(
    item({
      episode_request: {
        working_title: 'Persistent slab decisions',
        premise: 'A field-based decision story.',
        listener_takeaway: 'Back off earlier.',
        research_notes: 'Compare two public accident reports.',
        proposed_guest: 'Example Forecaster',
        preferred_air_date: '2027-01-15',
        planning_horizon: 'current_season',
        source_episode_idea_id: 'idea-one',
        owner_person_id: 'Host A',
        guest_email: 'must-not-survive@example.com',
      },
    })
  );

  assert.deepEqual(request.episode_request, {
    working_title: 'Persistent slab decisions',
    premise: 'A field-based decision story.',
    listener_takeaway: 'Back off earlier.',
    research_notes: 'Compare two public accident reports.',
    proposed_guest: 'Example Forecaster',
    preferred_air_date: '2027-01-15',
    planning_horizon: 'current_season',
    source_episode_idea_id: 'idea-one',
    owner_person_id: 'Host A',
  });
  assert.equal('guest_email' in request.episode_request, false);
});

test('preserves authoritative People IDs without truncation or lossy canonicalization', () => {
  const personId = `Profile ${'A'.repeat(220)}`;
  const normalized = normalizeStudioIntakeItem(item({
    assigned_to_person_id: personId,
    created_by_person_id: personId,
    episode_request: {
      working_title: 'Long identity test',
      owner_person_id: personId,
    },
    comments: [
      {
        comment_id: 'comment-long-id',
        body: 'Identity remains exact.',
        author_person_id: personId,
        author_name: 'Host One',
        created_at: '2026-08-19T12:30:00.000Z',
      },
    ],
  }));

  assert.equal(normalized.assigned_to_person_id, personId);
  assert.equal(normalized.created_by_person_id, personId);
  assert.equal(normalized.episode_request.owner_person_id, personId);
  assert.equal(normalized.comments[0].author_person_id, personId);
});

test('requires a useful title, details, and creator', () => {
  assert.doesNotThrow(() => validateStudioIntakeItem(item()));
  assert.throws(
    () => validateStudioIntakeItem(item({ details: 'short' })),
    /enough detail/
  );
  assert.throws(
    () => validateStudioIntakeItem(item({ created_by_name: '' })),
    /creator/
  );
});

test('manager triage fields cannot overwrite the original request', () => {
  const updated = mergeStudioIntakeManagerValues(
    item(),
    {
      title: 'Forged title',
      details: 'Forged details',
      status: 'in_progress',
      priority: 'urgent',
      assigned_to_person_id: 'caleb',
      assigned_to_name: 'Caleb',
      target_date: '2026-08-01',
    },
    { now: '2026-07-27T12:00:00.000Z' }
  );

  assert.equal(updated.title, item().title);
  assert.equal(updated.details, item().details);
  assert.equal(updated.status, 'in_progress');
  assert.equal(updated.priority, 'urgent');
  assert.equal(updated.assigned_to_name, 'Caleb');
});

test('resolving and reopening tracks the resolution timestamp', () => {
  const resolved = mergeStudioIntakeManagerValues(
    item(),
    { status: 'resolved' },
    { now: '2026-07-27T12:00:00.000Z' }
  );
  const reopened = mergeStudioIntakeManagerValues(resolved, {
    status: 'reviewing',
  });

  assert.equal(resolved.resolved_at, '2026-07-27T12:00:00.000Z');
  assert.equal(reopened.resolved_at, '');
});

test('adds bounded, attributed discussion updates', () => {
  const updated = addStudioIntakeComment(item(), {
    comment_id: 'comment-one',
    body: 'I added the current release to the resource center.',
    author_person_id: 'caleb',
    author_name: 'Caleb',
    author_role: 'admin',
    created_at: '2026-07-27T12:00:00.000Z',
  });

  assert.equal(updated.comments.length, 1);
  assert.equal(updated.comments[0].author_name, 'Caleb');
});

test('sorts active blockers first and reports actionable counts', () => {
  const values = [
    item({ item_id: 'resolved', status: 'resolved' }),
    item({
      item_id: 'blocker',
      kind: 'blocker',
      priority: 'urgent',
      assigned_to_person_id: '',
    }),
    item({
      item_id: 'planned',
      status: 'planned',
      assigned_to_person_id: 'caleb',
    }),
  ];
  const sorted = sortStudioIntakeItems(values);
  const summary = summarizeStudioIntake(values);

  assert.equal(sorted[0].item_id, 'blocker');
  assert.deepEqual(summary, {
    total: 3,
    open: 2,
    new: 1,
    blockers: 1,
    unassigned: 1,
    resolved: 1,
  });
});

test('keeps the detail panel aligned with the visible filtered queue', () => {
  const visibleItems = [
    item({ item_id: 'visible-one' }),
    item({ item_id: 'visible-two' }),
  ];

  assert.equal(
    selectVisibleStudioIntakeItem(visibleItems, 'visible-two').item_id,
    'visible-two'
  );
  assert.equal(
    selectVisibleStudioIntakeItem(visibleItems, 'filtered-out').item_id,
    'visible-one'
  );
  assert.equal(
    selectVisibleStudioIntakeItem([], 'filtered-out'),
    null
  );
});
