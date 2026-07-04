# Cognito Setup Guide

This guide creates named admin users with authenticator-app MFA while the site
continues to support the current environment-variable login during migration.

## Goal

- Use Amazon Cognito User Pools for `/admin` users.
- Require authenticator-app MFA/TOTP.
- Use two groups: `admin` and `logistics`.
- Keep all website users out of the AWS Console.
- Avoid SMS MFA unless there is a specific need for it.

References:

- Cognito MFA: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html
- Cognito pricing: https://aws.amazon.com/cognito/pricing/
- Cognito groups: https://docs.aws.amazon.com/cognito/latest/developerguide/cognito-user-pools-user-groups.html

## 1. Create the user pool

1. Open AWS Console.
2. Go to **Amazon Cognito**.
3. Choose **User pools**.
4. Create a user pool.
5. For sign-in options, use **email**.
6. Disable public self-signup if available. Admin users should be invited,
   not self-created.
7. Use a strong password policy.

## 2. Configure MFA

1. In the user pool, open **Sign-in** or **Multi-factor authentication**.
2. Set MFA to **required**.
3. Enable **Authenticator apps / TOTP / software token MFA**.
4. Leave SMS off for the initial setup.

Authenticator apps include Google Authenticator, 1Password, Authy, iCloud
Passwords, and Microsoft Authenticator.

## 3. Create groups

Create these Cognito groups:

- `admin`
- `logistics`

The site maps these group names to the permission model in `lib/adminAuth.js`.

## 4. Create an app client

1. Create an app client for the website admin.
2. Use a public client if the browser will complete login directly.
3. Do not generate a client secret for browser-based login.
4. Enable the hosted login page if you want Cognito to handle the login/MFA UI.
5. Add callback and logout URLs after the website URL is known.

In the newer AWS console, the callback settings are not on the **User pool
information** card. Use this path instead:

1. Open the user pool.
2. Go to **Applications**.
3. Open **App clients**.
4. Select the Avalanche Hour app client.
5. Open the **Login pages** tab.
6. Click **Edit** in **Managed login pages configuration**.
7. Add the local callback and sign-out URLs below.

For local development, likely callback URLs:

- `http://localhost:3000/admin/auth/callback`

For production, likely callback URLs:

- `https://www.theavalanchehour.com/admin/auth/callback`

## 5. Create users

Create one user per person. Do not share logins.

Suggested first users:

- Site owner or developer: group `admin`
- Fulfillment helper: group `logistics`

Each user should complete their own MFA setup on first login.

## 6. Add environment variables

Add these to the website environment:

```bash
COGNITO_REGION=us-east-2
COGNITO_USER_POOL_ID=us-east-2_grcrw7ZX6
COGNITO_APP_CLIENT_ID=698vs3tcd0oi8m5lvcgq39uq75
COGNITO_APP_CLIENT_SECRET=your-client-secret-if-the-app-client-has-one
COGNITO_DOMAIN=your-cognito-domain.auth.us-east-2.amazoncognito.com
COGNITO_LOGOUT_URI=http://localhost:3000/admin/login

COGNITO_ADMIN_GROUP=admin
COGNITO_LOGISTICS_GROUP=logistics
COGNITO_COOKIE_NAME=ah_admin_token
COGNITO_OAUTH_SCOPES="openid email"
```

`COGNITO_DOMAIN` is the hosted UI domain from Cognito. You can paste either the
bare domain or the full URL from **View login page**. The app will normalize it.

Bare domain example:

```bash
COGNITO_DOMAIN=avalanche-hour.auth.us-east-2.amazoncognito.com
```

Full URL example:

```bash
COGNITO_DOMAIN=https://avalanche-hour.auth.us-east-2.amazoncognito.com/login?client_id=...
```

Optional override if Cognito needs an exact callback URL:

```bash
COGNITO_REDIRECT_URI=http://localhost:3000/admin/auth/callback
```

Optional override if Cognito needs an exact sign-out URL:

```bash
COGNITO_LOGOUT_URI=http://localhost:3000/admin/login
```

If the app client has a client secret, add `COGNITO_APP_CLIENT_SECRET`.
You can find it in:

1. Open the user pool.
2. Go to **Applications**.
3. Open **App clients**.
4. Select the Avalanche Hour app client.
5. Open the **Client secrets** tab.

If you create a browser-style app client without a secret, leave
`COGNITO_APP_CLIENT_SECRET` unset.

Keep these during the transition:

```bash
ADMIN_USER=...
ADMIN_PASS=...
LOGISTICS_USER=...
LOGISTICS_PASS=...
```

Optional token values can exist for scripted access, but should not be used for
normal human login:

```bash
ADMIN_TOKEN=...
LOGISTICS_TOKEN=...
```

## 7. Login flow

The local login flow is:

1. Visit `/admin/login`.
2. Click **Continue with Cognito**.
3. Cognito handles password and MFA.
4. Cognito redirects to `/admin/auth/callback`.
5. The app exchanges the code for tokens and stores the access token in an
   HTTP-only cookie.
6. The app redirects to `/admin`.

The local logout flow is:

1. Click **Sign out** in the admin sidebar.
2. The app clears local auth cookies.
3. Cognito clears the hosted UI session.
4. The browser returns to `/admin/login`.

The app requests these OAuth scopes by default:

```bash
openid email
```

If you add scopes in AWS later, set `COGNITO_OAUTH_SCOPES` to match. Do not ask
Cognito for a scope that is not enabled on the app client.

## 8. Migration notes

The current code can verify Cognito JWTs server-side and supports the hosted UI
callback flow. The old basic login credentials can remain during migration, but
normal human users should move to Cognito.

The token verifier accepts a Cognito JWT from:

- `Authorization: Bearer <token>`
- The cookie named by `COGNITO_COOKIE_NAME`
- `cognito_access_token`
- `cognito_id_token`

The recommended token is the Cognito access token because it is intended for
API authorization and includes group claims.
