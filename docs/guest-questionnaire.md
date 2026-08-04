# Episode guest questionnaire

The guest questionnaire is an episode-linked form with a public guest surface
and an authenticated Studio builder/review surface. Its configuration, guest
response, restricted shipping address, token revocation state, and upload-slot
state are stored separately from the general Episode Studio JSON.

## Storage and privacy boundary

Questionnaires use the existing `DYNAMODB_SITE_CONTENT_TABLE` under:

```text
guest_questionnaire#<episodeId>
```

The associated Episode Studio remains under `episode_studio#<episodeId>`.
Shipping address answers and private upload object keys must never be projected
or copied into the Episode Studio record. Assigned hosts receive a redacted
questionnaire response. The assigned producer and Studio managers receive the
restricted shipping fields needed to coordinate a microphone shipment.

Deleting an Episode Studio first locks it until outstanding signed upload authorizations
expire, sweeps every stored version under the exact episode prefix, and then
removes its guest-questionnaire record with the Episode Studio in one
transaction. Both current `updated_at` values are conditioned so a concurrent
response or Studio change cannot be silently discarded.

The temporary cleanup tombstone retains the episode storage identifier needed
for prefix sweeps. Older identifiers can contain title words. After 30 days, a
final successful sweep deletes that tombstone; storage failures keep it only
until cleanup can be confirmed and retried.

## Required environment

Set a unique, high-entropy secret of at least 32 characters:

```text
GUEST_QUESTIONNAIRE_TOKEN_SECRET=<random secret>
```

Do not reuse a Cognito, AWS, webhook, or application-cookie secret. Rotating
this value invalidates every outstanding guest link. The content-table and AWS
credential settings used by Episode Studio are also required.

## Share-link security

Studio users issue a signed, episode-scoped bearer token. The token contains a
random identifier and explicit issue/expiration times. Only a SHA-256 hash of
the random identifier is persisted. Verification requires all of the following:

- a valid HMAC signature;
- an unexpired token with a maximum 90-day lifetime;
- the same episode as the questionnaire record;
- an active stored link whose identifier hash and expiration match; and
- a current Episode Studio that is not accepted, archived, or pending deletion.

Issuing a new link replaces the stored identifier hash, invalidating the prior
link. Revocation clears the hash. Public APIs accept the token only in
`Authorization: Bearer <token>`; an episode ID by itself never grants access.
Bearer tokens and answers must not be logged.

New share URLs place the token in the fragment:

```text
/studio/guest-questionnaire#token=<private-token>
```

Fragments are not sent with the initial HTTP request. On the guest page, the
browser moves the token into tab-scoped `sessionStorage` and immediately removes
it from the visible URL with `history.replaceState`. This allows a refresh in
the same tab without leaving the bearer token in browser history or copied page
URLs. Query-string tokens are rejected because they reach hosting and request
logs before browser code can remove them. Revoke and reissue any link created
before fragment-only sharing was introduced.

## Authenticated Studio API

`GET /api/studio/episodes/:episodeId/guest-questionnaire`

Access is limited to an assigned host, assigned producer, or Studio manager.
The response includes:

- `questionnaire`: title, introduction, two scheduling blocks, editable
  questions, upload-slot configuration, and current version;
- `link`: safe status/timestamps only, never the token hash;
- `response`: submitted answers appropriate for the viewer's role and safe
  upload summaries;
- `can_edit`, `can_issue`, `can_apply`, `can_revoke`, and
  `can_view_shipping`; and
- an episode title/date/version summary.

`PATCH` uses one of these action bodies:

```json
{
  "action": "save_configuration",
  "expected_updated_at": "<questionnaire version>",
  "questionnaire": {
    "title": "Guest preparation form",
    "introduction": "...",
    "scheduling": {
      "pre_interview": {
        "url": "https://...",
        "prompt": "...",
        "required": true
      },
      "interview": {
        "url": "https://...",
        "prompt": "...",
        "required": true
      }
    },
    "questions": [],
    "upload_slots": []
  }
}
```

