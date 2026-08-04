import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createDefaultEpisodeProductionTasks,
  MICROPHONE_PLAN_TASK_ID,
} from '../lib/episodeProductionPlan.mjs';
import {
  completeGuestQuestionnaireWorkflowTask,
  GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
  GUEST_QUESTIONNAIRE_SENT_TASK_ID,
  reopenGuestQuestionnaireSentTask,
  reopenGuestQuestionnaireSentTaskForNewLink,
} from '../lib/guestQuestionnaireWorkflow.mjs';
import {
  getGuestQuestionnaireSubmissionIdempotency,
  hashGuestQuestionnaireSubmissionId,
  hashGuestQuestionnaireSubmissionPayload,
} from '../lib/guestQuestionnaireSubmission.mjs';
import { buildGuestQuestionnaireSubmissionNotifications } from '../lib/guestQuestionnaireNotifications.js';
import {
  consumeGuestQuestionnaireRateLimit,
  resetGuestQuestionnaireRateLimitsForTests,
} from '../lib/guestQuestionnaireRateLimit.mjs';

test('questionnaire lifecycle completes sent and received gates without private evidence', () => {
  const episode = {
    episode_id: 'episode-one',
    title: 'Mountain Decisions',
    target_release_date: '2026-09-01',
    host_person_ids: ['host-one'],
    producer_person_id: 'producer-one',
    production_tasks: createDefaultEpisodeProductionTasks('2026-09-01'),
  };
  const sent = completeGuestQuestionnaireWorkflowTask(
    episode,
    GUEST_QUESTIONNAIRE_SENT_TASK_ID,
    {
      actorPersonId: 'host-one',
      actorName: 'Host One',
      note: 'Guest questionnaire share link issued.',
      now: '2026-08-04T12:00:00.000Z',
    }
  );
  const received = completeGuestQuestionnaireWorkflowTask(
    sent.episode,
    GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
    {
      actorName: 'Episode guest',
      note: 'Guest questionnaire submitted.',
      now: '2026-08-05T12:00:00.000Z',
    }
  );

  assert.equal(sent.changed, true);
  assert.equal(received.changed, true);
  const sentTask = received.episode.production_tasks.find(
    (task) => task.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
  );
  const receivedTask = received.episode.production_tasks.find(
    (task) => task.task_id === GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID
  );
  assert.equal(sentTask.status, 'complete');
  assert.equal(receivedTask.status, 'complete');
  assert.equal(receivedTask.completed_by_name, 'Episode guest');
  assert.equal(receivedTask.evidence_note, 'Guest questionnaire submitted.');
  assert.doesNotMatch(
    JSON.stringify(receivedTask),
    /email|shipping|address|answer/i
  );

  const repeated = completeGuestQuestionnaireWorkflowTask(
    received.episode,
    GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID
  );
  assert.equal(repeated.changed, false);

  const replacement = reopenGuestQuestionnaireSentTask(sent.episode, {
    actorPersonId: 'host-one',
    actorName: 'Host One',
    now: '2026-08-04T13:00:00.000Z',
  });
  assert.equal(replacement.changed, true);
  assert.equal(
    replacement.episode.production_tasks.find(
      (task) => task.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
    ).status,
    'in_progress'
  );

  const firstIssuedLink = reopenGuestQuestionnaireSentTaskForNewLink(
    sent.episode,
    {
      actorPersonId: 'host-one',
      actorName: 'Host One',
      now: '2026-08-04T14:00:00.000Z',
    }
  );
  assert.equal(firstIssuedLink.changed, true);
  assert.equal(
    firstIssuedLink.episode.production_tasks.find(
      (task) => task.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
    ).status,
    'in_progress'
  );
  const waivedEpisode = {
    ...sent.episode,
    production_tasks: sent.episode.production_tasks.map((task) =>
      task.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
        ? { ...task, status: 'waived' }
        : task
    ),
  };
  const waivedReplacement = reopenGuestQuestionnaireSentTaskForNewLink(
    waivedEpisode,
    {}
  );
  assert.equal(waivedReplacement.changed, true);
  assert.equal(
    waivedReplacement.episode.production_tasks.find(
      (task) => task.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
    ).status,
    'in_progress'
  );
  const completedMicPlanEpisode = {
    ...sent.episode,
    production_tasks: sent.episode.production_tasks.map((task) =>
      task.task_id === MICROPHONE_PLAN_TASK_ID
        ? { ...task, status: 'complete' }
        : task
    ),
  };
  const replacementAfterMicPlan =
    reopenGuestQuestionnaireSentTaskForNewLink(
      completedMicPlanEpisode,
      {}
    );
  assert.equal(replacementAfterMicPlan.changed, true);
  assert.equal(
    replacementAfterMicPlan.episode.production_tasks.find(
      (task) => task.task_id === MICROPHONE_PLAN_TASK_ID
    ).status,
    'complete'
  );
});

