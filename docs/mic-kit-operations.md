# Mic Kit Operations

## Purpose

The Mic Kit board is the shared circulation desk for every Studio role. Hosts,
producers, logistics users, Studio managers, and administrators can see
availability and submit requests. Only administrators can view private mailing
addresses outside their own or coordinated episode requests, assign kits,
export shipping data, or change inventory records. Request owners and current
episode coordinators can view the private delivery details needed for their
specific handoff.

The operating goal is to keep routine coordination on the board instead of in
an email chain while still allowing the mic-kit coordinator to make the final
logistics decision.

## Current workflow

1. A host or authorized producer creates the appropriate host or guest request
   early, with a need-by date, the connected Episode Studio, general location,
   and private mailing address.
2. The admin board combines the request queue with upcoming episodes and ranks
   requests by production timing.
3. The recommendation engine ranks the best fit but does not hide the other
   eligible kits. The request-level picker shows every valid choice and explains
   why held, reserved, in-transit, maintenance, or late-returning kits cannot be
   selected.
4. The mic-kit coordinator chooses a specific eligible kit. The server checks
   availability again before reserving it, then fills the ship-by date and
   records the planned due-back date so two coordinators cannot claim the same
   case.
5. For a US home-base shipment, the coordinator downloads the protected Pirate
   Ship spreadsheet. It includes only the destination, ship date, saved package
   measurements, and internal order reference needed for postage.
6. The coordinator uploads the spreadsheet to Pirate Ship, confirms the field
   mapping, package, origin, destination, service, price, and any international
   customs details before buying a label. A direct handoff is created
   individually so the current holder's saved Ship From address is confirmed.
   The carrier, tracking number, and tracking link are then saved on the kit.
7. The next host selects **I received this kit**. A direct handoff closes the
   prior host's checkout automatically and starts the new checkout.
8. A mic-kit coordinator can always check a kit in, complete a handoff, correct a location, or
   override the recommendation.

## Carrier routing

- A shipment originating at the approved United States home base is eligible
  for the coordinator's Pirate Ship spreadsheet, including an international
  destination. International shipments still require an explicit customs
  review in Pirate Ship.
- Pirate Ship only supports postage originating from United States addresses. A
  shipment originating outside the United States is excluded from the export
  and remains a manual carrier-decision task.
- For a direct handoff, the origin country and sender address come from the
  current holder's original private mailing record. The coordinator creates
  that label individually in Pirate Ship and confirms the matching saved Ship
  From address; sender addresses are not placed in the bulk spreadsheet.
- For a kit at its home base, the coordinator confirms the approved origin
  address in Pirate Ship before buying the label.

The Canadian kit therefore remains useful for Canadian hosts without pretending
that a Canada-origin parcel belongs in a Pirate Ship workflow.

## Automation already in place

- Production-aware request scoring using recording, need-by, Episode Studio
  due, and release dates.
- A request-level eligible-kit picker with a best-fit recommendation,
  availability explanations, and direct-handoff planning.
- Recommended ship-by and due-back dates.
- Episode-host coverage warnings when an upcoming host has no active request.
- Alerts for unconfirmed inventory, missing ship dates, upcoming label work,
  missing package presets, non-US carrier routing, and overdue returns.
- A self-service receipt action for hosts.
- An admin-only Pirate Ship spreadsheet for US home-base shipments, with
  spreadsheet-formula protection, private no-store caching, and audit logging.
- Optimistic concurrency checks so two coordinators cannot silently overwrite
  one another.

## Pirate Ship integration boundary

Pirate Ship does not currently offer a public API. The supported integration is
therefore a spreadsheet handoff: the Studio prepares the shipment data, and an
authorized coordinator uploads it to Pirate Ship, reviews the mapped values,
and buys the label there. The application must not attempt browser automation or
store Pirate Ship passwords, session cookies, browser tokens, or an invented
`PIRATE_SHIP_API_KEY`. Account access belongs in the approved team password
manager, never in episode notes or application configuration.

Only reevaluate direct label creation if Pirate Ship officially launches a
documented API. Before enabling charged production operations, that future
integration would still require:

- Official authentication and payment scopes stored only as server-side
  secrets, using the exact credential names Pirate Ship documents.
- Separate test and production modes; test labels must remain visibly
  non-mailable.
- One persisted idempotency key per label attempt before any purchase call.
  Retries must reuse that key and the identical payload to prevent duplicate
  postage charges.
- A preview step showing origin, destination, service, mail date, package
  measurements, and price before any charged action.
- Explicit international-label and customs handling rather than treating it as
  a domestic request.
- Private label-file storage with time-limited access, plus tracking and cost
  metadata on the handoff record.
- Cancellation and refund handling, rate limiting, bounded retries, and an
  administrator-visible failure state.

## Reliability and privacy boundaries

- Street addresses, email addresses, sender details, tracking data, and future
  label files are visible only to the request owner and authorized
  coordinators as appropriate.
- Audit events record actor, action, kit ID, request ID, provider, and outcome;
  they must not contain street addresses, OAuth tokens, or payment tokens.
- Any future charged API operation requires an idempotency key and a durable
  shipment status such as `label_pending`, `label_created`, `label_failed`, or
  `label_voided`.
- Delivery tracking may be automated later only through an approved, documented
  carrier integration. It must back off on errors and surface a visible
  exception instead of repeatedly emailing the team.
- As volume grows, requests and shipment events should move from the current
  bounded tracker document into separate DynamoDB items. The present store
  enforces a 350 KB ceiling so growth fails safely before the DynamoDB item
  limit.

## Operational checks

- Confirm the real kit count and retire the possible fifth kit if it does not
  exist.
- Save a packed weight and dimensions on every confirmed case.
- Verify the home country for each kit.
- Save and verify the Pirate Ship field mapping on the coordinator's first
  spreadsheet upload; test it with non-sensitive fixture data first.
- Keep US-origin and non-US-origin carrier paths visibly distinct.
- Reevaluate API work only if Pirate Ship publishes an official API, and keep
  any future integration in test mode until label purchase, retry,
  cancellation, and PII-redaction checks all pass.

## Pirate Ship references

- [API availability](https://support.pirateship.com/en/articles/2309246-does-pirate-ship-have-an-api)
- [Spreadsheet uploads and field mapping](https://support.pirateship.com/en/articles/1068428-how-do-i-upload-address-spreadsheets-into-pirate-ship)
- [Origin-country availability](https://support.pirateship.com/en/articles/2775382-can-i-use-pirate-ship-in-canada-or-countries-outside-the-u-s)
