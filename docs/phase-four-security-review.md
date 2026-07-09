# Phase 4 Security Review

This phase focuses on reducing ways a bad actor could misuse the admin, store,
or payment flows while keeping the site usable for a small team.

## Current Strengths

- Admin users sign in through Cognito named accounts instead of shared passwords.
- Cognito tokens are verified server-side with issuer, audience/client, expiry,
  and signature checks.
- Admin API routes enforce permissions on the server.
- Legacy admin username/password and token fallback has been removed.
- Stripe webhooks verify signatures before recording paid orders or decrementing
  inventory.
- Inventory decrement is idempotent, so webhook retries should not double-count
  stock changes.

## Changes Made In This Pass

- Browser-created order records now verify the Stripe PaymentIntent before
  writing anything to DynamoDB.
- Browser-created order records now use Stripe-verified payment status, amount,
  order ID, receipt email, and shipping fields.
- Browser-submitted item details are only preserved when their SKU/quantity
  totals match the server-created Stripe metadata.
- The unused `/api/store/apply-tax` endpoint was removed so the public site no
  longer exposes a dormant PaymentIntent update surface.
- Stripe webhook requests with bad signatures now return `400` instead of being
  silently acknowledged.

## Black-Hat Risk Areas To Keep Watching

- Stolen admin session cookie: a stolen Cognito cookie can act as that user until
  it expires. Keep the cookie HttpOnly/SameSite and use MFA in Cognito.
- Over-permissioned roles: logistics should be able to do order/inventory work
  without gaining content-editing powers.
- Public store endpoints: payment, cart validation, contact, and guest forms are
  public and should be rate-limited if abuse appears.
- Public inventory visibility: the frontend needs stock data to prevent
  overselling, but exact quantities can still be inferred through API calls.
- Sponsor logo uploads: current uploaded logos are stored as small data URLs.
  Keep size/type limits strict; later, move images to managed object storage if
  uploads grow.
- Secrets and environment variables: Netlify should not include legacy admin
  credentials.

## Recommended Next Steps

1. Require authenticator-app MFA for all Cognito admin users.
2. Remove legacy admin env vars from production if they still exist.
3. Add read-only UI states for logistics on content and sponsor pages.
4. Add lightweight rate limiting for public form and checkout endpoints.
5. Promote server-log audit events into a DynamoDB audit table when we want a
   permanent admin history.
6. Add security headers for admin pages, including frame protection and a tighter
   content security policy.
7. Rotate AWS/DynamoDB access keys after the migration stabilizes.

See `docs/security-hardening-backlog.md` for the practical follow-up backlog,
including rate limiting, CSRF protection, persistent admin audit logs, failure
alerts, IAM cleanup, and session-hardening notes.
