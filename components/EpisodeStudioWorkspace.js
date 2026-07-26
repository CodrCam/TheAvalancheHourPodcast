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
import AdminLayout from './AdminLayout';
import FriendlyDateField from './FriendlyDateField';
import StudioLayout from './StudioLayout';
import {
  areProducerDirectionsComplete,
  EPISODE_ASSET_RETENTION_DAYS,
  getEpisodeCompletion,
  isEpisodeAssetExpired,
  isDeliverableComplete,
  mergeEpisodeStudioServerFields,
  PRODUCER_DIRECTIONS_MIN_LENGTH,
} from '../lib/episodeStudioPresentation.mjs';
import {
  getEpisodeAssetAccept,
  getEpisodeAssetTypeLabel,
  validateEpisodeAssetInput,
} from '../lib/episodeAssetPolicy.mjs';
import { completeEpisodeAssetUpload } from '../lib/episodeAssetUploadClient.mjs';
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

const PRODUCER_DIRECTIONS_PLACEHOLDER = `FINAL CUT
Describe the intended pace, tone, story arc, and any moments that must stay.

AUDIO / EDITS
mission-ridge_interview_jordan_raw.wav | 00:18:42–00:19:07 | CUT | Duplicate answer; join to “Our morning starts…”

IMAGES
mission-ridge_photo-01_jordan-ridgeline.jpg | COVER | Crop 16:9; keep Jordan and the full ridgeline visible | Photo: Alex Rivera | Permission confirmed

FACT CHECK / PRONUNCIATION / DO NOT USE
List anything the producer must verify, pronounce carefully, or leave out.`;

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

