# Host Studio Setup Guide

This is the operating checklist for launching the private Host Studio and
adding hosts safely. It assumes the four Cognito groups and the existing
DynamoDB tables are already configured.

## What each group can do

| Group | Host Studio access |
| --- | --- |
| `admin` | Everything in the Host Studio plus the existing website and Store Admin. |
| `studio_manager` | Manage the episode calendar and handoffs, publish resources and announcements, connect host accounts, and use a connected personal profile. |
| `host` | Read published resources, complete assigned episode forms, update only the public profile connected to the signed-in account, and request or view mic kits. |
| `logistics` | Existing store and merchandise-fulfillment tools plus read/request access to the shared mic-kit catalog. |

Group permissions are additive. Sierra can stay in both `logistics` and
`studio_manager`; Cameron and Caleb can stay in `admin`.

Public website roles and internal Episode Studio assignments are separate.
For example, Cameron remains publicly listed as the Webmaster but has internal
`host` and `producer` Studio capabilities. Those capabilities make a person
available in episode assignment pickers; Cognito groups still decide which
screens and APIs the signed-in account can use.

The Season 11 production roster uses **Angie Link** as the Producer
responsible for editing interviews, shaping the narrative, and building the
final audio file. Her People record carries both the internal `host` and
`producer` capabilities. Her Cognito user should belong to both `host` and
`studio_manager` so she can work in either capacity.

## Launch the resource guide

1. Deploy the Host Studio code.
2. Sign in as Cameron or Caleb, open **Host Resources** from Admin Studio, and
   switch from **View** to **Edit**.
3. Review the built-in Season 11 draft against the current production process.
4. Replace the inactive Season 10 source links with current host-safe links.
5. Keep passwords, raw Riverside credentials, and unfinished internal tasks out
   of published section content. The private **Manager notes** field is
   available for production reminders.
6. Reorder sections with the outline or the move controls.
7. Use blank lines for paragraphs, a dash for bullets, `1.` for numbered
   steps, and `##` for subheadings. The live preview shows the host result.
8. Turn off **Publish this section to hosts** for anything that is not ready.
9. Choose **Save draft** whenever work should persist without changing the
   host view.
10. Use **Preview as host** to review the complete draft library, including
    search, categories, announcements, links, and section visibility.
11. Choose **Publish** only when the draft is ready. Publishing updates the
    live guide and keeps the draft synchronized in the existing site-content
    record.

The host-facing guide at `/studio/resources` includes only published sections
and active links. It never includes manager notes or inactive links.

## Launch the mic-kit board

1. Hosts and every other signed-in role open **Mic Kits** in Host Studio to see
   current availability and submit a request.
2. Caleb and Cameron open **Mic Kit Checkout** in Admin Studio to manage the
   circulation desk.
3. The starter board shows four reported kits and one possible newer kit. The
   Season 11 guide describes the handoff process but does not state a physical
   inventory count.
4. Find each physical case and update its label, home country, current holder,
   current city or region, and status.
5. If the possible fifth kit does not exist, set it to **Not in circulation**.
   If another kit exists, add it with its case label.
6. Choose **Confirm final count** only after the physical inventory matches the
   board.
7. Ask hosts to choose **I need a mic kit** rather than emailing the team. The
   shared queue shows their general location and need-by date; their street
   address is visible only to them and admins.
8. Caleb or Cameron approves, waitlists, or declines the request with a direct
   response the host can read in Studio.
9. Assign the closest practical kit, enter its ship-by date, carrier, tracking
   details, and due-back date, then choose **Check out** when custody transfers.
10. Choose **Check in** when the kit returns or is ready for the next host. The
    kit immediately becomes available in the shared catalog.

All four Cognito roles can read the board and create requests regardless of
current availability. Only `admin` can respond, change inventory, assign
shipments, or check kits out and in.

## Launch the episode workflow

1. Open **Episode Calendar** from either the Admin Studio sidebar or the Host
   Studio manager sidebar.
2. Create an episode with a title, release date, producer email, and at least
   one assigned host.
3. Assign every co-host who should be able to edit and submit the episode.
4. Review the standard deliverables and mark any episode-specific items
   optional before hosts begin work.
