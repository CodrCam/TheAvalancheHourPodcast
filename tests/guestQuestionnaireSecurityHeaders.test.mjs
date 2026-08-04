import test from 'node:test';
import assert from 'node:assert/strict';

test('isolates the public guest questionnaire from framing and third-party scripts', async () => {
  const configModule = await import(
    `../next.config.js?headers=${Date.now()}`
  );
  const config = configModule.default;
  const routes = await config.headers();
  const guestRoute = routes.find(
    (route) => route.source === '/studio/guest-questionnaire'
  );
  assert.ok(guestRoute);
  const headers = Object.fromEntries(
    guestRoute.headers.map((header) => [header.key, header.value])
  );
  assert.equal(headers['X-Frame-Options'], 'DENY');
  assert.equal(headers['X-Content-Type-Options'], 'nosniff');
  assert.equal(headers['Referrer-Policy'], 'no-referrer');
  assert.match(headers['Permissions-Policy'], /camera=\(\)/);
  assert.match(headers['Content-Security-Policy'], /frame-ancestors 'none'/);
  assert.match(headers['Content-Security-Policy'], /object-src 'none'/);
  assert.doesNotMatch(
    headers['Content-Security-Policy'],
    /googletagmanager|google-analytics/
  );
});
