import test from 'node:test';
import assert from 'node:assert/strict';

import {
  normalizePublicFormFields,
  protectPublicFormRequest,
  safeEmailHeader,
} from '../lib/publicFormSafety.mjs';

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
