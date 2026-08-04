import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyGuestQuestionnaireProjectionToEpisode,
  createDefaultGuestQuestionnaire,
  getGuestQuestionnaireStudioCapabilities,
  isGuestQuestionActive,
  mergeGuestQuestionnaireConfiguration,
  mergeGuestQuestionnaireUploadSlot,
  normalizeGuestQuestionnaireRecord,
  projectGuestQuestionnaireResponse,
  sanitizeGuestQuestionnaireForStudio,
  sanitizeGuestQuestionnaireForLogistics,
  validateGuestQuestionnaireSubmission,
} from '../lib/guestQuestionnairePresentation.mjs';

function uploadedAsset(index) {
  return {
    asset_id: `photo-${index}`,
    status: 'uploaded',
    file_name: `guest-${index}.jpg`,
    content_type: 'image/jpeg',
    size_bytes: 120000,
    uploaded_at: '2026-08-04T12:00:00.000Z',
    object_key: `private/episode/photo-${index}`,
    object_version_id: `private-version-${index}`,
  };
}

function responseReadyRecord() {
  let record = createDefaultGuestQuestionnaire('episode-one');
  record = mergeGuestQuestionnaireUploadSlot(record, {
    slotKey: 'photo',
    assets: Array.from({ length: 5 }, (_, index) =>
      uploadedAsset(index + 1)
    ),
  });
  return record;
}

function requiredAnswers(overrides = {}) {
  return {
    guest_name: 'Alex Guest',
    guest_email: 'alex@example.com',
    guest_title_affiliation: 'Guide, Example Mountain',
    guest_bio: 'Alex is an experienced mountain guide.',
    public_profiles_available: 'no',
    topics: 'Decision making and communication.',
    social_permission: 'check_first',
    close_call: 'no',
    high_speed_internet: 'yes',
    external_microphone: 'no',
    over_ear_headphones: 'yes',
    quiet_recording_place: 'yes',
    video_clip_consent: 'no',
    photo_credit: 'Courtesy of Alex Guest',
    mic_kit_shipping_needed: 'no',
    ...overrides,
  };
}

test('default questionnaire mirrors guest preparation, readiness, scheduling, and upload needs', () => {
  const record = createDefaultGuestQuestionnaire('episode-one');
  const keys = new Set(record.questions.map((question) => question.key));

  for (const key of [
    'guest_name',
    'guest_email',
    'guest_bio',
    'public_profiles_available',
    'website',
    'instagram',
    'project_links',
    'research_links',
    'topics',
    'social_permission',
    'close_call',
    'close_call_details',
    'high_speed_internet',
    'external_microphone',
    'over_ear_headphones',
    'quiet_recording_place',
    'own_equipment_description',
    'recording_experience',
    'video_clip_consent',
    'photo_credit',
    'mic_kit_shipping_needed',
    'shipping_address_line_1',
  ]) {
    assert.equal(keys.has(key), true, key);
  }
  assert.deepEqual(
    record.questions.find((question) => question.key === 'close_call_details')
      .show_when,
    { key: 'close_call', values: ['yes', 'maybe'] }
  );
  assert.deepEqual(Object.keys(record.scheduling), [
    'pre_interview',
    'interview',
  ]);
  assert.deepEqual(
    record.upload_slots.map(({ key, required, min_count, max_count }) => ({
      key,
      required,
      min_count,
      max_count,
    })),
    [
      { key: 'resume', required: false, min_count: 1, max_count: 1 },
      { key: 'photo', required: true, min_count: 5, max_count: 6 },
    ]
  );
});

