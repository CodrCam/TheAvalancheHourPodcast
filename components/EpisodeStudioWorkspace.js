import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/router';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import RadioButtonUncheckedRoundedIcon from '@mui/icons-material/RadioButtonUncheckedRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import SendRoundedIcon from '@mui/icons-material/SendRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ForumRoundedIcon from '@mui/icons-material/ForumRounded';
import CampaignRoundedIcon from '@mui/icons-material/CampaignRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import CloudUploadRoundedIcon from '@mui/icons-material/CloudUploadRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import VisibilityRoundedIcon from '@mui/icons-material/VisibilityRounded';
import AdminLayout from './AdminLayout';
import FriendlyDateField from './FriendlyDateField';
import PlainTextArea from './PlainTextArea';
import StudioLayout from './StudioLayout';
import {
  EpisodeRecordingFields,
  EpisodeRecordingSummary,
} from './EpisodeRecordingSchedule';
import EpisodeStudioDeletionControl from './EpisodeStudioDeletionControl';
import {
  EPISODE_ASSET_RETENTION_DAYS,
  getEpisodeCompletion,
  isEpisodeAssetExpired,
  isDeliverableComplete,
  mergeEpisodeStudioServerFields,
} from '../lib/episodeStudioPresentation.mjs';
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
  uploadAuthorizedFile,
} from '../lib/episodeAssetUploadClient.mjs';
import {
  buildEpisodeCalendarFile,
  episodeCalendarFilename,
} from '../lib/episodeCalendar.mjs';
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

