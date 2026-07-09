# Security Hardening Backlog

Last updated: July 9, 2026

This document tracks the next security and reliability improvements for The
Avalanche Hour website. These items are not launch blockers right now, but they
are the work that would make the admin, store, and checkout flows more resilient
as more people start using the backend.

## Current Baseline

- Admin sign-in uses Cognito named users and Cognito groups.
- Legacy shared admin username/password fallback has been removed from the app
  runtime.
- Admin routes are protected by server-side permission checks.
- Stripe webhooks verify signatures before order and inventory work.
- Browser-side order recording verifies the Stripe PaymentIntent before writing
  to DynamoDB.
- Orders, inventory, homepage content, and sponsors now live in DynamoDB-backed
  admin flows.

## Priority 1: Rate Limiting

Goal: prevent cheap abuse of public endpoints without making normal use harder.

Recommended targets:

- `/api/contact`
- `/api/guest-application`
- `/api/store/create-payment-intent`
- `/api/store/cart-validate`
- `/api/spotify`

Suggested approach:

- Add a small rate-limit helper that keys by IP address plus route.
- Keep limits loose for normal users, tighter for contact-style form spam.
- Return `429` with a friendly message when the limit is exceeded.
- Log repeated hits so abuse patterns are visible.

Notes:

- Checkout intent creation is the most important store endpoint to protect
  because it can create Stripe objects.
- Contact and guest forms should be protected because they send email.
- Spotify can be protected mostly for cost/performance hygiene.

## Priority 2: CSRF Protection For Admin Writes

Goal: make sure an admin's valid browser session cannot be abused by another
site making background requests.

Recommended targets:

- `/api/store/admin/update-stock`
- `/api/store/admin/orders`
- `/api/store/admin/site-content`
- `/api/store/admin/sponsors`
- Any future admin `POST`, `PATCH`, `PUT`, or `DELETE` endpoint.

Suggested approach:

- Generate a same-site CSRF token for the admin session.
- Require that token in a header such as `x-admin-csrf-token` for admin write
  requests.
- Keep `GET` requests read-only and token-free.
- Continue relying on Cognito for identity and role checks; CSRF is an extra
  browser-safety layer, not a replacement.

Notes:

- Current Cognito cookies already reduce risk when configured with secure
  cookie settings.
- CSRF protection is still worth adding because the admin can change inventory,
  orders, homepage content, and sponsors.

## Priority 3: Persistent Admin Audit Trail

Goal: know who changed what, and when, without digging through transient server
logs.

Recommended events:

- Inventory quantity changes.
- Inventory hide/show/archive/delete actions.
- Order fulfillment status changes.
- Order deletes.
- Homepage CTA updates.
- Sponsor creates, edits, deletes, and episode-placement changes.
- Admin login/logout events if available from the app side.

Suggested table shape:

- Table: `AvalancheHourAdminAudit`
- Partition key: `event_id`
- Useful fields:
  - `created_at`
  - `actor`
  - `role`
  - `action`
  - `resource_type`
  - `resource_id`
  - `before`
  - `after`
  - `request_id`

Suggested approach:

- Keep writing simple audit log entries from admin API routes.
- Do not store secrets, payment card data, raw Cognito tokens, or full cookies.
- Add an admin-only audit view later if it becomes useful.

Notes:

- This would help answer questions like "who changed this sponsor?" or "when
  did this order get marked shipped?"
- The current `logAdminAction` shape can become the bridge into this table.

## Priority 4: Failure Alerts

Goal: notify Cameron when something operationally important fails, before Caleb
has to report that the store looks broken.

Recommended alert cases:

- Stripe webhook signature failures above a small threshold.
- Stripe webhook order write failure.
- Stripe webhook inventory decrement failure.
- DynamoDB credential/configuration errors.
- Order notification email failure.
- Store inventory API returning repeated `500` responses.
- Admin health panel detects store, orders, sponsor, or content data failures.

Suggested approach:

- Start with email alerts to Cameron for high-signal failures.
- Add a short dedupe window so one outage does not send dozens of emails.
- Include route, error type, timestamp, and a plain-language description.
- Avoid including customer-sensitive data unless it is needed to resolve the
  issue.

Notes:

- The webhook currently acknowledges some database/inventory failures to avoid
  repeated Stripe retries. That is reasonable, but those failures should become
  visible through alerts.
- This should be paired with the admin health panel so Caleb can report what he
  sees and Cameron can receive the technical version automatically.

## Priority 5: IAM And Secrets Hygiene

Goal: keep AWS and Netlify access narrowly scoped and easy to rotate.

Checklist:

- Remove `ADMIN_USER`, `ADMIN_PASS`, and `ADMIN_TOKEN` from Netlify once
  production Cognito is confirmed stable.
- Keep DynamoDB IAM permissions limited to only the required tables.
- Avoid using broad AWS account keys.
- Rotate the DynamoDB access key after the migration stabilizes.
- Keep Cognito client secret, Stripe keys, email app passwords, and AWS secrets
  only in environment variables.
- Never store secrets in docs, source files, screenshots, or seed files.

## Priority 6: Admin Session Hardening

Goal: reduce damage if an admin session is stolen.

Recommended checks:

- Require authenticator-app MFA for every Cognito admin user.
- Prefer short-lived access tokens with refresh handled through Cognito.
- Keep admin cookies `HttpOnly`, `Secure` in production, and `SameSite=Lax` or
  stricter where practical.
- Keep Cognito groups minimal: `admin` and `logistics`.
- Review group membership after role changes.

## Not Planned Right Now

- A public admin activity feed.
- Complex per-field permissions.
- Custom Cognito replacement auth.
- Deleting archived DynamoDB records automatically.
- Moving sponsor images out of DynamoDB immediately, unless uploaded logo size
  or volume becomes a real issue.

## Suggested Order Of Work

1. Add rate limiting to public form and checkout endpoints.
2. Add CSRF protection to admin write endpoints.
3. Add persistent audit logging for admin changes.
4. Add failure alert emails for webhook, DynamoDB, and notification failures.
5. Rotate AWS keys and remove old Netlify admin env variables.
6. Revisit MFA enforcement and Cognito session settings.

