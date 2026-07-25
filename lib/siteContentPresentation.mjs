function cleanString(value, fallback = '') {
  const text = String(value ?? '').trim();
  return text || fallback;
}

function cleanOptionalString(value, fallback = '') {
  if (value === undefined || value === null) return fallback;
  return String(value).trim();
}

export function normalizeHomeContent(value = {}, defaults = {}) {
  return {
    aboutEyebrow: cleanString(value.aboutEyebrow, defaults.aboutEyebrow),
    aboutHeading: cleanString(value.aboutHeading, defaults.aboutHeading),
    aboutIntro: cleanString(value.aboutIntro, defaults.aboutIntro),
    aboutMissionHeading: cleanString(
      value.aboutMissionHeading,
      defaults.aboutMissionHeading
    ),
    aboutMissionBody: cleanString(
      value.aboutMissionBody,
      defaults.aboutMissionBody
    ),
    aboutListenLabel: cleanOptionalString(
      value.aboutListenLabel,
      defaults.aboutListenLabel
    ),
    aboutListenUrl: cleanOptionalString(
      value.aboutListenUrl,
      defaults.aboutListenUrl
    ),
    supportHeading: cleanString(value.supportHeading, defaults.supportHeading),
    supportBody: cleanString(value.supportBody, defaults.supportBody),
    supportButtonLabel: cleanString(
      value.supportButtonLabel,
      defaults.supportButtonLabel
    ),
    supportButtonUrl: cleanString(
      value.supportButtonUrl,
      defaults.supportButtonUrl
    ),
    spotlightEnabled:
      typeof value.spotlightEnabled === 'boolean'
        ? value.spotlightEnabled
        : defaults.spotlightEnabled,
    spotlightEyebrow: cleanString(
      value.spotlightEyebrow,
      defaults.spotlightEyebrow
    ),
    spotlightHeading: cleanString(
      value.spotlightHeading,
      defaults.spotlightHeading
    ),
    spotlightBody: cleanString(value.spotlightBody, defaults.spotlightBody),
    spotlightButtonLabel: cleanString(
      value.spotlightButtonLabel,
      defaults.spotlightButtonLabel
    ),
    spotlightButtonUrl: cleanString(
      value.spotlightButtonUrl,
      defaults.spotlightButtonUrl
    ),
    featuredLinkEnabled:
      typeof value.featuredLinkEnabled === 'boolean'
        ? value.featuredLinkEnabled
        : defaults.featuredLinkEnabled,
    featuredLinkLabel: cleanString(
      value.featuredLinkLabel ?? value.socialButtonLabel,
      defaults.featuredLinkLabel
    ),
    featuredLinkUrl: cleanString(
      value.featuredLinkUrl ?? value.instagramUrl,
      defaults.featuredLinkUrl
    ),
    donateEnabled:
      typeof value.donateEnabled === 'boolean'
        ? value.donateEnabled
        : defaults.donateEnabled,
    donateButtonLabel: cleanString(
      value.donateButtonLabel,
      defaults.donateButtonLabel
    ),
    donateButtonUrl: cleanString(
      value.donateButtonUrl,
      defaults.donateButtonUrl
    ),
  };
}

export function assertSafeDestination(value, label, options = {}) {
  const destination = String(value || '').trim();
  const expected =
    `Site content: ${label} must be ${
      options.httpsOnly ? 'a safe https URL' : 'a safe http(s) URL'
    }` +
    `${options.allowRelative ? ' or an internal /path' : ''}.`;

  if (!destination && options.optional) return;
  if (!destination) {
    throw new Error(`Site content: ${label} is required.`);
  }
  if (/[\u0000-\u001f\u007f\\]/.test(destination)) {
    throw new Error(expected);
  }

  if (options.allowRelative) {
    try {
      const internalOrigin = new URL('https://avalanche-hour.internal');
      const resolved = new URL(destination, internalOrigin);
      if (
        destination.startsWith('/') &&
        !destination.startsWith('//') &&
        resolved.origin === internalOrigin.origin
      ) {
        return;
      }
    } catch {
      // Fall through to the standard safe-URL error below.
    }
  }

  try {
    const url = new URL(destination);
    if (
      options.httpsOnly
        ? url.protocol !== 'https:'
        : !['http:', 'https:'].includes(url.protocol)
    ) {
      throw new Error();
    }
  } catch {
    throw new Error(expected);
  }
}

export function validateHomeContent(content) {
  const hasListenLabel = Boolean(content.aboutListenLabel);
  const hasListenUrl = Boolean(content.aboutListenUrl);
  if (hasListenLabel !== hasListenUrl) {
    throw new Error(
      'Site content: the About listening button needs both a label and URL, or both fields must be blank.'
    );
  }

  assertSafeDestination(content.aboutListenUrl, 'About listening URL', {
    optional: true,
  });
  assertSafeDestination(content.supportButtonUrl, 'support button destination', {
    allowRelative: true,
  });
  if (content.spotlightEnabled) {
    assertSafeDestination(
      content.spotlightButtonUrl,
      'community spotlight URL'
    );
  }
  if (content.featuredLinkEnabled) {
    assertSafeDestination(content.featuredLinkUrl, 'featured link URL');
  }
  if (content.donateEnabled) {
    assertSafeDestination(content.donateButtonUrl, 'donation URL', {
      httpsOnly: true,
    });
  }

  if (JSON.stringify(content).length > 20000) {
    throw new Error('Site content: the combined copy is too long to save.');
  }
}

function isSafeDestination(value, label, options = {}) {
  try {
    assertSafeDestination(value, label, options);
    return true;
  } catch {
    return false;
  }
}

export function sanitizeHomeContentForDisplay(content = {}, defaults = {}) {
  const sanitized = { ...content };

  if (
    Boolean(sanitized.aboutListenLabel) !==
      Boolean(sanitized.aboutListenUrl) ||
    !isSafeDestination(
      sanitized.aboutListenUrl,
      'About listening URL',
      { optional: true }
    )
  ) {
    sanitized.aboutListenLabel = '';
    sanitized.aboutListenUrl = '';
  }

  if (
    !isSafeDestination(
      sanitized.supportButtonUrl,
      'support button destination',
      { allowRelative: true }
    )
  ) {
    sanitized.supportButtonLabel =
      defaults.supportButtonLabel || 'View Support Options';
    sanitized.supportButtonUrl = isSafeDestination(
      defaults.supportButtonUrl,
      'default support button destination',
      { allowRelative: true }
    )
      ? defaults.supportButtonUrl
      : '/support';
  }

  if (
    sanitized.spotlightEnabled &&
    !isSafeDestination(
      sanitized.spotlightButtonUrl,
      'community spotlight URL'
    )
  ) {
    sanitized.spotlightEnabled = false;
  }

  if (
    sanitized.featuredLinkEnabled &&
    !isSafeDestination(sanitized.featuredLinkUrl, 'featured link URL')
  ) {
    sanitized.featuredLinkEnabled = false;
  }

  if (
    sanitized.donateEnabled &&
    !isSafeDestination(sanitized.donateButtonUrl, 'donation URL', {
      httpsOnly: true,
    })
  ) {
    sanitized.donateEnabled = false;
  }

  return sanitized;
}
