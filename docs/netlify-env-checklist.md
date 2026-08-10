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
DYNAMODB_STUDIO_NOTIFICATIONS_INDEX=studio-notifications-index
STUDIO_NOTIFICATION_RETENTION_DAYS=120
ACCESS_LOG_RETENTION_DAYS=400
STUDIO_PRODUCTION_LEAD_PERSON_IDS=producer-person-id,production-lead-person-id
STUDIO_ADMIN_NOTIFICATION_PERSON_IDS=studio-manager-person-id,admin-person-id
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

# Signs revocable, episode-scoped public guest-questionnaire links.
# Use a separate random value of at least 32 characters.
GUEST_QUESTIONNAIRE_TOKEN_SECRET=...

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
STUDIO_MIC_KIT_MANAGER_PERSON_IDS=logistics-person-id,studio-manager-person-id
```

## Recommended Cognito URL Values

These are optional in code because the app can derive them from the current
request host. Setting them explicitly in production removes ambiguity.

```txt
COGNITO_REDIRECT_URI=https://theavalanchehour.com/admin/auth/callback
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
2. Confirm the Stripe webhook endpoint points to:
   - `https://theavalanchehour.com/api/webhook`
3. Confirm the IAM user policy includes all seven tables:
   - `AvalancheHourInventory`
   - `AvalancheHourOrders`
   - `AvalancheHourSiteContent`
   - `AvalancheHourSponsors`
   - `AvalancheHourPeople`
   - `AvalancheHourMicKits`
   - `AvalancheHourProducts`
4. Confirm the policy also allows `dynamodb:Query` against both index paths:
   - `arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourProducts/index/*`
   - `arn:aws:dynamodb:us-east-2:426018612622:table/AvalancheHourSiteContent/index/*`
5. Confirm the IAM user policy allows the underlying `dynamodb:PutItem`,
   `dynamodb:UpdateItem`, and `dynamodb:DeleteItem` operations used inside
   transaction requests.
6. Keep the episode-assets bucket private, enable default encryption, block all
   public access, and grant its dedicated runtime identity only the required
   `s3:PutObject`, `s3:GetObject`, `s3:GetObjectVersion`, and
   `s3:DeleteObjectVersion` access under `episodes/*` (`HeadObject`
   authorization uses `s3:GetObject`, verified downloads are pinned to an S3
   version, and confirmed file deletion removes that exact version). An S3
   `AccessDenied` response that names `s3:GetObjectVersion` must be fixed on
   the IAM policy attached to the identity behind
   `EPISODE_ASSETS_ACCESS_KEY_ID`; it is not a CORS failure.
   Also grant `s3:ListBucketVersions` on the bucket itself with an
   `s3:prefix` condition limited to `episodes/*`. Protected whole-Studio
   deletion and its scheduled durable cleanup use that narrow listing
   permission after the signed-upload safety window to remove every version
   and delete marker for the episode.
   Updating that policy does not require a Netlify environment change or
   redeploy unless the access key is also rotated. Do not grant
   `s3:DeleteObject`: it would create a delete marker rather than removing the
   recorded version. Do not grant unrestricted `s3:ListBucket`.
8. Add an S3 CORS rule allowing `PUT` and `POST` from the production site
   origin with the `Content-Type` and `If-None-Match` headers. Episode and guest
   assets use size-bound, one-write signed `PUT` requests; product images keep
   signed `POST` forms. The same rule supports the preflight needed for visible
   upload progress. Do not allow wildcard origins in production.
9. Grant the product-image identity only `s3:PutObject` and `s3:GetObject`
   under `products/*`. If product images reuse the Episode Studio identity,
   add that prefix to its existing restricted policy.
10. Confirm the product table retains `dynamodb:PutItem`,
    `dynamodb:UpdateItem`, `dynamodb:DeleteItem`, and
    `dynamodb:TransactWriteItems`.
11. Confirm the included `studio-maintenance` scheduled function and
   `studio-maintenance-background` function appear in the published Netlify
   deploy. They use `STUDIO_REMINDER_RUN_SECRET` to dispatch the protected
   `/api/studio/reminders/run` endpoint every hour. The generator is idempotent,
   so retries are safe. This is a release requirement, not an optional reminder
   enhancement: the same isolated run resweeps deletion tombstones to catch
   transfers that started before a signed authorization expired and finished
   later.
12. Confirm the store's sales-tax obligations with the appropriate tax
    professional before launch. The current custom PaymentIntent checkout does
    not add sales tax. Enabling Stripe Tax for this flow requires a deliberate
    Stripe API-version migration, tax calculation, and test-mode validation;
    do not imply that tax is calculated until that work is complete.
