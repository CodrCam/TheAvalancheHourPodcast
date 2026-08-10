export const MAX_STUDIO_RESOURCE_VIDEOS_PER_SECTION = 12;
export const MAX_STUDIO_RESOURCE_VIDEO_BYTES = 2 * 1024 * 1024 * 1024;
export const STUDIO_RESOURCE_VIDEO_CONTENT_TYPE = 'video/mp4';

function cleanText(value, maxLength) {
  return String(value || '').trim().slice(0, maxLength);
}

export function sanitizeStudioResourceVideoFileName(value = '') {
  const fileName = String(value || '')
    .normalize('NFKC')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^\.+/, '')
    .slice(0, 180);
  return fileName || 'resource-video.mp4';
}

export function validateStudioResourceVideoFile(file = {}) {
  const file_name = sanitizeStudioResourceVideoFileName(file.file_name);
  const content_type = cleanText(file.content_type, 120).toLowerCase();
  const size = Math.trunc(Number(file.size) || 0);

  if (content_type !== STUDIO_RESOURCE_VIDEO_CONTENT_TYPE) {
    throw new Error(
      'Resource video: use an MP4 file for reliable playback across the team.'
    );
  }
  if (!file_name.toLowerCase().endsWith('.mp4')) {
    throw new Error('Resource video: the uploaded file must use the .mp4 extension.');
  }
  if (!Number.isSafeInteger(size) || size <= 0) {
    throw new Error('Resource video: choose a non-empty MP4 file.');
  }
  if (size > MAX_STUDIO_RESOURCE_VIDEO_BYTES) {
    throw new Error('Resource video: MP4 files must be 2 GB or smaller.');
  }

  return { file_name, content_type, size };
}

export function isStudioResourceVideoId(value = '') {
  return /^resource-video-[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
    String(value || '').trim()
  );
}

export function isStudioResourceVideoObjectKey(value = '', videoId = '') {
  const objectKey = String(value || '').trim();
  const parts = objectKey.split('/');
  const expectedVideoId = String(videoId || '').trim();
  return (
    isStudioResourceVideoId(expectedVideoId) &&
    parts.length === 3 &&
    parts[0] === 'studio-resources' &&
    parts[1] === 'videos' &&
    parts[2].startsWith(`${expectedVideoId}-`) &&
    parts[2].toLowerCase().endsWith('.mp4') &&
    !/[\u0000-\u001f\u007f]/.test(objectKey)
  );
}

export function normalizeStudioResourceVideo(value = {}, index = 0) {
  const id = cleanText(value.id, 100);
  const fileName = sanitizeStudioResourceVideoFileName(value.file_name);
  const size = Math.trunc(Number(value.size) || 0);

  return {
    id,
    title: cleanText(value.title, 180) || `Resource video ${index + 1}`,
    description: cleanText(value.description, 800),
    file_name: fileName,
    object_key: cleanText(value.object_key, 1000),
    object_version_id: cleanText(value.object_version_id, 1024),
    content_type: cleanText(value.content_type, 120).toLowerCase(),
    size,
    active: value.active === true,
  };
}

export function validateStudioResourceVideoReference(value = {}) {
  const video = normalizeStudioResourceVideo(value);
  validateStudioResourceVideoFile(video);
  if (!isStudioResourceVideoId(video.id)) {
    throw new Error('Resource video: the stored video ID is invalid.');
  }
  if (!isStudioResourceVideoObjectKey(video.object_key, video.id)) {
    throw new Error('Resource video: the stored object key is invalid.');
  }
  if (
    !video.object_version_id ||
    video.object_version_id === 'null' ||
    /[\u0000-\u001f\u007f]/.test(video.object_version_id)
  ) {
    throw new Error('Resource video: the stored object version is invalid.');
  }
  return video;
}
