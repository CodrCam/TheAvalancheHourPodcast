import test from 'node:test';
import assert from 'node:assert/strict';
import {
  areProducerDirectionsComplete,
  configureEpisodeDeliverables,
  createDefaultEpisodeDeliverables,
  EPISODE_ASSET_RETENTION_DAYS,
  episodeStudioSummary,
  getEpisodeAssetRetentionExpiresAt,
  getEpisodeCompletion,
  getEpisodeStudioMembership,
  isEpisodeAssetExpired,
  isDeliverableComplete,
  mergeEpisodeStudioManagerValues,
  mergeEpisodeStudioServerFields,
  mergeHostDeliverableValues,
  normalizeEpisodeStudio,
  PRODUCER_DIRECTIONS_MIN_LENGTH,
  removeEpisodeAssetFromEpisode,
  sanitizeEpisodeStudioForViewer,
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
  assert.equal(complete.host_percent, 100);
  assert.equal(complete.percent, 80);
  assert.equal(complete.producer_approved, false);

  const approved = getEpisodeCompletion({
    ...sampleEpisode(),
    status: 'accepted',
    producer_directions: clearProducerBrief,
    deliverables: complete.missing.length
      ? []
      : [
          {
            id: 'notes',
            label: 'Notes',
            type: 'textarea',
            required: true,
            value: 'Ready',
          },
        ],
  });
  assert.equal(approved.percent, 100);
  assert.equal(approved.producer_approved, true);
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

test('does not require a redundant episode-wide brief for submission', () => {
  const episode = sampleEpisode();
  episode.deliverables = episode.deliverables.map((deliverable) => ({
    ...deliverable,
    value: 'Ready',
    social_profiles:
      deliverable.id === 'guest-details' ? 'Website: https://example.com' : '',
  }));

  const withoutBrief = getEpisodeCompletion(episode);
  assert.equal(withoutBrief.can_submit, true);
  assert.equal(
    withoutBrief.missing.some((item) => item.id === 'producer-directions'),
    false
  );

  episode.deliverables = episode.deliverables.map((deliverable) => ({
    ...deliverable,
    value: '',
    missing_acknowledged: true,
    missing_note: 'The guest will send this tomorrow.',
  }));
  const acknowledgedWithoutBrief = getEpisodeCompletion(episode);
  assert.equal(acknowledgedWithoutBrief.can_submit_with_gaps, true);

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

test('producer checklist configuration persists requirements and preserves host work', () => {
  const episode = {
    ...sampleEpisode(),
    deliverables: [
      {
        id: 'notes',
        label: 'Notes',
        description: 'Original',
        type: 'textarea',
        required: true,
        value: 'Host response',
      },
    ],
  };
  const configured = configureEpisodeDeliverables(episode, [
    {
      id: 'ad-confirmation',
      label: 'Confirm the ad spot recording',
      description: 'Select the uploaded evidence.',
      type: 'textarea',
      required: true,
    },
    {
      id: 'notes',
      label: 'Edited notes',
      description: 'Updated producer instruction',
      type: 'textarea',
      required: false,
    },
  ]);

  assert.deepEqual(
    configured.deliverables.map((item) => item.id),
    ['ad-confirmation', 'notes']
  );
  assert.equal(configured.deliverables[0].required, true);
  assert.equal(configured.deliverables[1].required, false);
  assert.equal(configured.deliverables[1].value, 'Host response');
});

test('manager required versus optional changes survive the manager merge', () => {
  const episode = sampleEpisode();
  const updated = mergeEpisodeStudioManagerValues(episode, {
    deliverables: episode.deliverables.map((deliverable, index) => ({
      ...deliverable,
      required: index !== 0,
    })),
  });

  assert.equal(updated.deliverables[0].required, false);
  assert.equal(updated.deliverables[1].required, true);
});

test('manager recording schedules are normalized and included in summaries', () => {
  const updated = mergeEpisodeStudioManagerValues(sampleEpisode(), {
    recording_date: '2026-08-01',
    recording_time: '10:30',
    recording_time_zone: 'America/Denver',
    recording_duration_minutes: 90,
    recording_location: 'Riverside room',
  });
  const summary = episodeStudioSummary(updated);

  assert.equal(updated.recording_date, '2026-08-01');
  assert.equal(updated.recording_time, '10:30');
  assert.equal(updated.recording_time_zone, 'America/Denver');
  assert.equal(updated.recording_duration_minutes, 90);
  assert.equal(updated.recording_location, 'Riverside room');
  assert.equal(summary.recording_date, '2026-08-01');
  assert.equal(summary.recording_time_zone, 'America/Denver');
});

test('manager saves and can intentionally clear producer review drafts', () => {
  const stagedEpisodeUrl =
    'https://creators.spotify.com/pod/show/mission-ridge/episodes/draft';
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    producer_feedback: 'Tighten the opening before the first sponsor read.',
  });
  const updated = mergeEpisodeStudioManagerValues(episode, {
    producer_feedback:
      'At 03:14, remove the repeated setup before the first answer.',
    staged_episode_url: stagedEpisodeUrl,
  });

  assert.equal(
    updated.producer_feedback,
    'At 03:14, remove the repeated setup before the first answer.'
  );
  assert.equal(updated.staged_episode_url, stagedEpisodeUrl);

  const cleared = mergeEpisodeStudioManagerValues(updated, {
    producer_feedback: '',
  });
  assert.equal(cleared.producer_feedback, '');
});

test('rejects incomplete recording schedules while preserving legacy episodes', () => {
  assert.doesNotThrow(() => validateEpisodeStudio(sampleEpisode()));
  assert.throws(
    () =>
      validateEpisodeStudio({
        ...sampleEpisode(),
        recording_date: '2026-08-01',
        recording_time: '10:30',
      }),
    /time zone/
  );
});

test('canonical asset requirements block readiness until audio and images are attached', () => {
  const base = {
    ...sampleEpisode(),
    canonical_assets_required: true,
    producer_directions: clearProducerBrief,
    deliverables: [],
  };
  const missing = getEpisodeCompletion(base);
  assert.deepEqual(
    missing.missing.map((item) => item.id),
    ['canonical-recording', 'canonical-images']
  );

  const ready = getEpisodeCompletion({
    ...base,
    assets: [
      {
        asset_id: 'asset-audio',
        object_key: 'episodes/episode-one/recording/audio.wav',
        file_name: 'audio.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'recording',
      },
      {
        asset_id: 'asset-image',
        object_key: 'episodes/episode-one/image/photo.jpg',
        file_name: 'photo.jpg',
        content_type: 'image/jpeg',
        size: 100,
        category: 'image',
      },
    ],
  });
  assert.equal(ready.host_ready, true);
});

test('viewer-safe uploaded files satisfy their checklist steps without exposing storage keys', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    producer_directions: clearProducerBrief,
    deliverables: [
      {
        id: 'raw-recording-tracks',
        label: 'Raw recording tracks',
        type: 'asset',
        required: true,
        asset_category: 'recording',
      },
      {
        id: 'introduction-and-sponsor-read',
        label: 'Introduction and sponsor read',
        type: 'asset',
        required: true,
        asset_category: 'sponsor_audio',
      },
      {
        id: 'photos-and-artwork',
        label: 'Photos and artwork',
        type: 'asset',
        required: true,
        asset_category: 'image',
      },
    ],
    assets: [
      {
        asset_id: 'asset-recording',
        object_key:
          'episodes/episode-one/recording/asset-recording-raw.wav',
        object_version_id: 'version-recording',
        file_name: 'raw.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'recording',
        deliverable_id: 'raw-recording-tracks',
      },
      {
        asset_id: 'asset-sponsor',
        object_key:
          'episodes/episode-one/sponsor_audio/asset-sponsor-intro.wav',
        object_version_id: 'version-sponsor',
        file_name: 'intro.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'sponsor_audio',
        deliverable_id: 'introduction-and-sponsor-read',
      },
      {
        asset_id: 'asset-image',
        object_key:
          'episodes/episode-one/image/asset-image-cover.jpg',
        object_version_id: 'version-image',
        file_name: 'cover.jpg',
        content_type: 'image/jpeg',
        size: 100,
        category: 'image',
        deliverable_id: 'photos-and-artwork',
      },
    ],
  });
  const viewerEpisode = sanitizeEpisodeStudioForViewer(episode);

  assert.equal(
    viewerEpisode.assets.every(
      (asset) =>
        asset.storage_verified === true &&
        !('object_key' in asset) &&
        !('object_version_id' in asset)
    ),
    true
  );
  const completion = getEpisodeCompletion(viewerEpisode);
  assert.equal(completion.required, 3);
  assert.equal(completion.completed, 3);
  assert.deepEqual(completion.missing, []);
  assert.equal(completion.can_submit, true);
});

