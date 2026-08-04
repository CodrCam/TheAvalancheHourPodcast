# Guest questionnaire uploads

The private guest questionnaire accepts resumes, background documents, and
episode photos without routing files through a general text field or a public
publishing link. Uploads use the same short-lived, versioned S3 pipeline as
Episode Studio assets.

## Guest workflow

1. The guest opens the active, episode-scoped questionnaire link.
2. The browser requests a short-lived upload authorization from
   `POST /api/guest-questionnaire/uploads/presign`.
3. The browser sends the file directly to S3 with the returned one-write,
   size-bound signed `PUT` request.
4. The browser confirms the upload through
   `POST /api/guest-questionnaire/uploads/complete`.
5. The completion route verifies the exact object size, MIME type, and S3
   version, then reads that immutable version to validate PDF, document
   container, text, or image signature bytes before atomically attaching it to
   both the questionnaire and the Episode Studio. A mismatch is sealed and its
   data version is deleted.

The resume is attached to the `guest-details` Studio step. Photos are attached
to `photos` as candidates; an upload alone does not complete the Studio step.
The host or producer must choose exactly three, put them in publishing order,
record any crop/edit instructions, and confirm the set. Confirmation is bound
server-side to each selected asset's exact immutable S3 version. Removing or
replacing a selected asset reopens the photo step and the linked production
work until a new three-image set is confirmed.

Questionnaire responses retain only the safe asset summary needed to show
progress. Storage keys and object-version IDs remain inside the authenticated
Episode Studio record and are never returned in questionnaire status
responses. The short-lived URL and signed request headers are used by the
browser only for that direct upload.

Guests may remove or replace files before submitting the questionnaire through
`DELETE /api/guest-questionnaire/uploads/:assetId`. Deletion is bound to the
active episode questionnaire and a questionnaire-owned synthetic uploader
identity, removes the exact immutable S3 version, and updates the questionnaire
and Episode Studio together. Reissuing the private link keeps existing resume
and photo uploads manageable from the new active link; revoked or expired links
cannot act. Upload changes are locked as soon as the questionnaire is submitted.

## File policy

- Resume: PDF, DOCX, ODT, or plain text; 10 MB maximum; one file.
- Photos: JPG, PNG, WebP, AVIF, TIFF, HEIC, or HEIF; 30 MB maximum per file;
  ten-file hard limit.
- The questionnaire configuration controls whether each slot is visible,
  required, and how many files are requested. The default photo request is
  five to six files. The resume remains optional by default.
- Executables, scripts, archives, SVG, macro-enabled documents, and MIME/type
  mismatches are rejected.
- Studio image previews never embed a raw S3 URL. An authenticated same-origin
  route reads the exact stored version and decodes/re-encodes a bounded WebP
  thumbnail. Unsupported or failed decodes fall back to forced attachment
  download; raw files are never served inline.

## Security and privacy

- Every presign, completion, and delete call requires the bearer token from the
  currently active questionnaire link.
- Completion authorization is separately signed and binds the episode, upload
  slot, asset, synthetic guest uploader, and active-link hash.
- Expired, revoked, regenerated, cross-episode, archived, and deleted-episode
  links are rejected.
- Completion checks current questionnaire configuration again, so a hidden or
  disabled upload slot cannot be completed with an older authorization.
- File limits are checked before presign and again at completion. Public upload
  operations are rate-limited first by a trusted client address and then by the
  private link. Each link also has a durable ceiling of 20 upload grants and
  400 MiB of authorized data, so abandoned uploads cannot grow without bound.
- Guest upload URLs expire after 15 minutes, and their completion authorization
  expires after one hour. Authenticated Studio uploads keep their existing
  longer workflow window.
- The questionnaire record is stored under its own DynamoDB content key.
  Shipping answers and other private responses are never copied into Episode
  Studio JSON when a file is attached.
- Duplicate objects are deleted by exact S3 version when verification makes
  cleanup safe. Conditional DynamoDB writes retry against fresh versions to
  protect concurrent Episode Studio and questionnaire changes.
- Every signed-upload authorization conditionally records its latest expiry on
  the Episode Studio before the upload details are returned, so authorization and deletion
  cannot race each other. A whole-Studio delete then locks uploads, waits the
  recorded lifetime plus a safety buffer, and sweeps every object version and
  delete marker under the exact episode prefix.
- Finalization removes the questionnaire and replaces the active Studio with a
  minimal deletion tombstone. It retains the episode storage identifier and
  cleanup timestamps because S3 prefix cleanup requires them. Older storage
  identifiers can contain title words, so the tombstone has a 30-day purge
  deadline and is removed after a final successful prefix sweep; questionnaire
  answers, notes, file metadata, assignments, and the episode title are not
  retained. The included hourly Studio maintenance job resweeps that prefix on
  every run, so a large transfer that began before its authorization expired is
  removed after it eventually finishes instead of becoming an orphan. The
  bucket lifecycle remains a separate backstop.
- One-file deletion first writes a zero-byte, non-content seal as the current
  object version and then permanently deletes the recorded data version. The
  seal prevents the still-live conditional upload URL from recreating the
  deleted file and remains only until prefix or lifecycle cleanup.

## Required production configuration

The questionnaire upload flow uses these existing variables:

```text
DYNAMODB_SITE_CONTENT_TABLE
DYNAMODB_REGION
DYNAMODB_ACCESS_KEY_ID
DYNAMODB_SECRET_ACCESS_KEY
DYNAMODB_SESSION_TOKEN

GUEST_QUESTIONNAIRE_TOKEN_SECRET

EPISODE_ASSETS_S3_BUCKET
EPISODE_ASSETS_S3_REGION
EPISODE_ASSETS_ACCESS_KEY_ID
EPISODE_ASSETS_SECRET_ACCESS_KEY
EPISODE_ASSETS_SESSION_TOKEN
EPISODE_ASSETS_UPLOAD_TOKEN_SECRET
```

`GUEST_QUESTIONNAIRE_TOKEN_SECRET` and
`EPISODE_ASSETS_UPLOAD_TOKEN_SECRET` must be separate, high-entropy secrets.
S3 bucket versioning is mandatory because completion and deletion are bound to
an immutable object version. Bucket CORS must allow signed `PUT` uploads with
the `Content-Type` and `If-None-Match` headers from the production origin and
approved local-development origins; retain `POST` for product images.
The storage credentials must allow signed upload creation, `HeadObject`, exact
version deletion, and `ListBucketVersions` restricted to the `episodes/*`
prefix. Keep the existing lifecycle policy as a backstop for abandoned
presigned uploads.

Signature and container validation blocks renamed executables and ordinary
type spoofing, but it is not a malware engine. Guest documents are delivered as
forced downloads. The team currently accepts documents from invited guests as
trusted-source material; staff should still keep endpoint protection enabled
and delete anything unexpected without opening it. If that trust policy
changes, add an S3 event-driven quarantine scanner and enforce a clean verdict
before download. Do not describe the current signature check as a malware scan.
