# Unified, role-aware notifications

## What the implementation extends

The notification center extends the existing `studio_notification#` records in
`DYNAMODB_SITE_CONTENT_TABLE`, the Episode Studio and Mic Kit event publishers,
the scheduled reminder generator, the Cognito-to-person binding, and the
`notifications:read` / `notifications:update` permissions. It does not create a
second browser-authored notification path.

Every recipient comes from server-side episode assignments, production
escalation configuration, mic-kit request ownership, or an operational manager
list. Requests cannot supply notification recipients. Before a notification is
returned, the API batch-loads its related episodes and loads the shared mic-kit
tracker once, then reapplies current access. Reassigned, archived, deleted, and
unrelated records are suppressed.

## Backend event map and recipient matrix

“Never” describes a deliberate exclusion, not merely a UI choice.

| Event | Server-selected recipients | Never sent to | Related record | Title / summary pattern | Destination | Intent | Duplicate and grouping rule | State |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Episode created or participant added | Newly assigned hosts, producer, and creator except the actor | Unassigned hosts; removed participants | Episode | “You were assigned…” / review role, dates, checklist, reads, discussion | Episode Studio | Actionable | Episode version + recipient; group by episode | Connected |
| Assignment role changed | Current participant whose host/producer/creator relationship changed | Removed and unrelated people | Episode | “Your assignment changed…” | Episode Studio | Actionable | Episode version + recipient; group by episode | Connected |
| Due or release date changed | Current episode participants except actor | Unassigned users | Episode | “Schedule updated…” / current host-package date | Episode Studio | Actionable | Episode version + recipient; group by episode | Connected |
| Discussion post | Current participants except author | Anyone who cannot currently open the episode | Episode / message | Actor posted / plain-text preview | Episode discussion anchor | Informational | Message ID + recipient; group by episode | Connected |
| Checklist structure changed | Assigned hosts except actor | Unassigned hosts | Episode / checklist | “Checklist updated…” | Checklist anchor | Actionable | Episode version + recipient; group by episode | Connected |
| Required or production file uploaded | Episode participants except uploader | Unassigned users | Episode / asset | Actor uploaded a file / required-deliverable context | Final assets anchor | Informational | Immutable asset ID + recipient; group by episode | Connected |
| File removed | Episode participants except actor | Unassigned users | Episode / asset | “A file was removed…” / completion impact | Final assets anchor | Actionable when required | Asset ID + episode version + recipient; group by episode | Connected |
| Host submits or resubmits | Assigned producer except submitting actor | Other producers, administrators, and leads not assigned to this hop | Episode | Ready for producer review / package context | Episode Studio | Actionable, high | Episode version + producer; group by episode | Connected |
| Producer requests changes | Assigned hosts except producer | Other hosts | Episode | “Changes requested…” / plain-text producer note | Episode Studio | Actionable, high | Episode version + host; group by episode | Connected |
| Producer accepts | Hosts and creator; next production lead | Unrelated hosts; actor | Episode | Approved; next lead prompted to check the handoff | Producer-review anchor | Actionable for lead | Episode version + recipient; group by episode | Connected |
| Production lead advances | Next configured lead; on completion, participants and production leads | Actor | Episode | Advanced to you / production chain complete | Production handoff anchor | Actionable or informational | Episode version + recipient; group by episode | Connected |
| Episode flagged off track | Episode participants plus configured production leads, except actor | Unrelated users | Episode | “Episode was marked off track” | Episode discussion | Urgent | Transition into off-track + recipient; group by episode | Connected |
| Spotify staged listen attached | No standalone notification; carried by the producer-accept or lead-advance event | Anyone without episode access; URL is never in the notification preview | Episode | Notification says a staged listen is available | Secured Episode Studio; Spotify link appears there | Actionable | Same handoff event; group by episode | Connected |
| Sponsor read assigned, replaced, or removed | Episode participants except actor | Unassigned users | Episode / sponsor-read assignment | “Sponsor read updated…” | Sponsor-read anchor | Actionable | Episode version + recipient; group by episode | Connected |
| Sponsor evidence completed or reopened | Assigned producer on completion; assigned hosts on reopen | Unassigned users | Episode / sponsor-read assignment | Evidence ready / sponsor read reopened | Sponsor-read anchor | Actionable | Assignment + completion timestamp/version; group by episode | Connected |
| Deadline approaching | Assigned hosts | Unassigned users | Episode | Due today or in N days | Episode Studio | Actionable | Type + episode + due date + recipient | Connected |
| Episode overdue | Hosts, producer, and creator | Unassigned users | Episode | Host package overdue | Episode Studio | Urgent | Type + episode + due date + recipient | Connected |
| Asset retention approaching | Episode participants | Unassigned users | Episode / asset expiration group | N assets leave storage in N days | Final assets anchor | Actionable | Expiration date + recipient; group by episode | Connected |
| Mic-kit request submitted | Request owner; configured mic-kit managers | Other hosts and non-manager operations users | Mic-kit request | Submitted / host requested a kit | Owner or manager request anchor | Informational / administrative | Request creation + recipient; group by request | Connected |
| Mic-kit response, assignment, direct handoff, or tracking | Request owner | Other hosts; tracking data is never copied into previews | Mic-kit request | Status, assignment, handoff, or tracking available | Owner request anchor | Actionable | Request/kit transition + recipient; group by request | Connected |
| Receipt confirmation | Configured mic-kit managers except confirming actor | Other hosts | Mic-kit request | Host confirmed receipt | Manager request anchor | Administrative | Request update time + manager; group by request | Connected |
| Return checked in | Request owner except actor | Other hosts | Mic-kit request | Return checked in | Owner request anchor | Informational | Request update time + recipient; group by request | Connected |
| Ship-by, receipt, return, or overdue reminder | Request owner and managers only where operational action is required | Other hosts | Mic-kit request | Date-specific action | Role-appropriate request anchor | Actionable / urgent | Type + request + due date + recipient | Connected |
| Paid order, low stock, product changes | Existing order email and admin workspace remain authoritative | Hosts and Studio-only roles | Order / product | Only genuinely actionable fulfillment or stock exceptions should become in-app events | Admin order/product | Administrative | Order event or SKU threshold transition | Later connection |
| Person, role, or account binding change | Existing audit log remains authoritative | People unrelated to the changed account | User / binding | Access changed or requires attention | Access management | Administrative | Exact access mutation + affected user | Later connection |
| Operational system failure | Existing System Health page and server logs remain authoritative | Hosts and users without `audit:read` | System check | Only failures requiring intervention | System Health | Administrative / urgent | Failure fingerprint + state transition | Later connection |

