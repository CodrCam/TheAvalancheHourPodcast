# Episode Studio Workflow

Episode Studios are the bridge between the release calendar, host preparation,
and producer handoff. Each episode has one shared form, one or more assigned
hosts, a release date, a due date, and a producer.

## Where each person works

| Person | Starting point | What they see |
| --- | --- | --- |
| Cameron and Caleb (`admin`) | Admin Studio → **Episode Calendar** and **My Episodes** | The full calendar plus the episodes where their connected profile is a host, producer, or creator. |
| Studio managers without Store Admin access | Host Studio → **Episode Calendar** | The same production calendar and episode-management tools, without store or system access. |
| Hosts | Host Studio → **My Episodes** | Only episodes connected to their profile as a host, producer, or creator. |

The Store Admin overview is intentionally an action screen. It contains orders
needing attention, inventory needing attention, and upcoming episode
production. Technical diagnostics live in the admin-only **System Health**
page.

## Create an episode

1. Open the production calendar and choose **New Episode Studio**.
2. Enter the episode title, season, release date, host due date, and producer
   email.
3. Select the producer and one or more hosts. Every selected host can work in
   the same episode form.
4. Create the Episode Studio.
5. Open the episode and tailor its checklist before sending the assignment to
   hosts. The assigned producer or a Studio manager can add, remove, reorder,
   rename, and mark items required or optional. A host cannot change the
   episode's requirements unless that same person is also its producer.

The default due date is seven days before release. It can be changed per
episode.

## Flexible host checklist

Every new Episode Studio begins with a suggested backbone:

1. Episode pitch and listener takeaway.
2. Guest details, including clearly labeled public social profiles or handles.
3. Episode source-file uploads.
4. Required raw recording-track uploads.
5. First-cut and edit notes.
6. Show notes and relevant links.
7. Required intro or sponsor-read audio uploads.
8. Social media copy.
9. Required photo and artwork uploads.
10. Credits and permissions.

These are starting points, not a hard-coded production order. The assigned
producer can add episode-specific interview notes, fact checks, ad obligations,
or other items and can choose a written response, file upload, or optional
working-source link. Every step can also hold supporting files. Links must use
HTTPS. Hosts can save drafts without completing the form.

## Sponsor and ad reads

Approved scripts live in the versioned Sponsor Read Library. A producer or
Studio manager assigns a current approved version to an episode; the episode
keeps a frozen snapshot so later library edits do not rewrite an existing
handoff.

Each assigned spot can require either a separate ad-audio upload or confirmation
that the read is present in the main voice file. Host readiness includes every
required spot and its selected uploaded evidence. The episode shows
pronunciation notes, instructions, assignment attribution, expiration, and
whether a newer library version exists.

## Final delivery package

Google Drive and Riverside can remain rough working spaces. When direct uploads
are active, assigned hosts and producers upload final voice audio, separate ad
spots, images, documents, transcripts, and other supported production material
inside the checklist step they satisfy. The mixed **Episode Source Files** step
accepts the complete safe production allowlist; recording, image, and document
steps remain specialized. Executables, scripts, SVG, macro-enabled Office
files, and general archives are not accepted. Each object records its step's
ID. Images are limited to 30 MB, documents to 75 MB, audio to 1.5 GB, and video
to 750 MB. The bottom of the workspace automatically rebuilds the complete
producer package in checklist order. Only verified metadata is stored in
DynamoDB. Assigned participants download through an authorized server route
that creates a short-lived, attachment-only S3 URL pinned to the exact object
version verified at upload completion. While a large file is moving, the
workspace presents a dedicated transfer card with bytes transferred,
percentage, smoothed transfer rate, estimated time remaining, file position in
a multi-file batch, and the selected file's share of its per-file capacity.
The card then changes to a securing state while S3's exact version is verified,
so 100% transferred is not confused with fully attached.

The browser and upload-authorization API both reject an exact duplicate in the
same episode step when its normalized filename, byte size, canonical MIME type,
and category match. A multi-file selection skips matching existing copies and
continues with new files. Existing matching rows are visibly marked for
cleanup. A genuinely revised file with identical metadata must replace the old
copy by deleting it first; this keeps that edge case explicit without hashing a
1.5 GB recording in browser memory.

A Studio manager or assigned producer can permanently delete an uploaded file
after a browser confirmation. An assigned host can delete only a file they
uploaded, and only while their episode work remains editable. The server
deletes the exact recorded S3 version and then removes its episode metadata. If
that file completed a sponsor-read assignment, the assignment returns to
incomplete so the producer package cannot silently claim missing evidence.

Older episodes are upgraded when read: the prior Drive, Riverside, intro-audio,
and image-folder link steps become upload-based steps. Existing external URLs
are retained as labeled historical references instead of being discarded.

Episode assets are temporary production storage, not the permanent archive.
Each upload records a 180-day retention deadline. The workspace shows that
deadline next to the file, stops issuing download links after it passes, and
the reminder generator warns episode participants during the final 30 days.
The S3 bucket lifecycle expires the active object at 180 days and permanently
removes its noncurrent version after the configured recovery buffer.

Episode-level archive and permanent deletion are intentionally separate from
file deletion. A true long-term archive cannot use the current `episodes/`
prefix unchanged because its lifecycle expires every object after 180 days.
Before adding an Archive control, choose either a separate archive prefix with
its own lifecycle or an object-tag lifecycle exception. Permanent episode
deletion also needs a documented cascade for episode data, notifications,
mic-kit references, sponsor assignments, every recorded S3 version, and the
append-only audit trail.

## Producer directions and file labeling

