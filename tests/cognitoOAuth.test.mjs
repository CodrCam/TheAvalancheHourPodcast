import assert from 'node:assert/strict';
import test from 'node:test';

import { buildAuthorizeUrl } from '../lib/cognitoOAuth.js';

function withOAuthEnvironment(scope, callback) {
  const previous = {
    clientId: process.env.COGNITO_APP_CLIENT_ID,
    domain: process.env.COGNITO_DOMAIN,
    redirectUri: process.env.COGNITO_REDIRECT_URI,
    scopes: process.env.COGNITO_OAUTH_SCOPES,
  };

  process.env.COGNITO_APP_CLIENT_ID = 'test-client';
  process.env.COGNITO_DOMAIN = 'auth.example.test';
  process.env.COGNITO_REDIRECT_URI =
    'http://localhost:3000/admin/auth/callback';

  if (scope === undefined) {
    delete process.env.COGNITO_OAUTH_SCOPES;
  } else {
    process.env.COGNITO_OAUTH_SCOPES = scope;
  }

  try {
    callback();
  } finally {
    for (const [key, value] of Object.entries({
      COGNITO_APP_CLIENT_ID: previous.clientId,
      COGNITO_DOMAIN: previous.domain,
      COGNITO_REDIRECT_URI: previous.redirectUri,
      COGNITO_OAUTH_SCOPES: previous.scopes,
    })) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
}

test('requests only openid by default', () => {
  withOAuthEnvironment(undefined, () => {
    const { url } = buildAuthorizeUrl({ headers: { host: 'localhost:3000' } });
    assert.equal(new URL(url).searchParams.get('scope'), 'openid');
  });
});

test('honors an explicit Cognito OAuth scope override', () => {
  withOAuthEnvironment('openid email', () => {
    const { url } = buildAuthorizeUrl({ headers: { host: 'localhost:3000' } });
    assert.equal(new URL(url).searchParams.get('scope'), 'openid email');
  });
});
