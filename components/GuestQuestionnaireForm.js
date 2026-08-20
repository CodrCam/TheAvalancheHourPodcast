import { useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EventAvailableRoundedIcon from '@mui/icons-material/EventAvailableRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import PlainTextArea from './PlainTextArea';
import { buildGuestQuestionnaireSections } from '../lib/guestQuestionnaireSections.mjs';
import { guestQuestionIsActive } from '../lib/guestQuestionnaireConditions.mjs';
import { consumeGuestQuestionnaireClientToken } from '../lib/guestQuestionnaireClientToken.mjs';
import { completeGuestQuestionnaireAssetUpload } from '../lib/guestQuestionnaireUploadClient.mjs';
import {
  isEpisodeAssetUploadReadyForCompletion,
  shouldReconcileEpisodeAssetUpload,
  uploadAuthorizedFile,
} from '../lib/episodeAssetUploadClient.mjs';
import styles from '../styles/GuestQuestionnaire.module.css';

function createSubmissionId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `submission-${Date.now().toString(36)}-${Math.random()
    .toString(36)
    .slice(2)}`;
}

function sortedVisibleQuestions(questions = []) {
  return [...questions]
    .filter((question) => question.visible !== false)
    .sort(
      (left, right) =>
        Number(left.sort_order || 0) - Number(right.sort_order || 0)
    );
}

function normalizedChoices(options = []) {
  return options
    .map((option) => {
      if (typeof option === 'string') {
        return { value: option, label: option };
      }
      return {
        value: String(option?.value || ''),
        label: String(option?.label || option?.value || ''),
      };
    })
    .filter((option) => option.value && option.label);
}

function isCompleteHttpsUrl(value) {
  try {
    const url = new URL(String(value || ''));
    return Boolean(
      url.protocol === 'https:' &&
        url.hostname &&
        !url.username &&
        !url.password
    );
  } catch {
    return false;
  }
}

function isSocialHandleOrHttps(value) {
  return (
    /^@[a-z0-9][a-z0-9._-]{0,99}$/i.test(String(value || '').trim()) ||
    isCompleteHttpsUrl(value)
  );
}

export function guestQuestionIsVisible(question = {}, answers = {}) {
  return guestQuestionIsActive(
    { ...question, visible: question.visible !== false },
    answers
  );
}

function formatEpisodeDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function schedulingStages(scheduling = {}) {
  if (scheduling?.pre_interview || scheduling?.interview) {
    return [
      {
        key: 'pre_interview',
        label: 'Pre-interview / sound check',
        value: scheduling.pre_interview || {},
      },
      {
        key: 'interview',
        label: 'Interview recording',
        value: scheduling.interview || {},
      },
    ];
  }
  return scheduling?.url
    ? [{ key: 'pre_interview', label: 'Scheduling', value: scheduling }]
    : [];
}

