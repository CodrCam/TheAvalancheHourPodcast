export const SPONSOR_READ_STATES = [
  'draft',
  'approved',
  'expired',
  'retired',
];

function cleanText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value, fallback = '') {
  return (
    cleanText(value || fallback, 120)
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '') || fallback
  );
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function normalizeVersion(value = {}) {
  return {
    version_number: Math.max(
      1,
      Math.trunc(Number(value.version_number) || 1)
    ),
    sponsor_id: cleanId(value.sponsor_id),
    sponsor_name: cleanText(value.sponsor_name, 180),
    script_title: cleanText(value.script_title, 220),
    approved_text: cleanText(value.approved_text, 12000),
    pronunciation_guidance: cleanText(
      value.pronunciation_guidance,
      3000
    ),
    host_instructions: cleanText(value.host_instructions, 3000),
    effective_date: cleanDate(value.effective_date),
    expiration_date: cleanDate(value.expiration_date),
    state: SPONSOR_READ_STATES.includes(value.state)
      ? value.state
      : 'draft',
    attributed_to_person_id: cleanId(value.attributed_to_person_id),
    attributed_to_name: cleanText(value.attributed_to_name, 180),
    recorded_at: cleanText(value.recorded_at, 50),
  };
}

export function sponsorReadVersionSnapshot(value = {}, actor = {}) {
  const read = normalizeSponsorRead(value);
  return normalizeVersion({
    ...read,
    attributed_to_person_id: actor.person_id,
    attributed_to_name: actor.name,
    recorded_at: actor.at || new Date().toISOString(),
  });
}

export function normalizeSponsorRead(value = {}, fallback = {}) {
  const state = SPONSOR_READ_STATES.includes(value.state)
    ? value.state
    : SPONSOR_READ_STATES.includes(fallback.state)
      ? fallback.state
      : 'draft';
  const historySource = Array.isArray(value.version_history)
    ? value.version_history
    : Array.isArray(fallback.version_history)
      ? fallback.version_history
      : [];

  return {
    sponsor_read_id: cleanId(
      value.sponsor_read_id,
      cleanId(fallback.sponsor_read_id)
    ),
    sponsor_id: cleanId(value.sponsor_id, cleanId(fallback.sponsor_id)),
    sponsor_name:
      cleanText(value.sponsor_name, 180) ||
      cleanText(fallback.sponsor_name, 180),
    script_title:
      cleanText(value.script_title, 220) ||
      cleanText(fallback.script_title, 220),
    approved_text: Object.prototype.hasOwnProperty.call(value, 'approved_text')
      ? cleanText(value.approved_text, 12000)
      : cleanText(fallback.approved_text, 12000),
    pronunciation_guidance: Object.prototype.hasOwnProperty.call(
      value,
      'pronunciation_guidance'
    )
      ? cleanText(value.pronunciation_guidance, 3000)
      : cleanText(fallback.pronunciation_guidance, 3000),
    host_instructions: Object.prototype.hasOwnProperty.call(
      value,
      'host_instructions'
    )
      ? cleanText(value.host_instructions, 3000)
      : cleanText(fallback.host_instructions, 3000),
    effective_date:
      cleanDate(value.effective_date) || cleanDate(fallback.effective_date),
    expiration_date:
      cleanDate(value.expiration_date) || cleanDate(fallback.expiration_date),
    state,
    version_number: Math.max(
      1,
      Math.trunc(
        Number(
          Object.prototype.hasOwnProperty.call(value, 'version_number')
            ? value.version_number
            : fallback.version_number
        ) || 1
      )
    ),
    version_history: historySource.slice(-30).map(normalizeVersion),
    created_at:
      cleanText(value.created_at, 50) || cleanText(fallback.created_at, 50),
    created_by_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'created_by_person_id'
    )
      ? cleanId(value.created_by_person_id)
      : cleanId(fallback.created_by_person_id),
    created_by_name:
      cleanText(value.created_by_name, 180) ||
      cleanText(fallback.created_by_name, 180),
    updated_at:
      cleanText(value.updated_at, 50) || cleanText(fallback.updated_at, 50),
    updated_by_person_id: Object.prototype.hasOwnProperty.call(
      value,
      'updated_by_person_id'
    )
      ? cleanId(value.updated_by_person_id)
      : cleanId(fallback.updated_by_person_id),
    updated_by_name:
      cleanText(value.updated_by_name, 180) ||
      cleanText(fallback.updated_by_name, 180),
  };
}

export function getSponsorReadOperationalState(value = {}, today = '') {
  const read = normalizeSponsorRead(value);
  const currentDate = cleanDate(today) || new Date().toISOString().slice(0, 10);
  if (read.state === 'retired' || read.state === 'draft') return read.state;
  if (read.state === 'expired') return 'expired';
  if (read.expiration_date && read.expiration_date < currentDate) {
    return 'expired';
  }
  return read.state;
}

export function isSponsorReadAssignable(value = {}, today = '') {
  const read = normalizeSponsorRead(value);
  const currentDate = cleanDate(today) || new Date().toISOString().slice(0, 10);
  return (
    getSponsorReadOperationalState(read, currentDate) === 'approved' &&
    (!read.effective_date || read.effective_date <= currentDate) &&
    (!read.expiration_date || read.expiration_date >= currentDate)
  );
}

export function validateSponsorRead(value = {}) {
  const read = normalizeSponsorRead(value);
  if (!read.sponsor_read_id) {
    throw new Error('Sponsor read: an ID is required.');
  }
  if (!read.sponsor_id || !read.sponsor_name) {
    throw new Error('Sponsor read: choose a sponsor.');
  }
  if (!read.script_title) {
    throw new Error('Sponsor read: a script title is required.');
  }
  if (!read.approved_text) {
    throw new Error('Sponsor read: approved read text is required.');
  }
  if (
    read.effective_date &&
    read.expiration_date &&
    read.expiration_date < read.effective_date
  ) {
    throw new Error(
      'Sponsor read: expiration must be on or after the effective date.'
    );
  }
  return read;
}
