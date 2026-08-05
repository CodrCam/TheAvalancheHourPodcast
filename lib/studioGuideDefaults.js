export const STUDIO_GUIDE_KEY = 'host_studio_guide';

export const DEFAULT_STUDIO_GUIDE = {
  schema_version: 2,
  eyebrow: 'Deep-dive host reference',
  title: 'The Avalanche Hour Host Field Manual',
  intro:
    'The quick guides above tell you what to do next. This manual explains how to do the work well—from shaping the story and preparing a guest through Riverside setup, recording, track recovery, producer directions, and the final publishing package.',
  announcement: {
    enabled: false,
    title: '',
    body: '',
  },
  sections: [
    {
      id: 'manual-orientation',
      category: 'Start here',
      title: 'How to use this manual—and what “done” means',
      summary:
        'Use the Episode Studio for the live assignment and this manual whenever you need the reasoning, standards, or exact procedure behind a checklist item.',
      body: `The Avalanche Hour works best when a host owns the story and leaves the next person a package they can use without reconstructing the episode from email, text messages, and unlabeled files. The quick-start workflow above is the route map. This manual is the field reference you open when you need the full explanation.

## Your live assignment wins
Open My Episodes and select the correct Episode Studio before beginning. Its dates, guest information, sponsor requirement, checklist, discussion, and producer assignment are the current record for that episode. If this manual and the Episode Studio ever conflict about a deadline, sponsor read, assigned person, or required deliverable, follow the Episode Studio and flag the conflict in its discussion.

## The Episode Studio is the official handoff
Put decisions, approved guest details, production notes, and final evidence in the Episode Studio. A separate working folder can be useful while you record and write, but it must not become a competing version of the producer package.

## An episode is ready for producer review when
- The guest identity, biography, pronunciation, and public links are accurate.
- The separate Riverside high-quality audio tracks are attached as WAV files.
- Every assigned sponsor or advertisement requirement is satisfied with the current language and requested evidence.
- Edit directions name the exact file, exact timestamp range, action, and intended result.
- The current air-date workflow steps are complete: the introduction is uploaded or scheduled with the assigned producer, and the host's show-notes, promotion, guest-link, image, and credit source material is ready for the publishing team.
- Every image has an intended use, order, crop direction, caption, creator credit, permission status, and restriction.
- Any known gap is stated plainly in the Episode Studio discussion.

Do not mark unfinished work complete just to clear a checklist. A visible, well-explained gap is easier for the team to solve than a hidden one.`,
      published: true,
      sort_order: 10,
      links: [
        {
          id: 'my-episodes',
          label: 'Open My Episodes',
          url: '/studio/episodes',
          note: 'Start with the live requirements for the assigned episode.',
          active: true,
        },
      ],
    },
    {
      id: 'story-design',
      category: 'Prepare',
      title: 'Find the story before you schedule the recording',
      summary:
        'Turn a broad avalanche topic into one useful listener promise, a clear guest choice, and a conversation with movement.',
      body: `A topic is not automatically a story. “Snow science,” “guiding,” or “avalanche education” can describe a field without giving a listener a reason to stay. A strong episode has a central question, tension, change, decision, or discovery.

## Write the listener promise
Before contacting the guest, finish this sentence: “By the end of this episode, the listener will understand, feel, or be able to do ______.” Keep the promise narrow enough that one conversation can actually deliver it.

## Find the hook
Choose a guest and subject you are genuinely curious about. Ask what is new in their work, what surprised them recently, what changed their thinking, or what people commonly misunderstand. The guest’s current passion often provides the hook. The full interview can range more widely, but the hook gives the episode a spine.

## Pressure-test the idea
- Why this story now?
- Why is this guest the right person to tell it?
- What is at stake for people who work, travel, learn, or make decisions in avalanche terrain?
- Where might the guest’s view be challenged, complicated, or changed?
- What should the opening tease without giving away the entire conversation?

## Build a loose arc
Think in three movements rather than a rigid script:
1. Context: Who is the guest, what world are we entering, and why should the listener care?
2. Development: What problem, decision, discovery, or conflict makes the story move?
3. Meaning: What did the guest learn, and what should the listener carry forward?

Save the listener promise, hook, and likely arc in the Episode Studio. They will guide the pre-interview, the live conversation, the edit notes, and the eventual introduction.`,
      published: true,
      sort_order: 20,
      links: [
        {
          id: 'episode-story-planning',
          label: 'Open Episode Story Planning',
          url: '/studio/episodes',
          note: 'Save the hook, guest, and listener promise with the episode.',
          active: true,
        },
      ],
    },
    {
      id: 'guest-pre-interview',
      category: 'Prepare',
      title: 'Run a useful guest pre-interview',
      summary:
        'Use a short conversation to establish trust, verify the story, collect accurate details, and prevent predictable recording-day problems.',
      body: `Schedule a short pre-interview several days before the actual recording. This is not a rehearsal of every answer. It is a chance to learn how the guest tells the story, confirm the strongest direction, establish boundaries, and make the technical expectations ordinary instead of awkward.

## Confirm the person
- Preferred name and pronunciation.
- Current title, organization, and location when relevant.
- Short biography and the public links that belong in show notes.
- Social accounts they want tagged—or do not want tagged.
- Topics, names, or details that require special care.
- Permission to use the supplied biography, links, and images.

## Confirm the story
Explain the listener promise in plain language. Ask what the guest is most excited to discuss, what people tend to get wrong, and which example best brings the topic to life. Listen for moments with stakes, decisions, uncertainty, humor, and change.

## Confirm the recording setup
Ask the guest to use a supported desktop computer, an external microphone when available, and closed-back headphones or wired earbuds. They should record in a quiet, soft-furnished room, close other programs that use the microphone or camera, silence notifications, and arrive early for a real sound check.

Send the recording time with the time zone written out. Ask the guest to connect the microphone and headphones before opening Riverside. Let them know that after the interview they must keep Riverside open until their local track says it uploaded successfully.

## Prepare questions without scripting the person
Write 10–12 open-ended fallback questions beginning with How, Why, or What. Organize them around the story arc, but do not send a rigid interrogation. The questions are a safety net. The real job is to hear the answer and ask the useful next question.`,
      published: true,
      sort_order: 30,
      links: [
        {
          id: 'riverside-guest-checklist',
          label: 'Riverside: join a studio as a guest',
          url: 'https://support.riverside.com/hc/en-us/articles/5252042203037-Join-a-Studio-as-a-Guest',
          note: 'Official lobby, device, and upload instructions for guests.',
          active: true,
        },
      ],
    },
    {
      id: 'room-and-equipment',
      category: 'Prepare',
      title: 'Build a recording setup that protects the conversation',
      summary:
        'Choose the room, microphone, headphones, computer, storage, and network before the guest arrives.',
      body: `Clean audio begins in the room. Software cannot fully restore a voice recorded through loud reflections, clothing rub, speaker echo, or the wrong microphone.

## Choose the room
Use a small or medium room with a low ceiling and soft surfaces. Carpet, curtains, upholstered furniture, books, and hanging clothes reduce reflections. Avoid kitchens, empty offices, high ceilings, and large windows when a softer room is available.

Remove or stop predictable noise: fans, air conditioners when safe, dishwashers, pets, nearby conversations, open windows, vibrating phones, computer alerts, keyboard typing, pen clicking, bracelets, and desk tapping. Do not let a microphone cable or inline earbud microphone rub against clothing or hair.

## Choose the audio path
Preferred: an Avalanche Hour mic kit or another dedicated wired microphone, plus closed-back headphones. Acceptable backup equipment is better than a laptop microphone, but test it. Never play the guest through laptop speakers; the sound will feed back into the microphone.

Place the microphone consistently near the speaker without crowding it. Speak at normal interview volume and keep the same distance throughout the session. Headphones should be loud enough to hear clearly but not so loud that the guest leaks into the microphone.

## Prepare the computer
- Use the latest supported Chrome or Edge browser, or the supported Riverside Mac app.
- Do not record in Incognito, InPrivate, or another private-browsing mode.
- Keep at least 5 GB of browser or device storage available.
- Close unnecessary applications and tabs, especially other programs using the microphone or camera.
- Temporarily disable a VPN, content blocker, or browser extension if it interferes with Riverside.
- Connect power so the computer cannot die during the interview.

## Prepare the network
Wired Ethernet is preferred. Riverside currently recommends more than 10 Mbps download and 5 Mbps upload. A slow connection may not reduce the quality of a successfully uploaded local high-quality track, but it can damage the live conversation and delay delivery. Run Riverside’s connectivity test when the setup or location is unfamiliar.

Request a mic kit early enough to receive it, connect it, and make a test recording before interview day.`,
      published: true,
      sort_order: 40,
      links: [
        {
          id: 'mic-kits',
          label: 'Request an Avalanche Hour mic kit',
          url: '/studio/mic-kits',
          note: 'Check availability and request equipment for the episode.',
          active: true,
        },
        {
          id: 'riverside-system-requirements',
          label: 'Riverside system requirements',
          url: 'https://support.riverside.com/hc/en-us/articles/5252134218013-System-requirements-and-supported-browsers',
          note: 'Current supported browsers, devices, storage, and network guidance.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-structure-and-scheduling',
      category: 'Riverside',
      title: 'Riverside I: choose the studio and schedule the session',
      summary:
        'Understand Riverside’s current structure, avoid duplicate studios, and create the scheduled session with the correct name, time, and time zone.',
      body: `Riverside’s current structure is important: the team account can contain productions, productions can contain studios, and the Planner schedules a session inside the selected studio. A project is created automatically after the scheduled recording finishes. Do not create duplicate studios or invent a second production just because you cannot immediately find the episode.

## First, choose the approved location
1. Sign in through the approved Avalanche Hour Riverside account using the team password manager.
2. Select the existing Avalanche Hour production.
3. Select the studio assigned to the episode or the team’s standard recording studio.
4. If you cannot find the correct location, ask the coordinator before creating anything new.

## Create a studio only when the team has asked for one
On a computer, open the current-studio menu in the upper-left area, hover over the intended production, use the plus control, name the studio clearly, choose audio-only when that is the team standard, select the transcription language, and create it. Studio availability and controls can depend on the Riverside plan.

## Schedule the interview
1. In the selected studio, open Planner from the left sidebar.
2. Choose the recording date and select the Schedule control.
3. Choose Session.
4. Enter a clear session name using the episode or guest name.
5. Set the date, start time, and expected end time.
6. Read the displayed time zone and change it if necessary. Riverside currently defaults scheduled sessions to the host’s local time zone, but you should still verify it.
7. Add a short description when it will help the guest understand the purpose.
8. Add the guest as a Guest—not an audience member or producer.
9. Create the session.

Riverside sends invited participants a session email with the details and joining link. Save the confirmed recording date in the Episode Studio so the production schedule and the recording platform agree.`,
      published: true,
      sort_order: 50,
      links: [
        {
          id: 'riverside-create-studio',
          label: 'Riverside: create a new studio',
          url: 'https://support.riverside.com/hc/en-us/articles/5038564560029-Create-a-new-studio',
          note: 'Official instructions; create one only when the team needs it.',
          active: true,
        },
        {
          id: 'riverside-schedule-session',
          label: 'Riverside: schedule a studio session',
          url: 'https://support.riverside.com/hc/en-us/articles/5288149163037-Schedule-a-studio-session',
          note: 'Current Planner, time-zone, invitation, and session steps.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-invitations',
      category: 'Riverside',
      title: 'Riverside II: invite the guest safely',
      summary:
        'Use the Guest role, send a usable invitation, and understand why a permanent direct studio link should not be posted casually.',
      body: `A Riverside role controls how someone enters and what they can do. Interview subjects should join as Guests because guests are recorded. Audience members and producers serve different purposes.

## Preferred invitation
Use the participant email field while scheduling the session. The resulting invitation includes the session details and a personalized joining link. Confirm that the guest received it and ask them to add the event to their calendar.

## Invite an additional guest before the session
1. Open Riverside Home.
2. Select Plan.
3. Select Invite to record.
4. Under Invite via email, choose Guest.
5. Enter the person’s email and send the invitation.

You can also select the Guest role and copy a direct studio link. Riverside says a direct studio link remains valid and gives access to the studio without a time restriction. Treat it as access information: send it directly to the intended participant and do not publish it in a public post or broadly shared document.

## Tell the guest exactly how to join
For the least friction, ask a computer user to open the link in the latest Chrome or Edge. Desktop Safari can join through a studio link but cannot sign in to the Riverside dashboard or editor, and the participant must remain on the Riverside tab while recording. Mobile guests should use the Riverside app rather than a mobile browser.

The guest should enter their recognizable name, allow microphone and camera permission, indicate whether they are wearing headphones, select the intended microphone, camera, and speaker in the lobby, and then join the studio.`,
      published: true,
      sort_order: 60,
      links: [
        {
          id: 'riverside-invite-participants',
          label: 'Riverside: invite participants',
          url: 'https://support.riverside.com/hc/en-us/articles/5252390112413-Invite-participants-to-record-in-your-studio',
          note: 'Official email and direct-link invitation steps.',
          active: true,
        },
        {
          id: 'riverside-guest-join',
          label: 'Riverside: guest joining instructions',
          url: 'https://support.riverside.com/hc/en-us/articles/5252042203037-Join-a-Studio-as-a-Guest',
          note: 'Send this to a guest who wants the full joining walkthrough.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-lobby-and-test',
      category: 'Riverside',
      title: 'Riverside III: run the lobby and test recording',
      summary:
        'Arrive early, select the real microphone and headphones, inspect levels, and listen to Riverside’s built-in test before the interview begins.',
      body: `A successful lobby screen is not a sound check. You must confirm the equipment selection and listen to a recorded sample.

## Enter early
Join at least 15 minutes before the planned interview. Plug in the microphone and headphones before opening Riverside. Close unnecessary tabs and programs, silence notifications, and confirm that the computer is on power.

In the lobby, choose the intended microphone by its actual device name, the correct headphones or speaker output, and the camera when video is required. Do not accept “Default” without knowing what device it represents. Ask the guest to make the same selections.

## Run Riverside’s built-in test
1. Join the studio as Host on a computer.
2. Wait for the guest to join.
3. Open the menu attached to the Record button.
4. Select Run test recording.
5. Speak naturally for the 15-second test.
6. Review each included participant.
7. Open Input & Output to inspect the selected audio input and other technical details.
8. Repeat the test after any adjustment.

Riverside’s test recording is not saved to the dashboard. Auto-start must be disabled to use it, and a guest joining from the Mac app may not be included. When that happens, create a short ordinary take, stop it, and review it before the real interview.

## What to listen for
- Distant, hollow audio: the laptop microphone may be selected.
- Harsh or broken audio: the input may be clipping; the participant must lower their device’s microphone input sensitivity.
- Echo: confirm headphones first, then enable individual Echo Cancellation while the recording is stopped.
- Fan, air conditioner, or steady hum: remove the source when possible. Riverside recommends Noise Reduction outside separate soundproofed rooms, but it filters the recorded tracks and the removed texture cannot be restored later.
- Clothing rustle or desk vibration: reposition the microphone and cable.

Do not begin the interview until both people can hear clearly and the recorded test sounds usable.`,
      published: true,
      sort_order: 70,
      links: [
        {
          id: 'riverside-test-recording',
          label: 'Riverside: perform a test recording',
          url: 'https://support.riverside.com/hc/en-us/articles/7209485283101-Perform-a-test-recording',
          note: 'Official 15-second test and adjustment instructions.',
          active: true,
        },
        {
          id: 'riverside-echo-cancellation',
          label: 'Riverside: individual Echo Cancellation',
          url: 'https://support.riverside.com/hc/en-us/articles/5286971557917-Turn-individual-echo-cancellation-on-or-off',
          note: 'Use when speaker audio is feeding back into a microphone.',
          active: true,
        },
        {
          id: 'riverside-noise-reduction',
          label: 'Riverside: Noise Reduction',
          url: 'https://support.riverside.com/hc/en-us/articles/5271863226653-Enable-noise-reduction-in-the-studio',
          note: 'Understand when to filter and what fidelity cannot be restored.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-recording',
      category: 'Riverside',
      title: 'Riverside IV: record and monitor the session',
      summary:
        'Start deliberately, verify every participant is recording and uploading, capture the required show elements, and create clean edit points.',
      body: `When the technical test passes, explain that you are beginning the real recording. Give the guest a moment to settle, then start.

## Start and confirm
1. Click Record.
2. Confirm Riverside visibly shows the recording state.
3. Open the People sidebar on a computer.
4. Confirm the recording indicator for each participant.
5. Confirm that each participant’s local-track upload percentage is moving.

The upload percentage can change as the session grows and the connection changes. You are checking for active recording and continued progress, not demanding that the number move in a straight line.

## Capture the required material
- Record several seconds of clean room tone.
- Capture the guest identification line: “This is [guest name], and you are listening to The Avalanche Hour Podcast.”
- Follow the current sponsor and advertisement requirement shown in the Episode Studio.
- Leave a complete pause at the natural mid-roll point so the producer has a clean place to work.
- When restarting an answer after an interruption, begin again with a complete sentence.

## Host the conversation
Listen more than you talk. Let a useful pause exist before filling it. Ask for a concrete example when an answer becomes abstract. Ask what changed, what made the decision difficult, what the guest noticed, and what they would do differently. Avoid stepping on the final words of an answer.

If something goes wrong, pause the conversation rather than pretending it did not happen. Say what is being reset, stop the recording when a setting such as Echo Cancellation must change, make another short test, and resume with a clean sentence. Riverside permits multiple recording takes in one studio session; a clearly explained new take is easier to produce than a hidden technical failure.`,
      published: true,
      sort_order: 80,
      links: [
        {
          id: 'riverside-start-stop',
          label: 'Riverside: start and stop recordings',
          url: 'https://support.riverside.com/hc/en-us/articles/5286767295133-Start-and-stop-recordings',
          note: 'Official recording controls and multiple-take behavior.',
          active: true,
        },
        {
          id: 'riverside-studio-sidebar',
          label: 'Riverside: Studio sidebar',
          url: 'https://support.riverside.com/hc/en-us/articles/5287360943261-Studio-sidebar-Overview',
          note: 'Where hosts monitor participant devices and uploads.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-upload-and-recovery',
      category: 'Riverside',
      title: 'Riverside V: stop, verify every upload, and recover safely',
      summary:
        'Do not confuse stopping the interview with finishing delivery; each local track must reach Riverside before its browser or app closes.',
      body: `Riverside records the high-quality media locally on each participant’s device and uploads it during and after the session. Pressing Stop ends the take. It does not prove that every high-quality track is safely available.

## Before anyone leaves
1. Click Stop.
2. Open the People sidebar and check each participant—not just yourself.
3. Look for Upload Complete or Successfully uploaded for every recorded person.
4. Tell the guest to leave the Riverside tab or app open.
5. If waiting is awkward, cameras and microphones can be turned off while the browser remains open.
6. End the call only after every required participant reports a successful upload.

The general uploading indicator at the top measures your own track. It is not proof that the guest’s track is complete.

## If someone closed too early
Do not clear browser data, delete the session, or create replacement files over the original. For a computer recording, have the participant return to https://riverside.com/upload on the same computer and browser profile used for the session. For a mobile recording, reopen the Riverside app. The high-quality track cannot be available to the host until it uploads from that participant’s device.

## If a track remains stuck
- Keep the same device powered and connected.
- Do not use private browsing or clear the browser cache.
- Stop other heavy network activity.
- Preserve the Riverside session and recording.
- Note the guest name, device, approximate recording time, and visible upload state.
- Tell the producer in the Episode Studio immediately.
- Use Riverside’s upload troubleshooting or Support before deleting anything.

Browser storage can temporarily contain the only recoverable local recording. Treat cache clearing and session deletion as destructive actions until the upload is confirmed.`,
      published: true,
      sort_order: 90,
      links: [
        {
          id: 'riverside-confirm-uploads',
          label: 'Riverside: confirm participant uploads',
          url: 'https://support.riverside.com/hc/en-us/articles/5287442440093-Confirm-participants-tracks-are-uploading',
          note: 'Where to verify each participant during and after recording.',
          active: true,
        },
        {
          id: 'riverside-finish-guest-upload',
          label: 'Riverside: recover an incomplete guest upload',
          url: 'https://support.riverside.com/hc/en-us/articles/5458387524509-My-guest-s-local-recording-track-didn-t-finish-uploading-how-do-they-send-it',
          note: 'Official computer and mobile recovery starting point.',
          active: true,
        },
        {
          id: 'riverside-upload-page',
          label: 'Riverside local upload page',
          url: 'https://riverside.com/upload',
          note: 'Open on the same computer and browser profile used to record.',
          active: true,
        },
      ],
    },
    {
      id: 'riverside-download',
      category: 'Riverside',
      title: 'Riverside VI: download the correct production tracks',
      summary:
        'Choose separate high-quality WAV tracks, verify the files, label them clearly, and attach them to the Episode Studio.',
      body: `Riverside can offer high-quality local tracks, editor exports, compressed audio, and cloud recordings. They are not interchangeable.

For production, use each participant’s separate high-quality audio track. A cloud recording depends on live internet quality and is a reference or backup. An MP3 is compressed and should not replace the WAV production master.

## Download the tracks
1. Sign in to Riverside.
2. Open the correct studio.
3. Select the project created by the recording.
4. Open Recordings.
5. Find the correct recording or take.
6. Under Tracks, choose Download beside each recorded participant.
7. Choose Raw audio for the separate high-quality WAV master.
8. Use Aligned audio only when the producer requests a track padded to the shared session timeline.
9. Repeat for the host, guest, and any other recorded participant.

## Verify before handoff
Open every downloaded WAV and check that it plays, has the expected duration, and contains the intended person. Rename it before uploading.

Use this pattern:
{episode-short-name}_{asset}_{person}_{version-or-status}.ext

Examples:
- mission-ridge_interview_jordan_raw.wav
- mission-ridge_interview_host_raw.wav
- mission-ridge_guest-id_jordan_approved.wav

Upload the files beneath the correct Episode Studio checklist items and keep a local working copy until production is complete. Episode Studio uploads have a 180-day retention window, so the production team must move long-term archive material into its approved archive before expiration.`,
      published: true,
      sort_order: 100,
      links: [
        {
          id: 'riverside-download-high-quality',
          label: 'Riverside: download high-quality tracks',
          url: 'https://support.riverside.com/hc/en-us/articles/5260432295581-Download-high-quality-tracks',
          note: 'Official studio, project, recording, and format steps.',
          active: true,
        },
        {
          id: 'riverside-file-formats',
          label: 'Riverside: video and audio formats',
          url: 'https://support.riverside.com/hc/en-us/articles/5260131045917-Video-and-audio-file-formats-Overview',
          note: 'High-quality tracks versus editor exports and cloud recordings.',
          active: true,
        },
      ],
    },
    {
      id: 'interview-craft',
      category: 'Interview craft',
      title: 'Interview like a curious guide, not a questionnaire',
      summary:
        'Use preparation as a foundation, then listen for specificity, tension, change, emotion, and the next honest question.',
      body: `The best interviews sound like two people talking over a fence: prepared but alive. Your question list protects you from going blank; it should not prevent you from following the most interesting answer.

## Ask questions that open a door
Prefer How, Why, and What. Ask for a moment, scene, decision, or example.

Weak: “Was that difficult?”
Stronger: “What made that decision difficult in the moment?”

Weak: “Do you think communication matters?”
Stronger: “What did the team say—or fail to say—that changed the outcome?”

## Listen for the next question
Notice when the guest becomes more specific, energetic, careful, emotional, or surprised. Useful follow-ups include:
- “Can you take me back to that moment?”
- “What did you notice first?”
- “What were the options?”
- “What changed your mind?”
- “What do people misunderstand about that?”
- “What would you want a newer practitioner to hear?”

## Let the story breathe
A pause is not failure. Do not rush to fill every silence or finish the guest’s sentence. Avoid stacking three questions together. Ask one clear question and listen to the answer.

## Stay responsible
Clarify technical terms for a mixed audience. Ask for spellings and pronunciations when needed. Do not pressure a guest past an agreed boundary. If a statement creates a factual, legal, privacy, or safety concern, mark the timestamp and flag it for the producer instead of trying to solve it silently in the edit.`,
      published: true,
      sort_order: 110,
      links: [],
    },
    {
      id: 'producer-brief',
      category: 'Deliver',
      title: 'Turn the raw interview into producer directions',
      summary:
        'Listen back while the conversation is fresh and write exact, actionable notes instead of vague editing requests.',
      body: `You know the conversation better than anyone who receives it later. You do not necessarily need to produce the full episode, but you must listen back and identify the story, the problems, and the strongest material.

## Every edit direction needs four parts
- File: the exact filename.
- Time: start and end in HH:MM:SS–HH:MM:SS format.
- Action: keep, cut, shorten, move, replace, cover with narration, or review.
- Result: what the change fixes or what the listener should understand.

Example:
mission-ridge_interview_jordan_raw.wav — 00:18:42–00:19:07 — CUT — duplicate answer; join to the sentence beginning “Our morning starts…”

## Mark the story
Identify two or three possible opening soundbites with exact filenames and timestamps. Mark the clearest explanation of the central idea, the strongest story turn, and the ending thought you want the listener to retain.

## Mark the risks
Flag factual corrections, unclear names, pronunciation questions, sensitive material, private information, audio damage, interruptions, repeated answers, and any segment that must remain untouched.

Avoid “use the good part,” “fix this section,” “latest file,” or “cut the awkward bit.” If two reasonable producers could interpret the note differently, make it more specific.`,
      published: true,
      sort_order: 120,
      links: [
        {
          id: 'episode-edit-notes',
          label: 'Open Episode Edit Notes',
          url: '/studio/episodes',
          note: 'Keep timestamps and production directions with the episode.',
          active: true,
        },
      ],
    },
    {
      id: 'writing-and-publishing',
      category: 'Deliver',
      title: 'Prepare the introduction and publishing source brief',
      summary:
        'Give the producer and publishing owner accurate source material for the final introduction, show notes, promotion, artwork, and credits.',
      body: `The host brief should make one promise across the introduction, show notes, promotion, and images. Each format has a different job, but all of them should point toward the same story.

## Introduction
Tease the story rather than summarizing every answer. A useful structure is a few strong clips connected by brief host narration and music as a bridge. Keep each thought direct, stay in the present tense when possible, and let your own voice sound human.

Use only the current sponsor language assigned in the Episode Studio. Do not copy names or reads from a previous episode.

By 21 days before air, choose one path in the episode timeline: upload the finished intro, or send the script and record the confirmed date of the producer recording session. That session must be scheduled for no later than seventeen days before air. The actual scheduling conversation stays outside Episode Studio; the confirmation belongs in the timeline.

Preserve the podcast’s purpose exactly:
“The goal of this podcast is to create a stronger community through the sharing of stories, knowledge, and news amongst people with a curious fascination with avalanches.”

## Outro and final assembly
The producer adds the current mid-roll and outro during final assembly. Give the producer accurate music, artwork, photography, and other creative credits in the host brief; do not build an unofficial competing outro.

## Show notes
Give the producer and publishing owner the facts needed to draft two or three human paragraphs: the story and why it matters, a concise guest biography, primary topics, relevant organization or research links, spellings, pronunciation, and anything that should not be published. This is a source brief, not a requirement that the host write the final public copy.

## Social package
Provide a concise guest-and-story summary, two to four useful takeaways, correct host and guest handles, and any no-tag request. A strong excerpt can be suggested with an exact timestamp. The episode's assigned publishing owner turns that source material into the scheduled social, email, and blog package.

## Images
For every image, provide:
- Exact filename.
- Use: cover, secondary, inline, alternate, social-only, or do not use.
- Preferred order and crop.
- The subject or detail that must remain visible.
- Caption.
- Photographer or artist credit.
- Permission status and any restriction.

Never make the producer guess which photo is “the good one” or whether the podcast has permission to publish it.`,
      published: true,
      sort_order: 130,
      links: [
        {
          id: 'episode-publishing-package',
          label: 'Open the Episode Publishing Package',
          url: '/studio/episodes',
          note: 'Complete the intro, copy, images, permissions, and credits.',
          active: true,
        },
      ],
    },
    {
      id: 'final-handoff',
      category: 'Deliver',
      title: 'Complete the handoff and stay available for review',
      summary:
        'Perform a deliberate final check, submit one authoritative package, and respond to producer changes without creating competing versions.',
      body: `Before submitting, read the Episode Studio as though you are the producer opening it for the first time.

## Final check
1. Confirm the guest’s name, biography, pronunciation, links, and handles.
2. Play every uploaded audio file and confirm the filename matches the person and take.
3. Confirm the required Riverside high-quality WAV tracks are present.
4. Confirm current sponsor or advertisement evidence is present.
5. Confirm edit notes use exact files, timestamps, actions, and results.
6. Confirm the intro path is complete and the show-notes, promotion, image, music, and credit source brief contains everything the publishing owner needs.
7. Confirm every image has use, order, crop, caption, credit, permission, and restriction information.
8. Mark superseded working files clearly.
9. Read the discussion and answer unresolved production questions.
10. Explain any known gap honestly.

Submit the package into producer review. Submission does not erase the work. The producer can accept it or request changes inside the same Episode Studio.

## Listen to the private proof
The producer uploads the proof to the private proof section. Download and listen to the entire program before approving it or recording exact requested changes by the timeline deadline. Approval is tied to that exact file version. A replacement proof automatically reopens host approval and the dependent publishing, promotion, and guest-asset checks.

Never forward the Episode Studio proof download, staged Spotify link, or internal publishing package to a guest. Those paths may expose unfinished work, internal notes, future publishing details, or team-only access. If the host and producer deliberately approve a guest advance listen, create a separate permission-controlled Google Drive copy that contains only the approved program and remove that access when the review window ends.

When changes are requested, update the existing checklist item and package rather than sending a second unofficial folder. Reply in the discussion with what changed and identify any replacement filename. Keep the local recording copies until the package is accepted and the production team confirms it has what it needs.`,
      published: true,
      sort_order: 140,
      links: [
        {
          id: 'episode-final-handoff',
          label: 'Review and Submit My Episode',
          url: '/studio/episodes',
          note: 'Use the visible checklist as the final source of truth.',
          active: true,
        },
      ],
    },
    {
      id: 'troubleshooting-field-guide',
      category: 'Troubleshoot',
      title: 'Recording-day troubleshooting field guide',
      summary:
        'Use the safest next step for browser, microphone, echo, noise, connection, storage, and upload problems.',
      body: `When a problem appears, protect the recording first. Pause, describe the issue, note the time, and avoid destructive cleanup while local media may still exist.

## The guest cannot enter
Confirm they are using the intended invitation and Guest role. Use the latest supported Chrome or Edge on a computer, or the Riverside app on mobile. Leave private-browsing mode. Allow microphone and camera permission. If a direct link was canceled or replaced, send the current invitation.

## The microphone is missing
Stop recording. Connect the microphone directly, close any other app using it, confirm operating-system permission, and reopen Riverside if no upload is pending. Select the device by name and run another test.

## The voice is distant or hollow
The laptop microphone is probably selected or the intended microphone is too far away. Stop, select the external microphone, reposition it, and listen to a new test.

## The voice clips or is too quiet
The participant must change their own computer or device input sensitivity. A host’s Riverside output fader changes what people hear in the call; it does not repair an overloaded or under-recorded input track.

## Someone hears echo
Put every participant on headphones and close other calling applications. Echo Cancellation can be changed only while recording is stopped. Enable it for the participant whose environment is sending other people’s audio back into the call, then test again.

## There is steady background noise
Remove the physical source first. Decide whether Riverside Noise Reduction is appropriate before the next take. It filters recorded tracks and removed audio texture cannot be restored.

## The connection is unstable
Use Ethernet, stop other uploads and streams, disable a problematic VPN, move closer to the router, and turn off video when audio must be protected. Pause for reconnects and restart answers with complete sentences.

## Riverside warns about low storage
Stop safely, complete pending uploads, and preserve browser data. Riverside recommends at least 5 GB available. Never clear the cache while an unfinished local track may be stored there.

## A track is still uploading
Keep the original device, browser profile, and tab open. If it closed, use Riverside’s upload page on that same computer and profile, or reopen the mobile app. Preserve the session and contact the producer before deleting or recreating anything.`,
      published: true,
      sort_order: 150,
      links: [
        {
          id: 'riverside-host-checklist',
          label: 'Riverside host checklist',
          url: 'https://support.riverside.com/hc/en-us/articles/5706937784861-Host-checklist-and-tips-Recording-on-computer',
          note: 'Current official preflight and recording guidance.',
          active: true,
        },
        {
          id: 'riverside-upload-recovery',
          label: 'Riverside incomplete-track recovery',
          url: 'https://support.riverside.com/hc/en-us/articles/5458387524509-My-guest-s-local-recording-track-didn-t-finish-uploading-how-do-they-send-it',
          note: 'Protect and resume a guest’s local upload.',
          active: true,
        },
        {
          id: 'riverside-university',
          label: 'Riverside University',
          url: 'https://riverside.fm/university',
          note: 'Platform tutorials for additional practice.',
          active: true,
        },
      ],
    },
  ],
  manager_notes: [
    'Keep this field manual durable. Put current dates, meetings, assignments, and sponsor language in the Episode Studio or a temporary announcement instead of hard-coding them into evergreen sections.',
    'Review official Riverside links and interface names before each season and whenever Riverside changes its dashboard.',
    'Keep Riverside credentials in the approved team password manager; never publish them in the guide, discussion, email, or shared document.',
    'Use the Resource Editor announcement only for genuinely current information and turn it off after the event or deadline passes.',
    'Keep one completed producer-package example available during host onboarding.',
  ],
};
