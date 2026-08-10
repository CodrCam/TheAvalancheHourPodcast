import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultEpisodeProductionTasks } from '../lib/episodeProductionPlan.mjs';
import {
  areProducerDirectionsComplete,
  configureEpisodeDeliverables,
  createDefaultEpisodeDeliverables,
  createEmptyGuestProfile,
  EPISODE_ASSET_RETENTION_DAYS,
  EPISODE_STUDIO_SCHEMA_VERSION,
  episodeStudioSummary,
  getEpisodeAssetRetentionExpiresAt,
  getEpisodeCompletion,
  getGuestProfileFieldErrors,
  getEpisodeStudioMembership,
  isEpisodeAssetExpired,
  isDeliverableComplete,
  isGuestProfileValid,
  isValidGuestContactEmail,
  isValidGuestHttpsUrl,
  isValidGuestProfileEntry,
  isValidGuestSocialHandle,
  MAX_EPISODE_DELIVERABLES,
  mergeEpisodeStudioManagerValues,
  mergeEpisodeStudioServerFields,
  mergeHostDeliverableValues,
  normalizeEpisodeStudio,
  normalizeGuestProfile,
  PRODUCER_DIRECTIONS_MIN_LENGTH,
  REQUIRED_EPISODE_DELIVERABLE_IDS,
  removeEpisodeAssetFromEpisode,
  sanitizeEpisodeStudioForViewer,
  upcomingEpisodeCalendarEntries,
  validateEpisodeStudio,
} from '../lib/episodeStudioPresentation.mjs';

const clearProducerBrief =
  'Use mission-ridge_interview_jordan_raw.wav for the final cut. Make mission-ridge_photo-01_jordan-ridgeline.jpg the cover image.';

function resolvedMicPlan(hostPersonId = 'dom-baker') {
  const deliverable = createDefaultEpisodeDeliverables().find(
    (item) => item.id === 'mic-kit-plan'
  );
  return {
    ...deliverable,
    mic_kit_plans: [
      {
        host_person_id: hostPersonId,
        choice: 'no_kit_needed',
      },
    ],
  };
}

function sampleEpisode() {
  return {
    episode_id: 'episode-one',
    title: 'Episode One',
    target_release_date: '2026-10-15',
    host_person_ids: ['dom-baker'],
    deliverables: [
      ...createDefaultEpisodeDeliverables().slice(0, 2),
      resolvedMicPlan(),
    ],
  };
}

test('does not allow submission until every required deliverable is complete', () => {
  const empty = getEpisodeCompletion({
    ...sampleEpisode(),
    deliverables: createDefaultEpisodeDeliverables().slice(0, 3),
  });
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
      resolvedMicPlan(),
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
          resolvedMicPlan(),
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
    ...(deliverable.id === 'guest-details'
      ? {
          social_profiles: 'Earlier profile notes remain preserved.',
          guest_profile: {
            name: 'Jordan Lee',
            title_affiliation: 'Avalanche educator',
            contact_email: 'jordan@example.com',
            short_bio: 'Jordan teaches backcountry travelers.',
            website: 'https://example.com',
          },
        }
      : {}),
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
    ['ad-confirmation', 'notes', 'guest-details', 'mic-kit-plan', 'photos']
  );
  assert.equal(configured.deliverables[0].required, true);
  const notes = configured.deliverables.find((item) => item.id === 'notes');
  assert.equal(notes.required, false);
  assert.equal(notes.value, 'Host response');
});

