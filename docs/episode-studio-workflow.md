# Episode Studio Workflow

Episode Studios are the bridge between the release calendar, host preparation,
guest intake, and producer handoff. Each episode has one workspace split into a
**Package** page, a **Production Board** page, and a **Guest Questionnaire**
page, with one or more assigned hosts, a release date, a due date, and a
producer.

## Where each role works

| Role | Starting point | What they see |
| --- | --- | --- |
| Administrators (`admin`) | Admin Studio → **Episode Calendar** and **My Episodes** | The full calendar plus the episodes where their connected profile is a host, producer, or creator. |
| Studio managers without Store Admin access | Host Studio → **Episode Calendar** | The same production calendar and episode-management tools, without store or system access. |
| Hosts | Host Studio → **My Episodes** | Only episodes connected to their profile as a host, producer, or creator. |

The Store Admin overview is intentionally an action screen. It contains orders
needing attention, inventory needing attention, and upcoming episode
production. Technical diagnostics live in the admin-only **System Health**
page.

## Package, Production Board, and Guest Questionnaire

The episode tabs separate preparing the package from managing its schedule:

- **Package** at `/studio/episodes/<episode-id>` contains the Communication
  Clipboard, sponsor reads, host checklist responses and uploads, the assembled
  final package, and producer handoff review.
- **Production Board** at `/studio/episodes/<episode-id>/production` contains
  the air-date workflow, deadline management, and private proof approval.
- **Guest Questionnaire** at
  `/studio/episodes/<episode-id>/questionnaire` lets an assigned host or
  producer tailor the episode-specific intake, review the guest response, and
  safely fill blank Studio fields from that response.

The compatible admin routes are `/admin/studios/<episode-id>`,
`/admin/studios/<episode-id>/production`, and
`/admin/studios/<episode-id>/questionnaire`. Switching tabs does not broaden
access: the same server-side episode assignment and role checks protect every
page. The workspace warns before navigation when local edits have not been
saved.

## Create an episode

1. Open the production calendar and choose **New Episode Studio**.
2. Enter the episode title, season, release date, host due date, and producer
   email.
3. Select the producer and one or more hosts. Every selected host can work in
   the same episode form.
4. Create the Episode Studio.
5. Open the episode's **Settings** drawer to verify its schedule and
   assignments. Then choose **Customize checklist** on the Package page before
   sending the assignment to hosts. The assigned producer or a Studio manager
   can add, remove, reorder, rename, and mark items required or optional. A
   host cannot change the episode's requirements unless that same person is
   also its producer.

The host-package due date defaults to ten days before release. New
episodes also receive a deadline-aware production timeline. A Studio manager
can change any workflow deadline or accountable owner for that episode without
changing its air date.

## Air-date production timeline

The production timeline is separate from the host deliverables. Deliverables
hold the actual words and files; timeline steps record who owes the next
handoff, when it is due, and who completed or waived it.

The Production page opens in **Board** view, grouping steps into host
preparation, producer review, publishing, and release coordination. Managers
can switch to **Schedule** to see and edit all workflow dates and accountable
owners on one screen. Only one view is shown at a time, so a task is not
duplicated in both a deadline console and a second workflow list.

The Board can be searched and filtered to all, open, assigned-to-me, overdue,
or completed work. Each phase shows its own completion progress. A card shows
the exact due date plus a live countdown such as **21 days to go**, **Due
today**, or **2 days overdue**; the interface does not use D-minus shorthand.
Opening a card exposes its working note, approved HTTPS evidence link, linked
Package requirements, dependencies, completion record, and available status
actions. A manager can also adjust that card's deadline or named owner without
leaving the Board. **Start work** records an in-progress state before the task
is completed.

Assigned producers and Studio managers can add a task from the Board or edit an
existing card's name, instructions, phase, owner, release requirement, and
prerequisites. New deadlines use an air-date timing picker (for example, 35,
28, 21, 17, 16, 15, or 14 days before air) instead of requiring a calendar date. The Board
calculates the date and countdown automatically. Task IDs, special workflow
behavior, progress notes, evidence, and completion history are not rewritten by
definition edits, and task deletion is intentionally not part of this control.

The default timeline is:

1. Host sends the guest prep form 35 days before air.
2. Host verifies that the completed guest prep form was returned 28 days
   before air.
3. After the completed form is received, every assigned host confirms the
   microphone plan 28 days before air by
   connecting an active mic-kit request, identifying tested equipment, or
   confirming that no separate kit is needed.
4. The producer reviews the guest's internet, microphone, headphones,
   recording space, and any requested guest microphone kit 28 days before air.
   The guest form asks four plain-language readiness checks. A missing or
   uncertain microphone/headphone answer reveals the kit decision path; the
   generic all-equipment text box is no longer part of the default form.
