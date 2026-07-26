import test from 'node:test';
import assert from 'node:assert/strict';
import {
  EPISODE_ASSET_MAX_BYTES,
  canDeleteEpisodeAsset,
  canUploadEpisodeAssets,
  episodeAssetMatchesUploadAuthorization,
  getEpisodeAssetAccept,
  getEpisodeAssetTypeLabel,
  sanitizeEpisodeAssetFileName,
  validateEpisodeAssetInput,
} from '../lib/episodeAssetPolicy.mjs';

const MEBIBYTE = 1024 * 1024;

test('accepts common episode production files and canonicalizes browser MIME aliases', () => {
  const cases = [
    ['Interview.WAV', 'audio/x-wav', 'other', 'audio/wav'],
    ['mix.mp3', 'audio/mp3', 'other', 'audio/mpeg'],
    ['release.pdf', '', 'other', 'application/pdf'],
    [
      'guest bio.docx',
      'application/octet-stream',
      'other',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ],
    ['cover.JPEG', 'image/jpg', 'other', 'image/jpeg'],
    ['transcript.vtt', 'text/plain', 'other', 'text/vtt'],
    ['reference.mov', 'video/quicktime', 'other', 'video/quicktime'],
  ];

  for (const [fileName, contentType, category, expectedContentType] of cases) {
    const result = validateEpisodeAssetInput({
      file_name: fileName,
      content_type: contentType,
      size: 1024,
      category,
    });
    assert.equal(result.content_type, expectedContentType, fileName);
    assert.equal(result.size, 1024, fileName);
  }
});

test('specialized steps accept only their intended safe file kinds', () => {
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'host-track.mp3',
      content_type: 'audio/mpeg',
      size: 1024,
      category: 'recording',
    }).category,
    'recording'
  );
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'cover.webp',
      content_type: 'image/webp',
      size: 1024,
      category: 'image',
    }).category,
    'image'
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'notes.pdf',
        content_type: 'application/pdf',
        size: 1024,
        category: 'recording',
      }),
    /not supported for this step/i
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'voice.wav',
        content_type: 'audio/wav',
        size: 1024,
        category: 'document',
      }),
    /not supported for this step/i
  );
});

test('rejects executable, script, active image, macro, archive, and mismatched files', () => {
  for (const file of [
    ['payload.exe', 'audio/wav'],
    ['notes.html', 'text/html'],
    ['automation.js', 'text/javascript'],
    ['artwork.svg', 'image/svg+xml'],
    [
      'script.docm',
      'application/vnd.ms-word.document.macroenabled.12',
    ],
    ['bundle.zip', 'application/zip'],
    ['recording.wav.exe', 'audio/wav'],
  ]) {
    assert.throws(
      () =>
        validateEpisodeAssetInput({
          file_name: file[0],
          content_type: file[1],
          size: 1024,
          category: 'other',
        }),
      /not supported/i,
      file[0]
    );
  }

  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'renamed.pdf',
        content_type: 'audio/mpeg',
        size: 1024,
        category: 'other',
      }),
    /do not match/i
  );
});

test('enforces positive exact sizes and media-kind limits even in the mixed source step', () => {
  assert.deepEqual(EPISODE_ASSET_MAX_BYTES, {
    image: 30 * MEBIBYTE,
    document: 75 * MEBIBYTE,
    audio: 1536 * MEBIBYTE,
    video: 750 * MEBIBYTE,
  });

  for (const size of [0, -1, 1.5, Number.NaN]) {
    assert.throws(
      () =>
        validateEpisodeAssetInput({
          file_name: 'notes.pdf',
          content_type: 'application/pdf',
          size,
          category: 'other',
        }),
      /empty or has an invalid size/i
    );
  }

  const boundaries = [
    ['cover.png', 'image/png', EPISODE_ASSET_MAX_BYTES.image],
    ['notes.pdf', 'application/pdf', EPISODE_ASSET_MAX_BYTES.document],
    ['audio.wav', 'audio/wav', EPISODE_ASSET_MAX_BYTES.audio],
    ['video.mp4', 'video/mp4', EPISODE_ASSET_MAX_BYTES.video],
  ];
  for (const [fileName, contentType, limit] of boundaries) {
    assert.equal(
      validateEpisodeAssetInput({
        file_name: fileName,
        content_type: contentType,
        size: limit,
        category: 'other',
      }).size,
      limit,
      fileName
    );
    assert.throws(
      () =>
        validateEpisodeAssetInput({
          file_name: fileName,
          content_type: contentType,
          size: limit + 1,
          category: 'other',
        }),
      /exceeds the .* limit/i,
      fileName
    );
  }
});

test('accepts the 1.5 GB audio boundary while keeping smaller WAV and document uploads valid', () => {
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'full-quality-track.wav',
      content_type: 'audio/wav',
      size: 1536 * MEBIBYTE,
      category: 'recording',
    }).size,
    1536 * MEBIBYTE
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'too-large-track.wav',
        content_type: 'audio/wav',
        size: 1536 * MEBIBYTE + 1,
        category: 'recording',
      }),
    /exceeds the 1\.5 GB limit for audio files/i
  );
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'short-track.wav',
      content_type: 'audio/wav',
      size: 12 * MEBIBYTE,
      category: 'recording',
    }).size,
    12 * MEBIBYTE
  );
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'production-notes.pdf',
      content_type: 'application/pdf',
      size: 10 * MEBIBYTE,
      category: 'document',
    }).size,
    10 * MEBIBYTE
  );
});

