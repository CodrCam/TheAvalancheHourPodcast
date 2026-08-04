import Head from 'next/head';
import GuestQuestionnaireForm from '../../components/GuestQuestionnaireForm';

function question(
  key,
  type,
  prompt,
  { required = false, sortOrder = 0, helpText = '', options = [], showWhen } = {}
) {
  return {
    key,
    type,
    prompt,
    required,
    help_text: helpText,
    options,
    show_when: showWhen,
    sort_order: sortOrder,
    visible: true,
    built_in: true,
    privacy: 'standard',
  };
}

const yesNoUnsure = [
  { value: 'yes', label: 'Yes' },
  { value: 'no', label: 'No' },
  { value: 'not_sure', label: 'Not sure' },
];

const previewQuestions = [
  question('guest_name', 'short_text', 'What is your full name?', {
    required: true,
    sortOrder: 10,
  }),
  question('guest_email', 'short_text', 'What is the best email for you?', {
    required: true,
    sortOrder: 20,
    helpText: 'This is for episode coordination and is not published.',
  }),
  question(
    'guest_title_affiliation',
    'short_text',
    'What title, role, or affiliation should we use?',
    { required: true, sortOrder: 30 }
  ),
  question('guest_bio', 'long_text', 'Share a short biography.', {
    required: true,
    sortOrder: 40,
    helpText: 'A concise third-person biography works best for show notes.',
  }),
  question(
    'public_profiles_available',
    'single_choice',
    'Do you have a website or public social profiles we may include?',
    {
      required: true,
      sortOrder: 50,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No public profiles' },
      ],
    }
  ),
  question('website', 'short_text', 'Website', {
    sortOrder: 60,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question('instagram', 'short_text', 'Instagram handle or URL', {
    sortOrder: 70,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question(
    'social_permission',
    'single_choice',
    'May we tag you and use your public profile information to promote the episode?',
    {
      required: true,
      sortOrder: 80,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'check_first', label: 'Please check with me first' },
      ],
    }
  ),
  question(
    'topics',
    'long_text',
    'What topics, stories, or takeaways would you most like to cover?',
    { required: true, sortOrder: 90 }
  ),
  question(
    'guest_notes',
    'long_text',
    'Anything else the host or producer should know?',
    {
      sortOrder: 100,
      helpText:
        'You can include pronunciation, accessibility, privacy, or recording considerations.',
    }
  ),
  question(
    'close_call',
    'single_choice',
    'Is there a close call or incident you may want to discuss?',
    {
      required: true,
      sortOrder: 110,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'maybe', label: 'Maybe' },
      ],
    }
  ),
  question(
    'close_call_details',
    'long_text',
    'Tell us a little about the close call or incident.',
    {
      required: true,
      sortOrder: 120,
      showWhen: { key: 'close_call', values: ['yes', 'maybe'] },
    }
  ),
  question(
    'high_speed_internet',
    'single_choice',
    'Will you have a stable high-speed internet connection for recording?',
    { required: true, sortOrder: 130, options: yesNoUnsure }
  ),
  question(
    'external_microphone',
    'single_choice',
    'Will you have a dedicated microphone for the interview?',
    { required: true, sortOrder: 140, options: yesNoUnsure }
  ),
  question(
    'over_ear_headphones',
    'single_choice',
    'Will you have over-ear or wired headphones for recording?',
    { required: true, sortOrder: 150, options: yesNoUnsure }
  ),
  question(
    'quiet_recording_place',
    'single_choice',
    'Will you have a quiet, private place to record?',
    { required: true, sortOrder: 160, options: yesNoUnsure }
  ),
  question(
    'mic_kit_shipping_needed',
    'single_choice',
    'Would you like an Avalanche Hour microphone kit shipped to you?',
    {
      required: true,
      sortOrder: 170,
      options: [
        { value: 'yes', label: 'Yes, please send a kit' },
        { value: 'no', label: 'No, I can arrange equipment' },
        { value: 'not_sure', label: 'I would like to discuss it' },
      ],
      showWhen: {
        any: [
          { key: 'external_microphone', values: ['no', 'not_sure'] },
          { key: 'over_ear_headphones', values: ['no', 'not_sure'] },
        ],
      },
    }
  ),
  question('shipping_recipient_name', 'short_text', 'Recipient name', {
    required: true,
    sortOrder: 180,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('shipping_address_line_1', 'short_text', 'Street address', {
    required: true,
    sortOrder: 190,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('photo_credit', 'short_text', 'Photo credit, if applicable', {
    sortOrder: 200,
  }),
];

previewQuestions
  .filter((item) => item.key.startsWith('shipping_'))
  .forEach((item) => {
    item.privacy = 'restricted_shipping';
  });

const uploadSlots = [
  {
    key: 'resume',
    prompt: 'Resume or CV',
    help_text: 'Optional background material for the episode team.',
    visible: true,
    required: false,
    min_count: 1,
    max_count: 1,
    sort_order: 10,
  },
  {
    key: 'photo',
    prompt: 'Guest photos',
    help_text:
      'Share 5–6 high-quality images, including one clear portrait. The episode team will choose the final three.',
    visible: true,
    required: true,
    min_count: 5,
    max_count: 10,
    sort_order: 20,
  },
];

const previewData = {
  episode: {
    title: 'Field Notes: Reading a Changing Snowpack',
    recording_date: '2026-08-18',
  },
  questionnaire: {
    title: 'The Avalanche Hour Podcast Guest Questionnaire',
    introduction:
      'This questionnaire helps the episode team prepare for your conversation, coordinate recording needs, and build accurate show notes and promotion.',
    questions: previewQuestions,
    upload_slots: uploadSlots,
    scheduling: {
      pre_interview: {
        url: 'https://example.com/pre-interview',
        prompt: 'Schedule a pre-interview chat and sound check',
        required: true,
      },
      interview: {
        url: 'https://example.com/interview',
        prompt: 'Schedule the interview recording',
        required: true,
      },
    },
  },
  answers: {
    public_profiles_available: 'yes',
    close_call: 'maybe',
    external_microphone: 'not_sure',
    over_ear_headphones: 'yes',
  },
  upload_slots: {
    photo: {
      count: 1,
      assets: [
        {
          asset_id: 'preview-photo',
          file_name: 'guest-portrait.jpg',
          size_bytes: 2_480_000,
        },
      ],
    },
  },
};

export async function getServerSideProps({ req }) {
  const forwardedHost = String(req.headers['x-forwarded-host'] || '')
    .split(',')[0]
    .trim();
  const directHost = String(req.headers.host || '').trim();
  const localHostPattern = /^(localhost|127\.0\.0\.1)(:\d+)?$/i;
  const isLocalPreview =
    localHostPattern.test(directHost) &&
    (!forwardedHost || localHostPattern.test(forwardedHost));

  if (process.env.NODE_ENV === 'production' || !isLocalPreview) {
    return { notFound: true };
  }

  return { props: {} };
}

export default function GuestQuestionnairePreviewPage() {
  return (
    <>
      <Head>
        <title>Guest Questionnaire Preview | The Avalanche Hour</title>
        <meta name="robots" content="noindex,nofollow,noarchive" />
      </Head>
      <GuestQuestionnaireForm previewData={previewData} />
    </>
  );
}
