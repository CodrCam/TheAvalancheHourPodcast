import {
  consumeGuestQuestionnaireRateLimit,
  getGuestQuestionnaireClientAddress,
} from './guestQuestionnaireRateLimit.mjs';

const TURNSTILE_SITEVERIFY_URL =
  'https://challenges.cloudflare.com/turnstile/v0/siteverify';
const TURNSTILE_TEST_SECRET = '1x0000000000000000000000000000000AA';
const TURNSTILE_TOKEN_MAX_LENGTH = 2048;
const HUMAN_CHECK_TIMEOUT_MS = 5000;

function requestHeader(req = {}, name = '') {
  const headers = req.headers || {};
  if (typeof headers.get === 'function') return headers.get(name) || '';
  const direct = headers[name];
  if (typeof direct === 'string') return direct;
  const key = Object.keys(headers).find(
    (candidate) => candidate.toLowerCase() === name.toLowerCase()
  );
  return typeof headers[key] === 'string' ? headers[key] : '';
}

function expectedRequestHostname(req = {}) {
  const forwarded = requestHeader(req, 'x-forwarded-host').split(',')[0].trim();
  const value = forwarded || requestHeader(req, 'host').trim();
  if (!value) return '';
  try {
    return new URL(`https://${value}`).hostname.toLowerCase();
  } catch {
    return '';
  }
}

function silentSpamResponse(reason, rate) {
  return {
    ok: false,
    spam: true,
    reason,
    rate,
    status: 200,
    body: { success: true, message: 'Submission received.' },
  };
}

export function protectPublicFormRequest(
  req,
  { scope, limit = 5, windowMs = 15 * 60 * 1000 } = {}
) {
  if (!req.headers?.['content-type']?.includes('application/json')) {
    return {
      ok: false,
      status: 415,
      body: { error: 'Content-Type must be application/json.' },
    };
  }

  if (typeof req.body?.website === 'string' && req.body.website.trim()) {
    return silentSpamResponse('honeypot');
  }

  const fetchSite = requestHeader(req, 'sec-fetch-site').toLowerCase();
  if (fetchSite && !['same-origin', 'same-site'].includes(fetchSite)) {
    return silentSpamResponse('cross_site_request');
  }

  const origin = requestHeader(req, 'origin');
  const expectedHostname = expectedRequestHostname(req);
  if (origin && expectedHostname) {
    try {
      if (new URL(origin).hostname.toLowerCase() !== expectedHostname) {
        return silentSpamResponse('origin_mismatch');
      }
    } catch {
      return silentSpamResponse('invalid_origin');
    }
  }

  const clientAddress = getGuestQuestionnaireClientAddress(req);
  const scopedVisitor = `${String(scope || 'public-form')}:${clientAddress}`;
  const rate = consumeGuestQuestionnaireRateLimit({
    token: scopedVisitor,
    address: scopedVisitor,
    action: 'submit',
    limit,
    windowMs,
  });

  if (!rate.allowed) {
    return {
      ok: false,
      status: 429,
      retry_after_seconds: rate.retry_after_seconds,
      rate,
      body: {
        error: 'Too many submissions. Please wait before trying again.',
      },
    };
  }

  return { ok: true, rate };
}

function caseTransitions(value) {
  const letters = String(value || '').replace(/[^A-Za-z]/g, '');
  let transitions = 0;
  for (let index = 1; index < letters.length; index += 1) {
    const previousUpper = letters[index - 1] === letters[index - 1].toUpperCase();
    const currentUpper = letters[index] === letters[index].toUpperCase();
    if (previousUpper !== currentUpper) transitions += 1;
  }
  return transitions;
}

function isRandomizedAsciiName(value) {
  const candidate = String(value || '').trim();
  if (!/^[A-Za-z]{16,80}$/.test(candidate)) return false;
  const uppercase = (candidate.match(/[A-Z]/g) || []).length;
  const lowercase = (candidate.match(/[a-z]/g) || []).length;
  return uppercase >= 3 && lowercase >= 3 && caseTransitions(candidate) >= 5;
}

function isMachineTokenNarrative(value, minimumLength = 12) {
  const candidate = String(value || '').trim();
  if (!new RegExp(`^[A-Za-z]{${minimumLength},}$`).test(candidate)) {
    return false;
  }
  if (caseTransitions(candidate) >= 4) return true;
  const vowels = (candidate.match(/[aeiou]/gi) || []).length;
  return vowels / candidate.length < 0.18 || /[^aeiou]{6,}/i.test(candidate);
}

