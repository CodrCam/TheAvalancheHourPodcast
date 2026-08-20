import test from 'node:test';
import assert from 'node:assert/strict';

import {
  assessPublicFormSpam,
  normalizePublicFormFields,
  protectPublicFormRequest,
  safeEmailHeader,
  validatePublicFormNarrative,
  verifyPublicFormHuman,
} from '../lib/publicFormSafety.mjs';
import { resetGuestQuestionnaireRateLimitsForTests } from '../lib/guestQuestionnaireRateLimit.mjs';

function request({ body = {}, contentType = 'application/json', address } = {}) {
  return {
    body,
    headers: { 'content-type': contentType },
    socket: { remoteAddress: address || '203.0.113.77' },
  };
}

test('public forms require JSON and silently absorb honeypot submissions', () => {
  assert.equal(
    protectPublicFormRequest(request({ contentType: 'text/plain' }), {
      scope: 'safety-content-type',
    }).status,
    415
  );

  const spam = protectPublicFormRequest(
    request({ body: { website: 'https://spam.example' } }),
    { scope: 'safety-honeypot' }
  );
  assert.equal(spam.spam, true);
  assert.equal(spam.status, 200);
});

test('public form limiter bounds repeated email-triggering requests', () => {
  const options = { scope: 'safety-rate', limit: 1, windowMs: 60_000 };
  const req = request({ address: '203.0.113.78' });
  assert.equal(protectPublicFormRequest(req, options).ok, true);
  const blocked = protectPublicFormRequest(req, options);
  assert.equal(blocked.ok, false);
  assert.equal(blocked.status, 429);
  assert.ok(blocked.retry_after_seconds >= 1);
});

test('public form limits stay independent across visitors and form scopes', () => {
  resetGuestQuestionnaireRateLimitsForTests();
  const options = { scope: 'guest-independent', limit: 1, windowMs: 60_000 };
  assert.equal(
    protectPublicFormRequest(request({ address: '203.0.113.10' }), options).ok,
    true
  );
  assert.equal(
    protectPublicFormRequest(request({ address: '203.0.113.11' }), options).ok,
    true
  );
  assert.equal(
    protectPublicFormRequest(request({ address: '203.0.113.10' }), {
      ...options,
      scope: 'contact-independent',
    }).ok,
    true
  );
});

test('public forms silently absorb cross-site browser submissions', () => {
  const blocked = protectPublicFormRequest(
    {
      body: {},
      headers: {
        'content-type': 'application/json',
        host: 'theavalanchehour.com',
        origin: 'https://spam.example',
        'sec-fetch-site': 'cross-site',
      },
      socket: { remoteAddress: '203.0.113.12' },
    },
    { scope: 'cross-site' }
  );
  assert.equal(blocked.spam, true);
  assert.equal(blocked.status, 200);
});

test('public form fields are trimmed, required, and length bounded', () => {
  const valid = normalizePublicFormFields(
    { name: '  Ada  ', note: '1234567890' },
    {
      name: { label: 'Name', required: true, max: 10 },
      note: { label: 'Note', min: 10, max: 20 },
    }
  );
  assert.deepEqual(valid, {
    ok: true,
    values: { name: 'Ada', note: '1234567890' },
    errors: [],
  });

  const invalid = normalizePublicFormFields(
    { name: '', note: 'too long' },
    {
      name: { label: 'Name', required: true, max: 10 },
      note: { label: 'Note', max: 3 },
    }
  );
  assert.equal(invalid.ok, false);
  assert.equal(invalid.errors.length, 2);
});

test('email subject values cannot inject additional headers', () => {
  assert.equal(safeEmailHeader('Hello\r\nBcc: attacker@example.com'), 'Hello Bcc: attacker@example.com');
});

