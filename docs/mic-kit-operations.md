# Mic Kit Operations

## Purpose

The Mic Kit board is the shared circulation desk for every Studio role. Hosts,
producers, logistics users, Studio managers, and administrators can see
availability and submit requests. Only administrators can view private mailing
addresses, assign kits, export shipping data, or change inventory records.

The operating goal is to keep routine coordination on the board instead of in
an email chain while still allowing Caleb to make the final logistics decision.

## Current workflow

1. A host submits a need-by date, optional recording date and Episode Studio,
   general location, and private mailing address.
2. The admin board combines the request queue with upcoming episodes and ranks
   requests by production timing.
3. The recommendation engine prefers a confirmed kit in the same country. It
   can also plan a direct handoff from a current host when that kit is due back
   before the next shipment must leave.
4. Caleb reviews the recommendation and selects **Prepare handoff**. This
   reserves the kit, fills the ship-by date, and records the planned due-back
   date.
5. For a US-origin shipment, Caleb downloads the USPS Click-N-Ship CSV. The
   export includes the recipient, the current host as sender when applicable,
   the saved package preset, and internal reference IDs. Only shipments inside
   Click-N-Ship's seven-day mailing window are included, and its column mapping
   can be saved after the first upload.
6. Caleb buys the label in USPS, then saves the carrier, tracking number, and
   tracking link on the kit.
7. The next host selects **I received this kit**. A direct handoff closes the
   prior host's checkout automatically and starts the new checkout.
8. Caleb can always check a kit in, complete a handoff, correct a location, or
   override the recommendation.

## Carrier routing

- A shipment originating in the United States is eligible for Caleb's USPS
  Click-N-Ship export, including an international destination.
- A shipment originating outside the United States is excluded from the USPS
  export and appears as a carrier-decision task.
- For a direct handoff, the origin country and sender address come from the
  current holder's original private mailing record.
- For a kit at its home base, Click-N-Ship can use the default sender attached
  to Caleb's account.

The Canadian kit therefore remains useful for Canadian hosts without pretending
that a Canada-origin parcel belongs in a USPS workflow.

## Automation already in place

- Production-aware request scoring using recording, need-by, Episode Studio
  due, and release dates.
- In-country kit preference and direct-handoff planning.
- Recommended ship-by and due-back dates.
- Episode-host coverage warnings when an upcoming host has no active request.
- Alerts for unconfirmed inventory, missing ship dates, upcoming label work,
  missing package presets, non-US carrier routing, and overdue returns.
- A self-service receipt action for hosts.
- An admin-only USPS export with spreadsheet-formula protection, private
  no-store caching, and audit logging.
- Optimistic concurrency checks so two coordinators cannot silently overwrite
  one another.

## USPS direct API upgrade

The current CSV path is intentionally usable before an API onboarding project.
The shipping module is isolated from the host request and checkout workflow so
direct label creation can replace the export without changing the rest of the
product.

Production API work should begin only after the USPS developer app and Caleb's
business payment account are explicitly connected. The integration will need:

- USPS OAuth client credentials stored only as server-side Netlify secrets.
- USPS Customer Registration and payment-account authorization.
- Separate test and production modes; test labels must remain visibly
  non-mailable.
- A server-side payment authorization token lifecycle. Tokens must never be
  sent to the browser or written to application logs.
- One persisted idempotency key per label attempt before the purchase call.
  Retries must reuse that key and the identical payload to prevent duplicate
  postage charges.
- A preview step showing origin, destination, service, mail date, package
  measurements, and price before any charged action.
- Explicit international-label and customs handling rather than treating it as
  a domestic request.
- Private label-file storage with time-limited access, plus tracking and cost
  metadata on the handoff record.
- Cancellation/refund handling, rate limiting, bounded retries, and an
  administrator-visible failure state.

Suggested server-only configuration names are `USPS_CLIENT_ID`,
`USPS_CLIENT_SECRET`, and `USPS_API_ENVIRONMENT`. Payment-account identifiers
should be named after the exact fields returned during USPS onboarding rather
than guessed in advance.

## Reliability and privacy boundaries

- Street addresses, email addresses, sender details, tracking data, and future
  label files are visible only to the request owner and authorized
  coordinators as appropriate.
- Audit events record actor, action, kit ID, request ID, provider, and outcome;
  they must not contain street addresses, OAuth tokens, or payment tokens.
- Charged API operations require an idempotency key and a durable shipment
  status such as `label_pending`, `label_created`, `label_failed`, or
  `label_voided`.
- A background tracker can later poll USPS for delivery events and remind the
  next host to confirm receipt. It should back off on errors and surface a
  visible exception instead of repeatedly emailing the team.
- As volume grows, requests and shipment events should move from the current
  bounded tracker document into separate DynamoDB items. The present store
  enforces a 350 KB ceiling so growth fails safely before the DynamoDB item
  limit.

## Operational checks

- Confirm the real kit count and retire the possible fifth kit if it does not
  exist.
- Save a packed weight and dimensions on every confirmed case.
- Verify the home country for each kit.
- Save the Click-N-Ship column mapping on Caleb's first file upload.
- Keep the USPS API upgrade in test mode until label purchase, retry,
  cancellation, and PII-redaction checks all pass.

## USPS references

- [Click-N-Ship label creation guide](https://www.usps.com/c360/images/ClickNShip/Click-N-Ship%20-%20Label%20Creation.pdf)
- [Click-N-Ship overview and file-upload limits](https://faq.usps.com/articles/Knowledge/Click-N-Ship-The-Basics)
- [USPS Domestic Labels API v3](https://developers.usps.com/domesticlabelsv3)
- [USPS International Labels API v3](https://developers.usps.com/internationallabelsv3)
- [USPS Payments API v3](https://developers.usps.com/paymentsv3)
