import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getEpisodeAcceptancePatchBlocker,
  getEpisodeAcceptanceTaskBlocker,
  getEpisodeStudioActionBlockers,
  getHostResearchReviewFingerprint,
} from '../lib/episodeStudioActionReadiness.mjs';
import {
  GUEST_RECORDING_PLAN_TASK_ID,
  MICROPHONE_PLAN_TASK_ID,
} from '../lib/episodeProductionPlan.mjs';
import {
  GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
} from '../lib/guestQuestionnaireWorkflow.mjs';

function acceptanceReviewTask(taskId, overrides = {}) {
  return {
    task_id: taskId,
    kind: 'standard',
    required: true,
    status: 'complete',
    ...overrides,
  };
}

test('host submission blocker names the first missing items', () => {
  const blockers = getEpisodeStudioActionBlockers({
    episode: { status: 'in_progress' },
    completion: {
      can_submit: false,
      can_submit_with_gaps: false,
      missing: [
        { label: 'Episode pitch' },
        { label: 'Guest details' },
        { label: 'Episode images' },
      ],
    },
  });

  assert.match(
    blockers.submit,
    /Episode pitch, Guest details, and 1 more required item/
  );
  assert.match(blockers.submitWithGaps, /acknowledge every missing/i);
});

test('producer review blockers explain status, feedback, link, and handoff requirements', () => {
  const notSubmitted = getEpisodeStudioActionBlockers({
    episode: { status: 'in_progress', producer_feedback: '' },
  });
  assert.match(notSubmitted.accept, /Hosts must send the package/i);
  assert.match(notSubmitted.requestChanges, /Hosts must send the package/i);

  const missingFeedback = getEpisodeStudioActionBlockers({
    episode: { status: 'submitted', producer_feedback: '' },
  });
  assert.match(missingFeedback.requestChanges, /Add a producer note/i);

  const invalidLink = getEpisodeStudioActionBlockers({
    episode: {
      status: 'submitted',
      producer_feedback: 'Tighten the opening.',
      staged_episode_url: 'https://example.com/not-spotify',
    },
  });
  assert.match(invalidLink.accept, /secure Spotify link/i);

  const noLead = getEpisodeStudioActionBlockers({
    episode: { status: 'submitted', producer_feedback: '' },
    productionHandoffAvailable: false,
  });
  assert.match(noLead.accept, /Assign an active production lead/i);
});

test('corrected-response review tasks block acceptance in shared server and UI readiness', () => {
  const episode = {
    status: 'submitted',
    production_tasks: [
      acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID, {
        status: 'in_progress',
      }),
      acceptanceReviewTask(MICROPHONE_PLAN_TASK_ID),
    ],
  };

  const directBlocker = getEpisodeAcceptanceTaskBlocker(episode);
  const patchBlocker = getEpisodeAcceptancePatchBlocker({
    action: 'review',
    requestedStatus: 'accepted',
    episode,
  });
  const uiBlocker = getEpisodeStudioActionBlockers({
    episode,
    productionHandoffAvailable: true,
  }).accept;

  assert.match(directBlocker, /guest recording setup review/i);
  assert.deepEqual(patchBlocker, {
    status: 409,
    code: 'EPISODE_ACCEPTANCE_REVIEWS_INCOMPLETE',
    error: directBlocker,
  });
  assert.equal(uiBlocker, directBlocker);
});

test('acceptance reviews gate only present required tasks and allow waived work', () => {
  const optionalAndMissing = {
    status: 'submitted',
    production_tasks: [
      acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID, {
        required: false,
        status: 'in_progress',
      }),
    ],
  };
  assert.equal(getEpisodeAcceptanceTaskBlocker(optionalAndMissing), '');
  assert.equal(
    getEpisodeAcceptancePatchBlocker({
      action: 'review',
      requestedStatus: 'accepted',
      episode: optionalAndMissing,
    }),
    null
  );

  for (const receivedStatus of ['complete', 'waived']) {
    const resolved = {
      status: 'submitted',
      production_tasks: [
        acceptanceReviewTask(GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID, {
          status: receivedStatus,
        }),
        acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID, {
          status: 'waived',
        }),
        acceptanceReviewTask(MICROPHONE_PLAN_TASK_ID, {
          status: 'waived',
        }),
      ],
    };
    assert.equal(getEpisodeAcceptanceTaskBlocker(resolved), '');
    assert.equal(
      getEpisodeStudioActionBlockers({
        episode: resolved,
        productionHandoffAvailable: true,
      }).accept,
      ''
    );
  }
});

