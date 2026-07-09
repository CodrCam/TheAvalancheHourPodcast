# Admin Security Plan

This is the working plan for moving The Avalanche Hour admin from shared basic
auth toward named users, roles, and MFA.

## Current state

The app supports two admin roles:

- `admin`: full access.
- `logistics`: order workflow, shipping exports, and inventory updates.

Normal human login uses Amazon Cognito named users and groups. Legacy
environment-variable credentials are disabled unless
`ALLOW_LEGACY_ADMIN_AUTH=true` is explicitly set for a temporary emergency path:

- `ALLOW_LEGACY_ADMIN_AUTH`
- `ADMIN_USER`
- `ADMIN_PASS`
- `LOGISTICS_USER`
- `LOGISTICS_PASS`

Optional token values are supported for scripted access, but should not be used
for normal human login and also require the legacy flag:

- `ADMIN_TOKEN`
- `LOGISTICS_TOKEN`

## Auth model

Use Amazon Cognito User Pools for named admin users.

Recommended setup:

- Require MFA for both `admin` and `logistics`.
- Prefer authenticator-app MFA/TOTP over SMS.
- Use Cognito groups named `admin` and `logistics`.
- Map Cognito group claims to the same permission names already used in
  `lib/adminAuth.js`.
- Do not give website admins AWS Console access.

Authenticator-app MFA is the preferred default because it avoids SMS delivery
costs and phone-number delivery issues. SMS MFA can be kept as a later fallback,
but Amazon Cognito sends SMS through Amazon SNS, which has separate pricing.
Email-code MFA can also involve separate email delivery pricing and tier
requirements.

References:

- Cognito MFA options: https://docs.aws.amazon.com/cognito/latest/developerguide/user-pool-settings-mfa.html
- Cognito pricing: https://aws.amazon.com/cognito/pricing/

## Permission model

Admin:

- `orders:read`
- `orders:update`
- `orders:export`
- `inventory:read`
- `inventory:update`
- `products:read`
- `products:update`
- `sponsors:read`
- `sponsors:update`
- `banners:read`
- `banners:update`
- `users:manage`
- `audit:read`

Logistics:

- `orders:read`
- `orders:update`
- `orders:export`
- `inventory:read`
- `inventory:update`
- `products:read`
- `sponsors:read`
- `banners:read`

## Next implementation steps

1. Create the Cognito user pool with required authenticator-app MFA.
2. Add `admin` and `logistics` Cognito groups.
3. Invite named users instead of sharing credentials.
4. Add a Cognito token verification helper in the Next.js API layer.
5. Replace basic auth middleware with Cognito session checks.
6. Keep server-side permission checks on every admin API route.
7. Add an audit log before expanding content-editing tools.
