import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createEpisodeAssetDownloadUrl,
  createEpisodeAssetUpload,
  validateEpisodeAssetInput,
  verifyEpisodeAssetObject,
  verifyEpisodeAssetUploadToken,
} from '../lib/episodeAssetStorage.js';

process.env.EPISODE_ASSETS_S3_BUCKET = 'episode-assets';
process.env.EPISODE_ASSETS_S3_REGION = 'us-east-2';
process.env.EPISODE_ASSETS_ACCESS_KEY_ID = 'AKIATESTONLY';
process.env.EPISODE_ASSETS_SECRET_ACCESS_KEY = 'test-secret';
process.env.EPISODE_ASSETS_UPLOAD_TOKEN_SECRET = 'test-token-secret';

function createTestUpload(overrides = {}) {
  return createEpisodeAssetUpload({
    episodeId: 'episode-one',
    uploaderPersonId: 'host-one',
    deliverableId: 'episode-folder',
    file: {
      file_name: 'Episode Final.wav',
      content_type: 'audio/x-wav',
      size: 1024,
      category: 'other',
      ...overrides,
    },
  });
}

test('accepts bounded final audio and image uploads with accurate names', () => {
  assert.deepEqual(
    validateEpisodeAssetInput({
      file_name: 'Episode Final.wav',
      content_type: 'audio/x-wav',
      size: 1024,
      category: 'recording',
    }),
    {
      file_name: 'Episode Final.wav',
      content_type: 'audio/wav',
      size: 1024,
      category: 'recording',
    }
  );
  assert.equal(
    validateEpisodeAssetInput({
      file_name: 'cover.jpg',
      content_type: 'image/jpeg',
      size: 2048,
      category: 'image',
    }).category,
    'image'
  );
});

test('rejects mismatched and executable episode assets', () => {
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'not-audio.pdf',
        content_type: 'application/pdf',
        size: 1024,
        category: 'recording',
      }),
    /not supported for this step/i
  );
  assert.throws(
    () =>
      validateEpisodeAssetInput({
        file_name: 'payload.exe',
        content_type: 'audio/wav',
        size: 1024,
        category: 'other',
      }),
    /not supported/i
  );
});

test('creates an exact-size and exact-MIME S3 form bound to one deliverable', () => {
  const upload = createTestUpload();
  const policy = JSON.parse(
    Buffer.from(upload.upload_fields.policy, 'base64').toString('utf8')
  );
  const payload = verifyEpisodeAssetUploadToken(
    upload.upload_token,
    'episode-one'
  );

  assert.equal(upload.upload_method, 'POST');
  assert.equal(
    upload.upload_url,
    'https://episode-assets.s3.us-east-2.amazonaws.com'
  );
  assert.equal(upload.upload_fields.key, upload.object_key);
  assert.equal(upload.upload_fields['Content-Type'], 'audio/wav');
  assert.deepEqual(
    policy.conditions.find(
      (condition) =>
        Array.isArray(condition) &&
        condition[0] === 'content-length-range'
    ),
    ['content-length-range', 1024, 1024]
  );
  assert.deepEqual(
    policy.conditions.find((condition) => condition['Content-Type']),
    { 'Content-Type': 'audio/wav' }
  );
  assert.equal(payload.episode_id, 'episode-one');
  assert.equal(payload.deliverable_id, 'episode-folder');
  assert.equal(payload.uploader_person_id, 'host-one');
  assert.equal(payload.file_name, 'Episode Final.wav');
  assert.equal(payload.content_type, 'audio/wav');
  assert.match(payload.object_key, /^episodes\/episode-one\/other\/asset-/);
});

test('rejects tampered, cross-episode, and expired completion tokens', () => {
  const upload = createTestUpload();

  assert.throws(
    () =>
      verifyEpisodeAssetUploadToken(
        `${upload.upload_token}tampered`,
        'episode-one'
      ),
    /authorization is invalid/i
  );
  assert.throws(
    () =>
      verifyEpisodeAssetUploadToken(
        upload.upload_token,
        'another-episode'
      ),
    /authorization is invalid/i
  );

  const originalDateNow = Date.now;
  try {
    Date.now = () => originalDateNow() + 25 * 60 * 60 * 1000;
    assert.throws(
      () =>
        verifyEpisodeAssetUploadToken(
          upload.upload_token,
          'episode-one'
        ),
      /authorization has expired/i
    );
  } finally {
    Date.now = originalDateNow;
  }
});

test('verifies S3 metadata and captures the immutable object version', async (t) => {
  const upload = createTestUpload();
  const payload = verifyEpisodeAssetUploadToken(
    upload.upload_token,
    'episode-one'
  );
  const originalFetch = global.fetch;
  t.after(() => {
    global.fetch = originalFetch;
  });
  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '1024',
          'content-type': 'audio/wav',
          'x-amz-version-id': 'version-123',
          'last-modified': 'Sat, 25 Jul 2026 12:00:00 GMT',
        }[String(name).toLowerCase()];
      },
    },
  });

  assert.deepEqual(await verifyEpisodeAssetObject(payload), {
    size: 1024,
    content_type: 'audio/wav',
    object_version_id: 'version-123',
    uploaded_at: '2026-07-25T12:00:00.000Z',
  });

  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '2048',
          'content-type': 'audio/wav',
        }[String(name).toLowerCase()];
      },
    },
  });
  await assert.rejects(
    verifyEpisodeAssetObject(payload),
    /does not match its authorization/i
  );

  for (const versionId of ['', 'null']) {
    global.fetch = async () => ({
      ok: true,
      headers: {
        get(name) {
          return {
            'content-length': '1024',
            'content-type': 'audio/wav',
            'x-amz-version-id': versionId,
            'last-modified': 'Sat, 25 Jul 2026 12:00:00 GMT',
          }[String(name).toLowerCase()];
        },
      },
    });
    await assert.rejects(
      verifyEpisodeAssetObject(payload),
      /object storage versioning is required/i
    );
  }

  global.fetch = async () => ({
    ok: true,
    headers: {
      get(name) {
        return {
          'content-length': '1024',
          'content-type': 'audio/wav',
          'x-amz-version-id': 'version-123',
        }[String(name).toLowerCase()];
      },
    },
  });
  await assert.rejects(
    verifyEpisodeAssetObject(payload),
    /upload time could not be verified/i
  );
});

test('pins downloads to the verified version and forces attachment handling', () => {
  const upload = createTestUpload({ file_name: 'Episode (Final).wav' });
  const signedUrl = createEpisodeAssetDownloadUrl(upload.object_key, {
    episodeId: 'episode-one',
    fileName: upload.file_name,
    versionId: 'version-123',
  });
  const url = new URL(signedUrl);

  assert.equal(url.searchParams.get('versionId'), 'version-123');
  assert.match(
    url.searchParams.get('response-content-disposition'),
    /^attachment;/
  );
  assert.match(
    url.searchParams.get('response-content-disposition'),
    /Episode \(Final\)\.wav/
  );
  assert.match(signedUrl, /Episode%20%28Final%29\.wav/);
  assert.match(signedUrl, /filename%2A%3DUTF-8%27%27/);
  const canonicalQuery = signedUrl
    .split('?')[1]
    .split('&X-Amz-Signature=')[0];
  const encodedNames = canonicalQuery
    .split('&')
    .map((entry) => entry.split('=')[0]);
  assert.deepEqual(encodedNames, [...encodedNames].sort());
  assert.throws(
    () =>
      createEpisodeAssetDownloadUrl(upload.object_key, {
        episodeId: 'another-episode',
        fileName: upload.file_name,
      }),
    /stored object key is invalid/i
  );
});
