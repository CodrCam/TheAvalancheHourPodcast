import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/router';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import SettingsRoundedIcon from '@mui/icons-material/SettingsRounded';
import AdminLayout from './AdminLayout';
import FriendlyDateField from './FriendlyDateField';
import PlainTextArea from './PlainTextArea';
import StudioLayout from './StudioLayout';
import {
  EpisodeRecordingFields,
  EpisodeRecordingSummary,
} from './EpisodeRecordingSchedule';
import EpisodeStudioDeletionControl from './EpisodeStudioDeletionControl';
import EpisodeProductionBoard from './EpisodeProductionBoard';
import EpisodeProductionTaskWorkspace from './EpisodeProductionTaskWorkspace';
import EpisodeProductionTaskEditor from './EpisodeProductionTaskEditor';
import EpisodeProductionWorkDrawer from './EpisodeProductionWorkDrawer';
import EpisodeCommunicationClipboard from './EpisodeCommunicationClipboard';
import EpisodeStudioSettingsDrawer from './EpisodeStudioSettingsDrawer';
import EpisodeGuestDetailsFields from './EpisodeGuestDetailsFields';
import EpisodeMicKitStep from './EpisodeMicKitStep';
import EpisodePhotoSelectionReview from './EpisodePhotoSelectionReview';
import EpisodeChecklistWorkspace, {
  EpisodeChecklistBuilderList,
  EpisodeChecklistBuilderRow,
} from './EpisodeChecklistWorkspace';
import {
  EPISODE_ASSET_RETENTION_DAYS,
  MAX_EPISODE_DELIVERABLES,
  REQUIRED_EPISODE_DELIVERABLE_IDS,
  getEpisodeCompletion,
  isEpisodeAssetExpired,
  isDeliverableComplete,
  mergeEpisodeStudioServerFields,
} from '../lib/episodeStudioPresentation.mjs';
import { getEpisodeProductionPlanSummary } from '../lib/episodeProductionPlan.mjs';
import { getEpisodeStudioActionBlockers } from '../lib/episodeStudioActionReadiness.mjs';
import {
  canDeleteEpisodeAsset,
  EPISODE_ASSET_MAX_BYTES,
  findDuplicateEpisodeAsset,
  getEpisodeAssetAccept,
  getEpisodeAssetTypeLabel,
  validateEpisodeAssetInput,
} from '../lib/episodeAssetPolicy.mjs';
import {
  completeEpisodeAssetUpload,
  episodeAssetStorageRejectionMessage,
  episodeAssetUploadStageError,
  isEpisodeAssetUploadReadyForCompletion,
  shouldReconcileEpisodeAssetUpload,
  uploadAuthorizedFile,
} from '../lib/episodeAssetUploadClient.mjs';
import {
  buildEpisodeCalendarFile,
  episodeCalendarFilename,
} from '../lib/episodeCalendar.mjs';
import { storeEpisodeStudioDeletionNotice } from '../lib/episodeStudioDeletionNotice.mjs';
import styles from '../styles/EpisodeStudio.module.css';

const STATUS_LABELS = {
  planning: 'Planning',
  in_progress: 'Host in progress',
  submitted: 'Ready for production',
  submitted_with_gaps: 'Producer working · known gaps',
  needs_changes: 'Changes requested',
  accepted: 'Accepted by producer',
};

const LOCKED_HOST_STATUSES = [
  'submitted',
  'submitted_with_gaps',
  'accepted',
];

const PRODUCTION_BOARD_PHASE_IDS = [
  'host_preparation',
  'producer_review',
  'publishing',
  'release_coordination',
];

const DELIVERY_HEALTH_FIELDS = [
  'delivery_health',
  'delivery_health_updated_at',
  'delivery_health_updated_by_person_id',
  'delivery_health_updated_by_name',
  'delivery_health_updated_by_role',
  'updated_at',
];

const REVIEW_RESPONSE_FIELDS = [
  'status',
  'producer_feedback',
  'staged_episode_url',
  'production_stage',
  'production_lead_person_id',
  'production_handoff_at',
  'production_completed_at',
  'production_advanced_by_person_id',
  'production_advanced_by_name',
  'reviewed_at',
  'updated_at',
];

const MESSAGE_RESPONSE_FIELDS = ['messages', 'updated_at'];
const COMMUNICATION_NOTE_RESPONSE_FIELDS = ['producer_feedback', 'updated_at'];
const CHECKLIST_RESPONSE_FIELDS = [
  'deliverables',
  'canonical_assets_required',
  'updated_at',
];

const WORKFLOW_TASK_RESPONSE_FIELDS = [
  'production_workflow_updated_at',
  'production_workflow_updated_by_person_id',
  'production_workflow_updated_by_name',
  'updated_at',
];

const WORKFLOW_DEFINITION_RESPONSE_FIELDS = [
  'production_tasks',
  ...WORKFLOW_TASK_RESPONSE_FIELDS,
];

const ASSET_CATEGORY_LABELS = {
  recording: 'Final voice and episode audio',
  image: 'Episode images and artwork',
  document: 'Notes and production documents',
  sponsor_audio: 'Separate sponsor and ad spots',
  other: 'Other final assets',
};

const CHECKLIST_RESPONSE_TYPE_LABELS = {
  textarea: 'Written response',
  asset: 'File upload',
  url: 'Optional working-source link',
};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatShortDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}

function dateDaysBefore(value, days = 0) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return '';
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() - Number(days || 0));
  return date.toISOString().slice(0, 10);
}

function workflowTaskIsComplete(task = {}) {
  return ['complete', 'waived'].includes(task.status);
}

function workflowTaskIsOverdue(task = {}, today = '') {
  const now = new Date();
  const localToday = `${now.getFullYear()}-${String(
    now.getMonth() + 1
  ).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
  const comparisonDate = /^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))
    ? today
    : localToday;
  return (
    task.required !== false &&
    !workflowTaskIsComplete(task) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(task.due_date || '')) &&
    task.due_date < comparisonDate
  );
}

function mergeWorkflowTaskResponse(currentEpisode, serverEpisode, taskId) {
  if (!currentEpisode || !serverEpisode || !taskId) return currentEpisode;
  const serverTask = (serverEpisode.production_tasks || []).find(
    (task) => task.task_id === taskId
  );
  if (!serverTask) return currentEpisode;

  const merged = {
    ...currentEpisode,
    production_tasks: (currentEpisode.production_tasks || []).map((task) =>
      task.task_id === taskId ? serverTask : task
    ),
  };
  for (const field of WORKFLOW_TASK_RESPONSE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(serverEpisode, field)) {
      merged[field] = serverEpisode[field];
    }
  }
  return merged;
}

function formatWorkflowPhase(value = '') {
  const label = String(value || 'Production').replace(/_/g, ' ');
  return label.charAt(0).toUpperCase() + label.slice(1);
}

function moveProductionTaskTiles(
  tasks = [],
  taskId = '',
  targetPhase = '',
  targetIndex = 0
) {
  if (!PRODUCTION_BOARD_PHASE_IDS.includes(targetPhase)) return tasks;
  const orderedTasks = [...tasks].sort(
    (left, right) =>
      Number(left.sort_order || 0) - Number(right.sort_order || 0)
  );
  const movingTask = orderedTasks.find((task) => task.task_id === taskId);
  if (!movingTask) return tasks;

  const phaseTasks = new Map(
    PRODUCTION_BOARD_PHASE_IDS.map((phaseId) => [phaseId, []])
  );
  const historicalTasks = [];
  orderedTasks.forEach((task) => {
    if (task.task_id === taskId) return;
    const matchingPhase = phaseTasks.get(task.phase);
    if (matchingPhase) matchingPhase.push(task);
    else historicalTasks.push(task);
  });

  const destinationTasks = phaseTasks.get(targetPhase);
  const insertionIndex = Math.min(
    Math.max(0, Math.trunc(Number(targetIndex) || 0)),
    destinationTasks.length
  );
  destinationTasks.splice(insertionIndex, 0, {
    ...movingTask,
    phase: targetPhase,
  });

  return [
    ...PRODUCTION_BOARD_PHASE_IDS.flatMap(
      (phaseId) => phaseTasks.get(phaseId) || []
    ),
    ...historicalTasks,
  ].map((task, index) => ({
    ...task,
    sort_order: (index + 1) * 10,
  }));
}

function mergeEpisodeMicKitPlanResponse(currentEpisode, response = {}) {
  if (!currentEpisode || !Array.isArray(response.plans)) {
    return currentEpisode;
  }
  const micKitPlans = response.plans
    .filter((plan) => Boolean(String(plan?.choice || '').trim()))
    .map((plan) => ({
      host_person_id: String(plan?.host_person_id || ''),
      choice: String(plan?.choice || ''),
      request_id: String(plan?.request_id || ''),
      equipment_note: String(plan?.equipment_note || ''),
    }));
  const guestPlanSource =
    response.guest_plan && typeof response.guest_plan === 'object'
      ? response.guest_plan
      : null;
  const guestMicKitPlan = guestPlanSource
    ? {
        guest_name: String(guestPlanSource.guest_name || ''),
        choice: String(guestPlanSource.choice || ''),
        request_id: String(guestPlanSource.request_id || ''),
        equipment_note: String(guestPlanSource.equipment_note || ''),
        response_revision: Math.max(
          0,
          Math.trunc(Number(guestPlanSource.response_revision) || 0)
        ),
        readiness: {
          internet: String(guestPlanSource.readiness?.internet || ''),
          microphone: String(guestPlanSource.readiness?.microphone || ''),
          headphones: String(guestPlanSource.readiness?.headphones || ''),
          quiet_place: String(guestPlanSource.readiness?.quiet_place || ''),
        },
      }
    : null;
  return {
    ...currentEpisode,
    updated_at:
      String(response.episode_updated_at || '') || currentEpisode.updated_at,
    deliverables: (currentEpisode.deliverables || []).map((deliverable) =>
      deliverable.id === 'mic-kit-plan'
        ? {
            ...deliverable,
            mic_kit_plans: micKitPlans,
            ...(guestMicKitPlan
              ? { guest_mic_kit_plan: guestMicKitPlan }
              : null),
          }
        : deliverable
    ),
  };
}

function formatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRetentionDate(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString(undefined, {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatBytes(value) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${bytes} B`;
}

function formatCapacity(value) {
  const bytes = Number(value) || 0;
  if (bytes >= 1024 * 1024 * 1024) {
    return `${Number((bytes / (1024 * 1024 * 1024)).toFixed(1))} GB`;
  }
  if (bytes >= 1024 * 1024) {
    return `${Number((bytes / (1024 * 1024)).toFixed(1))} MB`;
  }
  return formatBytes(bytes);
}

function formatUploadTimeRemaining(value) {
  const seconds = Math.max(0, Math.round(Number(value) || 0));
  if (!seconds) return 'Finishing…';
  if (seconds < 5) return 'A few seconds';
  if (seconds < 60) return `about ${seconds}s left`;
  const minutes = Math.ceil(seconds / 60);
  return `about ${minutes} min left`;
}

function formatUploadDuration(value) {
  const seconds = Math.max(1, Math.round(Number(value) || 0));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return remainingSeconds
    ? `${minutes}m ${remainingSeconds}s`
    : `${minutes}m`;
}

function assetLimitForInput(input = {}) {
  const contentType = String(input.content_type || '').toLowerCase();
  if (contentType.startsWith('audio/')) {
    return EPISODE_ASSET_MAX_BYTES.audio;
  }
  if (contentType.startsWith('video/')) {
    return EPISODE_ASSET_MAX_BYTES.video;
  }
  if (contentType.startsWith('image/')) {
    return EPISODE_ASSET_MAX_BYTES.image;
  }
  return EPISODE_ASSET_MAX_BYTES.document;
}

function assetCapacityItems(category) {
  if (['recording', 'sponsor_audio'].includes(category)) {
    return [['Audio', EPISODE_ASSET_MAX_BYTES.audio]];
  }
  if (category === 'image') {
    return [['Images', EPISODE_ASSET_MAX_BYTES.image]];
  }
  if (category === 'document') {
    return [['Documents', EPISODE_ASSET_MAX_BYTES.document]];
  }
  return [
    ['Audio', EPISODE_ASSET_MAX_BYTES.audio],
    ['Video', EPISODE_ASSET_MAX_BYTES.video],
    ['Documents', EPISODE_ASSET_MAX_BYTES.document],
    ['Images', EPISODE_ASSET_MAX_BYTES.image],
  ];
}

function assetUploadHelp(category) {
  if (['recording', 'sponsor_audio'].includes(category)) {
    return 'WAV, MP3, M4A, AAC, AIFF, FLAC, Ogg, Opus, or CAF audio · up to 1.5 GB per file';
  }
  if (category === 'image') {
    return 'JPG, PNG, GIF, WebP, AVIF, TIFF, HEIC, HEIF, or BMP · up to 30 MB per file';
  }
  if (category === 'document') {
    return 'PDF, DOCX, text, spreadsheet, presentation, transcript, JSON, or EDL · up to 75 MB per file';
  }
  return 'Safe audio and video, common raster images, documents, spreadsheets, presentations, transcripts, and edit lists · images up to 30 MB, documents up to 75 MB, audio up to 1.5 GB, video up to 750 MB';
}

function readableUploadError(error) {
  return String(error?.message || error || 'Could not upload this file.')
    .replace(/^Episode asset:\s*/i, '')
    .trim();
}

function EpisodeStudioPreviewLayout({ children }) {
  return (
    <main className={styles.previewShell}>
      <div>{children}</div>
    </main>
  );
}

function episodeStudioListHref({ admin = false, canManage = false } = {}) {
  if (admin) return '/admin/studios';
  return canManage ? '/studio/manage/episodes' : '/studio/episodes';
}

function rememberDeletionNotice(value) {
  if (typeof window === 'undefined') return;
  storeEpisodeStudioDeletionNotice(window.sessionStorage, value);
}