test('randomized guest and contact payloads are silently classifiable as spam', () => {
  const pasted = assessPublicFormSpam(
    {
      name: 'xXvfLkThrISiaiBaNiNtdIG',
      background: 'Xdgzyupuz',
      topics: 'NxlRZoZFvgYWGqXOlgjivzaf',
      contact: '7158982989',
    },
    { kind: 'guest_application' }
  );
  const longerVariant = assessPublicFormSpam(
    {
      name: 'xXvfLkThrISiaiBaNiNtdIG',
      background: 'XdgzyupuzLkThrISiaiBaNiNtdIG',
      topics: 'NxlRZoZFvgYWGqXOlgjivzaf',
    },
    { kind: 'guest_application' }
  );

  assert.equal(pasted.spam, true);
  assert.equal(longerVariant.spam, true);
  assert.ok(pasted.reasons.includes('randomized_name'));
});

test('content screening preserves legitimate international submissions', () => {
  for (const submission of [
    {
      name: 'Anaïs O’Connor-López',
      background:
        'Je travaille comme guide de ski et éducatrice en avalanche depuis dix ans.',
      topics: 'Prise de décision en terrain avalancheux',
    },
    {
      name: '山田 太郎',
      background: '雪崩予報と山岳救助について長年活動しています。',
      topics: '雪山での意思決定について話したいです。',
    },
    {
      name: 'Ng',
      background:
        'I teach avalanche courses and guide backcountry skiers in northern Montana.',
      topics: '',
    },
  ]) {
    assert.equal(
      assessPublicFormSpam(submission, { kind: 'guest_application' }).spam,
      false,
      submission.name
    );
    assert.equal(
      validatePublicFormNarrative(submission.background, {
        label: 'Background',
      }),
      '',
      submission.name
    );
  }
});

test('Turnstile verification is action and hostname bound before email work', async () => {
  let requestBody = '';
  const req = {
    body: { turnstileToken: 'verified-token' },
    headers: {
      host: 'theavalanchehour.com',
      'content-type': 'application/json',
    },
    socket: { remoteAddress: '203.0.113.13' },
  };
  const verified = await verifyPublicFormHuman(req, {
    action: 'guest_application',
    nodeEnv: 'production',
    secret: 'server-secret',
    fetchImpl: async (_url, options) => {
      requestBody = String(options.body);
      return {
        ok: true,
        json: async () => ({
          success: true,
          hostname: 'theavalanchehour.com',
          action: 'guest_application',
        }),
      };
    },
  });

  assert.equal(verified.ok, true);
  assert.match(requestBody, /secret=server-secret/);
  assert.match(requestBody, /response=verified-token/);
  assert.match(requestBody, /remoteip=203\.0\.113\.13/);

  const wrongAction = await verifyPublicFormHuman(req, {
    action: 'sponsorship',
    nodeEnv: 'production',
    secret: 'server-secret',
    fetchImpl: async () => ({
      ok: true,
      json: async () => ({
        success: true,
        hostname: 'theavalanchehour.com',
        action: 'contact',
      }),
    }),
  });
  assert.equal(wrongAction.ok, false);
  assert.equal(wrongAction.status, 400);
});

test('Turnstile fails closed for missing tokens, missing production config, and outages', async () => {
  const req = request({ body: {} });
  let calls = 0;
  const missingToken = await verifyPublicFormHuman(req, {
    action: 'contact',
    nodeEnv: 'production',
    secret: 'server-secret',
    fetchImpl: async () => {
      calls += 1;
    },
  });
  assert.equal(missingToken.status, 400);
  assert.equal(calls, 0);

  const missingConfig = await verifyPublicFormHuman(req, {
    action: 'contact',
    nodeEnv: 'production',
    secret: '',
  });
  assert.equal(missingConfig.status, 503);

  const outage = await verifyPublicFormHuman(
    request({ body: { turnstileToken: 'token' } }),
    {
      action: 'contact',
      nodeEnv: 'production',
      secret: 'server-secret',
      fetchImpl: async () => {
        throw new Error('network unavailable');
      },
    }
  );
  assert.equal(outage.status, 503);
});
