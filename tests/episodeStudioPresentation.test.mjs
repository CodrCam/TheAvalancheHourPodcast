import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areProducerDirectionsComplete,
  createDefaultEpisodeDeliverables,
  episodeStudioSummary,
  getEpisodeCompletion,
  getEpisodeStudioMembership,
  mergeEpisodeStudioManagerValues,
  mergeEpisodeStudioServerFields,
  mergeHostDeliverableValues,
  normalizeEpisodeStudio,
  PRODUCER_DIRECTIONS_MIN_LENGTH,
  validateEpisodeStudio,
} from '../lib/episodeStudioPresentation.mjs';

const clearProducerBrief =
  'Use mission-ridge_interview_jordan_raw.wav for the final cut. Make mission-ridge_photo-01_jordan-ridgeline.jpg the cover image.';

function sampleEpisode() {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    target_release_date: '2026-10-15',
    host_person_ids: ['dom-baker'],
    deliverables: createDefaultEpisodeDeliverables().slice(0, 2),
  };
}

test('does not allow submission until every required deliverable is complete', () => {
  const empty = getEpisodeCompletion(sampleEpisode());
  assert.equal(empty.can_submit, false);
  assert.equal(empty.can_submit_with_gaps, false);
  assert.equal(empty.percent, 0);

  const complete = getEpisodeCompletion({
    ...sampleEpisode(),
    producer_directions: clearProducerBrief,
    deliverables: [
      {
        id: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: true,
        value: 'Ready',
      },
      {
        id: 'files',
        label: 'Files',
        type: 'url',
        required: true,
        value: 'https://drive.google.com/example',
      },
    ],
  });
  assert.equal(complete.can_submit, true);
  assert.equal(complete.can_submit_with_gaps, false);
  assert.equal(complete.percent, 100);
});

test('allows a provisional handoff only when every gap is acknowledged', () => {
  const episode = sampleEpisode();
  episode.producer_directions = clearProducerBrief;
  episode.deliverables = episode.deliverables.map((deliverable) => ({
    ...deliverable,
    missing_acknowledged: true,
    missing_note: 'Will add this after the guest sends it.',
    expected_by: '2026-08-10',
  }));

  const completion = getEpisodeCompletion(episode);
  assert.equal(completion.can_submit, false);
  assert.equal(completion.can_submit_with_gaps, true);
  assert.equal(completion.acknowledged_missing, 2);
});

test('requires a usable producer brief for complete and known-gap submissions', () => {
  const episode = sampleEpisode();
  episode.deliverables = episode.deliverables.map((deliverable) => ({
    ...deliverable,
    value: 'Ready',
  }));

  const withoutBrief = getEpisodeCompletion(episode);
  assert.equal(withoutBrief.can_submit, false);
  assert.equal(
    withoutBrief.missing[0].id,
    'producer-directions'
  );

  episode.deliverables = episode.deliverables.map((deliverable) => ({
    ...deliverable,
    value: '',
    missing_acknowledged: true,
    missing_note: 'The guest will send this tomorrow.',
  }));
  const acknowledgedWithoutBrief = getEpisodeCompletion(episode);
  assert.equal(acknowledgedWithoutBrief.can_submit_with_gaps, false);

  episode.producer_directions = clearProducerBrief;
  const acknowledgedWithBrief = getEpisodeCompletion(episode);
  assert.equal(acknowledgedWithBrief.can_submit_with_gaps, true);
});

test('producer directions use a meaningful minimum and survive normalization', () => {
  assert.equal(
    areProducerDirectionsComplete('x'.repeat(PRODUCER_DIRECTIONS_MIN_LENGTH - 1)),
    false
  );
  assert.equal(
    areProducerDirectionsComplete('x'.repeat(PRODUCER_DIRECTIONS_MIN_LENGTH)),
    true
  );

  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    producer_directions: clearProducerBrief,
  });
  assert.equal(episode.producer_directions, clearProducerBrief);
});