function validateVisibleQuestions(
  questions,
  answers,
  scheduling,
  uploadConfigs = [],
  uploadSlots = {}
) {
  const errors = {};
  let totalCharacters = 0;
  questions.forEach((question) => {
    if (!guestQuestionIsVisible(question, answers)) return;
    const value = String(answers[question.key] || '').trim();
    totalCharacters += value.length;
    if (question.required && !value) {
      errors[question.key] = 'Please answer this question.';
      return;
    }
    if (!value) return;
    const answerLimit = question.type === 'long_text' ? 6000 : 600;
    if (value.length > answerLimit) {
      errors[question.key] = `Shorten this answer to ${answerLimit.toLocaleString()} characters or fewer.`;
      return;
    }
    if (
      ['email', 'contact_email', 'guest_email'].includes(question.key) &&
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)
    ) {
      errors[question.key] = 'Enter a complete email address.';
    }
    if (question.type === 'single_choice') {
      const allowed = normalizedChoices(question.options).map(
        (option) => option.value
      );
      if (!allowed.includes(value)) {
        errors[question.key] = 'Choose one of the available answers.';
      }
    }
  });
  const activeQuestionByKey = new Map(
    questions
      .filter((question) => guestQuestionIsVisible(question, answers))
      .map((question) => [question.key, question])
  );
  ['website', 'linkedin'].forEach((key) => {
    const value = String(answers[key] || '').trim();
    if (value && activeQuestionByKey.has(key) && !isCompleteHttpsUrl(value)) {
      errors[key] = 'Use a complete HTTPS link.';
    }
  });
  ['instagram', 'facebook', 'x_twitter', 'youtube', 'tiktok'].forEach(
    (key) => {
      const value = String(answers[key] || '').trim();
      if (
        value &&
        activeQuestionByKey.has(key) &&
        !isSocialHandleOrHttps(value)
      ) {
        errors[key] = 'Use an @handle or a complete HTTPS link.';
      }
    }
  );
  ['other_social_profiles'].forEach((key) => {
    const lines = String(answers[key] || '')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);
    if (
      activeQuestionByKey.has(key) &&
      lines.some((line) => !isSocialHandleOrHttps(line))
    ) {
      errors[key] = 'Use one @handle or complete HTTPS link per line.';
    }
  });
  if (
    answers.public_profiles_available === 'yes' &&
    ![
      'website',
      'instagram',
      'facebook',
      'linkedin',
      'x_twitter',
      'youtube',
      'tiktok',
      'other_social_profiles',
    ].some((key) => String(answers[key] || '').trim())
  ) {
    errors.public_profiles_available =
      'Add at least one public profile, or choose “No public profiles.”';
  }
  schedulingStages(scheduling).forEach((stage) => {
    if (
      stage.value?.url &&
      stage.value.required &&
      !answers[`__scheduling_${stage.key}`]
    ) {
      errors[`__scheduling_${stage.key}`] =
        'Confirm that you opened this scheduling page.';
    }
  });
  uploadConfigs.forEach((slot) => {
    if (
      slot.visible === false ||
      slot.status === 'disabled' ||
      slot.status === 'not_enabled' ||
      !slot.required
    ) {
      return;
    }
    const received = Number(
      uploadSlots?.[slot.key]?.count ||
        uploadSlotAssets(uploadSlots?.[slot.key]).length
    );
    const minimum = Math.max(1, Number(slot.min_count || 1));
    if (received < minimum) {
      errors[`__upload_${slot.key}`] = `Add at least ${minimum} ${
        slot.key === 'photo' ? (minimum === 1 ? 'photo' : 'photos') : 'file'
      }.`;
    }
  });
  if (totalCharacters > 24000) {
    errors.__total = `Your written answers total ${totalCharacters.toLocaleString()} characters. Shorten them to 24,000 characters or fewer.`;
  }
  return errors;
}

function uploadSlotAssets(slot = {}) {
  if (Array.isArray(slot.assets)) return slot.assets;
  return slot.asset ? [slot.asset] : [];
}

function uploadAccept(slotKey) {
  return slotKey === 'resume'
    ? '.pdf,.docx,.odt,.txt,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.oasis.opendocument.text,text/plain'
    : '.jpg,.jpeg,.png,.webp,.avif,.tif,.tiff,.heic,.heif,image/jpeg,image/png,image/webp,image/avif,image/tiff,image/heic,image/heif';
}

