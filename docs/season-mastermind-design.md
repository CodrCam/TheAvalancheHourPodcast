# Season Mastermind design

## Decision

Build Season Mastermind as an authenticated planning surface inside the existing
Studio. Aurora stores the shared, non-sensitive planning graph; it does not
replace Episode Studio, guest intake, logistics, DynamoDB, or S3.

The workbook remains useful as an export and migration source, but it should not
remain the authoritative backend. Its schedule, per-host tabs, guest ideas, and
intake responses have different privacy and workflow needs.

## Data boundary

Aurora may store only the fields allowlisted in
[`../infra/aws/aurora/README.md`](../infra/aws/aurora/README.md): seasons,
episode plans, host assignments, reviewed public guest metadata, topics, public
research sources, and sponsor/ad commitments.

The existing DynamoDB and S3 paths remain authoritative for:

- guest contact details and questionnaires;
- shipping addresses and microphone-kit logistics;
- private incident, accessibility, and scheduling answers;
- episode production tasks and deliverables;
- files, CVs, photos, audio, and other object-storage assets; and
- sponsor contracts, rates, invoices, and private contacts.

No browser request receives an Aurora credential, IAM token, raw workbook row,
or private intake object.

## UI shape

The authenticated `/studio` route is the operational home, not another task
workspace. It leads with the Season 11 picture: Episode Studios created versus
planned slots, host research drafts, producer review, active production,
delivery risk, questionnaire progress, next releases, and privacy-safe team
workload. Managers see team scope; active producers see only their authorized
assignments; hosts see their episode work. These aggregates reuse the existing
Episode Studio list response and do not add a second DynamoDB read. Live Aurora
planning totals remain an explicit click so opening Studio does not wake the
database.

The navigation has three sections at most: `Overview`, role-relevant `Work`,
and one `Planning & admin` disclosure. Host Studio, Guest Questionnaires, and
capability-gated Producer Tasks remain the primary workflow destinations.
Resources, Follow-ups, Profile, and Mic Kits live under `Team tools`; Season
Mastermind and management/operations routes live under `Planning & admin`.
No route or permission is removed—the access tree is grouped around the job a
person is trying to do.

Season Mastermind remains at `/studio/mastermind` inside the planning
disclosure.

The page has a season selector, a compact status summary, host/status/date
filters, and three views:

1. **Board** — columns for Idea, Researching, Ready, Scheduled, Recording, and
   Published. Cards show title, target air date, assigned hosts, guest status,
   research gaps, and sponsor commitments.
   A canonical plan moves atomically from Ready to Scheduled when its Episode
   Studio link is written. It then becomes a locked planning snapshot. Recording
   and Published remain available only for unlinked or legacy editorial records;
   current production state is read from Episode Studio, not synchronized back
   into Aurora.
2. **Calendar** — one season calendar generated from the same episode rows.
   Editorial format comes from the constrained `episode_type`: `regular`,
   `slabs_and_sluffs`, or `special`. Types do not become separate spreadsheet
   sections and remain independent from topics and workflow status.
3. **Research** — episode plans grouped by topic, public guest candidate, or
   research source. This is where a manager can find repeated ideas and reuse
   reviewed public sources.

Selecting a card opens an episode-plan drawer rather than navigating away. The
drawer contains:

- Overview: working title, premise, listener takeaway, status, and dates;
- People: multiple hosts and reviewed guest candidates;
- Research: topics, public sources, and short relevance notes;
- Sponsors: season- or episode-level commitments; and
- Handoff: the soft-linked Team Follow-up and Episode Studio, when present.

Managers can create additional seasons, correct a season's date window and
goal with optimistic revision checks, export one season as a privacy-allowlisted
CSV, and explicitly query the full authorized result set with bounded server
filters. Search runs only when submitted; selects run only when changed. No
filter, page, or calendar view creates background polling.

When Aurora has auto-paused, the first server connection can take substantially
longer than an ordinary request. Show a clear `Waking Season Mastermind…` state
and allow one explicit retry. Do not add keepalive traffic merely to hide this
Free Plan tradeoff.

Managers can edit and move cards. Hosts get a filtered read view of plans to
which their existing DynamoDB person ID is assigned. A host must never obtain a
full unfiltered season response and rely on the browser to hide other rows.

### Permission contract

- `mastermind:read` belongs to admins, Studio managers, and hosts. It makes the
  navigation item visible and permits read endpoints. Admins and Studio managers
  receive the authorized season scope; hosts receive only plans joined to their
  server-resolved DynamoDB person ID.
- `mastermind:manage` belongs to admins and Studio managers. It permits create,
  update, assignment, handoff, import-approval, and full-season export commands.
  A role granted `mastermind:manage` must also receive `mastermind:read`.
- Logistics and other groups receive neither permission by default. A host with
  no active Studio-to-person binding receives a profile-connection error, never
  an empty-but-unfiltered fallback.

The Studio navigation and page layout may use these permissions for usability,
but every same-origin API operation must enforce them again. The Next.js API
resolves the host binding and chooses the command scope before signing the
Lambda request; possession of the Lambda-invoker IAM identity is transport
authorization, not end-user authorization. This contract is implemented in the
current local build. The feature remains default-off, so the navigation item and
server routes do not become usable until the dedicated backend and caller
configuration are both present.

