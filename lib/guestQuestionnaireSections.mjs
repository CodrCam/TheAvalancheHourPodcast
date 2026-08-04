export const GUEST_QUESTIONNAIRE_SECTIONS = Object.freeze([
  {
    id: 'about',
    label: 'About you',
    builder_label: 'About the guest',
    description: 'Identity, contact details, affiliation, and biography.',
    keys: [
      'guest_name',
      'guest_email',
      'guest_title_affiliation',
      'guest_pronouns',
      'guest_bio',
    ],
  },
  {
    id: 'public_links',
    label: 'Public links',
    builder_label: 'Public links',
    description: 'Website, social profiles, projects, research, and tagging.',
    keys: [
      'public_profiles_available',
      'website',
      'instagram',
      'facebook',
      'linkedin',
      'x_twitter',
      'youtube',
      'tiktok',
      'other_social_profiles',
      'project_links',
      'research_links',
      'social_permission',
    ],
  },
  {
    id: 'conversation',
    label: 'Conversation prep',
    builder_label: 'Conversation prep',
    description: 'Topics, close calls, interview boundaries, and video consent.',
    keys: [
      'topics',
      'guest_notes',
      'close_call',
      'close_call_details',
      'video_clip_consent',
    ],
  },
  {
    id: 'recording',
    label: 'Recording setup',
    builder_label: 'Recording setup',
    description:
      'Four quick readiness checks; equipment follow-up appears only when needed.',
    keys: [
      'high_speed_internet',
      'external_microphone',
      'over_ear_headphones',
      'quiet_recording_place',
      'own_equipment_description',
      'recording_experience',
    ],
  },
  {
    id: 'equipment',
    label: 'Equipment and shipping',
    builder_label: 'Equipment and shipping',
    description:
      'A microphone-kit option and restricted delivery details appear only when the setup needs support.',
    keys: [
      'mic_kit_shipping_needed',
      'shipping_recipient_name',
      'shipping_address_line_1',
      'shipping_address_line_2',
      'shipping_city',
      'shipping_region',
      'shipping_postal_code',
      'shipping_country',
      'shipping_phone',
    ],
  },
  {
    id: 'files_context',
    label: 'Files and credits',
    builder_label: 'Files and credits',
    description: 'Photo-credit information that travels with guest assets.',
    keys: ['photo_credit'],
  },
]);

const SECTION_BY_KEY = new Map(
  GUEST_QUESTIONNAIRE_SECTIONS.flatMap((section) =>
    section.keys.map((key) => [key, section.id])
  )
);

export function buildGuestQuestionnaireSections(
  questions = [],
  { includeEmptyAdditional = false, builderLabels = false } = {}
) {
  const sections = new Map(
    GUEST_QUESTIONNAIRE_SECTIONS.map((section) => [
      section.id,
      {
        ...section,
        label: builderLabels ? section.builder_label : section.label,
        questions: [],
      },
    ])
  );
  const additional = {
    id: 'additional',
    label: 'Additional questions',
    builder_label: 'Additional questions',
    description: 'Episode-specific questions from the host or producer.',
    questions: [],
  };

  questions.forEach((question) => {
    const sectionId = SECTION_BY_KEY.get(question.key);
    if (question.built_in && sectionId && sections.has(sectionId)) {
      sections.get(sectionId).questions.push(question);
    } else {
      additional.questions.push(question);
    }
  });

  return [...sections.values(), additional].filter(
    (section) =>
      section.questions.length ||
      (includeEmptyAdditional && section.id === 'additional')
  );
}
