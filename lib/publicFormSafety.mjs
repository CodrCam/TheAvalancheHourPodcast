import {
  consumeGuestQuestionnaireRateLimit,
  getGuestQuestionnaireClientAddress,
} from './guestQuestionnaireRateLimit.mjs';

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
    return {
      ok: false,
      spam: true,
      status: 200,
      body: { success: true, message: 'Submission received.' },
    };
  }

  const rate = consumeGuestQuestionnaireRateLimit({
    token: String(scope || 'public-form'),
    address: getGuestQuestionnaireClientAddress(req),
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