test('episode assets carry a visible 180-day retention deadline', () => {
  const uploadedAt = '2026-07-25T12:00:00.000Z';
  const expiresAt = getEpisodeAssetRetentionExpiresAt(uploadedAt);
  assert.equal(EPISODE_ASSET_RETENTION_DAYS, 180);
  assert.equal(expiresAt, '2027-01-21T12:00:00.000Z');

  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    assets: [
      {
        asset_id: 'asset-retention',
        object_key: 'episodes/episode-one/document/notes.txt',
        file_name: 'notes.txt',
        content_type: 'text/plain',
        size: 100,
        category: 'document',
        object_version_id: 'version-123',
        uploaded_at: uploadedAt,
      },
    ],
  });
  const asset = episode.assets[0];
  assert.equal(asset.retention_days, 180);
  assert.equal(asset.retention_expires_at, expiresAt);
  assert.equal(asset.object_version_id, 'version-123');
  const viewerAsset = sanitizeEpisodeStudioForViewer(episode).assets[0];
  assert.equal('object_key' in viewerAsset, false);
  assert.equal('object_version_id' in viewerAsset, false);
  assert.equal(viewerAsset.storage_verified, true);
  assert.equal(
    isEpisodeAssetExpired(asset, '2027-01-21T11:59:59.000Z'),
    false
  );
  assert.equal(
    isEpisodeAssetExpired(asset, '2027-01-21T12:00:00.000Z'),
    true
  );
});

