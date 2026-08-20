# Aurora Season Mastermind

This directory contains the additive PostgreSQL schema for a private,
non-sensitive Season Mastermind. It replaces siloed per-host planning sheets
with one normalized season plan: proposed episodes, host assignments, reviewed
public guest candidates, episode types, topics, public research sources, and
sponsor/ad commitments.

Applying `001_season_mastermind.sql` does not enable a website feature, import a
workbook, seed data, create credentials, or change the existing DynamoDB
records. The separate, explicitly reviewed `002_seed_season_11.sql` migration
adds only the privacy-allowlisted Season 11 schedule described below.

## Schema

[`001_season_mastermind.sql`](./001_season_mastermind.sql) creates the isolated
`season_mastermind` schema and ten small tables:

1. `planning_season`
2. `episode_plan`
3. `episode_host`
4. `guest_candidate`
5. `topic`
6. `research_source`
7. `episode_guest`
8. `episode_topic`
9. `episode_source`
10. `sponsor_commitment`

The three explicit episode joins keep guest, topic, and source queries simple
and preserve real foreign keys. `episode_host` is the many-to-many assignment
table used for each host's view. The future application can resolve
`host_person_id` against the existing DynamoDB people table and run a bounded
query such as:

```sql
SELECT
  s.label AS season,
  p.working_title,
  p.target_air_date,
  h.host_role,
  h.assignment_status
FROM season_mastermind.episode_host AS h
JOIN season_mastermind.episode_plan AS p
  ON p.episode_plan_id = h.episode_plan_id
JOIN season_mastermind.planning_season AS s
  ON s.season_id = p.season_id
WHERE h.host_person_id = $1
  AND p.status <> 'archived'
ORDER BY p.target_air_date NULLS LAST, p.working_title;
```

This produces a live per-host plan from shared rows instead of copying episode
details into separate sheets.

`episode_plan.episode_type` uses the compact allowlist `regular`,
`slabs_and_sluffs`, or `special`. It defaults to `regular`; type describes the
editorial format and is independent from planning workflow `status` and topics.

The migration is idempotent and needs no PostgreSQL extensions. UUIDs are
supplied by the future application, text and workflow values are bounded by
constraints, reverse lookups are indexed, and triggers maintain `updated_at` on
all ten tables. Updates to seasons and episode plans should also use optimistic
locking:

```sql
UPDATE season_mastermind.episode_plan
SET working_title = $1, revision = revision + 1
WHERE episode_plan_id = $2 AND revision = $3
RETURNING *;
```

An empty result means another editor changed the plan first.

## Reviewed Season 11 seed

[`002_seed_season_11.sql`](./002_seed_season_11.sql) is a transactional,
idempotent seed generated from the reviewed projection in
`lib/season11MastermindSeed.mjs`. It creates one Season 11 record, 38 episode
plans, 35 host assignments, 18 reviewed guest candidates and their 18 episode
links, and four sponsor commitments. The schedule has 29 regular episodes and
nine Slabs n Sluffs slots; 37 plans begin in `researching` and the one workbook
row marked recording-finished begins in `recording`.

The seed corrects Schedule rows 16–20 to January 2027 and preserves episode
numbers `11.10` and `11.20`. It adds no topics or research sources because the
reviewed schedule fixture contains none. It does not include the workbook index,
host production tabs, contact data, guest intake, questionnaires, logistics,
files, credentials, or private sponsor data.

Every inserted key is deterministic. A retry against an unchanged seed is a
no-op followed by a full verification; a conflicting row or later editorial
change aborts the transaction rather than overwriting live work. The seed also
aborts if the sum of connectable database sizes is at least 0.8 GiB.

## Soft links to existing AWS data

The following values are deliberately nullable soft references because Aurora
cannot enforce a foreign key into DynamoDB:

- `episode_plan.source_intake_item_id`
- `episode_plan.linked_episode_id`
- `episode_plan.owner_person_id`
- `episode_plan.created_by_person_id`
- `planning_season.created_by_person_id`
- `episode_host.host_person_id`
- `sponsor_commitment.sponsor_id`
- `sponsor_commitment.sponsor_read_id`

