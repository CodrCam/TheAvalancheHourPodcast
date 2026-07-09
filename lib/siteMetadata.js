export const SITE_URL = 'https://www.theavalanchehour.com';

export const SITE_NAME = 'The Avalanche Hour Podcast';

export const SITE_ALTERNATE_NAME = 'The Avalanche Hour';

export const SITE_DESCRIPTION =
  'Creating a stronger community through sharing stories, knowledge, and news amongst people who have a curious fascination with avalanches.';

export const SITE_KEYWORDS = [
  'avalanche podcast',
  'The Avalanche Hour',
  'snow science',
  'avalanche safety',
  'backcountry safety',
  'avalanche forecasting',
  'avalanche education',
  'mountain culture',
];

export const SITE_EMAIL = 'theavalanchehourpodcast@gmail.com';

export const SITE_LOGO_PATH = '/images/logo.png';
export const SITE_IMAGE_PATH = '/images/og-image.png';
export const SITE_FAVICON_PATH = '/favicon-48x48.png';

export const SITE_LOGO_URL = `${SITE_URL}${SITE_LOGO_PATH}`;
export const SITE_IMAGE_URL = `${SITE_URL}${SITE_IMAGE_PATH}`;
export const SITE_FAVICON_URL = `${SITE_URL}${SITE_FAVICON_PATH}`;

export const ORGANIZATION_ID = `${SITE_URL}/#organization`;
export const WEBSITE_ID = `${SITE_URL}/#website`;
export const PODCAST_ID = `${SITE_URL}/#podcast`;

export const SOCIAL_PROFILES = [
  'https://www.instagram.com/theavalanchehourpodcast/',
];

export function absoluteUrl(path = '/') {
  if (String(path).startsWith('http')) return path;
  return `${SITE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}