test('submission hashes make retries idempotent and reject key reuse with changed answers', () => {
  const submission = {
    submission_id: 'submission-1234',
    answers: { guest_name: 'Alex', topics: 'Safety' },
    scheduling_acknowledgements: {
      interview: true,
      pre_interview: true,
    },
  };
  const stored = {
    submission_id_hash: hashGuestQuestionnaireSubmissionId(
      submission.submission_id
    ),
    submission_payload_hash:
      hashGuestQuestionnaireSubmissionPayload(submission),
  };
  assert.equal(
    getGuestQuestionnaireSubmissionIdempotency(stored, {
      ...submission,
      answers: { topics: 'Safety', guest_name: 'Alex' },
    }).outcome,
    'idempotent'
  );
  assert.equal(
    getGuestQuestionnaireSubmissionIdempotency(stored, {
      ...submission,
      answers: { ...submission.answers, topics: 'A changed answer' },
    }).outcome,
    'reused_with_different_payload'
  );
  assert.equal(
    getGuestQuestionnaireSubmissionIdempotency(stored, {
      ...submission,
      submission_id: 'submission-5678',
    }).outcome,
    'new'
  );
  assert.equal(
    getGuestQuestionnaireSubmissionIdempotency(
      { ...stored, status: 'submitted' },
      {
        ...submission,
        submission_id: 'submission-5678',
      }
    ).outcome,
    'locked'
  );
});

test('submission notifications target only assigned hosts and producer with a safe preview', () => {
  const entries = buildGuestQuestionnaireSubmissionNotifications({
    episode: {
      episode_id: 'episode-one',
      title: 'Mountain Decisions',
      host_person_ids: ['host-one', 'host-two'],
      producer_person_id: 'producer-one',
    },
    responseRevision: 2,
  });
  assert.deepEqual(
    entries.map((entry) => entry.notification.recipient_person_id),
    ['host-one', 'host-two', 'producer-one']
  );
  assert.equal(
    entries[0].notification.deep_link,
    '/studio/episodes/episode-one/questionnaire'
  );
  assert.equal(entries[0].notification.preview, 'Guest questionnaire submitted.');
  assert.doesNotMatch(JSON.stringify(entries), /shipping|email|address/i);
});

test('public questionnaire rate limits reads and submissions independently', () => {
  resetGuestQuestionnaireRateLimitsForTests();
  const first = consumeGuestQuestionnaireRateLimit({
    token: 'token',
    address: '192.0.2.1',
    action: 'submit',
    limit: 2,
    windowMs: 60000,
    now: new Date('2026-08-04T12:00:00.000Z'),
  });
  const second = consumeGuestQuestionnaireRateLimit({
    token: 'token',
    address: '192.0.2.1',
    action: 'submit',
    limit: 2,
    windowMs: 60000,
    now: new Date('2026-08-04T12:00:01.000Z'),
  });
  const third = consumeGuestQuestionnaireRateLimit({
    token: 'token',
    address: '192.0.2.1',
    action: 'submit',
    limit: 2,
    windowMs: 60000,
    now: new Date('2026-08-04T12:00:02.000Z'),
  });
  assert.equal(first.allowed, true);
  assert.equal(second.allowed, true);
  assert.equal(third.allowed, false);
  assert.equal(
    consumeGuestQuestionnaireRateLimit({
      token: 'token',
      address: '192.0.2.1',
      action: 'read',
      limit: 1,
      now: new Date('2026-08-04T12:00:02.000Z'),
    }).allowed,
    true
  );
});