test('host deliverable updates cannot change requirements or labels', () => {
  const episode = sampleEpisode();
  const updated = mergeHostDeliverableValues(episode, [
    {
      id: episode.deliverables[0].id,
      value: 'A complete pitch',
      required: false,
      label: 'Changed',
      missing_acknowledged: true,
      missing_note: 'Not actually missing',
    },
  ]);

  assert.equal(updated.deliverables[0].value, 'A complete pitch');
  assert.equal(updated.deliverables[0].required, true);
  assert.equal(
    updated.deliverables[0].label,
    episode.deliverables[0].label
  );
  assert.equal(updated.deliverables[0].missing_acknowledged, true);
});

test('rejects unsafe material links', () => {
  const episode = sampleEpisode();
  episode.deliverables[0] = {
    id: 'recording',
    label: 'Recording',
    type: 'url',
    required: true,
    value: 'javascript:alert(1)',
  };

  assert.throws(
    () => validateEpisodeStudio(episode),
    /must use an HTTPS link/
  );
});

test('rejects same-site action routes as episode material links', () => {
  const episode = sampleEpisode();
  episode.deliverables[0] = {
    id: 'recording',
    label: 'Recording',
    type: 'url',
    required: true,
    value: '/api/store/admin/auth/logout',
  };

  assert.throws(
    () => validateEpisodeStudio(episode),
    /must use an HTTPS link/
  );
});

test('manager updates cannot forge workflow or discussion metadata', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    status: 'submitted',
    messages: [
      {
        message_id: 'message-original',
        body: 'Original discussion',
        author_name: 'Host',
        author_role: 'host',
        created_at: '2026-07-25T10:00:00.000Z',
      },
    ],
    delivery_health: 'off_track',
    delivery_health_updated_by_name: 'Host',
    created_by: 'creator@example.com',
    created_at: '2026-07-24T10:00:00.000Z',
  });

  const updated = mergeEpisodeStudioManagerValues(episode, {
    title: 'Updated title',
    status: 'accepted',
    messages: [
      {
        message_id: 'message-forged',
        body: '<script>alert(1)</script>',
        author_name: 'Producer',
        author_role: 'producer',
      },
    ],
    delivery_health: 'on_track',
    delivery_health_updated_by_name: 'Forged producer',
    created_by: 'attacker@example.com',
    created_at: '2099-01-01T00:00:00.000Z',
  });

  assert.equal(updated.title, 'Updated title');
  assert.equal(updated.status, episode.status);
  assert.deepEqual(updated.messages, episode.messages);
  assert.equal(updated.delivery_health, episode.delivery_health);
  assert.equal(
    updated.delivery_health_updated_by_name,
    episode.delivery_health_updated_by_name
  );
  assert.equal(updated.created_by, episode.created_by);
  assert.equal(updated.created_at, episode.created_at);
});

test('normalizes duplicate host assignments once', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    host_person_ids: ['dom-baker', 'dom-baker'],
  });
  assert.deepEqual(episode.host_person_ids, ['dom-baker']);
});

test('defaults legacy episodes to on-track delivery health', () => {
  const episode = normalizeEpisodeStudio(sampleEpisode());
  const summary = episodeStudioSummary(sampleEpisode());

  assert.equal(episode.delivery_health, 'on_track');
  assert.equal(episode.delivery_health_updated_at, '');
  assert.equal(episode.delivery_health_updated_by_person_id, '');
  assert.equal(episode.delivery_health_updated_by_name, '');
  assert.equal(episode.delivery_health_updated_by_role, '');
  assert.equal(summary.delivery_health, 'on_track');
});

