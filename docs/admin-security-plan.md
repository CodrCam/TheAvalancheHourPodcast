# Admin Security Plan

This is the working plan for moving The Avalanche Hour admin from shared basic
auth toward named users, roles, and MFA.

## Current state

The app supports two admin roles:

- `admin`: full access.
- `logistics`: order workflow, shipping exports, and inventory updates.

Normal human login uses Amazon Cognito named users and groups. Legacy
environment-variable credentials have been removed from the runtime. Production
admin access should only work through Cognito.

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

1. Require authenticator-app MFA for all admin users.
2. Keep server-side permission checks on every admin API route.
3. Remove old admin/logistics credential variables from Netlify if they still
   exist.
4. Add read-only UI affordances for logistics on pages where write actions are
   blocked server-side.
5. Promote server-log audit events into a persistent audit table when needed.