test('configuration keeps stable built-ins and accepts bounded custom questions', () => {
  const current = createDefaultGuestQuestionnaire('episode-one');
  const configured = mergeGuestQuestionnaireConfiguration(current, {
    title: 'Taylor guest preparation',
    scheduling: {
      pre_interview: {
        url: 'https://calendar.example.com/sound-check',
        prompt: 'I scheduled the sound check.',
        required: true,
      },
      interview: {
        url: 'https://calendar.example.com/interview',
        prompt: 'I scheduled the interview.',
        required: true,
      },
    },
    questions: [
      {
        key: 'guest_name',
        prompt: 'Your name for the episode',
        required: true,
        visible: true,
        sort_order: 5,
      },
      {
        key: 'custom_favorite_run',
        type: 'single_choice',
        prompt: 'Which type of terrain do you prefer?',
        required: false,
        visible: true,
        sort_order: 175,
        options: [
          { value: 'trees', label: 'Trees' },
          { value: 'alpine', label: 'Alpine' },
        ],
      },
    ],
  });

  assert.equal(configured.title, 'Taylor guest preparation');
  assert.equal(
    configured.questions.find((question) => question.key === 'guest_name')
      .prompt,
    'Your name for the episode'
  );
  assert.equal(
    configured.questions.find((question) => question.key === 'website')
      .built_in,
    true
  );
  assert.deepEqual(
    configured.questions.find(
      (question) => question.key === 'custom_favorite_run'
    ).options,
    [
      { value: 'trees', label: 'Trees' },
      { value: 'alpine', label: 'Alpine' },
    ]
  );
  assert.equal(
    configured.scheduling.pre_interview.url,
    'https://calendar.example.com/sound-check'
  );
});

test('conditional questions support multiple controlling values', () => {
  const record = createDefaultGuestQuestionnaire('episode-one');
  const details = record.questions.find(
    (question) => question.key === 'close_call_details'
  );
  assert.equal(isGuestQuestionActive(details, { close_call: 'yes' }), true);
  assert.equal(isGuestQuestionActive(details, { close_call: 'maybe' }), true);
  assert.equal(isGuestQuestionActive(details, { close_call: 'no' }), false);
});

test('recording readiness keeps the microphone-kit path visible until equipment is confirmed', () => {
  const record = createDefaultGuestQuestionnaire('episode-one');
  const microphone = record.questions.find(
    (question) => question.key === 'external_microphone'
  );
  const headphones = record.questions.find(
    (question) => question.key === 'over_ear_headphones'
  );
  const equipmentDescription = record.questions.find(
    (question) => question.key === 'own_equipment_description'
  );
  const kitRequest = record.questions.find(
    (question) => question.key === 'mic_kit_shipping_needed'
  );

  assert.equal(record.schema_version, 2);
  assert.equal(
    microphone.options.some((option) => option.value === 'not_sure'),
    true
  );
  assert.equal(
    headphones.options.some((option) => option.value === 'not_sure'),
    true
  );
  assert.equal(equipmentDescription.visible, false);
  assert.equal(isGuestQuestionActive(kitRequest, {}), true);
  assert.equal(
    isGuestQuestionActive(kitRequest, {
      external_microphone: 'yes',
    }),
    true
  );
  assert.equal(
    isGuestQuestionActive(kitRequest, {
      external_microphone: 'yes',
      over_ear_headphones: 'yes',
    }),
    false
  );
  assert.equal(
    isGuestQuestionActive(kitRequest, {
      external_microphone: 'no',
      over_ear_headphones: 'yes',
    }),
    true
  );
  assert.equal(
    isGuestQuestionActive(kitRequest, {
      external_microphone: 'yes',
      over_ear_headphones: 'not_sure',
    }),
    true
  );
});

test('legacy questionnaires adopt the recording decision tree without restoring the generic equipment box', () => {
  const legacy = createDefaultGuestQuestionnaire('episode-one');
  legacy.schema_version = 1;
  legacy.questions = legacy.questions.map((question) => {
    if (question.key === 'external_microphone') {
      return {
        ...question,
        prompt: 'Do you have an external microphone you can use?',
        options: [
          { value: 'yes', label: 'Yes' },
          { value: 'no', label: 'No' },
        ],
      };
    }
    if (question.key === 'own_equipment_description') {
      return { ...question, visible: true };
    }
    return question;
  });

  const upgraded = normalizeGuestQuestionnaireRecord(legacy);
  const microphone = upgraded.questions.find(
    (question) => question.key === 'external_microphone'
  );
  assert.equal(upgraded.schema_version, 2);
  assert.equal(
    microphone.prompt,
    'Will you have a dedicated microphone for the interview?'
  );
  assert.equal(
    microphone.options.some((option) => option.value === 'not_sure'),
    true
  );
  assert.equal(
    upgraded.questions.find(
      (question) => question.key === 'own_equipment_description'
    ).visible,
    false
  );
});