test('preserves valid off-track delivery-health attribution in summaries', () => {
  const input = {
    ...sampleEpisode(),
    delivery_health: 'off_track',
    delivery_health_updated_at: '2026-07-25T08:12:00.000Z',
    delivery_health_updated_by_person_id: 'cam-griffin',
    delivery_health_updated_by_name: 'Cam Griffin',
    delivery_health_updated_by_role: 'studio_manager',
  };

  const episode = normalizeEpisodeStudio(input);
  const summary = episodeStudioSummary(input);

  assert.equal(episode.delivery_health, 'off_track');
  assert.equal(summary.delivery_health, 'off_track');
  assert.equal(
    summary.delivery_health_updated_at,
    '2026-07-25T08:12:00.000Z'
  );
  assert.equal(
    summary.delivery_health_updated_by_person_id,
    'cam-griffin'
  );
  assert.equal(summary.delivery_health_updated_by_name, 'Cam Griffin');
  assert.equal(
    summary.delivery_health_updated_by_role,
    'studio_manager'
  );
});

test('falls back to on track for an invalid delivery-health value', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    delivery_health: 'predicted_late',
  });
  const summary = episodeStudioSummary({
    ...sampleEpisode(),
    delivery_health: 'predicted_late',
  });

  assert.equal(episode.delivery_health, 'on_track');
  assert.equal(summary.delivery_health, 'on_track');
});

test('merges server-only fields without discarding unsaved episode edits', () => {
  const dirtyEpisode = {
    ...sampleEpisode(),
    title: 'Unsaved working title',
    updated_at: 'before',
    messages: [],
  };
  const merged = mergeEpisodeStudioServerFields(
    dirtyEpisode,
    {
      title: 'Persisted title',
      updated_at: 'after',
      messages: [{ message_id: 'message-1', body: 'A new decision' }],
    },
    ['messages', 'updated_at']
  );

  assert.equal(merged.title, 'Unsaved working title');
  assert.equal(merged.updated_at, 'after');
  assert.equal(merged.messages[0].body, 'A new decision');
});

test('preserves a selected producer profile independently from email', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    producer_person_id: 'cam-griffin',
    producer_email: 'cam@example.com',
  });

  assert.equal(episode.producer_person_id, 'cam-griffin');
  assert.equal(episode.producer_email, 'cam@example.com');
});

test('finds every personal episode relationship without duplicating episodes', () => {
  const identity = {
    person_id: 'cam-griffin',
    username: 'cam@example.com',
  };
  const episode = {
    ...sampleEpisode(),
    host_person_ids: ['cam-griffin'],
    producer_person_id: 'cam-griffin',
    created_by_person_id: 'cam-griffin',
    created_by: 'cam@example.com',
  };

  assert.deepEqual(getEpisodeStudioMembership(episode, identity), [
    'host',
    'producer',
    'creator',
  ]);
});

test('recognizes legacy episode creators by a verified account identifier', () => {
  const episode = {
    ...sampleEpisode(),
    created_by: 'CAM@EXAMPLE.COM',
  };

  assert.deepEqual(
    getEpisodeStudioMembership(episode, {
      person_id: 'cam-griffin',
      account_email: 'cam@example.com',
    }),
    ['creator']
  );
});

test('does not include an unrelated episode in personal work', () => {
  const episode = {
    ...sampleEpisode(),
    producer_person_id: 'angie-link',
    created_by_person_id: 'caleb-merrill',
    created_by: 'caleb@example.com',
  };

  assert.deepEqual(
    getEpisodeStudioMembership(episode, {
      person_id: 'cam-griffin',
      username: 'cam@example.com',
    }),
    []
  );
});

test('normalizes the episode discussion and keeps the newest 100 messages', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    messages: Array.from({ length: 105 }, (_, index) => ({
      message_id: `message-${index}`,
      body: `Update ${index}`,
      author_name: index % 2 ? 'Host' : 'Producer',
      author_role: index % 2 ? 'host' : 'producer',
      created_at: `2026-10-01T00:${String(index % 60).padStart(2, '0')}:00Z`,
    })),
  });

  assert.equal(episode.messages.length, 100);
  assert.equal(episode.messages[0].body, 'Update 5');
  assert.equal(episode.messages[99].body, 'Update 104');
});