test('removing an asset also clears sponsor-read completion tied to that file', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    assets: [
      {
        asset_id: 'asset-sponsor',
        object_key:
          'episodes/episode-one/sponsor_audio/asset-sponsor-ad.wav',
        object_version_id: 'version-sponsor',
        file_name: 'ad.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'sponsor_audio',
      },
      {
        asset_id: 'asset-notes',
        object_key:
          'episodes/episode-one/document/asset-notes-notes.pdf',
        object_version_id: 'version-notes',
        file_name: 'notes.pdf',
        content_type: 'application/pdf',
        size: 100,
        category: 'document',
      },
    ],
    sponsor_read_assignments: [
      {
        assignment_id: 'assignment-one',
        sponsor_read_id: 'read-one',
        sponsor_id: 'sponsor-one',
        sponsor_name: 'Mountain Gear',
        script_title: 'Opening read',
        approved_text: 'Approved sponsor copy.',
        requires_audio: true,
        audio_asset_id: 'asset-sponsor',
        completed: true,
        completed_at: '2026-07-25T12:00:00.000Z',
        completed_by_person_id: 'host-one',
        completed_by_name: 'Host One',
      },
    ],
  });

  const updated = removeEpisodeAssetFromEpisode(
    episode,
    'asset-sponsor'
  );

  assert.deepEqual(
    updated.assets.map((asset) => asset.asset_id),
    ['asset-notes']
  );
  assert.equal(updated.sponsor_read_assignments[0].audio_asset_id, '');
  assert.equal(updated.sponsor_read_assignments[0].completed, false);
  assert.equal(updated.sponsor_read_assignments[0].completed_at, '');
  assert.equal(
    updated.sponsor_read_assignments[0].completed_by_person_id,
    ''
  );
});

