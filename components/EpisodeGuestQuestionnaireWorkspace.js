import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import AdminLayout from './AdminLayout';
import PlainTextArea from './PlainTextArea';
import StudioLayout from './StudioLayout';
import { buildGuestQuestionnaireSections } from '../lib/guestQuestionnaireSections.mjs';
import styles from '../styles/EpisodeGuestQuestionnaire.module.css';

const QUESTION_TYPES = {
  short_text: 'Short answer',
  long_text: 'Long answer',
  single_choice: 'Single choice',
};

const LINK_EXPIRATION_OPTIONS = [7, 14, 30, 60];
const RETIRED_BUILT_IN_QUESTION_KEYS = new Set([
  'own_equipment_description',
]);

function sortQuestions(questions = []) {
  return [...questions].sort(
    (left, right) =>
      Number(left.sort_order || 0) - Number(right.sort_order || 0)
  );
}

function questionnaireFingerprint(value) {
  if (!value) return '';
  return JSON.stringify({
    title: value.title || '',
    introduction: value.introduction || '',
    scheduling: value.scheduling || {},
    questions: sortQuestions(value.questions || []),
    upload_slots: value.upload_slots || {},
  });
}

function dateLabel(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function linkStatusLabel(link = {}) {
  const value = link || {};
  if (value.status === 'revoked' || value.revoked_at) return 'Revoked';
  if (value.status === 'expired') return 'Expired';
  if (value.status === 'active' || value.issued_at) return 'Active';
  return 'Not shared';
}

function isStaleWorkspaceRequest(error) {
  return error?.code === 'GUEST_QUESTIONNAIRE_ROUTE_CHANGED';
}

function responseStatusLabel(response = {}) {
  const value = response || {};
  if (value.status === 'update_requested') return 'Update requested';
  if (value.status === 'submitted') return 'Response received';
  if (value.status === 'draft') return 'Guest started';
  return 'Waiting for guest';
}

function newCustomQuestion(type, sortOrder) {
  const suffix = `${Date.now().toString(36)}_${Math.random()
    .toString(36)
    .slice(2, 7)}`;
  return {
    key: `custom_${suffix}`,
    built_in: false,
    type,
    prompt: 'New question',
    help_text: '',
    required: false,
    visible: true,
    sort_order: sortOrder,
    ...(type === 'single_choice'
      ? {
          options: [
            { value: 'option_1', label: 'Option 1' },
            { value: 'option_2', label: 'Option 2' },
          ],
        }
      : {}),
    privacy: 'standard',
  };
}

function normalizedChoiceOptions(options = []) {
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
    .filter((option) => option.value || option.label);
}

function choiceOptionsText(options = []) {
  return normalizedChoiceOptions(options)
    .map((option) => option.label)
    .join('\n');
}

function optionValueFromLabel(label, index, usedValues) {
  const base =
    String(label || '')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_+|_+$/g, '') || `option_${index + 1}`;
  let value = base;
  let suffix = 2;
  while (usedValues.has(value)) {
    value = `${base}_${suffix}`;
    suffix += 1;
  }
  usedValues.add(value);
  return value;
}

function parseChoiceOptions(value, currentOptions = []) {
  const current = normalizedChoiceOptions(currentOptions);
  const usedValues = new Set();
  return String(value || '')
    .split(/\r?\n/)
    .map((label) => label.trim())
    .filter(Boolean)
    .map((label, index) => {
      const existing = current[index];
      const existingValue = String(existing?.value || '');
      const optionValue =
        existingValue && !usedValues.has(existingValue)
          ? existingValue
          : optionValueFromLabel(label, index, usedValues);
      usedValues.add(optionValue);
      return { value: optionValue, label };
    });
}

function schedulingStage(scheduling = {}, key) {
  if (scheduling?.[key] && typeof scheduling[key] === 'object') {
    return scheduling[key];
  }
  if (key === 'pre_interview' && scheduling?.url) {
    return scheduling;
  }
  return { url: '', prompt: '', required: false };
}

function answerLabel(value, question = {}) {
  if (Array.isArray(value)) return value.filter(Boolean).join(', ');
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (value && typeof value === 'object') return 'Response received';
  const text = String(value ?? '').trim();
  const matchingOption = normalizedChoiceOptions(question.options).find(
    (option) => option.value === text
  );
  return matchingOption?.label || text;
}

