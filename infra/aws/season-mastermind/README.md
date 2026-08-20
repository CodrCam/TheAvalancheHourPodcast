# Season Mastermind AWS backend

This directory is an isolated, additive server boundary for the schema in
[`../aurora/001_season_mastermind.sql`](../aurora/001_season_mastermind.sql).
Nothing here deploys itself or changes the website. The SAM template creates
only:

- one 128 MB, ARM64 Lambda function with a ten-second timeout;
- one `AWS_IAM`-authenticated, buffered Lambda Function URL;
- one execution role that can write only this function's logs and connect as
  one exact Aurora database user; and
- one Standard CloudWatch log group with one-day retention.

There is no API Gateway, public URL permission, schedule, VPC attachment, NAT
gateway, RDS Proxy, Data API, X-Ray tracing, secret, customer-managed KMS key,
or paid monitoring feature. The existing Aurora cluster, schema migration,
hardening stack, and application are not modified.

## Default-safe state

`BackendEnabled` and `WritesEnabled` both default to `false`.

- With the backend disabled, every request receives `503 backend_disabled` and
  no database connection is attempted.
- With the backend enabled but writes disabled, the scoped read command works
  and every mutation receives `503 writes_disabled` before a database
  connection is attempted.

The exact Aurora endpoint is deployment configuration. It is used unchanged
for DNS, TLS hostname verification, and IAM token generation. The handler
accepts only a bare DNS hostname (no scheme, path, query, or caller override),
requires TLS `verify-full`, uses the Lambda runtime's system CA trust, and
creates one connection per invocation. Supply the exact endpoint shown by
Aurora; its certificate must validate for that same name. The generated IAM
token is never logged or returned.

The template deliberately does not set reserved concurrency. The account's
regional concurrency quota may be only ten, and Lambda requires at least ten
unreserved executions, so reserving even one would make this stack fail. Cost
and invocation bounds instead come from the IAM-only URL, absence of every
other trigger or schedule, short timeout, 128 MB memory, and the default-off
backend and write switches.

## Proxy contract

The trusted same-origin application API sends a SigV4-signed `POST /` request:

```json
{
  "operation": "list_mastermind",
  "actor": {
    "person_id": "server-resolved-person-id",
    "can_manage": false
  },
  "input": {
    "season_id": "ccda7a31-9800-4bc0-af28-f0fd85e3ad9e",
    "episode_type": "regular",
    "query": "snow safety",
    "page": 1,
    "page_size": 20
  }
}
```

The caller must resolve `person_id` and `can_manage` after authenticating the
Studio user. They are transport assertions from the trusted proxy, not browser
claims. Possession of the Lambda-invoker IAM identity is not a substitute for
the application's `mastermind:read`, `mastermind:manage`, and host-relationship
checks. Never pass a browser-supplied actor object through unchanged.

Every object rejects unknown fields. Bodies are limited to 64 KiB, responses
to 1 MiB, pages to 50 plans, host assignments to 20 per plan, SQL statements
to two seconds, and locks to 500 ms. Request values are
always DB-API parameters; requests cannot supply SQL, table names, columns,
ordering, URLs, or connection configuration.

Allowlisted operations are:

- `list_mastermind` — managers receive a filtered plan page; hosts receive only
  plans joined to their server-resolved `episode_host.host_person_id`. The
  optional filters are `season_id`, `status`, `episode_type`, `query`,
  `host_person_id`, `include_archived`, `page`, and `page_size` (legacy bounded
  `from_date`/`to_date` filters are also accepted). Missing or JSON `null`
  optional filters mean no filter. A non-manager cannot change
  `host_person_id` away from the server-resolved actor. The response contains
  normalized seasons, plans, attached public directories, relationship rows,
  sponsor commitments, and page metadata. Each plan also nests its scoped
  `hosts`, `guests`, `topics`, `sources`, and `sponsor_commitments`, so the
  application does not need a client-side join. Host directory data is derived
  only from the host's scoped plan page.
- `create_season` — manager only. The server generates a UUID unless the trusted
  caller supplies one. Repeating the same ID/label and values is idempotent.
- `update_season` — manager only and requires the current `revision`.
- `create_plan` — manager only. The canonical external key is
  `episode_plan_id`; omitting it generates a UUID. Repeating the same plan ID or
  intake soft link with identical values and host IDs is idempotent, including
  a retry by a different manager; the original creator remains unchanged.
