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

Episode discussion posts, assignments, sponsor-read changes, submissions,
resubmissions, change requests, approvals, and off-track changes create
immediate events. Mic Kit request responses, assignments, tracking updates, and
direct handoffs also create immediate events.

## Scheduled reminders

`runStudioReminderGeneration()` loads current Episode Studios and the Mic Kit
tracker, generates due-date candidates, and creates deterministic notification
IDs. Re-running the same due-date reminder produces a conditional-write
duplicate instead of another notification.

Episode asset retention is included even after producer acceptance. When one
or more files for an episode are within 30 days of their recorded 180-day
storage deadline, participants receive one grouped reminder per expiration
date with a link to the final asset package.

The local command is:

`npm run studio:reminders`

Production activation is intentionally not included in this local change. To
activate it, configure `STUDIO_REMINDER_RUN_SECRET`, then schedule a trusted
POST to `/api/studio/reminders/run` with that secret as a Bearer token. The
endpoint returns only counts and never logs the token, addresses, or tracking
details.