test('recording decision-tree validation cannot skip a required kit decision or shipping details', () => {
  const record = responseReadyRecord();
  const ready = validateGuestQuestionnaireSubmission(
    {
      answers: requiredAnswers({
        external_microphone: 'yes',
        over_ear_headphones: 'yes',
      }),
    },
    record
  );
  assert.equal(ready.answers.mic_kit_shipping_needed, undefined);

  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({
            external_microphone: 'no',
            mic_kit_shipping_needed: '',
          }),
        },
        record
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_REQUIRED_FIELDS' &&
      error.details.includes('mic_kit_shipping_needed')
  );

  const needsConversation = validateGuestQuestionnaireSubmission(
    {
      answers: requiredAnswers({
        external_microphone: 'not_sure',
        mic_kit_shipping_needed: 'unsure',
      }),
    },
    record
  );
  assert.equal(needsConversation.answers.mic_kit_shipping_needed, 'unsure');

  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({
            external_microphone: 'no',
            mic_kit_shipping_needed: 'yes',
          }),
        },
        record
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_REQUIRED_FIELDS' &&
      error.details.includes('shipping_address_line_1')
  );
});

test('projects the guest recording decision tree into a structured microphone plan', () => {
  const requested = responseReadyRecord();
  requested.response = {
    ...requested.response,
    status: 'submitted',
    revision: 3,
    answers: requiredAnswers({
      external_microphone: 'no',
      over_ear_headphones: 'not_sure',
      mic_kit_shipping_needed: 'yes',
      shipping_recipient_name: 'Alex Guest',
      shipping_address_line_1: '123 Private Lane',
      shipping_city: 'Wenatchee',
      shipping_region: 'WA',
      shipping_postal_code: '98801',
      shipping_country: 'US',
    }),
  };
  const requestedPlan = projectGuestQuestionnaireResponse(requested).production
    .guest_mic_kit_plan;
  assert.equal(requestedPlan.choice, 'request_kit');
  assert.equal(requestedPlan.response_revision, 3);
  assert.deepEqual(requestedPlan.readiness, {
    internet: 'yes',
    microphone: 'no',
    headphones: 'not_sure',
    quiet_place: 'yes',
  });
  assert.doesNotMatch(JSON.stringify(requestedPlan), /Private Lane|98801/);

  const equipped = responseReadyRecord();
  equipped.response = {
    ...equipped.response,
    status: 'submitted',
    revision: 1,
    answers: requiredAnswers({
      external_microphone: 'yes',
      over_ear_headphones: 'yes',
      mic_kit_shipping_needed: '',
    }),
  };
  assert.equal(
    projectGuestQuestionnaireResponse(equipped).production.guest_mic_kit_plan
      .choice,
    'use_own_equipment'
  );

  const arranging = responseReadyRecord();
  arranging.response = {
    ...arranging.response,
    status: 'submitted',
    revision: 1,
    answers: requiredAnswers({
      external_microphone: 'no',
      mic_kit_shipping_needed: 'no',
    }),
  };
  assert.equal(
    projectGuestQuestionnaireResponse(arranging).production.guest_mic_kit_plan
      .choice,
    'needs_follow_up'
  );
});

