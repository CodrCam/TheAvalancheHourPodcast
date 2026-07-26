const MEBIBYTE = 1024 * 1024;
const GIBIBYTE = 1024 * MEBIBYTE;

export const EPISODE_ASSET_CATEGORIES = [
  'recording',
  'image',
  'document',
  'sponsor_audio',
  'other',
];

export const MAX_EPISODE_ASSETS = 250;

export const EPISODE_ASSET_MAX_BYTES = Object.freeze({
  image: 30 * MEBIBYTE,
  document: 75 * MEBIBYTE,
  audio: 1.5 * GIBIBYTE,
  video: 750 * MEBIBYTE,
});

const GENERIC_CONTENT_TYPES = new Set([
  '',
  'application/octet-stream',
  'binary/octet-stream',
]);

const FORMAT_DEFINITIONS = [
  {
    extensions: ['wav'],
    contentType: 'audio/wav',
    aliases: ['audio/x-wav', 'audio/wave', 'audio/vnd.wave'],
    kind: 'audio',
    label: 'WAV audio',
  },
  {
    extensions: ['mp3'],
    contentType: 'audio/mpeg',
    aliases: ['audio/mp3', 'audio/x-mp3', 'audio/x-mpeg'],
    kind: 'audio',
    label: 'MP3 audio',
  },
  {
    extensions: ['m4a'],
    contentType: 'audio/mp4',
    aliases: ['audio/m4a', 'audio/x-m4a'],
    kind: 'audio',
    label: 'M4A audio',
  },
  {
    extensions: ['aac'],
    contentType: 'audio/aac',
    aliases: ['audio/x-aac'],
    kind: 'audio',
    label: 'AAC audio',
  },
  {
    extensions: ['aif', 'aiff'],
    contentType: 'audio/aiff',
    aliases: ['audio/x-aiff'],
    kind: 'audio',
    label: 'AIFF audio',
  },
  {
    extensions: ['flac'],
    contentType: 'audio/flac',
    aliases: ['audio/x-flac'],
    kind: 'audio',
    label: 'FLAC audio',
  },
  {
    extensions: ['ogg', 'oga'],
    contentType: 'audio/ogg',
    aliases: ['application/ogg'],
    kind: 'audio',
    label: 'Ogg audio',
  },
  {
    extensions: ['opus'],
    contentType: 'audio/opus',
    aliases: ['audio/ogg'],
    kind: 'audio',
    label: 'Opus audio',
  },
  {
    extensions: ['caf'],
    contentType: 'audio/x-caf',
    aliases: ['audio/caf'],
    kind: 'audio',
    label: 'CAF audio',
  },
  {
    extensions: ['mp4'],
    contentType: 'video/mp4',
    aliases: [],
    kind: 'video',
    label: 'MP4 video',
  },
  {
    extensions: ['mov'],
    contentType: 'video/quicktime',
    aliases: [],
    kind: 'video',
    label: 'QuickTime video',
  },
  {
    extensions: ['m4v'],
    contentType: 'video/x-m4v',
    aliases: ['video/mp4'],
    kind: 'video',
    label: 'M4V video',
  },
  {
    extensions: ['webm'],
    contentType: 'video/webm',
    aliases: [],
    kind: 'video',
    label: 'WebM video',
  },
  {
    extensions: ['jpg', 'jpeg'],
    contentType: 'image/jpeg',
    aliases: ['image/jpg', 'image/pjpeg'],
    kind: 'image',
    label: 'JPEG image',
  },
  {
    extensions: ['png'],
    contentType: 'image/png',
    aliases: ['image/x-png'],
    kind: 'image',
    label: 'PNG image',
  },
  {
    extensions: ['gif'],
    contentType: 'image/gif',
    aliases: [],
    kind: 'image',
    label: 'GIF image',
  },
  {
    extensions: ['webp'],
    contentType: 'image/webp',
    aliases: [],
    kind: 'image',
    label: 'WebP image',
  },
  {
    extensions: ['avif'],
    contentType: 'image/avif',
    aliases: [],
    kind: 'image',
    label: 'AVIF image',
  },
  {
    extensions: ['tif', 'tiff'],
    contentType: 'image/tiff',
    aliases: ['image/x-tiff'],
    kind: 'image',
    label: 'TIFF image',
  },
  {
    extensions: ['heic'],
    contentType: 'image/heic',
    aliases: ['image/heic-sequence'],
    kind: 'image',
    label: 'HEIC image',
  },
  {
    extensions: ['heif'],
    contentType: 'image/heif',
    aliases: ['image/heif-sequence'],
    kind: 'image',
    label: 'HEIF image',
  },
  {
    extensions: ['bmp'],
    contentType: 'image/bmp',
    aliases: ['image/x-ms-bmp'],
    kind: 'image',
    label: 'BMP image',
  },
  {
    extensions: ['pdf'],
    contentType: 'application/pdf',
    aliases: [],
    kind: 'document',
    label: 'PDF document',
  },
  {
    extensions: ['docx'],
    contentType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    aliases: [],
    kind: 'document',
    label: 'Word document',
  },
  {
    extensions: ['odt'],
    contentType: 'application/vnd.oasis.opendocument.text',
    aliases: [],
    kind: 'document',
    label: 'OpenDocument text',
  },
  {
    extensions: ['txt'],
    contentType: 'text/plain',
    aliases: [],
    kind: 'document',
    label: 'Plain text',
  },
  {
    extensions: ['md', 'markdown'],
    contentType: 'text/markdown',
    aliases: ['text/plain'],
    kind: 'document',
    label: 'Markdown document',
  },
  {
    extensions: ['csv'],
    contentType: 'text/csv',
    aliases: ['application/csv', 'text/plain'],
    kind: 'document',
    label: 'CSV spreadsheet',
  },
  {
    extensions: ['xlsx'],
    contentType:
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    aliases: [],
    kind: 'document',
    label: 'Excel spreadsheet',
  },
  {
    extensions: ['ods'],
    contentType: 'application/vnd.oasis.opendocument.spreadsheet',
    aliases: [],
    kind: 'document',
    label: 'OpenDocument spreadsheet',
  },
  {
    extensions: ['pptx'],
    contentType:
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    aliases: [],
    kind: 'document',
    label: 'PowerPoint presentation',
  },
  {
    extensions: ['odp'],
    contentType: 'application/vnd.oasis.opendocument.presentation',
    aliases: [],
    kind: 'document',
    label: 'OpenDocument presentation',
  },
  {
    extensions: ['json'],
    contentType: 'application/json',
    aliases: ['text/json'],
    kind: 'document',
    label: 'JSON data',
  },
  {
    extensions: ['srt'],
    contentType: 'application/x-subrip',
    aliases: ['text/plain', 'text/srt'],
    kind: 'document',
    label: 'SRT transcript',
  },
  {
    extensions: ['vtt'],
    contentType: 'text/vtt',
    aliases: ['text/plain'],
    kind: 'document',
    label: 'WebVTT transcript',
  },
  {
    extensions: ['edl'],
    contentType: 'text/plain',
    aliases: ['application/edl'],
    kind: 'document',
    label: 'Edit decision list',
  },
];

