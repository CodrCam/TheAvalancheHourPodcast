import test from 'node:test';
import assert from 'node:assert/strict';
import crypto from 'node:crypto';
import {
  getGroupsFromCognitoPayload,
  verifyCognitoAccessToken,
  verifyCognitoToken,
} from '../lib/cognitoAuth.js';

function encodeJson(value) {
  return Buffer.from(JSON.stringify(value)).toString('base64url');
}

function signToken(privateKey, payload, header = {}) {
  const encodedHeader = encodeJson({
    alg: 'RS256',
    typ: 'JWT',
    kid: 'security-test-key',
    ...header,
  });
  const encodedPayload = encodeJson(payload);
  const signingInput = `${encodedHeader}.${encodedPayload}`;
  const signature = crypto
    .sign('RSA-SHA256', Buffer.from(signingInput), privateKey)
    .toString('base64url');
  return `${signingInput}.${signature}`;
}

test('rejects forged, expired, and wrong-client Cognito tokens', async () => {
  const previousEnv = {
    issuer: process.env.COGNITO_ISSUER,
    clientId: process.env.COGNITO_APP_CLIENT_ID,
    hostGroup: process.env.COGNITO_HOST_GROUP,
  };
  const previousFetch = globalThis.fetch;
  const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const attackerKeys = crypto.generateKeyPairSync('rsa', {
    modulusLength: 2048,
  });
  const publicJwk = publicKey.export({ format: 'jwk' });
  const now = Math.floor(Date.now() / 1000);
  const issuer = `https://cognito-security-test.invalid/${crypto.randomUUID()}`;

  process.env.COGNITO_ISSUER = issuer;
  process.env.COGNITO_APP_CLIENT_ID = 'security-test-client';
  process.env.COGNITO_HOST_GROUP = 'host';
  globalThis.fetch = async (url) => {
    assert.equal(url, `${issuer}/.well-known/jwks.json`);
    return {
      ok: true,
      json: async () => ({
        keys: [
          {
            ...publicJwk,
            kid: 'security-test-key',
            alg: 'RS256',
            use: 'sig',
          },
        ],
      }),
    };
  };

  const basePayload = {
    iss: issuer,
    sub: '11111111-2222-3333-4444-555555555555',
    token_use: 'access',
    client_id: 'security-test-client',
    exp: now + 300,
    'cognito:groups': ['host'],
  };

  try {
    const validPayload = await verifyCognitoToken(
      signToken(privateKey, basePayload)
    );
    assert.deepEqual(getGroupsFromCognitoPayload(validPayload), ['host']);

    await assert.rejects(
      verifyCognitoToken(signToken(attackerKeys.privateKey, basePayload)),
      /signature/
    );
    await assert.rejects(
      verifyCognitoToken(
        signToken(privateKey, { ...basePayload, exp: now - 1 })
      ),
      /Expired/
    );
    await assert.rejects(
      verifyCognitoToken(
        signToken(privateKey, {
          ...basePayload,
          client_id: 'attacker-client',
        })
      ),
      /client/
    );
    await assert.rejects(
      verifyCognitoToken(
        signToken(privateKey, { ...basePayload, iss: 'https://evil.invalid' })
      ),
      /issuer/
    );
    const idToken = signToken(privateKey, {
      ...basePayload,
      token_use: 'id',
      client_id: undefined,
      aud: 'security-test-client',
    });
    assert.equal((await verifyCognitoToken(idToken)).token_use, 'id');
    await assert.rejects(
      verifyCognitoAccessToken(idToken),
      /access token required/
    );
  } finally {
    globalThis.fetch = previousFetch;
    for (const [key, value] of Object.entries({
      COGNITO_ISSUER: previousEnv.issuer,
      COGNITO_APP_CLIENT_ID: previousEnv.clientId,
      COGNITO_HOST_GROUP: previousEnv.hostGroup,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