test('checklist configuration preserves every item at the cap and rejects overflow', () => {
  const defaults = createDefaultEpisodeDeliverables();
  const required = REQUIRED_EPISODE_DELIVERABLE_IDS.map((id) =>
    defaults.find((deliverable) => deliverable.id === id)
  );
  const configuration = [
    ...required,
    ...Array.from(
      { length: MAX_EPISODE_DELIVERABLES - required.length },
      (_, index) => ({
        id: `custom-cap-${index + 1}`,
        label: `Custom cap ${index + 1}`,
        description: 'Preserve this checklist item.',
        type: 'textarea',
        required: false,
      })
    ),
  ];
  const configured = configureEpisodeDeliverables(
    sampleEpisode(),
    configuration
  );

  assert.equal(
    configured.deliverables.length,
    MAX_EPISODE_DELIVERABLES
  );
  assert.equal(
    configured.deliverables.some(
      (item) => item.id === `custom-cap-${MAX_EPISODE_DELIVERABLES - 3}`
    ),
    true
  );
  assert.throws(
    () =>
      configureEpisodeDeliverables(sampleEpisode(), [
        ...configuration,
        {
          id: 'one-too-many',
          label: 'One too many',
          type: 'textarea',
        },
      ]),
    /at most 40 items/i
  );
  assert.throws(
    () =>
      configureEpisodeDeliverables(
        sampleEpisode(),
        Array.from({ length: MAX_EPISODE_DELIVERABLES }, (_, index) => ({
          id: `custom-only-${index + 1}`,
          label: `Custom only ${index + 1}`,
          type: 'textarea',
        }))
      ),
    /keep the built-in guest details/i
  );
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

test('projects a minimal read-only calendar without Episode Studio access data', () => {
  const entries = upcomingEpisodeCalendarEntries(
    [
      {
        ...sampleEpisode(),
        episode_id: 'later-zulu-private-id',
        title: 'Zulu later episode',
        season: 'Season 12',
        target_release_date: '2026-10-20',
        producer_email: 'private@example.com',
        recording_location: 'Private room',
      },
      {
        ...sampleEpisode(),
        episode_id: 'later-alpha-private-id',
        title: 'Alpha later episode',
        season: 'Season 12',
        target_release_date: '2026-10-20',
      },
      {
        ...sampleEpisode(),
        episode_id: 'today-private-id',
        title: 'Today episode',
        target_release_date: '2026-10-01',
      },
      {
        ...sampleEpisode(),
        episode_id: 'past-episode',
        target_release_date: '2026-09-30',
      },
      {
        ...sampleEpisode(),
        episode_id: 'deleted-episode',
        target_release_date: '2026-10-12',
        deleted_at: '2026-10-01T12:00:00.000Z',
      },
      {
        ...sampleEpisode(),
        episode_id: 'archived-episode',
        target_release_date: '2026-10-13',
        archived: true,
      },
      {
        ...sampleEpisode(),
        episode_id: 'finalized-episode',
        target_release_date: '2026-10-14',
        deletion_finalized_at: '2026-10-01T13:00:00.000Z',
      },
    ],
    { today: '2026-10-01' }
  );

  assert.deepEqual(entries, [
    {
      title: 'Today episode',
      season: '',
      target_release_date: '2026-10-01',
    },
    {
      title: 'Alpha later episode',
      season: 'Season 12',
      target_release_date: '2026-10-20',
    },
    {
      title: 'Zulu later episode',
      season: 'Season 12',
      target_release_date: '2026-10-20',
    },
  ]);
  assert.deepEqual(Object.keys(entries[0]), [
    'title',
    'season',
    'target_release_date',
  ]);
});

test('moving the air date preserves completed and manager-overridden task deadlines', () => {
  const tasks = createDefaultEpisodeProductionTasks('2026-09-01');
  tasks[0] = {
    ...tasks[0],
    status: 'complete',
    completed_at: '2026-08-04T12:00:00.000Z',
    completed_by_person_id: 'dom-baker',
    completed_by_name: 'Dom Baker',
  };
  tasks[1] = {
    ...tasks[1],
    due_date: '2026-08-08',
    due_date_overridden: true,
  };
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    target_release_date: '2026-09-01',
    production_tasks: tasks,
  });

  const updated = mergeEpisodeStudioManagerValues(episode, {
    target_release_date: '2026-09-08',
  });

  assert.equal(updated.production_tasks[0].due_date, '2026-07-28');
  assert.equal(updated.production_tasks[1].due_date, '2026-08-08');
  assert.equal(updated.production_tasks[2].due_date, '2026-08-11');
});

test('moves the former seven-day host deadline to ten days without changing custom dates', () => {
  const migrated = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    due_date: '2026-10-08',
  });
  const customized = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    due_date: '2026-10-06',
  });
  const current = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 8,
    due_date: '2026-10-08',
  });
  const submitted = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    status: 'submitted',
    due_date: '2026-10-08',
  });

  assert.equal(migrated.due_date, '2026-10-05');
  assert.equal(customized.due_date, '2026-10-06');
  assert.equal(current.due_date, '2026-10-08');
  assert.equal(submitted.due_date, '2026-10-05');
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
    deliverables: [resolvedMicPlan()],
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
      resolvedMicPlan(),
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
  assert.equal(completion.required, 4);
  assert.equal(completion.completed, 4);
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

test('removing the selected intro recording reopens the intro task', () => {
  const completedAt = '2026-08-10T12:00:00.000Z';
  const productionTasks = createDefaultEpisodeProductionTasks(
    '2026-08-19'
  ).map((task) =>
    task.task_id === 'intro-ready'
      ? {
          ...task,
          status: 'complete',
          intro_method: 'recorded',
          evidence_asset_id: 'intro-current',
          completed_at: completedAt,
          completed_by_person_id: 'host-one',
          completed_by_name: 'Host One',
        }
      : task
  );
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    production_tasks: productionTasks,
    assets: [
      {
        asset_id: 'intro-current',
        object_key:
          'episodes/episode-one/recording/intro-current-intro.wav',
        object_version_id: 'version-intro',
        file_name: 'intro.wav',
        content_type: 'audio/wav',
        size: 100,
        category: 'recording',
        deliverable_id: 'recording-files',
      },
    ],
  });

  const updated = removeEpisodeAssetFromEpisode(
    episode,
    'intro-current'
  );
  const intro = updated.production_tasks.find(
    (task) => task.task_id === 'intro-ready'
  );

  assert.equal(intro.status, 'in_progress');
  assert.equal(intro.evidence_asset_id, '');
  assert.equal(intro.completed_at, '');
  assert.equal(intro.completed_by_person_id, '');
});

