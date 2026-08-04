# Studio Notifications and Reminders

Notifications are stored as separate items in the existing Site Content
DynamoDB table. Their keys begin with `studio_notification#<person>#`. This
keeps activity out of the large Episode Studio and Mic Kit JSON documents while
avoiding a new table during this phase.

Each item belongs to one connected Studio profile and contains a plain-text
title and preview, event or reminder kind, category, urgency, deep link, due
date when applicable, generated time, read time, and channel-delivery state.
The channel state leaves room for later email delivery without rewriting core
events.

The server resolves recipients from verified episode assignments and mic-kit
request ownership. The browser cannot choose a notification recipient.
Notification links do not contain addresses, tracking numbers, access tokens,
or S3 URLs.

## Event notifications

Episode Communication Clipboard posts, assignments, sponsor-read changes,
submissions, resubmissions, change requests, approvals, and off-track changes
create immediate events. Mic Kit request responses, assignments, tracking
updates, and direct handoffs also create immediate events.

## Scheduled reminders

`runStudioReminderGeneration()` loads current Episode Studios and the Mic Kit
tracker, generates due-date candidates, and creates deterministic notification
IDs. Re-running the same due-date reminder produces a conditional-write
duplicate instead of another notification.

Episodes with the air-date production timeline use each required step's own
deadline instead of the legacy single host-package date. The accountable owner
and configured administrative observers receive a reminder during the final
three days. Once a required step is overdue, the task owner and current episode
participants receive an urgent reminder explaining that the episode is
automatically Off track. Completing or manager-waiving the step stops future
deadline reminders for that task. Reminder IDs include the episode, task,
deadline, and recipient, so the daily runner stays idempotent.

Workflow reminder deep links open the episode's dedicated Production Board,
where the overdue state appears once on the affected step. Managers can switch
to **Schedule** there when they need to adjust dates or owners.

Episode asset retention is included even after producer acceptance. When one
or more files for an episode are within 30 days of their recorded 180-day
storage deadline, participants receive one grouped reminder per expiration
date with a link to the final asset package.

The local command is:

`npm run studio:reminders`

Production activation is a release prerequisite. Configure
`STUDIO_REMINDER_RUN_SECRET`; the included Netlify scheduled function dispatches
an hourly background maintenance run on published deploys. The protected
background function calls `/api/studio/reminders/run` with that secret as a
Bearer token. Besides idempotent reminders, each run independently resweeps
every finalized deletion tombstone so a large S3 transfer that began before
authorization expiry is eventually removed. Reminder delivery, mic-kit reads,
and deletion cleanup are isolated: one can fail without preventing cleanup
from running. The endpoint returns only counts and never logs the token,
addresses, or tracking details.