Every submission also needs a clear set of producer directions. The directions
must name the exact asset, identify the exact moment or visual, and explain the
intended result. They are required even when the host submits with known gaps.

Use this filename pattern:
`{episode-short-name}_{asset}_{person-or-description}_{version-or-status}.ext`.
For example:

- `mission-ridge_interview_jordan_raw.wav`
- `mission-ridge_edit-notes_v2.docx`
- `mission-ridge_photo-01_jordan-ridgeline.jpg`

Do not rely on filenames such as `IMG_4821.jpg`, `audio-final-final.wav`, or
`new-notes.docx`. Keep the short episode name consistent, number assets when
order matters, and clearly mark or remove superseded versions.

For every audio request, include the exact filename, a start and end timestamp
in `HH:MM:SS–HH:MM:SS` format, an action such as **keep**, **cut**,
**shorten**, **move**, **replace**, or **review**, and the intended result.
For example:

`mission-ridge_interview_jordan_raw.wav — 00:18:42–00:19:07 — CUT —
duplicate answer; join to the sentence beginning “Our morning starts…”`

For each image, identify the exact filename; whether to use, avoid, or hold it
as an alternate; its order and purpose; the intended crop; the caption and
credit; its permission status; and any use restriction. Avoid phrases such as
“the good photo,” “the latest cut,” “fix this section,” or “the guest image.”
If the producer could reasonably choose the wrong file or interpret the request
two ways, the direction is not specific enough.

## Submit to the producer

There are two valid handoffs:

- **Submit complete** appears when every required item has a value and the
  producer directions are complete.
- **Submit with known gaps** appears only when every missing required item is
  acknowledged and the producer directions are complete. Each acknowledged
  item must include a resolution plan and can include an expected completion
  date.

The second option is deliberate: it lets a producer begin audio work while
making every remaining obligation visible. It is not an untracked incomplete
submission.

On submission, the producer receives an email with the episode, hosts, release
date, handoff type, known gaps, and a direct link to the Episode Studio. A
notification error does not erase the saved handoff.

## Producer review

After submission, hosts cannot silently alter the handoff.

- **Accept handoff** marks it ready for the next production stage.
- **Request changes** requires written producer feedback and reopens the
  episode for its assigned hosts.

The producer feedback remains visible in the episode workspace.

## Episode discussion

Every Episode Studio includes a shared, dated discussion. Assigned hosts and
producers can post questions, decisions, and handoff context without separating
the conversation from the checklist it affects. Discussion messages remain
available even while the host form is locked for producer review.

The discussion keeps the newest 100 updates per episode. It is intended for
production coordination, not secrets, passwords, or raw guest-sensitive data.

## Statuses

| Status | Meaning |
| --- | --- |
| Planning | The episode exists but host work has not meaningfully started. |
| In progress | A host or producer has saved preparation work. |
| Submitted | Every required item was supplied and the producer was notified. |
| Submitted with gaps | Every missing required item has a recorded plan. |
| Changes requested | The producer returned the handoff with feedback. |
| Accepted | The producer accepted the submitted materials. |

## Delivery outlook

**On track** and **Off track** are a forward-looking delivery signal, separate
from the workflow status and checklist completion. An episode can be 0 of 11
early in its schedule and still be on track; the site does not infer the
outlook from the completion percentage.

An assigned host, the assigned producer, a Studio manager, or an admin can
change the outlook. Flagging an episode **Off track** requires no note, so the
team can make a delay risk visible immediately. The latest person's name and
time are recorded; supporting context can be added to the episode discussion
when it is available.

Hosts can still change the delivery outlook while the submitted handoff itself
is locked for producer review. Once the producer accepts the episode, the
outlook control is locked and the episode no longer appears in active
off-track counts.

## Permission boundary

Permissions are enforced by the server, not only hidden in the interface.

- Hosts cannot choose a profile or episode ID to gain access. Their Cognito
  `sub` resolves to one public profile, and only episodes connected to that
  profile as a host, producer, or creator are returned.
- Hosts can edit deliverable values and gap acknowledgements but cannot change
  assignments, dates, labels, field types, or required/optional settings.
- The assigned producer can configure the episode checklist and sponsor reads,
  leave notes, request changes, and accept the submitted package regardless of
  any additional account groups.
- Studio managers and admins can create, schedule, and assign episodes. Review
  controls come from being the assigned producer; an administrator has a
  separately attributed override that requires an audit reason.
- System Health remains restricted to the `admin` group.

## Storage and email

Episode Studios use the existing `DYNAMODB_SITE_CONTENT_TABLE`; no additional
AWS table is required. Records use `content_key` values beginning with
`episode_studio#`.

The `content_json` attribute is a JSON-shaped document inside DynamoDB, not a
local JSON file. It lets the secured APIs evolve the schedule, assignments,
creator profile, checklist, producer state, and discussion without changing a
rigid SQL schema for every new field. The browser never writes that DynamoDB
record directly.

Uploaded audio and full-resolution artwork never enter the episode JSON. The
bytes live in a private S3 bucket. The episode stores only verified attachment
metadata, object keys, and the verified S3 version. A signed S3 form fixes the
key, canonical MIME type, and exact authorized byte length before S3 accepts
the upload. Completion verifies the object, and downloads require current
server-side episode access and stay pinned to the verified version.

The producer email saved on the episode is the primary notification recipient.
If it is empty, the server falls back to optional
`STUDIO_PRODUCER_EMAILS` and then the existing `CONTACT_EMAIL`. Email delivery
uses the existing `EMAIL_USER` and `EMAIL_PASS` configuration.
