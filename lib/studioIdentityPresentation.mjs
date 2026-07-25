const COGNITO_UUID_PATTERN =
  /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i;

export function isOpaqueStudioIdentity(value = '') {
  const identity = String(value || '').trim();
  return !identity || COGNITO_UUID_PATTERN.test(identity) || identity === 'cognito-user';
}

export function pickStudioDisplayName(candidates = [], fallback = 'Team member') {
  return (
    candidates
      .map((candidate) => String(candidate || '').trim())
      .find((candidate) => !isOpaqueStudioIdentity(candidate)) || fallback
  );
}

export function resolveStudioMessageAuthors(
  messages = [],
  {
    namesByIdentifier = new Map(),
    currentIdentifiers = [],
    currentAuthorName = '',
  } = {}
) {
  const current = new Set(
    currentIdentifiers.map((value) => String(value || '').trim()).filter(Boolean)
  );

  return (Array.isArray(messages) ? messages : []).map((message) => {
    if (!isOpaqueStudioIdentity(message?.author_name)) return message;

    const authorIdentity = String(message?.author_name || '').trim();
    const mappedName =
      namesByIdentifier instanceof Map
        ? namesByIdentifier.get(authorIdentity)
        : namesByIdentifier?.[authorIdentity];

    return {
      ...message,
      author_name:
        mappedName ||
        (current.has(authorIdentity) ? currentAuthorName : '') ||
        (message?.author_role === 'producer'
          ? 'Studio producer'
          : 'Assigned host'),
    };
  });
}
