// pages/api/store/admin/auth/login.js
import {
  authCookieOptions,
  buildAuthorizeUrl,
  getOAuthCookieNames,
  serializeCookie,
} from '../../../../../lib/cognitoOAuth';

export default function handler(req, res) {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { url, state, verifier } = buildAuthorizeUrl(req);
    const names = getOAuthCookieNames();
    const cookieOptions = authCookieOptions(req, 10 * 60);

    res.setHeader('Set-Cookie', [
      serializeCookie(names.state, state, cookieOptions),
      serializeCookie(names.verifier, verifier, cookieOptions),
    ]);

    return res.redirect(302, url);
  } catch (err) {
    return res.status(500).json({
      error: err.message || 'Failed to start Cognito login',
    });
  }
}
