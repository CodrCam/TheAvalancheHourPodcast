import test from 'node:test';
import assert from 'node:assert/strict';
import {
  consumeGuestQuestionnaireRateLimit,
  getGuestQuestionnaireClientAddress,
  resetGuestQuestionnaireRateLimitsForTests,
} from '../lib/guestQuestionnaireRateLimit.mjs';

const NOW = new Date('2026-08-04T12:00:00.000Z');

test('client address ignores caller-controlled forwarding headers', () => {
  const request = {
    headers: {
      'x-forwarded-for': '198.51.100.77',
      'x-nf-client-connection-ip': '192.0.2.40',
    },
    socket: { remoteAddress: '203.0.113.18' },
  };

  assert.equal(
    getGuestQuestionnaireClientAddress(request, { isNetlify: false }),
    '203.0.113.18'
  );
});

test('client address accepts only a valid Netlify client IP on Netlify', () => {
  const request = {
    headers: {
      'x-forwarded-for': '198.51.100.77',
      'x-nf-client-connection-ip': '2001:db8::24',
    },
    socket: { remoteAddress: '203.0.113.18' },
  };

  assert.equal(
    getGuestQuestionnaireClientAddress(request, { isNetlify: true }),
    '2001:db8::24'
  );
  assert.equal(
    getGuestQuestionnaireClientAddress(
      {
        ...request,
        headers: {
          ...request.headers,
          'x-nf-client-connection-ip': '192.0.2.40, 198.51.100.77',
        },
      },
      { isNetlify: true }
    ),
    '203.0.113.18'
  );
  assert.equal(
    getGuestQuestionnaireClientAddress(
      { headers: {}, socket: { remoteAddress: 'not-an-ip' } },
      { isNetlify: true }
    ),
    'unknown'
  );
});

test('address limit runs before token buckets are created', () => {
  resetGuestQuestionnaireRateLimitsForTests();
  assert.equal(
    consumeGuestQuestionnaireRateLimit({
      token: 'first-token',
      address: '192.0.2.10',
      action: 'read',
      limit: 1,
      windowMs: 60000,
      now: NOW,
    }).allowed,
    true
  );

  for (let index = 0; index < 100; index += 1) {
    assert.equal(
      consumeGuestQuestionnaireRateLimit({
        token: `rotated-invalid-token-${index}`,
        address: '192.0.2.10',
        action: 'read',
        limit: 1,
        windowMs: 60000,
        now: NOW,
      }).allowed,
      false
    );
  }

  assert.equal(
    consumeGuestQuestionnaireRateLimit({
      token: 'rotated-invalid-token-99',
      address: '192.0.2.11',
      action: 'read',
      limit: 1,
      windowMs: 60000,
      now: NOW,
    }).allowed,
    true
  );
});

test('token limit applies across different client addresses', () => {
  resetGuestQuestionnaireRateLimitsForTests();
  const options = {
    token: 'shared-token',
    action: 'submit',
    limit: 2,
    windowMs: 60000,
    now: NOW,
  };

  assert.equal(
    consumeGuestQuestionnaireRateLimit({
      ...options,
      address: '192.0.2.21',
    }).allowed,
    true
  );
  assert.equal(
    consumeGuestQuestionnaireRateLimit({
      ...options,
      address: '192.0.2.22',
    }).allowed,
    true
  );
  const blocked = consumeGuestQuestionnaireRateLimit({
    ...options,
    address: '192.0.2.23',
  });
  assert.equal(blocked.allowed, false);
  assert.equal(blocked.remaining, 0);
});
