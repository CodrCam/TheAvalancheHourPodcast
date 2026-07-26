export const DEFAULT_PRODUCTION_LEAD_PERSON_IDS = [
  'angie-link',
  'caleb-merrill',
];

function cleanPersonId(value = '') {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .slice(0, 180);
}

export function normalizeProductionLeadPersonIds(value) {
  const values = Array.isArray(value)
    ? value
    : String(value || '').split(',');
  return [
    ...new Set(values.map(cleanPersonId).filter(Boolean)),
  ];
}

export function getProductionLeadPersonIds(value) {
  const configured = normalizeProductionLeadPersonIds(
    value === undefined &&
      typeof process !== 'undefined'
      ? process.env.STUDIO_PRODUCTION_LEAD_PERSON_IDS
      : value
  );
  return configured.length
    ? configured
    : [...DEFAULT_PRODUCTION_LEAD_PERSON_IDS];
}

export function getAvailableProductionLeadPersonIds(
  leadPersonIds,
  activeProducerPersonIds
) {
  const activeProducerIds = new Set(
    normalizeProductionLeadPersonIds(activeProducerPersonIds)
  );
  return normalizeProductionLeadPersonIds(leadPersonIds).filter((personId) =>
    activeProducerIds.has(personId)
  );
}

export function getNextProductionLeadPersonId(
  currentPersonId,
  leadPersonIds = DEFAULT_PRODUCTION_LEAD_PERSON_IDS
) {
  const leads = normalizeProductionLeadPersonIds(leadPersonIds);
  const current = cleanPersonId(currentPersonId);
  const currentIndex = leads.indexOf(current);
  return currentIndex >= 0
    ? leads[currentIndex + 1] || ''
    : leads[0] || '';
}

export function buildProductionAdvance(
  episode = {},
  {
    actorPersonId = '',
    actorName = 'Production lead',
    advancedAt = new Date().toISOString(),
    leadPersonIds = DEFAULT_PRODUCTION_LEAD_PERSON_IDS,
  } = {}
) {
  const nextLeadPersonId = getNextProductionLeadPersonId(
    actorPersonId,
    leadPersonIds
  );
  return {
    ...episode,
    production_stage: nextLeadPersonId ? 'lead_review' : 'complete',
    production_lead_person_id: nextLeadPersonId,
    production_handoff_at: advancedAt,
    production_completed_at: nextLeadPersonId ? '' : advancedAt,
    production_advanced_by_person_id: cleanPersonId(actorPersonId),
    production_advanced_by_name: String(actorName || '')
      .trim()
      .slice(0, 180),
  };
}