const ASSET_CATEGORY_LABELS = {
  recording: 'Final voice and episode audio',
  image: 'Episode images and artwork',
  document: 'Notes and production documents',
  sponsor_audio: 'Separate sponsor and ad spots',
  other: 'Other final assets',
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

export default function EpisodeStudioWorkspace({
  admin = false,
  previewData = null,
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
  const [messageDraft, setMessageDraft] = useState('');

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
  }, [episodeId, previewData, router.isReady, router.query.view]);

  const completion = useMemo(
    () => getEpisodeCompletion(episode || {}),
    [episode]
  );
  const healthLocked = episode?.status === 'accepted';
  const offTrack =
    !healthLocked && episode?.delivery_health === 'off_track';
  const dirty = Boolean(episode && JSON.stringify(episode) !== baseline);
  const lockedForHost =
    hostPreviewReadOnly ||
    !canHost ||
    LOCKED_HOST_STATUSES.includes(episode?.status);
  const canUploadForCurrentStatus =
    !hostPreviewReadOnly &&
    canUploadAssets &&
    episode?.status !== 'accepted' &&
    (canReview || !LOCKED_HOST_STATUSES.includes(episode?.status));
  const Layout = previewData
    ? EpisodeStudioPreviewLayout
    : admin
      ? AdminLayout
      : StudioLayout;
  const listHref = admin
    ? '/admin/studios'
    : canManage
      ? '/studio/manage/episodes'
      : '/studio/episodes';

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

  async function sendUpdate(
    body,
    successMessage,
    { mergeFields = [] } = {}
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
      if (mergeFields.length) {
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
      await sendUpdate(
        { action: 'update', episode },
        'Episode Studio saved.'
      );
      return;
    }
    await sendUpdate(
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
    const nextStep =
      viewerPersonId === 'angie-link'
        ? 'send this episode to Caleb for the final listen'
        : 'complete the production review chain';
    if (!window.confirm(`Confirm you want to ${nextStep}?`)) return;
    await sendUpdate(
      { action: 'advance_production' },
      viewerPersonId === 'angie-link'
        ? 'Caleb has been notified for the final production listen.'
        : 'The production review chain is complete.'
    );
  }

  async function postMessage(event) {
    event.preventDefault();
    if (hostPreviewReadOnly) return;
    const body = messageDraft.trim();
    if (!body) return;
    const data = await sendUpdate(
      { action: 'message', message: body },
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
  }

  function moveChecklistItem(deliverableId, offset) {
    setEpisode((current) => {
      const items = [...current.deliverables];
      const index = items.findIndex((item) => item.id === deliverableId);
      const nextIndex = index + offset;
      if (index < 0 || nextIndex < 0 || nextIndex >= items.length) {
        return current;
      }
      [items[index], items[nextIndex]] = [items[nextIndex], items[index]];
      return { ...current, deliverables: items };
    });
  }

  function removeChecklistItem(deliverable) {
    const attachedFiles = (episode.assets || []).filter(
      (asset) => asset.deliverable_id === deliverable.id
    ).length;
    if (
      (deliverable.value || attachedFiles) &&
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
    await sendUpdate(
      {
        action: 'configure_checklist',
        deliverables: episode.deliverables,
        canonical_assets_required:
          episode.canonical_assets_required === true,
      },
      'Episode-specific checklist saved.'
    );
  }

  async function uploadEpisodeAssets(fileList, deliverable) {
    if (hostPreviewReadOnly) return;
    const files = Array.from(fileList || []);
    if (
      !files.length ||
      !episode ||
      !deliverable?.id ||
      uploadingAsset ||
      !canUploadForCurrentStatus
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
        activeUploadStage = 'storage';
        const uploadStartedAt = Date.now();
        let lastProgressRenderedAt = 0;
        let lastRateSampleAt = uploadStartedAt;
        let lastRateSampleBytes = 0;
        let smoothedBytesPerSecond = 0;
        const uploadResponse = await uploadAuthorizedFile(
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
        if (!isEpisodeAssetUploadReadyForCompletion(uploadResponse)) {
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
        mergeServerFields(currentEpisode, ['assets', 'updated_at']);
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
        throw new Error(
          data.error || 'Could not permanently delete this Episode Studio.'
        );
      }

      setBaseline(JSON.stringify(episode));
      await router.replace(listHref);
    } catch (deleteError) {
      setError(
        deleteError.message ||
          'Could not permanently delete this Episode Studio.'
      );
    } finally {
      setDeletingStudio(false);
    }
  }

  return (
    <Layout
      hasUnsavedChanges={dirty || Boolean(messageDraft.trim())}
      unsavedChangesMessage="You have unsaved episode material. Leave and discard it?"
    >
      <div className={styles.workspace}>
        <Link href={listHref} className={styles.backLink}>
          <ArrowBackRoundedIcon aria-hidden="true" />
          {admin || canManage ? 'Production calendar' : 'My episodes'}
        </Link>

        {loading ? (
          <section className={styles.loadingCard}>Opening Episode Studio…</section>
        ) : error && !episode ? (
          <section className={styles.errorCard}>{error}</section>
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
                    : offTrack
                    ? 'The expected host-package date is at risk. This signal is visible to the production team; add details to the discussion when you are ready.'
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
                  Boolean(actionBlockers.deliveryHealth)
                }
                title={
                  hostPreviewReadOnly
                    ? 'Exit host preview to change the delivery outlook.'
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
                <span>Release</span>
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

            {canReview || canAdminOverride ? (
              <section
                className={styles.producerNotesPanel}
                id="producer-notes"
                aria-labelledby="producer-notes-heading"
              >
                <div className={styles.panelHeading}>
                  <div>
                    <span className={styles.eyebrow}>Producer workspace</span>
                    <h2 id="producer-notes-heading">Notes for the hosts</h2>
                  </div>
                  <span>Saved with the Episode Studio</span>
                </div>
                <label htmlFor="producer-feedback">
                  <span>Producer notes and revision guidance</span>
                  <small>
                    Write the exact change the host needs to make. This is not
                    the place for timestamps, finished copy, or file notes.
                  </small>
                  <PlainTextArea
                    id="producer-feedback"
                    value={episode.producer_feedback || ''}
                    onValueChange={(producerFeedback) =>
                      updateEpisode({ producer_feedback: producerFeedback })
                    }
                    maxLength={4000}
                  />
                </label>
                <small>
                  {canManage
                    ? 'Save Studio keeps these notes as a draft. '
                    : ''}
                  Requesting changes sends them with the episode; the approval
                  controls stay at the bottom.
                </small>
              </section>
            ) : episode.producer_feedback ? (
              <section className={styles.feedbackBanner}>
                <strong>Producer notes for the hosts</strong>
                <p className={styles.plainTextContent}>
                  {episode.producer_feedback}
                </p>
              </section>
            ) : null}

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

            <section id="discussion" className={styles.discussionPanel}>
              <div className={styles.discussionHeading}>
                <div>
                  <span className={styles.eyebrow}>Episode discussion</span>
                  <h2>Keep decisions with the work</h2>
                </div>
                <span>
                  {(episode.messages || []).length}{' '}
                  {(episode.messages || []).length === 1
                    ? 'update'
                    : 'updates'}
                </span>
              </div>
              {(episode.messages || []).length ? (
                <div className={styles.messageList}>
                  {episode.messages.map((entry) => (
                    <article
                      key={entry.message_id}
                      className={
                        entry.author_role === 'producer'
                          ? styles.producerMessage
                          : ''
                      }
                    >
                      <div>
                        <strong>{entry.author_name}</strong>
                        <span>
                          {entry.author_role === 'producer'
                            ? 'Producer'
                            : entry.author_role === 'studio_manager'
                              ? 'Studio manager'
                              : entry.author_role === 'creator'
                                ? 'Episode creator'
                                : 'Host'}
                        </span>
                        <time dateTime={entry.created_at}>
                          {entry.created_at
                            ? new Date(entry.created_at).toLocaleString()
                            : ''}
                        </time>
                      </div>
                      <p className={styles.plainTextContent}>{entry.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.discussionEmpty}>
                  No updates yet. Use this space only for questions and team
                  decisions.
                </p>
              )}
              <form
                className={styles.messageComposer}
                onSubmit={postMessage}
              >
                <label htmlFor="episode-message">
                  Add a question or decision
                  <small>
                    Put finished copy, timestamps, and files in their matching
                    form step—not in the discussion.
                  </small>
                </label>
                <div>
                  <PlainTextArea
                    id="episode-message"
                    value={messageDraft}
                    disabled={hostPreviewReadOnly}
                    onValueChange={setMessageDraft}
                    maxLength={2400}
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={
                      hostPreviewReadOnly ||
                      saving ||
                      messageDraft.trim().length < 2
                    }
                    title={
                      hostPreviewReadOnly
                        ? 'Exit host preview to post an update.'
                        : saving
                        ? 'Wait for the current Studio update to finish.'
                        : messageDraft.trim().length < 2
                          ? 'Write a short update first.'
                          : undefined
                    }
                  >
                    <ForumRoundedIcon aria-hidden="true" />
                    Post update
                  </button>
                </div>
              </form>
            </section>

            {canManage ? (
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
                    Release date
                    <FriendlyDateField
                      value={episode.target_release_date}
                      onChange={(event) =>
                        updateEpisode({
                          target_release_date: event.target.value,
                        })
                      }
                      ariaLabel="release date"
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
                            producer?.account_email ||
                            episode.producer_email,
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
                      placeholder="caleb@example.com"
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
            ) : null}

            <section
              className={styles.hostProductionSection}
              aria-labelledby="host-production-heading"
            >
            <section className={styles.formIntro}>
              <div>
                <span className={styles.eyebrow}>Host production form</span>
                <h2 id="host-production-heading">Assemble the episode</h2>
                <p>
                  Link the actual material, then remove the guesswork. Use
                  exact filenames and tell the producer what each asset is,
                  where it belongs, and what the finished episode should do.
                </p>
              </div>
              <div className={styles.checklistSummary}>
                <strong>{completion.missing.length} required items remain</strong>
                {canConfigure &&
                !LOCKED_HOST_STATUSES.includes(episode.status) ? (
                  <div>
                    <button
                      type="button"
                      className={styles.secondaryButton}
                      onClick={addChecklistItem}
                    >
                      <AddRoundedIcon aria-hidden="true" />
                      Add checklist item
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={Boolean(actionBlockers.save)}
                      title={actionBlockers.save || undefined}
                      onClick={saveChecklistConfiguration}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      Save episode checklist
                    </button>
                  </div>
                ) : null}
              </div>
            </section>
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
              {episode.deliverables.map((deliverable, index) => {
                const stepAssets = (episode.assets || []).filter(
                  (asset) => asset.deliverable_id === deliverable.id
                );
                const complete = isDeliverableComplete(
                  deliverable,
                  episode.assets
                );
                const missingRequired = deliverable.required && !complete;
                const assetCategory =
                  deliverable.asset_category || 'document';
                const uploadFeedback =
                  assetUploadFeedback[deliverable.id] || null;
                const canEditChecklist =
                  canConfigure &&
                  !LOCKED_HOST_STATUSES.includes(episode.status);
                return (
                  <article
                    key={deliverable.id}
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
                      {canEditChecklist ? (
                        <section
                          className={styles.stepSetupZone}
                          aria-label={`${deliverable.label} producer setup`}
                        >
                          <div className={styles.stepZoneHeading}>
                            <div>
                              <span className={styles.stepSetupKicker}>
                                Producer setup
                              </span>
                              <strong>What the host sees</strong>
                              <small>
                                Edit the step title and the guidance shown above
                                the host’s response.
                              </small>
                            </div>
                            <span className={styles.stepRequirementPill}>
                              {deliverable.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <div className={styles.checklistItemEditor}>
                            <label>
                              <span>Step title shown to the host</span>
                              <input
                                value={deliverable.label}
                                aria-label={`Checklist item ${index + 1} label`}
                                maxLength={180}
                                onChange={(event) =>
                                  updateDeliverable(deliverable.id, {
                                    label: event.target.value,
                                  })
                                }
                              />
                            </label>
                            <label>
                              <span>Instructions shown above the response</span>
                              <PlainTextArea
                                value={deliverable.description}
                                aria-label={`${deliverable.label} instructions`}
                                maxLength={800}
                                onValueChange={(description) =>
                                  updateDeliverable(deliverable.id, {
                                    description,
                                  })
                                }
                              />
                            </label>
                          </div>
                          <div className={styles.checklistItemControls}>
                            <label>
                              Response the host provides
                              <select
                                value={deliverable.type}
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
                                disabled={deliverable.id === 'episode-folder'}
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
                            <button
                              type="button"
                              aria-label={`Move ${deliverable.label} up`}
                              disabled={index === 0}
                              onClick={() =>
                                moveChecklistItem(deliverable.id, -1)
                              }
                            >
                              <ArrowUpwardRoundedIcon aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Move ${deliverable.label} down`}
                              disabled={
                                index === episode.deliverables.length - 1
                              }
                              onClick={() =>
                                moveChecklistItem(deliverable.id, 1)
                              }
                            >
                              <ArrowDownwardRoundedIcon aria-hidden="true" />
                            </button>
                            <button
                              type="button"
                              aria-label={`Remove ${deliverable.label}`}
                              disabled={episode.deliverables.length <= 1}
                              onClick={() => removeChecklistItem(deliverable)}
                            >
                              <DeleteOutlineRoundedIcon aria-hidden="true" />
                            </button>
                          </div>
                          <label className={styles.requirementToggle}>
                            <input
                              type="checkbox"
                              checked={deliverable.required}
                              onChange={(event) =>
                                updateDeliverable(deliverable.id, {
                                  required: event.target.checked,
                                })
                              }
                            />
                            Require this response before a complete handoff
                          </label>
                        </section>
                      ) : canConfigure ? (
                        <section
                          className={`${styles.stepSetupZone} ${styles.stepSetupZoneReadOnly}`}
                          aria-label={`${deliverable.label} host-facing setup`}
                        >
                          <div className={styles.stepZoneHeading}>
                            <div>
                              <span className={styles.stepSetupKicker}>
                                Host-facing step
                              </span>
                              <strong>What the host was shown</strong>
                              <small>
                                This title and guidance are locked while the
                                package is in producer review.
                              </small>
                            </div>
                            <span className={styles.stepRequirementPill}>
                              {deliverable.required ? 'Required' : 'Optional'}
                            </span>
                          </div>
                          <div className={styles.stepPreviewCopy}>
                            <h3>{deliverable.label}</h3>
                            <span className={styles.producerGuidanceLabel}>
                              Producer guidance
                            </span>
                            <p className={styles.plainTextContent}>
                              {deliverable.description}
                            </p>
                          </div>
                        </section>
                      ) : (
                        <div className={styles.deliverableHeading}>
                          <div>
                            <h3>{deliverable.label}</h3>
                            <span className={styles.producerGuidanceLabel}>
                              Producer guidance
                            </span>
                            <p className={styles.plainTextContent}>
                              {deliverable.description}
                            </p>
                          </div>
                          <span>
                            {deliverable.required ? 'Required' : 'Optional'}
                          </span>
                        </div>
                      )}

                      <section
                        className={styles.hostResponseZone}
                        aria-label={`${deliverable.label} host response`}
                      >
                        <div className={styles.stepZoneHeading}>
                          <div>
                            <span className={styles.hostResponseKicker}>
                              Host response
                            </span>
                            <strong>
                              {deliverable.type === 'asset'
                                ? 'Files the host submits'
                                : deliverable.type === 'url'
                                  ? 'Link the host submits'
                                  : 'What the host writes'}
                            </strong>
                            <small>
                              {deliverable.type === 'asset'
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
                            {complete ? 'Response complete' : 'No response yet'}
                          </span>
                        </div>

                      {deliverable.type === 'asset' ? null : deliverable.type ===
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

                      {deliverable.type === 'textarea' ? (
                        <p className={styles.plainTextHint}>
                          Plain text only. Line breaks and pasted lists stay as
                          entered—no Markdown needed.
                        </p>
                      ) : null}

                      {deliverable.id === 'guest-details' ? (
                        <label className={styles.guestSocialField}>
                          <span>Guest social profiles and handles</span>
                          <small>
                            Add public handles or links, one per line. If there
                            are none, write “None.”
                          </small>
                          <PlainTextArea
                            value={deliverable.social_profiles || ''}
                            disabled={lockedForHost}
                            title={lockedForHost ? hostEditBlocker : undefined}
                            onValueChange={(socialProfiles) =>
                              updateDeliverable(deliverable.id, {
                                social_profiles: socialProfiles,
                              })
                            }
                            aria-label="Guest social profiles and handles"
                            maxLength={3000}
                          />
                          <small>
                            Public profiles only—never include passwords or
                            private login credentials.
                          </small>
                        </label>
                      ) : null}

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
            </section>

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

            {canAdvanceProduction ? (
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
                    {viewerPersonId === 'angie-link'
                      ? 'Send to Caleb'
                      : 'Complete production review'}
                  </button>
                </div>
              </section>
            ) : null}

            {canManage ? (
              <EpisodeStudioDeletionControl
                episode={episode}
                saving={saving}
                uploading={Boolean(uploadingAsset)}
                deleting={deletingStudio}
                onDelete={deleteStudio}
              />
            ) : null}

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

          </>
        ) : null}
      </div>
    </Layout>
  );
}
