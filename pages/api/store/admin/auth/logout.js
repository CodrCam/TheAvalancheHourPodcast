// pages/api/store/admin/auth/logout.js
import {
  authCookieOptions,
  getCognitoOAuthConfig,
  getOAuthCookieNames,
  serializeCookie,
} from '../../../../../lib/cognitoOAuth.js';
import {
  getCognitoTokenFromRequest,
  verifyCognitoAccessToken,
} from '../../../../../lib/cognitoAuth.js';
import { endAccessSession } from '../../../../../lib/accessLogStore.js';

function clearCookie(req, name) {
  return serializeCookie(name, '', authCookieOptions(req, 0));
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  const oauthCookies = getOAuthCookieNames();
  const config = getCognitoOAuthConfig(req);

  try {
    const payload = await verifyCognitoAccessToken(
      getCognitoTokenFromRequest(req)
    );
    if (payload?.sub) {
      await endAccessSession({
        subject: payload.sub,
        sessionId:
          payload.jti ||
          payload.origin_jti ||
          `${payload.sub}:${payload.iat || ''}`,
        sessionIssuedAt: payload.iat || 0,
      });
    }
  } catch (error) {
    console.error('access sign-out recording failed:', error);
  }

  res.setHeader('Set-Cookie', [
    clearCookie(req, config.cookieName),
    clearCookie(req, 'cognito_id_token'),
    clearCookie(req, 'cognito_access_token'),
    clearCookie(req, oauthCookies.state),
    clearCookie(req, oauthCookies.verifier),
  ]);

  res.redirect(303, '/admin/login?signed_out=1');
}
