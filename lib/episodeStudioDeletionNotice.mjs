export const EPISODE_STUDIO_DELETION_NOTICE_KEY =
  'episode-studio-deletion-notice:v1';

const NOTICE_VERSION = 1;
const NOTICE_STATUSES = new Set(['scheduled', 'cleaning', 'deleted']);

function cleanText(value, maxLength = 220) {
  return String(value || '')
    .replace(/[\u0000-\u001f\u007f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, maxLength);
}

function cleanTimestamp(value) {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isNaN(timestamp) ? '' : new Date(timestamp).toISOString();
}

export function createEpisodeStudioDeletionNotice(value = {}) {
  const status = NOTICE_STATUSES.has(value.status)
    ? value.status
    : 'scheduled';
  return {
    version: NOTICE_VERSION,
    status,
    title: cleanText(value.title),
    deletion_ready_at: cleanTimestamp(value.deletion_ready_at),
  };
}

export function storeEpisodeStudioDeletionNotice(storage, value = {}) {
  if (typeof storage?.setItem !== 'function') return false;
  try {
    storage.setItem(
      EPISODE_STUDIO_DELETION_NOTICE_KEY,
      JSON.stringify(createEpisodeStudioDeletionNotice(value))
    );
    return true;
  } catch {
    return false;
  }
}

export function consumeEpisodeStudioDeletionNotice(storage) {
  if (
    typeof storage?.getItem !== 'function' ||
    typeof storage?.removeItem !== 'function'
  ) {
    return null;
  }
  let raw = '';
  try {
    raw = storage.getItem(EPISODE_STUDIO_DELETION_NOTICE_KEY) || '';
    storage.removeItem(EPISODE_STUDIO_DELETION_NOTICE_KEY);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== NOTICE_VERSION) return null;
    return createEpisodeStudioDeletionNotice(parsed);
  } catch {
    return null;
  }
}

export function getEpisodeStudioDeletionNoticeCopy(
  value = {},
  { formatDate = (date) => new Date(date).toLocaleString() } = {}
) {
  const notice = createEpisodeStudioDeletionNotice(value);
  const quotedTitle = notice.title ? `“${notice.title}”` : 'The Episode Studio';

  if (notice.status === 'deleted') {
    return {
      heading: `${quotedTitle} was permanently deleted.`,
      body:
        'Its Studio content, uploaded files, notes, and questionnaire data were removed. You are back on the production calendar.',
    };
  }

  if (notice.status === 'cleaning') {
    return {
      heading: `Deletion is in progress for ${quotedTitle}.`,
      body:
        'The Studio is locked while automatic cleanup removes remaining private storage. No further action is required; it remains listed as “Deletion scheduled” until cleanup finishes.',
    };
  }

  const readyLabel = notice.deletion_ready_at
    ? cleanText(formatDate(notice.deletion_ready_at), 120)
    : '';
  return {
    heading: `Deletion is scheduled for ${quotedTitle}.`,
    body: readyLabel
      ? `The Studio is locked now. Automatic cleanup can permanently remove its private content after ${readyLabel}. No further action is required; it remains listed as “Deletion scheduled” until cleanup finishes.`
      : 'The Studio is locked now. Automatic cleanup will permanently remove its private content after the upload-safety window closes. No further action is required; it remains listed as “Deletion scheduled” until cleanup finishes.',
  };
}