test('removing the current proof reopens its approval and downstream publishing work', () => {
  const completedAt = '2026-08-10T12:00:00.000Z';
  const productionTasks = createDefaultEpisodeProductionTasks(
    '2026-08-19'
  ).map((task) => {
    if (task.task_id === 'producer-proof-upload') {
      return {
        ...task,
        status: 'complete',
        evidence_asset_id: 'proof-current',
        completed_at: completedAt,
        completed_by_person_id: 'angie-link',
        completed_by_name: 'Angie Lake',
      };
    }
    if (task.task_id === 'proof-listen-approval') {
      return {
        ...task,
        status: 'complete',
        proof_decision: 'approved',
        evidence_asset_id: 'proof-current',
        completed_at: completedAt,
        completed_by_person_id: 'dom-baker',
        completed_by_name: 'Dom Baker',
      };
    }
    if (task.task_id === 'publishing-package') {
      return {
        ...task,
        status: 'complete',
        completed_at: completedAt,
        completed_by_person_id: 'sierra-bishop',
        completed_by_name: 'Sierra Bishop',
        subtasks: task.subtasks.map((subtask) => ({
          ...subtask,
          completed: true,
          completed_at: completedAt,
          completed_by_person_id: 'sierra-bishop',
          completed_by_name: 'Sierra Bishop',
        })),
      };
    }
    return task;
  });
  const proofAsset = (assetId, uploadedAt) => ({
    asset_id: assetId,
    object_key: `episodes/episode-one/recording/${assetId}.wav`,
    object_version_id: `version-${assetId}`,
    file_name: `${assetId}.wav`,
    content_type: 'audio/wav',
    size: 100,
    category: 'recording',
    deliverable_id: 'producer-proof-audio',
    uploaded_at: uploadedAt,
    retention_expires_at: '2027-02-01T00:00:00.000Z',
    status: 'uploaded',
  });
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    target_release_date: '2026-08-19',
    deliverables: createDefaultEpisodeDeliverables(),
    production_tasks: productionTasks,
    assets: [
      proofAsset('proof-older', '2026-08-09T12:00:00.000Z'),
      proofAsset('proof-current', completedAt),
    ],
  });

  const updated = removeEpisodeAssetFromEpisode(episode, 'proof-current');
  const task = (taskId) =>
    updated.production_tasks.find((item) => item.task_id === taskId);

  assert.deepEqual(
    updated.assets.map((asset) => asset.asset_id),
    ['proof-older']
  );
  assert.equal(task('producer-proof-upload').status, 'in_progress');
  assert.equal(task('producer-proof-upload').evidence_asset_id, '');
  assert.equal(task('proof-listen-approval').status, 'in_progress');
  assert.equal(task('proof-listen-approval').proof_decision, 'pending');
  assert.equal(task('publishing-package').status, 'in_progress');
  assert.equal(
    task('publishing-package').subtasks.every(
      (subtask) => subtask.completed === false
    ),
    true
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

  assert.equal(episode.schema_version, EPISODE_STUDIO_SCHEMA_VERSION);
  const legacyFolder = episode.deliverables.find(
    (deliverable) => deliverable.id === 'episode-folder'
  );
  const legacyRecording = episode.deliverables.find(
    (deliverable) => deliverable.id === 'recording-files'
  );
  assert.equal(
    legacyFolder.label,
    'Previous general source files'
  );
  assert.equal(legacyFolder.type, 'asset');
  assert.equal(legacyFolder.asset_category, 'other');
  assert.equal(
    legacyFolder.legacy_source_url,
    'https://drive.google.com/example'
  );
  assert.equal(legacyRecording.label, 'Raw recording tracks');
  assert.equal(legacyRecording.type, 'asset');
  assert.equal(
    legacyRecording.legacy_source_url,
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

test('keeps the default Episode Studio checklist role-based', () => {
  const defaults = createDefaultEpisodeDeliverables();
  assert.doesNotMatch(
    JSON.stringify(defaults),
    /\b(?:Angie|Sierra|Caleb|Cameron|Cam)\b/
  );
  assert.equal(
    defaults.filter((deliverable) => deliverable.section !== 'producer_proof')
      .length,
    9
  );
  assert.equal(
    defaults.some((deliverable) => deliverable.id === 'social-copy'),
    false
  );
  assert.match(
    defaults.find((deliverable) => deliverable.id === 'show-notes')
      .description,
    /one clear source brief/i
  );
  assert.match(
    defaults.find((deliverable) => deliverable.id === 'photos').description,
    /promotion image source material/i
  );
});

test('folds the retired promotion source step into the show-notes brief', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 9,
    deliverables: [
      {
        id: 'show-notes',
        label: 'Show-notes and promotion brief',
        description:
          'Give the producer and publishing owner the episode summary, key takeaways, guest biography, public links and handles, credits, title ideas, and anything that should not be published. The publishing owner drafts the final public copy.',
        type: 'textarea',
        required: true,
        value: 'Episode summary and guest biography.',
        sort_order: 60,
      },
      {
        id: 'intro-audio',
        label: 'Recorded introduction',
        type: 'asset',
        required: false,
        sort_order: 70,
      },
      {
        id: 'social-copy',
        label: 'Promotion source material',
        type: 'textarea',
        required: true,
        value: 'Use @guest and do not tag their employer.',
        missing_acknowledged: true,
        missing_note: 'Excerpt timestamp is still coming.',
        expected_by: '2026-10-01',
        sort_order: 80,
      },
      {
        id: 'photos',
        label: 'Photos and artwork',
        type: 'asset',
        required: true,
        sort_order: 90,
      },
    ],
    assets: [
      {
        asset_id: 'promotion-notes',
        object_key: 'episodes/episode-one/document/promotion-notes.txt',
        file_name: 'promotion-notes.txt',
        content_type: 'text/plain',
        size: 100,
        category: 'document',
        deliverable_id: 'social-copy',
      },
      {
        asset_id: 'promotion-artwork',
        object_key: 'episodes/episode-one/image/promotion-artwork.jpg',
        file_name: 'promotion-artwork.jpg',
        content_type: 'image/jpeg',
        size: 100,
        category: 'image',
        deliverable_id: 'social-copy',
      },
    ],
  });

  const ids = episode.deliverables.map((deliverable) => deliverable.id);
  const showNotes = episode.deliverables.find(
    (deliverable) => deliverable.id === 'show-notes'
  );
  assert.equal(ids.includes('social-copy'), false);
  assert.ok(ids.indexOf('show-notes') < ids.indexOf('intro-audio'));
  assert.ok(ids.indexOf('intro-audio') < ids.indexOf('photos'));
  assert.match(showNotes.value, /Episode summary and guest biography/);
  assert.match(showNotes.value, /Additional promotion source material/);
  assert.match(showNotes.value, /do not tag their employer/);
  assert.equal(showNotes.missing_acknowledged, true);
  assert.match(showNotes.missing_note, /Excerpt timestamp is still coming/);
  assert.equal(showNotes.expected_by, '2026-10-01');
  assert.match(showNotes.description, /one clear source brief/i);
  assert.equal(episode.assets[0].deliverable_id, 'show-notes');
  assert.equal(episode.assets[1].deliverable_id, 'photos');
});