export function assessPublicFormSpam(values = {}, { kind = 'contact' } = {}) {
  const reasons = [];
  if (isRandomizedAsciiName(values.name)) reasons.push('randomized_name');

  const primaryNarrative =
    kind === 'guest_application' ? values.background : values.message;
  if (isMachineTokenNarrative(primaryNarrative)) {
    reasons.push('machine_token_narrative');
  }

  for (const value of [values.topics, values.sponsorshipGoals]) {
    if (isMachineTokenNarrative(value, 18)) {
      reasons.push('machine_token_optional_field');
      break;
    }
  }

  const combined = [
    values.background,
    values.topics,
    values.message,
    values.sponsorshipGoals,
  ].join(' ');
  const links = combined.match(/(?:https?:\/\/|www\.)/gi) || [];
  if (links.length > 3) reasons.push('excessive_links');

  return { spam: reasons.length > 0, reasons };
}

export function validatePublicFormNarrative(
  value,
  { label = 'Message', minLetters = 18, minWords = 3 } = {}
) {
  const candidate = String(value || '').trim();
  const letters = candidate.match(/\p{L}/gu) || [];
  const words = candidate.match(/[\p{L}\p{M}]+(?:['’\-][\p{L}\p{M}]+)*/gu) || [];
  const usesNonAsciiScript = /[^\x00-\x7F]/.test(candidate);
  if (
    letters.length < minLetters ||
    (!usesNonAsciiScript && words.length < minWords)
  ) {
    return `${label} should include a few words of useful detail.`;
  }
  return '';
}

function turnstileSecret({
  nodeEnv = process.env.NODE_ENV,
  secret = process.env.TURNSTILE_SECRET_KEY,
} = {}) {
  const configured = String(secret || '').trim();
  if (configured) return configured;
  return nodeEnv === 'production' ? '' : TURNSTILE_TEST_SECRET;
}

export async function verifyPublicFormHuman(
  req,
  {
    action,
    fetchImpl = globalThis.fetch,
    nodeEnv = process.env.NODE_ENV,
    secret = process.env.TURNSTILE_SECRET_KEY,
    timeoutMs = HUMAN_CHECK_TIMEOUT_MS,
  } = {}
) {
  const expectedAction = String(action || '').trim();
  const token = String(
    req.body?.turnstileToken || req.body?.['cf-turnstile-response'] || ''
  ).trim();
  const verificationSecret = turnstileSecret({ nodeEnv, secret });

  if (!verificationSecret) {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'Human verification is temporarily unavailable. Please try again later.',
      },
    };
  }
  if (
    !expectedAction ||
    !/^[a-z0-9_]{1,64}$/.test(expectedAction) ||
    !token ||
    token.length > TURNSTILE_TOKEN_MAX_LENGTH
  ) {
    return {
      ok: false,
      status: 400,
      body: {
        error: 'Please complete the human verification and try again.',
      },
    };
  }
  if (typeof fetchImpl !== 'function') {
    return {
      ok: false,
      status: 503,
      body: { error: 'Human verification could not be checked.' },
    };
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const body = new URLSearchParams({
      secret: verificationSecret,
      response: token,
    });
    const remoteAddress = getGuestQuestionnaireClientAddress(req);
    if (remoteAddress !== 'unknown') body.set('remoteip', remoteAddress);

    const response = await fetchImpl(TURNSTILE_SITEVERIFY_URL, {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body,
      signal: controller.signal,
    });
    if (!response?.ok) throw new Error('turnstile_siteverify_unavailable');
    const result = await response.json();
    const expectedHostname = expectedRequestHostname(req);
    const hostnameMatches =
      !expectedHostname ||
      (Boolean(result.hostname) &&
        String(result.hostname).toLowerCase() === expectedHostname);
    const actionMatches = result.action === expectedAction;
    if (result.success !== true || !hostnameMatches || !actionMatches) {
      return {
        ok: false,
        status: 400,
        body: {
          error: 'Human verification expired or failed. Please try again.',
        },
      };
    }
    return { ok: true };
  } catch {
    return {
      ok: false,
      status: 503,
      body: {
        error: 'Human verification could not be checked. Please try again.',
      },
    };
  } finally {
    clearTimeout(timer);
  }
}

export function normalizePublicFormFields(body, fields) {
  const values = {};
  const errors = [];

  for (const [name, rules] of Object.entries(fields)) {
    const raw = body?.[name];
    if (raw !== undefined && raw !== null && typeof raw !== 'string') {
      errors.push(`${rules.label || name} must be text.`);
      values[name] = '';
      continue;
    }

    const value = String(raw || '').trim();
    values[name] = value;
    if (rules.required && !value) {
      errors.push(`${rules.label || name} is required.`);
    } else if (value && rules.min && value.length < rules.min) {
      errors.push(
        `${rules.label || name} must be at least ${rules.min} characters.`
      );
    } else if (value.length > rules.max) {
      errors.push(
        `${rules.label || name} must be ${rules.max} characters or fewer.`
      );
    }
  }

  return { ok: errors.length === 0, values, errors };
}

export function safeEmailHeader(value, maxLength = 200) {
  return String(value || '')
    .replace(/[\r\n]+/g, ' ')
    .trim()
    .slice(0, maxLength);
}