Writes that attach these IDs must be idempotent. A retry may fill the same null
link or confirm the same value, but must reject silently changing one non-null
link to a different record. Aurora and DynamoDB cannot share a transaction, so
a failed soft-link update must never roll back or delete the authoritative
DynamoDB episode, person, sponsor, or intake record.

## Data privacy allowlist

Only store:

- season labels, date windows, and high-level planning goals;
- working episode titles, editorial premises, listener takeaways, allowlisted
  episode types, target air dates, and planning workflow states;
- public host display names plus optional DynamoDB person IDs;
- reviewed guest display names, public affiliations, public HTTPS profiles,
  short public context, and invitation workflow status;
- normalized topic labels;
- public HTTPS source URLs, titles, publishers, dates, and short public
  summaries;
- sponsor display names, placement/status, public copy notes, and optional
  DynamoDB sponsor or sponsor-read IDs; and
- opaque cross-store IDs listed above.

Never store:

- email addresses, phone numbers, private messaging handles, or availability;
- home, shipping, or private recording-location addresses;
- private incident, close-call, accessibility, health, or intake answers;
- guest questionnaires, applications, CVs, resumes, file blobs, file URLs, or
  object-storage keys;
- sponsor contracts, rates, invoices, payment details, or private contacts;
- Cognito subjects, sessions, passwords, AWS keys, tokens, or secrets; or
- the raw Season Mastermind workbook or an automatic row-for-row workbook
  import.

Workbook information must be reviewed and manually mapped to the allowlisted
fields. Invitation status may say `invited` or `confirmed`; the address used,
message body, and private reply remain outside this database.

## Apply from AWS CloudShell with IAM authentication

Do not paste a password, access key, or IAM token into this repository. Use the
IAM database user and connection instructions shown for the
`avh-episode-research` cluster in the RDS console. The IAM principal also needs
the narrowly scoped `rds-db:connect` permission for that database user.

1. Open CloudShell in the cluster's AWS Region.
2. Upload `001_season_mastermind.sql` and, when the reviewed Season 11 data is
   approved, `002_seed_season_11.sql` into the current CloudShell directory; or
   clone this repository and change into `infra/aws/aurora`.
3. Confirm `psql` is available. In the current Amazon Linux CloudShell image,
   install it only if needed:

   ```bash
   psql --version
   sudo dnf install -y postgresql15
   ```

4. Resolve the cluster endpoint. Express configuration uses Aurora's managed
   internet access gateway and an AWS-rooted certificate, so use CloudShell's
   system trust store rather than the conventional RDS database CA bundle.
   Never widen a security group to `0.0.0.0/0` just to make this command work.

   ```bash
   export AVH_AURORA_REGION="us-east-2"
   export AVH_AURORA_CLUSTER_ID="avh-episode-research"
   export AVH_AURORA_DATABASE="postgres"
   export AVH_AURORA_USER="postgres"
   export AVH_AURORA_PORT="5432"
   export AVH_AURORA_CA="/etc/pki/tls/certs/ca-bundle.crt"

   test -r "$AVH_AURORA_CA"

   export AVH_AURORA_HOST="$(aws rds describe-db-clusters \
     --region "$AVH_AURORA_REGION" \
     --db-cluster-identifier "$AVH_AURORA_CLUSTER_ID" \
     --query 'DBClusters[0].Endpoint' \
     --output text)"
   ```

