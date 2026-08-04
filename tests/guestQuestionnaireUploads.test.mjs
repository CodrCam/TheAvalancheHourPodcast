import test from 'node:test';
import assert from 'node:assert/strict';
import {
  assertGuestUploadMatchesEpisodeAuthorization,
  createGuestQuestionnaireUploadAuthorization,
  deriveGuestQuestionnaireUploaderId,
  getConfiguredGuestQuestionnaireUploadSlot,
  isGuestQuestionnaireUploaderId,
  sanitizeGuestQuestionnaireUploadSlot,
  validateGuestQuestionnaireUploadFile,
  verifyGuestQuestionnaireUploadAuthorization,
} from '../lib/guestQuestionnaireUploadPolicy.mjs';
import {
  isGuestQuestionnaireUploadVersionConflict,
} from '../lib/guestQuestionnaireUploadStore.js';

const SECRET = 'guest-questionnaire-upload-test-secret-at-least-32-characters';
const LINK_HASH = 'a'.repeat(64);
const EPISODE_ID = 'episode-one';
const NOW = new Date('2026-08-04T12:00:00.000Z');

function questionnaire(overrides = {}) {
  return {
    upload_slots: [
      {
        key: 'resume',
        visible: true,
        required: false,
        status: 'enabled',
        min_count: 1,
        max_count: 1,
      },
      {
        key: 'photo',
        visible: true,
        required: true,
        status: 'enabled',
        min_count: 5,
        max_count: 6,
      },
    ],
    response: { upload_slots: {} },
    ...overrides,
  };
}

function assetUpload(slotKey = 'photo') {
  return {
    asset_id: 'asset-1b7a6fb0-f777-4f6b-9a86-0ec5375667f8',
    upload_token: 'signed-inner-episode-token',
    completion_expires_at: '2026-08-05T12:00:00.000Z',
    slot_key: slotKey,
  };
}

test('guest questionnaire upload policy accepts only bounded resume and photo formats', () => {
  assert.deepEqual(
    validateGuestQuestionnaireUploadFile('resume', {
      file_name: 'Guest Resume.pdf',
      content_type: 'application/pdf',
      size: 10 * 1024 * 1024,
    }),
    {
      file_name: 'Guest Resume.pdf',
      content_type: 'application/pdf',
      size: 10 * 1024 * 1024,
      category: 'document',
    }
  );
  assert.equal(
    validateGuestQuestionnaireUploadFile('photo', {
      file_name: 'portrait.heic',
      content_type: 'image/heic',
      size: 1024,
    }).category,
    'image'
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireUploadFile('resume', {
        file_name: 'resume.xlsx',
        content_type:
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        size: 1024,
      }),
    /PDF, DOCX, ODT, or plain-text/i
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireUploadFile('resume', {
        file_name: 'resume.pdf',
        content_type: 'application/pdf',
        size: 10 * 1024 * 1024 + 1,
      }),
    /10 MB/i
  );
  assert.throws(
    () =>
      validateGuestQuestionnaireUploadFile('photo', {
        file_name: 'animated.gif',
        content_type: 'image/gif',
        size: 1024,
      }),
    /JPG, PNG/i
  );
});

test('configured slots enforce current visibility and cap host-configured counts', () => {
  assert.deepEqual(
    getConfiguredGuestQuestionnaireUploadSlot(questionnaire(), 'photo'),
    {
      key: 'photo',
      deliverable_id: 'photos',
      category: 'image',
      max_files: 10,
      max_bytes: 30 * 1024 * 1024,
      content_types: [
        'image/jpeg',
        'image/png',
        'image/webp',
        'image/avif',
        'image/tiff',
        'image/heic',
        'image/heif',
      ],
      required: true,
      min_count: 5,
      max_count: 6,
    }
  );
  assert.throws(
    () =>
      getConfiguredGuestQuestionnaireUploadSlot(
        questionnaire({
          upload_slots: [
            { key: 'photo', visible: false, status: 'enabled' },
          ],
        }),
        'photo'
      ),
    /not available/i
  );
});

test('synthetic uploader identity is stable but bound to the episode and active link', () => {
  const first = deriveGuestQuestionnaireUploaderId({
    episodeId: EPISODE_ID,
    linkTokenHash: LINK_HASH,
  });
  assert.equal(
    first,
    deriveGuestQuestionnaireUploaderId({
      episodeId: EPISODE_ID,
      linkTokenHash: LINK_HASH,
    })
  );
  assert.notEqual(
    first,
    deriveGuestQuestionnaireUploaderId({
      episodeId: EPISODE_ID,
      linkTokenHash: 'b'.repeat(64),
    })
  );
  assert.match(first, /^guest-questionnaire-[a-f0-9]{32}$/);
  assert.equal(isGuestQuestionnaireUploaderId(first), true);
  assert.equal(isGuestQuestionnaireUploaderId('host-one'), false);
  assert.equal(first.includes(LINK_HASH), false);
});

