import {
  CognitoPasswordRecoveryError,
  confirmCognitoPasswordRecovery,
} from '../../../../../../lib/cognitoPasswordRecovery.js';

const PUBLIC_ERRORS = {
  CodeMismatchException:
    'That recovery code is incorrect. Check the code and try again.',
  ExpiredCodeException:
    'That recovery code has expired. Request a new code and try again.',
  InvalidPasswordException:
    'That password does not meet the Team Studio password requirements.',
  PasswordHistoryPolicyViolationException:
    'Choose a password that you have not used recently.',
  TooManyFailedAttemptsException:
    'Too many incorrect attempts. Wait a few minutes before trying again.',
  TooManyRequestsException:
    'Too many recovery attempts. Wait a few minutes before trying again.',
  LimitExceededException:
    'Too many recovery attempts. Wait a few minutes before trying again.',
};

const INVALID_REQUEST_ERRORS = new Set([
  'CodeMismatchException',
  'ExpiredCodeException',
  'InvalidPasswordException',
  'PasswordHistoryPolicyViolationException',
]);

const THROTTLE_ERRORS = new Set([
  'LimitExceededException',
  'TooManyFailedAttemptsException',
  'TooManyRequestsException',
]);

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
  const code = String(req.body?.code || '').trim();
  const password = String(req.body?.password || '');

  if (
    !username ||
    username.length > 128 ||
    !code ||
    code.length > 2048 ||
    !password ||
    password.length > 256
  ) {
    res.status(400).json({
      ok: false,
      error: 'Enter your account, recovery code, and new password.',
    });
    return;
  }

  try {
    await confirmCognitoPasswordRecovery({ username, code, password });
    res.status(200).json({
      ok: true,
      message: 'Your password has been reset. You can sign in now.',
    });
  } catch (error) {
    const codeName =
      error instanceof CognitoPasswordRecoveryError
        ? error.code
        : 'RecoveryConfirmationFailed';

    if (INVALID_REQUEST_ERRORS.has(codeName)) {
      res.status(400).json({ ok: false, error: PUBLIC_ERRORS[codeName] });
      return;
    }

    if (THROTTLE_ERRORS.has(codeName)) {
      res.status(429).json({ ok: false, error: PUBLIC_ERRORS[codeName] });
      return;
    }

    if (
      codeName === 'UserNotFoundException' ||
      codeName === 'NotAuthorizedException'
    ) {
      res.status(400).json({
        ok: false,
        error: 'We could not reset that account. Request a new code and try again.',
      });
      return;
    }

    console.warn('Cognito password recovery could not finish:', codeName);
    res.status(codeName === 'RecoveryNotConfigured' ? 503 : 502).json({
      ok: false,
      error:
        'Password recovery is temporarily unavailable. Please try again later.',
    });
  }
}
