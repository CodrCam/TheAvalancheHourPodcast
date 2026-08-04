import sharp from 'sharp';

const MAX_THUMBNAIL_SOURCE_BYTES = 30 * 1024 * 1024;
const MAX_THUMBNAIL_PIXELS = 24_000_000;
const MAX_THUMBNAIL_OUTPUT_BYTES = 3 * 1024 * 1024;
const MAX_THUMBNAIL_CACHE_BYTES = 24 * 1024 * 1024;
const MAX_THUMBNAIL_CACHE_ENTRIES = 32;
const MAX_THUMBNAIL_CONCURRENCY = 2;
const MAX_THUMBNAIL_QUEUE = 20;
const THUMBNAIL_CACHE_TTL_MS = 10 * 60 * 1000;

const thumbnailCache = new Map();
const pendingThumbnails = new Map();
const thumbnailWaiters = [];
let thumbnailCacheBytes = 0;
let activeThumbnailJobs = 0;

export const EPISODE_THUMBNAIL_SOURCE_CONTENT_TYPES = Object.freeze([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/tiff',
  'image/heic',
  'image/heif',
  'image/bmp',
]);

const THUMBNAIL_SOURCE_TYPE_SET = new Set(
  EPISODE_THUMBNAIL_SOURCE_CONTENT_TYPES
);

function normalizedExpectedSize(value) {
  return Math.trunc(Number(value) || 0);
}

function cleanCacheKey(value) {
  return String(value || '').trim().slice(0, 2400);
}

function pruneThumbnailCache(nowMs = Date.now()) {
  for (const [key, entry] of thumbnailCache) {
    if (entry.expires_at_ms <= nowMs) {
      thumbnailCache.delete(key);
      thumbnailCacheBytes -= entry.bytes.length;
    }
  }
  while (
    thumbnailCache.size > MAX_THUMBNAIL_CACHE_ENTRIES ||
    thumbnailCacheBytes > MAX_THUMBNAIL_CACHE_BYTES
  ) {
    const oldestKey = thumbnailCache.keys().next().value;
    if (!oldestKey) break;
    const oldest = thumbnailCache.get(oldestKey);
    thumbnailCache.delete(oldestKey);
    thumbnailCacheBytes -= oldest?.bytes?.length || 0;
  }
}

async function withThumbnailJobSlot(task) {
  if (
    activeThumbnailJobs >= MAX_THUMBNAIL_CONCURRENCY &&
    thumbnailWaiters.length >= MAX_THUMBNAIL_QUEUE
  ) {
    throw new Error('Episode asset thumbnail: preview service is busy.');
  }
  if (activeThumbnailJobs >= MAX_THUMBNAIL_CONCURRENCY) {
    await new Promise((resolve) => thumbnailWaiters.push(resolve));
  }
  activeThumbnailJobs += 1;
  try {
    return await task();
  } finally {
    activeThumbnailJobs -= 1;
    thumbnailWaiters.shift()?.();
  }
}

export async function getOrCreateEpisodeAssetThumbnail(
  cacheKeyValue,
  createThumbnail
) {
  const cacheKey = cleanCacheKey(cacheKeyValue);
  if (!cacheKey || typeof createThumbnail !== 'function') {
    throw new Error('Episode asset thumbnail: cache request is invalid.');
  }
  const nowMs = Date.now();
  pruneThumbnailCache(nowMs);
  const cached = thumbnailCache.get(cacheKey);
  if (cached && cached.expires_at_ms > nowMs) {
    thumbnailCache.delete(cacheKey);
    thumbnailCache.set(cacheKey, cached);
    return Buffer.from(cached.bytes);
  }
  if (pendingThumbnails.has(cacheKey)) {
    return Buffer.from(await pendingThumbnails.get(cacheKey));
  }
  const pending = withThumbnailJobSlot(async () => {
    const bytes = Buffer.from(await createThumbnail());
    if (!bytes.length || bytes.length > MAX_THUMBNAIL_OUTPUT_BYTES) {
      throw new Error('Episode asset thumbnail: encoded preview is invalid.');
    }
    const previous = thumbnailCache.get(cacheKey);
    thumbnailCacheBytes -= previous?.bytes?.length || 0;
    thumbnailCache.delete(cacheKey);
    thumbnailCache.set(cacheKey, {
      bytes,
      expires_at_ms: Date.now() + THUMBNAIL_CACHE_TTL_MS,
    });
    thumbnailCacheBytes += bytes.length;
    pruneThumbnailCache();
    return bytes;
  });
  pendingThumbnails.set(cacheKey, pending);
  try {
    return Buffer.from(await pending);
  } finally {
    pendingThumbnails.delete(cacheKey);
  }
}

