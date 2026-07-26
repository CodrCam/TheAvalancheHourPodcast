export const EPISODE_RECORDING_TIME_ZONES = [
  { value: 'America/Los_Angeles', label: 'Pacific — Los Angeles / Vancouver' },
  { value: 'America/Denver', label: 'Mountain — Denver' },
  { value: 'America/Phoenix', label: 'Arizona — Phoenix' },
  { value: 'America/Edmonton', label: 'Mountain — Edmonton' },
  { value: 'America/Chicago', label: 'Central — Chicago' },
  { value: 'America/Winnipeg', label: 'Central — Winnipeg' },
  { value: 'America/New_York', label: 'Eastern — New York' },
  { value: 'America/Toronto', label: 'Eastern — Toronto' },
  { value: 'America/Halifax', label: 'Atlantic — Halifax' },
  { value: 'America/St_Johns', label: 'Newfoundland — St. John’s' },
  { value: 'America/Anchorage', label: 'Alaska — Anchorage' },
  { value: 'Pacific/Honolulu', label: 'Hawaii — Honolulu' },
  { value: 'UTC', label: 'UTC' },
];

export const EPISODE_RECORDING_DURATIONS = [30, 45, 60, 75, 90, 120];

export function normalizeRecordingDate(value) {
  const date = String(value || '').trim().slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === date
    ? date
    : '';
}

export function normalizeRecordingTime(value) {
  const time = String(value || '').trim().slice(0, 5);
  return /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(time) ? time : '';
}

export function normalizeRecordingTimeZone(value) {
  const timeZone = String(value || '').trim().slice(0, 80);
  if (!timeZone) return '';
  try {
    new Intl.DateTimeFormat('en-US', { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return '';
  }
}

export function normalizeRecordingDuration(value) {
  if (value === '' || value === null || value === undefined) return 60;
  const duration = Math.round(Number(value));
  if (!Number.isFinite(duration)) return 60;
  return Math.min(480, Math.max(15, duration));
}

export function validateRecordingSchedule(value = {}) {
  const rawDate = String(value.recording_date || '').trim();
  const rawTime = String(value.recording_time || '').trim();
  const rawTimeZone = String(value.recording_time_zone || '').trim();
  const rawLocation = String(value.recording_location || '').trim();
  const started = Boolean(rawDate || rawTime || rawTimeZone || rawLocation);

  if (!started) return { complete: false };
  if (!normalizeRecordingDate(rawDate)) {
    throw new Error('Episode Studio: choose a valid recording date.');
  }
  if (!normalizeRecordingTime(rawTime)) {
    throw new Error('Episode Studio: choose a valid recording time.');
  }
  if (!normalizeRecordingTimeZone(rawTimeZone)) {
    throw new Error('Episode Studio: choose a valid recording time zone.');
  }

  const start = recordingStartDate(value);
  if (!start) {
    throw new Error(
      'Episode Studio: that recording time does not exist in the selected time zone.'
    );
  }

  return { complete: true, start };
}

function localPartsAt(instant, timeZone) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(instant);
  const values = Object.fromEntries(
    parts
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hour: values.hour,
    minute: values.minute,
    second: values.second,
  };
}

export function recordingStartDate(value = {}) {
  const date = normalizeRecordingDate(value.recording_date);
  const time = normalizeRecordingTime(value.recording_time);
  const timeZone = normalizeRecordingTimeZone(value.recording_time_zone);
  if (!date || !time || !timeZone) return null;

  const [year, month, day] = date.split('-').map(Number);
  const [hour, minute] = time.split(':').map(Number);
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0);
  let guess = desired;

  for (let attempt = 0; attempt < 4; attempt += 1) {
    const observed = localPartsAt(new Date(guess), timeZone);
    const observedAsUtc = Date.UTC(
      observed.year,
      observed.month - 1,
      observed.day,
      observed.hour,
      observed.minute,
      observed.second
    );
    const nextGuess = guess + (desired - observedAsUtc);
    if (nextGuess === guess) break;
    guess = nextGuess;
  }

  const resolved = localPartsAt(new Date(guess), timeZone);
  if (
    resolved.year !== year ||
    resolved.month !== month ||
    resolved.day !== day ||
    resolved.hour !== hour ||
    resolved.minute !== minute
  ) {
    return null;
  }
  return new Date(guess);
}

export function formatRecordingSchedule(value = {}, locale = 'en-US') {
  const start = recordingStartDate(value);
  const timeZone = normalizeRecordingTimeZone(value.recording_time_zone);
  if (!start || !timeZone) return '';
  return new Intl.DateTimeFormat(locale, {
    timeZone,
    weekday: 'short',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZoneName: 'short',
  }).format(start);
}

function escapeCalendarText(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function calendarTimestamp(value) {
  return value
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}Z$/, 'Z');
}

function foldCalendarLine(line) {
  const chunks = [];
  let chunk = '';
  let chunkBytes = 0;
  let limit = 75;
  const encoder = new TextEncoder();

  for (const character of line) {
    const characterBytes = encoder.encode(character).length;
    if (chunk && chunkBytes + characterBytes > limit) {
      chunks.push(chunk);
      chunk = character;
      chunkBytes = characterBytes;
      limit = 74;
    } else {
      chunk += character;
      chunkBytes += characterBytes;
    }
  }
  if (chunk) chunks.push(chunk);
  return chunks.join('\r\n ');
}

export function episodeCalendarFilename(value = {}) {
  const title = String(value.title || value.episode_id || 'episode-recording')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);
  return `${title || 'episode-recording'}-recording.ics`;
}

export function buildEpisodeCalendarFile(
  value = {},
  { now = new Date(), siteUrl = 'https://www.theavalanchehour.com' } = {}
) {
  const { start } = validateRecordingSchedule(value);
  const duration = normalizeRecordingDuration(
    value.recording_duration_minutes
  );
  const end = new Date(start.getTime() + duration * 60 * 1000);
  const episodeId = String(value.episode_id || '').trim();
  const title = String(value.title || 'Untitled episode').trim();
  const studioUrl = episodeId
    ? `${String(siteUrl).replace(/\/+$/, '')}/studio/episodes/${encodeURIComponent(
        episodeId
      )}`
    : String(siteUrl).replace(/\/+$/, '');
  const description = `Recording session for The Avalanche Hour. Episode Studio: ${studioUrl}`;
  const uidToken = (episodeId || title || 'episode')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 100);
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//The Avalanche Hour//Team Studio//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:recording-${uidToken || 'episode'}@theavalanchehour.com`,
    `DTSTAMP:${calendarTimestamp(new Date(now))}`,
    `DTSTART:${calendarTimestamp(start)}`,
    `DTEND:${calendarTimestamp(end)}`,
    `SUMMARY:${escapeCalendarText(`The Avalanche Hour recording: ${title}`)}`,
    `DESCRIPTION:${escapeCalendarText(description)}`,
    value.recording_location
      ? `LOCATION:${escapeCalendarText(value.recording_location)}`
      : '',
    `URL:${studioUrl}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].filter(Boolean);

  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}
