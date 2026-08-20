# The Avalanche Hour

The Avalanche Hour website is both the public home of the podcast and the
private operating workspace used by hosts, producers, and logistics support.
It brings publishing, episode handoff, team guidance, merchandise, sponsor
management, mic-kit logistics, and day-to-day follow-ups into one system
without trying to replace specialist tools such as audio editors or recording
platforms.

Production: [theavalanchehour.com](https://theavalanchehour.com)

## What the project includes

### Public website

- Current episodes, archive browsing, search, season organization, and Spotify
  data
- Public host profiles and sponsor presentation
- Guest application and contact workflows
- A contextual Slabs and Sluffs voicemail campaign controlled through site
  content
- A Stripe-powered merchandise store with catalog, variants, inventory,
  checkout, order recording, and confirmation pages
- Search-engine metadata, structured data, RSS, sitemap, and robots endpoints

### Team Studio

The authenticated Team Studio starts at `/studio` and adapts to the signed-in
person’s role.

- A priority-based home view for episode, order, inventory, mic-kit, and
  follow-up work
- Episode Studios split into a host **Package**, dedicated **Production Board**,
  and editable **Guest Questionnaire**, with grouped Board/Schedule views,
  air-date-relative deadlines, inline overdue warnings, a Communication
  Clipboard, a Settings drawer, checklist View/Customize modes, private
  proofs, uploads, and approval
- Safe Episode Studio creation and deliberate permanent deletion, including
  removal of attached S3 objects
- Team resources and a publishable host field manual
- Personal profile and public-host content management
- Sponsor-read library and episode assignments
- Shared follow-ups for blockers, questions, decisions, and durable next steps
- Notifications and production reminders
- Mic-kit requests, inventory, handoff planning, tracking, shipping presets,
  and a Pirate Ship-ready spreadsheet export for US home-base shipments
- Product catalog, stock, product images, orders, homepage content, people,
  sponsors, and system-health administration
- A technical-support contact available throughout the signed-in workspace

Pirate Ship does not currently offer a public API. For US home-base shipments,
the Studio prepares a protected spreadsheet for an authorized coordinator to
upload, review, and purchase manually in Pirate Ship. Direct handoffs are
created individually so the current holder's Ship From address is confirmed;
non-US-origin shipments remain a manual carrier workflow. The application must
not invent or store Pirate Ship API credentials; an API integration should be
reconsidered only if Pirate Ship officially launches one.

## Roles and access

Amazon Cognito groups are translated into application permissions. A person may
belong to more than one group.

| Group | Primary use |
| --- | --- |
| `host` | Personal episodes, responses, uploads, resources, profile, mic-kit requests, follow-ups, and notifications |
| `studio_manager` | Host capabilities plus scheduling, producer tools, approvals, resources, sponsor reads, access management, and team follow-up triage |
| `logistics` | Orders, inventory, products, sponsors, mic kits, and operational follow-ups |
| `admin` | Full Team Studio and operations access |

The permission definitions live in `lib/accessControl.mjs`; navigation is
derived from those permissions in `lib/studioNavigation.mjs`.

## Technical architecture

| Area | Technology |
| --- | --- |
| Application | Next.js Pages Router, React, JavaScript |
| Interface | CSS Modules and Material UI icons/components |
| Hosting | Netlify with `@netlify/plugin-nextjs` |
| Authentication | Amazon Cognito OAuth with PKCE |
| Operational data | Amazon DynamoDB |
| Episode and product files | Amazon S3 with short-lived signed uploads and downloads |
| Commerce | Stripe |
| Podcast catalog | Spotify Web API |
| Email | Nodemailer-backed transactional notifications |
| Tests | Node’s built-in test runner |

The production build uses Webpack explicitly. Next.js 16 defaults to Turbopack,
but the Webpack build is retained here for consistent fresh-page behavior in
both Safari and Chrome.

## Local development

### Requirements

- Node.js 22.13 or newer
- npm
- Access to the required development services and environment variables

### Start the application

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev` uses Webpack and regenerates optimized public images before
starting Next.js.

### Environment configuration

Create `.env.local` for local development. Never commit credentials or copy
production secrets into source files.

The application reads environment variables in these groups:

#### Public site

```text
NEXT_PUBLIC_BASE_URL
NEXT_PUBLIC_GA_MEASUREMENT_ID
NEXT_PUBLIC_TURNSTILE_SITE_KEY
TURNSTILE_SECRET_KEY
SPOTIFY_CLIENT_ID
SPOTIFY_CLIENT_SECRET
CONTACT_EMAIL
```

`NEXT_PUBLIC_TURNSTILE_SITE_KEY` and `TURNSTILE_SECRET_KEY` are the public and
server keys for the Cloudflare Turnstile widget protecting the Guest,
Contact, and Sponsorship forms. Both production values are required before a
production deploy; the server fails closed when the secret is absent. Local
development uses Cloudflare's documented testing keys.

#### Cognito authentication

```text
COGNITO_DOMAIN
COGNITO_APP_CLIENT_ID
COGNITO_APP_CLIENT_SECRET
COGNITO_REDIRECT_URI
COGNITO_OAUTH_SCOPES
COGNITO_REGION
COGNITO_USER_POOL_ID
COGNITO_ISSUER
COGNITO_COOKIE_NAME
COGNITO_ADMIN_GROUP
COGNITO_STUDIO_MANAGER_GROUP
COGNITO_LOGISTICS_GROUP
COGNITO_HOST_GROUP
```

For production, the Cognito callback must be:

```text
https://theavalanchehour.com/admin/auth/callback
```

The app client must allow that exact callback URL and the corresponding
sign-out URL.

#### DynamoDB

```text
DYNAMODB_REGION
DYNAMODB_ACCESS_KEY_ID
DYNAMODB_SECRET_ACCESS_KEY
DYNAMODB_SESSION_TOKEN
DYNAMODB_INVENTORY_TABLE
DYNAMODB_ORDERS_TABLE
DYNAMODB_PRODUCTS_TABLE
DYNAMODB_PEOPLE_TABLE
DYNAMODB_SITE_CONTENT_TABLE
DYNAMODB_SPONSORS_TABLE
DYNAMODB_MIC_KITS_TABLE
DYNAMODB_STUDIO_NOTIFICATIONS_INDEX
ACCESS_LOG_RETENTION_DAYS
```

`ACCESS_LOG_RETENTION_DAYS` is optional (400 days by default, constrained to
30–730 days). Successful Cognito sessions are stored in the existing site-content
table and are visible only to accounts with `audit:read` access.

The DynamoDB client can fall back to the standard `AWS_ACCESS_KEY_ID`,
`AWS_SECRET_ACCESS_KEY`, `AWS_SESSION_TOKEN`, and `AWS_REGION` variables when
dedicated DynamoDB credentials are not supplied.

#### S3 uploads

```text
EPISODE_ASSETS_S3_BUCKET
EPISODE_ASSETS_S3_REGION
EPISODE_ASSETS_ACCESS_KEY_ID
EPISODE_ASSETS_SECRET_ACCESS_KEY
EPISODE_ASSETS_SESSION_TOKEN
EPISODE_ASSETS_UPLOAD_TOKEN_SECRET
GUEST_QUESTIONNAIRE_TOKEN_SECRET
```

`GUEST_QUESTIONNAIRE_TOKEN_SECRET` must be a separate random value of at least
32 characters. It signs expiring, revocable guest links and must not be the
same value used for upload authorization.

Product images use the episode-asset configuration by default. They may use
separate values when these variables are set:

```text
PRODUCT_IMAGES_S3_BUCKET
PRODUCT_IMAGES_S3_REGION
PRODUCT_IMAGES_ACCESS_KEY_ID
PRODUCT_IMAGES_SECRET_ACCESS_KEY
PRODUCT_IMAGES_SESSION_TOKEN
PRODUCT_IMAGES_UPLOAD_TOKEN_SECRET
```

The S3 bucket CORS policy must allow the production and local-development
origins to perform the signed upload method used by the application.

#### Stripe and email

```text
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
EMAIL_USER
EMAIL_PASS
STUDIO_PRODUCER_EMAILS
```

#### Team operations

```text
STUDIO_PRODUCTION_LEAD_PERSON_IDS
STUDIO_MIC_KIT_MANAGER_PERSON_IDS
STUDIO_NOTIFICATION_RETENTION_DAYS
STUDIO_REMINDER_RUN_SECRET
STUDIO_SUPPORT_NAME
STUDIO_SUPPORT_EMAIL
STUDIO_SUPPORT_PHONE
```

`SUPABASE_DB_URL` remains available to the legacy export/migration scripts; the
live operational stores use DynamoDB.

## Useful commands

| Command | Purpose |
| --- | --- |
| `npm run dev` | Optimize images and start the local Webpack development server |
| `npm test` | Run the unit and security test suite |
| `npm run lint` | Run ESLint across the project |
| `npm run build` | Create the production-style Webpack build used by Netlify |
| `npm run images:optimize` | Regenerate optimized public image variants |
| `npm run studio:reminders` | Run the production reminder service manually |
| `npm run migrate:studio-notifications` | Migrate Studio notification records |
| `npm run seed:dynamo-inventory` | Seed inventory data |
| `npm run seed:dynamo-orders` | Seed order data |
| `npm run seed:dynamo-site-content` | Seed managed site content |
| `npm run seed:dynamo-sponsors` | Seed sponsor data |
| `npm run seed:dynamo-people` | Seed people and role data |
| `npm run create:dynamo-products` | Create the products table |
| `npm run create:dynamo-mic-kits` | Create the mic-kit table |

Treat all create, seed, migration, and reminder commands as operational tools.
Confirm the target environment before running them.

## Important routes

| Route | Purpose |
| --- | --- |
| `/` | Public homepage |
| `/episodes` | Public episode hub |
| `/store` | Public merchandise catalog |
| `/admin/login` | Team authentication |
| `/studio` | Role-aware Team Studio home |
| `/studio/episodes` | Personal episode work |
| `/studio/manage/episodes` | Episode calendar and Studio creation |
| `/studio/episodes/<episode-id>/questionnaire` | Host and producer questionnaire editor |
| `/studio/guest-questionnaire#token=<private-token>` | Private guest response form |
| `/studio/resources` | Team field guide |
| `/studio/inbox` | Shared team follow-ups |
| `/studio/mic-kits` | Requests, locations, and handoffs |
| `/admin/products` | Product catalog and inventory |
| `/admin/orders` | Fulfillment and shipping |
| `/admin/system-health` | Live operational diagnostics |

Older `/admin/studios` and related admin routes remain for compatibility, but
the Team Studio is the primary operational interface.

## Testing and QA

Before a production handoff:

```bash
npm test
npm run lint
npm run build
```

Then perform a signed-in smoke test in both Safari and Chrome:

1. Open `/studio` directly and refresh it.
2. Open an Episode Studio Package from a direct URL, then open its Production
   Board and switch between Board and Schedule.
3. Open the Guest Questionnaire, edit a question without saving, and confirm
   that navigation warns before discarding the change. Create a short-lived
   private link only in a safe test Studio, open it in a signed-out browser,
   and verify that guest uploads and submission appear back in the Studio.
4. Switch between producer view and “View as host.”
5. Confirm the Communication Clipboard note and message controls work, and that
   approval blockers explain what is missing.
6. Open Settings and the checklist Customize mode, then discard any unsaved
   sample changes.
7. Open a file-upload control without submitting a test file.
8. Enter a sample product price and stock count, then discard the unsaved
   product.
9. Open a mic kit and verify the status menu.
10. Run System Health.
11. Sign out and confirm the Team Sign In page appears.

Safari and Chrome should both complete fresh-page loads; client-side navigation
alone is not a sufficient browser test.

## Deployment

The site is deployed through Netlify using `netlify.toml`.

- Build command: `npm run build`
- Publish directory: `.next`
- Node.js: 22.13.0
- Next.js integration: `@netlify/plugin-nextjs`

Production secrets and table names belong in the Netlify environment, not in
the repository. After a deployment, verify the published deploy, run System
Health, and complete the two-browser smoke test above.

## Data and deletion safety

- Episode and product uploads use signed S3 operations; clients do not receive
  long-lived AWS credentials.
- Guest-questionnaire links are episode-scoped, expiring, and revocable. The
  plaintext token is not persisted server-side; the guest page keeps it only
  in tab-scoped session storage after removing it from the URL. Guest shipping
  answers are visible only to the assigned producer and Studio managers.
- Episode Studio deletion uses a protected two-stage workflow: it first locks
  the Studio until outstanding signed upload authorizations expire, then sweeps every S3
  version under that episode prefix, removes the private questionnaire, and
  leaves only a minimal cleanup marker containing the episode storage
  identifier and cleanup timestamps. Older identifiers may contain title words,
  so the marker is automatically purged after a 30-day resweep window once S3
  confirms the prefix is empty. Questionnaire answers, production notes,
  file metadata, assignments, and the episode title are removed. The included
  hourly Studio maintenance job resweeps deleted prefixes so a large upload
  already underway cannot become an orphan after the active Studio disappears.
- Product, order, and people administration should preserve identifiers used by
  Stripe, DynamoDB, and historical records.
- Never run seed or migration scripts against production without reviewing the
  configured environment first.
- Never commit `.env.local`, AWS credentials, Stripe secrets, Cognito secrets,
  questionnaire secrets, or upload-token secrets.