function uploadFileSizeLabel(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function guestUploadContentType(file) {
  const reported = String(file?.type || '').toLowerCase();
  if (reported) return reported;
  const extension = String(file?.name || '')
    .toLowerCase()
    .split('.')
    .pop();
  return {
    pdf: 'application/pdf',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    odt: 'application/vnd.oasis.opendocument.text',
    txt: 'text/plain',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    webp: 'image/webp',
    avif: 'image/avif',
    tif: 'image/tiff',
    tiff: 'image/tiff',
    heic: 'image/heic',
    heif: 'image/heif',
  }[extension] || '';
}

function validateUploadFile(slotKey, file) {
  const sizeLimit = slotKey === 'resume' ? 10 * 1024 * 1024 : 30 * 1024 * 1024;
  const resumeTypes = new Set([
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.oasis.opendocument.text',
    'text/plain',
  ]);
  const photoTypes = new Set([
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/avif',
    'image/tiff',
    'image/heic',
    'image/heif',
  ]);
  const allowedTypes = slotKey === 'resume' ? resumeTypes : photoTypes;
  if (!allowedTypes.has(guestUploadContentType(file))) {
    throw new Error(
      slotKey === 'resume'
        ? 'Choose a PDF, DOCX, ODT, or plain-text resume.'
        : 'Choose JPG, PNG, WebP, AVIF, TIFF, HEIC, or HEIF photos.'
    );
  }
  if (Number(file?.size || 0) > sizeLimit) {
    throw new Error(
      slotKey === 'resume'
        ? 'The resume must be no larger than 10 MB.'
        : 'Each photo must be no larger than 30 MB.'
    );
  }
}

export default function GuestQuestionnaireForm({ previewData = null }) {
  const previewMode = Boolean(previewData);
  const [token, setToken] = useState('');
  const [questionnaire, setQuestionnaire] = useState(
    () => previewData?.questionnaire || null
  );
  const [episode, setEpisode] = useState(() => previewData?.episode || null);
  const [submission, setSubmission] = useState(
    () => previewData?.submission || null
  );
  const [submissionId, setSubmissionId] = useState('');
  const [answers, setAnswers] = useState(() => previewData?.answers || {});
  const [uploadSlots, setUploadSlots] = useState(
    () => previewData?.submission?.upload_slots || previewData?.upload_slots || {}
  );
  const [uploadBusy, setUploadBusy] = useState({});
  const [uploadMessages, setUploadMessages] = useState({});
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(() => !previewData);
  const [submitting, setSubmitting] = useState(false);
  const [pageError, setPageError] = useState('');
  const [submitted, setSubmitted] = useState(
    () => previewData?.submission?.status === 'submitted'
  );

  useEffect(() => {
    if (previewData) {
      setQuestionnaire(previewData.questionnaire || null);
      setEpisode(previewData.episode || null);
      setSubmission(previewData.submission || null);
      setAnswers(previewData.answers || {});
      setUploadSlots(
        previewData.submission?.upload_slots || previewData.upload_slots || {}
      );
      setSubmitted(previewData.submission?.status === 'submitted');
      setLoading(false);
      setPageError('');
      return undefined;
    }
    const clientToken = consumeGuestQuestionnaireClientToken({
      location: window.location,
      history: window.history,
      storage: window.sessionStorage,
    });
    setToken(clientToken);
    if (!clientToken) {
      setPageError(
        'This guest link is incomplete. Ask the host or producer for a new private link.'
      );
      setLoading(false);
      return;
    }
    let alive = true;
    setLoading(true);
    setPageError('');
    setSubmissionId(createSubmissionId());

    async function loadQuestionnaire() {
      try {
        const response = await fetch('/api/guest-questionnaire', {
          headers: { Authorization: `Bearer ${clientToken}` },
        });
        const data = await response.json();
        if (!response.ok) {
          throw new Error(
            data.error ||
              'This guest link is no longer available. Ask the host or producer for a new link.'
          );
        }
        if (!alive) return;
        setQuestionnaire(data.questionnaire || null);
        setEpisode(data.episode || null);
        setSubmission(data.submission || null);
        const updateDraft = data.update_draft || null;
        if (updateDraft) {
          setAnswers({
            ...(updateDraft.answers || {}),
            ...Object.fromEntries(
              Object.entries(
                updateDraft.scheduling_acknowledgements || {}
              ).map(([key, value]) => [`__scheduling_${key}`, value === true])
            ),
          });
        } else {
          setAnswers({});
        }
        setUploadSlots(
          data.submission?.upload_slots ||
            data.response?.upload_slots ||
            data.upload_slots ||
            {}
        );
        setSubmitted(data.submission?.status === 'submitted');
      } catch (loadError) {
        if (alive) {
          setPageError(
            loadError.message ||
              'This guest questionnaire could not be opened. Ask the host or producer for help.'
          );
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadQuestionnaire();
    return () => {
      alive = false;
    };
  }, [previewData]);

  const allQuestions = useMemo(
    () => sortedVisibleQuestions(questionnaire?.questions || []),
    [questionnaire?.questions]
  );
  const visibleQuestions = useMemo(
    () =>
      allQuestions.filter((question) =>
        guestQuestionIsVisible(question, answers)
      ),
    [allQuestions, answers]
  );
  const publicQuestionSections = useMemo(
    () => buildGuestQuestionnaireSections(visibleQuestions),
    [visibleQuestions]
  );
  const displayedQuestionNumberByKey = useMemo(() => {
    const numbers = new Map();
    let displayNumber = 1;
    publicQuestionSections.forEach((section) => {
      section.questions.forEach((question) => {
        numbers.set(question.key, displayNumber);
        displayNumber += 1;
      });
    });
    return numbers;
  }, [publicQuestionSections]);
  const totalAnswerCharacters = useMemo(
    () =>
      visibleQuestions.reduce(
        (total, question) =>
          total + String(answers[question.key] || '').length,
        0
      ),
    [answers, visibleQuestions]
  );
  const configuredUploadSlots = useMemo(
    () =>
      (Array.isArray(questionnaire?.upload_slots)
        ? questionnaire.upload_slots
        : []
      )
        .filter(
          (slot) =>
            slot.visible !== false &&
            slot.status !== 'disabled' &&
            slot.status !== 'not_enabled'
        )
        .sort(
          (left, right) =>
            Number(left.sort_order || 0) - Number(right.sort_order || 0)
        ),
    [questionnaire]
  );
  const activeSchedulingStages = useMemo(
    () =>
      schedulingStages(questionnaire?.scheduling).filter(
        (stage) => stage.value?.url
      ),
    [questionnaire]
  );
  const uploadMutationsLocked =
    submission?.status === 'update_requested';

  function updateAnswer(key, value) {
    setAnswers((current) => ({ ...current, [key]: value }));
    setErrors((current) => {
      if (!current[key] && !current.__total) return current;
      const next = { ...current };
      delete next[key];
      delete next.__total;
      return next;
    });
    setPageError('');
  }

  async function readApiResponse(response, fallback) {
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(data.error || fallback);
    }
    return data;
  }

  async function uploadGuestFiles(slot, fileList, input) {
    if (previewMode) {
      if (input) input.value = '';
      return;
    }
    const selectedFiles = Array.from(fileList || []);
    if (
      !selectedFiles.length ||
      uploadBusy[slot.key] ||
      submitted ||
      uploadMutationsLocked
    ) {
      return;
    }
    if (input) input.value = '';

    const existingCount = Number(
      uploadSlots?.[slot.key]?.count ||
        uploadSlotAssets(uploadSlots?.[slot.key]).length
    );
    const maximum = Math.max(1, Number(slot.max_count || 1));
    if (existingCount + selectedFiles.length > maximum) {
      setErrors((current) => ({
        ...current,
        [`__upload_${slot.key}`]: `This field accepts up to ${maximum} ${
          slot.key === 'photo' ? (maximum === 1 ? 'photo' : 'photos') : 'file'
        } total.`,
      }));
      return;
    }

    setUploadBusy((current) => ({ ...current, [slot.key]: true }));
    setUploadMessages((current) => ({
      ...current,
      [slot.key]: `Preparing ${selectedFiles.length} ${
        selectedFiles.length === 1 ? 'file' : 'files'
      }…`,
    }));
    setPageError('');

    try {
      let latestSlot = uploadSlots?.[slot.key] || {};
      for (let index = 0; index < selectedFiles.length; index += 1) {
        const file = selectedFiles[index];
        validateUploadFile(slot.key, file);
        setUploadMessages((current) => ({
          ...current,
          [slot.key]: `Uploading ${file.name} · ${index + 1} of ${
            selectedFiles.length
          }`,
        }));

        const presignResponse = await fetch(
          '/api/guest-questionnaire/uploads/presign',
          {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${token}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              slot_key: slot.key,
              file: {
                file_name: file.name,
                content_type: guestUploadContentType(file),
                size: file.size,
              },
            }),
          }
        );
        const presignData = await readApiResponse(
          presignResponse,
          `Could not prepare ${file.name} for upload.`
        );
        let storageResponse = null;
        let storageFailure = null;
        try {
          storageResponse = await uploadAuthorizedFile(
            file,
            presignData.upload,
            {
            onProgress(progress) {
              if (!Number.isFinite(progress?.percent) || progress.indeterminate) {
                return;
              }
              setUploadMessages((current) => ({
                ...current,
                [slot.key]: `Uploading ${file.name} · ${Math.round(
                  progress.percent
                )}%`,
              }));
              },
            }
          );
        } catch (uploadError) {
          storageFailure = uploadError;
          if (!shouldReconcileEpisodeAssetUpload({ error: uploadError })) {
            throw uploadError;
          }
        }
        if (
          !storageFailure &&
          !isEpisodeAssetUploadReadyForCompletion(storageResponse) &&
          !shouldReconcileEpisodeAssetUpload({ response: storageResponse })
        ) {
          throw new Error(
            `Secure storage could not accept ${file.name}. Please try again.`
          );
        }
        const completeData = await completeGuestQuestionnaireAssetUpload({
          token,
          uploadToken: presignData.upload.upload_token,
          fileName: file.name,
          slotKey: slot.key,
          assetId: presignData.upload.asset_id,
        });
        latestSlot = completeData.slot || latestSlot;
        setUploadSlots((current) => ({
          ...current,
          [slot.key]: latestSlot,
        }));
      }
      setUploadMessages((current) => ({
        ...current,
        [slot.key]: `${selectedFiles.length} ${
          selectedFiles.length === 1 ? 'file is' : 'files are'
        } ready.`,
      }));
      setErrors((current) => {
        const next = { ...current };
        delete next[`__upload_${slot.key}`];
        return next;
      });
    } catch (uploadError) {
      setUploadMessages((current) => ({ ...current, [slot.key]: '' }));
      setErrors((current) => ({
        ...current,
        [`__upload_${slot.key}`]:
          uploadError.message || 'The file could not be uploaded.',
      }));
    } finally {
      setUploadBusy((current) => ({ ...current, [slot.key]: false }));
    }
  }

  async function removeGuestUpload(slotKey, asset) {
    if (previewMode) return;
    if (submitted || uploadMutationsLocked || uploadBusy[slotKey]) return;
    if (!window.confirm(`Remove ${asset.file_name || 'this file'}?`)) return;
    setUploadBusy((current) => ({ ...current, [slotKey]: true }));
    setPageError('');
    try {
      const response = await fetch(
        `/api/guest-questionnaire/uploads/${encodeURIComponent(asset.asset_id)}`,
        {
          method: 'DELETE',
          headers: {
            Authorization: `Bearer ${token}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ slot_key: slotKey }),
        }
      );
      const data = await readApiResponse(
        response,
        'The file could not be removed.'
      );
      setUploadSlots((current) => ({
        ...current,
        [slotKey]: data.slot || {},
      }));
      setUploadMessages((current) => ({
        ...current,
        [slotKey]: 'File removed.',
      }));
    } catch (removeError) {
      setErrors((current) => ({
        ...current,
        [`__upload_${slotKey}`]:
          removeError.message || 'The file could not be removed.',
      }));
    } finally {
      setUploadBusy((current) => ({ ...current, [slotKey]: false }));
    }
  }

  async function submitQuestionnaire(event) {
    event.preventDefault();
    if (previewMode) return;
    if (submitting || submitted || !questionnaire) return;
    const nextErrors = validateVisibleQuestions(
      allQuestions,
      answers,
      questionnaire.scheduling,
      configuredUploadSlots,
      uploadSlots
    );
    setErrors(nextErrors);
    const firstError = Object.keys(nextErrors)[0];
    if (firstError) {
      window.requestAnimationFrame(() => {
        document
          .getElementById(`guest-question-${firstError}`)
          ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      });
      return;
    }

    const submittedAnswers = {};
    visibleQuestions.forEach((question) => {
      const value = String(answers[question.key] || '').trim();
      if (value || question.required) submittedAnswers[question.key] = value;
    });

    if (Object.values(uploadBusy).some(Boolean)) {
      setPageError('Wait for the current file upload to finish before submitting.');
      return;
    }

    setSubmitting(true);
    setPageError('');
    try {
      const response = await fetch('/api/guest-questionnaire', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          submission_id: submissionId,
          expected_revision: Number(submission?.revision || 0),
          answers: submittedAnswers,
          scheduling_acknowledgements: Object.fromEntries(
            schedulingStages(questionnaire.scheduling).map((stage) => [
              stage.key,
              answers[`__scheduling_${stage.key}`] === true,
            ])
          ),
          scheduling_acknowledged: schedulingStages(
            questionnaire.scheduling
          ).every(
            (stage) =>
              !stage.value?.required ||
              answers[`__scheduling_${stage.key}`] === true
          ),
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error ||
            'Your response could not be submitted. Your answers are still here; please try again.'
        );
      }
      setSubmission(data.response || submission);
      setAnswers({});
      setSubmitted(true);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (submitError) {
      setPageError(
        submitError.message ||
          'Your response could not be submitted. Your answers are still here; please try again.'
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className={styles.page}>
      <div className={styles.backgroundMark} aria-hidden="true" />
      <header className={styles.brandHeader}>
        <Image
          src="/images/logo.png"
          alt="The Avalanche Hour"
          width={45}
          height={45}
          priority
        />
        <div>
          <span>The Avalanche Hour</span>
          <strong>Guest preparation</strong>
        </div>
      </header>

      <div className={styles.shell}>
        {loading ? (
          <section className={styles.stateCard}>
            <span className={styles.loadingDot} />
            Opening your questionnaire…
          </section>
        ) : pageError && !questionnaire ? (
          <section className={styles.unavailableCard}>
            <LockRoundedIcon aria-hidden="true" />
            <h1>Private link unavailable</h1>
            <p>{pageError}</p>
          </section>
        ) : submitted ? (
          <section className={styles.thankYouCard}>
            <div className={styles.successIcon}>
              <CheckCircleRoundedIcon aria-hidden="true" />
            </div>
            <span>Response received</span>
            <h1>Thank you—we have what we need.</h1>
            <p>
              Your response was sent securely to the episode team. You can close
              this page; the host or producer will follow up if anything else is
              needed.
            </p>
            <div className={styles.noEchoNotice}>
              <LockRoundedIcon aria-hidden="true" />
              For privacy, submitted answers are not displayed again on this link.
            </div>
          </section>
        ) : questionnaire ? (
          <>
            <section className={styles.hero}>
              <span className={styles.eyebrow}>Private episode questionnaire</span>
              <h1>{questionnaire.title || 'Guest questionnaire'}</h1>
              <p>{questionnaire.introduction}</p>
              {episode?.title ? (
                <div className={styles.episodeCard}>
                  <span>Episode</span>
                  <strong>{episode.title}</strong>
                  {episode.recording_date || episode.target_release_date ? (
                    <small>
                      {episode.recording_date
                        ? `Recording ${formatEpisodeDate(episode.recording_date)}`
                        : `Target release ${formatEpisodeDate(
                            episode.target_release_date
                          )}`}
                    </small>
                  ) : null}
                </div>
              ) : null}
            </section>

            <section className={styles.privacyNotice}>
              <LockRoundedIcon aria-hidden="true" />
              <div>
                <strong>Your information is for episode preparation.</strong>
                <p>
                  The episode team uses these answers for the interview, show
                  notes, approved promotion, and equipment coordination. Shipping
                  details are restricted to the roles that need them. This link
                  does not provide access to private audio proofs or publishing
                  materials.
                </p>
              </div>
            </section>

            {submission?.status === 'update_requested' ? (
              <section className={styles.updateNotice} role="status">
                <RefreshRoundedIcon aria-hidden="true" />
                <div>
                  <strong>The episode team requested an updated response.</strong>
                  <p>
                    Review the answers carried into this form, make any changes,
                    re-enter restricted shipping details if needed, and submit the
                    complete questionnaire again. Files from your previous
                    submission are preserved and cannot be added, removed, or
                    replaced during this update; contact the episode team if a
                    file needs to change.
                  </p>
                </div>
              </section>
            ) : null}

            {pageError ? (
              <div className={styles.errorBanner} role="alert">
                {pageError}
              </div>
            ) : null}

            <form className={styles.form} onSubmit={submitQuestionnaire} noValidate>
              <div className={styles.formHeading}>
                <div>
                  <span>Your details</span>
                  <h2>Tell us what will make this a strong conversation.</h2>
                </div>
                <small>
                  Fields marked <b>*</b> are required ·{' '}
                  <span
                    className={
                      totalAnswerCharacters > 24000
                        ? styles.totalCountOver
                        : undefined
                    }
                  >
                    {totalAnswerCharacters.toLocaleString()} / 24,000
                  </span>{' '}
                  characters
                </small>
              </div>

              {errors.__total ? (
                <div
                  id="guest-question-__total"
                  className={styles.formValidationBanner}
                  role="alert"
                >
                  {errors.__total}
                </div>
              ) : null}

              <div className={styles.questions}>
                {publicQuestionSections.map((section) => (
                  <section key={section.id} className={styles.questionSection}>
                    <header>
                      <span>{section.label}</span>
                      <p>{section.description}</p>
                    </header>
                    <div>
                      {section.questions.map((question) => {
                        const displayNumber =
                          displayedQuestionNumberByKey.get(question.key) || 1;
                        const choices = normalizedChoices(question.options);
                        const error = errors[question.key];
                        const restricted =
                          question.privacy === 'restricted_shipping';
                        const answerLength = String(
                          answers[question.key] || ''
                        ).length;
                        const answerLimit =
                          question.type === 'long_text' ? 6000 : 600;
                        return (
                    <fieldset
                      key={question.key}
                      id={`guest-question-${question.key}`}
                      className={`${styles.question} ${
                        error ? styles.questionError : ''
                      } ${restricted ? styles.restrictedQuestion : ''}`}
                    >
                      <legend>
                        <span aria-label={`Question ${displayNumber}`}>
                          {String(displayNumber).padStart(2, '0')}
                        </span>
                        <strong id={`guest-question-label-${question.key}`}>
                          {question.prompt}
                          {question.required ? <b aria-label="required"> *</b> : null}
                        </strong>
                      </legend>
                      {question.help_text ? <p>{question.help_text}</p> : null}
                      {restricted ? (
                        <div className={styles.restrictedLabel}>
                          <LockRoundedIcon aria-hidden="true" />
                          Restricted shipping information
                        </div>
                      ) : null}
                      {question.type === 'long_text' ? (
                        <PlainTextArea
                          value={answers[question.key] || ''}
                          rows={4}
                          aria-labelledby={`guest-question-label-${question.key}`}
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            error ? `guest-question-error-${question.key}` : undefined
                          }
                          onValueChange={(value) =>
                            updateAnswer(question.key, value)
                          }
                        />
                      ) : question.type === 'single_choice' ? (
                        <div className={styles.choiceGrid}>
                          {choices.map((choice) => (
                            <label key={choice.value}>
                              <input
                                type="radio"
                                name={question.key}
                                value={choice.value}
                                checked={answers[question.key] === choice.value}
                                onChange={(event) =>
                                  updateAnswer(question.key, event.target.value)
                                }
                              />
                              <span>{choice.label}</span>
                            </label>
                          ))}
                        </div>
                      ) : (
                        <input
                          type={
                            ['email', 'contact_email', 'guest_email'].includes(
                              question.key
                            )
                              ? 'email'
                              : 'text'
                          }
                          inputMode={
                            ['email', 'contact_email', 'guest_email'].includes(
                              question.key
                            )
                              ? 'email'
                              : 'text'
                          }
                          value={answers[question.key] || ''}
                          aria-labelledby={`guest-question-label-${question.key}`}
                          aria-invalid={Boolean(error)}
                          aria-describedby={
                            error ? `guest-question-error-${question.key}` : undefined
                          }
                          onChange={(event) =>
                            updateAnswer(question.key, event.target.value)
                          }
                        />
                      )}
                      {question.type !== 'single_choice' ? (
                        <small
                          className={`${styles.answerCount} ${
                            question.type === 'long_text'
                              ? styles.answerCountWithExpand
                              : ''
                          } ${
                            answerLength > answerLimit
                              ? styles.answerCountOver
                              : ''
                          }`}
                        >
                          {answerLength.toLocaleString()} /{' '}
                          {answerLimit.toLocaleString()}
                        </small>
                      ) : null}
                      {error ? (
                        <small
                          id={`guest-question-error-${question.key}`}
                          className={styles.fieldError}
                        >
                          {error}
                        </small>
                      ) : null}
                    </fieldset>
                        );
                      })}
                    </div>
                  </section>
                ))}
              </div>

              {configuredUploadSlots.length ? (
                <section className={styles.uploadSection}>
                  <header>
                    <span>Files</span>
                    <h2>Share the materials the episode team needs.</h2>
                    <p>
                      {uploadMutationsLocked
                        ? 'Files from your previous submission are preserved below and are read-only for this update. Make corrections to answers and scheduling, then submit again; contact the episode team if a file needs to change.'
                        : 'Files upload directly to protected episode storage. You can remove or replace them until you submit this questionnaire.'}
                    </p>
                  </header>
                  <div className={styles.publicUploadGrid}>
                    {configuredUploadSlots.map((slot) => {
                      const currentSlot = uploadSlots?.[slot.key] || {};
                      const assets = uploadSlotAssets(currentSlot);
                      const count = Number(currentSlot.count || assets.length);
                      const maximum = Math.max(1, Number(slot.max_count || 1));
                      const minimum = Math.max(1, Number(slot.min_count || 1));
                      const full = count >= maximum;
                      const errorKey = `__upload_${slot.key}`;
                      const uploadErrorId = `guest-upload-error-${slot.key}`;
                      return (
                        <article
                          key={slot.key}
                          id={`guest-question-${errorKey}`}
                          className={`${styles.publicUploadCard} ${
                            errors[errorKey] ? styles.questionError : ''
                          }`}
                        >
                          <div className={styles.publicUploadHeading}>
                            <div>
                              <span>
                                {slot.key === 'resume' ? 'Document' : 'Images'}
                              </span>
                              <h3>
                                {slot.prompt ||
                                  (slot.key === 'resume'
                                    ? 'Resume or CV'
                                    : 'Guest photos')}
                                {slot.required ? ' *' : ''}
                              </h3>
                            </div>
                            <strong>
                              {count} / {maximum}
                            </strong>
                          </div>
                          {slot.help_text ? <p>{slot.help_text}</p> : null}
                          <div className={styles.filePickerRow}>
                            <input
                              id={`guest-upload-${slot.key}`}
                              type="file"
                              accept={uploadAccept(slot.key)}
                              multiple={slot.key === 'photo'}
                              disabled={
                                full ||
                                uploadBusy[slot.key] ||
                                submitted ||
                                uploadMutationsLocked
                              }
                              aria-invalid={Boolean(errors[errorKey])}
                              aria-describedby={
                                errors[errorKey] ? uploadErrorId : undefined
                              }
                              onChange={(event) =>
                                uploadGuestFiles(
                                  slot,
                                  event.target.files,
                                  event.target
                                )
                              }
                            />
                            <label
                              htmlFor={`guest-upload-${slot.key}`}
                              aria-disabled={
                                full ||
                                uploadBusy[slot.key] ||
                                submitted ||
                                uploadMutationsLocked
                              }
                            >
                              {uploadBusy[slot.key]
                                ? 'Uploading…'
                                : uploadMutationsLocked
                                  ? 'Files preserved'
                                : full
                                  ? 'File limit reached'
                                  : slot.key === 'photo'
                                    ? 'Choose photos'
                                    : 'Choose file'}
                            </label>
                            <small>
                              {slot.key === 'resume'
                                ? 'PDF, DOCX, ODT, or TXT · 10 MB'
                                : `JPG, PNG, WebP, AVIF, TIFF, HEIC, or HEIF · 30 MB each · ${
                                    slot.required ? `at least ${minimum}` : 'optional'
                                  }`}
                            </small>
                          </div>
                          {uploadMessages[slot.key] ? (
                            <div className={styles.uploadProgress} role="status">
                              {uploadMessages[slot.key]}
                            </div>
                          ) : null}
                          {assets.length ? (
                            <ul className={styles.guestFileList}>
                              {assets.map((asset) => (
                                <li key={asset.asset_id}>
                                  <span>
                                    <strong>{asset.file_name || 'Guest file'}</strong>
                                    <small>
                                      {uploadFileSizeLabel(
                                        asset.size_bytes || asset.size
                                      )}
                                    </small>
                                  </span>
                                  <button
                                    type="button"
                                    disabled={
                                      uploadBusy[slot.key] ||
                                      submitted ||
                                      uploadMutationsLocked
                                    }
                                    onClick={() =>
                                      removeGuestUpload(slot.key, asset)
                                    }
                                  >
                                    {uploadMutationsLocked
                                      ? 'Preserved'
                                      : 'Remove'}
                                  </button>
                                </li>
                              ))}
                            </ul>
                          ) : null}
                          {errors[errorKey] ? (
                            <small
                              id={uploadErrorId}
                              className={styles.uploadError}
                              role="alert"
                            >
                              {errors[errorKey]}
                            </small>
                          ) : null}
                        </article>
                      );
                    })}
                  </div>
                </section>
              ) : null}

              {activeSchedulingStages.length ? (
                <section className={styles.schedulingSection}>
                  <header>
                    <span>Scheduling</span>
                    <h2>Choose both conversation times.</h2>
                    <p>
                      Open each external booking page, choose a time, and confirm
                      the step here.
                    </p>
                  </header>
                  <div>
                    {activeSchedulingStages.map((stage) => {
                  const answerKey = `__scheduling_${stage.key}`;
                  return (
                    <section
                      key={stage.key}
                      id={`guest-question-${answerKey}`}
                      className={`${styles.schedulingCard} ${
                        errors[answerKey] ? styles.questionError : ''
                      }`}
                    >
                      <EventAvailableRoundedIcon aria-hidden="true" />
                      <div>
                        <span>{stage.label}</span>
                        <h2>
                          {stage.value.prompt ||
                            'Choose a time with the episode team'}
                        </h2>
                        <p>
                          Scheduling happens on the linked service and no calendar
                          details are stored in this questionnaire.
                        </p>
                        <a
                          href={stage.value.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          Open scheduling page
                          <OpenInNewRoundedIcon aria-hidden="true" />
                        </a>
                        <label>
                          <input
                            type="checkbox"
                            checked={answers[answerKey] === true}
                            onChange={(event) =>
                              updateAnswer(answerKey, event.target.checked)
                            }
                          />
                          <span>
                            I opened this scheduling page
                            {stage.value.required ? ' *' : ''}
                          </span>
                        </label>
                        {errors[answerKey] ? (
                          <small className={styles.fieldError}>
                            {errors[answerKey]}
                          </small>
                        ) : null}
                      </div>
                    </section>
                  );
                    })}
                  </div>
                </section>
              ) : null}

              <div className={styles.submitBar}>
                <div>
                  <LockRoundedIcon aria-hidden="true" />
                  <span>
                    Answers are sent securely and are not shown again after
                    submission.
                  </span>
                </div>
                <button
                  type="submit"
                  disabled={
                    submitting || Object.values(uploadBusy).some(Boolean)
                  }
                >
                  <SendRoundedIcon aria-hidden="true" />
                  {submitting
                    ? 'Sending securely…'
                    : Object.values(uploadBusy).some(Boolean)
                      ? 'Finishing file upload…'
                      : 'Submit questionnaire'}
                </button>
              </div>
            </form>
          </>
        ) : null}
      </div>
    </main>
  );
}
