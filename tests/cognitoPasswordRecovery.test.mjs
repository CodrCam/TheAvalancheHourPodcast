import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import test from 'node:test';

import {
  CognitoPasswordRecoveryError,
  confirmCognitoPasswordRecovery,
  createCognitoSecretHash,
  startCognitoPasswordRecovery,
} from '../lib/cognitoPasswordRecovery.js';
import confirmRecoveryHandler from '../pages/api/store/admin/auth/password-recovery/confirm.js';
import startRecoveryHandler from '../pages/api/store/admin/auth/password-recovery/start.js';
import { isPublicAuthPath } from '../lib/publicAuthPaths.mjs';

async function withRecoveryEnvironment(callback, options = {}) {
  const keys = [
    'COGNITO_REGION',
    'COGNITO_APP_CLIENT_ID',
    'COGNITO_APP_CLIENT_SECRET',
  ];
  const previous = Object.fromEntries(
    keys.map((key) => [key, process.env[key]])
  );

  process.env.COGNITO_REGION = 'us-east-2';
  process.env.COGNITO_APP_CLIENT_ID = 'test-client-id';
  if (options.withSecret === false) {
    delete process.env.COGNITO_APP_CLIENT_SECRET;
  } else {
    process.env.COGNITO_APP_CLIENT_SECRET = 'test-client-secret';
  }

  try {
    await callback();
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

function createApiResponse() {
  return {
    headers: new Map(),
    statusCode: 200,
    body: null,
    setHeader(name, value) {
      this.headers.set(name, value);
    },
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('computes Cognito app-client secret hashes without exposing the secret', () => {
  const expected = crypto
    .createHmac('sha256', 'test-client-secret')
    .update('host@example.comtest-client-id')
    .digest('base64');

  assert.equal(
    createCognitoSecretHash(
      'host@example.com',
      'test-client-id',
      'test-client-secret'
    ),
    expected
  );
  assert.equal(
    createCognitoSecretHash('host@example.com', 'test-client-id', ''),
    ''
  );
});

test('starts password recovery with the Cognito ForgotPassword API', async () => {
  await withRecoveryEnvironment(async () => {
    let request;
    const fetchImpl = async (url, options) => {
      request = { url, options };
      return { ok: true, json: async () => ({}) };
    };

    await startCognitoPasswordRecovery(' host@example.com ', { fetchImpl });

    assert.equal(
      request.url,
      'https://cognito-idp.us-east-2.amazonaws.com/'
    );
    assert.equal(
      request.options.headers['X-Amz-Target'],
      'AWSCognitoIdentityProviderService.ForgotPassword'
    );
    const body = JSON.parse(request.options.body);
    assert.equal(body.Username, 'host@example.com');
    assert.equal(body.ClientId, 'test-client-id');
    assert.equal(typeof body.SecretHash, 'string');
    assert.equal(request.options.body.includes('test-client-secret'), false);
  });
});

test('confirms a code and new password without requiring an app-client secret', async () => {
  await withRecoveryEnvironment(
    async () => {
      let requestBody;
      const fetchImpl = async (_url, options) => {
        requestBody = JSON.parse(options.body);
        return { ok: true, json: async () => ({}) };
      };

      await confirmCognitoPasswordRecovery(
        {
          username: 'host@example.com',
          code: '123456',
          password: 'Snow!Safety!2026',
        },
        { fetchImpl }
      );

      assert.deepEqual(requestBody, {
        Username: 'host@example.com',
        ConfirmationCode: '123456',
        Password: 'Snow!Safety!2026',
        ClientId: 'test-client-id',
      });
    },
    { withSecret: false }
  );
});

test('preserves Cognito error codes for safe API response mapping', async () => {
  await withRecoveryEnvironment(async () => {
    const fetchImpl = async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        __type: 'com.amazon.cognito#CodeMismatchException',
        message: 'Incorrect code',
      }),
    });

    await assert.rejects(
      confirmCognitoPasswordRecovery(
        {
          username: 'host@example.com',
          code: '000000',
          password: 'Snow!Safety!2026',
        },
        { fetchImpl }
      ),
      (error) => {
        assert.equal(error instanceof CognitoPasswordRecoveryError, true);
        assert.equal(error.code, 'CodeMismatchException');
        return true;
      }
    );
  });
});

test('does not reveal whether a recovery account exists', async () => {
  await withRecoveryEnvironment(async () => {
    const previousFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ __type: 'UserNotFoundException' }),
    });

    try {
      const response = createApiResponse();
      await startRecoveryHandler(
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: { username: 'missing@example.com' },
        },
        response
      );

      assert.equal(response.statusCode, 200);
      assert.equal(response.body.ok, true);
      assert.match(response.body.message, /if an eligible account matches/i);
      assert.doesNotMatch(response.body.message, /missing@example\.com/i);
    } finally {
      global.fetch = previousFetch;
    }
  });
});

test('keeps both recovery endpoints public before Cognito sign-in', () => {
  assert.equal(
    isPublicAuthPath('/api/store/admin/auth/password-recovery/start'),
    true
  );
  assert.equal(
    isPublicAuthPath('/api/store/admin/auth/password-recovery/confirm'),
    true
  );
  assert.equal(isPublicAuthPath('/api/store/admin/session'), false);
  assert.equal(isPublicAuthPath('/studio/guest-questionnaire'), true);
  assert.equal(isPublicAuthPath('/studio/episodes'), false);
});

test('maps an incorrect confirmation code to a safe validation error', async () => {
  await withRecoveryEnvironment(async () => {
    const previousFetch = global.fetch;
    global.fetch = async () => ({
      ok: false,
      status: 400,
      json: async () => ({ __type: 'CodeMismatchException' }),
    });

    try {
      const response = createApiResponse();
      await confirmRecoveryHandler(
        {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: {
            username: 'host@example.com',
            code: '000000',
            password: 'Snow!Safety!2026',
          },
        },
        response
      );

      assert.equal(response.statusCode, 400);
      assert.deepEqual(response.body, {
        ok: false,
        error: 'That recovery code is incorrect. Check the code and try again.',
      });
    } finally {
      global.fetch = previousFetch;
    }
  });
});