test('updates exact legacy built-in instructions without rewriting custom copy', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 8,
    deliverables: [
      {
        id: 'intro-audio',
        label: 'Record with Angie',
        description: 'Send the script to Angie, then give Sierra the assets.',
        type: 'asset',
        required: false,
      },
      {
        id: 'show-notes',
        label: 'Confirm Angie interview references for this episode',
        description:
          'Keep this custom Sierra interview note exactly as the Studio manager wrote it.',
        type: 'textarea',
        required: false,
      },
      {
        id: 'custom-guest-note',
        label: 'Confirm Angie guest note',
        description: 'A custom episode-specific instruction.',
        type: 'textarea',
        required: false,
      },
    ],
  });
  const intro = episode.deliverables.find(
    (deliverable) => deliverable.id === 'intro-audio'
  );
  const custom = episode.deliverables.find(
    (deliverable) => deliverable.id === 'custom-guest-note'
  );
  const customizedBuiltIn = episode.deliverables.find(
    (deliverable) => deliverable.id === 'show-notes'
  );

  assert.equal(intro.label, 'Record with the assigned producer');
  assert.equal(
    intro.description,
    'Send the script to the assigned producer, then give the publishing owner the assets.'
  );
  assert.equal(custom.label, 'Confirm Angie guest note');
  assert.equal(
    customizedBuiltIn.label,
    'Confirm Angie interview references for this episode'
  );
  assert.equal(
    customizedBuiltIn.description,
    'Keep this custom Sierra interview note exactly as the Studio manager wrote it.'
  );
});

test('adds the questionnaire and microphone dependencies to every Episode Studio', () => {
  const defaultMicPlan = createDefaultEpisodeDeliverables().find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  assert.ok(defaultMicPlan);
  assert.equal(defaultMicPlan.required, true);
  assert.deepEqual(defaultMicPlan.mic_kit_plans, []);
  const normalizedNewEpisodeMicPlan = normalizeEpisodeStudio({
    ...sampleEpisode(),
    deliverables: createDefaultEpisodeDeliverables(),
  }).deliverables.find((deliverable) => deliverable.id === 'mic-kit-plan');
  assert.equal(normalizedNewEpisodeMicPlan.required, true);

  const migrated = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 5,
    status: 'submitted',
    deliverables: [
      {
        id: 'notes',
        label: 'Legacy required notes',
        type: 'textarea',
        required: true,
        value: 'Complete legacy package',
      },
    ],
  });
  const migratedMicPlan = migrated.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  const migratedGuestDetails = migrated.deliverables.find(
    (deliverable) => deliverable.id === 'guest-details'
  );
  const migratedPhotos = migrated.deliverables.find(
    (deliverable) => deliverable.id === 'photos'
  );
  assert.equal(migrated.schema_version, EPISODE_STUDIO_SCHEMA_VERSION);
  assert.equal(migratedMicPlan.required, true);
  assert.equal(migratedGuestDetails.type, 'textarea');
  assert.equal(migratedGuestDetails.asset_category, 'document');
  assert.equal(migratedGuestDetails.required, false);
  assert.equal(migratedPhotos.type, 'asset');
  assert.equal(migratedPhotos.asset_category, 'image');
  assert.equal(migratedPhotos.required, false);
  const migratedCompletion = getEpisodeCompletion(migrated);
  assert.equal(migratedCompletion.can_submit, false);
  assert.equal(
    migratedCompletion.missing.some((item) => item.id === 'mic-kit-plan'),
    true
  );

  const currentSchemaMissingPlan = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    deliverables: [
      {
        id: 'notes',
        label: 'Current notes',
        type: 'textarea',
        required: false,
        value: '',
      },
    ],
  }).deliverables.find((deliverable) => deliverable.id === 'mic-kit-plan');
  assert.equal(currentSchemaMissingPlan.required, true);
});

