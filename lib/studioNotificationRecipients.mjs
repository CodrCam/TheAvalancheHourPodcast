export const DEFAULT_STUDIO_ADMIN_NOTIFICATION_PERSON_IDS = [
  'cam-griffin',
  'caleb-merrill',
];

export const DEFAULT_MIC_KIT_MANAGER_PERSON_IDS = [
  'cam-griffin',
  'caleb-merrill',
];

function cleanPersonId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .slice(0, 180);
}

export function normalizeNotificationPersonIds(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return [
    ...new Set(values.map(cleanPersonId).filter(Boolean)),
  ];
}

function configuredPersonIds(value, environmentKey, fallback) {
  const source =
    value === undefined && typeof process !== 'undefined'
      ? process.env[environmentKey]
      : value;
  const configured = normalizeNotificationPersonIds(source);
  return configured.length ? configured : [...fallback];
}

export function getStudioAdminNotificationPersonIds(value) {
  return configuredPersonIds(
    value,
    'STUDIO_ADMIN_NOTIFICATION_PERSON_IDS',
    DEFAULT_STUDIO_ADMIN_NOTIFICATION_PERSON_IDS
  );
}

export function getMicKitManagerPersonIds(value) {
  return configuredPersonIds(
    value,
    'STUDIO_MIC_KIT_MANAGER_PERSON_IDS',
    DEFAULT_MIC_KIT_MANAGER_PERSON_IDS
  );
}