test('accepted and archived history is read-only while producer revocation stays available', () => {
  const activeHost = getGuestQuestionnaireStudioCapabilities({
    canHost: true,
    episodeStatus: 'in_progress',
    linkStatus: 'active',
  });
  assert.equal(activeHost.can_edit, false);
  assert.equal(activeHost.can_issue, true);
  assert.equal(activeHost.can_apply, false);
  assert.equal(activeHost.can_revoke, true);
  assert.equal(activeHost.can_view_shipping, false);

  const revokedHost = getGuestQuestionnaireStudioCapabilities({
    canHost: true,
    episodeStatus: 'in_progress',
    linkStatus: 'revoked',
  });
  assert.equal(revokedHost.can_edit, true);

  const acceptedHost = getGuestQuestionnaireStudioCapabilities({
    canHost: true,
    episodeStatus: 'accepted',
    linkStatus: 'active',
  });
  assert.equal(acceptedHost.can_edit, false);
  assert.equal(acceptedHost.can_revoke, false);

  const acceptedProducer = getGuestQuestionnaireStudioCapabilities({
    canReview: true,
    episodeStatus: 'accepted',
    linkStatus: 'active',
  });
  assert.equal(acceptedProducer.can_edit, false);
  assert.equal(acceptedProducer.can_revoke, true);
  assert.equal(acceptedProducer.can_view_shipping, true);

  const submittedProducer = getGuestQuestionnaireStudioCapabilities({
    canReview: true,
    episodeStatus: 'in_progress',
    linkStatus: 'active',
    responseStatus: 'submitted',
  });
  assert.equal(submittedProducer.can_edit, false);
  assert.equal(submittedProducer.can_issue, false);
  assert.equal(submittedProducer.can_apply, true);
  assert.equal(submittedProducer.can_revoke, true);
});

test('submission validation enforces profile formats, conditions, uploads, and both schedule acknowledgements', () => {
  const withUploads = responseReadyRecord();
  const configured = mergeGuestQuestionnaireConfiguration(withUploads, {
    scheduling: {
      pre_interview: {
        url: 'https://calendar.example.com/sound-check',
        required: true,
      },
      interview: {
        url: 'https://calendar.example.com/interview',
        required: true,
      },
    },
  });
  const valid = validateGuestQuestionnaireSubmission(
    {
      submission_id: 'submission-1234',
      expected_revision: 0,
      answers: requiredAnswers(),
      scheduling_acknowledgements: {
        pre_interview: true,
        interview: true,
      },
    },
    configured
  );
  assert.equal(valid.answers.guest_name, 'Alex Guest');
  assert.equal(valid.scheduling_acknowledged, true);

  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({ guest_name: 'x'.repeat(601) }),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: true,
          },
        },
        configured
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_ANSWER_TOO_LONG' &&
      error.details.includes('guest_name')
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({ guest_name: { nested: true } }),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: true,
          },
        },
        configured
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_ANSWER_INVALID' &&
      error.details.includes('guest_name')
  );

  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({
            public_profiles_available: 'yes',
            website: 'http://unsafe.example.com',
          }),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: true,
          },
        },
        configured
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_PROFILE_INVALID' &&
      error.details.includes('website')
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({ public_profiles_available: 'yes' }),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: true,
          },
        },
        configured
      ),
    (error) => error.code === 'GUEST_RESPONSE_PUBLIC_PROFILE_REQUIRED'
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers({ close_call: 'maybe' }),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: true,
          },
        },
        configured
      ),
    (error) =>
      error.code === 'GUEST_RESPONSE_REQUIRED_FIELDS' &&
      error.details.includes('close_call_details')
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        {
          answers: requiredAnswers(),
          scheduling_acknowledgements: {
            pre_interview: true,
            interview: false,
          },
        },
        configured
      ),
    (error) =>
      error.code === 'GUEST_SCHEDULING_ACKNOWLEDGEMENT_REQUIRED'
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireSubmission(
        { answers: requiredAnswers() },
        createDefaultGuestQuestionnaire('episode-one')
      ),
    (error) => error.code === 'GUEST_RESPONSE_REQUIRED_UPLOADS'
  );
});

