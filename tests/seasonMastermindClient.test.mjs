import test from 'node:test';
import assert from 'node:assert/strict';
import {
  invokeSeasonMastermind,
  isSeasonMastermindConfigured,
  isSeasonMastermindEnabled,
  SeasonMastermindServiceError,
  signSeasonMastermindRequest,
} from '../lib/seasonMastermindClient.mjs';

const ENV = {
  SEASON_MASTERMIND_ENABLED: 'true',
  SEASON_MASTERMIND_LAMBDA_URL:
    'https://example123.lambda-url.us-east-2.on.aws/',
  SEASON_MASTERMIND_AWS_REGION: 'us-east-2',
  SEASON_MASTERMIND_ACCESS_KEY_ID: 'AKIAEXAMPLE',
  SEASON_MASTERMIND_SECRET_ACCESS_KEY: 'not-a-real-secret',
};

test('keeps the Season Mastermind disabled and unconfigured by default', () => {
  assert.equal(isSeasonMastermindEnabled({}), false);
  assert.equal(isSeasonMastermindConfigured({}), false);
  assert.equal(
    isSeasonMastermindConfigured({ ...ENV, SEASON_MASTERMIND_ENABLED: 'false' }),
    false
  );
});

test('requires a dedicated complete caller configuration', () => {
  assert.equal(isSeasonMastermindConfigured(ENV), true);
  assert.equal(
    isSeasonMastermindConfigured({
      ...ENV,
      SEASON_MASTERMIND_SECRET_ACCESS_KEY: '',
    }),
    false
  );
});

test('signs only the expected Lambda Function URL host and payload', () => {
  const signed = signSeasonMastermindRequest({
    endpoint: ENV.SEASON_MASTERMIND_LAMBDA_URL,
    region: ENV.SEASON_MASTERMIND_AWS_REGION,
    accessKeyId: ENV.SEASON_MASTERMIND_ACCESS_KEY_ID,
    secretAccessKey: ENV.SEASON_MASTERMIND_SECRET_ACCESS_KEY,
    sessionToken: 'session-token',
    body: { operation: 'list_mastermind' },
    now: new Date('2026-08-19T12:34:56.000Z'),
  });

  assert.equal(signed.url, ENV.SEASON_MASTERMIND_LAMBDA_URL);
  assert.equal(signed.headers.Host, 'example123.lambda-url.us-east-2.on.aws');
  assert.equal(signed.headers['X-Amz-Date'], '20260819T123456Z');
  assert.equal(signed.headers['X-Amz-Security-Token'], 'session-token');
  assert.match(
    signed.headers.Authorization,
    /^AWS4-HMAC-SHA256 Credential=AKIAEXAMPLE\/20260819\/us-east-2\/lambda\/aws4_request, /
  );
  assert.match(
    signed.headers.Authorization,
    /SignedHeaders=content-type;host;x-amz-content-sha256;x-amz-date;x-amz-security-token/
  );
  assert.equal(signed.body, '{"operation":"list_mastermind"}');
});

test('rejects non-Lambda, cross-region, credential-bearing, and query URLs', () => {
  for (const endpoint of [
    'http://example123.lambda-url.us-east-2.on.aws/',
    'https://example.com/',
    'https://example123.lambda-url.us-west-2.on.aws/',
    'https://user:pass@example123.lambda-url.us-east-2.on.aws/',
    'https://example123.lambda-url.us-east-2.on.aws/?redirect=evil',
  ]) {
    assert.throws(
      () =>
        signSeasonMastermindRequest({
          endpoint,
          region: 'us-east-2',
          accessKeyId: 'key',
          secretAccessKey: 'secret',
          body: {},
        }),
      /not an allowed endpoint/
    );
  }
});

test('invokes the signed endpoint and returns a bounded JSON response', async () => {
  let request = null;
  const data = await invokeSeasonMastermind(
    { operation: 'list_mastermind' },
    {
      env: ENV,
      now: new Date('2026-08-19T12:34:56.000Z'),
      fetchImpl: async (url, options) => {
        request = { url, options };
        return new Response(
          JSON.stringify({ ok: true, seasons: [], plans: [] }),
          { status: 200, headers: { 'content-type': 'application/json' } }
        );
      },
    }
  );

  assert.equal(request.url, ENV.SEASON_MASTERMIND_LAMBDA_URL);
  assert.equal(request.options.method, 'POST');
  assert.equal(request.options.redirect, 'error');
  assert.match(request.options.headers.Authorization, /Signature=/);
  assert.deepEqual(data, { ok: true, seasons: [], plans: [] });
});

