import { getPersonStudioCapabilities } from './peopleStudioCapabilities.mjs';

function cleanId(value) {
  return String(value || '').trim();
}

function hasPermission(permissions, permission) {
  return (Array.isArray(permissions) ? permissions : []).includes(permission);
}

export function deriveStudioSessionCapabilities({
  permissions = [],
  personId = '',
  person = null,
} = {}) {
  const cleanPersonId = cleanId(personId);
  const canManageEpisodes = hasPermission(permissions, 'episodes:manage');
  const isCapableProducer =
    Boolean(cleanPersonId) &&
    person?.active === true &&
    getPersonStudioCapabilities(person || {}).producer;

  return {
    producer_tasks: canManageEpisodes || isCapableProducer,
  };
}
