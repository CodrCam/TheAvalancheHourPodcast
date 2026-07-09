# Netlify Environment Variable Checklist

Use this checklist when deploying through Netlify. Add these under:

`Site configuration` -> `Environment variables`

Do not commit real secret values to GitHub.

## Required for Production

These are needed for the live store, admin login, DynamoDB inventory/orders,
checkout, order recording, and notifications.

```txt
NEXT_PUBLIC_BASE_URL=https://www.theavalanchehour.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

DYNAMODB_REGION=us-east-2
DYNAMODB_ACCESS_KEY_ID=...
DYNAMODB_SECRET_ACCESS_KEY=...
DYNAMODB_INVENTORY_TABLE=AvalancheHourInventory
DYNAMODB_ORDERS_TABLE=AvalancheHourOrders
DYNAMODB_SITE_CONTENT_TABLE=AvalancheHourSiteContent
DYNAMODB_SPONSORS_TABLE=AvalancheHourSponsors

COGNITO_DOMAIN=...
COGNITO_REGION=us-east-2
COGNITO_USER_POOL_ID=...
COGNITO_APP_CLIENT_ID=...
COGNITO_APP_CLIENT_SECRET=...
COGNITO_ADMIN_GROUP=admin
COGNITO_LOGISTICS_GROUP=logistics
COGNITO_COOKIE_NAME=ah_admin_token

EMAIL_USER=...
EMAIL_PASS=...
CONTACT_EMAIL=theavalanchehourpodcast@gmail.com
```

## Recommended Cognito URL Values

These are optional in code because the app can derive them from the current
request host. Setting them explicitly in production removes ambiguity.

```txt
COGNITO_REDIRECT_URI=https://www.theavalanchehour.com/admin/auth/callback
COGNITO_LOGOUT_URI=https://www.theavalanchehour.com/admin/login
COGNITO_OAUTH_SCOPES=openid email
```

## Optional Site Integrations

Only add these if the Spotify endpoint is expected to work in production.

```txt
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

## Do Not Add for Normal Production

These are local, legacy, or emergency-only values. Leave them out of Netlify
unless you are intentionally enabling a temporary emergency path.

```txt
ALLOW_LEGACY_ADMIN_AUTH
ADMIN_USER
ADMIN_PASS
ADMIN_TOKEN
LOGISTICS_USER
LOGISTICS_PASS
LOGISTICS_TOKEN
AWS_SESSION_TOKEN
DYNAMODB_SESSION_TOKEN
COGNITO_ISSUER
```

`SUPABASE_DB_URL` is only useful locally for one-off migration/export scripts.
Do not add it to Netlify for the normal production site.

## Before Publishing

1. Confirm the Cognito app client allows these callback URLs:
   - `https://www.theavalanchehour.com/admin/auth/callback`
   - `https://theavalanchehour.com/admin/auth/callback`
2. Confirm the Cognito app client allows these sign-out URLs:
   - `https://www.theavalanchehour.com/admin/login`
   - `https://theavalanchehour.com/admin/login`
3. Confirm the Stripe webhook endpoint points to:
   - `https://www.theavalanchehour.com/api/webhook`
4. Confirm the IAM user policy includes all four tables:
   - `AvalancheHourInventory`
   - `AvalancheHourOrders`
   - `AvalancheHourSiteContent`
   - `AvalancheHourSponsors`
