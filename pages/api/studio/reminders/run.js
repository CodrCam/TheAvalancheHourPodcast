import crypto from 'crypto';
import { runStudioReminderGeneration } from '../../../../lib/studioReminderService';

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ''));
  const rightBuffer = Buffer.from(String(right || ''));
  return (
    leftBuffer.length === rightBuffer.length &&
    leftBuffer.length > 0 &&
    crypto.timingSafeEqual(leftBuffer, rightBuffer)
  );
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const configuredSecret = String(
    process.env.STUDIO_REMINDER_RUN_SECRET || ''
  ).trim();
  const authorization = String(req.headers.authorization || '');
  const providedSecret = authorization.startsWith('Bearer ')
    ? authorization.slice(7).trim()
    : '';
  if (!configuredSecret || !safeEqual(configuredSecret, providedSecret)) {
    return res.status(401).json({ ok: false, error: 'Unauthorized' });
  }
  try {
    const result = await runStudioReminderGeneration();
    return res.status(200).json({ ok: true, ...result });
  } catch {
    return res.status(500).json({
      ok: false,
      error: 'Studio reminder generation failed.',
    });
  }
}