5. Host schedules and completes the interview, then uploads every raw local
   recording track 21 days before air. The completed guest form, confirmed
   microphone plan, and producer recording-setup review are prerequisites.
6. Host completes the intro path 21 days before air. The host either uploads a
   recorded intro or confirms that the script was sent and records the date of
   the producer recording session. That session must be scheduled no later
   than seventeen days before air; scheduling itself remains outside Episode Studio.
7. Host delivers the timestamped edit notes, show-notes and promotion brief,
   final photo selection, and credits 21 days before air.
8. The publishing owner completes the episode graphic, final show notes, and
   show assets 21 days before air so the producer and social media crew receive
   the near-complete package together.
9. After the written package and intro are ready, the assigned producer uploads
   the private producer proof 16 days before air.
10. The assigned host downloads, listens to, and approves the proof 15 days
   before air, or records the exact changes requested.
11. The accountable publishing owner schedules the approved episode on Spotify,
   and the promotion owner confirms social, email, and blog scheduling 14 days
   before air.
12. The host confirms the approved air-date assets were shared with the guest
    14 days before air.

Every required step has an explicit due date. Once that date has passed, the
unfinished step receives one inline overdue warning, automatically makes the
episode's effective delivery outlook **Off track**, and creates an urgent
workflow reminder. Completing the step—or a Studio manager deliberately
waiving it with an attributed record—clears that automatic cause. A manually
raised Off track flag remains until a teammate clears it.

When an air date changes, unfinished deadlines that still use their standard
offset move with it. A manager-entered date override and completed work keep
their recorded dates.

The first normalization under this schedule upgrades every seeded legacy
deadline to the current 35-, 28-, 21-, 17-, 16-, 15-, or 14-day rule and recalculates its due date,
including previously completed tasks and old date overrides. Completion status
and attribution remain intact. Each task then records the deadline-schedule
version, so any deliberate producer or Studio-manager timing change made after
that one-time upgrade remains exactly as entered.

## Flexible host checklist

Every new Episode Studio begins with a suggested backbone:

1. Episode pitch and listener takeaway.
2. Structured guest details: name, title or affiliation, email or phone,
   short biography, website, and individually labeled public profiles for
   Instagram, Facebook, LinkedIn, X/Twitter, YouTube, TikTok, or another
   platform. A host can explicitly confirm that the guest has no public
   profiles.
3. A microphone plan for every assigned host: connect an active mic-kit
   request, identify the host's tested microphone and headphones, or confirm
   that no separate kit is needed. Producers see only readiness and request
   status here; private shipping and tracking details remain in the Mic Kits
   tracker.
4. Required raw recording-track uploads.
5. First-cut and edit notes.
6. One combined show-notes and promotion brief with the episode summary,
   title ideas, takeaways, guest biography, verified links and handles,
   suggested excerpts or timestamps, and any no-tag, privacy, or
   do-not-publish instructions.
7. Required introduction audio when the host records it directly.
8. Required photo and artwork uploads, including captions, visual guidance,
   crop or editing needs, creator credits, permissions, and restrictions.
9. Credits and permissions for music and any other creative work.

These are starting points, not a hard-coded production order. The assigned
producer can add episode-specific interview notes, fact checks, ad obligations,
or other items and can choose a written response, file upload, or optional
working-source link. Every step can also hold supporting files. Links must use
HTTPS. Hosts can save drafts without completing the form.

Long-form writing fields preserve pasted plain text, including paragraph
breaks and bullet lists. They can be resized vertically or opened with
**Expand writing area** for longer notes, then collapsed without losing text.

The structured guest fields are additive. Earlier free-form guest details and
social-profile notes remain attached to the episode as legacy/additional notes,
but the current structured fields are the source of truth for new completion
checks. Episode Studio does not guess which platform an older free-form handle
belongs to or silently copy it into a labeled public profile.

## Connected guest questionnaire

Each Episode Studio has its own questionnaire rather than relying on a generic
external form. An assigned host, assigned producer, or Studio manager can edit
the introduction, visible questions, required fields, choice options, two
optional scheduling links, and resume/photo upload requirements before creating
an active guest link. Custom questions can be added and reordered inside clear
sections. The configuration stays locked while a link is active; revoke it
before revising and issuing a replacement. After submission, the exact
questionnaire the guest saw is locked as history.

