/* global Netlify */

import crypto from 'node:crypto';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return (
    leftBuffer.length > 0 &&
    leftBuffer.length === rightBuffer.length &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export default async function studioMaintenanceBackground(request, context) {
  if (request.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }
  const secret = String(
    Netlify.env.get('STUDIO_REMINDER_RUN_SECRET') || ''
  ).trim();
  const authorization = String(request.headers.get('authorization') || '');
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!secret || !safeEqual(secret, providedSecret)) {
    return new Response('Unauthorized', { status: 401 });
  }

  const endpoint = new URL('/api/studio/reminders/run', context.site.url);
  const response = await fetch(endpoint, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    throw new Error(`Studio maintenance failed (${response.status}).`);
  }
  const result = await response.json();
  console.log('Studio maintenance completed.', {
    reminders_created: result.created || 0,
    reminder_failure: result.notification_failed === true,
    deletion_cleanup: result.deletion_cleanup || {},
  });
  return new Response(null, { status: 204 });
}
