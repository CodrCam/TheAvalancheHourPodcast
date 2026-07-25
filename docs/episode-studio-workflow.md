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
5. Open the episode and adjust requirements before sending the assignment to
   hosts. A producer can mark a standard item optional but a host cannot change
   the requirement.

The default due date is seven days before release. It can be changed per
episode.

## Standard host checklist

Every new Episode Studio begins with these deliverables:

1. Episode pitch and listener takeaway.
2. Guest details.
3. Episode Google Drive folder.
4. Riverside or recording files.
5. First-cut and edit notes.
6. Show notes and relevant links.
7. Intro or sponsor-read audio.
8. Social media copy.
9. Photos and artwork.
10. Credits and permissions.

Links must use HTTPS. Hosts can save drafts without completing the form.

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
- Studio managers and admins can create, schedule, assign, review, and accept
  Episode Studios.
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

Do not place uploaded audio, video, or full-resolution artwork inside the
episode document. If direct Studio uploads are added later, keep the actual
bytes in private object storage and save only attachment metadata and
authorized links with the episode.

The producer email saved on the episode is the primary notification recipient.
If it is empty, the server falls back to optional
`STUDIO_PRODUCER_EMAILS` and then the existing `CONTACT_EMAIL`. Email delivery
uses the existing `EMAIL_USER` and `EMAIL_PASS` configuration.