- `update_plan` — manager only, uses `WHERE ... revision = ?`, and increments
  the revision atomically. Optional `hosts` are authoritative server-resolved
  `{person_id, display_name}` pairs. Updating them marks removed assignments
  unavailable, preserves selected `confirmed`/`complete` assignments, and
  upserts new assignments without SQL `DELETE`. A non-null intake/owner soft
  link cannot silently be changed to another record. Scheduled, recording, and
  published plans require a target air date.
- `link_episode` — manager-only handoff. It fills a null
  `linked_episode_id`, accepts retries of the same link, and rejects replacing a
  different non-null link.
- `archive_plan` — manager-only semantic delete with an optimistic revision.
  The runtime role has no SQL `DELETE` permission.

Success responses are flat: `{ "ok": true, "operation": "...", ...result }`.
Safe validation, authorization, revision, and availability errors are also
flat: `{ "ok": false, "code": "...", "error": "...", "status": 422 }`.
Raw SQL, driver errors, tokens, and configuration values are never returned.

## Database prerequisite

The schema migration intentionally creates no runtime role. Before enabling the
backend, a database administrator must create the template's `DatabaseUser`
without a password and grant only the operations implemented here. For the
default database and user, review and run the following through a fresh IAM
admin connection:

```sql
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_catalog.pg_roles
    WHERE rolname = 'season_mastermind_app'
  ) THEN
    CREATE ROLE season_mastermind_app LOGIN;
  END IF;
END;
$$;

GRANT rds_iam TO season_mastermind_app;
GRANT CONNECT ON DATABASE postgres TO season_mastermind_app;
GRANT USAGE ON SCHEMA season_mastermind TO season_mastermind_app;

GRANT SELECT ON
  season_mastermind.planning_season,
  season_mastermind.episode_plan,
  season_mastermind.episode_host,
  season_mastermind.guest_candidate,
  season_mastermind.topic,
  season_mastermind.research_source,
  season_mastermind.episode_guest,
  season_mastermind.episode_topic,
  season_mastermind.episode_source,
  season_mastermind.sponsor_commitment
TO season_mastermind_app;

GRANT INSERT, UPDATE ON
  season_mastermind.planning_season,
  season_mastermind.episode_plan,
  season_mastermind.episode_host
TO season_mastermind_app;

GRANT EXECUTE ON FUNCTION season_mastermind.touch_updated_at()
TO season_mastermind_app;
```

Do not grant schema ownership, `CREATE`, `DELETE`, `TRUNCATE`, credentials-table
access, DynamoDB/S3 permissions, or the Aurora admin role. If the database or
role parameter changes, adapt and re-review these grants before deployment.

Use the immutable cluster resource ID—not the friendly cluster identifier—for
`AuroraDbClusterResourceId`. That produces the one allowed runtime ARN:

```text
arn:PARTITION:rds-db:REGION:ACCOUNT:dbuser:cluster-RESOURCEID/season_mastermind_app
```

Generating a database auth token is local SigV4 signing and requires no broad
`rds:*` API permission. The connection itself is authorized by that exact
`rds-db:connect` statement.

## Trusted caller policy

The stack intentionally does not create or modify the Netlify/server caller.
Give its dedicated AWS principal both current Function URL actions, scoped to
the function ARN output:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunctionUrl",
      "Resource": "SEASON_MASTERMIND_FUNCTION_ARN",
      "Condition": {
        "StringEquals": { "lambda:FunctionUrlAuthType": "AWS_IAM" }
      }
    },
    {
      "Effect": "Allow",
      "Action": "lambda:InvokeFunction",
      "Resource": "SEASON_MASTERMIND_FUNCTION_ARN",
      "Condition": {
        "Bool": { "lambda:InvokedViaFunctionUrl": "true" }
      }
    }
  ]
}
```

Do not reuse website DynamoDB/S3 credentials and do not add an unauthenticated
`AWS::Lambda::Permission` resource.

## Local validation

The unit suite uses only the Python standard library and never opens a network
or database connection:

```bash
cd infra/aws/season-mastermind
python3 -m unittest discover -s tests -v
python3 -m py_compile season_mastermind_api/app.py
```

For an eventual, separately approved deployment, SAM installs the pure-Python
driver pinned in `season_mastermind_api/requirements.txt`:

```bash
sam validate --lint --template-file template.yaml
sam build --template-file template.yaml --use-container
```

Building or deploying is not required for the local unit tests. No deployment
command, stack name, live parameter, password, IAM token, or AWS credential is
stored here.
