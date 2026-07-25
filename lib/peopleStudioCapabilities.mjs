const STUDIO_CAPABILITY_ALIASES = {
  host: new Set(['host', 'co-host', 'cohost']),
  producer: new Set([
    'producer',
    'episode producer',
    'audio producer',
    'executive producer',
  ]),
};

function normalizeLabel(value = '') {
  return String(value)
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
}

export function personHasStudioCapability(person = {}, capability = '') {
  const requested = normalizeLabel(capability);
  const aliases = STUDIO_CAPABILITY_ALIASES[requested];
  if (!aliases) return false;

  const labels = [
    ...(Array.isArray(person.studioRoles) ? person.studioRoles : []),
    ...(Array.isArray(person.studio_roles) ? person.studio_roles : []),
    person.role,
  ].map(normalizeLabel);

  return labels.some((label) => aliases.has(label));
}

export function getPersonStudioCapabilities(person = {}) {
  return {
    host: personHasStudioCapability(person, 'host'),
    producer: personHasStudioCapability(person, 'producer'),
  };
}
