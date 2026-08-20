import crypto from 'crypto';
import {
  getGuestProfileFieldErrors,
  isValidGuestHttpsUrl,
  isValidGuestProfileEntry,
} from './episodeStudioPresentation.mjs';
import {
  GUEST_RECORDING_PLAN_TASK_ID,
  MICROPHONE_PLAN_TASK_ID,
} from './episodeProductionPlan.mjs';
import { guestQuestionIsActive } from './guestQuestionnaireConditions.mjs';
import { normalizeGuestQuestionnaireUploadBudget } from './guestQuestionnaireUploadBudget.mjs';

export const GUEST_QUESTIONNAIRE_SCHEMA_VERSION = 2;
export const GUEST_QUESTION_TYPES = Object.freeze([
  'short_text',
  'long_text',
  'single_choice',
]);
export const GUEST_QUESTION_PRIVACY = Object.freeze({
  STANDARD: 'standard',
  SHIPPING: 'restricted_shipping',
});

const MAX_QUESTIONS = 60;
const MAX_CUSTOM_QUESTIONS = 20;
const MAX_TOTAL_ANSWER_CHARACTERS = 24000;
const RECORDING_DECISION_TREE_SCHEMA_VERSION = 2;
const LEGACY_BUILT_IN_PROMPTS = Object.freeze({
  external_microphone: 'Do you have an external microphone you can use?',
  over_ear_headphones:
    'Do you have over-ear or wired headphones for recording?',
});
const RECORDING_DECISION_TREE_OPTION_KEYS = new Set([
  'external_microphone',
  'over_ear_headphones',
  'quiet_recording_place',
  'mic_kit_shipping_needed',
]);
const GUEST_MIC_PLAN_CHOICES = new Set([
  'request_kit',
  'use_own_equipment',
  'needs_follow_up',
]);
const GUEST_READINESS_VALUES = new Set(['yes', 'no', 'not_sure']);