Store, access, and system alerts are intentionally not inferred from ordinary
saves. They need a persisted mapping from operational permissions to connected
person profiles before in-app fan-out can be safe. Until that exists, existing
email, audit, and System Health behavior remains in place.

## Production escalation

`STUDIO_PRODUCTION_LEAD_PERSON_IDS` is an ordered list. The default is
`angie-link,caleb-merrill`.

1. Hosts submit to the episode’s assigned producer.
2. When any producer outside the lead list accepts, the handoff goes to Angie.
3. If Angie does not have an active connected producer account, the handoff
   skips directly to Caleb.
4. Angie advances it to Caleb.
5. When Angie is the assigned producer, acceptance goes directly to Caleb.
6. When Caleb is the assigned producer, acceptance completes the chain.
7. Off-track transitions notify the active configured leads.

Acceptance stops with a clear error if neither configured lead has an active
connected producer account; it never silently completes an unreviewed handoff.

The producer may attach an HTTPS Spotify staging URL from `spotify.com`,
a Spotify subdomain, or `spotify.link`. The URL is stored on the authorized
episode and never copied into notification previews.

## Record, query, and retention model

The source record remains:

- primary key: `content_key =
  studio_notification#<person_id>#<notification_id>`
- deterministic notification ID: SHA-256 of the server-authored idempotency key
- GSI partition: `notification_recipient = recipient#<person_id>`
- GSI sort: `notification_sort = <created_at>#<notification_id>`
- sparse unread marker: `notification_unread = 1`
- DynamoDB TTL: `expires_at_epoch`

Each JSON record includes group entity, read and seen timestamps, intent,
urgency, deep link, actor, related entity, retention date, source action,
recipient reason, and an idempotency-key hash. Creation and duplicate
suppression emit a structured `studio_notification_audit` entry.

The API uses descending GSI `Query`, opaque cursor pagination, and batch episode
reads. It does not scan the content table or fetch one related episode per
notification. Default retention is 120 days and can be set from 30–365 days
with `STUDIO_NOTIFICATION_RETENTION_DAYS`.

The bell refreshes on open, window focus, tab visibility, and every 60 seconds
while the page is visible. This avoids the operational cost of WebSockets.

## DynamoDB and deployment steps

Do not deploy notification-query code until the index is active.

1. Run `npm run migrate:studio-notifications` locally for a dry-run count.
2. Review the table and count, then run
   `npm run migrate:studio-notifications -- --apply` with migration credentials.
   This is the only broad scan; it is an explicit one-time backfill, never a
   request-path operation.
3. On `DYNAMODB_SITE_CONTENT_TABLE`, create GSI
   `studio-notifications-index` with String partition key
   `notification_recipient`, String sort key `notification_sort`, and `ALL`
   projection. Match the table’s on-demand or provisioned capacity mode.
4. Enable DynamoDB TTL on `expires_at_epoch`.
5. Add `dynamodb:Query`, `dynamodb:BatchGetItem`,
   `dynamodb:TransactWriteItems`, `dynamodb:PutItem`, and
   `dynamodb:UpdateItem` for the site-content table and notification GSI.
   Migration credentials also need `dynamodb:Scan`.
6. Add Netlify values:
   `DYNAMODB_STUDIO_NOTIFICATIONS_INDEX=studio-notifications-index`,
   `STUDIO_NOTIFICATION_RETENTION_DAYS=120`, and
   `STUDIO_PRODUCTION_LEAD_PERSON_IDS=angie-link,caleb-merrill`.
7. Confirm Angie and Caleb have active person bindings and Cognito groups with
   `episodes:manage`, `notifications:read`, and `notifications:update`.
8. Keep the existing reminder schedule and
   `STUDIO_REMINDER_RUN_SECRET`; deterministic keys make retries safe.

No new S3 permissions, WebSocket service, notification table, or production
data mutation is required by the code change itself.