## Workflow integration

Two explicit actions connect the new planning layer to the current system:

1. `Start research plan` appears in a manager's Team Follow-up detail. It creates
   one idempotent Aurora plan with `source_intake_item_id`; it does not copy the
   Follow-up discussion or private fields.
2. `Create Episode Studio` appears when a plan is Ready. The existing Studio
   creation service receives safe title, date, season, and server-mapped host
   IDs. After DynamoDB creation succeeds, Aurora receives the resulting
   `linked_episode_id`. Neither side is deleted if that second soft-link write
   fails; a retry repairs a transient failure, while a permanent conflict still
   exposes the already-created Episode Studio for manual resolution.
   The Episode Studio also stores the exact source-plan revision. A retry refuses
   to link if the plan, producer, or production-facing snapshot changed between
   the DynamoDB create and Aurora link.

After that handoff, the host works in a shared research-and-review draft inside
Host Studio. Managers and the assigned producer can see its progress, but it is
excluded from producer work and overdue counts. Producer actions and reminders
remain locked until the host explicitly confirms the review and submits either
a complete package or a package with acknowledged gaps.

Any future workbook import must run through a local review preview that
normalizes names and dates, shows proposed matches, and requires approval before
writing each allowlisted planning record. There is no automatic row-for-row or
server-side upload of the workbook in the current build.

## Server boundary

Use a dedicated server-side API path and a dedicated AWS identity:

```text
Authenticated Studio browser
  -> same-origin Next.js API permission and relationship checks
  -> IAM-signed, IAM-only Season Mastermind Lambda URL
  -> bounded parameterized SQL over Aurora IAM authentication
  -> private response DTO
```

The Lambda should be separate from `avh-resilience-probe`. Its execution role
gets only the exact `rds-db:connect` permission and basic one-day logs. The
Netlify caller gets only the two IAM actions required to invoke that one
IAM-authenticated Function URL. Do not reuse the existing DynamoDB or S3 runtime
credentials.

Every operation has an allowlisted command, parameterized SQL, a two-second SQL
statement timeout, page size at most 50, one database connection per invocation,
and optimistic revision checks. The database endpoint stays in server-only
configuration and no API accepts arbitrary SQL, table names, sort columns, or
destination URLs.

## Local implementation status

Implemented locally and covered by automated tests:

- manager and assigned-host views with SQL-enforced relationship scoping;
- Board, desktop Calendar, phone Agenda, and Research projections;
- bounded server filtering, explicit pagination, and manager CSV export;
- create/edit seasons, create/edit core episode plans, and authoritative host
  assignment with optimistic revision recovery;
- Follow-up → Mastermind and Ready plan → Episode Studio handoffs, including
  deterministic IDs and partial-link recovery; and
- independent default-off flags for the website, Lambda backend, and writes.

The current rollout is a **core-plan pilot**, not yet a complete workbook
retirement. Guest candidates, topics, public research sources, and sponsor
commitments are normalized and displayed, but they remain read-only in the
website. The reviewed workbook migration/editor is deliberately not automatic:
the source workbook also contains private intake and logistics data. Keep the
workbook available until an allowlisted preview, deduplication review, and
explicit approval path for those four relationship types is implemented.

The feature remains behind a default-off environment flag until the read API,
permission tests, relationship tests, and cost bounds are deployed and verified.

## Server configuration and activation

The website requires all of the following server-only settings before its
session endpoint reports the feature as available:

- `SEASON_MASTERMIND_ENABLED=true`
- `SEASON_MASTERMIND_LAMBDA_URL`
- `SEASON_MASTERMIND_AWS_REGION` (defaults to `us-east-2`)
- `SEASON_MASTERMIND_ACCESS_KEY_ID`
- `SEASON_MASTERMIND_SECRET_ACCESS_KEY`
- optional `SEASON_MASTERMIND_SESSION_TOKEN`
- optional bounded `SEASON_MASTERMIND_TIMEOUT_MS`

No value belongs in a `NEXT_PUBLIC_` variable. Use a dedicated caller identity
that can invoke only the one IAM-authenticated Function URL; do not reuse the
site's DynamoDB or S3 credentials.

Activation is intentionally staged:

1. apply the reviewed schema and create the documented passwordless IAM DB role;
2. validate/build the isolated SAM template;
3. deploy with `BackendEnabled=false` and `WritesEnabled=false`;
4. enable the backend and verify manager/host reads and auto-pause behavior;
5. enable writes and smoke-test one disposable season/plan; and
6. configure the website flag and dedicated caller only after those checks pass.

No deployment or live environment change is performed by the local build.

## Cost guardrails

Keep the current Aurora Free Plan express configuration at minimum `0` ACU,
maximum `1` ACU, and a 300-second auto-pause. Do not add readers, RDS Proxy,
Data API, NAT Gateway, provisioned capacity, extended monitoring, or paid
performance features. The application should query only on page load, explicit
filter changes, or saves—never on keystrokes or a background polling loop.
