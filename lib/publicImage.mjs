const OPTIMIZABLE_IMAGE_PATTERN =
  /^\/images\/(hosts|background|store)\/(.+)\.(jpe?g|png|webp)$/i;

function safeDecode(value) {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

function slugImagePathSegment(value) {
  return safeDecode(String(value || ''))
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function getOptimizedPublicImage(value) {
  const source = String(value || '').trim();
  if (!source || source.startsWith('/images/optimized/')) return source;

  const suffixIndex = source.search(/[?#]/);
  const pathname =
    suffixIndex >= 0 ? source.slice(0, suffixIndex) : source;
  const suffix = suffixIndex >= 0 ? source.slice(suffixIndex) : '';
  const match = pathname.match(OPTIMIZABLE_IMAGE_PATTERN);
  if (!match) return source;

  const [, root, relativePath] = match;
  const segments = relativePath.split('/').map(slugImagePathSegment);
  if (!segments.length || segments.some((segment) => !segment)) return source;

  return `/images/optimized/${root.toLowerCase()}/${segments.join('/')}.webp${suffix}`;
}