export function resetEpisodeAssetThumbnailCacheForTests() {
  thumbnailCache.clear();
  pendingThumbnails.clear();
  thumbnailWaiters.splice(0, thumbnailWaiters.length);
  thumbnailCacheBytes = 0;
  activeThumbnailJobs = 0;
}

export function canCreateEpisodeAssetThumbnail(asset = {}) {
  return (
    asset.category === 'image' &&
    THUMBNAIL_SOURCE_TYPE_SET.has(
      String(asset.content_type || '').trim().toLowerCase()
    ) &&
    Number(asset.size) > 0 &&
    Number(asset.size) <= MAX_THUMBNAIL_SOURCE_BYTES
  );
}

export async function createEpisodeAssetThumbnail(
  source,
  { contentType = '', expectedSize = 0 } = {}
) {
  const input = Buffer.isBuffer(source) ? source : Buffer.from(source || []);
  const normalizedContentType = String(contentType || '')
    .trim()
    .toLowerCase();
  if (!THUMBNAIL_SOURCE_TYPE_SET.has(normalizedContentType)) {
    throw new Error('Episode asset thumbnail: unsupported image type.');
  }
  if (!input.length || input.length > MAX_THUMBNAIL_SOURCE_BYTES) {
    throw new Error('Episode asset thumbnail: invalid image size.');
  }
  const expectedBytes = normalizedExpectedSize(expectedSize);
  if (
    expectedBytes > 0 &&
    expectedBytes !== input.length
  ) {
    throw new Error('Episode asset thumbnail: stored image size changed.');
  }

  const thumbnail = await sharp(input, {
    failOn: 'warning',
    limitInputPixels: MAX_THUMBNAIL_PIXELS,
    pages: 1,
    sequentialRead: true,
  })
    .rotate()
    .resize({
      width: 720,
      height: 520,
      fit: 'inside',
      withoutEnlargement: true,
    })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  if (!thumbnail.length || thumbnail.length > MAX_THUMBNAIL_OUTPUT_BYTES) {
    throw new Error('Episode asset thumbnail: encoded preview is invalid.');
  }
  return thumbnail;
}

export async function readEpisodeAssetThumbnailSource(
  response,
  { expectedSize = 0 } = {}
) {
  if (!response?.ok || !response.body) {
    throw new Error('Episode asset thumbnail: source is unavailable.');
  }
  const expectedBytes = normalizedExpectedSize(expectedSize);
  const declaredBytes = normalizedExpectedSize(
    response.headers?.get?.('content-length')
  );
  if (
    declaredBytes > MAX_THUMBNAIL_SOURCE_BYTES ||
    (expectedBytes > 0 && declaredBytes > 0 && declaredBytes !== expectedBytes)
  ) {
    throw new Error('Episode asset thumbnail: stored image size changed.');
  }

  const reader = response.body.getReader();
  const chunks = [];
  let receivedBytes = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      receivedBytes += value.byteLength;
      if (receivedBytes > MAX_THUMBNAIL_SOURCE_BYTES) {
        await reader.cancel();
        throw new Error('Episode asset thumbnail: source image is too large.');
      }
      chunks.push(Buffer.from(value));
    }
  } finally {
    reader.releaseLock();
  }
  if (expectedBytes > 0 && receivedBytes !== expectedBytes) {
    throw new Error('Episode asset thumbnail: stored image size changed.');
  }
  return Buffer.concat(chunks, receivedBytes);
}
