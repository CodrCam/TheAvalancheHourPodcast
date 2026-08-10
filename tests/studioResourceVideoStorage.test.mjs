import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createStudioResourceVideoPlaybackUrl,
  createStudioResourceVideoUpload,
  verifyStudioResourceVideoObject,
  verifyStudioResourceVideoUploadToken,
} from '../lib/studioResourceVideoStorage.js';
import {
  MAX_STUDIO_RESOURCE_VIDEO_BYTES,
  normalizeStudioResourceVideo,
  validateStudioResourceVideoFile,
  validateStudioResourceVideoReference,
} from '../lib/studioResourceVideoPolicy.mjs';

process.env.STUDIO_RESOURCE_VIDEOS_S3_BUCKET = 'resource-videos';
process.env.STUDIO_RESOURCE_VIDEOS_S3_REGION = 'us-east-2';
process.env.STUDIO_RESOURCE_VIDEOS_ACCESS_KEY_ID = 'AKIATESTONLY';
process.env.STUDIO_RESOURCE_VIDEOS_SECRET_ACCESS_KEY = 'test-secret';
process.env.STUDIO_RESOURCE_VIDEOS_UPLOAD_TOKEN_SECRET = 'test-token-secret';

test('creates an exact-size protected MP4 upload with a signed completion token', () => {
  const upload = createStudioResourceVideoUpload({
    uploaderId: 'studio-manager',
    file: {
      file_name: 'Host Walkthrough.mp4',
      content_type: 'video/mp4',
      size: 1184604164,
    },
  });

  assert.equal(upload.upload_method, 'PUT');
  assert.equal(upload.upload_headers['Content-Type'], 'video/mp4');
  assert.equal(upload.upload_headers['If-None-Match'], '*');
  assert.match(
    upload.object_key,
    /^studio-resources\/videos\/resource-video-.+-Host Walkthrough\.mp4$/
  );
  assert.match(upload.upload_url, /X-Amz-SignedHeaders=content-length%3B/);
  const verified = verifyStudioResourceVideoUploadToken(upload.upload_token);
  assert.equal(verified.object_key, upload.object_key);
  assert.equal(verified.size, 1184604164);
});

test('accepts the supplied walkthrough but rejects non-MP4 and oversized files', () => {
  assert.equal(
    validateStudioResourceVideoFile({
      file_name: 'Host Walkthrough.mp4',
      content_type: 'video/mp4',
      size: 1184604164,
    }).size,
    1184604164
  );
  assert.throws(
    () =>
      validateStudioResourceVideoFile({
        file_name: 'walkthrough.mov',
        content_type: 'video/quicktime',
        size: 100,
      }),
    /use an MP4/i
  );
  assert.throws(
    () =>
      validateStudioResourceVideoFile({
        file_name: 'walkthrough.mp4',
        content_type: 'video/mp4',
        size: MAX_STUDIO_RESOURCE_VIDEO_BYTES + 1,
      }),
    /2 GB or smaller/i
  );
});

test('keeps legacy videos on the host path and rejects unknown resource paths', () => {
  assert.equal(normalizeStudioResourceVideo({}).resource_path, 'host');
  assert.throws(
    () =>
      validateStudioResourceVideoReference({
        id: 'resource-video-123e4567-e89b-42d3-a456-426614174000',
        title: 'Walkthrough',
        file_name: 'Walkthrough.mp4',
        object_key:
          'studio-resources/videos/resource-video-123e4567-e89b-42d3-a456-426614174000-Walkthrough.mp4',
        object_version_id: 'version-1',
        content_type: 'video/mp4',
        size: 2048,
        active: true,
        resource_path: 'finance',
      }),
    /resource path is invalid/i
  );
});

test('verifies object size, MIME, version, and MP4 signature before publishing', async (t) => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  t.after(() => {
    globalThis.fetch = originalFetch;
  });
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (options.method === 'HEAD') {
      return new Response(null, {
        status: 200,
        headers: {
          'content-length': '2048',
          'content-type': 'video/mp4',
          'x-amz-version-id': 'version-123',
        },
      });
    }
    const header = Buffer.alloc(16);
    header.writeUInt32BE(16, 0);
    header.write('ftyp', 4, 'latin1');
    header.write('isom', 8, 'latin1');
    return new Response(header, { status: 206 });
  };

  const videoId = 'resource-video-123e4567-e89b-42d3-a456-426614174000';
  const verified = await verifyStudioResourceVideoObject({
    video_id: videoId,
    object_key: `studio-resources/videos/${videoId}-walkthrough.mp4`,
    file_name: 'walkthrough.mp4',
    content_type: 'video/mp4',
    size: 2048,
  });

  assert.equal(verified.object_version_id, 'version-123');
  assert.equal(calls.length, 2);
  assert.equal(calls[1].options.headers.range, 'bytes=0-63');
  assert.match(calls[1].url, /versionId=version-123/);
});

test('creates expiring inline playback for one immutable object version', () => {
  const videoId = 'resource-video-123e4567-e89b-42d3-a456-426614174000';
  const url = createStudioResourceVideoPlaybackUrl({
    id: videoId,
    title: 'Host walkthrough',
    description: '',
    file_name: 'Host Walkthrough.mp4',
    object_key: `studio-resources/videos/${videoId}-Host Walkthrough.mp4`,
    object_version_id: 'version-123',
    content_type: 'video/mp4',
    size: 1184604164,
    active: true,
    featured: true,
  });

  assert.match(url, /X-Amz-Expires=14400/);
  assert.match(url, /versionId=version-123/);
  assert.match(url, /response-content-disposition=inline/);
  assert.match(url, /response-content-type=video%2Fmp4/);
});