test('keeps questionnaire dependencies when a legacy checklist reaches its limit', () => {
  const normalized = normalizeEpisodeStudio({
    ...sampleEpisode(),
    deliverables: Array.from({ length: 40 }, (_, index) => ({
      id: `legacy-custom-${index + 1}`,
      label: `Legacy custom ${index + 1}`,
      type: 'textarea',
      required: false,
      sort_order: (index + 1) * 10,
    })),
  });
  const ids = new Set(normalized.deliverables.map((item) => item.id));

  assert.equal(normalized.deliverables.length, 40);
  assert.equal(ids.has('guest-details'), true);
  assert.equal(ids.has('mic-kit-plan'), true);
  assert.equal(ids.has('photos'), true);
});

test('requires every assigned host to resolve a required microphone plan', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    host_person_ids: ['host-one', 'host-two'],
    deliverables: [
      {
        id: 'mic-kit-plan',
        label: 'Microphone plan',
        type: 'textarea',
        required: true,
        mic_kit_plans: [
          {
            host_person_id: 'host-one',
            choice: 'request_kit',
            request_id: 'request-one',
          },
        ],
      },
    ],
  });
  const micPlan = episode.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );

  assert.equal(
    isDeliverableComplete(micPlan, [], episode.host_person_ids),
    false
  );
  assert.equal(getEpisodeCompletion(episode).can_submit, false);

  const completedEpisode = normalizeEpisodeStudio({
    ...episode,
    deliverables: episode.deliverables.map((deliverable) =>
      deliverable.id === 'mic-kit-plan'
        ? {
            ...deliverable,
            mic_kit_plans: [
              ...deliverable.mic_kit_plans,
              {
                host_person_id: 'host-two',
                choice: 'use_own_equipment',
                equipment_note: 'Shure MV7 and wired headphones',
              },
            ],
          }
        : deliverable
    ),
  });
  const completedMicPlan = completedEpisode.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  assert.equal(
    isDeliverableComplete(
      completedMicPlan,
      [],
      completedEpisode.host_person_ids
    ),
    true
  );
  assert.equal(getEpisodeCompletion(completedEpisode).can_submit, true);

  const liveUnresolved = getEpisodeCompletion(completedEpisode, {
    deliverableCompletion: { 'mic-kit-plan': false },
  });
  assert.equal(liveUnresolved.can_submit, false);
  assert.equal(
    liveUnresolved.missing.some((item) => item.id === 'mic-kit-plan'),
    true
  );

  const liveResolved = getEpisodeCompletion(episode, {
    deliverableCompletion: { 'mic-kit-plan': true },
  });
  assert.equal(liveResolved.can_submit, true);
  assert.equal(
    liveResolved.missing.some((item) => item.id === 'mic-kit-plan'),
    false
  );
});

test('requires a connected guest microphone plan while leaving legacy episodes unchanged', () => {
  const hostPlan = {
    host_person_id: 'host-one',
    choice: 'no_kit_needed',
  };
  const legacyEpisode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    host_person_ids: ['host-one'],
    deliverables: [
      {
        id: 'mic-kit-plan',
        label: 'Microphone plan',
        type: 'textarea',
        required: true,
        mic_kit_plans: [hostPlan],
      },
    ],
  });
  const legacyPlan = legacyEpisode.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  assert.equal(
    isDeliverableComplete(legacyPlan, [], legacyEpisode.host_person_ids),
    true
  );

  const needsFollowUp = normalizeEpisodeStudio({
    ...legacyEpisode,
    deliverables: legacyEpisode.deliverables.map((deliverable) =>
      deliverable.id === 'mic-kit-plan'
        ? {
            ...deliverable,
            guest_mic_kit_plan: {
              guest_name: 'Alex Guest',
              choice: 'needs_follow_up',
              response_revision: 1,
              readiness: {
                internet: 'yes',
                microphone: 'not_sure',
                headphones: 'yes',
                quiet_place: 'yes',
              },
              private_shipping: 'must not survive',
            },
          }
        : deliverable
    ),
  });
  const followUpPlan = needsFollowUp.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  assert.equal(
    isDeliverableComplete(
      followUpPlan,
      [],
      needsFollowUp.host_person_ids
    ),
    false
  );
  assert.equal(getEpisodeCompletion(needsFollowUp).can_submit, false);
  assert.deepEqual(followUpPlan.guest_mic_kit_plan, {
    guest_name: 'Alex Guest',
    choice: 'needs_follow_up',
    request_id: '',
    equipment_note: '',
    response_revision: 1,
    readiness: {
      internet: 'yes',
      microphone: 'not_sure',
      headphones: 'yes',
      quiet_place: 'yes',
    },
  });

  const guestReady = normalizeEpisodeStudio({
    ...needsFollowUp,
    deliverables: needsFollowUp.deliverables.map((deliverable) =>
      deliverable.id === 'mic-kit-plan'
        ? {
            ...deliverable,
            guest_mic_kit_plan: {
              ...deliverable.guest_mic_kit_plan,
              choice: 'use_own_equipment',
              equipment_note:
                'Guest confirmed a dedicated microphone and wired headphones.',
            },
          }
        : deliverable
    ),
  });
  const readyPlan = guestReady.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );
  assert.equal(
    isDeliverableComplete(readyPlan, [], guestReady.host_person_ids),
    true
  );
  assert.equal(getEpisodeCompletion(guestReady).can_submit, true);
});

