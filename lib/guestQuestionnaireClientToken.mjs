export const GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY =
  'ah_guest_questionnaire_token_v1';

function cleanGuestQuestionnaireToken(value) {
  const token = String(value || '').trim();
  if (
    !token ||
    token.length > 4096 ||
    !/^[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(token)
  ) {
    return '';
  }
  return token;
}

function readStoredToken(storage) {
  try {
    return cleanGuestQuestionnaireToken(
      storage?.getItem?.(GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY)
    );
  } catch {
    return '';
  }
}

function storeToken(storage, token) {
  if (!token) return;
  try {
    storage?.setItem?.(GUEST_QUESTIONNAIRE_SESSION_TOKEN_KEY, token);
  } catch {
    // A private link still works for this page load when storage is unavailable.
  }
}

function fragmentParameters(hash) {
  const value = String(hash || '').replace(/^#/, '');
  if (!value || (!value.includes('=') && !value.includes('&'))) return null;
  return new URLSearchParams(value);
}

/**
 * Moves a URL-delivered bearer token into tab-scoped storage and removes it
 * from the visible URL. Only fragments are accepted because query values reach
 * request logs before client code can scrub them.
 */
export function consumeGuestQuestionnaireClientToken({
  location,
  history,
  storage,
} = {}) {
  let url;
  try {
    url = new URL(String(location?.href || ''));
  } catch {
    return readStoredToken(storage);
  }

  const hashParameters = fragmentParameters(url.hash);
  const fragmentToken = cleanGuestQuestionnaireToken(
    hashParameters?.get('token')
  );
  const token = fragmentToken || readStoredToken(storage);

  if (fragmentToken) {
    storeToken(storage, token);
  }

  const hadFragmentToken = hashParameters?.has('token') === true;
  const hadLegacyQueryToken = url.searchParams.has('token');
  if (hadFragmentToken || hadLegacyQueryToken) {
    url.searchParams.delete('token');
    if (hashParameters) {
      hashParameters.delete('token');
      const remainingHash = hashParameters.toString();
      url.hash = remainingHash ? `#${remainingHash}` : '';
    }
    try {
      history?.replaceState?.(
        history.state,
        '',
        `${url.pathname}${url.search}${url.hash}`
      );
    } catch {
      // Token handling must not fail just because URL replacement is blocked.
    }
  }

  return token;
}
