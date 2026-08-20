import assert from 'node:assert/strict';
import test from 'node:test';
import {
  buildEpisodeIdeaIntakeItem,
  canViewEpisodeIdea,
  createEpisodeIdeaRecord,
  episodeIdeaApprovalReplayState,
  episodeIdeaIntakeId,
  projectEpisodeIdea,
  reviewEpisodeIdea,
  submitEpisodeIdea,
  summarizeEpisodeIdeas,
  updateEpisodeIdeaDraft,
} from '../lib/episodeIdea.mjs';
import { normalizeStudioIntakeItem } from '../lib/studioIntakePresentation.mjs';

const owner = { person_id: 'host-1', name: 'Host One' };
const manager = { person_id: 'manager-1', name: 'Manager One' };
const completeInput = {
  working_title: 'Persistent slab decisions',
  premise: 'A field-based discussion about decisions under uncertainty.',
  listener_takeaway: 'A repeatable framework for backing off early.',
  research_notes: 'Compare two accident reports and invite a forecaster.',
  proposed_guest: 'Example Forecaster',
  preferred_air_date: '2027-01-15',
  planning_horizon: 'current_season',
};

function draft(overrides = {}) {
  return createEpisodeIdeaRecord(
    { ...completeInput, ...overrides },
    owner,
    {
      ideaId: 'idea-1',
      now: '2026-08-19T12:00:00.000Z',
    }
  );
}

test('host drafts can be partial, remain private, and require a premise to submit', () => {
  const partial = createEpisodeIdeaRecord(
    { working_title: 'Wind slab follow-up' },
    owner,
    {
      ideaId: 'idea-private',
      now: '2026-08-19T12:00:00.000Z',
    }
  );
  assert.equal(partial.status, 'draft');
  assert.equal(
    canViewEpisodeIdea(partial, {
      viewerPersonId: 'another-host',
      canViewTeam: true,
    }),
    false
  );
  assert.equal(
    canViewEpisodeIdea(partial, { viewerPersonId: 'host-1' }),
    true
  );
  assert.throws(() => submitEpisodeIdea(partial), /describe the premise/i);
});

test('owner can save and submit a draft while submitted work is team-visible and locked', () => {
  const saved = updateEpisodeIdeaDraft(draft(), {
    ...completeInput,
    working_title: 'Revised persistent slab decisions',
  });
  const submitted = submitEpisodeIdea(saved, {
    now: '2026-08-20T12:00:00.000Z',
  });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.working_title, 'Revised persistent slab decisions');
  assert.equal(
    canViewEpisodeIdea(submitted, {
      viewerPersonId: 'producer-1',
      canViewTeam: true,
    }),
    true
  );
  assert.throws(
    () => updateEpisodeIdeaDraft(submitted, completeInput),
    /read-only while the team reviews/i
  );
});

test('manager review can request changes, defer, reopen, and approve', () => {
  const submitted = submitEpisodeIdea(draft(), {
    now: '2026-08-20T12:00:00.000Z',
  });
  const reviewing = reviewEpisodeIdea(submitted, 'start_review', manager);
  assert.equal(reviewing.status, 'reviewing');

  const changes = reviewEpisodeIdea(reviewing, 'request_changes', manager, {
    decisionNote: 'Clarify why this matters this season.',
  });
  assert.equal(changes.status, 'needs_changes');
  assert.equal(projectEpisodeIdea(changes, { viewerPersonId: 'host-1' }).capabilities.can_edit, true);

  const resubmitted = submitEpisodeIdea(
    updateEpisodeIdeaDraft(changes, completeInput)
  );
  const future = reviewEpisodeIdea(resubmitted, 'defer', manager, {
    decisionNote: 'Hold for next season when the research is complete.',
  });
  assert.equal(future.status, 'future');
  assert.equal(future.planning_horizon, 'next_season');

  const reopened = reviewEpisodeIdea(future, 'reopen', manager);
  const approved = reviewEpisodeIdea(reopened, 'approve', manager, {
    decisionNote: 'There is room in the winter schedule.',
    sourceIntakeItemId: 'episode-idea-idea-1',
  });
  assert.equal(approved.status, 'approved');
  assert.equal(approved.source_intake_item_id, 'episode-idea-idea-1');
});

test('approved ideas create a canonical Episode request without private ownership fields from the browser', () => {
  const submitted = submitEpisodeIdea(draft());
  const item = buildEpisodeIdeaIntakeItem(submitted);
  assert.equal(item.item_id, episodeIdeaIntakeId(submitted.idea_id));
  assert.equal(item.kind, 'request');
  assert.equal(item.title, 'Episode request: Persistent slab decisions');
  assert.match(item.details, /Early research notes:/);
  assert.equal(item.created_by_person_id, 'host-1');
  assert.equal(item.created_by_name, 'Host One');
  assert.deepEqual(item.episode_request, {
    working_title: 'Persistent slab decisions',
    premise: 'A field-based discussion about decisions under uncertainty.',
    listener_takeaway: 'A repeatable framework for backing off early.',
    research_notes: 'Compare two accident reports and invite a forecaster.',
    proposed_guest: 'Example Forecaster',
    preferred_air_date: '2027-01-15',
    planning_horizon: 'current_season',
    source_episode_idea_id: 'idea-1',
    owner_person_id: 'host-1',
  });
});