test('Studio response redacts shipping and private upload storage for hosts', () => {
  const record = responseReadyRecord();
  record.link = {
    status: 'active',
    token_jti_hash: 'private-token-hash',
    issued_at: '2026-08-04T12:00:00.000Z',
    expires_at: '2026-08-25T12:00:00.000Z',
    revoked_at: '',
  };
  record.response = {
    ...record.response,
    status: 'submitted',
    revision: 1,
    response_id: 'response-one',
    answers: {
      guest_name: 'Alex Guest',
      shipping_address_line_1: '123 Private Lane',
      shipping_postal_code: '99999',
    },
    submission_id_hash: 'private-submission-hash',
    submission_payload_hash: 'private-payload-hash',
    submitted_at: '2026-08-04T12:00:00.000Z',
  };

  const hostView = sanitizeGuestQuestionnaireForStudio(record, {
    canViewShipping: false,
    now: new Date('2026-08-05T12:00:00.000Z'),
  });
  const producerView = sanitizeGuestQuestionnaireForStudio(record, {
    canViewShipping: true,
    now: new Date('2026-08-05T12:00:00.000Z'),
  });
  assert.equal(hostView.response.answers.guest_name, 'Alex Guest');
  assert.equal(hostView.response.answers.shipping_address_line_1, undefined);
  assert.equal(
    producerView.response.answers.shipping_address_line_1,
    '123 Private Lane'
  );
  assert.doesNotMatch(
    JSON.stringify(hostView),
    /private-token|private-submission|private-payload|object_key|private-version/i
  );

  const logisticsView = sanitizeGuestQuestionnaireForLogistics(record);
  assert.equal(
    logisticsView.shipping.answers.shipping_address_line_1,
    '123 Private Lane'
  );
  assert.equal(logisticsView.shipping.guest_name, 'Alex Guest');
  assert.equal(logisticsView.shipping.answers.topics, undefined);
  assert.equal(logisticsView.shipping.answers.guest_bio, undefined);
});