test('generic host saves cannot forge another host microphone plan', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 6,
    host_person_ids: ['host-one', 'host-two'],
    deliverables: [
      {
        id: 'mic-kit-plan',
        label: 'Microphone plan',
        type: 'textarea',
        required: true,
        mic_kit_plans: [
          {
            host_person_id: 'host-one',
            choice: 'no_kit_needed',
          },
        ],
        guest_mic_kit_plan: {
          guest_name: 'Alex Guest',
          choice: 'needs_follow_up',
          response_revision: 1,
          readiness: { microphone: 'not_sure' },
        },
      },
    ],
  });
  const updated = mergeHostDeliverableValues(episode, [
    {
      id: 'mic-kit-plan',
      mic_kit_plans: [
        {
          host_person_id: 'host-two',
          choice: 'no_kit_needed',
        },
      ],
      guest_mic_kit_plan: {
        guest_name: 'Forged Guest',
        choice: 'use_own_equipment',
        equipment_note: 'Forged ready plan',
      },
      required: false,
    },
  ]);
  const micPlan = updated.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );

  assert.equal(micPlan.required, true);
  assert.deepEqual(micPlan.mic_kit_plans, [
    {
      host_person_id: 'host-one',
      choice: 'no_kit_needed',
      request_id: '',
      equipment_note: '',
    },
  ]);
  assert.equal(micPlan.guest_mic_kit_plan.guest_name, 'Alex Guest');
  assert.equal(micPlan.guest_mic_kit_plan.choice, 'needs_follow_up');
});

test('checklist configuration cannot remove or erase the microphone plan', () => {
  const episode = normalizeEpisodeStudio({
    ...sampleEpisode(),
    schema_version: 5,
    host_person_ids: ['host-one'],
    deliverables: [
      {
        id: 'mic-kit-plan',
        label: 'Microphone plan',
        type: 'textarea',
        required: false,
        mic_kit_plans: [
          {
            host_person_id: 'host-one',
            choice: 'use_own_equipment',
            equipment_note: 'Shure MV7 and wired headphones',
          },
        ],
        guest_mic_kit_plan: {
          guest_name: 'Alex Guest',
          choice: 'request_kit',
          request_id: 'guest-request-one',
          response_revision: 1,
          readiness: { microphone: 'no', headphones: 'no' },
        },
      },
      {
        id: 'notes',
        label: 'Notes',
        type: 'textarea',
        required: false,
      },
    ],
  });
  const configured = configureEpisodeDeliverables(episode, [
    {
      id: 'notes',
      label: 'Updated notes',
      type: 'textarea',
      required: false,
    },
  ]);
  const micPlan = configured.deliverables.find(
    (deliverable) => deliverable.id === 'mic-kit-plan'
  );

  assert.ok(micPlan);
  assert.equal(micPlan.required, true);
  assert.equal(
    micPlan.mic_kit_plans[0].equipment_note,
    'Shure MV7 and wired headphones'
  );
  assert.equal(micPlan.guest_mic_kit_plan.guest_name, 'Alex Guest');
  assert.equal(
    micPlan.guest_mic_kit_plan.request_id,
    'guest-request-one'
  );
});

test('creates a structured guest profile only for the guest-details deliverable', () => {
  const deliverables = createDefaultEpisodeDeliverables();
  const guest = deliverables.find((item) => item.id === 'guest-details');
  const pitch = deliverables.find((item) => item.id === 'episode-pitch');

  assert.deepEqual(guest.guest_profile, createEmptyGuestProfile());
  assert.equal(
    Object.prototype.hasOwnProperty.call(pitch, 'guest_profile'),
    false
  );
});

