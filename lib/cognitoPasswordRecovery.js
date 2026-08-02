import crypto from 'crypto';

const COGNITO_TARGET_PREFIX =
  'AWSCognitoIdentityProviderService';

function getPasswordRecoveryConfig() {
  return {
    region: String(
      process.env.COGNITO_REGION || process.env.AWS_REGION || ''
    ).trim(),
    clientId: String(process.env.COGNITO_APP_CLIENT_ID || '').trim(),
    clientSecret: String(process.env.COGNITO_APP_CLIENT_SECRET || ''),
  };
}

export function isCognitoPasswordRecoveryConfigured() {
  const config = getPasswordRecoveryConfig();
  return Boolean(config.region && config.clientId);
}

export function createCognitoSecretHash(
  username,
  clientId,
  clientSecret
) {
  if (!clientSecret) return '';

  return crypto
    .createHmac('sha256', clientSecret)
    .update(`${username}${clientId}`)
    .digest('base64');
}

function normalizeCognitoErrorCode(body = {}) {
  const rawCode = body.__type || body.code || body.Code || '';
  return String(rawCode).split('#').pop().split(':').pop();
}

export class CognitoPasswordRecoveryError extends Error {
  constructor(code, message, options = {}) {
    super(message);
    this.name = 'CognitoPasswordRecoveryError';
    this.code = code;
    this.status = options.status;
  }
}

async function callCognito(operation, input, fetchImpl = fetch) {
  const config = getPasswordRecoveryConfig();

  if (!config.region || !config.clientId) {
    throw new CognitoPasswordRecoveryError(
      'RecoveryNotConfigured',
      'Cognito password recovery is not configured'
    );
  }

  const response = await fetchImpl(
    `https://cognito-idp.${config.region}.amazonaws.com/`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-amz-json-1.1',
        'X-Amz-Target': `${COGNITO_TARGET_PREFIX}.${operation}`,
      },
      body: JSON.stringify({
        ...input,
        ClientId: config.clientId,
        ...(config.clientSecret
          ? {
              SecretHash: createCognitoSecretHash(
                input.Username,
                config.clientId,
                config.clientSecret
              ),
            }
          : {}),
      }),
    }
  );

  let body = {};
  try {
    body = await response.json();
  } catch {
    body = {};
  }

  if (!response.ok) {
    const code = normalizeCognitoErrorCode(body) || 'CognitoRequestFailed';
    throw new CognitoPasswordRecoveryError(
      code,
      String(body.message || body.Message || 'Cognito request failed'),
      { status: response.status }
    );
  }

  return body;
}

function cleanUsername(username) {
  return String(username || '').trim().slice(0, 128);
}

export async function startCognitoPasswordRecovery(
  username,
  options = {}
) {
  const clean = cleanUsername(username);
  if (!clean) {
    throw new CognitoPasswordRecoveryError(
      'InvalidUsername',
      'Email or username is required'
    );
  }

  return callCognito(
    'ForgotPassword',
    { Username: clean },
    options.fetchImpl
  );
}

export async function confirmCognitoPasswordRecovery(
  { username, code, password },
  options = {}
) {
  const clean = cleanUsername(username);
  const confirmationCode = String(code || '').trim().slice(0, 2048);
  const newPassword = String(password || '').slice(0, 256);

  if (!clean || !confirmationCode || !newPassword) {
    throw new CognitoPasswordRecoveryError(
      'InvalidRecoveryInput',
      'Email or username, recovery code, and new password are required'
    );
  }

  return callCognito(
    'ConfirmForgotPassword',
    {
      Username: clean,
      ConfirmationCode: confirmationCode,
      Password: newPassword,
    },
    options.fetchImpl
  );
}