test('guest completion token binds the episode, slot, link, uploader, and inner token', () => {
  const uploaderPersonId = deriveGuestQuestionnaireUploaderId({
    episodeId: EPISODE_ID,
    linkTokenHash: LINK_HASH,
  });
  const token = createGuestQuestionnaireUploadAuthorization({
    episodeId: EPISODE_ID,
    slotKey: 'photo',
    linkTokenHash: LINK_HASH,
    uploaderPersonId,
    assetUpload: assetUpload(),
    now: NOW,
    secret: SECRET,
  });
  const payload = verifyGuestQuestionnaireUploadAuthorization(token, {
    episodeId: EPISODE_ID,
    now: new Date('2026-08-04T13:00:00.000Z'),
    secret: SECRET,
  });
  assert.equal(payload.episode_id, EPISODE_ID);
  assert.equal(payload.slot_key, 'photo');
  assert.equal(payload.link_token_hash, LINK_HASH);
  assert.equal(payload.uploader_person_id, uploaderPersonId);
  assert.equal(payload.episode_upload_token, 'signed-inner-episode-token');

  assert.throws(
    () =>
      verifyGuestQuestionnaireUploadAuthorization(`${token}x`, {
        episodeId: EPISODE_ID,
        now: NOW,
        secret: SECRET,
      }),
    /invalid/i
  );
  assert.throws(
    () =>
      verifyGuestQuestionnaireUploadAuthorization(token, {
        episodeId: 'another-episode',
        now: NOW,
        secret: SECRET,
      }),
    /invalid/i
  );
  assert.throws(
    () =>
      verifyGuestQuestionnaireUploadAuthorization(token, {
        episodeId: EPISODE_ID,
        now: new Date('2026-08-05T12:00:00.001Z'),
        secret: SECRET,
      }),
    /expired/i
  );
});

test('outer authorization must match the signed episode asset authorization', () => {
  const guest = {
    episode_id: EPISODE_ID,
    slot_key: 'resume',
    uploader_person_id: 'guest-questionnaire-123',
    asset_id: 'asset-one',
  };
  assert.equal(
    assertGuestUploadMatchesEpisodeAuthorization(guest, {
      episode_id: EPISODE_ID,
      uploader_person_id: 'guest-questionnaire-123',
      deliverable_id: 'guest-details',
      asset_id: 'asset-one',
      category: 'document',
    }).slot.key,
    'resume'
  );
  assert.throws(
    () =>
      assertGuestUploadMatchesEpisodeAuthorization(guest, {
        episode_id: EPISODE_ID,
        uploader_person_id: 'guest-questionnaire-123',
        deliverable_id: 'photos',
        asset_id: 'asset-one',
        category: 'image',
      }),
    /does not match/i
  );
});

test('safe upload status omits object keys and immutable storage versions', () => {
  const value = questionnaire({
    response: {
      upload_slots: {
        photo: {
          status: 'uploaded',
          assets: [
            {
              asset_id: 'asset-one',
              status: 'uploaded',
              file_name: 'portrait.jpg',
              content_type: 'image/jpeg',
              size_bytes: 2345,
              uploaded_at: '2026-08-04T12:00:00.000Z',
              object_key: 'episodes/private/key.jpg',
              object_version_id: 'private-version',
            },
          ],
        },
      },
    },
  });
  const safe = sanitizeGuestQuestionnaireUploadSlot(value, 'photo');
  assert.deepEqual(safe, {
    status: 'uploaded',
    count: 1,
    assets: [
      {
        asset_id: 'asset-one',
        status: 'uploaded',
        file_name: 'portrait.jpg',
        content_type: 'image/jpeg',
        size_bytes: 2345,
        uploaded_at: '2026-08-04T12:00:00.000Z',
      },
    ],
  });
  assert.equal(JSON.stringify(safe).includes('object_key'), false);
  assert.equal(JSON.stringify(safe).includes('private-version'), false);
});

test('upload persistence identifies Dynamo version races without hiding unrelated failures', () => {
  assert.equal(
    isGuestQuestionnaireUploadVersionConflict(
      new Error('The conditional request failed')
    ),
    true
  );
  assert.equal(
    isGuestQuestionnaireUploadVersionConflict(
      new Error('Transaction cancelled because a condition changed')
    ),
    true
  );
  assert.equal(
    isGuestQuestionnaireUploadVersionConflict(
      new Error('Secure storage is unavailable')
    ),
    false
  );
});