test('legacy link-based episode steps migrate to step-owned uploads without losing links', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    deliverables: [
      {
        id: 'episode-folder',
        label: 'Episode Drive folder',
        description: 'Old instructions',
        type: 'url',
        required: false,
        value: 'https://drive.google.com/example',
        sort_order: 30,
      },
      {
        id: 'recording-files',
        label: 'Recording files',
        description: 'Old recording instructions',
        type: 'url',
        required: false,
        value: 'https://riverside.fm/studio/example',
        sort_order: 40,
      },
    ],
    assets: [
      {
        asset_id: 'legacy-recording',
        object_key: 'episodes/episode-one/recording/voice.wav',
        file_name: 'voice.wav',
        content_type: 'audio/wav',
        size: 400,
        category: 'recording',
      },
    ],
  });

  assert.equal(episode.schema_version, 3);
  assert.equal(
    episode.deliverables[0].label,
    'Previous general source files'
  );
  assert.equal(episode.deliverables[0].type, 'asset');
  assert.equal(episode.deliverables[0].asset_category, 'other');
  assert.equal(
    episode.deliverables[0].legacy_source_url,
    'https://drive.google.com/example'
  );
  assert.equal(episode.deliverables[1].label, 'Raw recording tracks');
  assert.equal(episode.deliverables[1].type, 'asset');
  assert.equal(
    episode.deliverables[1].legacy_source_url,
    'https://riverside.fm/studio/example'
  );
  assert.equal(
    episode.assets[0].deliverable_id,
    'recording-files'
  );
});

test('keeps the canonical Episode Source Files step on the mixed safe-file policy', () => {
  for (const assetCategory of ['document', 'image', 'recording']) {
    const episode = normalizeEpisodeStudio({
      ...sampleEpisode(),
      schema_version: 2,
      deliverables: [
        {
          id: 'episode-folder',
          label: 'Episode source files',
          description: 'Mixed source material',
          type: 'asset',
          asset_category: assetCategory,
          required: false,
          sort_order: 10,
        },
      ],
    });
    assert.equal(episode.deliverables[0].asset_category, 'other');
  }
});

test('guest details require labeled social profiles and asset steps complete only from their own files', () => {
  const guest = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 2,
    deliverables: [
      {
        id: 'guest-details',
        label: 'Guest details',
        description: 'Guest information',
        type: 'textarea',
        required: true,
        value: 'Jordan Lee, avalanche educator and guide.',
      },
    ],
  }).deliverables[0];
  assert.equal(isDeliverableComplete(guest), false);
  assert.equal(
    isDeliverableComplete({
      ...guest,
      social_profiles: 'Instagram: @jordanlee',
    }),
    true
  );

  const recordingStep = {
    id: 'recording-files',
    type: 'asset',
  };
  const wrongStepAsset = {
    asset_id: 'asset-wrong-step',
    deliverable_id: 'photos',
    status: 'uploaded',
  };
  const matchingAsset = {
    ...wrongStepAsset,
    asset_id: 'asset-matching-step',
    deliverable_id: 'recording-files',
  };
  assert.equal(isDeliverableComplete(recordingStep, [wrongStepAsset]), false);
  assert.equal(isDeliverableComplete(recordingStep, [matchingAsset]), true);
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
    assets: [],
  };
  const merged = mergeEpisodeStudioServerFields(
    dirtyEpisode,
    {
      title: 'Persisted title',
      updated_at: 'after',
      messages: [{ message_id: 'message-1', body: 'A new decision' }],
      assets: [{ asset_id: 'asset-1', file_name: 'interview.wav' }],
    },
    ['messages', 'assets', 'updated_at']
  );

  assert.equal(merged.title, 'Unsaved working title');
  assert.equal(merged.updated_at, 'after');
  assert.equal(merged.messages[0].body, 'A new decision');
  assert.equal(merged.assets[0].file_name, 'interview.wav');
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
