export const EMPTY_EPISODE_REQUEST_FORM = {
  working_title: '',
  pitch: '',
  proposed_guest: '',
  preferred_air_date: '',
};

function cleanText(value) {
  return String(value ?? '')
    .replace(/\r\n?/g, '\n')
    .trim();
}

function isCalendarDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const parsed = new Date(`${value}T12:00:00Z`);
  return (
    !Number.isNaN(parsed.getTime()) &&
    parsed.toISOString().slice(0, 10) === value
  );
}

export function normalizeEpisodeRequestForm(value = {}) {
  const source = value && typeof value === 'object' ? value : {};
  return {
    working_title: cleanText(source.working_title),
    pitch: cleanText(source.pitch),
    proposed_guest: cleanText(source.proposed_guest),
    preferred_air_date: cleanText(source.preferred_air_date),
  };
}

export function validateEpisodeRequestForm(value = {}) {
  const request = normalizeEpisodeRequestForm(value);

  if (request.working_title.length < 3) {
    throw new Error(
      'Episode request: add a working title with at least 3 characters.'
    );
  }
  if (request.working_title.length > 150) {
    throw new Error(
      'Episode request: keep the working title to 150 characters or fewer.'
    );
  }
  if (request.pitch.length < 10) {
    throw new Error(
      'Episode request: describe the pitch and listener takeaway in at least 10 characters.'
    );
  }
  if (request.pitch.length > 5000) {
    throw new Error(
      'Episode request: keep the pitch and listener takeaway to 5,000 characters or fewer.'
    );
  }
  if (request.proposed_guest.length > 180) {
    throw new Error(
      'Episode request: keep the proposed guest to 180 characters or fewer.'
    );
  }
  if (
    request.preferred_air_date &&
    !isCalendarDate(request.preferred_air_date)
  ) {
    throw new Error(
      'Episode request: choose a valid preferred air date in YYYY-MM-DD format.'
    );
  }

  return request;
}

export function buildEpisodeRequestItem(value = {}) {
  const request = validateEpisodeRequestForm(value);
  const details = [`Working title: ${request.working_title}`];

  if (request.proposed_guest) {
    details.push(`Proposed guest: ${request.proposed_guest}`);
  }
  if (request.preferred_air_date) {
    details.push(`Preferred air date: ${request.preferred_air_date}`);
  }
  details.push(`Pitch / listener takeaway:\n${request.pitch}`);

  return {
    kind: 'request',
    priority: 'normal',
    title: `Episode request: ${request.working_title}`,
    details: details.join('\n'),
  };
}

export function isEpisodeRequestItem(item = {}) {
  return (
    item?.kind === 'request' &&
    /^Episode request:\s*\S/i.test(String(item?.title || ''))
  );
}
