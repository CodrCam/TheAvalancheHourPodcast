import { COMMUNITY_LINKS, SOCIAL_LINKS } from './siteLinks';

export const HOME_CONTENT_KEY = 'homepage_cta';

export const DEFAULT_HOME_CONTENT = {
  supportHeading: 'Support the Podcast',
  supportBody:
    'Interested in advertising, underwriting, or helping keep The Avalanche Hour growing? Explore single-episode and season-long support options built for brands, educators, guide services, ski patrols, and avalanche community supporters.',
  supportButtonLabel: 'View Support Options',
  supportButtonUrl: '/support',
  spotlightEnabled: true,
  spotlightEyebrow: 'Community Spotlight',
  spotlightHeading: 'ISSW 2026',
  spotlightBody:
    'Join us in Whistler, BC for ISSW 2026. Several Avalanche Hour hosts will be part of panels and conversations throughout the week.',
  spotlightButtonLabel: 'Get Tickets',
  spotlightButtonUrl: COMMUNITY_LINKS.issw2026Registration,
  socialEnabled: true,
  socialButtonLabel: 'Follow on Instagram',
  instagramUrl: SOCIAL_LINKS.instagram,
};

function cleanString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

export function normalizeHomeContent(value = {}) {
  return {
    supportHeading: cleanString(
      value.supportHeading,
      DEFAULT_HOME_CONTENT.supportHeading
    ),
    supportBody: cleanString(value.supportBody, DEFAULT_HOME_CONTENT.supportBody),
    supportButtonLabel: cleanString(
      value.supportButtonLabel,
      DEFAULT_HOME_CONTENT.supportButtonLabel
    ),
    supportButtonUrl: cleanString(
      value.supportButtonUrl,
      DEFAULT_HOME_CONTENT.supportButtonUrl
    ),
    spotlightEnabled:
      typeof value.spotlightEnabled === 'boolean'
        ? value.spotlightEnabled
        : DEFAULT_HOME_CONTENT.spotlightEnabled,
    spotlightEyebrow: cleanString(
      value.spotlightEyebrow,
      DEFAULT_HOME_CONTENT.spotlightEyebrow
    ),
    spotlightHeading: cleanString(
      value.spotlightHeading,
      DEFAULT_HOME_CONTENT.spotlightHeading
    ),
    spotlightBody: cleanString(
      value.spotlightBody,
      DEFAULT_HOME_CONTENT.spotlightBody
    ),
    spotlightButtonLabel: cleanString(
      value.spotlightButtonLabel,
      DEFAULT_HOME_CONTENT.spotlightButtonLabel
    ),
    spotlightButtonUrl: cleanString(
      value.spotlightButtonUrl,
      DEFAULT_HOME_CONTENT.spotlightButtonUrl
    ),
    socialEnabled:
      typeof value.socialEnabled === 'boolean'
        ? value.socialEnabled
        : DEFAULT_HOME_CONTENT.socialEnabled,
    socialButtonLabel: cleanString(
      value.socialButtonLabel,
      DEFAULT_HOME_CONTENT.socialButtonLabel
    ),
    instagramUrl: cleanString(value.instagramUrl, DEFAULT_HOME_CONTENT.instagramUrl),
  };
}
