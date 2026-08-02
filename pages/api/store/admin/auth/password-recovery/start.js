import {
  CognitoPasswordRecoveryError,
  startCognitoPasswordRecovery,
} from '../../../../../../lib/cognitoPasswordRecovery.js';

const CONFIGURATION_ERRORS = new Set([
  'OperationNotEnabledException',
  'RecoveryNotConfigured',
  'ResourceNotFoundException',
]);

const GENERIC_SUCCESS_MESSAGE =
  'If an eligible account matches, a recovery code was sent to its verified email address or phone number.';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ ok: false, error: 'Method not allowed' });
    return;
  }

  if (!String(req.headers['content-type'] || '').includes('application/json')) {
    res
      .status(400)
      .json({ ok: false, error: 'Content-Type must be application/json' });
    return;
  }

  const username = String(req.body?.username || '').trim();
  if (!username || username.length > 128) {
    res.status(400).json({
      ok: false,
      error: 'Enter the email address or username for your account.',
    });
    return;
  }

  try {
    await startCognitoPasswordRecovery(username);
    res.status(200).json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
  } catch (error) {
    const code =
      error instanceof CognitoPasswordRecoveryError
        ? error.code
        : 'RecoveryRequestFailed';

    if (
      error instanceof CognitoPasswordRecoveryError &&
      !CONFIGURATION_ERRORS.has(code)
    ) {
      res.status(200).json({ ok: true, message: GENERIC_SUCCESS_MESSAGE });
      return;
    }

    console.warn('Cognito password recovery could not start:', code);
    res.status(CONFIGURATION_ERRORS.has(code) ? 503 : 502).json({
      ok: false,
      error:
        'Password recovery is temporarily unavailable. Please try again later.',
    });
  }
}
