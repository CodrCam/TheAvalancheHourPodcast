export const STUDIO_GUIDE_KEY = 'host_studio_guide';

export const DEFAULT_STUDIO_GUIDE = {
  schema_version: 1,
  eyebrow: 'The Avalanche Hour',
  title: 'Season 11 Host Studio',
  intro:
    'Everything you need to prepare, record, and deliver a great episode. Search the guide or open a section below.',
  announcement: {
    enabled: true,
    title: 'Season 11 planning',
    body:
      'The all-hands meeting is August 5, 2026 at 4:00 PM Pacific / 7:00 PM Eastern. Fall host training details will be published here when confirmed.',
  },
  sections: [
    {
      id: 'welcome-and-team',
      category: 'Getting started',
      title: 'Welcome to the team',
      summary:
        'Who supports each episode, how the hosting team works, and what every host commits to.',
      body:
        'Make the work your own, stay curious, listen more than you talk, and ask for help when something is not working.\n\n' +
        '## Production team\n' +
        '- Caleb Merrill — Podcast Owner. Oversees funding and timelines and records advertising soundbites.\n' +
        '- Sierra Bishop — Podcast Coordinator. Supports host communication, timelines, outreach, and social media.\n' +
        '- Angie Link — Producer. Edits interviews, helps shape the narrative, and builds the final audio file.\n\n' +
        '## Host commitment\n' +
        'Primary hosts generally lead two episodes during the season. Guest hosts generally lead one episode with additional production support.\n\n' +
        '- Follow the production timeline.\n' +
        '- Complete the episode pitch before recording.\n' +
        '- Use the shared guest questionnaire.\n' +
        '- Listen back and provide a first cut or timestamped edit notes.\n' +
        '- Record the episode introduction with the current sponsor read.\n' +
        '- Deliver audio, notes, and credited photos before release.',
      published: true,
      sort_order: 10,
      links: [],
    },
    {
      id: 'training-and-schedule',
      category: 'Getting started',
      title: 'Training and season schedule',
      summary:
        'Important meetings, the production calendar, and the season cadence.',
      body:
        'Season 11 runs roughly October 1 through June 15. Episodes are generally weekly through the core season and biweekly in the shoulder and off seasons.\n\n' +
        'The all-hands planning meeting is August 5, 2026 at 4:00 PM Pacific / 7:00 PM Eastern. The fall host training session will be recorded for anyone who cannot attend live.',
      published: true,
      sort_order: 20,
      links: [
        {
          id: 'mastermind-schedule',
          label: 'Mastermind schedule - Season 10 source',
          url: 'https://docs.google.com/spreadsheets/d/1aB6pdm1YoNnUaMtpTQ9LvG6xOcKrB74qizvQJ6PKAdI/edit',
          manager_note: 'Replace with the Season 11 schedule before publishing.',
          active: false,
        },
      ],
    },
    {
      id: 'episode-timeline',
      category: 'Episode workflow',
      title: 'Timeline of a podcast episode',
      summary:
        'The complete handoff from the first idea through production and payment.',
      body:
        '1. Brainstorm a guest or topic and decide what the audience should take away.\n' +
        '2. Complete the Episode Pitch Form before recording.\n' +
        '3. Give the Editorial Committee a short feedback window.\n' +
        '4. Contact the guest, hold a pre-interview chat, and schedule the interview.\n' +
        '5. Create the Riverside project and session, then send the guest invitation.\n' +
        '6. Follow the recording checklist and capture the interview.\n' +
        '7. Listen back, prepare a rough cut or timestamps, and notify the producer.\n' +
        '8. Deliver the intro, show notes, social copy, and credited photos.\n' +
        '9. Send the hosting invoice after every deliverable is in the episode folder.',
      published: true,
      sort_order: 30,
      links: [
        {
          id: 'episode-pitch',
          label: 'Episode Pitch Form - Season 10 source',
          url: 'https://docs.google.com/forms/d/19Ce0ZFnvJRpsKta4jqGYwMTxx7NFhOSq1bCH3iDNkI4/edit',
          manager_note: 'Duplicate for Season 11 and replace this edit link.',
          active: false,
        },
      ],
    },
    {
      id: 'story-and-interview',
      category: 'Prepare',
      title: 'Story selection and the interview',
      summary:
        'Choose a useful story, prepare open questions, and create a natural conversation.',
      body:
        'Choose a guest and topic you are genuinely curious about. A pre-interview conversation should reveal what is new or exciting in the guest’s work; that passion often becomes the hook.\n\n' +
        'Prepare 10-12 simple fallback questions beginning with How, Why, or What. The questions are a safety net. Listening and following the guest’s answers are more important than completing the list.\n\n' +
        'Keep the eventual intro direct and engaging. It should tease the story rather than summarize the full interview.',
      published: true,
      sort_order: 40,
      links: [
        {
          id: 'interview-tips',
          label: 'Editorial Committee and Interview Tips',
          url: 'https://docs.google.com/document/d/14uojizpkn1TIxaX_sNBz5g-nJWFSKaTfWQ5gJOw6lZg/edit',
          manager_note:
            'Review access and duplicate for Season 11 before activating.',
          active: false,
        },
        {
          id: 'guest-questionnaire',
          label: 'Guest Questionnaire - Season 10 source',
          url: 'https://docs.google.com/forms/d/1KxjldhCHIskCBnWpJ8VEvKT0t9r6WM13e3CYD3yab0k/edit',
          manager_note:
            'Create one standard Season 11 copy and replace this edit link.',
          active: false,
        },
      ],
    },
    {
      id: 'drive-and-files',
      category: 'Episode workflow',
      title: 'Google Drive and episode files',
      summary:
        'Where episode materials live and how to keep each production folder usable.',
      body:
        'Each host receives a folder inside the Season 11 Drive. Create one clearly named subfolder for every episode.\n\n' +
        'Keep the rough-cut WAV, show notes, music selections, social copy, credited photos, and completed post-recording checklist together. The producer and coordinator work directly from this folder, so keep filenames and versions clear. Before handoff, follow the exact naming pattern in “Clear producer directions and file labeling” and remove or clearly mark superseded files.',
      published: true,
      sort_order: 50,
      links: [],
    },
    {
      id: 'recording',
      category: 'Record',
      title: 'Recording with Riverside',
      summary:
        'Studio setup, equipment checks, sound quality, and the before-you-leave checklist.',
      body:
        'Record in a quiet, soft-furnished room. Everyone should use closed-back headphones or earbuds and select the correct microphone before starting.\n\n' +
        '- Confirm the Riverside time zone.\n' +
        '- Check the selected microphone and headphone output.\n' +
        '- Enable echo cancellation when someone cannot wear headphones.\n' +
        '- Use background-noise removal only when needed.\n' +
        '- Capture the guest identification soundbite.\n' +
        '- Pause naturally for the mid-roll advertisement.\n' +
        '- Before leaving, confirm every local track has fully uploaded.\n' +
        '- Download the WAV files, place them in Drive, and retain a local copy.',
      published: true,
      sort_order: 60,
      links: [
        {
          id: 'riverside-university',
          label: 'Riverside University',
          url: 'https://riverside.fm/university',
          note: 'Recording tutorials and troubleshooting.',
          active: true,
        },
        {
          id: 'mic-request-source',
          label: 'Mic Kit Request responses - source',
          url: 'https://docs.google.com/spreadsheets/d/1o4R8uf-fbNza6b0G67uRmkb3L2Q_Y29rZwTq01AD1hQ/edit',
          manager_note:
            'Locate the live request form before activating this resource.',
          active: false,
        },
      ],
    },
    {
      id: 'scripting-and-audio',
      category: 'Produce',
      title: 'Scripting, introductions, and audio',
      summary:
        'Shape the opening, use the current sponsor language, and select appropriate music.',
      body:
        'The introduction should establish the story, identify the host, credit the current sponsors, and connect the conversation to The Avalanche Hour’s purpose.\n\n' +
        'Use a few strong clips with short narration between them. Write in the present tense, keep each thought concise, and let your personality come through.\n\n' +
        'The outro should include production, artwork, music, and photo credits; invite listeners to subscribe and provide feedback; and tease the next episode.',
      published: true,
      sort_order: 70,
      links: [
        {
          id: 'audio-school',
          label: 'Podcast Audio School - Season 10 source',
          url: 'https://docs.google.com/presentation/d/1WO7wyLq2CXbowb-KH5UJXT72Ge-IrgCeGwkSwwFI-xY/edit',
          manager_note: 'Review permissions and duplicate for Season 11.',
          active: false,
        },
        {
          id: 'garageband-tutorial',
          label: 'GarageBand editing tutorial',
          url: 'https://drive.google.com/file/d/1VjzE000qyCPCfmkSZF3YnplA1rJYsBHF/view',
          manager_note:
            'Confirm the file is available to every host before activating.',
          active: false,
        },
      ],
    },
    {
      id: 'producer-handoff',
      category: 'Deliver',
      title: 'Clear producer directions and file labeling',
      summary:
        'Label every asset clearly and tell the producer exactly what should appear in the final episode.',
      body:
        'A producer should never have to guess which file you mean or what you want done. Before submitting, make sure every direction names the exact file, identifies the exact moment or image, and states the intended result.\n\n' +
        '## Label files before linking them\n' +
        'Use this exact pattern: {episode-short-name}_{asset}_{person-or-description}_{version-or-status}.ext\n\n' +
        'Examples:\n' +
        '- mission-ridge_interview_jordan_raw.wav\n' +
        '- mission-ridge_edit-notes_v2.docx\n' +
        '- mission-ridge_photo-01_jordan-ridgeline.jpg\n\n' +
        'Use the same short episode name across the folder. Add a number when order matters, and use clear versions such as v2, approved, or raw. Do not use vague filenames such as IMG_4821.jpg, audio-final-final.wav, or new-notes.docx.\n\n' +
        '## Write edit directions the producer can act on\n' +
        'For every requested audio change, provide:\n' +
        '- File: the exact filename.\n' +
        '- Time: a start and end timestamp in HH:MM:SS–HH:MM:SS format.\n' +
        '- Action: keep, cut, shorten, move, replace, cover with narration, or review.\n' +
        '- Reason or result: what the change fixes or what the listener should understand.\n\n' +
        'Example: mission-ridge_interview_jordan_raw.wav — 00:18:42–00:19:07 — CUT — duplicate answer; join to the sentence beginning “Our morning starts…”\n\n' +
        'Also identify the exact filename and timestamp range for every preferred opening clip, pronunciation issue, factual correction, or section that should remain untouched.\n\n' +
        '## Give complete image directions\n' +
        'For every photo or artwork file, state:\n' +
        '- the exact filename;\n' +
        '- whether to use it, avoid it, or treat it as an alternate;\n' +
        '- its order and purpose, such as cover, secondary, inline, or social-only;\n' +
        '- the preferred crop and the subject or detail that must remain visible;\n' +
        '- the caption, photographer or artist credit, permission status, and any use restrictions.\n\n' +
        'Example: mission-ridge_photo-01_jordan-ridgeline.jpg — COVER — crop 16:9, keep Jordan and the full ridgeline visible — caption: “Morning route assessment at Mission Ridge” — Photo: Alex Rivera — permission confirmed for podcast and social use.\n\n' +
        'Avoid directions such as “use the good photo,” “use the latest cut,” “fix this section,” or “the guest image.” If the producer could reasonably choose the wrong file or interpret the request two ways, make the direction more specific.',
      published: true,
      sort_order: 75,
      links: [],
    },
    {
      id: 'post-production',
      category: 'Deliver',
      title: 'Post-production and delivery',
      summary:
        'First-cut notes, show notes, social materials, credited photos, and the final handoff.',
      body:
        'Listen back soon after recording. At minimum, send exact filenames and timestamp ranges for cuts, long pauses, corrections, and two or three possible opening soundbites. Follow the file-labeling and producer-direction standard in the previous section.\n\n' +
        'Write a two- or three-paragraph human summary, a brief guest biography, topics covered, and relevant links. Provide 2-6 high-quality photos with explicit use, order, crop, caption, credit, and permission details.\n\n' +
        'The final episode folder should contain the rough-cut WAV, edit notes, show notes, music, social copy, photos, and credits about one week before release.',
      published: true,
      sort_order: 80,
      links: [
        {
          id: 'post-recording-checklist',
          label: 'Post-Recording Checklist - Season 10 source',
          url: 'https://docs.google.com/document/d/1ILHKLyACJYmCnfJteKFtI96FIUceAoKwrCLAAxg3wV8/edit',
          manager_note:
            'Create a blank Season 11 template before activating.',
          active: false,
        },
      ],
    },
    {
      id: 'payment-and-reference',
      category: 'Deliver',
      title: 'Payment and reference',
      summary:
        'When to invoice, what completes an episode, and where to send questions.',
      body:
        'The hosting stipend is $200 USD per completed episode. Send the invoice to Caleb after every required deliverable is in the episode Drive folder.\n\n' +
        'For production questions, use the team directory and the contact method listed for Caleb or Sierra. Credentials must remain in the team password manager and should never be pasted into this guide.',
      published: true,
      sort_order: 90,
      links: [],
    },
  ],
  manager_notes: [
    'Confirm the Season 11 theme, host cadre, and Primary versus Guest host assignments.',
    'Publish the Season 11 production calendar and host Drive folders.',
    'Set the fall training date and add the recording afterward.',
    'Replace every inactive Season 10 source link with a host-safe Season 11 link.',
    'Standardize on one Guest Questionnaire and retire per-host copies.',
    'Adopt one episode filename convention and include a completed handoff example in host training.',
    'Locate the live Mic Kit Request form and add the Where’s My Mic tracker.',
    'Keep Riverside credentials in the password manager and rotate the old Season 10 password.',
    'Confirm microphone specifications, sponsor reads, and an example intro script.',
  ],
};
