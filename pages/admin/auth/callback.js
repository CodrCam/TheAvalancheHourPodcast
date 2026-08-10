// pages/admin/auth/callback.js
import {
  authCookieOptions,
  exchangeCodeForTokens,
  getCognitoOAuthConfig,
  getOAuthCookieNames,
  serializeCookie,
} from '../../../lib/cognitoOAuth';
import {
  getDisplayNameFromCognitoPayload,
  getGroupsFromCognitoPayload,
  getRoleFromCognitoPayload,
  getUsernameFromCognitoPayload,
  verifyCognitoToken,
} from '../../../lib/cognitoAuth';
import { recordAccessSession } from '../../../lib/accessLogStore';
import { getTeamLandingForGroups } from '../../../lib/teamLanding.mjs';

function getCookie(req, name) {
  return req.cookies?.[name] || '';
}

function clearCookie(name, req) {
  return serializeCookie(name, '', authCookieOptions(req, 0));
}

export default function AdminAuthCallback() {
  return null;
}

export async function getServerSideProps({ req, res, query }) {
  const names = getOAuthCookieNames();
  const expectedState = getCookie(req, names.state);
  const verifier = getCookie(req, names.verifier);
  const returnedState = typeof query.state === 'string' ? query.state : '';
  const code = typeof query.code === 'string' ? query.code : '';
  const error = typeof query.error === 'string' ? query.error : '';
  const errorDescription =
    typeof query.error_description === 'string' ? query.error_description : '';

  if (error) {
    const params = new URLSearchParams({ error });
    if (errorDescription) params.set('error_description', errorDescription);

    return {
      redirect: {
        destination: `/admin/login?${params.toString()}`,
        permanent: false,
      },
    };
  }

  if (!code || !expectedState || expectedState !== returnedState || !verifier) {
    return {
      redirect: {
        destination: '/admin/login?error=invalid_callback',
        permanent: false,
      },
    };
  }

  try {
    const tokens = await exchangeCodeForTokens(req, { code, verifier });
    const config = getCognitoOAuthConfig(req);
    const tokenMaxAge = Number(tokens.expires_in) || 3600;
    const tokenOptions = authCookieOptions(req, tokenMaxAge);

    const cookies = [
      serializeCookie(config.cookieName, tokens.access_token, tokenOptions),
      clearCookie(names.state, req),
      clearCookie(names.verifier, req),
    ];

    if (tokens.id_token) {
      cookies.push(
        serializeCookie('cognito_id_token', tokens.id_token, tokenOptions)
      );
    }

    res.setHeader('Set-Cookie', cookies);
    const payload = await verifyCognitoToken(tokens.access_token);
    let identityPayload = payload;
    if (tokens.id_token) {
      try {
        const verifiedIdentity = await verifyCognitoToken(tokens.id_token);
        if (verifiedIdentity?.sub === payload?.sub) {
          identityPayload = verifiedIdentity;
        }
      } catch {
        // The verified access token is enough to authorize the session.
      }
    }
    const groups = getGroupsFromCognitoPayload(payload);
    const destination = getTeamLandingForGroups(groups);

    try {
      await recordAccessSession(req, {
        subject: payload?.sub || '',
        username: getUsernameFromCognitoPayload(identityPayload),
        displayName: getDisplayNameFromCognitoPayload(identityPayload),
        role: getRoleFromCognitoPayload(payload),
        groups,
        sessionId:
          payload?.jti ||
          payload?.origin_jti ||
          `${payload?.sub || ''}:${payload?.iat || ''}`,
        sessionIssuedAt: payload?.iat || 0,
        sessionExpiresAt: payload?.exp || 0,
      });
    } catch (accessLogError) {
      console.error('access login recording failed:', accessLogError);
    }

    return {
      redirect: {
        destination,
        permanent: false,
      },
    };
  } catch (err) {
    return {
      redirect: {
        destination: `/admin/login?error=${encodeURIComponent(
          err.message || 'token_exchange_failed'
        )}`,
        permanent: false,
      },
    };
  }
}
