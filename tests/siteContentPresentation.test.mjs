import test from 'node:test';
import assert from 'node:assert/strict';
import {
  normalizeHomeContent,
  sanitizeHomeContentForDisplay,
  validateHomeContent,
} from '../lib/siteContentPresentation.mjs';

const defaults = {
  aboutEyebrow: 'About',
  aboutHeading: 'Heading',
  aboutIntro: 'Intro',
  aboutMissionHeading: 'Mission',
  aboutMissionBody: 'Mission body',
  aboutListenLabel: 'Listen',
  aboutListenUrl: 'https://example.com/listen',
  supportHeading: 'Support',
  supportBody: 'Support body',
  supportButtonLabel: 'Support us',
  supportButtonUrl: '/support',
  spotlightEnabled: true,
  spotlightEyebrow: 'Spotlight',
  spotlightHeading: 'Event',
  spotlightBody: 'Event body',
  spotlightButtonLabel: 'Learn more',
  spotlightButtonUrl: 'https://example.com/event',
  featuredLinkEnabled: false,
  featuredLinkLabel: 'Follow on Instagram',
  featuredLinkUrl: 'https://instagram.com/example',
  donateEnabled: true,
  donateButtonLabel: 'Donate',
  donateButtonUrl: 'https://paypal.com/donate',
};

function validContent(overrides = {}) {
  return {
    ...normalizeHomeContent({}, defaults),
    ...overrides,
  };
}

test('migrates legacy Instagram settings into the flexible featured link', () => {
  const content = normalizeHomeContent(
    {
      socialEnabled: false,
      socialButtonLabel: 'Follow on TikTok',
      instagramUrl: 'https://www.tiktok.com/@avalanchehour',
    },
    defaults
  );

  assert.equal(content.featuredLinkEnabled, false);
  assert.equal(content.featuredLinkLabel, 'Follow on TikTok');
  assert.equal(
    content.featuredLinkUrl,
    'https://www.tiktok.com/@avalanchehour'
  );
});

test('keeps the new featured slot hidden until it is explicitly enabled', () => {
  const legacyContent = normalizeHomeContent(
    {
      socialEnabled: true,
      socialButtonLabel: 'Follow on Instagram',
      instagramUrl: 'https://instagram.com/legacy',
    },
    defaults
  );

  assert.equal(legacyContent.featuredLinkEnabled, false);
  assert.equal(legacyContent.featuredLinkLabel, 'Follow on Instagram');
  assert.equal(legacyContent.featuredLinkUrl, 'https://instagram.com/legacy');
});

test('canonical featured-link fields win over legacy fields', () => {
  const content = normalizeHomeContent(
    {
      featuredLinkEnabled: true,
      featuredLinkLabel: 'Read the field guide',
      featuredLinkUrl: 'https://example.com/guide',
      socialEnabled: false,
      socialButtonLabel: 'Legacy label',
      instagramUrl: 'https://instagram.com/legacy',
    },
    defaults
  );

  assert.equal(content.featuredLinkEnabled, true);
  assert.equal(content.featuredLinkLabel, 'Read the field guide');
  assert.equal(content.featuredLinkUrl, 'https://example.com/guide');
});

test('preserves explicit toggles and allows the optional About link to clear', () => {
  assert.equal(
    normalizeHomeContent({}, defaults).donateEnabled,
    true,
    'older records inherit the visible donation action from the defaults'
  );

  const content = normalizeHomeContent(
    {
      spotlightEnabled: false,
      featuredLinkEnabled: false,
      donateEnabled: false,
      aboutListenLabel: '',
      aboutListenUrl: '',
    },
    defaults
  );

  assert.equal(content.spotlightEnabled, false);
  assert.equal(content.featuredLinkEnabled, false);
  assert.equal(content.donateEnabled, false);
  assert.equal(content.aboutListenLabel, '');
  assert.equal(content.aboutListenUrl, '');
});

test('accepts internal support links plus TikTok and PayPal destinations', () => {
  assert.doesNotThrow(() =>
    validateHomeContent(
      validContent({
        supportButtonUrl: '/support',
        featuredLinkUrl: 'https://www.tiktok.com/@avalanchehour',
        donateButtonUrl:
          'https://www.paypal.com/donate?hosted_button_id=example',
      })
    )
  );
});

test('rejects unsafe, protocol-relative, and backslash destinations', () => {
  for (const destination of [
    'javascript:alert(1)',
    'data:text/html,unsafe',
    '//evil.example/path',
    '/\\evil.example/path',
  ]) {
    assert.throws(
      () =>
        validateHomeContent(
          validContent({ supportButtonUrl: destination })
        ),
      /safe http\(s\) URL/
    );
  }
});

test('ignores dormant featured and donation URLs while their actions are hidden', () => {
  assert.doesNotThrow(() =>
    validateHomeContent(
      validContent({
        featuredLinkEnabled: false,
        featuredLinkUrl: 'javascript:legacy',
        donateEnabled: false,
        donateButtonUrl: 'not a URL',
      })
    )
  );
});

test('requires HTTPS when the donation action is enabled', () => {
  assert.throws(
    () =>
      validateHomeContent(
        validContent({
          donateButtonUrl: 'http://example.com/donate',
        })
      ),
    /safe https URL/
  );
});

test('disables unsafe legacy actions before they reach public links', () => {
  const sanitized = sanitizeHomeContentForDisplay(
    validContent({
      aboutListenUrl: 'javascript:unsafe',
      spotlightEnabled: true,
      spotlightButtonUrl: 'data:text/html,unsafe',
      featuredLinkEnabled: true,
      featuredLinkUrl: 'javascript:unsafe',
      donateEnabled: true,
      donateButtonUrl: 'http://example.com/donate',
      supportButtonUrl: '/\\evil.example',
    }),
    defaults
  );

  assert.equal(sanitized.aboutListenLabel, '');
  assert.equal(sanitized.aboutListenUrl, '');
  assert.equal(sanitized.spotlightEnabled, false);
  assert.equal(sanitized.featuredLinkEnabled, false);
  assert.equal(sanitized.donateEnabled, false);
  assert.equal(sanitized.supportButtonUrl, '/support');
});

test('requires both parts of the optional About listening button', () => {
  assert.throws(
    () =>
      validateHomeContent(
        validContent({
          aboutListenLabel: 'Listen',
          aboutListenUrl: '',
        })
      ),
    /needs both a label and URL/
  );
});

test('rejects an oversized combined site-content record', () => {
  assert.throws(
    () =>
      validateHomeContent(
        validContent({
          aboutIntro: 'x'.repeat(21000),
        })
      ),
    /combined copy is too long/
  );
});
