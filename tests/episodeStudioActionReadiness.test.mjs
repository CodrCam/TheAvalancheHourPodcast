import assert from 'node:assert/strict';
import test from 'node:test';
import { getEpisodeStudioActionBlockers } from '../lib/episodeStudioActionReadiness.mjs';

test('host submission blocker names the first missing items', () => {
  const blockers = getEpisodeStudioActionBlockers({
    episode: { status: 'in_progress' },
    completion: {
      can_submit: false,
      can_submit_with_gaps: false,
      missing: [
        { label: 'Producer handoff brief' },
        { label: 'Guest details' },
        { label: 'Episode images' },
      ],
    },
  });

  assert.match(
    blockers.submit,
    /Producer handoff brief, Guest details, and 1 more required item/
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
  assert.match(noLead.accept, /Activate Angie or Caleb/i);
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
  });
  assert.equal(ready.accept, '');
  assert.equal(ready.save, '');
});

test('readiness is safe before the Episode Studio finishes loading', () => {
  assert.doesNotThrow(() =>
    getEpisodeStudioActionBlockers({
      episode: null,
      completion: null,
    })
  );
});
