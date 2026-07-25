const MAX_SECTIONS = 30;
const MAX_LINKS_PER_SECTION = 20;
const MAX_BODY_LENGTH = 14000;

function cleanText(value, maxLength = 4000) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanId(value, fallback = '') {
  return (
    String(value || fallback)
      .toLowerCase()
      .trim()
      .replace(/&/g, 'and')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 100) || fallback
  );
}

function isSafeResourceUrl(value) {
  const url = String(value || '').trim();
  if (!url) return true;
  if (url.startsWith('/') && !url.startsWith('//')) return true;

  try {
    return new URL(url).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeLink(value = {}, index = 0, sectionId = 'section') {
  return {
    id: cleanId(value.id, `${sectionId}-link-${index + 1}`),
    label: cleanText(value.label, 180),
    url: cleanText(value.url, 2000),
    note: cleanText(value.note, 500),
    manager_note: cleanText(value.manager_note, 500),
    active: value.active === true,
  };
}

function normalizeSection(value = {}, index = 0) {
  const id = cleanId(value.id, `section-${index + 1}`);
  const sortOrder = Number(value.sort_order);

  return {
    id,
    category: cleanText(value.category, 80) || 'General',
    title: cleanText(value.title, 180),
    summary: cleanText(value.summary, 500),
    body: cleanText(value.body, MAX_BODY_LENGTH),
    published: value.published !== false,
    sort_order: Number.isFinite(sortOrder) ? Math.trunc(sortOrder) : index * 10,
    links: (Array.isArray(value.links) ? value.links : [])
      .slice(0, MAX_LINKS_PER_SECTION)
      .map((link, linkIndex) => normalizeLink(link, linkIndex, id)),
  };
}

export function normalizeStudioGuide(value = {}, fallback = {}) {
  const sourceSections = Array.isArray(value.sections)
    ? value.sections
    : fallback.sections || [];
  const announcement = value.announcement || fallback.announcement || {};
  const schemaVersion = Number(value.schema_version || fallback.schema_version);

  return {
    schema_version:
      Number.isFinite(schemaVersion) && schemaVersion > 0
        ? Math.trunc(schemaVersion)
        : 1,
    eyebrow:
      cleanText(value.eyebrow, 100) ||
      cleanText(fallback.eyebrow, 100) ||
      'The Avalanche Hour',
    title:
      cleanText(value.title, 180) ||
      cleanText(fallback.title, 180) ||
      'Host Studio',
    intro: cleanText(value.intro, 1200) || cleanText(fallback.intro, 1200),
    announcement: {
      enabled: announcement.enabled === true,
      title: cleanText(announcement.title, 180),
      body: cleanText(announcement.body, 1200),
    },
    sections: sourceSections
      .slice(0, MAX_SECTIONS)
      .map(normalizeSection)
      .sort(
        (a, b) =>
          a.sort_order - b.sort_order || a.title.localeCompare(b.title)
      ),
    manager_notes: (
      Array.isArray(value.manager_notes)
        ? value.manager_notes
        : fallback.manager_notes || []
    )
      .map((note) => cleanText(note, 500))
      .filter(Boolean)
      .slice(0, 50),
  };
}

export function sanitizeStudioGuideForHosts(value = {}, fallback = {}) {
  const guide = normalizeStudioGuide(value, fallback);

  return {
    ...guide,
    sections: guide.sections
      .filter((section) => section.published)
      .map((section) => ({
        ...section,
        links: section.links
          .filter(
            (link) =>
              link.active &&
              link.label &&
              link.url &&
              isSafeResourceUrl(link.url)
          )
          .map((link) => ({
            id: link.id,
            label: link.label,
            url: link.url,
            note: link.note,
            active: true,
          })),
      })),
    manager_notes: [],
  };
}

export function validateStudioGuide(value = {}) {
  const guide = normalizeStudioGuide(value);
  if (!guide.title) throw new Error('Studio guide: title is required.');
  if (!guide.sections.length) {
    throw new Error('Studio guide: at least one section is required.');
  }

  const sectionIds = new Set();
  for (const section of guide.sections) {
    if (!section.id || !section.title) {
      throw new Error('Studio guide: every section needs a title and ID.');
    }
    if (sectionIds.has(section.id)) {
      throw new Error(`Studio guide: duplicate section ID "${section.id}".`);
    }
    sectionIds.add(section.id);

    const linkIds = new Set();
    for (const link of section.links) {
      if (!link.label && !link.url) continue;
      if (!link.label || !link.url) {
        throw new Error(
          `Studio guide: links in "${section.title}" need a label and URL.`
        );
      }
      if (!isSafeResourceUrl(link.url)) {
        throw new Error(
          `Studio guide: "${link.label}" must use HTTPS or a site-relative path.`
        );
      }
      if (linkIds.has(link.id)) {
        throw new Error(
          `Studio guide: duplicate link ID "${link.id}" in "${section.title}".`
        );
      }
      linkIds.add(link.id);
    }
  }

  const serializedBytes = new TextEncoder().encode(
    JSON.stringify(guide)
  ).length;
  if (serializedBytes > 330000) {
    throw new Error('Studio guide: the combined content is too large to save.');
  }

  return guide;
}

export function studioGuideSearchText(section = {}) {
  return [
    section.category,
    section.title,
    section.summary,
    section.body,
    ...(section.links || []).flatMap((link) => [
      link.label,
      link.note,
    ]),
  ]
    .join(' ')
    .toLowerCase();
}