test('an open corrected-response request blocks acceptance before resubmission', () => {
  const episode = {
    status: 'submitted',
    production_tasks: [
      acceptanceReviewTask(GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID, {
        status: 'in_progress',
      }),
      acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID),
      acceptanceReviewTask(MICROPHONE_PLAN_TASK_ID, {
        status: 'waived',
      }),
    ],
  };

  const blocker = getEpisodeAcceptanceTaskBlocker(episode);
  assert.match(blocker, /guest questionnaire response receipt/i);
  assert.equal(
    getEpisodeStudioActionBlockers({
      episode,
      productionHandoffAvailable: true,
    }).accept,
    blocker
  );
  assert.equal(
    getEpisodeAcceptancePatchBlocker({
      action: 'override_review',
      requestedStatus: 'accepted',
      episode,
    })?.error,
    blocker
  );
});

test('review PATCH blocker leaves change requests and unrelated actions alone', () => {
  const episode = {
    status: 'submitted',
    production_tasks: [
      acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID, {
        status: 'in_progress',
      }),
    ],
  };

  assert.equal(
    getEpisodeAcceptancePatchBlocker({
      action: 'review',
      requestedStatus: 'needs_changes',
      episode,
    }),
    null
  );
  assert.equal(
    getEpisodeAcceptancePatchBlocker({
      action: 'update_workflow_task',
      requestedStatus: 'accepted',
      episode,
    }),
    null
  );
});

test('acceptance names both incomplete corrected-response checks', () => {
  const episode = {
    status: 'submitted_with_gaps',
    production_tasks: [
      acceptanceReviewTask(GUEST_RECORDING_PLAN_TASK_ID, {
        status: 'in_progress',
      }),
      acceptanceReviewTask(MICROPHONE_PLAN_TASK_ID, {
        status: 'not_started',
      }),
    ],
  };

  assert.match(
    getEpisodeAcceptanceTaskBlocker(episode),
    /guest recording setup review and microphone plan confirmation/i
  );
});

test('busy work takes precedence and ready actions have no blocker', () => {
  const busy = getEpisodeStudioActionBlockers({
    episode: { status: 'submitted', producer_feedback: 'Ready.' },
    completion: { can_submit: true, can_submit_with_gaps: true, missing: [] },
    dirty: true,
    uploading: true,
  });
  assert.match(busy.accept, /file upload/i);
  assert.match(busy.save, /file upload/i);

  const ready = getEpisodeStudioActionBlockers({
    episode: { status: 'submitted', producer_feedback: 'Ready.' },
    completion: { can_submit: true, can_submit_with_gaps: true, missing: [] },
    dirty: true,
    productionHandoffAvailable: true,
    hostResearchReviewConfirmed: true,
  });
  assert.equal(ready.accept, '');
  assert.equal(ready.save, '');
});

test('host submission requires an explicit research and package review', () => {
  const completion = {
    can_submit: true,
    can_submit_with_gaps: true,
    missing: [],
  };
  const unreviewed = getEpisodeStudioActionBlockers({
    episode: { status: 'in_progress' },
    completion,
  });
  assert.match(unreviewed.submit, /Host research & review/i);
  assert.match(unreviewed.submitWithGaps, /Host research & review/i);

  const reviewed = getEpisodeStudioActionBlockers({
    episode: { status: 'in_progress' },
    completion,
    hostResearchReviewConfirmed: true,
  });
  assert.equal(reviewed.submit, '');
  assert.equal(reviewed.submitWithGaps, '');
});

test('host review fingerprint changes with package work but omits private contact fields', () => {
  const episode = {
    episode_id: 'episode-one',
    status: 'in_progress',
    title: 'A reviewed episode',
    deliverables: [
      {
        id: 'guest-details',
        required: true,
        type: 'textarea',
        value: 'Publishable guest notes',
        guest_profile: {
          name: 'Guest One',
          short_bio: 'Public biography',
          contact_email: 'private@example.test',
          contact_phone: '555-0100',
        },
      },
    ],
    assets: [],
  };
  const original = getHostResearchReviewFingerprint(episode);
  const privateContactChanged = getHostResearchReviewFingerprint({
    ...episode,
    deliverables: [
      {
        ...episode.deliverables[0],
        guest_profile: {
          ...episode.deliverables[0].guest_profile,
          contact_email: 'another-private@example.test',
          contact_phone: '555-0199',
        },
      },
    ],
  });
  const publicBioChanged = getHostResearchReviewFingerprint({
    ...episode,
    deliverables: [
      {
        ...episode.deliverables[0],
        guest_profile: {
          ...episode.deliverables[0].guest_profile,
          short_bio: 'Updated public biography',
        },
      },
    ],
  });

  assert.equal(original, privateContactChanged);
  assert.notEqual(original, publicBioChanged);
  assert.doesNotMatch(original, /private@example\.test|555-0100/);
});

test('readiness is safe before the Episode Studio finishes loading', () => {
  assert.doesNotThrow(() =>
    getEpisodeStudioActionBlockers({
      episode: null,
      completion: null,
    })
  );
});