test('picker hints come from the same policy and exclude dangerous formats', () => {
  const sourceAccept = getEpisodeAssetAccept('other');
  const sourceAcceptEntries = new Set(sourceAccept.split(','));
  for (const extension of [
    '.wav',
    '.mp3',
    '.pdf',
    '.docx',
    '.jpg',
    '.png',
    '.mov',
  ]) {
    assert.equal(sourceAcceptEntries.has(extension), true, extension);
  }
  for (const extension of ['.exe', '.html', '.js', '.svg', '.zip', '.docm']) {
    assert.equal(sourceAcceptEntries.has(extension), false, extension);
  }

  assert.equal(getEpisodeAssetAccept('recording').includes('.wav'), true);
  assert.equal(getEpisodeAssetAccept('recording').includes('.pdf'), false);
  assert.equal(getEpisodeAssetAccept('image').includes('.png'), true);
  assert.equal(getEpisodeAssetAccept('image').includes('.svg'), false);
  assert.equal(getEpisodeAssetAccept('document').includes('.docx'), true);
  assert.equal(getEpisodeAssetAccept('document').includes('.mp3'), false);
});

test('exposes accurate friendly type labels and upload role rules', () => {
  assert.equal(
    getEpisodeAssetTypeLabel({
      file_name: 'interview.wav',
      content_type: 'audio/wav',
    }),
    'WAV audio'
  );
  assert.equal(
    getEpisodeAssetTypeLabel({
      file_name: 'release.pdf',
      content_type: 'application/pdf',
    }),
    'PDF document'
  );

  assert.equal(
    canUploadEpisodeAssets({ roles: ['host'], status: 'in_progress' }),
    true
  );
  assert.equal(
    canUploadEpisodeAssets({ roles: ['host'], status: 'submitted' }),
    false
  );
  assert.equal(
    canUploadEpisodeAssets({ roles: ['producer'], status: 'submitted' }),
    true
  );
  assert.equal(
    canUploadEpisodeAssets({ roles: ['producer'], status: 'accepted' }),
    false
  );
  assert.equal(
    canUploadEpisodeAssets({ roles: ['creator'], status: 'planning' }),
    false
  );
  for (const status of ['', 'archived', 'future_workflow_state']) {
    assert.equal(
      canUploadEpisodeAssets({ roles: ['host'], status }),
      false,
      `host ${status || 'blank'}`
    );
    assert.equal(
      canUploadEpisodeAssets({ roles: ['producer'], status }),
      false,
      `producer ${status || 'blank'}`
    );
  }
});

test('limits asset deletion to managers, assigned producers, and the active host uploader', () => {
  const common = {
    status: 'in_progress',
    viewerPersonId: 'host-one',
    uploaderPersonId: 'host-one',
  };
  assert.equal(canDeleteEpisodeAsset({ ...common, roles: ['host'] }), true);
  assert.equal(
    canDeleteEpisodeAsset({
      ...common,
      roles: ['host'],
      viewerPersonId: 'host-two',
    }),
    false
  );
  assert.equal(
    canDeleteEpisodeAsset({
      ...common,
      roles: ['producer'],
      viewerPersonId: 'producer-one',
    }),
    true
  );
  assert.equal(
    canDeleteEpisodeAsset({
      ...common,
      roles: ['host'],
      status: 'submitted',
    }),
    false
  );
  assert.equal(
    canDeleteEpisodeAsset({
      ...common,
      roles: [],
      status: 'accepted',
      canManage: true,
    }),
    true
  );
});

test('recognizes only an exact completed asset as an idempotent retry', () => {
  const authorization = {
    asset_id: 'asset-1',
    object_key: 'episodes/episode-one/other/asset-1-interview.wav',
    file_name: 'interview.wav',
    content_type: 'audio/wav',
    size: 1024,
    category: 'other',
    deliverable_id: 'episode-folder',
    uploader_person_id: 'host-one',
  };
  const asset = {
    ...authorization,
    uploaded_by_person_id: authorization.uploader_person_id,
  };
  delete asset.uploader_person_id;

  assert.equal(
    episodeAssetMatchesUploadAuthorization(asset, authorization),
    true
  );
  assert.equal(
    episodeAssetMatchesUploadAuthorization(
      { ...asset, size: asset.size + 1 },
      authorization
    ),
    false
  );
  assert.equal(
    episodeAssetMatchesUploadAuthorization(
      { ...asset, uploaded_by_person_id: 'another-person' },
      authorization
    ),
    false
  );
});

test('sanitizes dangerous filename characters without damaging useful metadata', () => {
  assert.equal(
    sanitizeEpisodeAssetFileName("Cam's Interview #2 (final).wav"),
    "Cam's Interview #2 (final).wav"
  );
  assert.equal(
    sanitizeEpisodeAssetFileName('Episode, final + notes.pdf'),
    'Episode, final + notes.pdf'
  );

  const unsafe = sanitizeEpisodeAssetFileName('../bad\u0000name?.wav');
  assert.equal(unsafe.endsWith('.wav'), true);
  assert.equal(/[\/\\\p{Cc}\p{Cf}<>:"|?*]/u.test(unsafe), false);

  const emojiBoundary = `${'a'.repeat(175)}😀.wav`;
  assert.equal(Array.from(emojiBoundary).length, 180);
  assert.equal(
    sanitizeEpisodeAssetFileName(emojiBoundary),
    emojiBoundary
  );
});