5. Generate a short-lived IAM token immediately before connecting, then apply
   the migration with TLS hostname verification and stop on the first SQL error:

   ```bash
   export PGHOST="$AVH_AURORA_HOST"
   export PGPORT="$AVH_AURORA_PORT"
   export PGDATABASE="$AVH_AURORA_DATABASE"
   export PGUSER="$AVH_AURORA_USER"
   export PGSSLMODE="verify-full"
   export PGSSLROOTCERT="$AVH_AURORA_CA"
   export PGPASSWORD="$(aws rds generate-db-auth-token \
     --region "$AVH_AURORA_REGION" \
     --hostname "$AVH_AURORA_HOST" \
     --port "$AVH_AURORA_PORT" \
     --username "$AVH_AURORA_USER")"

   psql --no-psqlrc --set ON_ERROR_STOP=1 \
     --file 001_season_mastermind.sql

   psql --no-psqlrc --set ON_ERROR_STOP=1 \
     --file 002_seed_season_11.sql

   unset PGPASSWORD
   ```

If the RDS console supplies a different generated connection command or trust
store path, use those values. Keep the exact same hostname for endpoint lookup,
token generation, and TLS verification. A conventional RDS global bundle is
not the trust source for the express configuration gateway.

The migration creates no application grants because no runtime role exists yet.
When an application is designed, grant its database role only `USAGE` on this
schema, the specific table operations it needs, and `EXECUTE` on
`season_mastermind.touch_updated_at()`; do not use the schema owner at runtime.

## Verify without adding data

Reconnect with a fresh IAM token if the prior token expired, then run:

```sql
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'season_mastermind'
ORDER BY table_name;

SELECT count(*) AS table_count
FROM information_schema.tables
WHERE table_schema = 'season_mastermind';

SELECT event_object_table, trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'season_mastermind'
ORDER BY event_object_table, trigger_name;

SELECT
  (SELECT count(*) FROM season_mastermind.planning_season) AS seasons,
  (SELECT count(*) FROM season_mastermind.episode_plan) AS episode_plans,
  (SELECT count(*) FROM season_mastermind.episode_host) AS host_assignments,
  (SELECT count(*) FROM season_mastermind.guest_candidate) AS guests,
  (SELECT count(*) FROM season_mastermind.episode_guest) AS guest_links,
  (SELECT count(*) FROM season_mastermind.episode_topic) AS topic_links,
  (SELECT count(*) FROM season_mastermind.episode_source) AS source_links,
  (SELECT count(*) FROM season_mastermind.sponsor_commitment) AS commitments;

SELECT
  sum(pg_database_size(datname)) AS total_connectable_database_bytes,
  pg_size_pretty(sum(pg_database_size(datname))) AS total_connectable_database_size
FROM pg_database
WHERE datallowconn;
```

The table count must be `10`, ten `touch_updated_at` triggers should appear, and
all row counts remain `0` after the schema-only migration. After the reviewed
Season 11 seed, the counts must be `1`, `38`, `35`, `18`, `18`, `0`, `0`, and
`4` in the order queried above. Investigate and stop if the total connectable
database size unexpectedly approaches the 0.8 GiB guardrail.

## Free Plan guardrails and cleanup

Keep the provisioned limits unchanged: minimum `0` ACU, maximum `1` ACU,
300-second auto-pause, and the 1 GiB Free Plan storage cap. Do not add readers,
RDS Proxy, I/O-Optimized storage, Global Database, paid Performance Insights
retention, Extended Support, or a NAT Gateway for this experiment.

Record the exact Free Plan expiration date from AWS Billing now and schedule
cleanup at least seven days earlier. Budgets and alarms warn; they do not stop
charges.

Before deletion, decide whether the schema is still empty:

- If it is empty, no export or final snapshot is needed.
- If explicitly approved planning data exists, export only the
  `season_mastermind` schema with `pg_dump` to an approved encrypted location.
  Review snapshot pricing before retaining any final or manual snapshot.

Use the RDS console to delete `avh-episode-research` and all of its writer/reader
instances. Decline the final snapshot for an empty experiment and choose to
remove automated backups. A retained snapshot or automated backup can continue
using billable storage after the cluster is gone.

Then verify all three conditions:

1. No DB cluster or DB instance remains for `avh-episode-research`.
2. No manual snapshot or retained automated backup remains unless its cost was
   explicitly approved.
3. Billing and Cost Explorer show no continuing Aurora, RDS Proxy, snapshot,
   Performance Insights, or networking usage after the reporting delay.