test('unwraps the bounded Lambda envelope used by the Aurora handler', async () => {
  const data = await invokeSeasonMastermind(
    { operation: 'list_mastermind' },
    {
      env: ENV,
      fetchImpl: async () =>
        new Response(
          JSON.stringify({
            ok: true,
            operation: 'list_mastermind',
            request_id: 'request-123',
            data: { seasons: [], plans: [], page: { has_more: false } },
          }),
          { status: 200 }
        ),
    }
  );

  assert.deepEqual(data, {
    ok: true,
    operation: 'list_mastermind',
    request_id: 'request-123',
    seasons: [],
    plans: [],
    page: { has_more: false },
  });
});

test('maps upstream and invalid responses to safe service errors', async () => {
  await assert.rejects(
    () =>
      invokeSeasonMastermind(
        { operation: 'list_mastermind' },
        {
          env: ENV,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                ok: false,
                code: 'REVISION_CONFLICT',
                error: 'This plan changed. Reload it before saving.',
                status: 409,
              }),
              { status: 409 }
            ),
        }
      ),
    (error) => {
      assert.equal(error instanceof SeasonMastermindServiceError, true);
      assert.equal(error.code, 'REVISION_CONFLICT');
      assert.equal(error.status, 409);
      return true;
    }
  );

  await assert.rejects(
    () =>
      invokeSeasonMastermind(
        { operation: 'list_mastermind' },
        {
          env: ENV,
          fetchImpl: async () => new Response('<html>bad</html>', { status: 500 }),
        }
      ),
    (error) => error.code === 'MASTERMIND_BAD_RESPONSE'
  );

  await assert.rejects(
    () =>
      invokeSeasonMastermind(
        { operation: 'update_plan' },
        {
          env: ENV,
          fetchImpl: async () =>
            new Response(
              JSON.stringify({
                ok: false,
                error: {
                  code: 'REVISION_CONFLICT',
                  message: 'This plan changed. Review the latest version.',
                  status: 409,
                },
              }),
              { status: 409 }
            ),
        }
      ),
    (error) => {
      assert.equal(error.code, 'REVISION_CONFLICT');
      assert.equal(error.status, 409);
      assert.match(error.message, /Review the latest version/);
      return true;
    }
  );
});

test('normalizes non-JSON gateway failures as bounded cold-wake errors', async () => {
  for (const [status, body] of [
    [502, '<html>Internal Server Error</html>'],
    [503, 'Service Unavailable'],
    [504, ''],
  ]) {
    await assert.rejects(
      () =>
        invokeSeasonMastermind(
          { operation: 'list_mastermind' },
          {
            env: ENV,
            fetchImpl: async () =>
              new Response(body, {
                status,
                headers: { 'x-amzn-requestid': `request-${status}` },
              }),
          }
        ),
      (error) => {
        assert.equal(error instanceof SeasonMastermindServiceError, true);
        assert.equal(error.code, 'MASTERMIND_WAKING');
        assert.equal(error.status, status === 504 ? 504 : 503);
        assert.equal(error.requestId, `request-${status}`);
        assert.match(error.message, /waking or temporarily unavailable/i);
        assert.doesNotMatch(error.message, /Internal Server Error|<html>/);
        return true;
      }
    );
  }
});

test('drops unsafe upstream request IDs from public service errors', async () => {
  await assert.rejects(
    () =>
      invokeSeasonMastermind(
        { operation: 'list_mastermind' },
        {
          env: ENV,
          fetchImpl: async () =>
            new Response('Bad Gateway', {
              status: 502,
              headers: { 'x-amzn-requestid': 'request id unsafe' },
            }),
        }
      ),
    (error) => {
      assert.equal(error.code, 'MASTERMIND_WAKING');
      assert.equal(error.requestId, '');
      return true;
    }
  );
});
