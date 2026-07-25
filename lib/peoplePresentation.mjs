export const PEOPLE_SECTIONS = [
  {
    id: 'hosts',
    label: 'Hosts',
    description: 'The voices leading conversations on The Avalanche Hour.',
  },
  {
    id: 'team',
    label: 'Team',
    description: 'The people producing, publishing, and supporting the program.',
  },
];

export const MAX_PERSON_IMAGES = 3;

export function profileBioToPlainText(value = '') {
  return String(value || '')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p\s*>/gi, '\n\n')
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

export function isAllowedSelfProfileImage(value = '') {
  const image = String(value || '').trim();
  if (!image) return false;
  if (/^data:image\/(?:png|jpeg|webp);base64,/i.test(image)) return true;
  if (!image.startsWith('/') || image.startsWith('//')) return false;

  try {
    const base = new URL('https://profile-images.invalid');
    const resolved = new URL(image, base);
    return (
      resolved.origin === base.origin &&
      resolved.pathname.startsWith('/images/') &&
      !resolved.search &&
      !resolved.hash
    );
  } catch {
    return false;
  }
}

export function getPeopleSectionId(person = {}) {
  return person.role === 'host' ? 'hosts' : 'team';
}

function getSortOrder(person = {}) {
  const value = Number(person.sort_order);
  return Number.isFinite(value) ? value : Number.MAX_SAFE_INTEGER;
}

export function sortPeopleForSection(people = []) {
  return [...people].sort(
    (left, right) =>
      getSortOrder(left) - getSortOrder(right) ||
      String(left.name || '').localeCompare(String(right.name || ''))
  );
}

export function groupPeopleForDisplay(people = []) {
  const grouped = { hosts: [], team: [] };

  for (const person of people) {
    grouped[getPeopleSectionId(person)].push(person);
  }

  grouped.hosts = sortPeopleForSection(grouped.hosts);
  grouped.team = sortPeopleForSection(grouped.team);
  return grouped;
}

export function removeImageAtIndex(images = [], index, expectedImage) {
  const nextImages = Array.isArray(images) ? [...images] : [];

  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= nextImages.length ||
    (expectedImage !== undefined && nextImages[index] !== expectedImage)
  ) {
    return nextImages;
  }

  nextImages.splice(index, 1);
  return nextImages;
}

export function restoreImageAtIndex(images = [], index, image) {
  const nextImages = Array.isArray(images) ? [...images] : [];
  const safeIndex = Math.min(
    Math.max(Number.isInteger(index) ? index : nextImages.length, 0),
    nextImages.length
  );

  nextImages.splice(safeIndex, 0, image);
  return nextImages;
}

export function moveImageAtIndex(
  images = [],
  fromIndex,
  toIndex,
  expectedImage
) {
  const nextImages = Array.isArray(images) ? [...images] : [];

  if (
    !Number.isInteger(fromIndex) ||
    !Number.isInteger(toIndex) ||
    fromIndex < 0 ||
    fromIndex >= nextImages.length ||
    toIndex < 0 ||
    toIndex >= nextImages.length ||
    (expectedImage !== undefined && nextImages[fromIndex] !== expectedImage)
  ) {
    return nextImages;
  }

  const [movedImage] = nextImages.splice(fromIndex, 1);
  nextImages.splice(toIndex, 0, movedImage);
  return nextImages;
}
