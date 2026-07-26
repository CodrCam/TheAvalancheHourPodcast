# Netlify Environment Variable Checklist

For the complete AWS Console walkthrough, IAM policy, CORS rule, lifecycle
settings, and verification steps, see
[`s3-episode-assets-setup.md`](./s3-episode-assets-setup.md).

Use this checklist when deploying through Netlify. Add these under:

`Site configuration` -> `Environment variables`

Do not commit real secret values to GitHub.

## Required for Production

These are needed for the live store, admin login, DynamoDB inventory/orders,
checkout, order recording, and notifications.

```txt
NEXT_PUBLIC_BASE_URL=https://www.theavalanchehour.com
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=...
NEXT_PUBLIC_GA_MEASUREMENT_ID=G-XXXXXXXXXX

STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...

DYNAMODB_REGION=us-east-2
DYNAMODB_ACCESS_KEY_ID=...
DYNAMODB_SECRET_ACCESS_KEY=...
DYNAMODB_INVENTORY_TABLE=AvalancheHourInventory
DYNAMODB_ORDERS_TABLE=AvalancheHourOrders
DYNAMODB_SITE_CONTENT_TABLE=AvalancheHourSiteContent
DYNAMODB_SPONSORS_TABLE=AvalancheHourSponsors
DYNAMODB_PEOPLE_TABLE=AvalancheHourPeople
DYNAMODB_MIC_KITS_TABLE=AvalancheHourMicKits
DYNAMODB_PRODUCTS_TABLE=AvalancheHourProducts

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

# Canonical Episode Studio asset package
EPISODE_ASSETS_S3_BUCKET=...
EPISODE_ASSETS_S3_REGION=us-east-2
EPISODE_ASSETS_ACCESS_KEY_ID=...
EPISODE_ASSETS_SECRET_ACCESS_KEY=...
# Only set when using temporary AWS credentials; leave empty for an IAM user.
EPISODE_ASSETS_SESSION_TOKEN=
EPISODE_ASSETS_UPLOAD_TOKEN_SECRET=...

# Optional separate product-image package. When omitted, product images reuse
# the private Episode Studio bucket and credentials above.
PRODUCT_IMAGES_S3_BUCKET=...
PRODUCT_IMAGES_S3_REGION=us-east-2
PRODUCT_IMAGES_ACCESS_KEY_ID=...
PRODUCT_IMAGES_SECRET_ACCESS_KEY=...
PRODUCT_IMAGES_SESSION_TOKEN=
PRODUCT_IMAGES_UPLOAD_TOKEN_SECRET=...

# Authenticates the scheduled reminder runner
STUDIO_REMINDER_RUN_SECRET=...
STUDIO_MIC_KIT_MANAGER_PERSON_IDS=caleb-merrill,cam-griffin
```

## Recommended Cognito URL Values

These are optional in code because the app can derive them from the current
request host. Setting them explicitly in production removes ambiguity.

```txt
COGNITO_REDIRECT_URI=https://www.theavalanchehour.com/admin/auth/callback
COGNITO_LOGOUT_URI=https://www.theavalanchehour.com/admin/login
COGNITO_OAUTH_SCOPES=openid
```

## Optional Site Integrations

Only add these if the Spotify endpoint is expected to work in production.

```txt
SPOTIFY_CLIENT_ID=...
SPOTIFY_CLIENT_SECRET=...
```

## Remove From Production

The admin now uses Cognito only. Delete these legacy variables from Netlify if
they exist; the app no longer reads them for admin access.

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
4. Confirm the IAM user policy includes all seven tables:
   - `AvalancheHourInventory`
   - `AvalancheHourOrders`
   - `AvalancheHourSiteContent`
   - `AvalancheHourSponsors`
   - `AvalancheHourPeople`
   - `AvalancheHourMicKits`
   - `AvalancheHourProducts`
5. Confirm the product table policy also includes
   `arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourProducts/index/*`
   and allows `dynamodb:Query`.
6. Confirm the IAM user policy allows `dynamodb:UpdateItem` and
   `dynamodb:TransactWriteItems`; product saves and paid merchandise orders use
   transactions so catalog and inventory changes remain atomic.
7. Keep the episode-assets bucket private, enable default encryption, block all
   public access, and grant its dedicated runtime identity only the required
   `s3:PutObject`, `s3:GetObject`, and `s3:GetObjectVersion` access under
   `episodes/*` (`HeadObject` authorization uses `s3:GetObject`, and verified
   downloads are pinned to an S3 version). An S3 `AccessDenied` response that
   names `s3:GetObjectVersion` must be fixed on the IAM policy attached to the
   identity behind `EPISODE_ASSETS_ACCESS_KEY_ID`; it is not a CORS failure.
   Updating that policy does not require a Netlify environment change or
   redeploy unless the access key is also rotated.
8. Add an S3 CORS rule allowing `POST` from the production site origin with the
   `Content-Type` header. Episode assets and product images use size-bounded
   signed `POST` forms. Do not allow wildcard origins in production.
9. Grant the product-image identity only `s3:PutObject` and `s3:GetObject`
   under `products/*`. If product images reuse the Episode Studio identity,
   add that prefix to its existing restricted policy.
10. Confirm the product table retains `dynamodb:PutItem`,
    `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, and
    `dynamodb:TransactWriteItems`.
11. Configure a Netlify Scheduled Function or another trusted scheduler to POST
   `/api/studio/reminders/run` with
   `Authorization: Bearer $STUDIO_REMINDER_RUN_SECRET`. The generator is
   idempotent, so retries are safe.
12. Confirm the store's sales-tax obligations with the appropriate tax
    professional before launch. The current custom PaymentIntent checkout does
    not add sales tax. Enabling Stripe Tax for this flow requires a deliberate
    Stripe API-version migration, tax calculation, and test-mode validation;
    do not imply that tax is calculated until that work is complete.