const FORMAT_BY_EXTENSION = new Map();
const FORMATS_BY_CONTENT_TYPE = new Map();

for (const definition of FORMAT_DEFINITIONS) {
  for (const extension of definition.extensions) {
    FORMAT_BY_EXTENSION.set(extension, definition);
  }
  for (const contentType of [
    definition.contentType,
    ...definition.aliases,
  ]) {
    const formats = FORMATS_BY_CONTENT_TYPE.get(contentType) || [];
    FORMATS_BY_CONTENT_TYPE.set(contentType, [...formats, definition]);
  }
}

function normalizeContentType(value = '') {
  return String(value || '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase()
    .slice(0, 160);
}

function fileExtension(value = '') {
  const fileName = String(value || '').trim();
  const dotIndex = fileName.lastIndexOf('.');
  if (dotIndex <= 0 || dotIndex === fileName.length - 1) return '';
  return fileName.slice(dotIndex + 1).toLowerCase();
}

function categoryKinds(category) {
  if (['recording', 'sponsor_audio'].includes(category)) return ['audio'];
  if (category === 'image') return ['image'];
  if (category === 'document') return ['document'];
  return ['audio', 'video', 'image', 'document'];
}

function supportedTypeMessage(category) {
  if (['recording', 'sponsor_audio'].includes(category)) {
    return 'Use a WAV, MP3, M4A, AAC, AIFF, FLAC, Ogg, Opus, or CAF audio file.';
  }
  if (category === 'image') {
    return 'Use a JPG, PNG, GIF, WebP, AVIF, TIFF, HEIC, HEIF, or BMP image.';
  }
  if (category === 'document') {
    return 'Use a PDF, DOCX, text, spreadsheet, presentation, JSON, transcript, or EDL file.';
  }
  return 'Use a supported audio, video, raster image, document, transcript, or edit-list file. Executables, scripts, SVG, macro-enabled documents, and archives are not accepted.';
}

function humanFileSize(bytes) {
  if (bytes >= GIBIBYTE) {
    const gibibytes = bytes / GIBIBYTE;
    return `${Number.isInteger(gibibytes) ? gibibytes : gibibytes.toFixed(1)} GB`;
  }
  return `${Math.round(bytes / MEBIBYTE)} MB`;
}

export function sanitizeEpisodeAssetFileName(value = '') {
  const normalized = String(value || '')
    .normalize('NFKC')
    .replace(/[\p{Cc}\p{Cf}\/\\]+/gu, '-')
    .replace(/[<>:"|?*]+/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/^[.\s]+|[.\s]+$/g, '');
  if (!normalized) return '';
  const characters = Array.from(normalized);
  if (characters.length <= 180) return normalized;

  const extension = fileExtension(normalized);
  if (!extension) return characters.slice(0, 180).join('').trim();
  const suffix = `.${extension}`;
  const stem = normalized.slice(0, -suffix.length);
  return `${Array.from(stem)
    .slice(0, Math.max(1, 180 - Array.from(suffix).length))
    .join('')
    .replace(/[.\s-]+$/g, '')}${suffix}`;
}

export function getEpisodeAssetMaxBytes(category, kind) {
  const normalizedCategory = EPISODE_ASSET_CATEGORIES.includes(category)
    ? category
    : 'other';
  const resolvedKind =
    kind ||
    (normalizedCategory === 'image'
      ? 'image'
      : normalizedCategory === 'document'
        ? 'document'
        : 'audio');
  return EPISODE_ASSET_MAX_BYTES[resolvedKind] || EPISODE_ASSET_MAX_BYTES.audio;
}

export function validateEpisodeAssetInput(value = {}) {
  const requestedCategory = String(value.category || '').trim();
  const category = EPISODE_ASSET_CATEGORIES.includes(requestedCategory)
    ? requestedCategory
    : 'other';
  const originalName = String(value.file_name || '').trim();
  const fileName = sanitizeEpisodeAssetFileName(originalName);
  const extension = fileExtension(fileName);
  const definition = FORMAT_BY_EXTENSION.get(extension);

  if (!fileName || !definition || !categoryKinds(category).includes(definition.kind)) {
    throw new Error(
      `Episode asset: “${originalName || 'This file'}” is not supported for this step. ${supportedTypeMessage(
        category
      )}`
    );
  }

  const claimedContentType = normalizeContentType(value.content_type);
  const allowedContentTypes = new Set([
    definition.contentType,
    ...definition.aliases,
  ]);
  if (
    !GENERIC_CONTENT_TYPES.has(claimedContentType) &&
    !allowedContentTypes.has(claimedContentType)
  ) {
    throw new Error(
      `Episode asset: “${fileName}” has a file extension and type that do not match. ${supportedTypeMessage(
        category
      )}`
    );
  }

  const numericSize = Number(value.size);
  const size = Math.trunc(numericSize);
  if (!Number.isSafeInteger(numericSize) || numericSize !== size || size <= 0) {
    throw new Error(
      `Episode asset: “${fileName}” is empty or has an invalid size.`
    );
  }
  const maxSize = getEpisodeAssetMaxBytes(category, definition.kind);
  if (size > maxSize) {
    throw new Error(
      `Episode asset: “${fileName}” exceeds the ${humanFileSize(
        maxSize
      )} limit for ${definition.kind} files.`
    );
  }

  return {
    file_name: fileName,
    content_type: definition.contentType,
    size,
    category,
  };
}

export function getEpisodeAssetAccept(category = 'other') {
  const kinds = new Set(categoryKinds(category));
  const definitions = FORMAT_DEFINITIONS.filter((definition) =>
    kinds.has(definition.kind)
  );
  return [
    ...new Set(
      definitions.flatMap((definition) => [
        ...definition.extensions.map((extension) => `.${extension}`),
        definition.contentType,
      ])
    ),
  ].join(',');
}

export function getEpisodeAssetTypeLabel(value = {}) {
  const extensionDefinition = FORMAT_BY_EXTENSION.get(
    fileExtension(value.file_name)
  );
  if (extensionDefinition) return extensionDefinition.label;

  const contentType = normalizeContentType(value.content_type);
  const contentTypeDefinitions = FORMATS_BY_CONTENT_TYPE.get(contentType);
  if (contentTypeDefinitions?.length === 1) {
    return contentTypeDefinitions[0].label;
  }
  return contentType || 'Production file';
}

export function episodeAssetMatchesUploadAuthorization(
  asset = {},
  authorization = {}
) {
  return (
    asset.asset_id === authorization.asset_id &&
    asset.object_key === authorization.object_key &&
    asset.file_name === authorization.file_name &&
    asset.content_type === authorization.content_type &&
    asset.size === authorization.size &&
    asset.category === authorization.category &&
    asset.deliverable_id === authorization.deliverable_id &&
    asset.uploaded_by_person_id === authorization.uploader_person_id
  );
}

export function canUploadEpisodeAssets({
  roles = [],
  status = '',
} = {}) {
  const assignedRoles = new Set(Array.isArray(roles) ? roles : []);
  const hostStatuses = new Set(['planning', 'in_progress', 'needs_changes']);
  const producerStatuses = new Set([
    'planning',
    'in_progress',
    'submitted',
    'submitted_with_gaps',
    'needs_changes',
  ]);
  if (assignedRoles.has('producer')) return producerStatuses.has(status);
  return assignedRoles.has('host') && hostStatuses.has(status);
}