function shareUrlFromPath(sharePath) {
  const path = String(sharePath || '').trim();
  if (!path) return '';
  if (/^https:\/\//i.test(path)) return path;
  if (typeof window === 'undefined') return path;
  return new URL(path, window.location.origin).toString();
}

function responseUploadAssets(slot = {}) {
  if (Array.isArray(slot.assets)) return slot.assets;
  return slot.asset ? [slot.asset] : [];
}

function fileSizeLabel(value) {
  const bytes = Number(value || 0);
  if (!Number.isFinite(bytes) || bytes <= 0) return '';
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${Math.max(1, Math.round(bytes / 1024))} KB`;
}

function QuestionEditorCard({
  question,
  index,
  groupIndex,
  groupLength,
  canEdit,
  onMove,
  onRemove,
  onUpdate,
}) {
  return (
    <article
      className={`${styles.questionCard} ${
        question.visible === false ? styles.questionHidden : ''
      }`}
    >
      <div className={styles.questionTopline}>
        <div className={styles.questionIdentity}>
          <span>{String(index + 1).padStart(2, '0')}</span>
          <strong>{question.built_in ? 'Studio field' : 'Custom question'}</strong>
          {question.privacy === 'restricted_shipping' ? (
            <em>
              <LockRoundedIcon aria-hidden="true" /> Restricted
            </em>
          ) : null}
        </div>
        {canEdit ? (
          <div className={styles.questionActions}>
            <button
              type="button"
              aria-label={`Move ${question.prompt} up`}
              disabled={groupIndex === 0}
              onClick={() => onMove(question.key, -1)}
            >
              <ArrowUpwardRoundedIcon aria-hidden="true" />
            </button>
            <button
              type="button"
              aria-label={`Move ${question.prompt} down`}
              disabled={groupIndex === groupLength - 1}
              onClick={() => onMove(question.key, 1)}
            >
              <ArrowDownwardRoundedIcon aria-hidden="true" />
            </button>
            {!question.built_in ? (
              <button
                type="button"
                className={styles.removeButton}
                aria-label={`Remove ${question.prompt}`}
                onClick={() => onRemove(question)}
              >
                <DeleteOutlineRoundedIcon aria-hidden="true" />
              </button>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className={styles.questionFields}>
        <label className={styles.field}>
          <span>Question</span>
          <input
            id={`question-prompt-${question.key}`}
            value={question.prompt || ''}
            disabled={!canEdit}
            maxLength={500}
            onChange={(event) =>
              onUpdate(question.key, { prompt: event.target.value })
            }
          />
        </label>
        <div className={styles.field}>
          <span>Helpful context</span>
          <PlainTextArea
            value={question.help_text || ''}
            disabled={!canEdit}
            rows={2}
            maxLength={1200}
            aria-label={`Helpful context for ${
              question.prompt || 'this question'
            }`}
            onValueChange={(value) =>
              onUpdate(question.key, { help_text: value })
            }
          />
        </div>
        <div className={styles.questionSettings}>
          <label>
            <span>Answer style</span>
            <select
              value={question.type || 'short_text'}
              disabled={!canEdit || question.built_in}
              onChange={(event) =>
                onUpdate(question.key, {
                  type: event.target.value,
                  ...(event.target.value === 'single_choice' &&
                  !question.options?.length
                    ? {
                        options: [
                          { value: 'option_1', label: 'Option 1' },
                          { value: 'option_2', label: 'Option 2' },
                        ],
                      }
                    : {}),
                })
              }
            >
              {Object.entries(QUESTION_TYPES).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className={styles.compactToggle}>
            <input
              type="checkbox"
              checked={question.visible !== false}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdate(question.key, { visible: event.target.checked })
              }
            />
            Show to guest
          </label>
          <label className={styles.compactToggle}>
            <input
              type="checkbox"
              checked={question.required === true}
              disabled={!canEdit || question.visible === false}
              onChange={(event) =>
                onUpdate(question.key, { required: event.target.checked })
              }
            />
            Required
          </label>
        </div>
        {question.type === 'single_choice' && !question.built_in ? (
          <label className={styles.field}>
            <span>Choices · one per line</span>
            <textarea
              rows={3}
              value={choiceOptionsText(question.options)}
              disabled={!canEdit}
              onChange={(event) =>
                onUpdate(question.key, {
                  options: parseChoiceOptions(
                    event.target.value,
                    question.options
                  ),
                })
              }
            />
          </label>
        ) : null}
        {question.show_when ? (
          <div className={styles.conditionNote}>
            This follow-up appears only when the guest’s earlier answer calls for
            it.
          </div>
        ) : null}
      </div>
    </article>
  );
}

export default function EpisodeGuestQuestionnaireWorkspace({ admin = false }) {
  const router = useRouter();
  const episodeId = String(router.query.episodeId || '');
  const [questionnaire, setQuestionnaire] = useState(null);
  const [baseline, setBaseline] = useState(null);
  const [episode, setEpisode] = useState(null);
  const [canManage, setCanManage] = useState(false);
  const [responseRecord, setResponseRecord] = useState(null);
  const [shareLink, setShareLink] = useState(null);
  const [sharePath, setSharePath] = useState('');
  const [canEdit, setCanEdit] = useState(false);
  const [canIssue, setCanIssue] = useState(false);
  const [canApply, setCanApply] = useState(false);
  const [canRevoke, setCanRevoke] = useState(false);
  const [canRequestUpdate, setCanRequestUpdate] = useState(false);
  const [canViewShipping, setCanViewShipping] = useState(false);
  const [configured, setConfigured] = useState(false);
  const [uploadsConfigured, setUploadsConfigured] = useState(true);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [linkBusy, setLinkBusy] = useState(false);
  const [applying, setApplying] = useState(false);
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [newQuestionType, setNewQuestionType] = useState('short_text');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [applyResult, setApplyResult] = useState(null);
  const loadGenerationRef = useRef(0);
  const activeEpisodeIdRef = useRef(episodeId);
  // This is an imperative request-cancellation token, not rendered state.
  // Updating it during render closes the route-change window before effects run.
  // eslint-disable-next-line react-hooks/refs
  activeEpisodeIdRef.current = episodeId;

  const dirty = useMemo(
    () =>
      questionnaireFingerprint(questionnaire) !==
      questionnaireFingerprint(baseline),
    [baseline, questionnaire]
  );

  const orderedQuestions = useMemo(
    () => sortQuestions(questionnaire?.questions || []),
    [questionnaire?.questions]
  );
  const questionGroups = useMemo(
    () =>
      buildGuestQuestionnaireSections(
        orderedQuestions.filter(
          (question) => !RETIRED_BUILT_IN_QUESTION_KEYS.has(question.key)
        ),
        {
          includeEmptyAdditional: true,
          builderLabels: true,
        }
      ),
    [orderedQuestions]
  );
  const configuredUploadSlots = useMemo(
    () =>
      [...(Array.isArray(questionnaire?.upload_slots)
        ? questionnaire.upload_slots
        : [])].sort(
        (left, right) =>
          Number(left.sort_order || 0) - Number(right.sort_order || 0)
      ),
    [questionnaire]
  );

  const routeEpisodeId = episode?.episode_id || episodeId;
  const episodeBaseHref = admin
    ? `/admin/studios/${encodeURIComponent(routeEpisodeId)}`
    : `/studio/episodes/${encodeURIComponent(routeEpisodeId)}`;
  const packageHref = episodeBaseHref;
  const productionHref = `${episodeBaseHref}/production`;
  const questionnaireHref = `${episodeBaseHref}/questionnaire`;
  const listHref = admin
    ? '/admin/studios'
    : canManage
      ? '/studio/manage/episodes'
      : '/studio/episodes';
  const Layout = admin ? AdminLayout : StudioLayout;

  async function loadWorkspace({ quiet = false } = {}) {
    if (!episodeId) return;
    const requestedEpisodeId = episodeId;
    const loadGeneration = loadGenerationRef.current + 1;
    loadGenerationRef.current = loadGeneration;
    const isCurrentLoad = () =>
      loadGenerationRef.current === loadGeneration &&
      activeEpisodeIdRef.current === requestedEpisodeId;

    setLoading(true);
    setError('');
    if (!quiet) {
      setQuestionnaire(null);
      setBaseline(null);
      setEpisode(null);
      setResponseRecord(null);
      setShareLink(null);
      setSharePath('');
      setCanEdit(false);
      setCanIssue(false);
      setCanApply(false);
      setCanRevoke(false);
      setCanRequestUpdate(false);
      setCanManage(false);
      setCanViewShipping(false);
      setConfigured(false);
      setUploadsConfigured(true);
      setSaving(false);
      setLinkBusy(false);
      setApplying(false);
      setMessage('');
      setApplyResult(null);
    }
    try {
      const [questionnaireResponse, episodeResponse] = await Promise.all([
        fetch(
          `/api/studio/episodes/${encodeURIComponent(
            requestedEpisodeId
          )}/guest-questionnaire`,
          { credentials: 'same-origin' }
        ),
        fetch(`/api/studio/episodes/${encodeURIComponent(requestedEpisodeId)}`, {
          credentials: 'same-origin',
        }),
      ]);
      const questionnaireData = await questionnaireResponse.json();
      const episodeData = await episodeResponse.json().catch(() => ({}));
      if (!isCurrentLoad()) return;
      if (!questionnaireResponse.ok) {
        throw new Error(
          questionnaireData.error || 'Could not open the guest questionnaire.'
        );
      }
      const nextQuestionnaire = questionnaireData.questionnaire || null;
      setQuestionnaire(nextQuestionnaire);
      setBaseline(nextQuestionnaire);
      setConfigured(questionnaireData.configured === true);
      setUploadsConfigured(questionnaireData.uploads_configured !== false);
      setCanEdit(questionnaireData.can_edit === true);
      setCanIssue(
        Object.prototype.hasOwnProperty.call(questionnaireData, 'can_issue')
          ? questionnaireData.can_issue === true
          : questionnaireData.can_edit === true
      );
      setCanApply(
        Object.prototype.hasOwnProperty.call(questionnaireData, 'can_apply')
          ? questionnaireData.can_apply === true
          : questionnaireData.can_edit === true &&
              questionnaireData.response?.status === 'submitted'
      );
      setCanRevoke(
        questionnaireData.can_revoke === true || questionnaireData.can_edit === true
      );
      setCanRequestUpdate(questionnaireData.can_request_update === true);
      setCanViewShipping(questionnaireData.can_view_shipping === true);
      setResponseRecord(questionnaireData.response || null);
      setShareLink(questionnaireData.link || null);
      setSharePath('');
      if (episodeResponse.ok && episodeData.episode) {
        setEpisode({
          ...episodeData.episode,
          guest_questionnaire_shared:
            questionnaireData.episode?.guest_questionnaire_shared === true,
        });
        setCanManage(episodeData.canManage === true);
      } else if (questionnaireData.episode) {
        setEpisode(questionnaireData.episode);
      }
      if (quiet) setMessage('Questionnaire status refreshed.');
    } catch (loadError) {
      if (!isCurrentLoad()) return;
      setError(
        loadError.message || 'Could not open the guest questionnaire.'
      );
    } finally {
      if (isCurrentLoad()) setLoading(false);
    }
  }

  useEffect(() => {
    if (!router.isReady || !episodeId) return;
    // Loading a route-scoped remote resource is the synchronization performed here.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadWorkspace();
    return () => {
      loadGenerationRef.current += 1;
    };
    // loadWorkspace intentionally tracks the route id only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [episodeId, router.isReady]);

  function clearFeedback() {
    setMessage('');
    setError('');
    setApplyResult(null);
  }

  function updateQuestionnaire(patch) {
    setQuestionnaire((current) => ({ ...current, ...patch }));
    clearFeedback();
  }

  function updateSchedulingStage(stageKey, patch) {
    updateQuestionnaire({
      scheduling: {
        pre_interview: {
          ...schedulingStage(questionnaire?.scheduling, 'pre_interview'),
          ...(stageKey === 'pre_interview' ? patch : {}),
        },
        interview: {
          ...schedulingStage(questionnaire?.scheduling, 'interview'),
          ...(stageKey === 'interview' ? patch : {}),
        },
      },
    });
  }

  function updateQuestion(key, patch) {
    updateQuestionnaire({
      questions: (questionnaire?.questions || []).map((question) =>
        question.key === key ? { ...question, ...patch } : question
      ),
    });
  }

  function moveQuestion(key, direction, groupedQuestions) {
    const questions = sortQuestions(groupedQuestions || []);
    const index = questions.findIndex((question) => question.key === key);
    const targetIndex = index + direction;
    if (index < 0 || targetIndex < 0 || targetIndex >= questions.length) return;
    const movingSortOrder = questions[index].sort_order;
    const targetSortOrder = questions[targetIndex].sort_order;
    updateQuestionnaire({
      questions: (questionnaire?.questions || []).map((question) => {
        if (question.key === questions[index].key) {
          return { ...question, sort_order: targetSortOrder };
        }
        if (question.key === questions[targetIndex].key) {
          return { ...question, sort_order: movingSortOrder };
        }
        return question;
      }),
    });
  }

  function addQuestion() {
    const questions = sortQuestions(questionnaire?.questions || []);
    const question = newCustomQuestion(
      newQuestionType,
      Math.max(0, ...questions.map((item) => Number(item.sort_order) || 0)) +
        10
    );
    updateQuestionnaire({ questions: [...questions, question] });
    window.requestAnimationFrame(() => {
      document.getElementById(`question-prompt-${question.key}`)?.focus();
    });
  }

  function removeQuestion(question) {
    if (question.built_in) return;
    if (!window.confirm(`Remove “${question.prompt || 'this question'}”?`)) {
      return;
    }
    updateQuestionnaire({
      questions: (questionnaire?.questions || []).filter(
        (candidate) => candidate.key !== question.key
      ),
    });
  }

  function updateUploadSlot(slotKey, patch) {
    updateQuestionnaire({
      upload_slots: configuredUploadSlots.map((slot) =>
        slot.key === slotKey ? { ...slot, ...patch } : slot
      ),
    });
  }

  async function patchQuestionnaire(body) {
    const requestedEpisodeId = episodeId;
    const requestGeneration = loadGenerationRef.current;
    const response = await fetch(
      `/api/studio/episodes/${encodeURIComponent(
        requestedEpisodeId
      )}/guest-questionnaire`,
      {
        method: 'PATCH',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      }
    );
    const data = await response.json();
    if (
      loadGenerationRef.current !== requestGeneration ||
      activeEpisodeIdRef.current !== requestedEpisodeId
    ) {
      const routeError = new Error(
        'The questionnaire route changed before this request finished.'
      );
      routeError.code = 'GUEST_QUESTIONNAIRE_ROUTE_CHANGED';
      throw routeError;
    }
    if (!response.ok) {
      const requestError = new Error(
        data.error || 'Could not update the guest questionnaire.'
      );
      requestError.code = data.code;
      throw requestError;
    }
    return data;
  }

  function applyServerData(data = {}, { preserveSharePath = false } = {}) {
    if (data.questionnaire) {
      setQuestionnaire(data.questionnaire);
      setBaseline(data.questionnaire);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'configured')) {
      setConfigured(data.configured === true);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'uploads_configured')) {
      setUploadsConfigured(data.uploads_configured !== false);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'link')) {
      setShareLink(data.link || null);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'response')) {
      setResponseRecord(data.response || null);
    }
    if (data.episode) setEpisode(data.episode);
    if (Object.prototype.hasOwnProperty.call(data, 'can_edit')) {
      setCanEdit(data.can_edit === true);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'can_issue')) {
      setCanIssue(data.can_issue === true);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'can_apply')) {
      setCanApply(data.can_apply === true);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'can_revoke')) {
      setCanRevoke(data.can_revoke === true);
    }
    if (Object.prototype.hasOwnProperty.call(data, 'can_request_update')) {
      setCanRequestUpdate(data.can_request_update === true);
    }
    if (!preserveSharePath) setSharePath(data.share_path || '');
  }

  async function saveConfiguration(event) {
    event?.preventDefault();
    if (!canEdit || !questionnaire || saving) return;
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setSaving(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'save_configuration',
        expected_updated_at: baseline?.updated_at || '',
        questionnaire,
      });
      applyServerData(data, { preserveSharePath: true });
      setConfigured(true);
      setMessage('Questionnaire changes saved.');
    } catch (saveError) {
      if (
        !isStaleWorkspaceRequest(saveError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(saveError.message || 'Could not save the questionnaire.');
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setSaving(false);
      }
    }
  }

  async function issueLink({ regenerate = false } = {}) {
    if (!canIssue) return;
    if (dirty) {
      setError('Save the questionnaire before creating a guest link.');
      return;
    }
    if (
      regenerate &&
      !window.confirm(
        'Issue a replacement guest link? The current link will stop working immediately. Responses already saved in Studio will be preserved.'
      )
    ) {
      return;
    }
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setLinkBusy(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'issue_link',
        expected_updated_at: questionnaire?.updated_at || '',
        expires_in_days: expiresInDays,
      });
      applyServerData(data);
      setMessage(
        regenerate
          ? 'Replacement link ready. The previous link no longer works. Copy the new link before leaving this page.'
          : 'Private guest link created. Copy it before leaving this page.'
      );
    } catch (linkError) {
      if (
        !isStaleWorkspaceRequest(linkError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(linkError.message || 'Could not create the guest link.');
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setLinkBusy(false);
      }
    }
  }

  async function requestResponseUpdate() {
    if (!canRequestUpdate) return;
    if (dirty) {
      setError(
        'Save or discard questionnaire changes before requesting a guest update.'
      );
      return;
    }
    if (
      !window.confirm(
        'Request a corrected guest response and issue a fresh link? Any current guest link will stop working immediately. The previous submission remains current until the guest submits the update, and restricted shipping details must be entered again.'
      )
    ) {
      return;
    }
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setLinkBusy(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'request_update',
        expected_updated_at: questionnaire?.updated_at || '',
        expires_in_days: expiresInDays,
      });
      applyServerData(data);
      setMessage(
        'Guest update link ready. Copy it before leaving this page; the previous link no longer works.'
      );
    } catch (linkError) {
      if (
        !isStaleWorkspaceRequest(linkError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(linkError.message || 'Could not request the guest update.');
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setLinkBusy(false);
      }
    }
  }

  async function revokeLink() {
    if (dirty) {
      setError('Save or discard questionnaire changes before revoking the guest link.');
      return;
    }
    const cancellingUpdate = responseRecord?.status === 'update_requested';
    const revokeConfirmed = window.confirm(
      cancellingUpdate
        ? 'Cancel this guest update request and revoke its link? Guest access will stop immediately, and the previous submitted response will remain current.'
        : 'Revoke this guest link now? Guest access will stop immediately. Responses already saved in Studio will not be deleted.'
    );
    if (!revokeConfirmed) {
      return;
    }
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setLinkBusy(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'revoke_link',
        expected_updated_at: questionnaire?.updated_at || '',
      });
      applyServerData(data);
      setSharePath('');
      setMessage(
        cancellingUpdate
          ? 'Guest update request cancelled and access revoked. The previous submitted response remains current.'
          : 'Guest access revoked. Responses already saved in Studio were preserved.'
      );
    } catch (linkError) {
      if (
        !isStaleWorkspaceRequest(linkError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(linkError.message || 'Could not revoke the guest link.');
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setLinkBusy(false);
      }
    }
  }

  async function copyShareLink() {
    const url = shareUrlFromPath(sharePath);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setMessage(
        'Current guest link copied. Send it in your usual message to the guest.'
      );
      setError('');
    } catch {
      setError('Could not copy automatically. Select and copy the link below.');
    }
  }

  async function markLinkShared() {
    if (!canIssue || !activeLink || linkShared) return;
    if (dirty) {
      setError('Save the questionnaire before marking its link as shared.');
      return;
    }
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setLinkBusy(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'mark_shared',
        expected_updated_at: questionnaire?.updated_at || '',
      });
      applyServerData(data, { preserveSharePath: true });
      setMessage(
        'Guest link marked as sent. The Production Board is updated.'
      );
    } catch (shareError) {
      if (
        !isStaleWorkspaceRequest(shareError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(
          shareError.message || 'Could not mark the guest link as shared.'
        );
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setLinkBusy(false);
      }
    }
  }

  async function refreshResponse() {
    if (
      dirty &&
      !window.confirm(
        'Refresh and discard your unsaved questionnaire changes?'
      )
    ) {
      return;
    }
    await loadWorkspace({ quiet: true });
  }

  async function applyResponse() {
    if (!canApply) return;
    if (
      !window.confirm(
        'Fill blank Episode Studio fields from this guest response? Existing work will not be overwritten.'
      )
    ) {
      return;
    }
    const actionGeneration = loadGenerationRef.current;
    const actionEpisodeId = episodeId;
    setApplying(true);
    clearFeedback();
    try {
      const data = await patchQuestionnaire({
        action: 'apply_response',
        expected_updated_at: questionnaire?.updated_at || '',
        expected_episode_updated_at: episode?.updated_at || '',
      });
      applyServerData(data, { preserveSharePath: true });
      setApplyResult({
        applied: data.autofill?.applied_fields || data.applied_fields || [],
        skipped: data.autofill?.skipped_fields || data.skipped_fields || [],
      });
      setMessage('Guest response reviewed and Episode Studio blanks filled.');
    } catch (applyError) {
      if (
        !isStaleWorkspaceRequest(applyError) &&
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setError(applyError.message || 'Could not apply the guest response.');
      }
    } finally {
      if (
        loadGenerationRef.current === actionGeneration &&
        activeEpisodeIdRef.current === actionEpisodeId
      ) {
        setApplying(false);
      }
    }
  }

  function guardNavigation(event) {
    if (!dirty || window.confirm('Leave and discard questionnaire changes?')) {
      return;
    }
    event.preventDefault();
  }

  const responseAnswers = responseRecord?.answers || {};
  const responseUpdateRequested =
    responseRecord?.status === 'update_requested';
  const responseReceived = ['submitted', 'update_requested'].includes(
    responseRecord?.status
  );
  const shippingRequested =
    responseAnswers.mic_kit_shipping_needed === 'yes';
  const responseQuestions = orderedQuestions.filter(
    (question) =>
      Object.prototype.hasOwnProperty.call(responseAnswers, question.key) ||
      (question.privacy === 'restricted_shipping' &&
        !canViewShipping &&
        shippingRequested &&
        responseReceived)
  );
  const responseSections = buildGuestQuestionnaireSections(responseQuestions);
  const visibleResponseUploadSlots = configuredUploadSlots.filter(
    (slot) => slot.visible !== false
  );
  const responseFileCount = visibleResponseUploadSlots.reduce(
    (total, slot) => {
      const responseSlot = responseRecord?.upload_slots?.[slot.key] || {};
      return (
        total +
        Number(
          responseSlot.count || responseUploadAssets(responseSlot).length || 0
        )
      );
    },
    0
  );
  const currentLinkStatus = linkStatusLabel(shareLink);
  const activeLink = currentLinkStatus === 'Active';
  const previouslyIssuedLink = Boolean(shareLink?.issued_at);
  const linkShared =
    episode?.guest_questionnaire_shared === true ||
    (episode?.production_tasks || []).some(
      (task) =>
        task?.task_id === 'guest-prep-sent' &&
        ['complete', 'waived'].includes(task.status)
    );

  return (
    <Layout
      hasUnsavedChanges={dirty}
      unsavedChangesMessage="You have unsaved questionnaire changes. Leave and discard them?"
    >
      <main className={styles.workspace}>
        <Link href={listHref} className={styles.backLink} onClick={guardNavigation}>
          <ArrowBackRoundedIcon aria-hidden="true" />
          {admin || canManage ? 'Production calendar' : 'My episodes'}
        </Link>

        {loading ? (
          <section className={styles.stateCard}>Opening questionnaire…</section>
        ) : error && !questionnaire ? (
          <section className={styles.errorCard}>{error}</section>
        ) : questionnaire ? (
          <>
            <header className={styles.header}>
              <div>
                <span className={styles.eyebrow}>Episode Studio</span>
                <h1>{episode?.title || 'Guest questionnaire'}</h1>
                <p>
                  Customize what the guest sees, share one private link, and
                  review their response here.
                </p>
              </div>
              <div className={styles.headerStatus}>
                <span>{configured ? 'Configured' : 'Draft setup'}</span>
                <strong>{responseStatusLabel(responseRecord)}</strong>
              </div>
            </header>

            <nav className={styles.workspaceTabs} aria-label="Episode workspace">
              <Link href={packageHref} onClick={guardNavigation}>
                Episode package
              </Link>
              <Link href={productionHref} onClick={guardNavigation}>
                Production board
              </Link>
              <Link
                href={questionnaireHref}
                className={styles.workspaceTabActive}
                aria-current="page"
              >
                Guest questionnaire
              </Link>
            </nav>

            {responseUpdateRequested ? (
              <div className={styles.historyBanner}>
                <RefreshRoundedIcon aria-hidden="true" />
                <span>
                  <strong>Guest update requested</strong>
                  <small>
                    The previous submission remains current until the guest
                    submits the corrected response. Non-shipping answers are
                    prefilled for the guest; restricted shipping details must
                    be entered again.
                  </small>
                </span>
              </div>
            ) : responseRecord?.status === 'submitted' ? (
              <div className={styles.historyBanner}>
                <LockRoundedIcon aria-hidden="true" />
                <span>
                  <strong>Submitted questionnaire preserved</strong>
                  <small>
                    Configuration is read-only so this page continues to show
                    exactly what the guest received. Blank Studio fields were
                    filled automatically; review and authorized private-link
                    controls remain available.
                  </small>
                </span>
              </div>
            ) : activeLink && !canEdit ? (
              <div className={styles.historyBanner}>
                <LockRoundedIcon aria-hidden="true" />
                <span>
                  <strong>Active questionnaire preserved</strong>
                  <small>
                    Questions are locked while this guest link is active so the
                    form cannot change while someone is completing it. Revoke
                    the link before revising the questionnaire.
                  </small>
                </span>
              </div>
            ) : null}

            {error ? <div className={styles.errorBanner}>{error}</div> : null}
            {!uploadsConfigured ? (
              <div className={styles.errorBanner} role="alert">
                Secure guest file storage needs setup before this questionnaire
                can be shared. Configure storage or disable every guest upload
                field.
              </div>
            ) : null}
            {message ? (
              <div className={styles.successBanner} role="status">
                <CheckCircleRoundedIcon aria-hidden="true" />
                {message}
              </div>
            ) : null}

            <div className={styles.summaryGrid}>
              <section className={styles.summaryCard}>
                <span>Guest link</span>
                <strong>{linkStatusLabel(shareLink)}</strong>
                <small>
                  {shareLink?.expires_at
                    ? `Expires ${dateLabel(shareLink.expires_at)}`
                    : 'Issue a private, revocable link when the form is ready.'}
                </small>
              </section>
              <section className={styles.summaryCard}>
                <span>Guest response</span>
                <strong>{responseStatusLabel(responseRecord)}</strong>
                <small>
                  {responseUpdateRequested && responseRecord?.submitted_at
                    ? `Update requested · previous response submitted ${dateLabel(
                        responseRecord.submitted_at
                      )}`
                    : responseRecord?.submitted_at
                    ? `Submitted ${dateLabel(responseRecord.submitted_at)}`
                    : 'Refresh this page after the guest submits.'}
                </small>
                {responseReceived ? (
                  <a href="#submitted-intake" className={styles.summaryCardLink}>
                    Review the full intake
                  </a>
                ) : null}
              </section>
              <section className={styles.summaryCard}>
                <span>Episode connection</span>
                <strong>Automatic, blanks only</strong>
                <small>
                  Submission fills connected fields without replacing host or
                  producer work.
                </small>
              </section>
            </div>

            {responseReceived ? (
              <section
                id="submitted-intake"
                className={styles.intakeReview}
                aria-labelledby="submitted-intake-title"
              >
                <header className={styles.intakeReviewHeader}>
                  <div>
                    <span className={styles.eyebrow}>
                      {responseUpdateRequested
                        ? 'Previous submitted intake'
                        : 'Submitted intake'}
                    </span>
                    <h2 id="submitted-intake-title">
                      {responseUpdateRequested
                        ? 'Review the current response'
                        : 'Review the guest response'}
                    </h2>
                    <p>
                      {responseUpdateRequested
                        ? 'This previous submission remains the current response until the guest resubmits. Answers stay read-only, and restricted delivery details only appear to authorized roles.'
                        : 'The complete response is organized below for the episode team. Answers remain read-only, and restricted delivery details only appear to authorized roles.'}
                    </p>
                  </div>
                  <div className={styles.intakeReviewActions}>
                    <button
                      type="button"
                      className={styles.secondaryAction}
                      onClick={refreshResponse}
                    >
                      <RefreshRoundedIcon aria-hidden="true" />
                      Refresh response
                    </button>
                    <Link href={packageHref} className={styles.primaryLink}>
                      Open episode package
                      <OpenInNewRoundedIcon aria-hidden="true" />
                    </Link>
                  </div>
                </header>

                <div className={styles.intakeReviewSummary}>
                  <div>
                    <CheckCircleRoundedIcon aria-hidden="true" />
                    <span>
                      <strong>
                        {responseUpdateRequested
                          ? 'Previous response remains current'
                          : 'Response received'}
                      </strong>
                      <small>{dateLabel(responseRecord.submitted_at)}</small>
                    </span>
                  </div>
                  <div>
                    <strong>{responseQuestions.length}</strong>
                    <span>answers available</span>
                  </div>
                  <div>
                    <strong>{responseFileCount}</strong>
                    <span>guest files</span>
                  </div>
                </div>

                {responseSections.length || visibleResponseUploadSlots.length ? (
                  <nav
                    className={styles.intakeSectionNav}
                    aria-label="Guest response sections"
                  >
                    {responseSections.map((section) => (
                      <a
                        key={section.id}
                        href={`#guest-response-${section.id}`}
                      >
                        {section.label}
                        <span>{section.questions.length}</span>
                      </a>
                    ))}
                    {visibleResponseUploadSlots.length ? (
                      <a href="#guest-response-files">
                        Files
                        <span>{responseFileCount}</span>
                      </a>
                    ) : null}
                  </nav>
                ) : null}

                <div className={styles.intakeSections}>
                  {responseSections.map((section) => (
                    <section
                      key={section.id}
                      id={`guest-response-${section.id}`}
                      className={styles.intakeSection}
                      aria-labelledby={`guest-response-${section.id}-title`}
                    >
                      <div className={styles.intakeSectionHeading}>
                        <div>
                          <h3 id={`guest-response-${section.id}-title`}>
                            {section.label}
                          </h3>
                          <p>{section.description}</p>
                        </div>
                        <small>
                          {section.questions.length}{' '}
                          {section.questions.length === 1 ? 'answer' : 'answers'}
                        </small>
                      </div>
                      <div className={styles.intakeAnswerGrid}>
                        {section.questions.map((question) => {
                          const restricted =
                            question.privacy === 'restricted_shipping' &&
                            !canViewShipping;
                          const value = answerLabel(
                            responseAnswers[question.key],
                            question
                          );
                          return (
                            <article
                              key={question.key}
                              className={`${styles.intakeAnswer} ${
                                question.type === 'long_text'
                                  ? styles.intakeAnswerWide
                                  : ''
                              }`}
                            >
                              <span>{question.prompt}</span>
                              {restricted ? (
                                <p className={styles.restrictedAnswer}>
                                  <LockRoundedIcon aria-hidden="true" />
                                  Restricted to the producer or a Studio manager
                                </p>
                              ) : (
                                <p>{value || 'No answer'}</p>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </section>
                  ))}

                  {!responseSections.length ? (
                    <p className={styles.emptyCopy}>
                      The response was received without reviewable answers.
                    </p>
                  ) : null}

                  {visibleResponseUploadSlots.length ? (
                    <section
                      id="guest-response-files"
                      className={styles.intakeSection}
                      aria-labelledby="guest-response-files-title"
                    >
                      <div className={styles.intakeSectionHeading}>
                        <div>
                          <h3 id="guest-response-files-title">
                            Guest files
                          </h3>
                          <p>Documents, photos, and credits from the guest.</p>
                        </div>
                        <small>
                          {responseFileCount}{' '}
                          {responseFileCount === 1 ? 'file' : 'files'}
                        </small>
                      </div>
                      <div className={styles.intakeFilesGrid}>
                        {visibleResponseUploadSlots.map((slot) => {
                          const responseSlot =
                            responseRecord.upload_slots?.[slot.key] || {};
                          const assets = responseUploadAssets(responseSlot);
                          return (
                            <div
                              key={slot.key}
                              className={styles.intakeFileGroup}
                            >
                              <span>
                                {slot.key === 'resume'
                                  ? 'Resume / CV'
                                  : 'Guest photos'}
                              </span>
                              {assets.length ? (
                                <ul>
                                  {assets.map((asset) => (
                                    <li key={asset.asset_id}>
                                      <a
                                        href={`/api/studio/episodes/${encodeURIComponent(
                                          routeEpisodeId
                                        )}/assets/${encodeURIComponent(
                                          asset.asset_id
                                        )}`}
                                        target="_blank"
                                        rel="noreferrer"
                                      >
                                        {asset.file_name || 'Guest file'}
                                        <OpenInNewRoundedIcon aria-hidden="true" />
                                      </a>
                                      <small>
                                        {fileSizeLabel(
                                          asset.size_bytes || asset.size
                                        )}
                                      </small>
                                    </li>
                                  ))}
                                </ul>
                              ) : (
                                <small>No files received</small>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}
                </div>

                {canApply || applyResult ? (
                  <footer className={styles.intakeReviewFooter}>
                    <div>
                      <strong>Episode Studio connection</strong>
                      <span>
                        Reapplying fills blank fields only. Existing host or
                        producer work is never replaced.
                      </span>
                    </div>
                    {canApply ? (
                      <button
                        type="button"
                        className={styles.applyButton}
                        disabled={applying}
                        onClick={applyResponse}
                      >
                        <CheckCircleRoundedIcon aria-hidden="true" />
                        {applying ? 'Applying…' : 'Reapply to blank fields'}
                      </button>
                    ) : null}
                    {applyResult ? (
                      <div className={styles.applyResult} role="status">
                        <strong>
                          {applyResult.applied.length} field
                          {applyResult.applied.length === 1 ? '' : 's'} filled
                        </strong>
                        <span>
                          {applyResult.skipped.length
                            ? `${applyResult.skipped.length} existing field${
                                applyResult.skipped.length === 1 ? ' was' : 's were'
                              } left unchanged.`
                            : 'No existing Studio work was replaced.'}
                        </span>
                      </div>
                    ) : null}
                  </footer>
                ) : null}
              </section>
            ) : null}

            <div className={styles.layout}>
              <form className={styles.builder} onSubmit={saveConfiguration}>
                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.sectionNumber}>01</span>
                      <div>
                        <p>Guest-facing introduction</p>
                        <h2>Set the welcome and context</h2>
                      </div>
                    </div>
                    <TuneRoundedIcon aria-hidden="true" />
                  </div>
                  <div className={styles.fieldGrid}>
                    <label className={styles.field}>
                      <span>Questionnaire title</span>
                      <input
                        value={questionnaire.title || ''}
                        disabled={!canEdit}
                        maxLength={160}
                        onChange={(event) =>
                          updateQuestionnaire({ title: event.target.value })
                        }
                      />
                    </label>
                    <div className={styles.field}>
                      <span>Welcome message</span>
                      <PlainTextArea
                        value={questionnaire.introduction || ''}
                        disabled={!canEdit}
                        rows={5}
                        maxLength={3000}
                        aria-label="Welcome message"
                        onValueChange={(value) =>
                          updateQuestionnaire({
                            introduction: value,
                          })
                        }
                      />
                      <small>
                        Tell the guest why the information is needed and how it
                        will support the episode.
                      </small>
                    </div>
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.sectionNumber}>02</span>
                      <div>
                        <p>External scheduling</p>
                        <h2>Connect both booking steps</h2>
                      </div>
                    </div>
                    <OpenInNewRoundedIcon aria-hidden="true" />
                  </div>
                  <div className={styles.scheduleStageGrid}>
                    {[
                      {
                        key: 'pre_interview',
                        label: 'Pre-interview / sound check',
                        fallbackPrompt: 'Schedule a pre-interview chat and sound check',
                      },
                      {
                        key: 'interview',
                        label: 'Interview recording',
                        fallbackPrompt: 'Schedule the episode interview',
                      },
                    ].map((stage) => {
                      const value = schedulingStage(
                        questionnaire.scheduling,
                        stage.key
                      );
                      return (
                        <article key={stage.key} className={styles.scheduleStage}>
                          <h3>{stage.label}</h3>
                          <label className={styles.field}>
                            <span>Guest prompt</span>
                            <input
                              value={value.prompt || ''}
                              placeholder={stage.fallbackPrompt}
                              disabled={!canEdit}
                              maxLength={300}
                              onChange={(event) =>
                                updateSchedulingStage(stage.key, {
                                  prompt: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className={styles.field}>
                            <span>Secure scheduling URL</span>
                            <input
                              type="url"
                              inputMode="url"
                              placeholder="https://…"
                              value={value.url || ''}
                              disabled={!canEdit}
                              onChange={(event) =>
                                updateSchedulingStage(stage.key, {
                                  url: event.target.value,
                                })
                              }
                            />
                          </label>
                          <label className={styles.toggleRow}>
                            <input
                              type="checkbox"
                              checked={value.required === true}
                              disabled={!canEdit}
                              onChange={(event) =>
                                updateSchedulingStage(stage.key, {
                                  required: event.target.checked,
                                })
                              }
                            />
                            <span>
                              <strong>Require acknowledgement</strong>
                              <small>
                                The guest confirms they opened this scheduler.
                              </small>
                            </span>
                          </label>
                        </article>
                      );
                    })}
                  </div>
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.sectionNumber}>03</span>
                      <div>
                        <p>Question builder</p>
                        <h2>Shape the guest intake</h2>
                      </div>
                    </div>
                    <span className={styles.countPill}>
                      {orderedQuestions.filter((question) => question.visible).length}{' '}
                      visible
                    </span>
                  </div>

                  <div className={styles.questionGroups}>
                    {questionGroups.map((group, groupIndex) => (
                      <details
                        key={group.id}
                        className={styles.questionGroup}
                        defaultOpen={groupIndex === 0 || group.id === 'additional'}
                      >
                        <summary>
                          <span>
                            <strong>{group.label}</strong>
                            <small>{group.description}</small>
                          </span>
                          <em>
                            {group.questions.filter((question) => question.visible)
                              .length}{' '}
                            shown
                          </em>
                        </summary>
                        <div className={styles.questionList}>
                          {group.questions.map((question, groupQuestionIndex) => (
                            <QuestionEditorCard
                              key={question.key}
                              question={question}
                              index={orderedQuestions.findIndex(
                                (candidate) => candidate.key === question.key
                              )}
                              groupIndex={groupQuestionIndex}
                              groupLength={group.questions.length}
                              canEdit={canEdit}
                              onMove={(key, direction) =>
                                moveQuestion(key, direction, group.questions)
                              }
                              onRemove={removeQuestion}
                              onUpdate={updateQuestion}
                            />
                          ))}
                          {!group.questions.length ? (
                            <p className={styles.emptyGroup}>
                              Add an episode-specific question below.
                            </p>
                          ) : null}
                        </div>
                      </details>
                    ))}
                  </div>

                  {canEdit ? (
                    <div className={styles.addQuestionBar}>
                      <label>
                        <span className="sr-only">New question type</span>
                        <select
                          value={newQuestionType}
                          onChange={(event) =>
                            setNewQuestionType(event.target.value)
                          }
                        >
                          {Object.entries(QUESTION_TYPES).map(([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <button type="button" onClick={addQuestion}>
                        <AddRoundedIcon aria-hidden="true" />
                        Add custom question
                      </button>
                    </div>
                  ) : null}
                </section>

                <section className={styles.panel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.sectionNumber}>04</span>
                      <div>
                        <p>Secure files</p>
                        <h2>Set the resume and photo handoff</h2>
                      </div>
                    </div>
                    <LockRoundedIcon aria-hidden="true" />
                  </div>
                  <p className={styles.sectionIntro}>
                    Guest files upload directly into protected episode storage.
                    Set clear expectations here; photo limits can range from one
                    to ten files.
                  </p>
                  <div className={styles.uploadSlotGrid}>
                    {configuredUploadSlots.map((slot) => {
                      const hardMaximum = slot.key === 'resume' ? 1 : 10;
                      const minimum = Math.max(
                        1,
                        Math.min(
                          Number(slot.min_count || 1),
                          Number(slot.max_count || hardMaximum)
                        )
                      );
                      const maximum = Math.max(
                        minimum,
                        Math.min(
                          hardMaximum,
                          Number(slot.max_count || hardMaximum)
                        )
                      );
                      return (
                        <article key={slot.key} className={styles.uploadSlotCard}>
                          <div className={styles.uploadSlotHeading}>
                            <div>
                              <span>{slot.key === 'resume' ? 'Document' : 'Images'}</span>
                              <h3>
                                {slot.key === 'resume'
                                  ? 'Resume or CV'
                                  : 'Guest photos'}
                              </h3>
                            </div>
                            <label className={styles.compactToggle}>
                              <input
                                type="checkbox"
                                checked={slot.visible !== false}
                                disabled={!canEdit}
                                onChange={(event) =>
                                  updateUploadSlot(slot.key, {
                                    visible: event.target.checked,
                                    ...(event.target.checked
                                      ? { status: 'enabled' }
                                      : {}),
                                  })
                                }
                              />
                              Show
                            </label>
                          </div>
                          <label className={styles.field}>
                            <span>Guest prompt</span>
                            <input
                              value={slot.prompt || ''}
                              disabled={!canEdit}
                              maxLength={500}
                              onChange={(event) =>
                                updateUploadSlot(slot.key, {
                                  prompt: event.target.value,
                                })
                              }
                            />
                          </label>
                          <div className={styles.field}>
                            <span>Upload guidance</span>
                            <PlainTextArea
                              value={slot.help_text || ''}
                              disabled={!canEdit}
                              rows={3}
                              maxLength={1200}
                              aria-label={`Upload guidance for ${
                                slot.prompt || slot.key
                              }`}
                              onValueChange={(value) =>
                                updateUploadSlot(slot.key, { help_text: value })
                              }
                            />
                          </div>
                          <div className={styles.uploadSlotSettings}>
                            <label className={styles.compactToggle}>
                              <input
                                type="checkbox"
                                checked={slot.required === true}
                                disabled={
                                  !canEdit || slot.visible === false
                                }
                                onChange={(event) =>
                                  updateUploadSlot(slot.key, {
                                    required: event.target.checked,
                                  })
                                }
                              />
                              Required
                            </label>
                            <label>
                              <span>Minimum</span>
                              <select
                                value={minimum}
                                disabled={
                                  !canEdit ||
                                  slot.key === 'resume' ||
                                  slot.visible === false
                                }
                                onChange={(event) => {
                                  const nextMinimum = Number(event.target.value);
                                  updateUploadSlot(slot.key, {
                                    min_count: nextMinimum,
                                    max_count: Math.max(maximum, nextMinimum),
                                  });
                                }}
                              >
                                {Array.from({ length: hardMaximum }, (_, index) => (
                                  <option key={index + 1} value={index + 1}>
                                    {index + 1}
                                  </option>
                                ))}
                              </select>
                            </label>
                            <label>
                              <span>Maximum</span>
                              <select
                                value={maximum}
                                disabled={
                                  !canEdit ||
                                  slot.key === 'resume' ||
                                  slot.visible === false
                                }
                                onChange={(event) => {
                                  const nextMaximum = Number(event.target.value);
                                  updateUploadSlot(slot.key, {
                                    max_count: nextMaximum,
                                    min_count: Math.min(minimum, nextMaximum),
                                  });
                                }}
                              >
                                {Array.from({ length: hardMaximum }, (_, index) => (
                                  <option key={index + 1} value={index + 1}>
                                    {index + 1}
                                  </option>
                                ))}
                              </select>
                            </label>
                          </div>
                        </article>
                      );
                    })}
                  </div>
                </section>

                {canEdit ? (
                  <div className={styles.stickySaveBar}>
                    <div>
                      <strong>{dirty ? 'Unsaved changes' : 'Questionnaire saved'}</strong>
                      <span>
                        {dirty
                          ? 'Save before issuing or replacing the guest link.'
                          : 'The shareable form matches this setup.'}
                      </span>
                    </div>
                    <button type="submit" disabled={!dirty || saving}>
                      <SaveRoundedIcon aria-hidden="true" />
                      {saving ? 'Saving…' : 'Save questionnaire'}
                    </button>
                  </div>
                ) : null}
              </form>

              <aside className={styles.sidebar}>
                <section className={styles.sidePanel}>
                  <div className={styles.sidePanelHeading}>
                    <div>
                      <span>Private access</span>
                      <h2>Guest link</h2>
                    </div>
                    <LinkRoundedIcon aria-hidden="true" />
                  </div>
                  <p>
                    The link is episode-specific, expires automatically, and can
                    be revoked. Only send it to the intended guest.
                  </p>
                  {sharePath && responseRecord?.status !== 'submitted' ? (
                    <div className={styles.shareResult}>
                      <label>
                        <span>Current active link · shown once</span>
                        <input readOnly value={shareUrlFromPath(sharePath)} />
                      </label>
                      <button type="button" onClick={copyShareLink}>
                        <ContentCopyRoundedIcon aria-hidden="true" />
                        Copy current link
                      </button>
                      <small>
                        Copying keeps this same link. Studio does not message the
                        guest for you—send it in your usual channel, then mark it
                        as sent below.
                      </small>
                    </div>
                  ) : activeLink ? (
                    <div className={styles.activeLinkNotice}>
                      <CheckCircleRoundedIcon aria-hidden="true" />
                      <span>
                        <strong>
                          {linkShared
                            ? 'Guest link shared'
                            : 'A guest link is active'}
                        </strong>
                        <small>
                          {canIssue
                            ? 'The complete URL is only shown when it is created. To resend the same link, use the copy in your message history; otherwise issue a replacement below.'
                            : responseRecord?.status === 'submitted'
                              ? 'The saved response is locked. Revoke this link below if guest access should end immediately.'
                              : 'This link cannot be replaced at the current episode stage. Revoke it below if access should end immediately.'}
                        </small>
                      </span>
                    </div>
                  ) : null}
                  {activeLink && canIssue ? (
                    <div
                      className={styles.linkChoiceGuide}
                      aria-label="Choose how to share guest access"
                    >
                      <div>
                        <span>Copy or resend</span>
                        <strong>Keep the current link</strong>
                        <p>
                          Best when the intended guest simply needs the same
                          link again. This does not create new access.
                        </p>
                      </div>
                      <div className={styles.linkChoiceReplacement}>
                        <span>New or reissue</span>
                        <strong>Issue a replacement link</strong>
                        <p>
                          Creates a fresh URL for the guest. The current link
                          stops working immediately. To change questions too,
                          revoke first, edit and save, then issue the new link.
                        </p>
                      </div>
                    </div>
                  ) : !activeLink && previouslyIssuedLink ? (
                    <div className={styles.linkLifecycleNote}>
                      <strong>{currentLinkStatus} access stays closed</strong>
                      <span>
                        {canIssue
                          ? 'Issue a new link only when the guest should regain access. The earlier link will remain invalid.'
                          : 'A new link is not available at the current episode stage. Responses already saved in Studio remain preserved.'}
                      </span>
                    </div>
                  ) : null}
                  {canIssue ? (
                    <>
                      <label className={styles.expirationField}>
                        <span>
                          {activeLink
                            ? 'Replacement expires after'
                            : 'Link expires after'}
                        </span>
                        <select
                          value={expiresInDays}
                          disabled={linkBusy}
                          onChange={(event) =>
                            setExpiresInDays(Number(event.target.value))
                          }
                        >
                          {LINK_EXPIRATION_OPTIONS.map((days) => (
                            <option key={days} value={days}>
                              {days} days
                            </option>
                          ))}
                        </select>
                      </label>
                      <div className={styles.linkActions}>
                        <button
                          type="button"
                          className={styles.primaryAction}
                          disabled={
                            dirty ||
                            linkBusy ||
                            !configured ||
                            !uploadsConfigured
                          }
                          onClick={() => issueLink({ regenerate: activeLink })}
                        >
                          {activeLink ? (
                            <RefreshRoundedIcon aria-hidden="true" />
                          ) : (
                            <SendRoundedIcon aria-hidden="true" />
                          )}
                          {linkBusy
                            ? 'Working…'
                            : activeLink
                              ? 'Issue replacement link'
                              : previouslyIssuedLink
                                ? 'Issue new guest link'
                                : 'Create guest link'}
                        </button>
                        {activeLink && canRevoke ? (
                          <button
                            type="button"
                            className={styles.dangerAction}
                            disabled={dirty || linkBusy}
                            onClick={revokeLink}
                          >
                            Revoke access
                          </button>
                        ) : null}
                      </div>
                      {activeLink && !linkShared ? (
                        <button
                          type="button"
                          className={styles.markSharedButton}
                          disabled={dirty || linkBusy}
                          onClick={markLinkShared}
                        >
                          <CheckCircleRoundedIcon aria-hidden="true" />
                          Mark as sent to guest
                        </button>
                      ) : null}
                    </>
                  ) : null}
                  {activeLink ? (
                    <div className={styles.revokeGuidance}>
                      <strong>Revoke only to stop access now</strong>
                      <span>
                        Use revoke for a wrong recipient, a compromised link, or
                        access that is no longer needed. Revoking the link does
                        not delete responses already saved in Studio.
                      </span>
                    </div>
                  ) : null}
                  {!canIssue && canRevoke && activeLink ? (
                    <button
                      type="button"
                      className={styles.readOnlyRevokeButton}
                      disabled={dirty || linkBusy}
                      onClick={revokeLink}
                    >
                      {linkBusy ? 'Revoking…' : 'Revoke guest access'}
                    </button>
                  ) : null}
                  {responseRecord?.status === 'submitted' ? (
                    <div className={styles.submittedUpdateNote}>
                      <strong>Need a corrected guest response?</strong>
                      <span>
                        {canRequestUpdate
                          ? 'Requesting an update creates a fresh link that is shown once and invalidates any earlier link. The previous submission remains current until the guest resubmits. Non-shipping answers are prefilled; restricted shipping details must be entered again.'
                          : 'Only the assigned producer or a Studio manager can request a corrected response. The preserved submission remains available here for review.'}
                      </span>
                      {canRequestUpdate ? (
                        <>
                          <label className={styles.expirationField}>
                            <span>Update link expires after</span>
                            <select
                              value={expiresInDays}
                              disabled={linkBusy}
                              onChange={(event) =>
                                setExpiresInDays(Number(event.target.value))
                              }
                            >
                              {LINK_EXPIRATION_OPTIONS.map((days) => (
                                <option key={days} value={days}>
                                  {days} days
                                </option>
                              ))}
                            </select>
                          </label>
                          <button
                            type="button"
                            className={styles.requestUpdateButton}
                            disabled={dirty || linkBusy || !uploadsConfigured}
                            onClick={requestResponseUpdate}
                          >
                            <RefreshRoundedIcon aria-hidden="true" />
                            {linkBusy
                              ? 'Creating update link…'
                              : 'Request update + create link'}
                          </button>
                        </>
                      ) : null}
                    </div>
                  ) : responseUpdateRequested ? (
                    <div
                      className={`${styles.submittedUpdateNote} ${styles.updateRequestedNote}`}
                    >
                      <strong>Waiting for the corrected response</strong>
                      <span>
                        The previous submission remains current until the guest
                        resubmits. Copy and send the fresh link above. The guest
                        sees their non-shipping answers prefilled and must
                        re-enter restricted shipping details. Revoking access
                        cancels this update request and restores the previous
                        submitted state.
                      </span>
                    </div>
                  ) : null}
                </section>

                {!responseReceived ? (
                  <section className={styles.sidePanel}>
                    <div className={styles.sidePanelHeading}>
                      <div>
                        <span>Submitted intake</span>
                        <h2>Guest response</h2>
                      </div>
                      <button
                        type="button"
                        className={styles.iconButton}
                        aria-label="Refresh guest response"
                        onClick={refreshResponse}
                      >
                        <RefreshRoundedIcon aria-hidden="true" />
                      </button>
                    </div>
                    <p className={styles.emptyCopy}>
                      No submitted response yet. The guest’s answers will appear
                      here for review without exposing the internal publishing
                      package.
                    </p>
                  </section>
                ) : null}

                <section className={styles.privacyPanel}>
                  <LockRoundedIcon aria-hidden="true" />
                  <div>
                    <strong>Private data stays separated</strong>
                    <p>
                      Shipping details are restricted and are never copied into
                      general Episode Studio notes. Guest links do not expose
                      private proofs or publishing links.
                    </p>
                  </div>
                </section>
              </aside>
            </div>
          </>
        ) : null}
      </main>
    </Layout>
  );
}
