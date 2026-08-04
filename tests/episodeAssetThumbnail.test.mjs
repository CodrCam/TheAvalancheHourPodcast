import assert from 'node:assert/strict';
import test from 'node:test';
import sharp from 'sharp';
import {
  canCreateEpisodeAssetThumbnail,
  createEpisodeAssetThumbnail,
  getOrCreateEpisodeAssetThumbnail,
  readEpisodeAssetThumbnailSource,
  resetEpisodeAssetThumbnailCacheForTests,
} from '../lib/episodeAssetThumbnail.js';

test('decodes a validated raster and re-encodes a bounded WebP thumbnail', async () => {
  const source = await sharp({
    create: {
      width: 1200,
      height: 800,
      channels: 3,
      background: '#50788a',
    },
  })
    .png()
    .toBuffer();
  const thumbnail = await createEpisodeAssetThumbnail(source, {
    contentType: 'image/png',
    expectedSize: source.length,
  });
  const metadata = await sharp(thumbnail).metadata();

  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.width <= 720, true);
  assert.equal(metadata.height <= 520, true);
  assert.equal(thumbnail.length > 0, true);
});

test('thumbnail policy rejects active content, mismatched sizes, and non-images', async () => {
  assert.equal(
    canCreateEpisodeAssetThumbnail({
      category: 'image',
      content_type: 'image/jpeg',
      size: 1024,
    }),
    true
  );
  assert.equal(
    canCreateEpisodeAssetThumbnail({
      category: 'image',
      content_type: 'image/svg+xml',
      size: 1024,
    }),
    false
  );
  assert.equal(
    canCreateEpisodeAssetThumbnail({
      category: 'document',
      content_type: 'image/png',
      size: 1024,
    }),
    false
  );
  await assert.rejects(
    () =>
      createEpisodeAssetThumbnail(Buffer.from('not-an-image'), {
        contentType: 'image/svg+xml',
      }),
    /unsupported image type/i
  );
  const png = await sharp({
    create: {
      width: 10,
      height: 10,
      channels: 3,
      background: '#000000',
    },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () =>
      createEpisodeAssetThumbnail(png, {
        contentType: 'image/png',
        expectedSize: png.length + 1,
      }),
    /stored image size changed/i
  );
});

test('thumbnail source reading enforces immutable byte length while streaming', async () => {
  const source = Buffer.from('bounded-image-source');
  const response = new Response(source, {
    status: 200,
    headers: { 'Content-Length': String(source.length) },
  });
  assert.deepEqual(
    await readEpisodeAssetThumbnailSource(response, {
      expectedSize: source.length,
    }),
    source
  );

  await assert.rejects(
    () =>
      readEpisodeAssetThumbnailSource(
        new Response(source, {
          status: 200,
          headers: { 'Content-Length': String(source.length) },
        }),
        { expectedSize: source.length + 1 }
      ),
    /stored image size changed/i
  );
});

test('thumbnail cache coalesces repeated immutable-version work', async () => {
  resetEpisodeAssetThumbnailCacheForTests();
  let createCalls = 0;
  const create = async () => {
    createCalls += 1;
    await new Promise((resolve) => setTimeout(resolve, 5));
    return Buffer.from('safe-webp-thumbnail');
  };
  const results = await Promise.all([
    getOrCreateEpisodeAssetThumbnail('episode:asset:version-one', create),
    getOrCreateEpisodeAssetThumbnail('episode:asset:version-one', create),
    getOrCreateEpisodeAssetThumbnail('episode:asset:version-one', create),
  ]);
  assert.equal(createCalls, 1);
  assert.equal(results.every((value) => value.equals(results[0])), true);
  await getOrCreateEpisodeAssetThumbnail(
    'episode:asset:version-one',
    create
  );
  assert.equal(createCalls, 1);
  resetEpisodeAssetThumbnailCacheForTests();
});