test('normalizes guest profile fields, limits their size, and strips unknown nested data', () => {
  const guestProfile = normalizeGuestProfile({
    name: '  Jordan Lee  ',
    title_affiliation: '  Avalanche educator · Mission Ridge  ',
    contact_email: '  Jordan@Example.com  ',
    contact_phone: '  +1 555 0100  ',
    short_bio: `  ${'b'.repeat(4100)}  `,
    website: '  https://example.com  ',
    instagram: '  @jordanlee  ',
    facebook: '  https://facebook.com/jordanlee  ',
    linkedin: '  https://linkedin.com/in/jordanlee  ',
    x_twitter: '  @jordan_on_snow  ',
    youtube: '  https://youtube.com/@jordanlee  ',
    tiktok: '  @jordanlee  ',
    other: `  ${'o'.repeat(2100)}  `,
    no_public_profiles: 'true',
    private_password: 'must not survive normalization',
  });

  assert.equal(guestProfile.name, 'Jordan Lee');
  assert.equal(
    guestProfile.title_affiliation,
    'Avalanche educator · Mission Ridge'
  );
  assert.equal(guestProfile.contact_email, 'Jordan@Example.com');
  assert.equal(guestProfile.contact_phone, '+1 555 0100');
  assert.equal(guestProfile.short_bio.length, 4000);
  assert.equal(guestProfile.website, 'https://example.com');
  assert.equal(guestProfile.instagram, '@jordanlee');
  assert.equal(guestProfile.other.length, 2000);
  assert.equal(guestProfile.no_public_profiles, false);
  assert.equal(
    Object.prototype.hasOwnProperty.call(guestProfile, 'private_password'),
    false
  );

  const normalized = normalizeEpisodeStudio({
    ...sampleEpisode(),
    deliverables: [
      {
        id: 'episode-pitch',
        label: 'Episode pitch',
        type: 'textarea',
        value: '',
        guest_profile: { name: 'Injected guest' },
      },
    ],
  }).deliverables[0];
  assert.equal(
    Object.prototype.hasOwnProperty.call(normalized, 'guest_profile'),
    false
  );
});

test('validates guest email, HTTPS links, and platform handles consistently', () => {
  assert.equal(isValidGuestContactEmail(''), true);
  assert.equal(isValidGuestContactEmail('jordan@example.com'), true);
  assert.equal(isValidGuestContactEmail('jordan at example.com'), false);

  assert.equal(isValidGuestHttpsUrl('https://example.com/profile'), true);
  assert.equal(isValidGuestHttpsUrl('HTTPS://example.com/profile'), true);
  assert.equal(isValidGuestHttpsUrl('http://example.com/profile'), false);
  assert.equal(isValidGuestHttpsUrl('javascript:alert(1)'), false);
  assert.equal(
    isValidGuestHttpsUrl('https://username:password@example.com'),
    false
  );

  assert.equal(isValidGuestSocialHandle('@jordan_on_snow'), true);
  assert.equal(isValidGuestSocialHandle('@jordan-on-snow'), true);
  assert.equal(isValidGuestSocialHandle('jordan on snow'), false);
  assert.equal(isValidGuestProfileEntry('instagram', '@jordan'), true);
  assert.equal(
    isValidGuestProfileEntry('instagram', 'https://instagram.com/jordan'),
    true
  );
  assert.equal(isValidGuestProfileEntry('instagram', 'http://instagram.com'), false);
  assert.equal(isValidGuestProfileEntry('facebook', '@jordan'), true);
  assert.equal(
    isValidGuestProfileEntry('facebook', 'https://facebook.com/jordan'),
    true
  );
  assert.equal(isValidGuestProfileEntry('other', 'Bluesky: jordan'), false);
});

test('reports the same structured guest field errors used for completion', () => {
  const malformedProfile = {
    name: 'Jordan Lee',
    title_affiliation: 'Avalanche educator',
    contact_email: 'not-an-email',
    contact_phone: '+1 555 0100',
    short_bio: 'Jordan teaches backcountry travelers.',
    website: 'http://example.com',
    instagram: 'jordan with spaces',
    linkedin: '@jordan',
  };
  assert.deepEqual(getGuestProfileFieldErrors(malformedProfile), {
    contact_email: 'Enter a valid email address.',
    website: 'Use a complete HTTPS link.',
    linkedin: 'Use a complete HTTPS link.',
    instagram: 'Use an @handle or a complete HTTPS link.',
  });
  assert.equal(isGuestProfileValid(malformedProfile), false);
  assert.equal(
    isGuestProfileValid({
      ...malformedProfile,
      contact_email: '',
      no_public_profiles: true,
    }),
    true
  );
  assert.equal(
    isGuestProfileValid({
      ...malformedProfile,
      no_public_profiles: true,
    }),
    false
  );
});