```json
{
  "action": "issue_link",
  "expected_updated_at": "<questionnaire version>",
  "expires_in_days": 21
}
```

The issue response includes the plaintext `share_token` and fragment-based
`share_path` once.
Creating any new token reopens a complete or waived `guest-prep-sent` task so a
new link is never mistaken for one already sent. After the host actually sends
the link, the editor records that separately:

```json
{
  "action": "mark_shared",
  "expected_updated_at": "<questionnaire version>"
}
```

```json
{
  "action": "revoke_link",
  "expected_updated_at": "<questionnaire version>"
}
```

```json
{
  "action": "apply_response",
  "expected_updated_at": "<questionnaire version>",
  "expected_episode_updated_at": "<episode version>"
}
```

Autofill projects safe guest identity/profile data and preparation notes into
the Episode Studio `guest-details` step. It also prepares the public-safe parts
of the show-notes brief, social profile/permission copy, photo credit, and the
producer's recording-readiness note. It fills a blank field or refreshes a
field still equal to the prior autofill snapshot. A newer manual value is
reported in `skipped_fields` and is not overwritten, and applying a response
never completes a production task by itself. The episode and autofill snapshot
are committed in one DynamoDB transaction. Guest email stays in the structured
guest contact profile; restricted shipping answers are never copied into
notes, publishing-package fields, production tasks, or the Episode Studio
record.

Accepted and archived Episode Studios expose read-only questionnaire history.
An assigned producer or Studio manager can still revoke an active link.
Question configuration also becomes read-only after the first submitted
response so later edits cannot change or discard the questions and answers that
formed the historical response. Review, safe autofill, and revocation remain
separate capability checks while the episode is still open.

## Public bearer API

Both public methods use `/api/guest-questionnaire` and require the bearer token.
Responses set `Cache-Control: no-store` and
`X-Robots-Tag: noindex, nofollow`.

`GET` returns public form configuration, episode date/title context, and a
submission summary. It intentionally does not echo prior answers or shipping
data. Safe upload progress is available under `submission.upload_slots`.

`POST` accepts:

```json
{
  "submission_id": "client-generated-stable-retry-id",
  "expected_revision": 0,
  "answers": {
    "guest_name": "Example Guest"
  },
  "scheduling_acknowledgements": {
    "pre_interview": true,
    "interview": true
  }
}
```

The server enforces a 64 KiB body limit, bounded question/answer sizes,
question visibility and conditions, current single-choice values, required
upload counts, profile URL/handle rules, per-token/IP rate limits, and optimistic
response revision checks. A repeated submission ID with the same normalized
payload is idempotent. Reusing it with different content returns `409`.

A successful new submission completes `guest-prep-received` when that task is
present and emits a generic Studio notification to the assigned host(s) and
producer. Notifications contain no answers, email, or shipping information.

## Question and upload models

Built-in question keys are stable. A Studio user can edit their prompt, help
text, required/visible flags, and order. Custom questions support
`short_text`, `long_text`, and `single_choice`. Built-in privacy and conditional
rules cannot be changed by the client.

`show_when` supports one `equals` value, multiple `values`, and nested `any` or
`all` branches evaluated identically in the browser and server. Close-call
details appear for “Yes” or “Maybe.” The microphone-kit question appears only
when the guest says their dedicated microphone or headphones are missing or
uncertain; shipping fields then appear only when a kit is requested. Internet
and quiet-room answers remain separate producer follow-ups because shipping a
kit cannot correct those conditions. The older generic equipment-description
box is retired from the public form and builder by the schema-two migration;
an answer already submitted under schema one remains visible in response
history.

Upload slots are forward-compatible records:

```json
{
  "key": "photo",
  "prompt": "Guest photos and photo credit",
  "required": true,
  "visible": true,
  "status": "enabled",
  "min_count": 5,
  "max_count": 6
}
```

The resume is optional by default (one file maximum). Photos require five files
by default, recommend five to six including a portrait, and allow configuration
up to ten. Public and ordinary Studio responses expose asset IDs and display
metadata only. Storage keys and object-version IDs remain private.