5. Ask the team to use **My Episodes**. It includes episodes where the connected
   profile is an assigned host, the selected producer, or the episode creator.
6. Use the episode discussion for questions, decisions, and production context
   that should remain beside the checklist.
7. Ask hosts to label every asset with the shared episode filename convention
   and enter producer directions that name exact files, timestamp ranges,
   requested actions, and image-use details. A host can save an incomplete
   draft at any time, but producer directions are required for submission.
8. If production should begin before everything is ready, the host can submit
   with known gaps only after completing the producer directions, acknowledging
   every missing deliverable, and entering a resolution plan and expected date.
9. Submission emails the producer assigned to the episode. The producer can
   accept the handoff or return it with specific feedback.
10. Use **Delivery outlook** for a quick schedule-risk signal. Assigned hosts,
    the assigned producer, Studio managers, and admins can switch between
    **On track** and **Off track** without writing a note. This signal is
    independent of checklist completion, records who changed it, remains
    available during producer review, and locks when the episode is accepted.

The full working procedure and status definitions are in
`docs/episode-studio-workflow.md`.

## Connect Studio accounts

### Connect your own manager account once

An admin or Studio manager can securely connect their own signed-in account
without copying a Cognito ID:

1. Sign in with the named Cognito account that will use the Studio.
2. Open **My Episodes** or **My Profile**. If the account is not connected,
   follow **Connect my account** to **Host Access**.
3. Select only your own team profile and choose **Connect my account**.
4. Confirm the profile name, then verify **My Episodes** and **My Profile**.

The server takes the permanent Cognito `sub` and account email from the
verified login; the browser does not submit either value for this action. The
connection is one-time, one account can map to only one profile, and an already
connected profile cannot be claimed by another account. Disconnect the
incorrect binding before reconnecting.

### Connect a host as a manager

Repeat this sequence for each person. The current roster includes **Dom Baker**
with that spelling.

1. Confirm the person's public profile already exists in the website People
   manager and has the `host` role.
2. In Cognito, create or open that person's named user.
3. Add the user to the `host` group. A producer who also edits resources can
   belong to both `host` and `studio_manager`.
4. Open the Cognito user's details and copy the full **sub** attribute. Do not
   copy the username, email, or user-pool ID.
5. In the website, open `/studio/manage/access`.
6. Find the matching public host profile.
7. Enter the account email as a human-readable reference and paste the Cognito
   `sub`.
8. Choose **Connect**.
9. Ask the host to sign in once and verify:
   - the callback sends them to `/studio`;
   - **Resources** opens;
   - **My Episodes** contains only episodes connected to them as a host,
     producer, or creator;
   - **My Profile** shows their own name and photos;
   - they cannot open `/admin`, another host's episode or profile, or producer
     tools.

The security boundary is server-side. Host profile updates never accept a
target profile ID from the browser; the API looks up the signed-in Cognito
`sub`, finds its one active binding, and updates only biography and photo
fields on that profile.

## Change or remove access

- If an account was connected to the wrong profile, use **Disconnect** in Host
  Access and then connect the correct profile.
- If a person leaves the team, remove them from the Cognito groups and
  disconnect the public profile.
- Never reuse one Cognito login for multiple people.
- Never connect one Cognito `sub` to more than one profile. The server rejects
  duplicate connections.

## Storage and environment

The Host Studio adds no new AWS table and no new secret:

- Resources and bindings reuse `DYNAMODB_SITE_CONTENT_TABLE`.
- Episode calendars, assignments, forms, and handoff state reuse
  `DYNAMODB_SITE_CONTENT_TABLE`.
- Public profile edits reuse `DYNAMODB_PEOPLE_TABLE`.
- Cognito group names use
  `COGNITO_STUDIO_MANAGER_GROUP=studio_manager` and
  `COGNITO_HOST_GROUP=host`.

Both group variables must exist locally and in every Netlify deploy context.

Episode handoff email uses the producer email saved on the episode. If an
episode does not have one, the server falls back to `STUDIO_PRODUCER_EMAILS`
(a comma-separated optional list) and then the existing `CONTACT_EMAIL`.
