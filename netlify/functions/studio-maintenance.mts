/* global Netlify */

export default async function studioMaintenance(_request, context) {
  const secret = String(
    Netlify.env.get('STUDIO_REMINDER_RUN_SECRET') || ''
  ).trim();
  if (!secret) {
    throw new Error('Studio maintenance secret is not configured.');
  }
  const backgroundUrl = new URL(
    '/.netlify/functions/studio-maintenance-background',
    context.site.url
  );
  const response = await fetch(backgroundUrl, {
    method: 'POST',
    headers: { Authorization: `Bearer ${secret}` },
  });
  if (!response.ok) {
    throw new Error(
      `Studio maintenance background dispatch failed (${response.status}).`
    );
  }
  return new Response(null, { status: 202 });
}

export const config = {
  schedule: '@hourly',
};
