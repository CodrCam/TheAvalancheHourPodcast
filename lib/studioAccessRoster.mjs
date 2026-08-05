function cleanText(value) {
  return String(value || '').trim();
}

function sourcePersonId(person = {}) {
  return cleanText(person.person_id || person.slug);
}

function livePersonId(person = {}) {
  return cleanText(person.person_id || person.slug);
}

function isActive(value = {}) {
  return value.active !== false;
}

function activeBindingsByPerson(bindings = []) {
  const result = new Map();

  for (const binding of Array.isArray(bindings) ? bindings : []) {
    const personId = cleanText(binding?.person_id);
    if (personId && binding?.active !== false) {
      result.set(personId, binding);
    }
  }

  return result;
}

/**
 * Builds the profile list shown in Studio Access without assigning or
 * inferring any Studio capability. Active profiles are connectable; inactive
 * profiles remain visible only while they have an active account binding.
 */
export function selectStudioAccessPeople(people = [], bindings = []) {
  const bindingsByPerson = activeBindingsByPerson(bindings);

  return (Array.isArray(people) ? people : []).flatMap((person) => {
    const personId = livePersonId(person);
    const name = cleanText(person?.name);
    const binding = bindingsByPerson.get(personId) || null;

    if (!personId || !name || (!isActive(person) && !binding)) return [];

    return [
      {
        ...person,
        person_id: personId,
        name,
        active: isActive(person),
        binding,
      },
    ];
  });
}

/**
 * Compares the canonical/source roster with the live profile store by stable
 * person ID. Raw source rows may use `slug`, which is the ID assigned by the
 * people-store normalizer.
 */
export function auditStudioAccessRoster(sourcePeople = [], livePeople = []) {
  const liveRows = Array.isArray(livePeople) ? livePeople : [];
  const livePersonIds = new Set(
    liveRows.map(livePersonId).filter(Boolean)
  );
  const seenSourceIds = new Set();
  const missingPersonIds = [];

  for (const person of Array.isArray(sourcePeople) ? sourcePeople : []) {
    const personId = sourcePersonId(person);
    if (
      personId &&
      !seenSourceIds.has(personId) &&
      !livePersonIds.has(personId)
    ) {
      missingPersonIds.push(personId);
    }
    if (personId) seenSourceIds.add(personId);
  }

  return {
    missingPersonIds,
    activeLiveProfiles: selectStudioAccessPeople(liveRows),
  };
}
