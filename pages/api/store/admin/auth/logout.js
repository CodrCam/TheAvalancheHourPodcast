// pages/api/store/admin/auth/logout.js
import {
  authCookieOptions,
  buildLogoutUrl,
  getCognitoOAuthConfig,
  getOAuthCookieNames,
  serializeCookie,
} from '../../../../../lib/cognitoOAuth';

function clearCookie(req, name) {
  return serializeCookie(name, '', authCookieOptions(req, 0));
}

export default function handler(req, res) {
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const oauthCookies = getOAuthCookieNames();
  const config = getCognitoOAuthConfig(req);
  const redirectTo = buildLogoutUrl(req);

  res.setHeader('Set-Cookie', [
    clearCookie(req, config.cookieName),
    clearCookie(req, 'cognito_id_token'),
    clearCookie(req, 'cognito_access_token'),
    clearCookie(req, 'admin_token'),
    clearCookie(req, oauthCookies.state),
    clearCookie(req, oauthCookies.verifier),
  ]);

  return res.redirect(302, redirectTo);
}