test('host saves accept structured guest fields without allowing deliverable configuration changes', () => {
  const episode = sampleEpisode();
  const updated = mergeHostDeliverableValues(episode, [
    {
      id: 'guest-details',
      value: 'Earlier guest notes remain available.',
      social_profiles: 'Earlier social notes remain available.',
      guest_profile: {
        name: 'Jordan Lee',
        title_affiliation: 'Avalanche educator',
        contact_phone: '+1 555 0100',
        short_bio: 'Jordan teaches backcountry travelers.',
        instagram: '@jordanlee',
        unknown: 'drop me',
      },
      label: 'Forged label',
      required: false,
    },
  ]);
  const guest = updated.deliverables.find(
    (deliverable) => deliverable.id === 'guest-details'
  );

  assert.equal(guest.label, 'Guest details');
  assert.equal(guest.required, true);
  assert.equal(guest.value, 'Earlier guest notes remain available.');
  assert.equal(
    guest.social_profiles,
    'Earlier social notes remain available.'
  );
  assert.equal(guest.guest_profile.name, 'Jordan Lee');
  assert.equal(guest.guest_profile.contact_phone, '+1 555 0100');
  assert.equal(
    Object.prototype.hasOwnProperty.call(guest.guest_profile, 'unknown'),
    false
  );

  const legacyOnlyUpdate = mergeHostDeliverableValues(updated, [
    {
      id: 'guest-details',
      value: 'Updated additional notes.',
    },
  ]).deliverables.find((deliverable) => deliverable.id === 'guest-details');
  assert.deepEqual(legacyOnlyUpdate.guest_profile, guest.guest_profile);
  assert.equal(
    legacyOnlyUpdate.social_profiles,
    'Earlier social notes remain available.'
  );

  const partialProfileUpdate = mergeHostDeliverableValues(updated, [
    {
      id: 'guest-details',
      guest_profile: { instagram: '@jordan_updated' },
    },
  ]).deliverables.find((deliverable) => deliverable.id === 'guest-details');
  assert.equal(partialProfileUpdate.guest_profile.name, 'Jordan Lee');
  assert.equal(
    partialProfileUpdate.guest_profile.instagram,
    '@jordan_updated'
  );
});

test('checklist configuration preserves structured and legacy guest responses', () => {
  const episode = mergeHostDeliverableValues(sampleEpisode(), [
    {
      id: 'guest-details',
      value: 'Legacy guest notes',
      social_profiles: 'Legacy profile notes',
      guest_profile: {
        name: 'Jordan Lee',
        title_affiliation: 'Avalanche educator',
        contact_email: 'jordan@example.com',
        short_bio: 'Jordan teaches backcountry travelers.',
        website: 'https://example.com',
      },
    },
  ]);
  const configured = configureEpisodeDeliverables(episode, [
    {
      id: 'guest-details',
      label: 'Featured guest details',
      description: 'Provide the final guest information.',
      type: 'textarea',
      required: true,
    },
  ]);
  const guest = configured.deliverables[0];

  assert.equal(guest.value, 'Legacy guest notes');
  assert.equal(guest.social_profiles, 'Legacy profile notes');
  assert.equal(guest.guest_profile.name, 'Jordan Lee');
  assert.equal(guest.guest_profile.website, 'https://example.com');
});

test('structured guest completion requires core contact details and a public-profile response', () => {
  const structuredGuest = {
    id: 'guest-details',
    type: 'textarea',
    value: '',
    social_profiles: '',
    guest_profile: {
      name: 'Jordan Lee',
      title_affiliation: 'Avalanche educator',
      contact_email: 'jordan@example.com',
      short_bio: 'Jordan teaches backcountry travelers.',
      website: 'https://example.com',
    },
  };

  assert.equal(isDeliverableComplete(structuredGuest), true);
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        contact_email: '',
        contact_phone: '+1 555 0100',
      },
    }),
    true
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        contact_email: 'not-an-email',
        contact_phone: '+1 555 0100',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        instagram: 'not a valid handle',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        website: 'http://example.com',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        contact_email: '',
        contact_phone: '',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        title_affiliation: '',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        website: '',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      ...structuredGuest,
      guest_profile: {
        ...structuredGuest.guest_profile,
        website: '',
        no_public_profiles: true,
      },
    }),
    true
  );
});

test('legacy guest responses remain preserved but do not replace current structured requirements', () => {
  assert.equal(
    isDeliverableComplete({
      id: 'guest-details',
      type: 'textarea',
      value: 'Jordan Lee, avalanche educator and guide.',
      social_profiles: '',
      guest_profile: { instagram: '@jordanlee' },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      id: 'guest-details',
      type: 'textarea',
      value: '',
      social_profiles: 'Instagram: @jordanlee',
      guest_profile: {
        name: 'Jordan Lee',
        title_affiliation: 'Avalanche educator',
        contact_email: 'jordan@example.com',
        short_bio: 'Jordan teaches backcountry travelers.',
      },
    }),
    false
  );
  assert.equal(
    isDeliverableComplete({
      id: 'guest-details',
      type: 'textarea',
      value: 'Earlier guest notes remain preserved.',
      social_profiles: 'Earlier profile notes remain preserved.',
      guest_profile: {
        name: 'Jordan Lee',
        title_affiliation: 'Avalanche educator',
        contact_email: 'jordan@example.com',
        short_bio: 'Jordan teaches backcountry travelers.',
        instagram: '@jordanlee',
      },
    }),
    true
  );
});

test('legacy guest notes cannot bypass current requirements and asset steps use only their own files', () => {
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
    false
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