test('projection fills blanks, keeps project links in notes, sets no-profile state, and preserves manual edits', () => {
  const record = responseReadyRecord();
  record.response = {
    ...record.response,
    status: 'submitted',
    revision: 1,
    answers: {
      ...requiredAnswers({
        public_profiles_available: 'yes',
        website: 'https://example.com/',
        instagram: '@alexguest',
        other_social_profiles: '@alex_elsewhere\nhttps://social.example.com/alex',
        project_links: 'Mountain Safety Project\nhttps://project.example.com/',
        research_links: 'Decision-making paper\nhttps://research.example.com/',
        mic_kit_shipping_needed: 'yes',
        shipping_address_line_1: '123 Private Lane',
        shipping_city: 'Private City',
        shipping_postal_code: '99999',
      }),
    },
  };
  const projection = projectGuestQuestionnaireResponse(record);
  assert.equal(projection.profile.website, 'https://example.com/');
  assert.equal(projection.profile.other, '@alex_elsewhere');
  assert.equal(projection.profile.no_public_profiles, false);
  assert.match(projection.notes, /Projects and links/);
  assert.match(projection.notes, /research\.example\.com/);
  assert.doesNotMatch(projection.profile.other, /Projects and links/);
  assert.match(projection.package.show_notes, /Alex Guest/);
  assert.match(projection.package.show_notes, /Mountain Safety Project/);
  assert.match(projection.package.social_copy, /Instagram: @alexguest/);
  assert.match(projection.package.social_copy, /check with me first/i);
  assert.equal(
    projection.package.credits,
    'Photo credit: Courtesy of Alex Guest'
  );
  assert.match(projection.production.guest_recording_plan_note, /Microphone-kit/);
  assert.doesNotMatch(
    JSON.stringify({
      package: projection.package,
      production: projection.production,
    }),
    /alex@example\.com|123 Private Lane|Private City|99999/
  );

  const episode = {
    episode_id: 'episode-one',
    deliverables: [
      {
        id: 'guest-details',
        value: '',
        guest_profile: {
          name: '',
          instagram: '@manually-edited',
          no_public_profiles: false,
        },
      },
      { id: 'show-notes', value: '' },
      { id: 'social-copy', value: 'Producer-written social copy' },
      { id: 'credits', value: '' },
      { id: 'mic-kit-plan', mic_kit_plans: [] },
    ],
    production_tasks: [
      {
        task_id: 'guest-recording-plan-reviewed',
        status: 'complete',
        evidence_note: '',
      },
    ],
  };
  const applied = applyGuestQuestionnaireProjectionToEpisode(
    episode,
    projection,
    {}
  );
  const profile = applied.episode.deliverables[0].guest_profile;
  assert.equal(profile.name, 'Alex Guest');
  assert.equal(profile.instagram, '@manually-edited');
  assert.equal(applied.applied_fields.includes('guest_profile.name'), true);
  assert.equal(applied.skipped_fields.includes('guest_profile.instagram'), true);
  assert.match(applied.episode.deliverables[1].value, /Mountain Safety Project/);
  assert.equal(
    applied.episode.deliverables[2].value,
    'Producer-written social copy'
  );
  assert.equal(
    applied.skipped_fields.includes('deliverables.social-copy.value'),
    true
  );
  assert.equal(
    applied.episode.deliverables[3].value,
    'Photo credit: Courtesy of Alex Guest'
  );
  assert.match(
    applied.episode.production_tasks[0].evidence_note,
    /Guest questionnaire recording readiness/
  );
  assert.equal(
    applied.episode.deliverables.find(
      (deliverable) => deliverable.id === 'mic-kit-plan'
    ).guest_mic_kit_plan.choice,
    'request_kit'
  );
  assert.equal(
    applied.applied_fields.includes(
      'deliverables.mic-kit-plan.guest_mic_kit_plan'
    ),
    true
  );
  assert.equal(applied.episode.production_tasks[0].status, 'complete');
  assert.equal(applied.autofill.package.show_notes, projection.package.show_notes);
  assert.equal(
    applied.autofill.production.guest_recording_plan_note,
    projection.production.guest_recording_plan_note
  );

  const noProfilesRecord = responseReadyRecord();
  noProfilesRecord.response = {
    ...noProfilesRecord.response,
    status: 'submitted',
    revision: 1,
    answers: requiredAnswers({ public_profiles_available: 'no' }),
  };
  assert.equal(
    projectGuestQuestionnaireResponse(noProfilesRecord).profile
      .no_public_profiles,
    true
  );
  const noProfilesApplied = applyGuestQuestionnaireProjectionToEpisode(
    {
      ...episode,
      deliverables: [
        {
          ...episode.deliverables[0],
          guest_profile: {
            ...episode.deliverables[0].guest_profile,
            website: 'https://host-entered.example.com/',
          },
        },
      ],
    },
    projectGuestQuestionnaireResponse(noProfilesRecord),
    {}
  );
  assert.equal(
    noProfilesApplied.episode.deliverables[0].guest_profile
      .no_public_profiles,
    false
  );
  assert.equal(
    noProfilesApplied.episode.deliverables[0].guest_profile.website,
    'https://host-entered.example.com/'
  );
  assert.equal(
    noProfilesApplied.skipped_fields.includes(
      'guest_profile.no_public_profiles'
    ),
    true
  );

  const priorAutofillCleared = applyGuestQuestionnaireProjectionToEpisode(
    {
      episode_id: 'episode-one',
      deliverables: [
        {
          id: 'guest-details',
          value: '',
          guest_profile: {
            website: 'https://old-guest.example.com/',
            no_public_profiles: false,
          },
        },
      ],
    },
    projectGuestQuestionnaireResponse(noProfilesRecord),
    {
      profile: { website: 'https://old-guest.example.com/' },
      notes: '',
    }
  );
  assert.equal(
    priorAutofillCleared.episode.deliverables[0].guest_profile.website,
    ''
  );
  assert.equal(
    priorAutofillCleared.episode.deliverables[0].guest_profile
      .no_public_profiles,
    true
  );

  const manualNoProfiles = applyGuestQuestionnaireProjectionToEpisode(
    {
      episode_id: 'episode-one',
      deliverables: [
        {
          id: 'guest-details',
          value: '',
          guest_profile: { no_public_profiles: true },
        },
      ],
    },
    { profile: { no_public_profiles: false }, notes: '' },
    {}
  );
  assert.equal(
    manualNoProfiles.episode.deliverables[0].guest_profile
      .no_public_profiles,
    true
  );
  assert.equal(
    manualNoProfiles.skipped_fields.includes(
      'guest_profile.no_public_profiles'
    ),
    true
  );
});