function materialPlaceholder(deliverable) {
  if (deliverable.id === 'guest-details') {
    return 'Guest name, title or affiliation, contact information, and short biography';
  }
  if (deliverable.type === 'url') {
    return 'Paste an optional secure working-source link';
  }
  return 'Fill this in for the producer…';
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

function assetUploadHelp(category) {
  if (['recording', 'sponsor_audio'].includes(category)) {
    return 'WAV, MP3, M4A, AAC, AIFF, FLAC, Ogg, Opus, or CAF audio · up to 750 MB per file';
  }
  if (category === 'image') {
    return 'JPG, PNG, GIF, WebP, AVIF, TIFF, HEIC, HEIF, or BMP · up to 30 MB per file';
  }
  if (category === 'document') {
    return 'PDF, DOCX, text, spreadsheet, presentation, transcript, JSON, or EDL · up to 75 MB per file';
  }
  return 'Safe audio and video, common raster images, documents, spreadsheets, presentations, transcripts, and edit lists · images up to 30 MB, documents up to 75 MB, audio/video up to 750 MB';
}

function readableUploadError(error) {
  return String(error?.message || error || 'Could not upload this file.')
    .replace(/^Episode asset:\s*/i, '')
    .trim();
}

function canonicalUploadFile(file, upload) {
  const contentType = String(upload?.content_type || '').trim();
  if (!contentType || file.type === contentType) return file;
  return new File([file], upload.file_name || file.name, {
    type: contentType,
    lastModified: file.lastModified,
  });
}

async function uploadAuthorizedFile(file, upload = {}) {
  const method = String(
    upload.upload_method || (upload.upload_fields ? 'POST' : 'PUT')
  ).toUpperCase();
  const bodyFile = canonicalUploadFile(file, upload);

  if (method === 'POST') {
    const body = new FormData();
    Object.entries(upload.upload_fields || {}).forEach(([name, value]) => {
      body.append(name, String(value));
    });
    body.append('file', bodyFile);
    return fetch(upload.upload_url, { method: 'POST', body });
  }

  if (method !== 'PUT') {
    throw new Error('The upload service returned an unsupported upload method.');
  }

  return fetch(upload.upload_url, {
    method: 'PUT',
    headers: {
      'Content-Type':
        String(upload.content_type || '').trim() ||
        bodyFile.type ||
        'application/octet-stream',
    },
    body: bodyFile,
  });
}

export default function EpisodeStudioWorkspace({ admin = false }) {
  const router = useRouter();
  const episodeId = String(router.query.episodeId || '');
  const [episode, setEpisode] = useState(null);
  const [hostNames, setHostNames] = useState([]);
  const [people, setPeople] = useState([]);
  const [producers, setProducers] = useState([]);
  const [canManage, setCanManage] = useState(false);
  const [canHost, setCanHost] = useState(false);
  const [canReview, setCanReview] = useState(false);
  const [canConfigure, setCanConfigure] = useState(false);
  const [canAdminOverride, setCanAdminOverride] = useState(false);
  const [availableSponsorReads, setAvailableSponsorReads] = useState([]);
  const [selectedSponsorReadId, setSelectedSponsorReadId] = useState('');
  const [sponsorRequiresAudio, setSponsorRequiresAudio] = useState(true);
  const [sponsorRecordingMode, setSponsorRecordingMode] = useState(
    'separate_upload'
  );
  const [assetUploadsConfigured, setAssetUploadsConfigured] = useState(false);
  const [canUploadAssets, setCanUploadAssets] = useState(false);
  const [uploadingAsset, setUploadingAsset] = useState('');
  const [uploadingDeliverableId, setUploadingDeliverableId] = useState('');
  const [assetUploadFeedback, setAssetUploadFeedback] = useState({});
  const [baseline, setBaseline] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [messageDraft, setMessageDraft] = useState('');

  useEffect(() => {
    if (!router.isReady || !episodeId) return;
    let alive = true;

    async function loadEpisode() {
      setLoading(true);
      setError('');
      try {
        const response = await fetch(
          `/api/studio/episodes/${encodeURIComponent(episodeId)}`,
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
        setAvailableSponsorReads(data.available_sponsor_reads || []);
        setAssetUploadsConfigured(data.asset_uploads_configured === true);
        setCanUploadAssets(data.canUploadAssets === true);
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
  }, [episodeId, router.isReady]);

  const completion = useMemo(
    () => getEpisodeCompletion(episode || {}),
    [episode]
  );
  const producerDirectionsComplete = areProducerDirectionsComplete(
    episode?.producer_directions
  );
  const producerDirectionsLength = String(
    episode?.producer_directions || ''
  ).trim().length;
  const healthLocked = episode?.status === 'accepted';
  const offTrack =
    !healthLocked && episode?.delivery_health === 'off_track';
  const dirty = Boolean(episode && JSON.stringify(episode) !== baseline);
  const lockedForHost =
    !canHost || LOCKED_HOST_STATUSES.includes(episode?.status);
  const canUploadForCurrentStatus =
    canUploadAssets &&
    episode?.status !== 'accepted' &&
    (canReview || !LOCKED_HOST_STATUSES.includes(episode?.status));
  const Layout = admin ? AdminLayout : StudioLayout;
  const listHref = admin
    ? '/admin/studios'
    : canManage
      ? '/studio/manage/episodes'
      : '/studio/episodes';

  function replaceEpisode(nextEpisode) {
    setEpisode(nextEpisode);
    setBaseline(JSON.stringify(nextEpisode));
  }

  function updateEpisode(patch) {
    setEpisode((current) => ({ ...current, ...patch }));
    setMessage('');
    setError('');
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
    if (!episode || saving) return null;
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
    if (!episode || saving || healthLocked) return;
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
        producer_directions: episode.producer_directions,
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
        producer_directions: episode.producer_directions,
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
        override_reason: overrideReason,
      },
      status === 'accepted'
        ? 'Episode package accepted.'
        : 'The episode is open for host revisions.',
      { mergeFields: REVIEW_RESPONSE_FIELDS }
    );
  }

  async function postMessage(event) {
    event.preventDefault();
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
    const preparedFiles = [];
    const validationErrors = [];
    files.forEach((file) => {
      try {
        preparedFiles.push({
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
          message: `No files were uploaded. ${visibleErrors}${remainingErrors}`,
        },
      }));
      return;
    }

    setError('');
    setMessage('');
    setUploadingDeliverableId(deliverable.id);
    setAssetUploadFeedback((current) => ({
      ...current,
      [deliverable.id]: {
        tone: 'status',
        message: `Preparing ${preparedFiles.length} ${
          preparedFiles.length === 1 ? 'file' : 'files'
        } for upload…`,
      },
    }));
    let currentEpisode = episode;
    let completedCount = 0;
    let activeFileName = '';
    try {
      for (const [index, preparedFile] of preparedFiles.entries()) {
        const { file, input } = preparedFile;
        activeFileName = file.name;
        setUploadingAsset(file.name);
        setAssetUploadFeedback((current) => ({
          ...current,
          [deliverable.id]: {
            tone: 'status',
            message: `Uploading ${index + 1} of ${preparedFiles.length}: ${
              file.name
            }`,
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
        const authorization = await authorizeResponse.json();
        if (!authorizeResponse.ok) {
          throw new Error(
            authorization.error || `Could not authorize ${file.name}.`
          );
        }
        const uploadResponse = await uploadAuthorizedFile(
          file,
          authorization.upload
        );
        if (!uploadResponse.ok) {
          throw new Error(
            `The upload for ${file.name} did not finish. Check the object-storage CORS policy and try again.`
          );
        }
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
          message: `${completedCount} ${
            completedCount === 1 ? 'file' : 'files'
          } uploaded to “${deliverable.label}” and added to the producer package.`,
        },
      }));
    } catch (uploadError) {
      const reason = readableUploadError(uploadError);
      setAssetUploadFeedback((current) => ({
        ...current,
        [deliverable.id]: {
          tone: 'error',
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
              <span
                className={`${styles.statusPill} ${
                  styles[`status_${episode.status}`] || ''
                }`}
              >
                {STATUS_LABELS[episode.status] || episode.status}
              </span>
            </header>

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
                disabled={saving || healthLocked}
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

            {episode.producer_feedback ? (
              <section className={styles.feedbackBanner}>
                <strong>Producer note</strong>
                <p>{episode.producer_feedback}</p>
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
                        <p>{assignment.approved_text}</p>
                      </div>
                      {assignment.pronunciation_guidance ? (
                        <div className={styles.sponsorGuidance}>
                          <strong>Pronunciation</strong>
                          <p>{assignment.pronunciation_guidance}</p>
                        </div>
                      ) : null}
                      {assignment.host_instructions ? (
                        <div className={styles.sponsorGuidance}>
                          <strong>Host instructions</strong>
                          <p>{assignment.host_instructions}</p>
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
                              placeholder="Optional legacy HTTPS audio link"
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
                      <p>{entry.body}</p>
                    </article>
                  ))}
                </div>
              ) : (
                <p className={styles.discussionEmpty}>
                  No updates yet. Use this space for questions, decisions, and
                  anything the next person needs to know.
                </p>
              )}
              <form
                className={styles.messageComposer}
                onSubmit={postMessage}
              >
                <label htmlFor="episode-message">Add an update</label>
                <div>
                  <textarea
                    id="episode-message"
                    value={messageDraft}
                    onChange={(event) =>
                      setMessageDraft(event.target.value)
                    }
                    placeholder="Ask a question, record a decision, or leave context for the team…"
                    maxLength={2400}
                  />
                  <button
                    type="submit"
                    className={styles.secondaryButton}
                    disabled={saving || messageDraft.trim().length < 2}
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

            <section className={styles.formIntro}>
              <div>
                <span className={styles.eyebrow}>Host production form</span>
                <h2>Assemble the episode</h2>
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
                      disabled={saving || !dirty}
                      onClick={saveChecklistConfiguration}
                    >
                      <SaveRoundedIcon aria-hidden="true" />
                      Save episode checklist
                    </button>
                  </div>
                ) : null}
              </div>
            </section>

            <section
              className={`${styles.handoffPanel} ${
                producerDirectionsComplete ? styles.handoffPanelComplete : ''
              }`}
            >
              <div className={styles.handoffHeading}>
                <div>
                  <span className={styles.eyebrow}>Required producer brief</span>
                  <h2>Make the final cut unambiguous</h2>
                  <p>
                    A link says where the files live. This brief tells the
                    producer exactly which files to use and what the finished
                    episode should become.
                  </p>
                </div>
                <span className={styles.handoffStatus}>
                  {producerDirectionsComplete ? (
                    <CheckCircleRoundedIcon aria-hidden="true" />
                  ) : (
                    <RadioButtonUncheckedRoundedIcon aria-hidden="true" />
                  )}
                  {producerDirectionsComplete
                    ? 'Brief ready'
                    : 'Brief required'}
                </span>
              </div>

              <div className={styles.handoffStandards}>
                <div>
                  <strong>Find it</strong>
                  <span>Exact filename, version, and source folder</span>
                </div>
                <div>
                  <strong>Edit it</strong>
                  <span>Timestamp range, action, and intended result</span>
                </div>
                <div>
                  <strong>Place it</strong>
                  <span>Image order, use, crop, caption, and credit</span>
                </div>
                <div>
                  <strong>Protect it</strong>
                  <span>Permission, restrictions, facts, and pronunciation</span>
                </div>
              </div>

              <label className={styles.handoffField}>
                <span>
                  Producer handoff brief and asset map
                  <small>Required for every submission</small>
                </span>
                <textarea
                  value={episode.producer_directions || ''}
                  disabled={lockedForHost}
                  onChange={(event) =>
                    updateEpisode({
                      producer_directions: event.target.value,
                    })
                  }
                  placeholder={PRODUCER_DIRECTIONS_PLACEHOLDER}
                  aria-label="Producer handoff brief and asset map"
                  maxLength={6000}
                />
              </label>
              <div className={styles.handoffFooter}>
                <span>
                  Never write “the good photo” or “latest cut.” Name the exact
                  asset.
                </span>
                <span
                  className={
                    producerDirectionsComplete
                      ? styles.handoffCountComplete
                      : ''
                  }
                >
                  {producerDirectionsLength < PRODUCER_DIRECTIONS_MIN_LENGTH
                    ? `${
                        PRODUCER_DIRECTIONS_MIN_LENGTH -
                        producerDirectionsLength
                      } more characters for a usable brief`
                    : 'Enough detail to submit'}
                </span>
              </div>
            </section>

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
                      <div className={styles.deliverableHeading}>
                        {canConfigure &&
                        !LOCKED_HOST_STATUSES.includes(episode.status) ? (
                          <div className={styles.checklistItemEditor}>
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
                            <textarea
                              value={deliverable.description}
                              aria-label={`${deliverable.label} instructions`}
                              maxLength={800}
                              onChange={(event) =>
                                updateDeliverable(deliverable.id, {
                                  description: event.target.value,
                                })
                              }
                            />
                          </div>
                        ) : (
                          <div>
                            <h3>{deliverable.label}</h3>
                            <p>{deliverable.description}</p>
                          </div>
                        )}
                        <span>
                          {deliverable.required ? 'Required' : 'Optional'}
                        </span>
                      </div>

                      {canConfigure &&
                      !LOCKED_HOST_STATUSES.includes(episode.status) ? (
                        <div className={styles.checklistItemControls}>
                          <label>
                            Response type
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
                            disabled={index === episode.deliverables.length - 1}
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
                      ) : null}

                      {deliverable.type === 'asset' ? null : deliverable.type ===
                        'url' ? (
                        <div className={styles.urlField}>
                          <input
                            type="url"
                            value={deliverable.value}
                            disabled={lockedForHost}
                            onChange={(event) =>
                              updateDeliverable(deliverable.id, {
                                value: event.target.value,
                              })
                            }
                            placeholder={materialPlaceholder(deliverable)}
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
                        <textarea
                          value={deliverable.value}
                          disabled={lockedForHost}
                          onChange={(event) =>
                            updateDeliverable(deliverable.id, {
                              value: event.target.value,
                            })
                          }
                          placeholder={materialPlaceholder(deliverable)}
                          aria-label={deliverable.label}
                        />
                      )}

                      {deliverable.id === 'guest-details' ? (
                        <label className={styles.guestSocialField}>
                          <span>Guest social profiles and handles</span>
                          <textarea
                            value={deliverable.social_profiles || ''}
                            disabled={lockedForHost}
                            onChange={(event) =>
                              updateDeliverable(deliverable.id, {
                                social_profiles: event.target.value,
                              })
                            }
                            placeholder="Instagram: @guest · LinkedIn: https://… · Website: https://… · or “None provided”"
                            aria-label="Guest social profiles and handles"
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
                            </>
                          ) : (
                            <p className={styles.assetStorageNotice}>
                              File uploads are not configured in this
                              environment.
                            </p>
                          )
                        ) : null}

                        {uploadFeedback ? (
                          <p
                            id={`asset-upload-feedback-${deliverable.id}`}
                            className={`${styles.stepAssetFeedback} ${
                              uploadFeedback.tone === 'error'
                                ? styles.stepAssetFeedbackError
                                : uploadFeedback.tone === 'success'
                                  ? styles.stepAssetFeedbackSuccess
                                  : styles.stepAssetFeedbackStatus
                            }`}
                            role={
                              uploadFeedback.tone === 'error'
                                ? 'alert'
                                : 'status'
                            }
                          >
                            {uploadFeedback.message}
                          </p>
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
                                    <span
                                      className={styles.assetExpiredBadge}
                                    >
                                      Expired
                                    </span>
                                  ) : (
                                    <a
                                      href={`/api/studio/episodes/${encodeURIComponent(
                                        episode.episode_id
                                      )}/assets/${encodeURIComponent(
                                        asset.asset_id
                                      )}`}
                                    >
                                      Download
                                    </a>
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

                      {canConfigure ? (
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
                          Require this item before a complete handoff
                        </label>
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
                                <input
                                  value={deliverable.missing_note}
                                  onChange={(event) =>
                                    updateDeliverable(deliverable.id, {
                                      missing_note: event.target.value,
                                    })
                                  }
                                  placeholder="What is missing, and how will it be delivered?"
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
                          <p>
                            {deliverable.missing_note}
                            {deliverable.expected_by
                              ? ` Expected by ${formatDate(
                                  deliverable.expected_by
                                )}.`
                              : ''}
                          </p>
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>

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
                                  <span
                                    className={styles.assetExpiredBadge}
                                  >
                                    Expired from storage
                                  </span>
                                ) : (
                                  <a
                                    href={`/api/studio/episodes/${encodeURIComponent(
                                      episode.episode_id
                                    )}/assets/${encodeURIComponent(
                                      asset.asset_id
                                    )}`}
                                  >
                                    Download
                                  </a>
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
              <section className={styles.reviewPanel}>
                <div>
                  <span className={styles.eyebrow}>Producer review</span>
                  <h2>Move the episode forward</h2>
                  {!canReview && canAdminOverride ? (
                    <p>
                      You are not the assigned producer. Any review action
                      below is an attributed administrator override.
                    </p>
                  ) : null}
                  <textarea
                    value={episode.producer_feedback}
                    onChange={(event) =>
                      updateEpisode({ producer_feedback: event.target.value })
                    }
                    placeholder="Feedback for the assigned hosts…"
                    aria-label="Producer feedback"
                  />
                </div>
                <div className={styles.reviewActions}>
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={
                      saving ||
                      Boolean(uploadingAsset) ||
                      !episode.producer_feedback.trim()
                    }
                    onClick={() => reviewEpisode('needs_changes')}
                  >
                    Request changes
                  </button>
                  <button
                    type="button"
                    className={styles.primaryButton}
                    disabled={
                      saving ||
                      Boolean(uploadingAsset) ||
                      !['submitted', 'submitted_with_gaps'].includes(
                        episode.status
                      )
                    }
                    onClick={() => reviewEpisode('accepted')}
                  >
                    <CheckCircleRoundedIcon aria-hidden="true" />
                    Accept package
                  </button>
                </div>
              </section>
            ) : null}

            <section className={styles.actionDock}>
              <div>
                <strong>
                  {dirty
                    ? 'You have unpublished episode material'
                    : lockedForHost
                      ? 'This package is with the producer'
                      : 'Everything here is saved'}
                </strong>
                <span>
                  {completion.can_submit
                    ? 'All required material is ready.'
                    : `${completion.missing.length} required items are still missing.`}
                </span>
              </div>
              <div>
                {canManage || !lockedForHost ? (
                  <button
                    type="button"
                    className={styles.secondaryButton}
                    disabled={saving || Boolean(uploadingAsset) || !dirty}
                    onClick={saveDraft}
                  >
                    <SaveRoundedIcon aria-hidden="true" />
                    {canManage ? 'Save Studio' : 'Save draft'}
                  </button>
                ) : null}
                {canHost && !lockedForHost ? (
                  <>
                    <button
                      type="button"
                      className={styles.gapSubmitButton}
                      disabled={
                        saving ||
                        Boolean(uploadingAsset) ||
                        !completion.can_submit_with_gaps
                      }
                      onClick={() => submitEpisode('with_gaps')}
                    >
                      <WarningAmberRoundedIcon aria-hidden="true" />
                      Send with known gaps
                    </button>
                    <button
                      type="button"
                      className={styles.primaryButton}
                      disabled={
                        saving ||
                        Boolean(uploadingAsset) ||
                        !completion.can_submit
                      }
                      onClick={() => submitEpisode('complete')}
                    >
                      <SendRoundedIcon aria-hidden="true" />
                      Send to producer
                    </button>
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
