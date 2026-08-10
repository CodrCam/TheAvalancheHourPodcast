const ACTIVE_WINDOW_MS = 7 * 60 * 1000;

function cleanString(value) {
  return String(value || '').trim();
}

function dateMs(value) {
  const time = new Date(value || '').getTime();
  return Number.isNaN(time) ? 0 : time;
}

function uniqueStrings(values = []) {
  return [
    ...new Set(
      (Array.isArray(values) ? values : [])
        .map(cleanString)
        .filter(Boolean)
    ),
  ];
}

export function describeAccessClient(userAgent = '') {
  const value = cleanString(userAgent);
  if (!value) return 'Unknown device';

  let browser = 'Browser';
  if (/Edg\//i.test(value)) browser = 'Edge';
  else if (/OPR\//i.test(value)) browser = 'Opera';
  else if (/Chrome\//i.test(value)) browser = 'Chrome';
  else if (/Firefox\//i.test(value)) browser = 'Firefox';
  else if (/Safari\//i.test(value)) browser = 'Safari';

  let platform = '';
  if (/iPhone/i.test(value)) platform = 'iPhone';
  else if (/iPad/i.test(value)) platform = 'iPad';
  else if (/Android/i.test(value)) platform = 'Android';
  else if (/Macintosh|Mac OS X/i.test(value)) platform = 'macOS';
  else if (/Windows/i.test(value)) platform = 'Windows';
  else if (/Linux/i.test(value)) platform = 'Linux';

  return platform ? `${browser} on ${platform}` : browser;
}

export function normalizeAccessSession(value = {}, generatedAt = new Date()) {
  const nowMs = dateMs(generatedAt) || Date.now();
  const loginMs = dateMs(value.login_at);
  const lastSeenMs = Math.max(loginMs, dateMs(value.last_seen_at));
  const endedMs = dateMs(value.ended_at);
  const expiresMs = dateMs(value.token_expires_at);
  const groups = uniqueStrings(value.groups);
  const active = Boolean(
    !endedMs &&
      groups.length > 0 &&
      expiresMs > nowMs &&
      lastSeenMs > 0 &&
      nowMs - lastSeenMs <= ACTIVE_WINDOW_MS
  );
  const endMs = endedMs || (active ? nowMs : lastSeenMs);
  const status = endedMs
    ? 'signed_out'
    : expiresMs > 0 && expiresMs <= nowMs
      ? 'expired'
      : active
        ? 'active'
        : 'idle';

  return {
    session_key: cleanString(value.session_key),
    subject: cleanString(value.subject),
    username: cleanString(value.username) || 'Unknown account',
    display_name:
      cleanString(value.display_name) ||
      cleanString(value.username) ||
      'Unknown account',
    role: cleanString(value.role) || 'unknown',
    groups,
    login_at: cleanString(value.login_at),
    last_seen_at: cleanString(value.last_seen_at) || cleanString(value.login_at),
    ended_at: cleanString(value.ended_at),
    token_expires_at: cleanString(value.token_expires_at),
    end_reason: cleanString(value.end_reason),
    ip: cleanString(value.ip),
    client: cleanString(value.client) || describeAccessClient(value.user_agent),
    duration_seconds:
      loginMs > 0 ? Math.max(0, Math.round((endMs - loginMs) / 1000)) : 0,
    status,
    active,
  };
}

function userKey(session) {
  return session.subject || session.username.toLowerCase();
}

export function summarizeAccessSessions(values = [], options = {}) {
  const generatedAt = options.generatedAt || new Date();
  const sessions = (Array.isArray(values) ? values : [])
    .map((value) => normalizeAccessSession(value, generatedAt))
    .filter((session) => session.login_at)
    .sort((a, b) => dateMs(b.login_at) - dateMs(a.login_at));
  const usersByKey = new Map();

  for (const session of sessions) {
    const key = userKey(session);
    const current = usersByKey.get(key) || {
      subject: session.subject,
      username: session.username,
      display_name: session.display_name,
      role: session.role,
      groups: [],
      login_count: 0,
      total_duration_seconds: 0,
      first_seen_at: session.login_at,
      last_seen_at: session.last_seen_at,
      active: false,
    };

    current.login_count += 1;
    current.total_duration_seconds += session.duration_seconds;
    current.groups = uniqueStrings([...current.groups, ...session.groups]);
    current.active = current.active || session.active;

    if (dateMs(session.login_at) < dateMs(current.first_seen_at)) {
      current.first_seen_at = session.login_at;
    }
    if (dateMs(session.last_seen_at) > dateMs(current.last_seen_at)) {
      current.last_seen_at = session.last_seen_at;
      current.username = session.username;
      current.display_name = session.display_name;
      current.role = session.role;
    }

    usersByKey.set(key, current);
  }

  const users = [...usersByKey.values()]
    .map((user) => ({
      ...user,
      average_duration_seconds: user.login_count
        ? Math.round(user.total_duration_seconds / user.login_count)
        : 0,
    }))
    .sort((a, b) => dateMs(b.last_seen_at) - dateMs(a.last_seen_at));

  return {
    summary: {
      unique_users: users.length,
      login_count: sessions.length,
      active_now: users.filter((user) => user.active).length,
      total_duration_seconds: sessions.reduce(
        (total, session) => total + session.duration_seconds,
        0
      ),
    },
    users,
    sessions,
  };
}