function cleanText(value, maxLength = 4000) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanId(value, maxLength = 120) {
  return cleanText(value, maxLength)
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

export function normalizeProjectedGuestMicKitPlan(value = {}) {
  const source = plainObject(value);
  const readiness = plainObject(source.readiness);
  const choice = GUEST_MIC_PLAN_CHOICES.has(source.choice)
    ? source.choice
    : '';
  const cleanReadiness = (key) =>
    GUEST_READINESS_VALUES.has(readiness[key]) ? readiness[key] : '';
  return {
    guest_name: cleanText(source.guest_name, 180),
    choice,
    request_id:
      ['request_kit', 'needs_follow_up'].includes(choice)
        ? cleanText(source.request_id, 120)
        : '',
    equipment_note: cleanText(source.equipment_note, 800),
    response_revision: Math.max(
      0,
      Math.trunc(Number(source.response_revision) || 0)
    ),
    readiness: {
      internet: cleanReadiness('internet'),
      microphone: cleanReadiness('microphone'),
      headphones: cleanReadiness('headphones'),
      quiet_place: cleanReadiness('quiet_place'),
    },
  };
}

function guestMicKitEvidenceFingerprint(value = {}) {
  const plan = normalizeProjectedGuestMicKitPlan(value);
  // Identity, linkage, and response-revision changes do not alter the
  // recording setup that the host approved.
  return JSON.stringify({
    choice: plan.choice,
    equipment_note: plan.equipment_note,
    readiness: plan.readiness,
  });
}

function reopenCompletedProjectionTask(task = {}) {
  if (!['complete', 'waived'].includes(task.status)) return task;
  return {
    ...task,
    status: 'in_progress',
    completed_at: '',
    completed_by_person_id: '',
    completed_by_name: '',
  };
}

function cleanIsoDate(value) {
  const text = cleanText(value, 50);
  const parsed = new Date(text);
  return text && !Number.isNaN(parsed.getTime())
    ? parsed.toISOString()
    : '';
}

function cleanHttpsUrl(value) {
  const text = cleanText(value, 1200);
  if (!text) return '';
  try {
    const url = new URL(text);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.toString()
      : '';
  } catch {
    return '';
  }
}

function question(
  key,
  type,
  prompt,
  {
    helpText = '',
    required = false,
    visible = true,
    sortOrder = 0,
    options = [],
    privacy = GUEST_QUESTION_PRIVACY.STANDARD,
    showWhen = null,
  } = {}
) {
  return {
    key,
    built_in: true,
    type,
    prompt,
    help_text: helpText,
    required,
    visible,
    sort_order: sortOrder,
    options,
    privacy,
    show_when: showWhen,
  };
}

export const DEFAULT_GUEST_QUESTIONNAIRE_QUESTIONS = Object.freeze([
  question('guest_name', 'short_text', 'What is your full name?', {
    required: true,
    sortOrder: 10,
  }),
  question('guest_email', 'short_text', 'What is the best email for you?', {
    helpText: 'This is for episode coordination and is not published.',
    required: true,
    sortOrder: 20,
  }),
  question(
    'guest_title_affiliation',
    'short_text',
    'What title, role, or affiliation should we use?',
    { required: true, sortOrder: 30 }
  ),
  question('guest_pronouns', 'short_text', 'What pronouns do you use?', {
    sortOrder: 40,
  }),
  question('guest_bio', 'long_text', 'Share a short biography.', {
    helpText: 'A concise third-person biography works best for show notes.',
    required: true,
    sortOrder: 50,
  }),
  question(
    'public_profiles_available',
    'single_choice',
    'Do you have a website or public social profiles we may include?',
    {
      required: true,
      sortOrder: 55,
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
  question('facebook', 'short_text', 'Facebook URL', {
    sortOrder: 80,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question('linkedin', 'short_text', 'LinkedIn URL', {
    sortOrder: 90,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question('x_twitter', 'short_text', 'X / Twitter handle or URL', {
    sortOrder: 100,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question('youtube', 'short_text', 'YouTube URL', {
    sortOrder: 110,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question('tiktok', 'short_text', 'TikTok handle or URL', {
    sortOrder: 120,
    showWhen: { key: 'public_profiles_available', equals: 'yes' },
  }),
  question(
    'other_social_profiles',
    'long_text',
    'Other public social profiles',
    {
      helpText: 'Add one handle or link per line.',
      sortOrder: 130,
      showWhen: { key: 'public_profiles_available', equals: 'yes' },
    }
  ),
  question(
    'project_links',
    'long_text',
    'What projects or links should we mention?',
    { helpText: 'Add one project or link per line.', sortOrder: 140 }
  ),
  question(
    'research_links',
    'long_text',
    'What research, articles, or background links should we review?',
    { helpText: 'Add one source or link per line.', sortOrder: 145 }
  ),
  question(
    'topics',
    'long_text',
    'What topics, stories, or takeaways would you most like to cover?',
    { required: true, sortOrder: 150 }
  ),
  question(
    'social_permission',
    'single_choice',
    'May we tag you and use your public profile information to promote the episode?',
    {
      required: true,
      sortOrder: 160,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'check_first', label: 'Please check with me first' },
      ],
    }
  ),
  question(
    'guest_notes',
    'long_text',
    'Anything else the host or producer should know?',
    {
      helpText:
        'You can include pronunciation, accessibility, privacy, or recording considerations.',
      sortOrder: 170,
    }
  ),
  question(
    'close_call',
    'single_choice',
    'Is there a close call or incident you may want to discuss?',
    {
      required: true,
      sortOrder: 180,
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
      helpText:
        'A short overview helps the host prepare; you can decide what to share on air.',
      required: true,
      sortOrder: 190,
      showWhen: { key: 'close_call', values: ['yes', 'maybe'] },
    }
  ),
  question(
    'high_speed_internet',
    'single_choice',
    'Will you have a stable high-speed internet connection for recording?',
    {
      required: true,
      sortOrder: 200,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'not_sure', label: 'Not sure' },
      ],
    }
  ),
  question(
    'external_microphone',
    'single_choice',
    'Will you have a dedicated microphone for the interview?',
    {
      helpText:
        'A dedicated USB or XLR microphone is different from the microphone built into a computer, phone, or earbuds.',
      required: true,
      sortOrder: 210,
      options: [
        { value: 'yes', label: 'Yes—I have a dedicated microphone' },
        { value: 'no', label: 'No—I would need one' },
        {
          value: 'not_sure',
          label: 'I am not sure whether my microphone is suitable',
        },
      ],
    }
  ),
  question(
    'over_ear_headphones',
    'single_choice',
    'Will you have over-ear or wired headphones for recording?',
    {
      helpText:
        'Headphones prevent the conversation from feeding back into the recording. Do not count laptop or phone speakers.',
      required: true,
      sortOrder: 220,
      options: [
        { value: 'yes', label: 'Yes—I have suitable headphones' },
        { value: 'no', label: 'No—I would need headphones' },
        { value: 'not_sure', label: 'I am not sure' },
      ],
    }
  ),
  question(
    'quiet_recording_place',
    'single_choice',
    'Will you have a quiet place where you can close the door?',
    {
      required: true,
      sortOrder: 230,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
        { value: 'not_sure', label: 'Not sure yet' },
      ],
    }
  ),
  question(
    'own_equipment_description',
    'long_text',
    'Describe the microphone, headphones, and computer or phone you plan to use.',
    { visible: false, sortOrder: 240 }
  ),
  question(
    'recording_experience',
    'long_text',
    'Tell us about any podcast or remote-recording experience you have.',
    { sortOrder: 250 }
  ),
  question(
    'video_clip_consent',
    'single_choice',
    'May we record and use short video clips from the interview?',
    {
      required: true,
      sortOrder: 260,
      options: [
        { value: 'yes', label: 'Yes' },
        { value: 'no', label: 'No' },
      ],
    }
  ),
  question(
    'photo_credit',
    'short_text',
    'How should the guest photos be credited?',
    {
      helpText:
        'Include the photographer, organization, or “courtesy of” credit that should appear with the images.',
      required: true,
      sortOrder: 270,
    }
  ),
  question(
    'mic_kit_shipping_needed',
    'single_choice',
    'Do you need an Avalanche Hour microphone kit shipped to you?',
    {
      helpText:
        'This stays visible until the full recording setup is confirmed. The producer will follow up early if any part still needs support.',
      required: true,
      sortOrder: 300,
      options: [
        { value: 'yes', label: 'Yes—please arrange a kit' },
        {
          value: 'unsure',
          label: 'Please contact me so we can decide',
        },
        { value: 'no', label: 'No—I will arrange a suitable setup' },
      ],
      showWhen: {
        any: [
          { key: 'high_speed_internet', answered: false },
          { key: 'external_microphone', answered: false },
          { key: 'over_ear_headphones', answered: false },
          { key: 'quiet_recording_place', answered: false },
          { key: 'high_speed_internet', values: ['no', 'not_sure'] },
          { key: 'external_microphone', values: ['no', 'not_sure'] },
          { key: 'over_ear_headphones', values: ['no', 'not_sure'] },
          { key: 'quiet_recording_place', values: ['no', 'not_sure'] },
        ],
      },
    }
  ),
  question(
    'shipping_recipient_name',
    'short_text',
    'Shipping recipient name',
    {
      required: true,
      sortOrder: 310,
      privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
      showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
    }
  ),
  question(
    'shipping_address_line_1',
    'short_text',
    'Shipping address',
    {
      required: true,
      sortOrder: 320,
      privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
      showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
    }
  ),
  question(
    'shipping_address_line_2',
    'short_text',
    'Apartment, suite, or unit',
    {
      sortOrder: 330,
      privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
      showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
    }
  ),
  question('shipping_city', 'short_text', 'City', {
    required: true,
    sortOrder: 340,
    privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('shipping_region', 'short_text', 'State, province, or region', {
    required: true,
    sortOrder: 350,
    privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('shipping_postal_code', 'short_text', 'Postal code', {
    required: true,
    sortOrder: 360,
    privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('shipping_country', 'short_text', 'Country', {
    required: true,
    sortOrder: 370,
    privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
  question('shipping_phone', 'short_text', 'Phone number for the carrier', {
    sortOrder: 380,
    privacy: GUEST_QUESTION_PRIVACY.SHIPPING,
    showWhen: { key: 'mic_kit_shipping_needed', equals: 'yes' },
  }),
]);

const BUILT_INS_BY_KEY = new Map(
  DEFAULT_GUEST_QUESTIONNAIRE_QUESTIONS.map((item) => [item.key, item])
);

export const DEFAULT_GUEST_UPLOAD_SLOTS = Object.freeze([
  {
    key: 'resume',
    prompt: 'Resume or background document',
    help_text:
      'Share a current resume, CV, or background document that helps the host prepare.',
    required: false,
    visible: true,
    sort_order: 900,
    status: 'enabled',
    min_count: 1,
    max_count: 1,
  },
  {
    key: 'photo',
    prompt: 'Guest photos and photo credit',
    help_text:
      'Provide 5–6 high-resolution photos, including at least one clear portrait, and include the photographer or credit information.',
    required: true,
    visible: true,
    sort_order: 910,
    status: 'enabled',
    min_count: 5,
    max_count: 6,
  },
]);

export class GuestQuestionnaireValidationError extends Error {
  constructor(message, code = 'GUEST_QUESTIONNAIRE_INVALID', details = []) {
    super(message);
    this.name = 'GuestQuestionnaireValidationError';
    this.code = code;
    this.details = details;
  }
}

export function createGuestQuestionKey() {
  return `custom_${crypto.randomUUID().replace(/-/g, '')}`;
}

function normalizeOptions(value, fallback = []) {
  const options = (Array.isArray(value) ? value : fallback)
    .slice(0, 12)
    .map((item) => {
      const source = plainObject(item);
      const label = cleanText(source.label, 180);
      const optionValue =
        cleanId(source.value || label, 80) ||
        `option_${crypto.randomUUID().slice(0, 8)}`;
      return label ? { value: optionValue, label } : null;
    })
    .filter(Boolean);
  const seen = new Set();
  return options.filter((option) => {
    if (seen.has(option.value)) return false;
    seen.add(option.value);
    return true;
  });
}

function normalizeBuiltInQuestion(
  value,
  template,
  { sourceSchemaVersion = GUEST_QUESTIONNAIRE_SCHEMA_VERSION } = {}
) {
  const source = plainObject(value);
  const upgradesRecordingDecisionTree =
    Number(sourceSchemaVersion || 1) < RECORDING_DECISION_TREE_SCHEMA_VERSION;
  const options =
    template.type === 'single_choice'
      ? normalizeOptions(source.options, template.options).filter((option) =>
          template.options.some(
            (candidate) => candidate.value === option.value
          )
        )
      : [];
  const optionLabels = new Map(
    options.map((option) => [option.value, option.label])
  );
  const legacyPrompt = LEGACY_BUILT_IN_PROMPTS[template.key];
  const sourcePrompt = cleanText(source.prompt, 500);
  const prompt =
    upgradesRecordingDecisionTree &&
    legacyPrompt &&
    (!sourcePrompt || sourcePrompt === legacyPrompt)
      ? template.prompt
      : cleanText(source.prompt ?? template.prompt, 500);
  return {
    ...template,
    prompt,
    help_text: cleanText(
      source.help_text ?? template.help_text,
      1200
    ),
    required:
      typeof source.required === 'boolean'
        ? source.required
        : template.required,
    visible:
      upgradesRecordingDecisionTree &&
      template.key === 'own_equipment_description'
        ? template.visible
        : typeof source.visible === 'boolean'
        ? source.visible
        : template.visible,
    sort_order: Number.isFinite(Number(source.sort_order))
      ? Math.max(0, Math.min(10000, Math.trunc(Number(source.sort_order))))
      : template.sort_order,
    options:
      template.type === 'single_choice'
        ? template.options.map((option) => ({
            ...option,
            label:
              upgradesRecordingDecisionTree &&
              RECORDING_DECISION_TREE_OPTION_KEYS.has(template.key)
                ? option.label
                : optionLabels.get(option.value) || option.label,
          }))
        : [],
  };
}

function normalizeCustomQuestion(value, fallbackKey = '') {
  const source = plainObject(value);
  const key = cleanId(source.key || fallbackKey);
  const type = GUEST_QUESTION_TYPES.includes(source.type)
    ? source.type
    : 'short_text';
  return {
    key,
    built_in: false,
    type,
    prompt: cleanText(source.prompt, 500),
    help_text: cleanText(source.help_text, 1200),
    required: source.required === true,
    visible: source.visible !== false,
    sort_order: Number.isFinite(Number(source.sort_order))
      ? Math.max(0, Math.min(10000, Math.trunc(Number(source.sort_order))))
      : 500,
    options:
      type === 'single_choice' ? normalizeOptions(source.options) : [],
    privacy: GUEST_QUESTION_PRIVACY.STANDARD,
    show_when: null,
  };
}

function sortQuestions(questions) {
  return [...questions].sort(
    (a, b) =>
      a.sort_order - b.sort_order ||
      Number(a.built_in) - Number(b.built_in) ||
      a.key.localeCompare(b.key)
  );
}

function validateQuestion(questionValue) {
  const item = plainObject(questionValue);
  if (!item.key || !item.prompt || !GUEST_QUESTION_TYPES.includes(item.type)) {
    throw new GuestQuestionnaireValidationError(
      'Every guest question needs a prompt and supported answer type.',
      'GUEST_QUESTION_INVALID'
    );
  }
  if (
    item.type === 'single_choice' &&
    (!Array.isArray(item.options) || item.options.length < 2)
  ) {
    throw new GuestQuestionnaireValidationError(
      `“${item.prompt}” needs at least two answer choices.`,
      'GUEST_QUESTION_OPTIONS_INVALID'
    );
  }
  return item;
}

function normalizeSchedulingEntry(value = {}, fallback = {}, defaults = {}) {
  const source = plainObject(value);
  const previous = plainObject(fallback);
  const suppliedUrl =
    Object.prototype.hasOwnProperty.call(source, 'url')
      ? cleanText(source.url, 1200)
      : cleanText(previous.url, 1200);
  const url = cleanHttpsUrl(suppliedUrl);
  if (suppliedUrl && !url) {
    throw new GuestQuestionnaireValidationError(
      'The scheduling link must be a secure HTTPS URL.',
      'GUEST_SCHEDULING_URL_INVALID'
    );
  }
  return {
    url,
    prompt: cleanText(
      source.prompt ??
        previous.prompt ??
        defaults.prompt,
      500
    ),
    required:
      typeof source.required === 'boolean'
        ? source.required
        : previous.required !== false,
  };
}

function normalizeScheduling(value = {}, fallback = {}) {
  const source = plainObject(value);
  const previous = plainObject(fallback);
  const legacySource = Object.prototype.hasOwnProperty.call(source, 'url')
    ? source
    : {};
  const legacyPrevious = Object.prototype.hasOwnProperty.call(previous, 'url')
    ? previous
    : {};
  return {
    pre_interview: normalizeSchedulingEntry(
      source.pre_interview,
      previous.pre_interview,
      {
        prompt:
          'I used the pre-interview and sound-check link or coordinated that time with the host.',
      }
    ),
    interview: normalizeSchedulingEntry(
      source.interview || legacySource,
      previous.interview || legacyPrevious,
      {
        prompt:
          'I used the interview scheduling link or coordinated the recording time with the host.',
      }
    ),
  };
}

function normalizeUploadSlots(value = [], fallback = DEFAULT_GUEST_UPLOAD_SLOTS) {
  const sources = new Map(
    (Array.isArray(value) ? value : []).map((slot) => [
      cleanId(slot?.key),
      slot,
    ])
  );
  return fallback.map((template) => {
    const source = plainObject(sources.get(template.key));
    return {
      ...template,
      prompt: cleanText(source.prompt ?? template.prompt, 500),
      help_text: cleanText(
        source.help_text ?? template.help_text,
        1200
      ),
      required:
        typeof source.required === 'boolean'
          ? source.required
          : template.required,
      visible:
        typeof source.visible === 'boolean'
          ? source.visible
          : template.visible,
      sort_order: Number.isFinite(Number(source.sort_order))
        ? Math.max(0, Math.min(10000, Math.trunc(Number(source.sort_order))))
        : template.sort_order,
      status: source.status === 'disabled' ? 'disabled' : 'enabled',
      min_count: Number.isFinite(Number(source.min_count))
        ? Math.max(1, Math.min(10, Math.trunc(Number(source.min_count))))
        : template.min_count,
      max_count: Number.isFinite(Number(source.max_count))
        ? Math.max(1, Math.min(10, Math.trunc(Number(source.max_count))))
        : template.max_count,
    };
  }).map((slot) => ({
    ...slot,
    max_count: Math.max(slot.min_count, slot.max_count),
  }));
}

export function createDefaultGuestQuestionnaire(episodeId = '') {
  return {
    schema_version: GUEST_QUESTIONNAIRE_SCHEMA_VERSION,
    episode_id: cleanText(episodeId, 180),
    title: 'Guest preparation form',
    introduction:
      'Please share the details the host and producer need to prepare, record, and promote your episode.',
    scheduling: normalizeScheduling({}, {}),
    questions: sortQuestions(
      DEFAULT_GUEST_QUESTIONNAIRE_QUESTIONS.map((item) => ({
        ...item,
        options: item.options.map((option) => ({ ...option })),
        show_when: item.show_when ? { ...item.show_when } : null,
      }))
    ),
    upload_slots: DEFAULT_GUEST_UPLOAD_SLOTS.map((slot) => ({ ...slot })),
    link: {
      status: 'not_issued',
      token_jti_hash: '',
      issued_at: '',
      expires_at: '',
      revoked_at: '',
      issued_by_person_id: '',
    },
    response: {
      status: 'not_started',
      response_id: '',
      revision: 0,
      answers: {},
      scheduling_acknowledged: false,
      scheduling_acknowledgements: {
        pre_interview: false,
        interview: false,
      },
      upload_slots: {
        resume: { status: 'not_provided', count: 0, asset: null },
        photo: { status: 'not_provided', count: 0, assets: [] },
      },
      submission_id_hash: '',
      submission_payload_hash: '',
      submitted_at: '',
      updated_at: '',
    },
    autofill: {
      response_revision: 0,
      profile: {},
      notes: '',
      package: {
        show_notes: '',
        social_copy: '',
        credits: '',
      },
      production: {
        guest_recording_plan_note: '',
        guest_mic_kit_plan: normalizeProjectedGuestMicKitPlan(),
      },
      applied_at: '',
      applied_by_person_id: '',
    },
    upload_budget: normalizeGuestQuestionnaireUploadBudget(),
    created_at: '',
    updated_at: '',
    updated_by_person_id: '',
  };
}

export function mergeGuestQuestionnaireConfiguration(
  currentValue,
  updateValue = {}
) {
  const current = normalizeGuestQuestionnaireRecord(currentValue);
  const update = plainObject(updateValue);
  const sourceQuestions = Array.isArray(update.questions)
    ? update.questions
    : current.questions;
  if (sourceQuestions.length > MAX_QUESTIONS) {
    throw new GuestQuestionnaireValidationError(
      `A guest questionnaire can contain at most ${MAX_QUESTIONS} questions.`,
      'GUEST_QUESTION_LIMIT'
    );
  }
  const incomingByKey = new Map();
  const customQuestions = [];
  for (const source of sourceQuestions) {
    const suppliedKey = cleanId(source?.key);
    if (BUILT_INS_BY_KEY.has(suppliedKey)) {
      incomingByKey.set(suppliedKey, source);
      continue;
    }
    const key = suppliedKey || createGuestQuestionKey();
    if (!key.startsWith('custom_')) {
      throw new GuestQuestionnaireValidationError(
        'Custom guest-question keys must begin with “custom_”.',
        'GUEST_QUESTION_KEY_INVALID'
      );
    }
    if (incomingByKey.has(key)) {
      throw new GuestQuestionnaireValidationError(
        'Guest-question keys must be unique.',
        'GUEST_QUESTION_KEY_DUPLICATE'
      );
    }
    incomingByKey.set(key, source);
    customQuestions.push(
      validateQuestion(normalizeCustomQuestion(source, key))
    );
  }
  if (customQuestions.length > MAX_CUSTOM_QUESTIONS) {
    throw new GuestQuestionnaireValidationError(
      `A guest questionnaire can contain at most ${MAX_CUSTOM_QUESTIONS} custom questions.`,
      'GUEST_CUSTOM_QUESTION_LIMIT'
    );
  }

  const builtIns = DEFAULT_GUEST_QUESTIONNAIRE_QUESTIONS.map((template) =>
    validateQuestion(
      normalizeBuiltInQuestion(
        incomingByKey.get(template.key) ||
          current.questions.find((item) => item.key === template.key),
        template
      )
    )
  );
  const title = cleanText(update.title ?? current.title, 300);
  if (!title) {
    throw new GuestQuestionnaireValidationError(
      'The guest questionnaire needs a title.',
      'GUEST_QUESTIONNAIRE_TITLE_REQUIRED'
    );
  }
  return {
    ...current,
    title,
    introduction: cleanText(
      update.introduction ?? current.introduction,
      3000
    ),
    scheduling: normalizeScheduling(
      update.scheduling,
      current.scheduling
    ),
    questions: sortQuestions([...builtIns, ...customQuestions]),
    upload_slots: normalizeUploadSlots(
      update.upload_slots,
      current.upload_slots
    ),
  };
}

function normalizeLink(value = {}) {
  const source = plainObject(value);
  const status = ['not_issued', 'active', 'revoked'].includes(source.status)
    ? source.status
    : 'not_issued';
  return {
    status,
    token_jti_hash: cleanText(source.token_jti_hash, 128),
    issued_at: cleanIsoDate(source.issued_at),
    expires_at: cleanIsoDate(source.expires_at),
    revoked_at: cleanIsoDate(source.revoked_at),
    issued_by_person_id: cleanId(source.issued_by_person_id, 180),
  };
}

function normalizeUploadAsset(value = {}) {
  const source = plainObject(value);
  const assetId = cleanId(source.asset_id, 180);
  if (!assetId) return null;
  return {
    asset_id: assetId,
    status: ['pending', 'uploaded', 'rejected'].includes(source.status)
      ? source.status
      : 'uploaded',
    file_name: cleanText(source.file_name, 300),
    content_type: cleanText(source.content_type, 180),
    size_bytes: Math.max(0, Math.trunc(Number(source.size_bytes) || 0)),
    uploaded_at: cleanIsoDate(source.uploaded_at),
    object_key: cleanText(source.object_key, 1000),
    object_version_id: cleanText(source.object_version_id, 1000),
  };
}

function uploadStatus(assets = []) {
  const uploadedCount = assets.filter(
    (asset) => asset.status === 'uploaded'
  ).length;
  if (uploadedCount) return 'uploaded';
  if (assets.some((asset) => asset.status === 'pending')) return 'pending';
  if (assets.some((asset) => asset.status === 'rejected')) return 'rejected';
  return 'not_provided';
}

function normalizeUploadResponse(value = {}) {
  const source = plainObject(value);
  const resumeSource = plainObject(source.resume);
  const resumeAsset = normalizeUploadAsset(
    resumeSource.asset ||
      (resumeSource.asset_id ? resumeSource : null)
  );
  const photoSource = plainObject(source.photo);
  const photoAssets = (
    Array.isArray(photoSource.assets)
      ? photoSource.assets
      : photoSource.asset_id
        ? [photoSource]
        : []
  )
    .map(normalizeUploadAsset)
    .filter(Boolean)
    .slice(0, 10);
  return {
    resume: {
      status: uploadStatus(resumeAsset ? [resumeAsset] : []),
      count: resumeAsset?.status === 'uploaded' ? 1 : 0,
      asset: resumeAsset,
    },
    photo: {
      status: uploadStatus(photoAssets),
      count: photoAssets.filter((asset) => asset.status === 'uploaded').length,
      assets: photoAssets,
    },
  };
}

function safeUploadAsset(value) {
  const asset = normalizeUploadAsset(value);
  if (!asset) return null;
  return {
    asset_id: asset.asset_id,
    status: asset.status,
    file_name: asset.file_name,
    content_type: asset.content_type,
    size_bytes: asset.size_bytes,
    uploaded_at: asset.uploaded_at,
  };
}

function safeUploadResponse(value = {}) {
  const uploads = normalizeUploadResponse(value);
  return {
    resume: {
      status: uploads.resume.status,
      count: uploads.resume.count,
      asset: safeUploadAsset(uploads.resume.asset),
    },
    photo: {
      status: uploads.photo.status,
      count: uploads.photo.count,
      assets: uploads.photo.assets.map(safeUploadAsset).filter(Boolean),
    },
  };
}

function normalizeAnswers(value, questions) {
  const source = plainObject(value);
  const questionKeys = new Set(questions.map((item) => item.key));
  const answers = {};
  for (const [keyValue, answerValue] of Object.entries(source).slice(0, 60)) {
    const key = cleanId(keyValue);
    if (!key || !questionKeys.has(key)) continue;
    answers[key] = cleanText(answerValue, 6000);
  }
  return answers;
}

function normalizeResponse(value, questions) {
  const source = plainObject(value);
  const revision = Math.max(0, Math.trunc(Number(source.revision) || 0));
  const acknowledgements = plainObject(
    source.scheduling_acknowledgements
  );
  const legacyAcknowledged = source.scheduling_acknowledged === true;
  return {
    status:
      source.status === 'submitted' && revision > 0
        ? 'submitted'
        : source.status === 'update_requested' && revision > 0
          ? 'update_requested'
        : 'not_started',
    response_id: cleanId(source.response_id, 180),
    revision,
    answers: normalizeAnswers(source.answers, questions),
    scheduling_acknowledged:
      legacyAcknowledged ||
      (acknowledgements.pre_interview === true &&
        acknowledgements.interview === true),
    scheduling_acknowledgements: {
      pre_interview:
        acknowledgements.pre_interview === true || legacyAcknowledged,
      interview: acknowledgements.interview === true || legacyAcknowledged,
    },
    upload_slots: normalizeUploadResponse(source.upload_slots),
    submission_id_hash: cleanText(source.submission_id_hash, 128),
    submission_payload_hash: cleanText(
      source.submission_payload_hash,
      128
    ),
    submitted_at: cleanIsoDate(source.submitted_at),
    updated_at: cleanIsoDate(source.updated_at),
  };
}

export function reopenGuestQuestionnaireResponse(
  recordValue = {},
  { now = new Date() } = {}
) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  if (record.response.status !== 'submitted') {
    throw new GuestQuestionnaireValidationError(
      'A submitted guest response is required before requesting an update.',
      'GUEST_RESPONSE_UPDATE_NOT_AVAILABLE'
    );
  }
  return {
    ...record,
    response: {
      ...record.response,
      status: 'update_requested',
      submission_id_hash: '',
      submission_payload_hash: '',
      updated_at: now.toISOString(),
    },
  };
}

export function guestQuestionnaireUpdateDraft(recordValue = {}) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  if (record.response.status !== 'update_requested') return null;
  const restrictedShippingKeys = new Set(
    record.questions
      .filter(
        (question) =>
          question.privacy === GUEST_QUESTION_PRIVACY.SHIPPING
      )
      .map((question) => question.key)
  );
  return {
    answers: Object.fromEntries(
      Object.entries(record.response.answers).filter(
        ([key]) => !restrictedShippingKeys.has(key)
      )
    ),
    scheduling_acknowledgements: {
      ...record.response.scheduling_acknowledgements,
    },
  };
}

function normalizeAutofill(value = {}) {
  const source = plainObject(value);
  const profile = plainObject(source.profile);
  const normalizedProfile = Object.fromEntries(
    Object.entries(profile)
      .slice(0, 20)
      .map(([key, item]) => [cleanId(key), cleanText(item, 6000)])
      .filter(([key]) => key && key !== 'no_public_profiles')
  );
  if (
    Object.prototype.hasOwnProperty.call(profile, 'no_public_profiles')
  ) {
    normalizedProfile.no_public_profiles =
      profile.no_public_profiles === true;
  }
  return {
    response_revision: Math.max(
      0,
      Math.trunc(Number(source.response_revision) || 0)
    ),
    profile: normalizedProfile,
    notes: cleanText(source.notes, 12000),
    package: {
      show_notes: cleanText(plainObject(source.package).show_notes, 12000),
      social_copy: cleanText(
        plainObject(source.package).social_copy,
        12000
      ),
      credits: cleanText(plainObject(source.package).credits, 12000),
    },
    production: {
      guest_recording_plan_note: cleanText(
        plainObject(source.production).guest_recording_plan_note,
        2400
      ),
      guest_mic_kit_plan: normalizeProjectedGuestMicKitPlan(
        plainObject(source.production).guest_mic_kit_plan
      ),
    },
    applied_at: cleanIsoDate(source.applied_at),
    applied_by_person_id: cleanId(source.applied_by_person_id, 180),
  };
}

export function normalizeGuestQuestionnaireRecord(value = {}) {
  const source = plainObject(value);
  const episodeId = cleanText(source.episode_id, 180);
  const defaults = createDefaultGuestQuestionnaire(episodeId);
  const sourceSchemaVersion = Math.max(
    1,
    Math.trunc(Number(source.schema_version) || 1)
  );
  const storedQuestions = Array.isArray(source.questions)
    ? source.questions
    : defaults.questions;
  const byKey = new Map(
    storedQuestions.map((item) => [cleanId(item?.key), item])
  );
  const builtIns = DEFAULT_GUEST_QUESTIONNAIRE_QUESTIONS.map((template) =>
    normalizeBuiltInQuestion(byKey.get(template.key), template, {
      sourceSchemaVersion,
    })
  );
  const customs = storedQuestions
    .filter((item) => {
      const key = cleanId(item?.key);
      return key.startsWith('custom_') && !BUILT_INS_BY_KEY.has(key);
    })
    .slice(0, MAX_CUSTOM_QUESTIONS)
    .map((item) => normalizeCustomQuestion(item, cleanId(item.key)))
    .filter((item) => item.key && item.prompt);
  const questions = sortQuestions([...builtIns, ...customs]);
  return {
    schema_version: GUEST_QUESTIONNAIRE_SCHEMA_VERSION,
    episode_id: episodeId,
    title: cleanText(source.title, 300) || defaults.title,
    introduction: Object.prototype.hasOwnProperty.call(
      source,
      'introduction'
    )
      ? cleanText(source.introduction, 3000)
      : defaults.introduction,
    scheduling: normalizeScheduling(source.scheduling, defaults.scheduling),
    questions,
    upload_slots: normalizeUploadSlots(
      source.upload_slots,
      defaults.upload_slots
    ),
    link: normalizeLink(source.link),
    response: normalizeResponse(source.response, questions),
    autofill: normalizeAutofill(source.autofill),
    upload_budget: normalizeGuestQuestionnaireUploadBudget(
      source.upload_budget
    ),
    created_at: cleanIsoDate(source.created_at),
    updated_at: cleanIsoDate(source.updated_at),
    updated_by_person_id: cleanId(source.updated_by_person_id, 180),
  };
}

export function validateGuestQuestionnaireRecord(value = {}) {
  const record = normalizeGuestQuestionnaireRecord(value);
  if (!record.episode_id) {
    throw new GuestQuestionnaireValidationError(
      'Guest questionnaire: episode ID is required.',
      'GUEST_QUESTIONNAIRE_EPISODE_REQUIRED'
    );
  }
  record.questions.forEach(validateQuestion);
  return record;
}

export function isGuestQuestionActive(questionValue, answersValue = {}) {
  return guestQuestionIsActive(questionValue, answersValue);
}

export function validateGuestQuestionnaireSubmission(
  submissionValue,
  questionnaireValue
) {
  const submission = plainObject(submissionValue);
  const questionnaire = normalizeGuestQuestionnaireRecord(questionnaireValue);
  const rawAnswers = plainObject(submission.answers);
  const questionsByKey = new Map(
    questionnaire.questions.map((item) => [item.key, item])
  );
  const unknownKeys = Object.keys(rawAnswers).filter(
    (key) => !questionsByKey.has(cleanId(key))
  );
  if (unknownKeys.length) {
    throw new GuestQuestionnaireValidationError(
      'The response contains a question that is no longer available.',
      'GUEST_RESPONSE_UNKNOWN_QUESTION',
      unknownKeys.slice(0, 10)
    );
  }

  const invalidAnswerKeys = [];
  const oversizedAnswerKeys = [];
  for (const [rawKey, rawValue] of Object.entries(rawAnswers)) {
    const key = cleanId(rawKey);
    const item = questionsByKey.get(key);
    if (!item) continue;
    if (rawValue !== null && rawValue !== undefined && typeof rawValue !== 'string') {
      invalidAnswerKeys.push(key);
      continue;
    }
    const limit = item.type === 'long_text' ? 6000 : 600;
    if (String(rawValue ?? '').length > limit) oversizedAnswerKeys.push(key);
  }
  if (invalidAnswerKeys.length) {
    throw new GuestQuestionnaireValidationError(
      'Each guest-questionnaire answer must be plain text.',
      'GUEST_RESPONSE_ANSWER_INVALID',
      invalidAnswerKeys
    );
  }
  if (oversizedAnswerKeys.length) {
    throw new GuestQuestionnaireValidationError(
      'One or more guest-questionnaire answers is too long.',
      'GUEST_RESPONSE_ANSWER_TOO_LONG',
      oversizedAnswerKeys
    );
  }

  const candidateAnswers = normalizeAnswers(
    rawAnswers,
    questionnaire.questions
  );
  const answers = {};
  const missing = [];
  let totalCharacters = 0;
  for (const item of questionnaire.questions) {
    const active = isGuestQuestionActive(item, candidateAnswers);
    if (!active) continue;
    const answer = cleanText(
      candidateAnswers[item.key],
      item.type === 'long_text' ? 6000 : 600
    );
    if (item.required && !answer) missing.push(item.key);
    if (item.type === 'single_choice' && answer) {
      if (!item.options.some((option) => option.value === answer)) {
        throw new GuestQuestionnaireValidationError(
          `Choose one of the available answers for “${item.prompt}”.`,
          'GUEST_RESPONSE_CHOICE_INVALID',
          [item.key]
        );
      }
    }
    if (answer) {
      answers[item.key] = answer;
      totalCharacters += answer.length;
    }
  }
  if (missing.length) {
    throw new GuestQuestionnaireValidationError(
      'Complete every required guest-questionnaire field.',
      'GUEST_RESPONSE_REQUIRED_FIELDS',
      missing
    );
  }
  if (totalCharacters > MAX_TOTAL_ANSWER_CHARACTERS) {
    throw new GuestQuestionnaireValidationError(
      'The guest response is too long. Shorten one or more answers.',
      'GUEST_RESPONSE_TOO_LARGE'
    );
  }
  const profileErrors = getGuestProfileFieldErrors({
    contact_email: answers.guest_email,
    website: answers.website,
    instagram: answers.instagram,
    facebook: answers.facebook,
    linkedin: answers.linkedin,
    x_twitter: answers.x_twitter,
    youtube: answers.youtube,
    tiktok: answers.tiktok,
    other: '',
  });
  if (Object.keys(profileErrors).length) {
    throw new GuestQuestionnaireValidationError(
      'Correct the guest email, website, or social profile format before submitting.',
      'GUEST_RESPONSE_PROFILE_INVALID',
      Object.keys(profileErrors).map((key) =>
        key === 'contact_email' ? 'guest_email' : key
      )
    );
  }
  const publicProfileAnswerKeys = [
    'website',
    'instagram',
    'facebook',
    'linkedin',
    'x_twitter',
    'youtube',
    'tiktok',
    'other_social_profiles',
  ];
  if (
    answers.public_profiles_available === 'yes' &&
    !publicProfileAnswerKeys.some((key) => Boolean(answers[key]))
  ) {
    throw new GuestQuestionnaireValidationError(
      'Add at least one website or public social profile, or choose “No public profiles.”',
      'GUEST_RESPONSE_PUBLIC_PROFILE_REQUIRED',
      ['public_profiles_available']
    );
  }
  const invalidOtherSocial = cleanText(
    answers.other_social_profiles,
    6000
  )
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .some((line) => !isValidGuestProfileEntry('other', line));
  if (invalidOtherSocial) {
    throw new GuestQuestionnaireValidationError(
      'Use one @handle or complete HTTPS link per line for other social profiles.',
      'GUEST_RESPONSE_PROFILE_INVALID',
      ['other_social_profiles']
    );
  }
  if (
    Object.entries(questionnaire.scheduling).some(
      ([key, item]) =>
        item.url &&
        item.required &&
        plainObject(submission.scheduling_acknowledgements)[key] !== true &&
        submission.scheduling_acknowledged !== true
    )
  ) {
    throw new GuestQuestionnaireValidationError(
      'Confirm the recording schedule before submitting this form.',
      'GUEST_SCHEDULING_ACKNOWLEDGEMENT_REQUIRED'
    );
  }
  const missingUploads = questionnaire.upload_slots
    .filter(
      (slot) =>
        slot.visible && slot.required && slot.status === 'enabled'
    )
    .filter((slot) => {
      const upload = plainObject(
        questionnaire.response.upload_slots[slot.key]
      );
      return (Number(upload.count) || 0) < slot.min_count;
    })
    .map((slot) => slot.key);
  if (missingUploads.length) {
    throw new GuestQuestionnaireValidationError(
      'Add every required guest file before submitting this form.',
      'GUEST_RESPONSE_REQUIRED_UPLOADS',
      missingUploads
    );
  }
  return {
    submission_id: cleanText(submission.submission_id, 180),
    expected_revision: Math.max(
      0,
      Math.trunc(Number(submission.expected_revision) || 0)
    ),
    answers,
    scheduling_acknowledged:
      submission.scheduling_acknowledged === true ||
      Object.entries(questionnaire.scheduling)
        .filter(([, item]) => item.url && item.required)
        .every(
          ([key]) =>
            plainObject(submission.scheduling_acknowledgements)[key] === true
        ),
    scheduling_acknowledgements: Object.fromEntries(
      Object.keys(questionnaire.scheduling).map((key) => [
        key,
        plainObject(submission.scheduling_acknowledgements)[key] === true ||
          submission.scheduling_acknowledged === true,
      ])
    ),
  };
}

export function getGuestQuestionnaireLinkState(linkValue = {}, now = new Date()) {
  const link = normalizeLink(linkValue);
  if (
    link.status === 'active' &&
    link.expires_at &&
    new Date(link.expires_at).getTime() <= now.getTime()
  ) {
    return { ...link, status: 'expired' };
  }
  return link;
}

function publicQuestion(item) {
  return {
    key: item.key,
    built_in: item.built_in,
    type: item.type,
    prompt: item.prompt,
    help_text: item.help_text,
    required: item.required,
    visible: item.visible,
    sort_order: item.sort_order,
    options: item.options,
    privacy: item.privacy,
    show_when: item.show_when,
  };
}

function responseSummary(response) {
  return {
    status: response.status,
    revision: response.revision,
    submitted_at: response.submitted_at,
    updated_at: response.updated_at,
    upload_slots: safeUploadResponse(response.upload_slots),
  };
}

export function sanitizeGuestQuestionnaireForPublic(recordValue = {}) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  return {
    schema_version: record.schema_version,
    title: record.title,
    introduction: record.introduction,
    scheduling: record.scheduling,
    questions: record.questions.map(publicQuestion),
    upload_slots: record.upload_slots,
  };
}

export function getGuestQuestionnaireStudioCapabilities({
  canHost = false,
  canReview = false,
  canManage = false,
  episodeStatus = '',
  archived = false,
  linkStatus = 'not_issued',
  responseStatus = 'not_started',
} = {}) {
  const canAccess = canHost || canReview || canManage;
  const lockedHistory = archived === true || episodeStatus === 'accepted';
  const canAct = canAccess && !lockedHistory;
  const submitted = responseStatus === 'submitted';
  return {
    can_access: canAccess,
    can_edit: canAct && !submitted && linkStatus !== 'active',
    can_issue: canAct && !submitted,
    can_apply: canAct && submitted,
    can_request_update:
      canAct && submitted && (canReview || canManage),
    can_revoke:
      canAccess &&
      linkStatus === 'active' &&
      (canAct || canReview || canManage),
    can_view_shipping: canReview || canManage,
    history_locked: lockedHistory,
  };
}

export function sanitizeGuestQuestionnaireForStudio(
  recordValue = {},
  { canViewShipping = false, now = new Date() } = {}
) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  const shippingKeys = new Set(
    record.questions
      .filter(
        (item) => item.privacy === GUEST_QUESTION_PRIVACY.SHIPPING
      )
      .map((item) => item.key)
  );
  const answers = Object.fromEntries(
    Object.entries(record.response.answers).filter(
      ([key]) => canViewShipping || !shippingKeys.has(key)
    )
  );
  const link = getGuestQuestionnaireLinkState(record.link, now);
  return {
    questionnaire: {
      schema_version: record.schema_version,
      episode_id: record.episode_id,
      title: record.title,
      introduction: record.introduction,
      scheduling: record.scheduling,
      questions: record.questions.map(publicQuestion),
      upload_slots: record.upload_slots,
      created_at: record.created_at,
      updated_at: record.updated_at,
    },
    link: {
      status: link.status,
      issued_at: link.issued_at,
      expires_at: link.expires_at,
      revoked_at: link.revoked_at,
    },
    response: {
      ...responseSummary(record.response),
      response_id: record.response.response_id,
      answers,
      scheduling_acknowledged:
        record.response.scheduling_acknowledged,
      scheduling_acknowledgements:
        record.response.scheduling_acknowledgements,
      upload_slots: safeUploadResponse(record.response.upload_slots),
    },
  };
}

export function sanitizeGuestQuestionnaireForLogistics(recordValue = {}) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  const shippingKeys = new Set(
    record.questions
      .filter(
        (item) => item.privacy === GUEST_QUESTION_PRIVACY.SHIPPING
      )
      .map((item) => item.key)
  );
  const answers = record.response.answers;
  return {
    episode_id: record.episode_id,
    response: responseSummary(record.response),
    shipping: {
      requested: answers.mic_kit_shipping_needed === 'yes',
      guest_name: cleanText(answers.guest_name, 180),
      guest_email: cleanText(answers.guest_email, 254),
      answers: Object.fromEntries(
        Object.entries(answers).filter(([key]) => shippingKeys.has(key))
      ),
    },
  };
}

export function mergeGuestQuestionnaireUploadSlot(
  recordValue = {},
  { slotKey = '', assets = [] } = {}
) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  const key = cleanId(slotKey);
  const slot = record.upload_slots.find((item) => item.key === key);
  if (!slot) {
    throw new GuestQuestionnaireValidationError(
      'The guest upload slot is not available.',
      'GUEST_UPLOAD_SLOT_INVALID'
    );
  }
  const normalizedAssets = (Array.isArray(assets) ? assets : [])
    .map(normalizeUploadAsset)
    .filter(Boolean);
  if (normalizedAssets.length > slot.max_count) {
    throw new GuestQuestionnaireValidationError(
      `This upload accepts at most ${slot.max_count} file${
        slot.max_count === 1 ? '' : 's'
      }.`,
      'GUEST_UPLOAD_COUNT_INVALID',
      [key]
    );
  }
  const nextUploads = {
    ...record.response.upload_slots,
    ...(key === 'resume'
      ? {
          resume: normalizeUploadResponse({
            resume: { asset: normalizedAssets[0] || null },
          }).resume,
        }
      : {
          photo: normalizeUploadResponse({
            photo: { assets: normalizedAssets },
          }).photo,
        }),
  };
  return {
    ...record,
    response: {
      ...record.response,
      upload_slots: nextUploads,
    },
  };
}

function answer(record, key) {
  return cleanText(record.response.answers[key], 6000);
}

function optionLabel(record, key, value) {
  return (
    record.questions
      .find((item) => item.key === key)
      ?.options.find((option) => option.value === value)?.label || value
  );
}

export function projectGuestQuestionnaireResponse(recordValue = {}) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  const otherSocialProfiles = answer(record, 'other_social_profiles')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
  const notes = [];
  if (answer(record, 'guest_pronouns')) {
    notes.push(`Pronouns: ${answer(record, 'guest_pronouns')}`);
  }
  if (answer(record, 'topics')) {
    notes.push(`Requested topics and takeaways:\n${answer(record, 'topics')}`);
  }
  if (answer(record, 'social_permission')) {
    notes.push(
      `Social promotion permission: ${optionLabel(
        record,
        'social_permission',
        answer(record, 'social_permission')
      )}`
    );
  }
  if (answer(record, 'guest_notes')) {
    notes.push(`Guest notes:\n${answer(record, 'guest_notes')}`);
  }
  if (answer(record, 'project_links')) {
    notes.push(`Projects and links:\n${answer(record, 'project_links')}`);
  }
  if (answer(record, 'research_links')) {
    notes.push(`Research and background links:\n${answer(record, 'research_links')}`);
  }
  if (otherSocialProfiles.length > 1) {
    notes.push(`Additional public profiles:\n${otherSocialProfiles.join('\n')}`);
  }
  if (answer(record, 'close_call')) {
    notes.push(
      `Close-call discussion: ${optionLabel(
        record,
        'close_call',
        answer(record, 'close_call')
      )}`
    );
  }
  if (answer(record, 'close_call_details')) {
    notes.push(`Close-call background:\n${answer(record, 'close_call_details')}`);
  }
  const readiness = [
    ['High-speed internet', 'high_speed_internet'],
    ['External microphone', 'external_microphone'],
    ['Over-ear or wired headphones', 'over_ear_headphones'],
    ['Quiet recording place', 'quiet_recording_place'],
  ]
    .filter(([, key]) => answer(record, key))
    .map(
      ([label, key]) =>
        `${label}: ${optionLabel(record, key, answer(record, key))}`
    );
  if (readiness.length) {
    notes.push(`Recording readiness:\n${readiness.join('\n')}`);
  }
  if (answer(record, 'mic_kit_shipping_needed')) {
    notes.push(
      `Microphone-kit follow-up: ${optionLabel(
        record,
        'mic_kit_shipping_needed',
        answer(record, 'mic_kit_shipping_needed')
      )}`
    );
  }
  if (answer(record, 'own_equipment_description')) {
    notes.push(
      `Guest recording equipment:\n${answer(
        record,
        'own_equipment_description'
      )}`
    );
  }
  if (answer(record, 'recording_experience')) {
    notes.push(
      `Recording experience:\n${answer(record, 'recording_experience')}`
    );
  }

  const internetReadiness = answer(record, 'high_speed_internet');
  const microphoneReadiness = answer(record, 'external_microphone');
  const headphoneReadiness = answer(record, 'over_ear_headphones');
  const quietPlaceReadiness = answer(record, 'quiet_recording_place');
  const kitDecision = answer(record, 'mic_kit_shipping_needed');
  const recordingSetupConfirmed = [
    internetReadiness,
    microphoneReadiness,
    headphoneReadiness,
    quietPlaceReadiness,
  ].every((value) => value === 'yes');
  let guestMicChoice = 'needs_follow_up';
  let guestEquipmentNote =
    'The episode team needs to confirm the guest’s recording equipment.';
  if (kitDecision === 'yes') {
    guestMicChoice = 'request_kit';
    guestEquipmentNote =
      'The guest requested an Avalanche Hour microphone kit for this recording.';
  } else if (kitDecision === 'unsure') {
    guestEquipmentNote =
      'The guest asked the episode team to help decide what recording support is needed.';
  } else if (recordingSetupConfirmed) {
    guestMicChoice = 'use_own_equipment';
    guestEquipmentNote =
      'The guest confirmed the internet, equipment, and recording space needed for the interview.';
  } else if (kitDecision === 'no') {
    guestEquipmentNote =
      'The guest plans to arrange a suitable setup; the episode team still needs to confirm it.';
  }

  const guestMicKitPlan = normalizeProjectedGuestMicKitPlan({
    guest_name: answer(record, 'guest_name'),
    choice: guestMicChoice,
    request_id: '',
    equipment_note: guestEquipmentNote,
    response_revision: record.response.revision,
    readiness: {
      internet: internetReadiness,
      microphone: microphoneReadiness,
      headphones: headphoneReadiness,
      quiet_place: quietPlaceReadiness,
    },
  });
  if (answer(record, 'video_clip_consent')) {
    notes.push(
      `Video clip consent: ${optionLabel(
        record,
        'video_clip_consent',
        answer(record, 'video_clip_consent')
      )}`
    );
  }
  if (answer(record, 'photo_credit')) {
    notes.push(`Photo credit: ${answer(record, 'photo_credit')}`);
  }
  const customResponses = record.questions
    .filter(
      (question) =>
        question.built_in !== true &&
        question.visible &&
        isGuestQuestionActive(question, record.response.answers) &&
        answer(record, question.key)
    )
    .map(
      (question) =>
        `${cleanText(question.prompt, 500)}:\n${answer(record, question.key)}`
    );
  if (customResponses.length) {
    notes.push(`Additional guest responses\n${customResponses.join('\n\n')}`);
  }
  const hasPublicProfile = [
    'website',
    'instagram',
    'facebook',
    'linkedin',
    'x_twitter',
    'youtube',
    'tiktok',
  ].some((key) => Boolean(answer(record, key))) || otherSocialProfiles.length > 0;
  const showNotes = [];
  const guestIdentity = [
    answer(record, 'guest_name'),
    answer(record, 'guest_title_affiliation'),
  ].filter(Boolean);
  if (guestIdentity.length) {
    showNotes.push(`Guest: ${guestIdentity.join(' — ')}`);
  }
  if (answer(record, 'guest_pronouns')) {
    showNotes.push(`Pronouns: ${answer(record, 'guest_pronouns')}`);
  }
  if (answer(record, 'guest_bio')) {
    showNotes.push(`Guest biography:\n${answer(record, 'guest_bio')}`);
  }
  if (answer(record, 'topics')) {
    showNotes.push(`Requested topics and takeaways:\n${answer(record, 'topics')}`);
  }
  if (answer(record, 'project_links')) {
    showNotes.push(`Projects and links:\n${answer(record, 'project_links')}`);
  }
  if (answer(record, 'research_links')) {
    showNotes.push(
      `Research and background links:\n${answer(record, 'research_links')}`
    );
  }

  const publicProfiles = [
    ['Website', 'website'],
    ['Instagram', 'instagram'],
    ['Facebook', 'facebook'],
    ['LinkedIn', 'linkedin'],
    ['X / Twitter', 'x_twitter'],
    ['YouTube', 'youtube'],
    ['TikTok', 'tiktok'],
  ]
    .filter(([, key]) => answer(record, key))
    .map(([label, key]) => `${label}: ${answer(record, key)}`);
  if (otherSocialProfiles.length) {
    publicProfiles.push(
      ...otherSocialProfiles.map((profile) => `Other: ${profile}`)
    );
  }
  const socialCopy = [];
  if (publicProfiles.length) {
    socialCopy.push(`Approved public profiles:\n${publicProfiles.join('\n')}`);
  } else if (answer(record, 'public_profiles_available') === 'no') {
    socialCopy.push('Public profiles: Guest reported no public profiles.');
  }
  if (answer(record, 'social_permission')) {
    socialCopy.push(
      `Social promotion permission: ${optionLabel(
        record,
        'social_permission',
        answer(record, 'social_permission')
      )}`
    );
  }
  if (answer(record, 'video_clip_consent')) {
    socialCopy.push(
      `Video clip consent: ${optionLabel(
        record,
        'video_clip_consent',
        answer(record, 'video_clip_consent')
      )}`
    );
  }

  const productionReadiness = [...readiness];
  if (answer(record, 'mic_kit_shipping_needed')) {
    productionReadiness.push(
      `Microphone-kit follow-up: ${optionLabel(
        record,
        'mic_kit_shipping_needed',
        answer(record, 'mic_kit_shipping_needed')
      )}`
    );
  }
  if (answer(record, 'own_equipment_description')) {
    productionReadiness.push(
      `Guest recording equipment: ${answer(
        record,
        'own_equipment_description'
      )}`
    );
  }
  if (answer(record, 'recording_experience')) {
    productionReadiness.push(
      `Recording experience: ${answer(record, 'recording_experience')}`
    );
  }

  return {
    response_revision: record.response.revision,
    profile: {
      name: answer(record, 'guest_name'),
      title_affiliation: answer(record, 'guest_title_affiliation'),
      contact_email: answer(record, 'guest_email'),
      contact_phone: '',
      short_bio: answer(record, 'guest_bio'),
      website: answer(record, 'website'),
      instagram: answer(record, 'instagram'),
      facebook: answer(record, 'facebook'),
      linkedin: answer(record, 'linkedin'),
      x_twitter: answer(record, 'x_twitter'),
      youtube: answer(record, 'youtube'),
      tiktok: answer(record, 'tiktok'),
      other: otherSocialProfiles[0] || '',
      no_public_profiles:
        answer(record, 'public_profiles_available') === 'no' &&
        !hasPublicProfile,
    },
    notes: notes.length
      ? `Guest questionnaire notes\n\n${notes.join('\n\n')}`
      : '',
    package: {
      show_notes: showNotes.join('\n\n'),
      social_copy: socialCopy.join('\n\n'),
      credits: answer(record, 'photo_credit')
        ? `Photo credit: ${answer(record, 'photo_credit')}`
        : '',
    },
    production: {
      guest_recording_plan_note: productionReadiness.length
        ? `Guest questionnaire recording readiness\n${productionReadiness.join(
            '\n'
          )}`
        : '',
      guest_mic_kit_plan: guestMicKitPlan,
    },
  };
}

export function applyGuestQuestionnaireProjectionToEpisode(
  episodeValue = {},
  projectionValue = {},
  priorAutofillValue = {}
) {
  const episode = plainObject(episodeValue);
  const projection = plainObject(projectionValue);
  const prior = normalizeAutofill(priorAutofillValue);
  const deliverables = Array.isArray(episode.deliverables)
    ? episode.deliverables
    : [];
  const guestIndex = deliverables.findIndex(
    (item) => item?.id === 'guest-details'
  );
  if (guestIndex < 0) {
    throw new GuestQuestionnaireValidationError(
      'The Episode Studio does not have a Guest details step.',
      'GUEST_DETAILS_STEP_MISSING'
    );
  }
  const guest = plainObject(deliverables[guestIndex]);
  const currentProfile = plainObject(guest.guest_profile);
  const projectedProfile = plainObject(projection.profile);
  const nextProfile = { ...currentProfile };
  const nextSnapshotProfile = { ...prior.profile };
  const appliedFields = [];
  const skippedFields = [];

  for (const [field, projectedValue] of Object.entries(projectedProfile)) {
    if (field === 'no_public_profiles') continue;
    const incoming = cleanText(projectedValue, 6000);
    if (!incoming) continue;
    const current = cleanText(currentProfile[field], 6000);
    const previous = cleanText(prior.profile[field], 6000);
    if (!current || (previous && current === previous)) {
      nextProfile[field] = incoming;
      nextSnapshotProfile[field] = incoming;
      appliedFields.push(`guest_profile.${field}`);
    } else {
      skippedFields.push(`guest_profile.${field}`);
    }
  }

  const publicProfileFields = [
    'website',
    'instagram',
    'facebook',
    'linkedin',
    'x_twitter',
    'youtube',
    'tiktok',
    'other',
  ];
  const projectedHasProfiles = publicProfileFields.some((field) =>
    Boolean(cleanText(projectedProfile[field], 6000))
  );
  const desiredNoProfiles = projectedProfile.no_public_profiles === true;
  const nextNoProfiles = projectedHasProfiles ? false : desiredNoProfiles;
  let hasManualPublicProfile = false;
  if (nextNoProfiles) {
    for (const field of publicProfileFields) {
      const current = cleanText(currentProfile[field], 6000);
      const previous = cleanText(prior.profile[field], 6000);
      if (current && previous && current === previous) {
        nextProfile[field] = '';
        nextSnapshotProfile[field] = '';
        appliedFields.push(`guest_profile.${field}`);
      } else if (current) {
        hasManualPublicProfile = true;
      }
    }
  }
  const currentNoProfiles = currentProfile.no_public_profiles === true;
  const previousNoProfiles = prior.profile.no_public_profiles === true;
  if (
    !hasManualPublicProfile &&
    (!currentNoProfiles ||
      (previousNoProfiles && currentNoProfiles === previousNoProfiles))
  ) {
    nextProfile.no_public_profiles = nextNoProfiles;
    nextSnapshotProfile.no_public_profiles = nextNoProfiles;
    appliedFields.push('guest_profile.no_public_profiles');
  } else {
    skippedFields.push('guest_profile.no_public_profiles');
  }

  const incomingNotes = cleanText(projection.notes, 12000);
  const currentNotes = cleanText(guest.value, 12000);
  const previousNotes = cleanText(prior.notes, 12000);
  let nextNotes = currentNotes;
  let nextSnapshotNotes = prior.notes;
  if (incomingNotes) {
    if (!currentNotes || (previousNotes && currentNotes === previousNotes)) {
      nextNotes = incomingNotes;
      nextSnapshotNotes = incomingNotes;
      appliedFields.push('notes');
    } else {
      skippedFields.push('notes');
    }
  }

  const projectedProfileErrors = getGuestProfileFieldErrors(nextProfile);
  if (Object.keys(projectedProfileErrors).length) {
    throw new GuestQuestionnaireValidationError(
      'The guest response contains a profile value that cannot be applied to Episode Studio.',
      'GUEST_AUTOFILL_PROFILE_INVALID',
      Object.keys(projectedProfileErrors)
    );
  }

  const nextDeliverables = [...deliverables];
  nextDeliverables[guestIndex] = {
    ...guest,
    guest_profile: nextProfile,
    value: nextNotes,
  };
  const nextSnapshotPackage = { ...prior.package };
  const packageProjection = plainObject(projection.package);
  const combinedPromotionBrief = [
    cleanText(packageProjection.show_notes, 12000),
    cleanText(packageProjection.social_copy, 12000)
      ? `Promotion permissions and public profiles\n${cleanText(
          packageProjection.social_copy,
          12000
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12000);
  const previousCombinedPromotionBrief = [
    cleanText(prior.package.show_notes, 12000),
    cleanText(prior.package.social_copy, 12000)
      ? `Promotion permissions and public profiles\n${cleanText(
          prior.package.social_copy,
          12000
        )}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .slice(0, 12000);
  const packageFields = [
    {
      deliverableId: 'show-notes',
      snapshotField: 'show_notes',
      incoming: combinedPromotionBrief,
      previous: previousCombinedPromotionBrief,
    },
    {
      deliverableId: 'credits',
      snapshotField: 'credits',
      incoming: cleanText(packageProjection.credits, 12000),
      previous: cleanText(prior.package.credits, 12000),
    },
  ];
  for (const {
    deliverableId,
    snapshotField,
    incoming,
    previous,
  } of packageFields) {
    const deliverableIndex = nextDeliverables.findIndex(
      (deliverable) => deliverable?.id === deliverableId
    );
    if (deliverableIndex < 0) continue;
    if (!incoming) continue;
    const current = cleanText(nextDeliverables[deliverableIndex]?.value, 12000);
    if (!current || (previous && current === previous)) {
      nextDeliverables[deliverableIndex] = {
        ...nextDeliverables[deliverableIndex],
        value: incoming,
      };
      if (deliverableId === 'show-notes') {
        nextSnapshotPackage.show_notes = cleanText(
          packageProjection.show_notes,
          12000
        );
        nextSnapshotPackage.social_copy = cleanText(
          packageProjection.social_copy,
          12000
        );
      } else {
        nextSnapshotPackage[snapshotField] = incoming;
      }
      appliedFields.push(`deliverables.${deliverableId}.value`);
    } else {
      skippedFields.push(`deliverables.${deliverableId}.value`);
    }
  }

  const nextSnapshotProduction = { ...prior.production };
  const productionProjection = plainObject(projection.production);
  const incomingGuestMicKitPlan = normalizeProjectedGuestMicKitPlan(
    productionProjection.guest_mic_kit_plan
  );
  const currentGuestMicKitPlan = normalizeProjectedGuestMicKitPlan(
    nextDeliverables.find(
      (deliverable) => deliverable?.id === 'mic-kit-plan'
    )?.guest_mic_kit_plan
  );
  const previousGuestMicKitPlan = normalizeProjectedGuestMicKitPlan(
    prior.production.guest_mic_kit_plan
  );
  const micPlanDeliverableIndex = nextDeliverables.findIndex(
    (deliverable) => deliverable?.id === 'mic-kit-plan'
  );
  const incomingGuestPlanIsPresent = Boolean(
    incomingGuestMicKitPlan.guest_name || incomingGuestMicKitPlan.choice
  );
  const currentGuestPlanIsPresent = Boolean(
    currentGuestMicKitPlan.guest_name || currentGuestMicKitPlan.choice
  );
  const currentMatchesPrior =
    JSON.stringify(currentGuestMicKitPlan) ===
    JSON.stringify(previousGuestMicKitPlan);
  if (micPlanDeliverableIndex >= 0 && incomingGuestPlanIsPresent) {
    if (!currentGuestPlanIsPresent || currentMatchesPrior) {
      nextDeliverables[micPlanDeliverableIndex] = {
        ...nextDeliverables[micPlanDeliverableIndex],
        guest_mic_kit_plan: incomingGuestMicKitPlan,
      };
      nextSnapshotProduction.guest_mic_kit_plan = incomingGuestMicKitPlan;
      appliedFields.push('deliverables.mic-kit-plan.guest_mic_kit_plan');
    } else {
      skippedFields.push('deliverables.mic-kit-plan.guest_mic_kit_plan');
    }
  }
  const incomingRecordingPlanNote = cleanText(
    productionProjection.guest_recording_plan_note,
    2400
  );
  const previousRecordingPlanNote = cleanText(
    prior.production.guest_recording_plan_note,
    2400
  );
  const projectionRevision = Math.max(
    0,
    Math.trunc(Number(projection.response_revision) || 0)
  );
  const correctedProjection =
    prior.response_revision > 0 &&
    projectionRevision > prior.response_revision;
  const recordingEvidenceChanged =
    correctedProjection &&
    incomingRecordingPlanNote !== previousRecordingPlanNote;
  const microphoneEvidenceChanged =
    correctedProjection &&
    guestMicKitEvidenceFingerprint(incomingGuestMicKitPlan) !==
      guestMicKitEvidenceFingerprint(previousGuestMicKitPlan);
  const tasksToReopen = new Set([
    ...(recordingEvidenceChanged ? [GUEST_RECORDING_PLAN_TASK_ID] : []),
    ...(microphoneEvidenceChanged ? [MICROPHONE_PLAN_TASK_ID] : []),
  ]);
  const productionTasks = Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : [];
  const nextProductionTasks = productionTasks.map((task) => {
    const taskId = cleanId(task?.task_id, 120);
    const nextTask = tasksToReopen.has(taskId)
      ? reopenCompletedProjectionTask(task)
      : task;
    if (nextTask !== task) {
      appliedFields.push(`production_tasks.${taskId}.status`);
    }
    if (
      taskId !== GUEST_RECORDING_PLAN_TASK_ID
    ) {
      return nextTask;
    }
    const current = cleanText(task.evidence_note, 2400);
    const currentIsAutofillManaged =
      !current ||
      (previousRecordingPlanNote && current === previousRecordingPlanNote);
    if (incomingRecordingPlanNote && currentIsAutofillManaged) {
      nextSnapshotProduction.guest_recording_plan_note =
        incomingRecordingPlanNote;
      appliedFields.push(
        `production_tasks.${GUEST_RECORDING_PLAN_TASK_ID}.evidence_note`
      );
      return { ...nextTask, evidence_note: incomingRecordingPlanNote };
    }
    if (
      correctedProjection &&
      recordingEvidenceChanged &&
      !incomingRecordingPlanNote &&
      currentIsAutofillManaged
    ) {
      nextSnapshotProduction.guest_recording_plan_note = '';
      appliedFields.push(
        `production_tasks.${GUEST_RECORDING_PLAN_TASK_ID}.evidence_note`
      );
      return { ...nextTask, evidence_note: '' };
    }
    if (incomingRecordingPlanNote) {
      skippedFields.push(
        `production_tasks.${GUEST_RECORDING_PLAN_TASK_ID}.evidence_note`
      );
    }
    return nextTask;
  });
  return {
    episode: {
      ...episode,
      deliverables: nextDeliverables,
      production_tasks: nextProductionTasks,
    },
    autofill: {
      response_revision: Math.max(
        0,
        Math.trunc(Number(projection.response_revision) || 0)
      ),
      profile: nextSnapshotProfile,
      notes: nextSnapshotNotes,
      package: nextSnapshotPackage,
      production: nextSnapshotProduction,
      applied_at: '',
      applied_by_person_id: '',
    },
    applied_fields: appliedFields,
    skipped_fields: skippedFields,
  };
}

export function guestQuestionnaireResponseSummary(recordValue = {}) {
  const record = normalizeGuestQuestionnaireRecord(recordValue);
  return responseSummary(record.response);
}
