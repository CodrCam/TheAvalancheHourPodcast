import nodemailer from 'nodemailer';
import { getEpisodeCompletion } from './episodeStudioPresentation.mjs';

function parseEmails(value = '') {
  return [
    ...new Set(
      String(value || '')
        .split(',')
        .map((email) => email.trim().toLowerCase())
        .filter((email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    ),
  ];
}

export function getDefaultStudioProducerEmail() {
  return (
    parseEmails(process.env.STUDIO_PRODUCER_EMAILS)[0] ||
    parseEmails(process.env.CONTACT_EMAIL)[0] ||
    ''
  );
}

export async function sendEpisodeSubmissionNotification(
  episode,
  { hostNames = [], provisional = false } = {}
) {
  const emailUser = String(process.env.EMAIL_USER || '').trim();
  const emailPass = String(process.env.EMAIL_PASS || '').trim();
  const recipients = parseEmails(
    episode.producer_email ||
      process.env.STUDIO_PRODUCER_EMAILS ||
      process.env.CONTACT_EMAIL
  );

  if (!emailUser || !emailPass || !recipients.length) {
    return {
      sent: false,
      reason: 'Producer notification email is not configured.',
    };
  }

  const deliverablesById = new Map(
    (episode.deliverables || []).map((deliverable) => [
      deliverable.id,
      deliverable,
    ])
  );
  const missingLines = getEpisodeCompletion(episode).missing.map((item) => {
    const deliverable = deliverablesById.get(item.id) || item;
    const expected = deliverable.expected_by
      ? ` Expected by ${deliverable.expected_by}.`
      : '';
    return `- ${deliverable.label}: ${deliverable.missing_note || 'Acknowledged as missing.'}${expected}`;
  });
  const studioUrl = `${
    String(process.env.URL || process.env.DEPLOY_PRIME_URL || '').replace(
      /\/+$/,
      ''
    ) || 'https://www.theavalanchehour.com'
  }/studio/episodes/${episode.episode_id}`;
  const subject = provisional
    ? `Episode package ready with known gaps — ${episode.title}`
    : `Episode package ready for production — ${episode.title}`;
  const text = [
    `${hostNames.join(', ') || 'The assigned host team'} submitted "${episode.title}" for production.`,
    '',
    `Release date: ${episode.target_release_date || 'Not scheduled'}`,
    `Handoff: ${provisional ? 'Known gaps acknowledged' : 'Complete'}`,
    'Producer handoff brief: Included in the Episode Studio',
    '',
    ...(missingLines.length
      ? ['Outstanding materials:', ...missingLines, '']
      : []),
    `Open the Episode Studio: ${studioUrl}`,
  ].join('\n');

  const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: { user: emailUser, pass: emailPass },
  });
  await transporter.sendMail({
    from: emailUser,
    to: recipients.join(','),
    subject,
    text,
  });

  return { sent: true, recipients };
}
