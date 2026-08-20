import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildEpisodeIdeaMutation,
  canEpisodeIdea,
  createEpisodeIdeaRequestId,
  episodeIdeaDraft,
  filterEpisodeIdeas,
  getEpisodeIdeaFollowUpHref,
  normalizeEpisodeIdea,
  normalizeEpisodeIdeaDeskPayload,
  summarizeEpisodeIdeas,
  validateEpisodeIdea,
} from '../components/episodeIdeaDeskModel.mjs';

function idea(overrides = {}) {
  return {
    idea_id: 'idea-one',
    status: 'draft',
    working_title: 'Decision-making after rapid loading',
    premise: 'Compare the observations that changed the terrain decision.',
    listener_takeaway: 'Pause before committing to consequential terrain.',
    research_notes: 'Review public incident reports.',
    proposed_guest: 'Regional forecaster',
    preferred_air_date: '2026-11-04',
    planning_horizon: 'current_season',
    owner_name: 'Host One',
    source_intake_item_id: '',
    created_at: '2026-08-18T14:00:00.000Z',
    updated_at: '2026-08-19T14:00:00.000Z',
    capabilities: { can_edit: true, can_submit: true },
    ...overrides,
  };
}

test('normalizes canonical Idea Desk states without inventing authority', () => {
  const normalized = normalizeEpisodeIdea(
    idea({
      status: 'reviewing',
      capabilities: {
        can_approve: true,
        can_reopen: false,
      },
    })
  );

  assert.equal(normalized.status, 'reviewing');
  assert.equal(canEpisodeIdea(normalized, 'approve'), true);
  assert.equal(canEpisodeIdea(normalized, 'edit'), false);
  assert.equal(canEpisodeIdea(normalized, 'reopen'), false);

  assert.equal(
    normalizeEpisodeIdea(idea({ status: 'in_review' })).status,
    'reviewing'
  );
  assert.equal(
    normalizeEpisodeIdea(idea({ status: 'changes_requested' })).status,
    'needs_changes'
  );
  assert.equal(
    normalizeEpisodeIdea(idea({ status: 'deferred' })).status,
    'future'
  );
});

test('builds summary filters from canonical backend counts', () => {
  const values = [
    idea(),
    idea({ idea_id: 'submitted', status: 'submitted' }),
    idea({ idea_id: 'reviewing', status: 'reviewing' }),
    idea({ idea_id: 'changes', status: 'needs_changes' }),
    idea({ idea_id: 'approved', status: 'approved' }),
    idea({ idea_id: 'future', status: 'future' }),
  ];
  const summary = summarizeEpisodeIdeas(values);

  assert.deepEqual(summary, {
    total: 6,
    drafts: 1,
    submitted: 1,
    reviewing: 1,
    review_queue: 2,
    needs_changes: 1,
    approved: 1,
    future: 1,
  });

  const payload = normalizeEpisodeIdeaDeskPayload({
    configured: true,
    scope: 'team',
    canManage: true,
    canReview: true,
    viewer_person_id: 'manager-one',
    items: values,
    summary: {
      total: 8,
      drafts: 1,
      submitted: 2,
      reviewing: 1,
      needs_changes: 1,
      approved: 2,
      future: 1,
    },
  });
  assert.equal(payload.scope, 'team');
  assert.equal(payload.summary.review_queue, 3);
  assert.equal(payload.summary.total, 8);
});

test('filters the local authorized set by status and text without extra reads', () => {
  const values = [
    idea({ idea_id: 'draft', updated_at: '2026-08-18T12:00:00.000Z' }),
    idea({
      idea_id: 'submitted',
      status: 'submitted',
      working_title: 'Persistent slab terrain',
      owner_name: 'Morgan Dinsdale',
      updated_at: '2026-08-19T12:00:00.000Z',
    }),
    idea({
      idea_id: 'reviewing',
      status: 'reviewing',
      proposed_guest: 'Community forecaster',
      updated_at: '2026-08-20T12:00:00.000Z',
    }),
  ];

  assert.deepEqual(
    filterEpisodeIdeas(values, { filter: 'review' }).map(
      (item) => item.idea_id
    ),
    ['submitted', 'reviewing']
  );
  assert.deepEqual(
    filterEpisodeIdeas(values, { query: 'community', sort: 'recent' }).map(
      (item) => item.idea_id
    ),
    ['reviewing']
  );
  assert.deepEqual(
    filterEpisodeIdeas(values, { query: 'morgan' }).map(
      (item) => item.idea_id
    ),
    ['submitted']
  );
});

test('builds the exact POST and concurrency-safe PATCH contracts', () => {
  const current = normalizeEpisodeIdea(
    idea({ status: 'reviewing', capabilities: { can_approve: true } })
  );
  const draft = episodeIdeaDraft(current);
  const created = buildEpisodeIdeaMutation({
    method: 'POST',
    action: 'submit_new',
    draft,
    requestId: '11111111-1111-4111-8111-111111111111',
  });
  assert.deepEqual(Object.keys(created).sort(), [
    'action',
    'idea',
    'request_id',
  ]);
  assert.equal(created.action, 'submit_new');
  assert.equal(
    created.request_id,
    '11111111-1111-4111-8111-111111111111'
  );

  const approved = buildEpisodeIdeaMutation({
    method: 'PATCH',
    action: 'approve',
    item: current,
    draft,
    decisionNote: 'Approved for Season 11.',
  });
  assert.equal(approved.idea_id, 'idea-one');
  assert.equal(approved.expected_updated_at, '2026-08-19T14:00:00.000Z');
  assert.equal(approved.decision_note, 'Approved for Season 11.');
  assert.equal(approved.idea.working_title, current.working_title);

  const requested = buildEpisodeIdeaMutation({
    method: 'PATCH',
    action: 'request_changes',
    item: current,
    draft,
    decisionNote: 'Clarify the listener decision.',
  });
  assert.equal(Object.hasOwn(requested, 'idea'), false);
});

test('creates an RFC 4122 version-4 request key for safe creation retries', () => {
  const requestId = createEpisodeIdeaRequestId({
    randomUUID: () => 'AAAAAAAA-AAAA-4AAA-8AAA-AAAAAAAAAAAA',
  });
  assert.equal(requestId, 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');
});

test('only approved ideas receive a validated Team follow-up link', () => {
  assert.equal(
    getEpisodeIdeaFollowUpHref(
      idea({
        status: 'approved',
        source_intake_item_id: 'episode-idea-safe-id',
      })
    ),
    '/studio/inbox?item=episode-idea-safe-id'
  );
  assert.equal(
    getEpisodeIdeaFollowUpHref(
      idea({
        status: 'reviewing',
        source_intake_item_id: 'episode-idea-safe-id',
      })
    ),
    ''
  );
  assert.equal(
    getEpisodeIdeaFollowUpHref(
      idea({
        status: 'approved',
        source_intake_item_id: 'unsafe id?redirect=/admin',
      })
    ),
    ''
  );
});

test('draft validation stays permissive while submission requires a premise', () => {
  assert.equal(
    validateEpisodeIdea({ working_title: 'Early idea', premise: '' }),
    ''
  );
  assert.match(
    validateEpisodeIdea(
      { working_title: 'Early idea', premise: 'Too short' },
      { submit: true }
    ),
    /premise/
  );
});