Sharing creates an episode-scoped private link that expires and can be revoked.
The guest can replace their own files before submitting and send the completed
intake without signing into Team Studio. The response covers
biography, individually labeled website/social profiles, projects and research,
interview topics, close-call context, recording readiness, promotion consent,
and scheduling acknowledgements. Resume and photo files use protected Episode
Studio asset storage; guests never receive storage credentials. Documents are
treated as invited, trusted-source material, verified against their declared
format, and delivered only as forced downloads.

The private form's lifecycle is connected to the Production Board. Creating a
link does not claim it was sent; the host confirms **Mark link as shared** after
actually sending it, while a valid guest submission also closes that sent gate
and completes **Receive the completed guest prep form**. Any newly created or
replacement link reopens the sent gate until it is shared. The producer then
manually reviews recording readiness and any microphone-kit request before
completing **Review the guest recording setup**. The questionnaire page can
fill only blank fields
or values previously filled from that response, so a later host or producer
edit is never silently overwritten. Project and research links remain in
preparation notes instead of being mislabeled as social profiles.

Shipping address and phone answers are stored separately from the Episode
Studio projection and are visible only to the assigned producer and Studio
managers. Public links use no-store and no-index responses, tokens are signed
but never persisted, and accepted, archived, or deleted Studios cannot receive
new responses. A private staged Spotify link or internal publishing package is
never exposed to a guest. If the team chooses to share an approved proof, it
must use a separately controlled channel such as Google Drive.

The checklist has two deliberate modes. **View** is the default and shows the
host-facing response fields without the setup controls. The assigned producer
or a Studio manager can choose **Customize checklist** to open the compact
builder. Its global toolbar contains **Add requirement**, **Save checklist**,
and **Done**; adding an item places focus on the new requirement instead of
hiding the action inside an existing checklist card.

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
uploaded, and only while their episode work remains editable. The server first
detaches its metadata, retries exact-version storage deletion, and verifies an
ambiguous response with an exact-version `HEAD`. A confirmed storage rejection
restores the metadata without overwriting unrelated concurrent edits. If that
file completed a sponsor-read assignment, the assignment returns to incomplete
so the producer package cannot silently claim missing evidence.

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
Permanent deletion is protected and two-stage: the first confirmation
tombstones the Studio so no completion can attach, then waits the signed upload
form lifetime plus a safety buffer. The final confirmation sweeps every S3
version and delete marker under the exact episode prefix, deletes the private
questionnaire, and replaces the active Studio with a minimal cleanup tombstone.
That marker retains the episode storage identifier and cleanup timestamps, but
not the title, questionnaire, notes, file metadata, or assignments. The
included hourly Studio maintenance job keeps resweeping that prefix so a
transfer already underway at expiry cannot become a permanent orphan. Audit
records and external operational references remain subject to their own
retention policy.

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

The producer feedback remains pinned in the episode's Communication Clipboard.

## Private proof and guest-review security

The producer proof is uploaded on the Production Board. It uses the same
authorized, version-pinned Episode Studio storage as other production audio.
Assigned hosts can download it and record approval or requested changes;
guests cannot access Episode Studio. Approval is attached to that exact stored
proof version. Uploading a replacement automatically reopens host approval and
the dependent publishing, promotion, and guest-asset checks so an older master
cannot remain approved by accident.

Never send a guest the private proof download, a staged Spotify link, or the
internal publishing package. Those paths can expose unfinished audio, internal
notes, future release details, or access that was intended only for the team.
If a producer and host deliberately choose to offer a guest an advance listen,
make a separate Google Drive copy containing only the approved program, apply
the intended guest permission to that copy, and remove access when the review
window ends. Episode Studio records the production decision; it does not create
or manage the Google Drive share.

## Communication Clipboard

Every Package page has one Communication Clipboard for episode-specific
coordination. A pinned producer note keeps the host's current direction visible
above the dated team conversation, so notes and chat do not appear as unrelated
sections. Assigned hosts and producers can post questions, decisions, and
handoff context even while the host form is locked for producer review.

The conversation keeps the newest 100 updates per episode. It is intended for
production coordination, not secrets, passwords, or raw guest-sensitive data.
For site or access problems, the workspace help menu directs the team to seek
technical help in the WhatsApp group chat. Its separate direct-contact option
is labeled **Private text support**.

## Episode settings

Studio managers and admins open **Settings** from the Package header to review
the air date, host-package due date, producer, and host assignments. The drawer
keeps administrative setup off the working Package page while preserving the
same permissions and save behavior.

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
time are recorded; supporting context can be added to the Communication
Clipboard when it is available.

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
  update the pinned Communication Clipboard note, request changes, and accept
  the submitted package regardless of any additional account groups.
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
creator profile, checklist, producer state, and communication history without
changing a rigid SQL schema for every new field. The browser never writes that
DynamoDB record directly.

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