test('recognizes a completed approval replay and fails closed on a missing or mismatched planning record', () => {
  const submitted = submitEpisodeIdea(draft());
  const intake = buildEpisodeIdeaIntakeItem(submitted);
  const approved = reviewEpisodeIdea(submitted, 'approve', manager, {
    sourceIntakeItemId: intake.item_id,
  });

  assert.equal(episodeIdeaApprovalReplayState(approved, intake), 'complete');
  assert.equal(
    episodeIdeaApprovalReplayState(approved, null),
    'repair_required'
  );
  assert.equal(
    episodeIdeaApprovalReplayState(approved, {
      ...intake,
      episode_request: {
        ...intake.episode_request,
        source_episode_idea_id: 'different-idea',
      },
    }),
    'repair_required'
  );
  assert.equal(
    episodeIdeaApprovalReplayState(submitted, null),
    'not_approved'
  );

  const longOwnerId = `Profile ${'Z'.repeat(220)}`;
  const longOwnerDraft = createEpisodeIdeaRecord(
    completeInput,
    { person_id: longOwnerId, name: 'Long Owner' },
    {
      ideaId: 'idea-long-replay',
      now: '2026-08-19T12:00:00.000Z',
    }
  );
  const longOwnerSubmitted = submitEpisodeIdea(longOwnerDraft);
  const longOwnerIntake = buildEpisodeIdeaIntakeItem(longOwnerSubmitted);
  const longOwnerApproved = reviewEpisodeIdea(
    longOwnerSubmitted,
    'approve',
    manager,
    { sourceIntakeItemId: longOwnerIntake.item_id }
  );
  const persistedLongOwnerIntake = normalizeStudioIntakeItem({
    ...longOwnerIntake,
    created_at: '2026-08-19T12:01:00.000Z',
    updated_at: '2026-08-19T12:01:00.000Z',
  });
  assert.equal(
    episodeIdeaApprovalReplayState(
      longOwnerApproved,
      persistedLongOwnerIntake
    ),
    'complete'
  );
});

test('preserves authoritative person IDs exactly for ownership checks', () => {
  const exactOwner = { person_id: 'Host A', name: 'Host A' };
  const idea = createEpisodeIdeaRecord(completeInput, exactOwner, {
    ideaId: 'idea-exact-owner',
    now: '2026-08-19T12:00:00.000Z',
  });

  assert.equal(idea.owner_person_id, 'Host A');
  assert.equal(
    canViewEpisodeIdea(idea, { viewerPersonId: 'Host A' }),
    true
  );
  assert.equal(
    canViewEpisodeIdea(idea, { viewerPersonId: 'host-a' }),
    false
  );

  const longOwnerId = `profile-${'x'.repeat(220)}`;
  const longOwnerIdea = createEpisodeIdeaRecord(
    completeInput,
    { person_id: longOwnerId, name: 'Long ID Host' },
    {
      ideaId: 'idea-long-owner',
      now: '2026-08-19T12:00:00.000Z',
    }
  );
  assert.equal(longOwnerIdea.owner_person_id, longOwnerId);
  assert.equal(
    canViewEpisodeIdea(longOwnerIdea, { viewerPersonId: longOwnerId }),
    true
  );
  assert.equal(
    canViewEpisodeIdea(longOwnerIdea, {
      viewerPersonId: longOwnerId.slice(0, 180),
    }),
    false
  );
  assert.throws(
    () =>
      createEpisodeIdeaRecord(
        completeInput,
        { person_id: 'host\u0000collision', name: 'Invalid ID Host' },
        {
          ideaId: 'idea-invalid-owner',
          now: '2026-08-19T12:00:00.000Z',
        }
      ),
    /connected owner profile/i
  );
});

test('summary distinguishes active review, approved planning, and the future pile', () => {
  const submitted = submitEpisodeIdea(draft());
  const future = reviewEpisodeIdea(submitted, 'defer', manager, {
    decisionNote: 'Next year.',
  });
  const summary = summarizeEpisodeIdeas([
    draft({ working_title: 'Draft idea' }),
    submitted,
    future,
  ]);
  assert.deepEqual(summary, {
    total: 3,
    drafts: 1,
    submitted: 1,
    reviewing: 0,
    needs_changes: 0,
    approved: 0,
    future: 1,
  });
});