export default function EpisodeStudioWorkspace({
  admin = false,
  previewData = null,
  workspaceView = 'package',
}) {
  const router = useRouter();
  const episodeId = String(router.query.episodeId || '');
  const [episode, setEpisode] = useState(() => previewData?.episode || null);
  const [hostNames, setHostNames] = useState(
    () => previewData?.host_names || []
  );
  const [people, setPeople] = useState(() => previewData?.people || []);
  const [producers, setProducers] = useState(
    () => previewData?.producers || []
  );
  const [canManage, setCanManage] = useState(
    () => previewData?.canManage === true
  );
  const [canHost, setCanHost] = useState(
    () => previewData?.canHost === true
  );
  const [canReview, setCanReview] = useState(
    () => previewData?.canReview === true
  );
  const [canConfigure, setCanConfigure] = useState(
    () => previewData?.canConfigure === true
  );
  const [canAdminOverride, setCanAdminOverride] = useState(
    () => previewData?.canAdminOverride === true
  );
  const [canAdvanceProduction, setCanAdvanceProduction] = useState(
    () => previewData?.canAdvanceProduction === true
  );
  const [productionHandoffAvailable, setProductionHandoffAvailable] =
    useState(() => previewData?.production_handoff_available !== false);
  const [productionLeadName, setProductionLeadName] = useState(
    () => previewData?.production_lead_name || ''
  );
  const [episodeRoles, setEpisodeRoles] = useState(
    () => previewData?.episode_roles || []
  );
  const [viewerPersonId, setViewerPersonId] = useState(
    () => previewData?.viewer_person_id || ''
  );
  const [availableSponsorReads, setAvailableSponsorReads] = useState(
    () => previewData?.available_sponsor_reads || []
  );
  const [selectedSponsorReadId, setSelectedSponsorReadId] = useState('');
  const [sponsorRequiresAudio, setSponsorRequiresAudio] = useState(true);
  const [sponsorRecordingMode, setSponsorRecordingMode] = useState(
    'separate_upload'
  );
  const [assetUploadsConfigured, setAssetUploadsConfigured] = useState(
    () => previewData?.asset_uploads_configured === true
  );
  const [canUploadAssets, setCanUploadAssets] = useState(
    () => previewData?.canUploadAssets === true
  );
  const [canUseHostPreview, setCanUseHostPreview] = useState(
    () => previewData?.canUseHostPreview === true
  );
  const [hostPreviewActive, setHostPreviewActive] = useState(
    () => previewData?.hostPreview === true
  );
  const [hostPreviewReadOnly, setHostPreviewReadOnly] = useState(
    () => previewData?.hostPreviewReadOnly === true
  );
  const [uploadingAsset, setUploadingAsset] = useState('');
  const [uploadingDeliverableId, setUploadingDeliverableId] = useState('');
  const [deletingAssetId, setDeletingAssetId] = useState('');
  const [deletingStudio, setDeletingStudio] = useState(false);
  const [assetUploadFeedback, setAssetUploadFeedback] = useState({});
  const [baseline, setBaseline] = useState(() =>
    previewData?.episode ? JSON.stringify(previewData.episode) : ''
  );
  const [loading, setLoading] = useState(() => !previewData);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [deletionRedirectMessage, setDeletionRedirectMessage] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [workflowTaskDrafts, setWorkflowTaskDrafts] = useState({});
  const [workflowTaskEditor, setWorkflowTaskEditor] = useState(null);
  const [workflowTaskWorkId, setWorkflowTaskWorkId] = useState('');
  const [workflowDisplay, setWorkflowDisplay] = useState('board');
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [checklistMode, setChecklistMode] = useState('view');
  const [pendingChecklistFocusId, setPendingChecklistFocusId] = useState('');
  const [micKitPlanDirty, setMicKitPlanDirty] = useState(false);
  const [micKitLiveStatus, setMicKitLiveStatus] = useState(null);
  const checklistFocusFrameRef = useRef(null);
  const activeMicKitEpisodeId = String(
    episode?.episode_id || episodeId || ''
  );
  const activeMicKitHostIdsKey = (episode?.host_person_ids || [])
    .map((hostPersonId) => String(hostPersonId || ''))
    .filter(Boolean)
    .sort()
    .join('|');

  useEffect(() => {
    if (!pendingChecklistFocusId || checklistMode !== 'customize') return;
    checklistFocusFrameRef.current = window.requestAnimationFrame(() => {
      const field = document.getElementById(
        `checklist-label-${pendingChecklistFocusId}`
      );
      field?.focus();
      field?.scrollIntoView({ block: 'center', behavior: 'smooth' });
      setPendingChecklistFocusId('');
    });
    return () => window.cancelAnimationFrame(checklistFocusFrameRef.current);
  }, [checklistMode, episode?.deliverables, pendingChecklistFocusId]);

  useEffect(() => {
    if (previewData) return undefined;
    if (!router.isReady || !episodeId) return;
    let alive = true;

    async function loadEpisode() {
      setLoading(true);
      setError('');
      try {
        const viewQuery =
          router.query.view === 'host' ? '?view=host' : '';
        const response = await fetch(
          `/api/studio/episodes/${encodeURIComponent(episodeId)}${viewQuery}`,
          { credentials: 'same-origin' }
        );
        const data = await response.json();
        if (!response.ok) {
          if (data.code === 'EPISODE_STUDIO_DELETED') {
            if (!alive) return;
            const redirectHref = episodeStudioListHref({
              admin,
              canManage: data.canManage === true,
            });
            rememberDeletionNotice({ status: 'deleted' });
            setDeletionRedirectMessage(
              'This Episode Studio was already permanently deleted.'
            );
            await router.replace(redirectHref);
            return;
          }
          throw new Error(data.error || 'Could not open this Episode Studio.');
        }
        if (!alive) return;
        setEpisode(data.episode);
        setHostNames(data.host_names || []);
        setPeople(data.people || []);
        setProducers(data.producers || []);
        setCanManage(data.canManage === true);
        setCanHost(data.canHost === true);
        setCanReview(data.canReview === true);
        setCanConfigure(data.canConfigure === true);
        setCanAdminOverride(data.canAdminOverride === true);
        setCanAdvanceProduction(data.canAdvanceProduction === true);
        setProductionHandoffAvailable(
          data.production_handoff_available !== false
        );
        setProductionLeadName(data.production_lead_name || '');
        setEpisodeRoles(data.episode_roles || []);
        setViewerPersonId(data.viewer_person_id || '');
        setAvailableSponsorReads(data.available_sponsor_reads || []);
        setAssetUploadsConfigured(data.asset_uploads_configured === true);
        setCanUploadAssets(data.canUploadAssets === true);
        setCanUseHostPreview(data.canUseHostPreview === true);
        setHostPreviewActive(data.hostPreview === true);
        setHostPreviewReadOnly(data.hostPreviewReadOnly === true);
        setBaseline(JSON.stringify(data.episode));
      } catch (err) {
        if (alive) setError(err.message || 'Could not open this Episode Studio.');
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadEpisode();
    return () => {
      alive = false;
    };
  }, [admin, episodeId, previewData, router, router.isReady, router.query.view]);

  const completion = useMemo(() => {
    if (!episode) return getEpisodeCompletion({});
    const hasMicKitPlan = (episode.deliverables || []).some(
      (deliverable) => deliverable.id === 'mic-kit-plan'
    );
    if (!hasMicKitPlan) return getEpisodeCompletion(episode);

    const currentHostIdsKey = (episode.host_person_ids || [])
      .map((hostPersonId) => String(hostPersonId || ''))
      .filter(Boolean)
      .sort()
      .join('|');
    const hasLiveStatus = Boolean(
      micKitLiveStatus?.episodeId === episode.episode_id &&
        micKitLiveStatus.hostIdsKey === currentHostIdsKey
    );
    return getEpisodeCompletion(episode, {
      deliverableCompletion: {
        'mic-kit-plan':
          hasLiveStatus && micKitLiveStatus.complete === true,
      },
    });
  }, [episode, micKitLiveStatus]);
  const workflowSummary = useMemo(
    () => getEpisodeProductionPlanSummary(episode || {}),
    [episode]
  );
  const workflowTaskStateById = useMemo(
    () =>
      new Map(
        (workflowSummary.task_states || []).map((state) => [
          state.task_id,
          state,
        ])
      ),
    [workflowSummary]
  );
  const overdueWorkflowTaskIds = new Set(
    workflowSummary.overdue_task_ids || []
  );
  const overdueWorkflowTasks = (episode?.production_tasks || []).filter(
    (task) => overdueWorkflowTaskIds.has(task.task_id)
  );
  const automaticOffTrack = workflowSummary.off_track === true;
  const healthLocked =
    episode?.status === 'accepted' && !(episode?.production_tasks || []).length;
  const offTrack =
    automaticOffTrack || (!healthLocked && episode?.delivery_health === 'off_track');
  const dirty = Boolean(episode && JSON.stringify(episode) !== baseline);
  const baselineProductionTaskById = useMemo(() => {
    try {
      const savedEpisode = JSON.parse(baseline || '{}');
      return new Map(
        (savedEpisode.production_tasks || []).map((task) => [
          task.task_id,
          task,
        ])
      );
    } catch {
      return new Map();
    }
  }, [baseline]);
  const workflowScheduleChangeCount = (episode?.production_tasks || []).filter(
    workflowScheduleTaskChanged
  ).length;
  const workflowTaskDraftDirty = Object.keys(workflowTaskDrafts).length > 0;
  const checklistDirty = useMemo(() => {
    if (!episode || !baseline) return false;
    try {
      const savedEpisode = JSON.parse(baseline);
      return (
        JSON.stringify(savedEpisode.deliverables || []) !==
          JSON.stringify(episode.deliverables || []) ||
        Boolean(savedEpisode.canonical_assets_required) !==
          Boolean(episode.canonical_assets_required)
      );
    } catch {
      return false;
    }
  }, [baseline, episode]);
  const lockedForHost =
    hostPreviewReadOnly ||
    !canHost ||
    LOCKED_HOST_STATUSES.includes(episode?.status);
  const canUploadForCurrentStatus =
    !hostPreviewReadOnly &&
    canUploadAssets &&
    episode?.status !== 'accepted' &&
    (canReview || !LOCKED_HOST_STATUSES.includes(episode?.status));
  const photoSelectionRoleCanEdit =
    !hostPreviewReadOnly &&
    episode?.archived !== true &&
    episode?.status !== 'accepted' &&
    (canManage ||
      canReview ||
      (canHost && !LOCKED_HOST_STATUSES.includes(episode?.status)));
  const canEditPhotoSelection = photoSelectionRoleCanEdit && !dirty;
  const photoSelectionDisabledReason = dirty
    ? 'Save or discard the other Episode Studio changes before reviewing the final photos.'
    : episode?.status === 'accepted' || episode?.archived
      ? 'The confirmed photo history is read-only for this episode.'
      : !photoSelectionRoleCanEdit
        ? 'An assigned host, assigned producer, or Studio manager reviews the final photo set.'
        : '';
  const producerProofDeliverable = episode?.deliverables?.find(
    (deliverable) => deliverable.id === 'producer-proof-audio'
  );
  const hostDeliverables = (episode?.deliverables || []).filter(
    (deliverable) => deliverable.section !== 'producer_proof'
  );
  const producerProofAssets = (episode?.assets || []).filter(
    (asset) => asset.deliverable_id === 'producer-proof-audio'
  );
  const availableProducerProofAssets = producerProofAssets.filter(
    (asset) => !isEpisodeAssetExpired(asset)
  );
  const producerProofUploadTask = episode?.production_tasks?.find(
    (task) => task.task_id === 'producer-proof-upload'
  );
  const proofApprovalTask = episode?.production_tasks?.find(
    (task) => task.task_id === 'proof-listen-approval'
  );
  const workflowPeople = useMemo(() => {
    const directory = new Map();
    [...people, ...producers].forEach((person) =>
      directory.set(person.person_id, person)
    );
    return [...directory.values()];
  }, [people, producers]);
  const workflowTaskEditorTask = workflowTaskEditor?.taskId
    ? workflowTaskWithDraft(
        (episode?.production_tasks || []).find(
          (task) => task.task_id === workflowTaskEditor.taskId
        ) || {}
      )
    : null;
  const workflowTaskEditorOwnerOptions = workflowOwnerOptions(
    workflowTaskEditorTask || {}
  );
  const workflowTasksWithDrafts = (episode?.production_tasks || []).map(
    workflowTaskWithDraft
  );
  const workflowTaskWorkTask = workflowTaskWorkId
    ? workflowTasksWithDrafts.find(
        (task) => task.task_id === workflowTaskWorkId
      ) || null
    : null;
  const workflowTaskWorkContext = workflowTaskWorkTask
    ? {
        complete: workflowTaskIsEffectivelyComplete(workflowTaskWorkTask),
        overdue: workflowTaskIsEffectivelyOverdue(workflowTaskWorkTask),
        canUpdate: canUpdateWorkflowTask(workflowTaskWorkTask),
        dependenciesComplete: workflowDependenciesComplete(
          workflowTaskWorkTask
        ),
        dependencyLabels: workflowDependencyLabels(
          workflowTaskWorkTask,
          workflowTasksWithDrafts
        ),
        tasks: workflowTasksWithDrafts,
      }
    : null;
  const canUploadProducerProof =
    !hostPreviewReadOnly &&
    assetUploadsConfigured &&
    Boolean(producerProofDeliverable) &&
    (canReview ||
      canManage ||
      (producerProofUploadTask?.assigned_person_ids || []).includes(
        viewerPersonId
      ));
  const Layout = previewData
    ? EpisodeStudioPreviewLayout
    : admin
      ? AdminLayout
      : StudioLayout;
  const listHref = episodeStudioListHref({ admin, canManage });
  const productionView = workspaceView === 'production';
  const episodeRouteId = episode?.episode_id || episodeId;
  const episodeBaseHref = previewData
    ? '/dev/episode-studio-usability-preview'
    : admin
      ? `/admin/studios/${encodeURIComponent(episodeRouteId)}`
      : `/studio/episodes/${encodeURIComponent(episodeRouteId)}`;
  const packageHref = previewData
    ? `${episodeBaseHref}?workspace=package`
    : `${episodeBaseHref}${hostPreviewActive ? '?view=host' : ''}`;
  const productionHref = previewData
    ? `${episodeBaseHref}?workspace=production`
    : `${episodeBaseHref}/production${hostPreviewActive ? '?view=host' : ''}`;
  const questionnaireHref = previewData
    ? `${episodeBaseHref}?workspace=questionnaire`
    : `${episodeBaseHref}/questionnaire`;

  const actionBlockers = getEpisodeStudioActionBlockers({
    episode,
    completion,
    dirty,
    saving,
    uploading: Boolean(uploadingAsset),
    productionHandoffAvailable,
  });
  const hostEditBlocker = hostPreviewReadOnly
    ? 'Host preview is read-only. Exit preview to make changes.'
    : !canHost
    ? 'Host production fields are read-only because you are not assigned to this episode as a host.'
    : episode?.status === 'accepted'
      ? 'The producer accepted this package, so host production fields are locked.'
      : LOCKED_HOST_STATUSES.includes(episode?.status)
        ? 'The package is with the producer. A producer must request changes before hosts can edit it again.'
        : '';

  function setHostPreview(enabled) {
    setWorkflowTaskWorkId('');
    setWorkflowTaskEditor(null);
    if (previewData) {
      setCanManage(enabled ? false : previewData.canManage === true);
      setCanHost(enabled ? true : previewData.canHost === true);
      setCanReview(enabled ? false : previewData.canReview === true);
      setCanConfigure(enabled ? false : previewData.canConfigure === true);
      setCanAdminOverride(
        enabled ? false : previewData.canAdminOverride === true
      );
      setCanAdvanceProduction(
        enabled ? false : previewData.canAdvanceProduction === true
      );
      setPeople(enabled ? [] : previewData.people || []);
      setProducers(enabled ? [] : previewData.producers || []);
      setAvailableSponsorReads(
        enabled ? [] : previewData.available_sponsor_reads || []
      );
      setCanUploadAssets(
        enabled ? false : previewData.canUploadAssets === true
      );
      setHostPreviewActive(enabled);
      setHostPreviewReadOnly(enabled);
      return;
    }
    const nextQuery = { ...router.query };
    if (enabled) {
      nextQuery.view = 'host';
    } else {
      delete nextQuery.view;
    }
    router.replace(
      { pathname: router.pathname, query: nextQuery },
      undefined,
      { shallow: true }
    );
  }

  function guardWorkspaceNavigation(event) {
    if (
      !dirty &&
      !messageDraft.trim() &&
      !workflowTaskDraftDirty &&
      !micKitPlanDirty &&
      !workflowTaskEditor
    ) {
      return;
    }
    if (
      window.confirm(
        'You have unsaved episode material. Leave this view and discard it?'
      )
    ) {
      return;
    }
    event.preventDefault();
  }

  function replaceEpisode(nextEpisode) {
    setEpisode(nextEpisode);
    setBaseline(JSON.stringify(nextEpisode));
  }

  function updateEpisode(patch) {
    setEpisode((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
  }

  function downloadRecordingCalendar() {
    try {
      const calendar = buildEpisodeCalendarFile(episode);
      const blob = new Blob([calendar], {
        type: 'text/calendar;charset=utf-8',
      });
      const objectUrl = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = objectUrl;
      link.download = episodeCalendarFilename(episode);
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
      setMessage('Calendar event downloaded.');
      setError('');
    } catch (calendarError) {
      setError(
        calendarError.message || 'Could not create the calendar event.'
      );
    }
  }

  function updateDeliverable(deliverableId, patch) {
    setEpisode((current) => ({
      ...current,
      deliverables: current.deliverables.map((deliverable) =>
        deliverable.id === deliverableId
          ? { ...deliverable, ...patch }
          : deliverable
      ),
    }));
    setMessage('');
    setError('');
  }

  function updateProductionTaskLocal(taskId, patch) {
    setEpisode((current) => ({
      ...current,
      production_tasks: (current.production_tasks || []).map((task) =>
        task.task_id === taskId ? { ...task, ...patch } : task
      ),
    }));
    setMessage('');
    setError('');
  }

  function updateWorkflowTaskDraft(taskId, patch) {
    setWorkflowTaskDrafts((current) => ({
      ...current,
      [taskId]: { ...(current[taskId] || {}), ...patch },
    }));
    setMessage('');
    setError('');
  }

  function clearWorkflowTaskDraft(taskId) {
    setWorkflowTaskDrafts((current) => {
      if (!Object.prototype.hasOwnProperty.call(current, taskId)) {
        return current;
      }
      const next = { ...current };
      delete next[taskId];
      return next;
    });
  }

  function workflowTaskWithDraft(task = {}) {
    return { ...task, ...(workflowTaskDrafts[task.task_id] || {}) };
  }

  function workflowScheduleTaskChanged(task = {}) {
    const savedTask = baselineProductionTaskById.get(task.task_id);
    if (!savedTask) return true;
    return (
      (task.due_date || '') !== (savedTask.due_date || '') ||
      (task.due_date_overridden === true) !==
        (savedTask.due_date_overridden === true) ||
      JSON.stringify(task.assigned_person_ids || []) !==
        JSON.stringify(savedTask.assigned_person_ids || [])
    );
  }

  function workflowTaskOwnerLabel(task = {}) {
    if (task.owner_type === 'hosts') {
      return hostNames.length ? hostNames.join(' + ') : 'Assigned host(s)';
    }
    if (task.owner_type === 'producer') {
      return (
        producers.find(
          (person) => person.person_id === episode?.producer_person_id
        )?.name || 'Assigned producer'
      );
    }
    if (task.owner_type === 'hosts_and_producer') {
      return `${hostNames.join(' + ') || 'Host(s)'} + assigned producer`;
    }
    const directory = [...people, ...producers];
    const names = (task.assigned_person_ids || []).map(
      (personId) =>
        directory.find((person) => person.person_id === personId)?.name ||
        personId
    );
    return names.join(' + ') || 'Choose an owner';
  }

  function workflowOwnerOptions(task = {}) {
    const currentIds = new Set(task.assigned_person_ids || []);
    return workflowPeople.filter(
      (person) => person.account_active !== false || currentIds.has(person.person_id)
    );
  }

  function canUpdateWorkflowTask(task = {}) {
    if (hostPreviewReadOnly) return false;
    if (canManage) return true;
    if (
      (task.assigned_person_ids || []).includes(viewerPersonId) ||
      (task.owner_type === 'hosts' && canHost) ||
      (task.owner_type === 'producer' && canReview) ||
      (task.owner_type === 'hosts_and_producer' && (canHost || canReview))
    ) {
      return true;
    }
    return false;
  }

  function isWorkflowTaskMine(task = {}) {
    if (!viewerPersonId || hostPreviewReadOnly) return false;
    return (
      (task.assigned_person_ids || []).includes(viewerPersonId) ||
      (task.owner_type === 'hosts' && canHost) ||
      (task.owner_type === 'producer' && canReview) ||
      (task.owner_type === 'hosts_and_producer' && (canHost || canReview))
    );
  }

  function workflowDependenciesComplete(task = {}) {
    return (task.dependencies || []).every((dependencyId) => {
      const effectiveState = workflowTaskStateById.get(dependencyId);
      if (effectiveState) return effectiveState.complete === true;
      return workflowTaskIsComplete(
        (episode?.production_tasks || []).find(
          (candidate) => candidate.task_id === dependencyId
        )
      );
    });
  }

  function workflowTaskIsEffectivelyComplete(task = {}) {
    const effectiveState = workflowTaskStateById.get(task.task_id);
    return effectiveState
      ? effectiveState.complete === true
      : workflowTaskIsComplete(task);
  }

  function workflowTaskIsEffectivelyOverdue(task = {}) {
    const effectiveState = workflowTaskStateById.get(task.task_id);
    return effectiveState
      ? effectiveState.overdue === true
      : workflowTaskIsOverdue(task);
  }

  async function enableProductionWorkflow() {
    await sendUpdate(
      { action: 'configure_workflow', reset_to_default: true },
      'The air-date production workflow is ready.'
    );
  }

  async function saveProductionWorkflowConfiguration() {
    await sendUpdate(
      {
        action: 'configure_workflow',
        production_tasks: episode.production_tasks,
      },
      'Workflow deadlines and owners saved.'
    );
  }

  async function moveProductionTaskOnBoard({
    taskId,
    targetPhase,
    targetIndex,
  } = {}) {
    if (
      !canConfigure ||
      hostPreviewReadOnly ||
      saving ||
      workflowScheduleChangeCount > 0
    ) {
      if (workflowScheduleChangeCount > 0) {
        setError('Save the Schedule changes before moving task tiles.');
      }
      return null;
    }

    const task = (episode.production_tasks || []).find(
      (candidate) => candidate.task_id === taskId
    );
    if (!task) return null;
    const previousTasks = episode.production_tasks;
    const optimisticTasks = moveProductionTaskTiles(
      previousTasks,
      taskId,
      targetPhase,
      targetIndex
    );
    if (optimisticTasks === previousTasks) return null;

    setEpisode((current) => ({
      ...current,
      production_tasks: moveProductionTaskTiles(
        current.production_tasks || [],
        taskId,
        targetPhase,
        targetIndex
      ),
    }));

    const result = await sendUpdate(
      {
        action: 'move_workflow_task',
        task_id: taskId,
        target_phase: targetPhase,
        target_index: targetIndex,
      },
      `${task.label} moved to ${formatWorkflowPhase(targetPhase)}.`,
      { mergeFields: WORKFLOW_DEFINITION_RESPONSE_FIELDS }
    );
    if (!result) {
      setEpisode((current) => ({
        ...current,
        production_tasks: previousTasks,
      }));
    }
    return result;
  }

  async function updateProductionTask(taskId, patch, successMessage) {
    return sendUpdate(
      {
        action: 'update_workflow_task',
        task_id: taskId,
        task: patch,
      },
      successMessage,
      { workflowTaskId: taskId }
    );
  }

  function openNewProductionTask(defaultPhaseId) {
    if (!canConfigure || hostPreviewReadOnly) return;
    setError('');
    setMessage('');
    setWorkflowTaskWorkId('');
    setWorkflowTaskEditor({
      mode: 'create',
      taskId: '',
      defaultPhaseId,
    });
  }

  function openProductionTaskWorkspace(task = {}) {
    if (!task.task_id) return;
    setError('');
    setMessage('');
    setWorkflowTaskEditor(null);
    setWorkflowTaskWorkId(task.task_id);
  }

  function openProductionTaskEditor(task = {}) {
    if (!canConfigure || hostPreviewReadOnly || !task.task_id) return;
    setError('');
    setMessage('');
    setWorkflowTaskWorkId('');
    setWorkflowTaskEditor({
      mode: 'edit',
      taskId: task.task_id,
      defaultPhaseId: task.phase,
    });
  }

  function closeProductionTaskEditor() {
    if (saving) return;
    setWorkflowTaskEditor(null);
    setError('');
  }

  function closeProductionTaskWorkspace() {
    if (saving) return;
    setWorkflowTaskWorkId('');
    setError('');
  }

  async function saveProductionTaskDefinition(definition) {
    if (!workflowTaskEditor) return null;
    const editing = workflowTaskEditor.mode === 'edit';
    const result = await sendUpdate(
      {
        action: editing ? 'edit_workflow_task' : 'add_workflow_task',
        ...(editing ? { task_id: workflowTaskEditor.taskId } : null),
        task: definition,
      },
      editing ? 'Production task updated.' : 'Task added to the production board.',
      { mergeFields: WORKFLOW_DEFINITION_RESPONSE_FIELDS }
    );
    if (!result) return null;
    if (editing) clearWorkflowTaskDraft(workflowTaskEditor.taskId);
    setWorkflowTaskEditor(null);
    return result;
  }

  function buildWorkflowTaskDetailPatch(task = {}, details = {}) {
    const draft = workflowTaskDrafts[task.task_id] || {};
    const patch = {
      note:
        details.evidence_note ??
        draft.evidence_note ??
        task.evidence_note ??
        '',
      evidence_url:
        details.evidence_url ??
        draft.evidence_url ??
        task.evidence_url ??
        '',
    };

    if (canManage) {
      if (
        Object.prototype.hasOwnProperty.call(draft, 'due_date') ||
        Object.prototype.hasOwnProperty.call(draft, 'due_date_overridden')
      ) {
        patch.due_date = draft.due_date ?? task.due_date ?? '';
        patch.due_date_overridden =
          draft.due_date_overridden ?? task.due_date_overridden === true;
      }
      if (
        Object.prototype.hasOwnProperty.call(draft, 'assigned_person_ids')
      ) {
        patch.assigned_person_ids = draft.assigned_person_ids;
      }
    }

    return patch;
  }

  async function saveWorkflowTaskDetails(task, details = {}) {
    const result = await updateProductionTask(
      task.task_id,
      buildWorkflowTaskDetailPatch(task, details),
      `${task.label} details saved.`
    );
    if (result) clearWorkflowTaskDraft(task.task_id);
    return result;
  }

  function mergeServerFields(serverEpisode, fields) {
    setEpisode((current) =>
      mergeEpisodeStudioServerFields(current, serverEpisode, fields)
    );
    setBaseline((current) => {
      try {
        return JSON.stringify(
          mergeEpisodeStudioServerFields(
            JSON.parse(current || '{}'),
            serverEpisode,
            fields
          )
        );
      } catch {
        return current;
      }
    });
  }

  function mergeMicKitPlanData(response) {
    const responseEpisodeId = String(response?.episode_id || '');
    if (
      responseEpisodeId &&
      responseEpisodeId === activeMicKitEpisodeId
    ) {
      const responseHostIdsKey = (response.plans || [])
        .map((plan) => String(plan?.host_person_id || ''))
        .filter(Boolean)
        .sort()
        .join('|');
      setMicKitLiveStatus({
        episodeId: responseEpisodeId,
        hostIdsKey: responseHostIdsKey,
        complete: response.complete === true,
      });
    }
    setEpisode((current) =>
      mergeEpisodeMicKitPlanResponse(current, response)
    );
    setBaseline((current) => {
      try {
        return JSON.stringify(
          mergeEpisodeMicKitPlanResponse(
            JSON.parse(current || '{}'),
            response
          )
        );
      } catch {
        return current;
      }
    });
  }

  async function sendUpdate(
    body,
    successMessage,
    { mergeFields = [], workflowTaskId = '' } = {}
  ) {
    if (!episode || saving || hostPreviewReadOnly) return null;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episode.episode_id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            ...body,
            expected_updated_at: episode.updated_at,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update this Episode Studio.');
      }
      if (workflowTaskId) {
        setEpisode((current) =>
          mergeWorkflowTaskResponse(current, data.episode, workflowTaskId)
        );
        setBaseline((current) => {
          try {
            return JSON.stringify(
              mergeWorkflowTaskResponse(
                JSON.parse(current || '{}'),
                data.episode,
                workflowTaskId
              )
            );
          } catch {
            return current;
          }
        });
      } else if (mergeFields.length) {
        mergeServerFields(data.episode, mergeFields);
      } else {
        replaceEpisode(data.episode);
      }
      setHostNames(data.host_names || hostNames);
      if (data.available_sponsor_reads) {
        setAvailableSponsorReads(data.available_sponsor_reads);
      }
      if (typeof data.canUploadAssets === 'boolean') {
        setCanUploadAssets(data.canUploadAssets);
      }
      if (typeof data.canAdvanceProduction === 'boolean') {
        setCanAdvanceProduction(data.canAdvanceProduction);
      }
      if (typeof data.production_handoff_available === 'boolean') {
        setProductionHandoffAvailable(data.production_handoff_available);
      }
      if (typeof data.production_lead_name === 'string') {
        setProductionLeadName(data.production_lead_name);
      }
      if (Array.isArray(data.episode_roles)) {
        setEpisodeRoles(data.episode_roles);
      }
      if (typeof data.viewer_person_id === 'string') {
        setViewerPersonId(data.viewer_person_id);
      }
      const notificationNote =
        data.notification && !data.notification.sent
          ? ` ${data.notification.reason}`
          : '';
      setMessage(`${successMessage}${notificationNote}`);
      return data;
    } catch (err) {
      setError(err.message || 'Could not update this Episode Studio.');
      return null;
    } finally {
      setSaving(false);
    }
  }

  async function saveEpisodePhotoSelection(photoSelection) {
    if (dirty) {
      setError(
        'Save or discard the other Episode Studio changes before reviewing the final photos.'
      );
      return null;
    }
    return sendUpdate(
      {
        action: 'update_photo_selection',
        photo_selection: photoSelection,
      },
      photoSelection?.status === 'confirmed'
        ? 'The final three images are confirmed for production.'
        : 'The photo review draft is saved.'
    );
  }

  async function setDeliveryHealth(deliveryHealth) {
    if (!episode || saving || healthLocked || hostPreviewReadOnly) return;
    setSaving(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episode.episode_id)}`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'set_delivery_health',
            delivery_health: deliveryHealth,
            expected_updated_at: episode.updated_at,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(
          data.error || 'Could not update the episode delivery outlook.'
        );
      }

      mergeServerFields(data.episode, DELIVERY_HEALTH_FIELDS);
      setMessage(
        deliveryHealth === 'off_track'
          ? 'The episode is now visibly marked Off track.'
          : 'The episode is back On track.'
      );
    } catch (err) {
      setError(
        err.message || 'Could not update the episode delivery outlook.'
      );
    } finally {
      setSaving(false);
    }
  }

  async function saveDraft() {
    if (canManage) {
      return sendUpdate(
        { action: 'update', episode },
        'Episode Studio saved.'
      );
    }
    return sendUpdate(
      {
        action: 'save',
        deliverables: episode.deliverables,
      },
      'Draft saved.'
    );
  }

  async function submitEpisode(submissionMode) {
    const provisional = submissionMode === 'with_gaps';
    const confirmed = window.confirm(
      provisional
        ? 'Send this episode to the producer with the acknowledged missing items?'
        : 'Send this complete episode package to the producer?'
    );
    if (!confirmed) return;

    await sendUpdate(
      {
        action: 'submit',
        submission_mode: submissionMode,
        deliverables: episode.deliverables,
      },
      provisional
        ? 'The producer has been notified about this episode and its known gaps.'
        : 'The complete episode package has been sent to the producer.'
    );
  }

  async function reviewEpisode(status) {
    const actionLabel =
      status === 'accepted' ? 'accept this episode package' : 'request changes';
    if (!window.confirm(`Confirm you want to ${actionLabel}?`)) return;
    let overrideReason = '';
    const action = canReview ? 'review' : 'override_review';
    if (action === 'override_review') {
      overrideReason =
        window.prompt(
          'Administrator override reason (recorded in the audit trail):'
        )?.trim() || '';
      if (overrideReason.length < 8) {
        setError('Add a brief reason before using an administrator override.');
        return;
      }
    }
    await sendUpdate(
      {
        action,
        status,
        producer_feedback: episode.producer_feedback,
        staged_episode_url: episode.staged_episode_url,
        override_reason: overrideReason,
      },
      status === 'accepted'
        ? 'Episode package accepted.'
        : 'The episode is open for host revisions.',
      { mergeFields: REVIEW_RESPONSE_FIELDS }
    );
  }

  async function advanceProduction() {
    if (!window.confirm('Confirm you want to advance production review?')) {
      return;
    }
    await sendUpdate(
      { action: 'advance_production' },
      'Production review advanced; the next production lead was notified.'
    );
  }

  async function saveCommunicationNote(note, event) {
    event?.preventDefault();
    await sendUpdate(
      {
        action: 'update_communication_note',
        producer_feedback: String(note || '').slice(0, 4000),
      },
      'Pinned host direction saved.',
      { mergeFields: COMMUNICATION_NOTE_RESPONSE_FIELDS }
    );
  }

  async function postMessage(body, event) {
    event?.preventDefault();
    if (hostPreviewReadOnly) return;
    const cleanBody = String(body || '').trim();
    if (!cleanBody) return;
    const data = await sendUpdate(
      { action: 'message', message: cleanBody },
      'Update posted to the episode discussion.',
      { mergeFields: MESSAGE_RESPONSE_FIELDS }
    );
    if (data) setMessageDraft('');
  }

  async function assignSponsorRead() {
    if (!selectedSponsorReadId) return;
    const data = await sendUpdate(
      {
        action: 'assign_sponsor_read',
        sponsor_read_id: selectedSponsorReadId,
        requires_audio: sponsorRequiresAudio,
        recording_mode: sponsorRecordingMode,
      },
      'Sponsor read assigned with a frozen script snapshot.'
    );
    if (data) setSelectedSponsorReadId('');
  }

  async function removeSponsorRead(assignmentId) {
    if (
      !window.confirm(
        'Remove this sponsor read from the episode? The library version will remain available.'
      )
    ) {
      return;
    }
    await sendUpdate(
      { action: 'remove_sponsor_read', assignment_id: assignmentId },
      'Sponsor read removed from this episode.'
    );
  }

  async function updateSponsorAssignment(assignment, patch) {
    await sendUpdate(
      {
        action: 'update_sponsor_read_assignment',
        assignment_id: assignment.assignment_id,
        audio_asset_id: Object.prototype.hasOwnProperty.call(
          patch,
          'audio_asset_id'
        )
          ? patch.audio_asset_id
          : assignment.audio_asset_id,
        audio_url: Object.prototype.hasOwnProperty.call(patch, 'audio_url')
          ? patch.audio_url
          : assignment.audio_url,
        completed: Object.prototype.hasOwnProperty.call(patch, 'completed')
          ? patch.completed
          : assignment.completed,
      },
      patch.completed
        ? 'Sponsor read marked complete.'
        : 'Sponsor read progress saved.'
    );
  }

  function addChecklistItem() {
    if ((episode?.deliverables || []).length >= MAX_EPISODE_DELIVERABLES) {
      return;
    }
    const id = `custom-${Date.now().toString(36)}`;
    setEpisode((current) => ({
      ...current,
      deliverables: [
        ...current.deliverables,
        {
          id,
          label: 'New checklist item',
          description: 'Describe what the host should provide.',
          type: 'textarea',
          asset_category: 'document',
          section: 'host',
          allowed_uploader: 'episode_participant',
          required: false,
          value: '',
          social_profiles: '',
          legacy_source_url: '',
          missing_acknowledged: false,
          missing_note: '',
          expected_by: '',
          sort_order: (current.deliverables.length + 1) * 10,
        },
      ],
    }));
    setPendingChecklistFocusId(id);
  }

  function moveChecklistItem(deliverableId, offset) {
    setEpisode((current) => {
      const items = [...current.deliverables];
      const movableIndexes = items
        .map((item, index) =>
          item.section === 'producer_proof' ? -1 : index
        )
        .filter((index) => index >= 0);
      const index = items.findIndex((item) => item.id === deliverableId);
      const movablePosition = movableIndexes.indexOf(index);
      const nextPosition = movablePosition + offset;
      if (
        index < 0 ||
        movablePosition < 0 ||
        nextPosition < 0 ||
        nextPosition >= movableIndexes.length
      ) {
        return current;
      }
      const nextIndex = movableIndexes[nextPosition];
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, deliverables: items };
    });
  }

  function removeChecklistItem(deliverable) {
    const attachedFiles = (episode.assets || []).filter(
      (asset) => asset.deliverable_id === deliverable.id
    ).length;
    const guestProfileHasResponse = Object.values(
      deliverable.guest_profile || {}
    ).some(
      (value) =>
        value === true ||
        (typeof value === 'string' && Boolean(value.trim()))
    );
    const micKitPlanHasResponse = (
      Array.isArray(deliverable.mic_kit_plans)
        ? deliverable.mic_kit_plans
        : []
    ).some((plan) => Boolean(String(plan?.choice || '').trim()));
    const hasCurrentResponse = Boolean(
      String(deliverable.value || '').trim() ||
        String(deliverable.social_profiles || '').trim() ||
        guestProfileHasResponse ||
        micKitPlanHasResponse ||
        attachedFiles
    );
    if (
      hasCurrentResponse &&
      !window.confirm(
        `Remove “${deliverable.label}” and its current response${
          attachedFiles
            ? `? Its ${attachedFiles} attached ${
                attachedFiles === 1 ? 'file will' : 'files will'
              } remain in the producer package as unassigned`
            : ''
        }?`
      )
    ) {
      return;
    }
    setEpisode((current) => ({
      ...current,
      deliverables: current.deliverables.filter(
        (item) => item.id !== deliverable.id
      ),
    }));
  }

  async function saveChecklistConfiguration() {
    return sendUpdate(
      {
        action: 'configure_checklist',
        deliverables: episode.deliverables,
        canonical_assets_required:
          episode.canonical_assets_required === true,
      },
      'Episode-specific checklist saved.',
      { mergeFields: CHECKLIST_RESPONSE_FIELDS }
    );
  }

  async function uploadEpisodeAssets(fileList, deliverable) {
    if (hostPreviewReadOnly) return;
    const files = Array.from(fileList || []);
    const producerProofUpload =
      deliverable?.id === 'producer-proof-audio' && canUploadProducerProof;
    if (
      !files.length ||
      !episode ||
      !deliverable?.id ||
      uploadingAsset ||
      (!canUploadForCurrentStatus && !producerProofUpload)
    ) {
      return;
    }

    const category = deliverable.asset_category || 'document';
    const validatedFiles = [];
    const validationErrors = [];
    files.forEach((file) => {
      try {
        validatedFiles.push({
          file,
          input: validateEpisodeAssetInput({
            file_name: file.name,
            content_type: file.type,
            size: file.size,
            category,
          }),
        });
      } catch (validationError) {
        validationErrors.push(readableUploadError(validationError));
      }
    });

    if (validationErrors.length) {
      const visibleErrors = validationErrors.slice(0, 3).join(' ');
      const remainingErrors =
        validationErrors.length > 3
          ? ` ${validationErrors.length - 3} more ${
              validationErrors.length - 3 === 1 ? 'file was' : 'files were'
            } also rejected.`
          : '';
      setAssetUploadFeedback((current) => ({
        ...current,
        [deliverable.id]: {
          tone: 'error',
          phase: 'error',
          phaseLabel: 'Files not accepted',
          message: `No files were uploaded. ${visibleErrors}${remainingErrors}`,
        },
      }));
      return;
    }

    const preparedFiles = [];
    const duplicateFileNames = [];
    const duplicateCandidates = [...(episode.assets || [])];
    for (const preparedFile of validatedFiles) {
      const candidate = {
        ...preparedFile.input,
        deliverable_id: deliverable.id,
      };
      const duplicate = findDuplicateEpisodeAsset(
        duplicateCandidates,
        candidate
      );
      if (duplicate) {
        duplicateFileNames.push(preparedFile.input.file_name);
        continue;
      }
      preparedFiles.push(preparedFile);
      duplicateCandidates.push(candidate);
    }

    if (!preparedFiles.length) {
      const duplicateNames = duplicateFileNames
        .slice(0, 3)
        .map((fileName) => `“${fileName}”`)
        .join(', ');
      const additionalDuplicates =
        duplicateFileNames.length > 3
          ? ` and ${duplicateFileNames.length - 3} more`
          : '';
      setAssetUploadFeedback((current) => ({
        ...current,
        [deliverable.id]: {
          tone: 'warning',
          phase: 'duplicate',
          phaseLabel: 'Already uploaded',
          message: `${duplicateNames}${additionalDuplicates} ${
            duplicateFileNames.length === 1 ? 'is' : 'are'
          } already attached to this episode step. Delete the existing ${
            duplicateFileNames.length === 1 ? 'copy' : 'copies'
          } first if you intend to replace ${
            duplicateFileNames.length === 1 ? 'it' : 'them'
          }.`,
        },
      }));
      return;
    }

    setError('');
    setMessage('');
    setUploadingDeliverableId(deliverable.id);
    const batchStartedAt = Date.now();
    setAssetUploadFeedback((current) => ({
      ...current,
      [deliverable.id]: {
        tone: 'status',
        phase: 'preparing',
        phaseLabel: 'Preparing',
        message: `Preparing ${preparedFiles.length} ${
          preparedFiles.length === 1 ? 'file' : 'files'
        } for upload…${
          duplicateFileNames.length
            ? ` ${duplicateFileNames.length} already-uploaded ${
                duplicateFileNames.length === 1 ? 'file was' : 'files were'
              } skipped.`
            : ''
        }`,
      },
    }));
    let currentEpisode = episode;
    let completedCount = 0;
    let activeFileName = '';
    let activeFileInput = null;
    let activeUploadStage = 'authorization';
    try {
      for (const [index, preparedFile] of preparedFiles.entries()) {
        const { file, input } = preparedFile;
        activeFileName = file.name;
        activeFileInput = input;
        activeUploadStage = 'authorization';
        setUploadingAsset(file.name);
        setAssetUploadFeedback((current) => ({
          ...current,
          [deliverable.id]: {
            tone: 'status',
            phase: 'authorizing',
            phaseLabel: 'Getting ready',
            progress: 0,
            fileName: file.name,
            fileIndex: index + 1,
            fileCount: preparedFiles.length,
            fileSize: input.size,
            fileLimit: assetLimitForInput(input),
            loaded: 0,
            total: input.size,
            message:
              'Checking the file and reserving its private storage location…',
          },
        }));
        const authorizeResponse = await fetch(
          `/api/studio/episodes/${encodeURIComponent(
            currentEpisode.episode_id
          )}/assets/presign`,
          {
            method: 'POST',
            credentials: 'same-origin',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              deliverable_id: deliverable.id,
              file: input,
            }),
          }
        );
        let authorization;
        try {
          authorization = await authorizeResponse.json();
        } catch (responseError) {
          if (authorizeResponse.ok) {
            const networkError = episodeAssetUploadStageError(
              responseError,
              'authorization'
            );
            if (networkError !== responseError) throw networkError;
            throw new Error(
              'Episode Studio returned an unreadable upload authorization response. Try again.'
            );
          }
          throw new Error(
            `Episode Studio could not authorize this upload (HTTP ${authorizeResponse.status}). Try again.`
          );
        }
        if (!authorizeResponse.ok) {
          throw new Error(
            authorization.error || `Could not authorize ${file.name}.`
          );
        }
        if (
          !authorization?.upload ||
          !String(authorization.upload.upload_url || '').trim()
        ) {
          throw new Error(
            'Episode Studio returned incomplete upload authorization. Try again.'
          );
        }
        if (authorization.episode_updated_at) {
          currentEpisode = {
            ...currentEpisode,
            updated_at: authorization.episode_updated_at,
            asset_upload_grants_expire_at:
              authorization.asset_upload_grants_expire_at ||
              currentEpisode.asset_upload_grants_expire_at ||
              '',
          };
          mergeServerFields(currentEpisode, [
            'asset_upload_grants_expire_at',
            'updated_at',
          ]);
        }
        activeUploadStage = 'storage';
        const uploadStartedAt = Date.now();
        let lastProgressRenderedAt = 0;
        let lastRateSampleAt = uploadStartedAt;
        let lastRateSampleBytes = 0;
        let smoothedBytesPerSecond = 0;
        let uploadResponse = null;
        let uploadFailure = null;
        try {
          uploadResponse = await uploadAuthorizedFile(
            file,
            authorization.upload,
            {
            onProgress: ({
              loaded,
              total,
              percent,
              indeterminate = false,
            }) => {
              const now = Date.now();
              const rateSampleSeconds =
                (now - lastRateSampleAt) / 1000;
              if (
                rateSampleSeconds >= 0.5 &&
                loaded >= lastRateSampleBytes
              ) {
                const currentRate =
                  (loaded - lastRateSampleBytes) / rateSampleSeconds;
                smoothedBytesPerSecond = smoothedBytesPerSecond
                  ? smoothedBytesPerSecond * 0.7 + currentRate * 0.3
                  : currentRate;
                lastRateSampleAt = now;
                lastRateSampleBytes = loaded;
              }
              if (percent < 100 && now - lastProgressRenderedAt < 250) return;
              lastProgressRenderedAt = now;
              const elapsedSeconds = Math.max(
                0,
                (now - uploadStartedAt) / 1000
              );
              const bytesPerSecond =
                smoothedBytesPerSecond ||
                (elapsedSeconds >= 0.5
                  ? loaded / elapsedSeconds
                  : 0);
              const secondsRemaining =
                bytesPerSecond > 0
                  ? Math.max(0, (total - loaded) / bytesPerSecond)
                  : null;
              setAssetUploadFeedback((current) => ({
                ...current,
                [deliverable.id]: {
                  tone: 'status',
                  phase: 'uploading',
                  phaseLabel: 'Uploading',
                  progress: indeterminate ? null : Math.round(percent),
                  indeterminate,
                  fileName: file.name,
                  fileIndex: index + 1,
                  fileCount: preparedFiles.length,
                  fileSize: input.size,
                  fileLimit: assetLimitForInput(input),
                  loaded,
                  total,
                  bytesPerSecond,
                  secondsRemaining,
                  elapsedSeconds,
                  message: indeterminate
                    ? 'Safari is sending this file directly to secure storage. Keep this tab open until the final verification finishes.'
                    : 'Keep this tab open while the file moves directly to secure storage.',
                },
              }));
              },
            }
          );
        } catch (storageError) {
          uploadFailure = storageError;
          if (
            !shouldReconcileEpisodeAssetUpload({ error: storageError })
          ) {
            throw storageError;
          }
        }
        if (
          !uploadFailure &&
          !isEpisodeAssetUploadReadyForCompletion(uploadResponse) &&
          !shouldReconcileEpisodeAssetUpload({ response: uploadResponse })
        ) {
          throw new Error(episodeAssetStorageRejectionMessage(uploadResponse));
        }
        activeUploadStage = 'completion';
        setAssetUploadFeedback((current) => ({
          ...current,
          [deliverable.id]: {
            tone: 'status',
            phase: 'verifying',
            phaseLabel: 'Securing file',
            progress: 100,
            fileName: file.name,
            fileIndex: index + 1,
            fileCount: preparedFiles.length,
            fileSize: input.size,
            fileLimit: assetLimitForInput(input),
            loaded: input.size,
            total: input.size,
            message:
              'Upload complete. Verifying the exact stored version and attaching it to the episode…',
          },
        }));
        const completed = await completeEpisodeAssetUpload({
          episodeId: currentEpisode.episode_id,
          upload: authorization.upload,
          deliverableId: deliverable.id,
        });
        currentEpisode = completed.episode;
        mergeServerFields(currentEpisode, [
          'assets',
          'production_tasks',
          'production_workflow_updated_at',
          'production_workflow_updated_by_person_id',
          'production_workflow_updated_by_name',
          'updated_at',
        ]);
        completedCount += 1;
      }
      setAssetUploadFeedback((current) => ({
        ...current,
        [deliverable.id]: {
          tone: 'success',
          phase: 'complete',
          phaseLabel: 'Upload complete',
          elapsedSeconds: (Date.now() - batchStartedAt) / 1000,
          message: `${completedCount} ${
            completedCount === 1 ? 'file' : 'files'
          } uploaded to “${deliverable.label}” and added to the producer package${
            duplicateFileNames.length
              ? `; ${duplicateFileNames.length} existing ${
                  duplicateFileNames.length === 1 ? 'copy was' : 'copies were'
                } skipped`
              : ''
          }.`,
        },
      }));
    } catch (uploadError) {
      const reason = readableUploadError(
        episodeAssetUploadStageError(uploadError, activeUploadStage)
      );
      setAssetUploadFeedback((current) => ({
        ...current,
        [deliverable.id]: {
          tone: 'error',
          phase: 'error',
          phaseLabel: 'Upload stopped',
          fileName: activeFileName,
          fileSize: activeFileInput?.size,
          fileLimit: activeFileInput
            ? assetLimitForInput(activeFileInput)
            : undefined,
          message: completedCount
            ? `${completedCount} of ${preparedFiles.length} ${
                preparedFiles.length === 1 ? 'file was' : 'files were'
              } uploaded. Uploading stopped at “${activeFileName}”: ${reason}`
            : `“${activeFileName || 'This file'}” was not uploaded. ${reason}`,
        },
      }));
    } finally {
      setUploadingAsset('');
      setUploadingDeliverableId('');
    }
  }

  function viewerCanDeleteAsset(asset) {
    if (hostPreviewReadOnly) return false;
    return canDeleteEpisodeAsset({
      roles: episodeRoles,
      status: episode?.status,
      canManage,
      viewerPersonId,
      uploaderPersonId: asset?.uploaded_by_person_id,
    });
  }

  function assetHasMatchingCopy(asset) {
    return Boolean(
      findDuplicateEpisodeAsset(
        (episode?.assets || []).filter(
          (candidate) => candidate.asset_id !== asset?.asset_id
        ),
        asset
      )
    );
  }

  async function deleteEpisodeAsset(asset) {
    if (!episode || !asset || deletingAssetId) return;
    const confirmed = window.confirm(
      `Permanently delete “${
        asset.label || asset.file_name
      }” from this episode and secure storage?\n\nThis cannot be undone.`
    );
    if (!confirmed) return;

    setDeletingAssetId(asset.asset_id);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(
          episode.episode_id
        )}/assets/${encodeURIComponent(asset.asset_id)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expected_updated_at: episode.updated_at,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not delete this episode file.');
      }
      mergeServerFields(data.episode, [
        'assets',
        'sponsor_read_assignments',
        'production_tasks',
        'production_workflow_updated_at',
        'production_workflow_updated_by_person_id',
        'production_workflow_updated_by_name',
        'updated_at',
      ]);
      setMessage(
        `“${asset.label || asset.file_name}” was permanently deleted.`
      );
    } catch (deleteError) {
      setError(
        deleteError.message || 'Could not delete this episode file.'
      );
    } finally {
      setDeletingAssetId('');
    }
  }

  async function deleteStudio({ confirmationTitle } = {}) {
    if (!episode || confirmationTitle !== episode.title || deletingStudio) return;

    setDeletingStudio(true);
    setError('');
    setMessage('');
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}`,
        {
          method: 'DELETE',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            expected_updated_at: episode.updated_at,
            confirmation_title: confirmationTitle,
            delete_assets: true,
          }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        if (data.episode) {
          mergeServerFields(data.episode, ['deleted_at', 'updated_at']);
        }
        setError(
          data.error || 'Could not permanently delete this Episode Studio.'
        );
        return;
      }

      if (data.pending_deletion) {
        if (data.episode) {
          mergeServerFields(data.episode, ['deleted_at', 'updated_at']);
        }
        const noticeStatus = data.storage_cleanup_pending
          ? 'cleaning'
          : 'scheduled';
        rememberDeletionNotice({
          status: noticeStatus,
          title: episode.title,
          deletion_ready_at: data.deletion_ready_at,
        });
        setDeletionRedirectMessage(
          data.storage_cleanup_pending
            ? 'Protected deletion is in progress.'
            : 'Protected deletion is scheduled.'
        );
        await router.replace(listHref);
        return;
      }

      rememberDeletionNotice({
        status: 'deleted',
        title: episode.title,
      });
      setDeletionRedirectMessage(
        `“${episode.title}” was permanently deleted.`
      );
      setBaseline(JSON.stringify(episode));
      await router.replace(listHref);
    } catch (deleteError) {
      setDeletionRedirectMessage('');
      setError(
        deleteError.message ||
          'Could not permanently delete this Episode Studio.'
      );
    } finally {
      setDeletingStudio(false);
    }
  }

  function workflowDependencyLabels(task = {}, tasks = []) {
    return (task.dependencies || [])
      .map(
        (dependencyId) =>
          tasks.find((candidate) => candidate.task_id === dependencyId)?.label
      )
      .filter(Boolean);
  }

  function renderWorkflowTaskDetails(task, context) {
    const { canUpdate, complete } = context;
    const taskDraft = workflowTaskDrafts[task.task_id] || {};
    const taskDraftDirty = Object.keys(taskDraft).length > 0;
    const calculatedDueDate = dateDaysBefore(
      episode.target_release_date,
      task.days_before_air
    );
    const baselineDeadlineLabel = Number(task.days_before_air) === 0
      ? 'the air date'
      : `${task.days_before_air} days before air`;
    const linkedRequirements = (task.linked_deliverable_ids || []).map(
      (deliverableId) => {
        const deliverable = (episode.deliverables || []).find(
          (candidate) => candidate.id === deliverableId
        );
        return {
          id: deliverableId,
          label: deliverable?.label || deliverableId,
          complete: deliverable
            ? isDeliverableComplete(deliverable, episode.assets || [])
            : false,
        };
      }
    );
    const dependencies = (task.dependencies || []).map((dependencyId) => {
      const dependency = (episode.production_tasks || []).find(
        (candidate) => candidate.task_id === dependencyId
      );
      return {
        id: dependencyId,
        label: dependency?.label || dependencyId,
        status: dependency?.status || 'not_started',
      };
    });
    const invalidDraftDeadline =
      canManage &&
      Object.prototype.hasOwnProperty.call(taskDraft, 'due_date') &&
      !/^\d{4}-\d{2}-\d{2}$/.test(String(task.due_date || ''));

    return (
      <EpisodeProductionTaskWorkspace
        task={task}
        context={context}
        workingNote={task.evidence_note || ''}
        evidenceUrl={task.evidence_url || ''}
        canEditDetails={canUpdate}
        saving={saving}
        saveDisabled={!taskDraftDirty || invalidDraftDeadline}
        statusMessage={taskDraftDirty ? 'Unsaved task details' : ''}
        onWorkingNoteChange={(value) =>
          updateWorkflowTaskDraft(task.task_id, { evidence_note: value })
        }
        onEvidenceUrlChange={(value) =>
          updateWorkflowTaskDraft(task.task_id, { evidence_url: value })
        }
        onSaveDetails={(details) => saveWorkflowTaskDetails(task, details)}
        evidenceHelp={
          task.task_id === 'guest-assets-shared'
            ? 'Use an approved Google Drive handoff link. Never share a private staged Spotify link or internal publishing package.'
            : undefined
        }
        packageRequirements={linkedRequirements}
        packageHref={packageHref}
        onRequirementNavigate={(_requirement, event) =>
          guardWorkspaceNavigation(event)
        }
        dependencies={dependencies}
        dependenciesComplete={context.dependenciesComplete}
        formatDateTime={formatDateTime}
        renderDeadlineControl={
          canManage
            ? ({ disabled }) => (
                <div>
                  <strong>Task deadline</strong>
                  <FriendlyDateField
                    value={task.due_date || ''}
                    onChange={(event) =>
                      updateWorkflowTaskDraft(task.task_id, {
                        due_date: event.target.value,
                        due_date_overridden: true,
                      })
                    }
                    ariaLabel={`${task.label} task deadline`}
                    disabled={disabled}
                  />
                  <small>
                    Rule: {baselineDeadlineLabel}.
                  </small>
                  {task.due_date_overridden === true ? (
                    <button
                      type="button"
                      disabled={disabled || !calculatedDueDate}
                      onClick={() =>
                        updateWorkflowTaskDraft(task.task_id, {
                          due_date: calculatedDueDate,
                          due_date_overridden: false,
                        })
                      }
                    >
                      Use the air-date rule
                    </button>
                  ) : null}
                </div>
              )
            : null
        }
        renderOwnerControl={
          canManage && task.owner_type === 'person'
            ? ({ disabled }) => (
                <label>
                  Accountable owner
                  <select
                    value={task.assigned_person_ids?.[0] || ''}
                    disabled={disabled}
                    onChange={(event) =>
                      updateWorkflowTaskDraft(task.task_id, {
                        assigned_person_ids: event.target.value
                          ? [event.target.value]
                          : [],
                      })
                    }
                  >
                    <option value="" disabled>
                      Choose a teammate
                    </option>
                    {workflowOwnerOptions(task).map((person) => (
                      <option key={person.person_id} value={person.person_id}>
                        {person.name}
                        {person.account_active === false ? ' (inactive)' : ''}
                      </option>
                    ))}
                  </select>
                </label>
              )
            : null
        }
      >
        {!canManage ? (
          <div className={styles.workflowTaskContext}>
            <span>Baseline: {baselineDeadlineLabel}</span>
          </div>
        ) : null}

        {!previewData && [
          'guest-prep-sent',
          'guest-prep-received',
          'guest-recording-plan-reviewed',
        ].includes(task.task_id) ? (
          <div className={styles.workflowChoicePanel}>
            <strong>Connected guest questionnaire</strong>
            <p>
              {task.task_id === 'guest-prep-sent'
                ? 'Customize the episode questionnaire and create its private guest link here.'
                : task.task_id === 'guest-prep-received'
                  ? 'Review the submitted guest intake and fill blank Episode Studio fields without overwriting team edits.'
                  : 'Review the guest’s recording readiness and any restricted microphone-kit shipping request before completing this producer step.'}
            </p>
            <Link
              href={questionnaireHref}
              onClick={guardWorkspaceNavigation}
            >
              Open guest questionnaire
            </Link>
            {task.task_id === 'guest-recording-plan-reviewed' ? (
              <Link
                href={`${packageHref}#deliverable-mic-kit-plan`}
                onClick={guardWorkspaceNavigation}
              >
                Open microphone plans
              </Link>
            ) : null}
          </div>
        ) : null}

        {task.kind === 'intro' && canUpdate && !complete ? (
          <div className={styles.workflowChoicePanel}>
            <strong>Choose the completed intro path</strong>
            <label className={styles.workflowChoiceOption}>
              <input
                type="radio"
                name={`intro-method-${task.task_id}`}
                checked={task.intro_method === 'recorded'}
                onChange={() =>
                  updateProductionTaskLocal(task.task_id, {
                    intro_method: 'recorded',
                    intro_scheduled_for: '',
                  })
                }
              />
              I recorded the intro and uploaded it
            </label>
            <label className={styles.workflowChoiceOption}>
              <input
                type="radio"
                name={`intro-method-${task.task_id}`}
                checked={task.intro_method === 'scheduled_with_producer'}
                onChange={() =>
                  updateProductionTaskLocal(task.task_id, {
                    intro_method: 'scheduled_with_producer',
                  })
                }
              />
              I sent the script and scheduled the producer recording
            </label>
            {task.intro_method === 'recorded' ? (
              <Link
                href={`${packageHref}#deliverable-intro-audio`}
                onClick={guardWorkspaceNavigation}
              >
                Go to the private intro upload
              </Link>
            ) : null}
            {task.intro_method === 'scheduled_with_producer' ? (
              <label>
                Scheduled recording date
                <FriendlyDateField
                  value={task.intro_scheduled_for || ''}
                  onChange={(event) =>
                    updateProductionTaskLocal(task.task_id, {
                      intro_scheduled_for: event.target.value,
                    })
                  }
                  ariaLabel="scheduled producer intro recording date"
                  max={dateDaysBefore(episode.target_release_date, 10)}
                />
                <small>
                  Schedule the session at least ten days before air—on or
                  before{' '}
                  {formatDate(dateDaysBefore(episode.target_release_date, 10))}.
                  Scheduling happens outside Episode Studio.
                </small>
              </label>
            ) : null}
          </div>
        ) : null}

        {task.kind === 'bundle' && canUpdate ? (
          <fieldset className={styles.workflowSubtasks}>
            <legend>Required substeps</legend>
            {(task.subtasks || []).map((subtask) => (
              <label key={subtask.id}>
                <input
                  type="checkbox"
                  checked={subtask.completed === true}
                  onChange={async (event) => {
                    const subtasks = task.subtasks.map((candidate) =>
                      candidate.id === subtask.id
                        ? { ...candidate, completed: event.target.checked }
                        : candidate
                    );
                    const result = await updateProductionTask(
                      task.task_id,
                      {
                        ...buildWorkflowTaskDetailPatch(task),
                        subtasks,
                        status: subtasks
                          .filter((candidate) => candidate.required !== false)
                          .every((candidate) => candidate.completed)
                          ? 'complete'
                          : 'in_progress',
                      },
                      `${subtask.label} updated.`
                    );
                    if (result) clearWorkflowTaskDraft(task.task_id);
                  }}
                />
                {subtask.label}
              </label>
            ))}
          </fieldset>
        ) : null}
      </EpisodeProductionTaskWorkspace>
    );
  }

  function renderWorkflowTaskActions(task, context) {
    const proofControlled = [
      'producer-proof-upload',
      'proof-listen-approval',
    ].includes(task.task_id);

    if (proofControlled) {
      return (
        <a
          className={styles.workflowTaskLink}
          href="#producer-proof"
          onClick={() => setWorkflowTaskWorkId('')}
        >
          Complete this in the private proof section
        </a>
      );
    }
    if (!context.canUpdate || task.kind === 'bundle') return null;

    async function saveTaskStatus(status, successMessage) {
      const result = await updateProductionTask(
        task.task_id,
        {
          ...buildWorkflowTaskDetailPatch(task),
          status,
          ...(status === 'complete'
            ? {
                intro_method: task.intro_method,
                intro_scheduled_for: task.intro_scheduled_for,
              }
            : null),
        },
        successMessage
      );
      if (result) clearWorkflowTaskDraft(task.task_id);
    }

    return (
      <>
        {context.complete ? (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={saving}
            onClick={() =>
              saveTaskStatus('in_progress', `${task.label} reopened.`)
            }
          >
            Reopen step
          </button>
        ) : (
          <>
            {task.status === 'not_started' ? (
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={saving || !context.dependenciesComplete}
                onClick={() =>
                  saveTaskStatus('in_progress', `${task.label} started.`)
                }
              >
                Start work
              </button>
            ) : null}
            <button
              type="button"
              className={styles.primaryButton}
              disabled={
                saving ||
                !context.dependenciesComplete ||
                (task.kind === 'intro' && !task.intro_method)
              }
              onClick={() =>
                saveTaskStatus('complete', `${task.label} completed.`)
              }
            >
              Mark complete
            </button>
          </>
        )}
        {canManage && !context.complete ? (
          <button
            type="button"
            className={styles.secondaryButton}
            disabled={saving}
            onClick={async () => {
              const result = await updateProductionTask(
                task.task_id,
                {
                  ...buildWorkflowTaskDetailPatch(task),
                  status: 'waived',
                  note: task.evidence_note || 'Waived by a Studio manager.',
                },
                `${task.label} waived.`
              );
              if (result) clearWorkflowTaskDraft(task.task_id);
            }}
          >
            Waive step
          </button>
        ) : null}
      </>
    );
  }

  return (
    <Layout
      hasUnsavedChanges={
        dirty ||
        Boolean(messageDraft.trim()) ||
        workflowTaskDraftDirty ||
        micKitPlanDirty ||
        Boolean(workflowTaskEditor)
      }
      unsavedChangesMessage="You have unsaved episode material. Leave and discard it?"
    >
      <div className={styles.workspace}>
        <Link href={listHref} className={styles.backLink}>
          <ArrowBackRoundedIcon aria-hidden="true" />
          {admin || canManage ? 'Production calendar' : 'My episodes'}
        </Link>

        {loading ? (
          <section className={styles.loadingCard}>Opening Episode Studio…</section>
        ) : deletionRedirectMessage ? (
          <section className={styles.successCard} role="status">
            <strong>{deletionRedirectMessage}</strong>{' '}
            Returning to the production calendar…
          </section>
        ) : error && !episode ? (
          <section className={styles.errorCard}>
            <strong>{error}</strong>
            <p>
              Use the production calendar to open another active Episode
              Studio.
            </p>
          </section>
        ) : episode?.deleted_at ? (
          <>
            <section className={styles.deletionStatusCard} role="status">
              <span className={styles.deletionStatusIcon} aria-hidden="true">
                <DeleteOutlineRoundedIcon />
              </span>
              <div>
                <span className={styles.eyebrow}>Protected deletion</span>
                <h1>Deletion is scheduled</h1>
                <p>
                  <strong>“{episode.title}” is locked immediately.</strong>{' '}
                  Automatic cleanup will permanently remove its private files
                  and Studio content after previously issued upload links are
                  no longer valid.
                </p>
                <p>
                  No further action is normally required. Until cleanup
                  finishes, the production calendar may show this Studio as
                  “Deletion scheduled.”
                </p>
              </div>
            </section>
            {error ? <p className={styles.errorCard}>{error}</p> : null}
            {message ? <p className={styles.successCard}>{message}</p> : null}
            {canManage ? (
              <EpisodeStudioDeletionControl
                episode={episode}
                saving={saving}
                uploading={Boolean(uploadingAsset)}
                deleting={deletingStudio}
                onDelete={deleteStudio}
              />
            ) : null}
          </>
        ) : episode ? (
          <>
            <header className={styles.workspaceHeader}>
              <div>
                <span className={styles.eyebrow}>Episode Studio</span>
                <h1>{episode.title}</h1>
                <p>
                  {hostNames.join(' + ') || 'Host assignment pending'} ·{' '}
                  {episode.season || 'Season 11'}
                </p>
              </div>
              <div className={styles.workspaceHeaderActions}>
                {canManage ? (
                  <button
                    type="button"
                    className={styles.hostPreviewButton}
                    onClick={() => setSettingsOpen(true)}
                  >
                    <SettingsRoundedIcon aria-hidden="true" />
                    Episode settings
                  </button>
                ) : null}
                {canUseHostPreview ? (
                  <button
                    type="button"
                    className={
                      hostPreviewActive
                        ? styles.exitHostPreviewButton
                        : styles.hostPreviewButton
                    }
                    onClick={() => setHostPreview(!hostPreviewActive)}
                  >
                    <VisibilityRoundedIcon aria-hidden="true" />
                    {hostPreviewActive
                      ? 'Return to team view'
                      : 'View as host'}
                  </button>
                ) : null}
                <span
                  className={`${styles.statusPill} ${
                    styles[`status_${episode.status}`] || ''
                  }`}
                >
                  {episode.status === 'accepted' &&
                  episode.production_stage === 'lead_review'
                    ? `Awaiting ${productionLeadName || 'production lead'}`
                    : STATUS_LABELS[episode.status] || episode.status}
                </span>
              </div>
            </header>

            <nav className={styles.episodeWorkspaceTabs} aria-label="Episode workspace">
              <Link
                href={packageHref}
                onClick={productionView ? guardWorkspaceNavigation : undefined}
                className={!productionView ? styles.episodeWorkspaceTabActive : ''}
                aria-current={!productionView ? 'page' : undefined}
              >
                Episode package
              </Link>
              <Link
                href={productionHref}
                onClick={!productionView ? guardWorkspaceNavigation : undefined}
                className={productionView ? styles.episodeWorkspaceTabActive : ''}
                aria-current={productionView ? 'page' : undefined}
              >
                Production board
              </Link>
              {!previewData && !hostPreviewActive ? (
                <Link
                  href={questionnaireHref}
                  onClick={guardWorkspaceNavigation}
                >
                  Guest questionnaire
                </Link>
              ) : null}
            </nav>

            {canManage ? (
              <EpisodeStudioSettingsDrawer
                open={settingsOpen}
                onClose={() => setSettingsOpen(false)}
                footer={
                  <>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={() => setSettingsOpen(false)}
                    >
                      Close
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={Boolean(actionBlockers.save)}
                      title={actionBlockers.save || undefined}
                      onClick={async () => {
                        const saved = await saveDraft();
                        if (saved) setSettingsOpen(false);
                      }}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      Save settings
                    </button>
                  </>
                }
              >
                <section className={styles.producerPanel}>
                  <div className={styles.panelHeading}>
                    <div>
                      <span className={styles.eyebrow}>Producer setup</span>
                      <h2>Schedule and assignments</h2>
                    </div>
                    <span>Changes publish when you save.</span>
                  </div>
                  <div className={styles.producerGrid}>
                    <label>
                      Episode title
                      <input
                        value={episode.title}
                        onChange={(event) =>
                          updateEpisode({ title: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Season
                      <input
                        value={episode.season}
                        onChange={(event) =>
                          updateEpisode({ season: event.target.value })
                        }
                      />
                    </label>
                    <label>
                      Air date
                      <FriendlyDateField
                        value={episode.target_release_date}
                        onChange={(event) =>
                          updateEpisode({
                            target_release_date: event.target.value,
                          })
                        }
                        ariaLabel="air date"
                      />
                    </label>
                    <label>
                      Host package due
                      <FriendlyDateField
                        value={episode.due_date}
                        onChange={(event) =>
                          updateEpisode({ due_date: event.target.value })
                        }
                        ariaLabel="host package due date"
                      />
                    </label>
                    <EpisodeRecordingFields
                      schedule={episode}
                      onChange={updateEpisode}
                    />
                    <label>
                      Producer
                      <select
                        value={episode.producer_person_id || ''}
                        onChange={(event) => {
                          const producerPersonId = event.target.value;
                          const producer = producers.find(
                            (candidate) =>
                              candidate.person_id === producerPersonId
                          );
                          updateEpisode({
                            producer_person_id: producerPersonId,
                            producer_email:
                              producer?.account_email || episode.producer_email,
                          });
                        }}
                      >
                        <option value="">Choose later</option>
                        {producers.map((producer) => (
                          <option
                            key={producer.person_id}
                            value={producer.person_id}
                          >
                            {producer.name}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className={styles.fullField}>
                      Producer notification email
                      <input
                        type="email"
                        value={episode.producer_email}
                        onChange={(event) =>
                          updateEpisode({ producer_email: event.target.value })
                        }
                        placeholder="producer@example.com"
                      />
                    </label>
                  </div>
                  <div className={styles.assignmentPicker}>
                    <strong>Assigned hosts</strong>
                    <div>
                      {people.map((person) => {
                        const assigned = episode.host_person_ids.includes(
                          person.person_id
                        );
                        return (
                          <label
                            key={person.person_id}
                            className={assigned ? styles.assignmentActive : ''}
                          >
                            <input
                              type="checkbox"
                              checked={assigned}
                              onChange={(event) => {
                                const ids = event.target.checked
                                  ? [
                                      ...episode.host_person_ids,
                                      person.person_id,
                                    ]
                                  : episode.host_person_ids.filter(
                                      (personId) =>
                                        personId !== person.person_id
                                    );
                                updateEpisode({ host_person_ids: ids });
                              }}
                            />
                            {person.name}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                </section>
              </EpisodeStudioSettingsDrawer>
            ) : null}

            {hostPreviewActive ? (
              <section className={styles.hostPreviewBanner} role="status">
                <VisibilityRoundedIcon aria-hidden="true" />
                <div>
                  <strong>Viewing this Studio as a host</strong>
                  <span>
                    This is the host-facing form and it is read-only while you
                    QA it. Your AWS roles and account access have not changed.
                  </span>
                </div>
                <button type="button" onClick={() => setHostPreview(false)}>
                  Exit preview
                </button>
              </section>
            ) : null}

            <section
              className={`${styles.healthPanel} ${
                offTrack ? styles.healthPanelOffTrack : ''
              }`}
            >
              <div className={styles.healthCopy}>
                <span className={styles.eyebrow}>Delivery outlook</span>
                <strong>
                  {healthLocked
                    ? 'Delivery complete'
                    : offTrack
                      ? 'Off track'
                      : 'On track'}
                </strong>
                <p>
                  {healthLocked
                    ? 'The producer has accepted this episode package, so its delivery outlook is complete.'
                    : automaticOffTrack
                      ? `${overdueWorkflowTasks.length || 1} required workflow ${
                          overdueWorkflowTasks.length === 1
                            ? 'step is'
                            : 'steps are'
                        } overdue. Episode Studio automatically keeps this episode off track until the work is completed or waived by a manager.`
                    : offTrack
                    ? 'The expected production schedule is at risk. This signal is visible to the production team; add details to the discussion when you are ready.'
                    : 'The team currently expects this episode package to arrive by its planned due date.'}
                </p>
                {!healthLocked &&
                episode.delivery_health_updated_by_name ? (
                  <small>
                    {offTrack ? 'Flagged' : 'Marked on track'} by{' '}
                    {episode.delivery_health_updated_by_name}
                    {episode.delivery_health_updated_at
                      ? ` · ${formatDateTime(
                          episode.delivery_health_updated_at
                        )}`
                      : ''}
                  </small>
                ) : null}
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={offTrack}
                className={`${styles.healthSwitch} ${
                  offTrack ? styles.healthSwitchActive : ''
                }`}
                disabled={
                  hostPreviewReadOnly ||
                  automaticOffTrack ||
                  Boolean(actionBlockers.deliveryHealth)
                }
                title={
                  hostPreviewReadOnly
                    ? 'Exit host preview to change the delivery outlook.'
                    : automaticOffTrack
                      ? 'Complete or waive the overdue workflow step before returning this episode to on track.'
                    : actionBlockers.deliveryHealth || undefined
                }
                onClick={() =>
                  setDeliveryHealth(offTrack ? 'on_track' : 'off_track')
                }
              >
                <span className={styles.healthSwitchTrack} aria-hidden="true">
                  <span />
                </span>
                <span>
                  {healthLocked
                    ? 'Accepted'
                    : offTrack
                      ? 'Mark on track'
                      : 'Flag off track'}
                </span>
              </button>
            </section>

            <EpisodeRecordingSummary
              episode={episode}
              onDownload={downloadRecordingCalendar}
            />

            <section className={styles.productionStrip}>
              <div>
                <span>Air date</span>
                <strong>{formatDate(episode.target_release_date)}</strong>
              </div>
              <div>
                <span>Host package due</span>
                <strong>{formatDate(episode.due_date)}</strong>
              </div>
              <div>
                <span>Required material</span>
                <strong>
                  {completion.completed} of {completion.required}
                </strong>
              </div>
              <div className={styles.progressCell}>
                <span>{completion.host_percent}% host-ready</span>
                <span className={styles.progressTrack}>
                  <span style={{ width: `${completion.host_percent}%` }} />
                </span>
              </div>
              <div>
                <span>Final approval</span>
                <strong>
                  {completion.producer_approved ? 'Complete' : 'Pending'}
                </strong>
              </div>
            </section>
            <p className={styles.stageExplanation}>
              {completion.remaining_reason}
            </p>

            {productionView ? (
              <>
                <section
                  className={styles.workflowPanel}
                  id="production-workflow"
                  aria-labelledby="production-workflow-heading"
                >
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>Air-date workflow</span>
                  <h2 id="production-workflow-heading">Production workflow</h2>
                  <p>
                    Scan the board, open a task to work it, or use Schedule to
                    adjust every deadline and owner in one place.
                  </p>
                </div>
                {(episode.production_tasks || []).length ? (
                  <div className={styles.workflowViewControls}>
                    {canManage ? (
                      <div
                        className={styles.workflowViewToggle}
                        role="group"
                        aria-label="Production workflow view"
                      >
                        <button
                          type="button"
                          aria-pressed={workflowDisplay === 'board'}
                          onClick={() => setWorkflowDisplay('board')}
                        >
                          Board
                        </button>
                        <button
                          type="button"
                          aria-pressed={workflowDisplay === 'schedule'}
                          onClick={() => setWorkflowDisplay('schedule')}
                        >
                          Schedule
                        </button>
                      </div>
                    ) : null}
                    <div className={styles.workflowSummaryBadge}>
                      <strong>{workflowSummary.completion_percent || 0}%</strong>
                        <span>workflow complete</span>
                    </div>
                  </div>
                ) : null}
              </div>

              {(episode.production_tasks || []).length ? (
                <>
                  {canManage && workflowDisplay === 'schedule' ? (
                    <section
                      className={styles.workflowManagerConsole}
                      aria-labelledby="workflow-manager-console-heading"
                    >
                      <div className={styles.workflowManagerConsoleHeader}>
                        <div>
                          <span>Production console</span>
                          <strong id="workflow-manager-console-heading">
                            Deadlines &amp; owners
                          </strong>
                          <small aria-live="polite">
                            Air date {formatDate(episode.target_release_date)} ·
                            {workflowScheduleChangeCount
                              ? ` ${workflowScheduleChangeCount} unsaved ${
                                  workflowScheduleChangeCount === 1
                                    ? 'row'
                                    : 'rows'
                                }.`
                              : ' all changes saved.'}
                          </small>
                        </div>
                        <button
                          type="button"
                          className={styles.primaryButton}
                          disabled={
                            saving || workflowScheduleChangeCount === 0
                          }
                          onClick={saveProductionWorkflowConfiguration}
                        >
                          <SaveRoundedIcon aria-hidden="true" />
                          {saving
                            ? 'Saving…'
                            : workflowScheduleChangeCount === 1
                              ? 'Save 1 change'
                              : `Save ${workflowScheduleChangeCount} changes`}
                        </button>
                      </div>
                      <div
                        className={styles.workflowManagerColumnLabels}
                        aria-hidden="true"
                      >
                        <span>Step</span>
                        <span>Deadline</span>
                        <span>Accountable owner</span>
                        <span>Air-date rule</span>
                      </div>
                      <div className={styles.workflowManagerRows}>
                        {episode.production_tasks.map((task) => {
                          const calculatedDueDate = dateDaysBefore(
                            episode.target_release_date,
                            task.days_before_air
                          );
                          const calculatedDateIsActive = Boolean(
                            calculatedDueDate &&
                              task.due_date === calculatedDueDate &&
                              task.due_date_overridden !== true
                          );
                          const ruleLabel =
                            Number(task.days_before_air) === 0
                              ? 'Air date'
                              : `Day ${task.days_before_air}`;
                          const resetLabel = calculatedDueDate
                            ? calculatedDateIsActive
                              ? `Using ${ruleLabel}`
                              : `Use ${ruleLabel}`
                            : 'Air date needed';

                          return (
                            <div
                              key={task.task_id}
                              className={styles.workflowManagerRow}
                              data-changed={
                                workflowScheduleTaskChanged(task)
                                  ? 'true'
                                  : 'false'
                              }
                            >
                              <div className={styles.workflowManagerStep}>
                                <span>{formatWorkflowPhase(task.phase)}</span>
                                <strong>{task.label}</strong>
                              </div>
                              <div className={styles.workflowManagerDate}>
                                <span>Deadline</span>
                                <FriendlyDateField
                                  value={task.due_date || ''}
                                  onChange={(event) =>
                                    updateProductionTaskLocal(task.task_id, {
                                      due_date: event.target.value,
                                      due_date_overridden: true,
                                    })
                                  }
                                  ariaLabel={`${task.label} deadline`}
                                  disabled={saving}
                                />
                              </div>
                              {task.owner_type === 'person' ? (
                                <label className={styles.workflowManagerOwner}>
                                  <span>Accountable owner</span>
                                  <select
                                    value={
                                      task.assigned_person_ids?.[0] || ''
                                    }
                                    disabled={saving}
                                    aria-label={`${task.label} accountable owner`}
                                    onChange={(event) =>
                                      updateProductionTaskLocal(task.task_id, {
                                        assigned_person_ids: event.target.value
                                          ? [event.target.value]
                                          : [],
                                      })
                                    }
                                  >
                                    <option value="">Choose owner</option>
                                    {workflowOwnerOptions(task).map((person) => (
                                      <option
                                        key={person.person_id}
                                        value={person.person_id}
                                      >
                                        {person.name}
                                        {person.account_active === false
                                          ? ' (inactive)'
                                          : ''}
                                      </option>
                                    ))}
                                  </select>
                                </label>
                              ) : (
                                <div
                                  className={styles.workflowManagerOwnerReadOnly}
                                >
                                  <span>Accountable owner</span>
                                  <strong>
                                    {workflowTaskOwnerLabel(task)}
                                  </strong>
                                </div>
                              )}
                              <button
                                type="button"
                                className={styles.workflowManagerReset}
                                disabled={
                                  saving ||
                                  !calculatedDueDate ||
                                  calculatedDateIsActive
                                }
                                title={
                                  calculatedDueDate
                                    ? `Use the calculated ${formatDate(
                                        calculatedDueDate
                                      )} deadline`
                                    : 'Set an air date before calculating this deadline.'
                                }
                                onClick={() =>
                                  updateProductionTaskLocal(task.task_id, {
                                    due_date: calculatedDueDate,
                                    due_date_overridden: false,
                                  })
                                }
                              >
                                {resetLabel}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  ) : null}

                  {workflowDisplay === 'board' ? (
                    <EpisodeProductionBoard
                      productionTasks={workflowTasksWithDrafts}
                      canEditTasks={
                        canConfigure && !hostPreviewReadOnly
                      }
                      canAddTasks={
                        canConfigure && !hostPreviewReadOnly
                      }
                      canMoveTasks={
                        canConfigure && !hostPreviewReadOnly
                      }
                      moveTaskDisabledReason={
                        saving
                          ? 'Wait for the current save to finish before moving a tile.'
                          : workflowScheduleChangeCount > 0
                            ? 'Save the Schedule changes before moving task tiles.'
                            : ''
                      }
                      onAddTask={openNewProductionTask}
                      onEditTask={openProductionTaskEditor}
                      onOpenTask={openProductionTaskWorkspace}
                      onMoveTask={moveProductionTaskOnBoard}
                      editTaskLabel="Edit"
                      getOwnerLabel={workflowTaskOwnerLabel}
                      canUpdateTask={canUpdateWorkflowTask}
                      isMyTask={isWorkflowTaskMine}
                      areDependenciesComplete={workflowDependenciesComplete}
                      getDependencyLabels={workflowDependencyLabels}
                      getTaskSearchText={(task) =>
                        [
                          task.evidence_note,
                          task.evidence_url,
                          ...(task.linked_deliverable_ids || []).map(
                            (deliverableId) =>
                              episode.deliverables.find(
                                (deliverable) =>
                                  deliverable.id === deliverableId
                              )?.label || deliverableId
                          ),
                        ]
                          .filter(Boolean)
                          .join(' ')
                      }
                      isTaskOverdue={workflowTaskIsEffectivelyOverdue}
                      isTaskComplete={workflowTaskIsEffectivelyComplete}
                      renderTaskDetails={renderWorkflowTaskDetails}
                      renderTaskActions={renderWorkflowTaskActions}
                    />
                  ) : null}

                  {workflowTaskWorkTask && workflowTaskWorkContext ? (
                    <EpisodeProductionWorkDrawer
                      open
                      task={workflowTaskWorkTask}
                      context={workflowTaskWorkContext}
                      phaseLabel={formatWorkflowPhase(
                        workflowTaskWorkTask.phase
                      )}
                      ownerLabel={workflowTaskOwnerLabel(
                        workflowTaskWorkTask
                      )}
                      canEditDefinition={
                        canConfigure && !hostPreviewReadOnly
                      }
                      saving={saving}
                      actions={renderWorkflowTaskActions(
                        workflowTaskWorkTask,
                        workflowTaskWorkContext
                      )}
                      onEditDefinition={() =>
                        openProductionTaskEditor(workflowTaskWorkTask)
                      }
                      onClose={closeProductionTaskWorkspace}
                    >
                      {renderWorkflowTaskDetails(
                        workflowTaskWorkTask,
                        workflowTaskWorkContext
                      )}
                    </EpisodeProductionWorkDrawer>
                  ) : null}

                  {workflowTaskEditor ? (
                    <EpisodeProductionTaskEditor
                      key={`${workflowTaskEditor.mode}-${
                        workflowTaskEditor.taskId ||
                        workflowTaskEditor.defaultPhaseId ||
                        'task'
                      }`}
                      open
                      mode={workflowTaskEditor.mode}
                      task={workflowTaskEditorTask}
                      tasks={episode.production_tasks.map(
                        workflowTaskWithDraft
                      )}
                      defaultPhaseId={workflowTaskEditor.defaultPhaseId}
                      ownerOptions={workflowTaskEditorOwnerOptions}
                      airDate={episode.target_release_date}
                      hasAssignedProducer={Boolean(
                        episode.producer_person_id
                      )}
                      saving={saving}
                      serverError={error}
                      onClose={closeProductionTaskEditor}
                      onSave={saveProductionTaskDefinition}
                    />
                  ) : null}

                </>
              ) : canManage ? (
                <div className={styles.workflowEmptyState}>
                  <strong>This older episode does not have a timeline yet.</strong>
                  <p>
                    Add the current air-date workflow without changing its
                    existing host answers or files.
                  </p>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={saving}
                    onClick={enableProductionWorkflow}
                  >
                    Add production timeline
                  </button>
                </div>
              ) : (
                <p className={styles.workflowEmptyState}>
                  The production manager has not added the air-date workflow
                  to this episode yet.
                </p>
              )}
                </section>

                {producerProofUploadTask || proofApprovalTask ? (
                  <section
                    className={styles.proofPanel}
                    id="producer-proof"
                    aria-labelledby="producer-proof-heading"
                  >
                <div className={styles.panelHeading}>
                  <div>
                    <span className={styles.eyebrow}>Private producer proof</span>
                    <h2 id="producer-proof-heading">
                      Upload, listen, and approve
                    </h2>
                    <p>
                      The producer places the proof here. Assigned hosts can
                      download the secured file, listen outside the browser,
                      and record approval or requested changes.
                    </p>
                  </div>
                  <span>
                    Approval due {formatDate(proofApprovalTask?.due_date)}
                  </span>
                </div>

                <div className={styles.proofSecurityNotice}>
                  <WarningAmberRoundedIcon aria-hidden="true" />
                  <div>
                    <strong>Internal production material</strong>
                    <p>
                      Never send this secured proof, a staged Spotify link, or
                      the internal publishing package to a guest. If the host
                      and producer deliberately approve an optional guest
                      listen, create a separate permission-controlled Google
                      Drive copy containing only the approved program.
                    </p>
                  </div>
                </div>

                {canUploadProducerProof ? (
                  <div className={styles.proofUploadZone}>
                    <div>
                      <strong>Producer upload</strong>
                      <span>
                        Upload the current proof or replacement master. Clear
                        versioned filenames make host approval auditable.
                      </span>
                    </div>
                    <label className={styles.assetFilePicker}>
                      <CloudUploadRoundedIcon aria-hidden="true" />
                      {uploadingDeliverableId === 'producer-proof-audio'
                        ? 'Uploading proof…'
                        : 'Choose private proof audio'}
                      <input
                        type="file"
                        accept={getEpisodeAssetAccept('recording')}
                        disabled={
                          Boolean(uploadingAsset) ||
                          !producerProofDeliverable
                        }
                        onChange={(event) => {
                          uploadEpisodeAssets(
                            event.target.files,
                            producerProofDeliverable
                          );
                          event.target.value = '';
                        }}
                      />
                    </label>
                    {assetUploadFeedback['producer-proof-audio'] ? (
                      <p
                        className={
                          assetUploadFeedback['producer-proof-audio'].tone ===
                          'error'
                            ? styles.errorCard
                            : styles.successCard
                        }
                        role="status"
                      >
                        {assetUploadFeedback['producer-proof-audio'].message}
                      </p>
                    ) : null}
                  </div>
                ) : null}

                <div className={styles.proofFileList}>
                  {producerProofAssets.length ? (
                    producerProofAssets.map((asset) => {
                      const expired = isEpisodeAssetExpired(asset);
                      return (
                        <article key={asset.asset_id}>
                          <div>
                            <strong>{asset.label || asset.file_name}</strong>
                            <span>
                              {asset.file_name} · {formatBytes(asset.size)}
                              {asset.uploaded_by_name
                                ? ` · uploaded by ${asset.uploaded_by_name}`
                                : ''}
                            </span>
                          </div>
                          <div className={styles.assetActions}>
                            {expired ? (
                              <span className={styles.assetExpiredBadge}>
                                Storage window ended
                              </span>
                            ) : (
                              <a
                                href={`/api/studio/episodes/${encodeURIComponent(
                                  episode.episode_id
                                )}/assets/${encodeURIComponent(asset.asset_id)}`}
                              >
                                Download proof
                              </a>
                            )}
                            {viewerCanDeleteAsset(asset) ? (
                              <button
                                type="button"
                                className={styles.assetDeleteButton}
                                disabled={deletingAssetId === asset.asset_id}
                                onClick={() => deleteEpisodeAsset(asset)}
                              >
                                <DeleteOutlineRoundedIcon aria-hidden="true" />
                                {deletingAssetId === asset.asset_id
                                  ? 'Deleting…'
                                  : 'Delete'}
                              </button>
                            ) : null}
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <p className={styles.workflowEmptyState}>
                      No private proof has been uploaded yet.
                    </p>
                  )}
                </div>

                {proofApprovalTask ? (
                  <div className={styles.proofApprovalZone}>
                    <div>
                      <strong>Host proof decision</strong>
                      <span>
                        Download and listen to the complete program before
                        recording a decision.
                      </span>
                    </div>
                    {(canHost || canManage) && !hostPreviewReadOnly ? (
                      <>
                        <label>
                          Listening note or requested change
                          <PlainTextArea
                            value={proofApprovalTask.evidence_note || ''}
                            onValueChange={(note) =>
                              updateProductionTaskLocal(
                                proofApprovalTask.task_id,
                                { evidence_note: note }
                              )
                            }
                            maxLength={2000}
                          />
                        </label>
                        <div className={styles.proofDecisionActions}>
                          <button
                            type="button"
                            className={styles.secondaryButton}
                            disabled={
                              saving ||
                              availableProducerProofAssets.length === 0 ||
                              (proofApprovalTask.evidence_note || '').trim()
                                .length < 4
                            }
                            onClick={() =>
                              updateProductionTask(
                                proofApprovalTask.task_id,
                                {
                                  status: 'in_progress',
                                  proof_decision: 'changes_requested',
                                  note: proofApprovalTask.evidence_note,
                                },
                                'Proof changes requested.'
                              )
                            }
                          >
                            Request proof changes
                          </button>
                          <button
                            type="button"
                            className={styles.primaryButton}
                            disabled={
                              saving ||
                              availableProducerProofAssets.length === 0
                            }
                            onClick={() =>
                              updateProductionTask(
                                proofApprovalTask.task_id,
                                {
                                  status: 'complete',
                                  proof_decision: 'approved',
                                  note: proofApprovalTask.evidence_note,
                                },
                                'The private proof is approved.'
                              )
                            }
                          >
                            <CheckCircleRoundedIcon aria-hidden="true" />
                            Approve proof
                          </button>
                        </div>
                      </>
                    ) : (
                      <p>
                        {proofApprovalTask.proof_decision === 'approved'
                          ? `Approved by ${
                              proofApprovalTask.completed_by_name ||
                              'the assigned host'
                            }.`
                          : proofApprovalTask.proof_decision ===
                              'changes_requested'
                            ? 'The host requested changes. Review the note and upload a replacement proof.'
                            : 'Waiting for an assigned host to record the proof decision.'}
                      </p>
                    )}
                  </div>
                ) : null}
                  </section>
                ) : null}
                {error ? <p className={styles.errorCard}>{error}</p> : null}
                {message ? <p className={styles.successCard}>{message}</p> : null}
              </>
            ) : null}

            {!productionView ? (
              <>
                <EpisodeCommunicationClipboard
                  pinnedNote={episode.producer_feedback || ''}
                  pinnedNoteEditable={
                    (canReview || canAdminOverride) && !hostPreviewReadOnly
                  }
                  pinnedNoteSaving={saving}
                  onPinnedNoteChange={(producerFeedback) =>
                    updateEpisode({ producer_feedback: producerFeedback })
                  }
                  onSavePinnedNote={saveCommunicationNote}
                  messages={episode.messages || []}
                  messageDraft={messageDraft}
                  messageComposerEnabled={!hostPreviewReadOnly}
                  messagePosting={saving}
                  onMessageDraftChange={setMessageDraft}
                  onPostMessage={postMessage}
                />

            <section id="sponsor-reads" className={styles.sponsorReadsPanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>Sponsor reads</span>
                  <h2>Approved language attached to this episode</h2>
                </div>
                <span>
                  {(episode.sponsor_read_assignments || []).length}{' '}
                  {(episode.sponsor_read_assignments || []).length === 1
                    ? 'assignment'
                    : 'assignments'}
                </span>
              </div>

              {canConfigure ? (
                <div className={styles.sponsorAssignmentControls}>
                  <label>
                    Approved script
                    <select
                      value={selectedSponsorReadId}
                      onChange={(event) =>
                        setSelectedSponsorReadId(event.target.value)
                      }
                    >
                      <option value="">Choose a current sponsor read</option>
                      {availableSponsorReads.map((read) => (
                        <option
                          key={read.sponsor_read_id}
                          value={read.sponsor_read_id}
                        >
                          {read.sponsor_name} — {read.script_title} (v
                          {read.version_number})
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className={styles.audioRequirement}>
                    <input
                      type="checkbox"
                      checked={sponsorRequiresAudio}
                      onChange={(event) =>
                        setSponsorRequiresAudio(event.target.checked)
                      }
                    />
                    Host must record and upload sponsor audio
                  </label>
                  {sponsorRequiresAudio ? (
                    <label>
                      Recording evidence
                      <select
                        value={sponsorRecordingMode}
                        onChange={(event) =>
                          setSponsorRecordingMode(event.target.value)
                        }
                      >
                        <option value="separate_upload">
                          Separate ad-spot upload
                        </option>
                        <option value="included_in_voice_file">
                          Included in main voice file
                        </option>
                      </select>
                    </label>
                  ) : null}
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving || !selectedSponsorReadId}
                    title={
                      saving
                        ? 'Wait for the current Studio update to finish.'
                        : !selectedSponsorReadId
                          ? 'Choose an approved sponsor read first.'
                          : undefined
                    }
                    onClick={assignSponsorRead}
                  >
                    <CampaignRoundedIcon aria-hidden="true" />
                    Assign snapshot
                  </button>
                </div>
              ) : null}

              {(episode.sponsor_read_assignments || []).length ? (
                <div className={styles.sponsorReadList}>
                  {episode.sponsor_read_assignments.map((assignment) => (
                    <article
                      key={assignment.assignment_id}
                      className={
                        assignment.script_changed ||
                        assignment.script_expired ||
                        assignment.script_retired
                          ? styles.sponsorReadWarning
                          : ''
                      }
                    >
                      <header>
                        <div>
                          <strong>{assignment.sponsor_name}</strong>
                          <h3>{assignment.script_title}</h3>
                          <span>
                            Frozen version {assignment.version_number} ·
                            assigned by {assignment.assigned_by_name || 'Studio team'}{' '}
                            {assignment.assigned_at
                              ? `on ${formatDateTime(assignment.assigned_at)}`
                              : ''}
                          </span>
                        </div>
                        <div className={styles.sponsorReadStatus}>
                          <span>
                            {assignment.completed ? 'Complete' : 'Host action needed'}
                          </span>
                          {canConfigure ? (
                            <button
                              type="button"
                              aria-label={`Remove ${assignment.script_title}`}
                              onClick={() =>
                                removeSponsorRead(assignment.assignment_id)
                              }
                            >
                              <DeleteOutlineRoundedIcon aria-hidden="true" />
                            </button>
                          ) : null}
                        </div>
                      </header>
                      {assignment.script_changed ? (
                        <p className={styles.scriptNotice}>
                          The library now has version{' '}
                          {assignment.library_version_number}. This episode
                          still uses its frozen version until a manager
                          intentionally reassigns it.
                        </p>
                      ) : null}
                      {assignment.script_expired ? (
                        <p className={styles.scriptNotice}>
                          This script is expired. A manager should review and
                          replace it before recording.
                        </p>
                      ) : null}
                      {assignment.script_retired ? (
                        <p className={styles.scriptNotice}>
                          The source script is retired or unavailable in the
                          library. This episode still shows its frozen copy so
                          the production record remains intact.
                        </p>
                      ) : null}
                      {assignment.library_check_unavailable ? (
                        <p className={styles.scriptNotice}>
                          The current library version could not be checked.
                          The frozen approved text below remains available.
                        </p>
                      ) : null}
                      <div className={styles.approvedScript}>
                        <span>Exact approved text</span>
                        <p className={styles.plainTextContent}>
                          {assignment.approved_text}
                        </p>
                      </div>
                      {assignment.pronunciation_guidance ? (
                        <div className={styles.sponsorGuidance}>
                          <strong>Pronunciation</strong>
                          <p className={styles.plainTextContent}>
                            {assignment.pronunciation_guidance}
                          </p>
                        </div>
                      ) : null}
                      {assignment.host_instructions ? (
                        <div className={styles.sponsorGuidance}>
                          <strong>Host instructions</strong>
                          <p className={styles.plainTextContent}>
                            {assignment.host_instructions}
                          </p>
                        </div>
                      ) : null}
                      <div className={styles.sponsorReadFooter}>
                        <span>
                          {assignment.requires_audio
                            ? assignment.recording_mode ===
                              'included_in_voice_file'
                              ? 'Confirm this spot inside the main voice file'
                              : 'Separate ad-spot audio required'
                            : 'No separate sponsor-audio upload required'}
                        </span>
                        {assignment.requires_audio ? (
                          <div>
                            <select
                              value={assignment.audio_asset_id || ''}
                              disabled={lockedForHost || saving}
                              title={
                                lockedForHost
                                  ? hostEditBlocker
                                  : saving
                                    ? 'Wait for the current Studio update to finish.'
                                    : undefined
                              }
                              aria-label={`${assignment.sponsor_name} recording evidence`}
                              onChange={(event) => {
                                const audioAssetId = event.target.value;
                                setEpisode((current) => ({
                                  ...current,
                                  sponsor_read_assignments:
                                    current.sponsor_read_assignments.map(
                                      (candidate) =>
                                        candidate.assignment_id ===
                                        assignment.assignment_id
                                          ? {
                                              ...candidate,
                                              audio_asset_id: audioAssetId,
                                              completed: false,
                                            }
                                          : candidate
                                    ),
                                }));
                              }}
                            >
                              <option value="">
                                Choose uploaded audio evidence
                              </option>
                              {(episode.assets || [])
                                .filter(
                                  (asset) =>
                                    asset.content_type.startsWith('audio/') &&
                                    (assignment.recording_mode ===
                                    'included_in_voice_file'
                                      ? asset.category === 'recording'
                                      : asset.category === 'sponsor_audio')
                                )
                                .map((asset) => (
                                  <option
                                    key={asset.asset_id}
                                    value={asset.asset_id}
                                  >
                                    {asset.label || asset.file_name}
                                  </option>
                                ))}
                            </select>
                            <input
                              type="url"
                              value={assignment.audio_url}
                              disabled={lockedForHost || saving}
                              title={
                                lockedForHost
                                  ? hostEditBlocker
                                  : saving
                                    ? 'Wait for the current Studio update to finish.'
                                    : undefined
                              }
                              onChange={(event) => {
                                const audioUrl = event.target.value;
                                setEpisode((current) => ({
                                  ...current,
                                  sponsor_read_assignments:
                                    current.sponsor_read_assignments.map(
                                      (candidate) =>
                                        candidate.assignment_id ===
                                        assignment.assignment_id
                                          ? {
                                              ...candidate,
                                              audio_url: audioUrl,
                                              audio_asset_id: '',
                                              completed: false,
                                            }
                                          : candidate
                                    ),
                                }));
                              }}
                              aria-label={`${assignment.sponsor_name} sponsor audio link`}
                            />
                            {canHost && !lockedForHost ? (
                              <button
                                type="button"
                                className={styles.secondaryButton}
                                disabled={
                                  saving ||
                                  (!assignment.audio_asset_id &&
                                    !assignment.audio_url.trim())
                                }
                                title={
                                  saving
                                    ? 'Wait for the current Studio update to finish.'
                                    : !assignment.audio_asset_id &&
                                        !assignment.audio_url.trim()
                                      ? 'Choose uploaded audio evidence or add the legacy audio link first.'
                                      : undefined
                                }
                                onClick={() =>
                                  updateSponsorAssignment(assignment, {
                                    completed: true,
                                  })
                                }
                              >
                                <CheckCircleRoundedIcon aria-hidden="true" />
                                Mark complete
                              </button>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.discussionEmpty}>
                  No sponsor reads are assigned to this episode.
                </p>
              )}
            </section>

            <section
              className={styles.hostProductionSection}
              aria-labelledby="host-production-heading"
            >
            <EpisodeChecklistWorkspace
              id="host-production-heading"
              remainingCount={completion.missing.length}
              totalCount={completion.required}
              canCustomize={canConfigure && !hostPreviewReadOnly}
              customizationLocked={LOCKED_HOST_STATUSES.includes(
                episode.status
              )}
              customizationLockedReason="Reopen the host package before changing its checklist."
              mode={checklistMode}
              onModeChange={setChecklistMode}
              onAddRequirement={addChecklistItem}
              addDisabled={
                (episode.deliverables || []).length >=
                MAX_EPISODE_DELIVERABLES
              }
              addDisabledReason={`A checklist can contain up to ${MAX_EPISODE_DELIVERABLES} items.`}
              onSave={saveChecklistConfiguration}
              saving={saving}
              dirty={checklistDirty}
              saveDisabled={
                !checklistDirty || Boolean(actionBlockers.save)
              }
              saveDisabledReason={
                actionBlockers.save ||
                (!checklistDirty ? 'The checklist is already up to date.' : '')
              }
              onDone={() => {
                if (
                  checklistDirty &&
                  !window.confirm(
                    'Checklist changes are not saved yet. Return to the host response view anyway?'
                  )
                ) {
                  return false;
                }
                return true;
              }}
            />

            {checklistMode === 'view' ? (
              <>
            {hostEditBlocker ? (
              <p className={styles.hostLockNotice}>
                <strong>Why these fields are read-only:</strong>{' '}
                {hostEditBlocker}
              </p>
            ) : null}

            <section className={styles.formRoutingGuide}>
              <div>
                <strong>Finished words</strong>
                <span>Put copy and written answers in the matching step.</span>
              </div>
              <div>
                <strong>Timestamps</strong>
                <span>Use only “First cut or timestamped edit notes.”</span>
              </div>
              <div>
                <strong>Files and documents</strong>
                <span>Upload them directly inside the matching step.</span>
              </div>
              <div>
                <strong>Questions and decisions</strong>
                <span>Use the episode discussion above.</span>
              </div>
            </section>

            {episode.producer_directions ? (
              <section className={styles.legacyHandoffPanel}>
                <span className={styles.eyebrow}>Previous form preserved</span>
                <h3>Existing episode-wide handoff brief</h3>
                <p>
                  This was entered in the earlier form and remains available
                  for this episode. Put new or revised information in the
                  matching step below.
                </p>
                <div className={styles.plainTextContent}>
                  {episode.producer_directions}
                </div>
              </section>
            ) : null}

            <div className={styles.deliverableList}>
              {hostDeliverables.map((deliverable, index) => {
                const stepAssets = (episode.assets || []).filter(
                  (asset) => asset.deliverable_id === deliverable.id
                );
                const isMicKitPlan = deliverable.id === 'mic-kit-plan';
                const hasLiveMicKitStatus = Boolean(
                  isMicKitPlan &&
                    micKitLiveStatus?.episodeId === episode.episode_id &&
                    micKitLiveStatus.hostIdsKey === activeMicKitHostIdsKey
                );
                const complete = isMicKitPlan
                  ? hasLiveMicKitStatus &&
                    micKitLiveStatus.complete === true
                  : isDeliverableComplete(
                      deliverable,
                      episode.assets,
                      episode.host_person_ids
                    );
                const missingRequired = Boolean(
                  deliverable.required &&
                    !complete &&
                    (!isMicKitPlan || hasLiveMicKitStatus)
                );
                const responseStatusLabel = isMicKitPlan
                  ? !hasLiveMicKitStatus
                    ? 'Checking status'
                    : complete
                      ? 'All participants ready'
                      : 'Needs attention'
                  : complete
                    ? 'Response complete'
                    : 'No response yet';
                const assetCategory =
                  deliverable.asset_category || 'document';
                const uploadFeedback =
                  assetUploadFeedback[deliverable.id] || null;
                return (
                  <article
                    key={deliverable.id}
                    id={`deliverable-${deliverable.id}`}
                    className={`${styles.deliverableCard} ${
                      complete ? styles.deliverableComplete : ''
                    }`}
                  >
                    <div className={styles.deliverableNumber}>
                      {complete ? (
                        <CheckCircleRoundedIcon aria-hidden="true" />
                      ) : (
                        <RadioButtonUncheckedRoundedIcon aria-hidden="true" />
                      )}
                      <span>{String(index + 1).padStart(2, '0')}</span>
                    </div>
                    <div className={styles.deliverableBody}>
                      <div className={styles.deliverableHeading}>
                        <div>
                          <h3>{deliverable.label}</h3>
                          <span className={styles.producerGuidanceLabel}>
                            Producer guidance
                          </span>
                          <p className={styles.plainTextContent}>
                            {isMicKitPlan
                              ? 'Confirm the recording setup for every assigned host and the guest, including any mic-kit request that needs producer follow-up.'
                              : deliverable.description}
                          </p>
                        </div>
                        <span>
                          {deliverable.required ? 'Required' : 'Optional'}
                        </span>
                      </div>

                      <section
                        className={styles.hostResponseZone}
                        aria-label={
                          isMicKitPlan
                            ? `${deliverable.label} host and guest response`
                            : `${deliverable.label} host response`
                        }
                      >
                        <div className={styles.stepZoneHeading}>
                          <div>
                            <span className={styles.hostResponseKicker}>
                              {isMicKitPlan
                                ? 'Host and guest response'
                                : 'Host response'}
                            </span>
                            <strong>
                              {deliverable.id === 'guest-details'
                                ? 'Guest profile and public links'
                                : deliverable.id === 'mic-kit-plan'
                                  ? 'Recording equipment plans'
                                : deliverable.type === 'asset'
                                ? 'Files the host submits'
                                : deliverable.type === 'url'
                                  ? 'Link the host submits'
                                  : 'What the host writes'}
                            </strong>
                            <small>
                              {deliverable.id === 'guest-details'
                                ? 'Add the details the producer needs for contact, show notes, and promotion.'
                                : deliverable.id === 'mic-kit-plan'
                                  ? 'Each assigned host confirms their setup, while the guest plan fills automatically from the questionnaire and mic-kit board.'
                                : deliverable.type === 'asset'
                                ? 'Upload the actual files here.'
                                : 'The field starts empty; use the producer guidance above.'}
                            </small>
                          </div>
                          <span
                            className={`${styles.stepResponseStatus} ${
                              complete
                                ? styles.stepResponseStatusComplete
                                : ''
                            }`}
                          >
                            {responseStatusLabel}
                          </span>
                        </div>

                      {deliverable.id === 'mic-kit-plan' ? (
                        <EpisodeMicKitStep
                          key={`${episode.episode_id}:${activeMicKitHostIdsKey}`}
                          episodeId={episode.episode_id}
                          hosts={(episode.host_person_ids || []).map(
                            (hostPersonId, hostIndex) => ({
                              host_person_id: hostPersonId,
                              name:
                                people.find(
                                  (person) =>
                                    person.person_id === hostPersonId
                                )?.name ||
                                hostNames[hostIndex] ||
                                `Host ${hostIndex + 1}`,
                            })
                          )}
                          requestIdHint={
                            Array.isArray(router.query.mic_request_id)
                              ? router.query.mic_request_id[0]
                              : router.query.mic_request_id || ''
                          }
                          questionnaireHref={questionnaireHref}
                          micKitBoardHref={
                            admin
                              ? `/admin/mic-kits?episode_id=${encodeURIComponent(
                                  episode.episode_id
                                )}`
                              : ''
                          }
                          readOnly={hostPreviewReadOnly}
                          onDataChange={mergeMicKitPlanData}
                          onDirtyChange={setMicKitPlanDirty}
                        />
                      ) : deliverable.id === 'guest-details' ? (
                        <EpisodeGuestDetailsFields
                          profile={deliverable.guest_profile || {}}
                          additionalNotes={deliverable.value || ''}
                          earlierSocialNotes={
                            deliverable.social_profiles || ''
                          }
                          disabled={lockedForHost}
                          disabledTitle={
                            lockedForHost ? hostEditBlocker : undefined
                          }
                          onProfileChange={(profilePatch) =>
                            updateDeliverable(deliverable.id, {
                              guest_profile: {
                                ...(deliverable.guest_profile || {}),
                                ...profilePatch,
                              },
                            })
                          }
                          onAdditionalNotesChange={(value) =>
                            updateDeliverable(deliverable.id, { value })
                          }
                          onEarlierSocialNotesChange={(socialProfiles) =>
                            updateDeliverable(deliverable.id, {
                              social_profiles: socialProfiles,
                            })
                          }
                        />
                      ) : deliverable.type === 'asset' ? null : deliverable.type ===
                        'url' ? (
                        <div className={styles.urlField}>
                          <input
                            type="url"
                            value={deliverable.value}
                            disabled={lockedForHost}
                            title={lockedForHost ? hostEditBlocker : undefined}
                            onChange={(event) =>
                              updateDeliverable(deliverable.id, {
                                value: event.target.value,
                              })
                            }
                            aria-label={deliverable.label}
                          />
                          {complete ? (
                            <a
                              href={deliverable.value}
                              target="_blank"
                              rel="noopener noreferrer"
                              aria-label={`Open ${deliverable.label}`}
                            >
                              <OpenInNewRoundedIcon aria-hidden="true" />
                            </a>
                          ) : null}
                        </div>
                      ) : (
                        <PlainTextArea
                          value={deliverable.value}
                          disabled={lockedForHost}
                          title={lockedForHost ? hostEditBlocker : undefined}
                          onValueChange={(value) =>
                            updateDeliverable(deliverable.id, {
                              value,
                            })
                          }
                          aria-label={deliverable.label}
                          maxLength={12000}
                        />
                      )}

                      {deliverable.type === 'textarea' &&
                      !['guest-details', 'mic-kit-plan'].includes(
                        deliverable.id
                      ) ? (
                        <p className={styles.plainTextHint}>
                          Plain text only. Line breaks and pasted lists stay as
                          entered—no Markdown needed.
                        </p>
                      ) : null}

                      {deliverable.id === 'mic-kit-plan' ? null : (
                      <div
                        className={styles.stepAssets}
                        aria-busy={
                          uploadingDeliverableId === deliverable.id
                        }
                      >
                        <div className={styles.stepAssetsHeading}>
                          <div>
                            <strong>
                              {deliverable.type === 'asset'
                                ? 'Files for this step'
                                : 'Supporting files'}
                            </strong>
                            <span>
                              {deliverable.type === 'asset'
                                ? 'These uploads are the official producer source.'
                                : 'Optional attachments stay with this step.'}
                            </span>
                          </div>
                          <span>
                            {stepAssets.length}{' '}
                            {stepAssets.length === 1 ? 'file' : 'files'}
                          </span>
                        </div>

                        {canUploadForCurrentStatus ? (
                          assetUploadsConfigured ? (
                            <>
                              <label
                                className={`${styles.stepAssetPicker} ${
                                  uploadingAsset
                                    ? styles.stepAssetPickerDisabled
                                    : ''
                                }`}
                              >
                                <CloudUploadRoundedIcon aria-hidden="true" />
                                <span>
                                  {uploadingDeliverableId === deliverable.id
                                    ? `Uploading ${uploadingAsset}…`
                                    : deliverable.type === 'asset'
                                      ? 'Upload files for this step'
                                      : 'Add a supporting file'}
                                </span>
                                <input
                                  type="file"
                                  multiple
                                  accept={getEpisodeAssetAccept(assetCategory)}
                                  disabled={Boolean(uploadingAsset)}
                                  aria-describedby={`asset-upload-help-${deliverable.id}${
                                    uploadFeedback
                                      ? ` asset-upload-feedback-${deliverable.id}`
                                      : ''
                                  }`}
                                  onChange={(event) => {
                                    uploadEpisodeAssets(
                                      event.target.files,
                                      deliverable
                                    );
                                    event.target.value = '';
                                  }}
                                />
                              </label>
                              <p
                                id={`asset-upload-help-${deliverable.id}`}
                                className={styles.stepAssetHelp}
                              >
                                {assetUploadHelp(assetCategory)}
                              </p>
                              <div
                                className={styles.assetCapacityList}
                                aria-label="Per-file upload capacity"
                              >
                                {assetCapacityItems(assetCategory).map(
                                  ([label, limit]) => (
                                    <span key={label}>
                                      <strong>{label}</strong>
                                      {formatCapacity(limit)} per file
                                    </span>
                                  )
                                )}
                              </div>
                            </>
                          ) : (
                            <p className={styles.assetStorageNotice}>
                              File uploads are not configured in this
                              environment.
                            </p>
                          )
                        ) : null}

                        {uploadFeedback ? (
                          <div
                            id={`asset-upload-feedback-${deliverable.id}`}
                            className={`${styles.stepAssetFeedback} ${
                              uploadFeedback.tone === 'error'
                                ? styles.stepAssetFeedbackError
                                : uploadFeedback.tone === 'warning'
                                  ? styles.stepAssetFeedbackWarning
                                : uploadFeedback.tone === 'success'
                                  ? styles.stepAssetFeedbackSuccess
                                  : styles.stepAssetFeedbackStatus
                            }`}
                            role={
                              uploadFeedback.tone === 'error'
                                || uploadFeedback.tone === 'warning'
                                ? 'alert'
                                : 'status'
                            }
                          >
                            <div className={styles.uploadFeedbackHeading}>
                              <span>
                                {uploadFeedback.phaseLabel ||
                                  'Upload status'}
                              </span>
                              {Number.isFinite(
                                uploadFeedback.progress
                              ) ? (
                                <strong>
                                  {uploadFeedback.progress}%
                                </strong>
                              ) : uploadFeedback.phase === 'complete' &&
                                uploadFeedback.elapsedSeconds ? (
                                <strong>
                                  {formatUploadDuration(
                                    uploadFeedback.elapsedSeconds
                                  )}
                                </strong>
                              ) : null}
                            </div>
                            {uploadFeedback.fileName ? (
                              <strong
                                className={styles.uploadFeedbackFileName}
                              >
                                {uploadFeedback.fileName}
                              </strong>
                            ) : null}
                            <p>{uploadFeedback.message}</p>
                            {Number.isFinite(uploadFeedback.progress) ? (
                              <progress
                                className={styles.assetUploadProgress}
                                max="100"
                                value={uploadFeedback.progress}
                                aria-label={`${uploadFeedback.progress}% uploaded`}
                              />
                            ) : null}
                            {Number(uploadFeedback.total) > 0 &&
                            !uploadFeedback.indeterminate ? (
                              <div className={styles.uploadTransferStats}>
                                <span>
                                  <small>File</small>
                                  <strong>
                                    {uploadFeedback.fileIndex || 1} of{' '}
                                    {uploadFeedback.fileCount || 1}
                                  </strong>
                                </span>
                                <span>
                                  <small>Transferred</small>
                                  <strong>
                                    {formatBytes(
                                      uploadFeedback.loaded || 0
                                    )}{' '}
                                    / {formatBytes(uploadFeedback.total)}
                                  </strong>
                                </span>
                                <span>
                                  <small>Speed</small>
                                  <strong>
                                    {uploadFeedback.bytesPerSecond > 0
                                      ? `${formatBytes(
                                          uploadFeedback.bytesPerSecond
                                        )}/s`
                                      : uploadFeedback.phase ===
                                          'verifying'
                                        ? 'Complete'
                                        : 'Calculating…'}
                                  </strong>
                                </span>
                                <span>
                                  <small>Time remaining</small>
                                  <strong>
                                    {uploadFeedback.phase === 'verifying'
                                      ? 'Final checks'
                                      : uploadFeedback.secondsRemaining !==
                                          null &&
                                        uploadFeedback.secondsRemaining !==
                                          undefined
                                        ? formatUploadTimeRemaining(
                                            uploadFeedback.secondsRemaining
                                          )
                                        : 'Calculating…'}
                                  </strong>
                                </span>
                              </div>
                            ) : null}
                            {uploadFeedback.fileSize &&
                            uploadFeedback.fileLimit ? (
                              <p className={styles.uploadCapacityNote}>
                                {formatBytes(uploadFeedback.fileSize)} file ·{' '}
                                {Math.max(
                                  1,
                                  Math.round(
                                    (uploadFeedback.fileSize /
                                      uploadFeedback.fileLimit) *
                                      100
                                  )
                                )}
                                % of the{' '}
                                {formatCapacity(
                                  uploadFeedback.fileLimit
                                )}{' '}
                                per-file limit
                              </p>
                            ) : null}
                          </div>
                        ) : null}

                        {stepAssets.length ? (
                          <div className={styles.stepAssetList}>
                            {stepAssets.map((asset) => {
                              const expired = isEpisodeAssetExpired(asset);
                              return (
                                <article key={asset.asset_id}>
                                  <div>
                                    <strong>
                                      {asset.label || asset.file_name}
                                    </strong>
                                    {assetHasMatchingCopy(asset) ? (
                                      <em
                                        className={styles.assetDuplicateBadge}
                                      >
                                        Matching copy exists
                                      </em>
                                    ) : null}
                                    <span>
                                      {asset.label &&
                                      asset.label !== asset.file_name
                                        ? `${asset.file_name} · `
                                        : ''}
                                      {getEpisodeAssetTypeLabel(asset)} ·{' '}
                                      {formatBytes(asset.size)} ·{' '}
                                      {ASSET_CATEGORY_LABELS[
                                        asset.category
                                      ] || 'Production files'}
                                    </span>
                                  </div>
                                  {expired ? (
                                    <div className={styles.assetActions}>
                                      <span
                                        className={styles.assetExpiredBadge}
                                      >
                                        Expired
                                      </span>
                                      {viewerCanDeleteAsset(asset) ? (
                                        <button
                                          type="button"
                                          className={styles.assetDeleteButton}
                                          disabled={
                                            deletingAssetId === asset.asset_id
                                          }
                                          onClick={() =>
                                            deleteEpisodeAsset(asset)
                                          }
                                        >
                                          <DeleteOutlineRoundedIcon aria-hidden="true" />
                                          {deletingAssetId === asset.asset_id
                                            ? 'Deleting…'
                                            : 'Delete'}
                                        </button>
                                      ) : null}
                                    </div>
                                  ) : (
                                    <div className={styles.assetActions}>
                                      <a
                                        href={`/api/studio/episodes/${encodeURIComponent(
                                          episode.episode_id
                                        )}/assets/${encodeURIComponent(
                                          asset.asset_id
                                        )}`}
                                      >
                                        Download
                                      </a>
                                      {viewerCanDeleteAsset(asset) ? (
                                        <button
                                          type="button"
                                          className={styles.assetDeleteButton}
                                          disabled={
                                            deletingAssetId === asset.asset_id
                                          }
                                          onClick={() =>
                                            deleteEpisodeAsset(asset)
                                          }
                                        >
                                          <DeleteOutlineRoundedIcon aria-hidden="true" />
                                          {deletingAssetId === asset.asset_id
                                            ? 'Deleting…'
                                            : 'Delete'}
                                        </button>
                                      ) : null}
                                    </div>
                                  )}
                                </article>
                              );
                            })}
                          </div>
                        ) : null}

                        {deliverable.legacy_source_url ? (
                          <a
                            className={styles.legacySourceLink}
                            href={deliverable.legacy_source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <OpenInNewRoundedIcon aria-hidden="true" />
                            Previous external source retained from the earlier
                            workflow
                          </a>
                        ) : null}
                      </div>
                      )}

                      {deliverable.id === 'photos' ? (
                        <EpisodePhotoSelectionReview
                          key={`photo-review-${episode.updated_at}-${
                            deliverable.photo_selection?.updated_at || 'draft'
                          }`}
                          episodeId={episode.episode_id}
                          assets={stepAssets}
                          selection={deliverable.photo_selection || {}}
                          canEdit={canEditPhotoSelection}
                          disabledReason={photoSelectionDisabledReason}
                          saving={saving}
                          onSave={saveEpisodePhotoSelection}
                        />
                      ) : null}

                      {missingRequired && canHost && !lockedForHost ? (
                        <div className={styles.gapPanel}>
                          <label className={styles.gapCheck}>
                            <input
                              type="checkbox"
                              checked={deliverable.missing_acknowledged}
                              onChange={(event) =>
                                updateDeliverable(deliverable.id, {
                                  missing_acknowledged: event.target.checked,
                                })
                              }
                            />
                            I know this is missing and will resolve it after
                            the producer begins work.
                          </label>
                          {deliverable.missing_acknowledged ? (
                            <div className={styles.gapFields}>
                              <label>
                                Resolution plan
                                <small>
                                  Explain what is missing and how it will be
                                  delivered.
                                </small>
                                <input
                                  value={deliverable.missing_note}
                                  onChange={(event) =>
                                    updateDeliverable(deliverable.id, {
                                      missing_note: event.target.value,
                                    })
                                  }
                                />
                              </label>
                              <label>
                                Expected by
                                <FriendlyDateField
                                  value={deliverable.expected_by}
                                  onChange={(event) =>
                                    updateDeliverable(deliverable.id, {
                                      expected_by: event.target.value,
                                    })
                                  }
                                  ariaLabel={`${deliverable.label} expected date`}
                                />
                              </label>
                            </div>
                          ) : null}
                        </div>
                      ) : null}
                      {canConfigure &&
                      missingRequired &&
                      deliverable.missing_acknowledged ? (
                        <div className={styles.gapPanel}>
                          <strong>Known gap acknowledged by the host</strong>
                          <p className={styles.plainTextContent}>
                            {deliverable.missing_note}
                            {deliverable.expected_by
                              ? ` Expected by ${formatDate(
                                  deliverable.expected_by
                                )}.`
                              : ''}
                          </p>
                        </div>
                      ) : null}
                      </section>
                    </div>
                  </article>
                );
              })}
            </div>
              </>
            ) : (
              <EpisodeChecklistBuilderList>
                {hostDeliverables.map((deliverable, index) => (
                  <EpisodeChecklistBuilderRow
                    key={deliverable.id}
                    id={`checklist-builder-${deliverable.id}`}
                    index={index}
                    title={deliverable.label}
                    required={deliverable.required}
                    responseTypeLabel={
                      CHECKLIST_RESPONSE_TYPE_LABELS[deliverable.type] ||
                      'Written response'
                    }
                    onMoveUp={() => moveChecklistItem(deliverable.id, -1)}
                    onMoveDown={() => moveChecklistItem(deliverable.id, 1)}
                    onRemove={() => removeChecklistItem(deliverable)}
                    moveUpDisabled={index === 0}
                    moveDownDisabled={index === hostDeliverables.length - 1}
                    removeDisabled={
                      hostDeliverables.length <= 1 ||
                      REQUIRED_EPISODE_DELIVERABLE_IDS.includes(
                        deliverable.id
                      )
                    }
                  >
                    <label>
                      Step title shown to the host
                      <input
                        id={`checklist-label-${deliverable.id}`}
                        value={deliverable.label}
                        maxLength={180}
                        onChange={(event) =>
                          updateDeliverable(deliverable.id, {
                            label: event.target.value,
                          })
                        }
                      />
                    </label>
                    <label>
                      Instructions shown above the response
                      <PlainTextArea
                        value={deliverable.description}
                        maxLength={800}
                        onValueChange={(description) =>
                          updateDeliverable(deliverable.id, { description })
                        }
                      />
                    </label>
                    <label>
                      Response the host provides
                      <select
                        value={deliverable.type}
                        disabled={REQUIRED_EPISODE_DELIVERABLE_IDS.includes(
                          deliverable.id
                        )}
                        onChange={(event) =>
                          updateDeliverable(deliverable.id, {
                            type: event.target.value,
                          })
                        }
                      >
                        <option value="textarea">Written response</option>
                        <option value="asset">File upload</option>
                        <option value="url">
                          Optional working-source link
                        </option>
                      </select>
                    </label>
                    <label>
                      File group
                      <select
                        value={deliverable.asset_category || 'document'}
                        disabled={
                          deliverable.id === 'episode-folder' ||
                          REQUIRED_EPISODE_DELIVERABLE_IDS.includes(
                            deliverable.id
                          )
                        }
                        onChange={(event) =>
                          updateDeliverable(deliverable.id, {
                            asset_category: event.target.value,
                          })
                        }
                      >
                        {Object.entries(ASSET_CATEGORY_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label className={styles.checklistBuilderRequirement}>
                      <input
                        type="checkbox"
                        checked={deliverable.required}
                        disabled={deliverable.id === 'mic-kit-plan'}
                        onChange={(event) =>
                          updateDeliverable(deliverable.id, {
                            required: event.target.checked,
                          })
                        }
                      />
                      Require this response before a complete handoff
                    </label>
                  </EpisodeChecklistBuilderRow>
                ))}
              </EpisodeChecklistBuilderList>
            )}
            </section>

            {checklistMode === 'view' ? (
            <section id="final-assets" className={styles.assetPackagePanel}>
              <div className={styles.panelHeading}>
                <div>
                  <span className={styles.eyebrow}>Producer package</span>
                  <h2>Every episode file, sorted by workflow step</h2>
                  <p>
                    This is the finished handoff. Each file below comes from
                    its matching checklist step, so the producer can download
                    the complete package without tracing external folders.
                  </p>
                </div>
                <span>
                  {(episode.assets || []).length}{' '}
                  {(episode.assets || []).length === 1 ? 'file' : 'files'}
                </span>
              </div>

              {assetUploadsConfigured || (episode.assets || []).length ? (
                <div className={styles.assetRetentionNotice}>
                  <WarningAmberRoundedIcon aria-hidden="true" />
                  <div>
                    <strong>
                      Temporary production storage ·{' '}
                      {EPISODE_ASSET_RETENTION_DAYS} days
                    </strong>
                    <p>
                      Each file is scheduled to leave active storage{' '}
                      {EPISODE_ASSET_RETENTION_DAYS} days after upload. Keep
                      permanent masters in your archive. The Studio records
                      each deadline for reminder generation.
                    </p>
                  </div>
                </div>
              ) : null}

              {(episode.assets || []).length ? (
                <div className={styles.producerPackageGroups}>
                  {[
                    ...episode.deliverables.map((deliverable, index) => ({
                      id: deliverable.id,
                      label: `Step ${String(index + 1).padStart(2, '0')} · ${
                        deliverable.label
                      }`,
                      assets: episode.assets.filter(
                        (asset) =>
                          asset.deliverable_id === deliverable.id
                      ),
                    })),
                    {
                      id: 'unassigned',
                      label: 'Unassigned legacy files',
                      assets: episode.assets.filter(
                        (asset) =>
                          !episode.deliverables.some(
                            (deliverable) =>
                              deliverable.id === asset.deliverable_id
                          )
                      ),
                    },
                  ].map((group) =>
                    group.assets.length ? (
                      <section key={group.id}>
                        <header>
                          <h3>{group.label}</h3>
                          <span>
                            {group.assets.length}{' '}
                            {group.assets.length === 1 ? 'file' : 'files'}
                          </span>
                        </header>
                        <div>
                          {group.assets.map((asset) => {
                            const expired = isEpisodeAssetExpired(asset);
                            return (
                              <article key={asset.asset_id}>
                                <div>
                                  <strong>
                                    {asset.label || asset.file_name}
                                  </strong>
                                  {assetHasMatchingCopy(asset) ? (
                                    <em
                                      className={styles.assetDuplicateBadge}
                                    >
                                      Matching copy exists
                                    </em>
                                  ) : null}
                                  <span>
                                    {asset.file_name} ·{' '}
                                    {getEpisodeAssetTypeLabel(asset)} ·{' '}
                                    {formatBytes(asset.size)} ·{' '}
                                    {ASSET_CATEGORY_LABELS[
                                      asset.category
                                    ] || 'Production files'}
                                  </span>
                                  <small>
                                    Uploaded by{' '}
                                    {asset.uploaded_by_name ||
                                      'assigned uploader'}
                                    {asset.uploaded_at
                                      ? ` · ${formatDateTime(
                                          asset.uploaded_at
                                        )}`
                                      : ''}
                                  </small>
                                  <small
                                    className={
                                      expired
                                        ? styles.assetExpiredDate
                                        : styles.assetRetentionDate
                                    }
                                  >
                                    {expired
                                      ? `Storage window ended ${formatRetentionDate(
                                          asset.retention_expires_at
                                        )}`
                                      : `Scheduled deletion ${formatRetentionDate(
                                          asset.retention_expires_at
                                        )}`}
                                  </small>
                                </div>
                                {expired ? (
                                  <div className={styles.assetActions}>
                                    <span
                                      className={styles.assetExpiredBadge}
                                    >
                                      Expired from storage
                                    </span>
                                    {viewerCanDeleteAsset(asset) ? (
                                      <button
                                        type="button"
                                        className={styles.assetDeleteButton}
                                        disabled={
                                          deletingAssetId === asset.asset_id
                                        }
                                        onClick={() =>
                                          deleteEpisodeAsset(asset)
                                        }
                                      >
                                        <DeleteOutlineRoundedIcon aria-hidden="true" />
                                        {deletingAssetId === asset.asset_id
                                          ? 'Deleting…'
                                          : 'Delete'}
                                      </button>
                                    ) : null}
                                  </div>
                                ) : (
                                  <div className={styles.assetActions}>
                                    <a
                                      href={`/api/studio/episodes/${encodeURIComponent(
                                        episode.episode_id
                                      )}/assets/${encodeURIComponent(
                                        asset.asset_id
                                      )}`}
                                    >
                                      Download
                                    </a>
                                    {viewerCanDeleteAsset(asset) ? (
                                      <button
                                        type="button"
                                        className={styles.assetDeleteButton}
                                        disabled={
                                          deletingAssetId === asset.asset_id
                                        }
                                        onClick={() =>
                                          deleteEpisodeAsset(asset)
                                        }
                                      >
                                        <DeleteOutlineRoundedIcon aria-hidden="true" />
                                        {deletingAssetId === asset.asset_id
                                          ? 'Deleting…'
                                          : 'Delete'}
                                      </button>
                                    ) : null}
                                  </div>
                                )}
                              </article>
                            );
                          })}
                        </div>
                      </section>
                    ) : null
                  )}
                </div>
              ) : (
                <div className={styles.emptyProducerPackage}>
                  <CloudUploadRoundedIcon aria-hidden="true" />
                  <strong>No producer files yet</strong>
                  <p>
                    Upload files inside their matching steps above. They will
                    be organized here automatically.
                  </p>
                </div>
              )}
            </section>
            ) : null}

            {error ? <p className={styles.errorCard}>{error}</p> : null}
            {message ? <p className={styles.successCard}>{message}</p> : null}

            {canReview || canAdminOverride ? (
              <section className={styles.reviewPanel} id="producer-review">
                <div>
                  <span className={styles.eyebrow}>Producer review</span>
                  <h2>Move the episode forward</h2>
                  <p>
                    These controls change the episode status. Producer notes are
                    edited near the top of this Studio.
                  </p>
                  <a href="#producer-notes">Review producer notes</a>
                  {!canReview && canAdminOverride ? (
                    <p>
                      You are not the assigned producer. Any review action
                      below is an attributed administrator override.
                    </p>
                  ) : null}
                  <label>
                    <span>Staged Spotify listen</span>
                    <input
                      type="url"
                      value={episode.staged_episode_url || ''}
                      onChange={(event) =>
                        updateEpisode({
                          staged_episode_url: event.target.value,
                        })
                      }
                      placeholder="https://creators.spotify.com/…"
                      aria-describedby="staged-spotify-help"
                    />
                  </label>
                  <small id="staged-spotify-help">
                    Optional. This stays inside the secured Episode Studio and
                    lets the next production lead listen before advancing.
                  </small>
                  {episode.staged_episode_url ? (
                    <a
                      href={episode.staged_episode_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Listen to the staged episode on Spotify
                      <OpenInNewRoundedIcon aria-hidden="true" />
                    </a>
                  ) : null}
                </div>
                <div className={styles.reviewActions}>
                  <div className={styles.actionControl}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={Boolean(actionBlockers.requestChanges)}
                      title={actionBlockers.requestChanges || undefined}
                      aria-describedby={
                        actionBlockers.requestChanges
                          ? 'request-changes-blocker'
                          : undefined
                      }
                      onClick={() => reviewEpisode('needs_changes')}
                    >
                      Request changes
                    </button>
                    {actionBlockers.requestChanges ? (
                      <small
                        className={styles.actionBlocker}
                        id="request-changes-blocker"
                      >
                        Why unavailable: {actionBlockers.requestChanges}
                      </small>
                    ) : null}
                  </div>
                  <div className={styles.actionControl}>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={Boolean(actionBlockers.accept)}
                      title={actionBlockers.accept || undefined}
                      aria-describedby={
                        actionBlockers.accept
                          ? 'accept-package-blocker'
                          : undefined
                      }
                      onClick={() => reviewEpisode('accepted')}
                    >
                      <CheckCircleRoundedIcon aria-hidden="true" />
                      Accept package
                    </button>
                    {actionBlockers.accept ? (
                      <small
                        className={styles.actionBlocker}
                        id="accept-package-blocker"
                      >
                        Why unavailable: {actionBlockers.accept}
                      </small>
                    ) : null}
                  </div>
                </div>
              </section>
            ) : null}

              </>
            ) : null}

            {productionView && canAdvanceProduction ? (
              <section className={styles.reviewPanel} id="production-handoff">
                <div>
                  <span className={styles.eyebrow}>
                    Production lead check
                  </span>
                  <h2>Listen, confirm, and pass it forward</h2>
                  <p>
                    The producer accepted this package. Check the staged
                    episode and advance the handoff when it is ready.
                  </p>
                  {episode.staged_episode_url ? (
                    <a
                      href={episode.staged_episode_url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Listen to the staged episode on Spotify
                      <OpenInNewRoundedIcon aria-hidden="true" />
                    </a>
                  ) : (
                    <p>
                      No staged Spotify link was attached; confirm the listen
                      path with the producer before advancing.
                    </p>
                  )}
                </div>
                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={Boolean(actionBlockers.advanceProduction)}
                    title={actionBlockers.advanceProduction || undefined}
                    onClick={advanceProduction}
                  >
                    <CheckCircleRoundedIcon aria-hidden="true" />
                    Advance production review
                  </button>
                </div>
              </section>
            ) : null}

            {!productionView && canManage ? (
              <EpisodeStudioDeletionControl
                episode={episode}
                saving={saving}
                uploading={Boolean(uploadingAsset)}
                deleting={deletingStudio}
                onDelete={deleteStudio}
              />
            ) : null}

            {!productionView ? (
              <section className={styles.actionDock}>
              <div className={styles.actionDockCopy}>
                <strong>
                  {hostPreviewActive
                    ? 'Host preview is read-only'
                    : dirty
                    ? 'You have unpublished episode material'
                    : canHost && lockedForHost
                      ? episode.status === 'accepted'
                        ? 'The producer accepted this package'
                        : 'This package is with the producer'
                      : 'Everything here is saved'}
                </strong>
                <span>
                  {completion.can_submit
                    ? 'All required material is ready.'
                    : `${completion.missing.length} required items are still missing.`}
                </span>
              </div>
              <div className={styles.actionDockActions}>
                {canManage || !lockedForHost ? (
                  <div className={styles.actionControl}>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      disabled={Boolean(actionBlockers.save)}
                      title={actionBlockers.save || undefined}
                      onClick={saveDraft}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      {canManage ? 'Save Studio' : 'Save draft'}
                    </button>
                  </div>
                ) : null}
                {canHost && !lockedForHost ? (
                  <>
                    <div className={styles.actionControl}>
                      <button
                        type="button"
                        className={styles.gapSubmitButton}
                        disabled={Boolean(actionBlockers.submitWithGaps)}
                        title={actionBlockers.submitWithGaps || undefined}
                        aria-describedby={
                          actionBlockers.submitWithGaps
                            ? 'submit-gaps-blocker'
                            : undefined
                        }
                        onClick={() => submitEpisode('with_gaps')}
                      >
                        <WarningAmberRoundedIcon aria-hidden="true" />
                        Send with known gaps
                      </button>
                      {actionBlockers.submitWithGaps ? (
                        <small
                          className={styles.actionBlocker}
                          id="submit-gaps-blocker"
                        >
                          Why unavailable: {actionBlockers.submitWithGaps}
                        </small>
                      ) : null}
                    </div>
                    <div className={styles.actionControl}>
                      <button
                        type="button"
                        className={styles.primaryButton}
                        disabled={Boolean(actionBlockers.submit)}
                        title={actionBlockers.submit || undefined}
                        aria-describedby={
                          actionBlockers.submit
                            ? 'submit-package-blocker'
                            : undefined
                        }
                        onClick={() => submitEpisode('complete')}
                      >
                        <SendRoundedIcon aria-hidden="true" />
                        Send to producer
                      </button>
                      {actionBlockers.submit ? (
                        <small
                          className={styles.actionBlocker}
                          id="submit-package-blocker"
                        >
                          Why unavailable: {actionBlockers.submit}
                        </small>
                      ) : null}
                    </div>
                  </>
                ) : null}
              </div>
              </section>
            ) : null}

          </>
        ) : null}
      </div>
    </Layout>
  );
}
