import { isSafeSpotifyStagingUrl } from './episodeStudioPresentation.mjs';
import {
  GUEST_RECORDING_PLAN_TASK_ID,
  isEpisodeProductionTaskComplete,
  MICROPHONE_PLAN_TASK_ID,
} from './episodeProductionPlan.mjs';
import {
  GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
} from './guestQuestionnaireWorkflow.mjs';

const ACCEPTANCE_REVIEW_TASKS = Object.freeze([
  Object.freeze({
    taskId: GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
    label: 'guest questionnaire response receipt',
  }),
  Object.freeze({
    taskId: GUEST_RECORDING_PLAN_TASK_ID,
    label: 'guest recording setup review',
  }),
  Object.freeze({
    taskId: MICROPHONE_PLAN_TASK_ID,
    label: 'microphone plan confirmation',
  }),
]);

function busyReason({ saving = false, uploading = false } = {}) {
  if (uploading) return 'Wait for the current file upload to finish.';
  if (saving) return 'Wait for the current Studio update to finish.';
  return '';
}

function summarizeMissingItems(completion = {}) {
  const labels = (Array.isArray(completion.missing)
    ? completion.missing
    : []
  )
    .map((item) => String(item?.label || '').trim())
    .filter(Boolean);

  if (!labels.length) return 'Complete the remaining required material first.';
  if (labels.length <= 2) return `Complete ${labels.join(' and ')} first.`;
  return `Complete ${labels.slice(0, 2).join(', ')}, and ${
    labels.length - 2
  } more required ${labels.length - 2 === 1 ? 'item' : 'items'} first.`;
}

const PUBLIC_GUEST_REVIEW_FIELDS = Object.freeze([
  'name',
  'title_affiliation',
  'short_bio',
  'website',
  'instagram',
  'facebook',
  'linkedin',
  'x_twitter',
  'youtube',
  'tiktok',
  'other',
  'no_public_profiles',
]);

function publicGuestReviewProfile(profile = {}) {
  return Object.fromEntries(
    PUBLIC_GUEST_REVIEW_FIELDS.map((field) => [field, profile?.[field] ?? ''])
  );
}

/**
 * A questionnaire update can reopen these required receipt/review tasks while
 * an episode remains submitted. Keep acceptance from silently waiving that
 * new work, while preserving legacy/custom workflows where a task is missing
 * or explicitly optional.
 */
export function getEpisodeAcceptanceTaskBlocker(episode = {}) {
  const tasks = Array.isArray(episode?.production_tasks)
    ? episode.production_tasks
    : [];
  const tasksById = new Map(
    tasks.map((task) => [String(task?.task_id || task?.id || '').trim(), task])
  );
  const incompleteLabels = ACCEPTANCE_REVIEW_TASKS.flatMap(
    ({ taskId, label }) => {
      const task = tasksById.get(taskId);
      return task?.required === true &&
        !isEpisodeProductionTaskComplete(task, episode)
        ? [label]
        : [];
    }
  );

  if (!incompleteLabels.length) return '';
  const taskList =
    incompleteLabels.length === 1
      ? incompleteLabels[0]
      : `${incompleteLabels.slice(0, -1).join(', ')} and ${
          incompleteLabels.at(-1)
        }`;
  return `Complete the required ${taskList} before accepting this package. Questionnaire updates reopen ${
    incompleteLabels.length === 1 ? 'this check' : 'these checks'
  }.`;
}

/** Server contract for review PATCHes; non-acceptance review actions are inert. */
export function getEpisodeAcceptancePatchBlocker({
  action = '',
  requestedStatus = '',
  episode = {},
} = {}) {
  if (
    !['review', 'override_review'].includes(String(action || '')) ||
    requestedStatus !== 'accepted'
  ) {
    return null;
  }
  const error = getEpisodeAcceptanceTaskBlocker(episode);
  return error
    ? {
        status: 409,
        code: 'EPISODE_ACCEPTANCE_REVIEWS_INCOMPLETE',
        error,
      }
    : null;
}

export function getHostResearchReviewFingerprint(
  episode = {},
  microphonePlan = null
) {
  const episodeId = String(episode?.episode_id || '').trim();
  if (!episodeId) return '';
  const deliverables = (Array.isArray(episode.deliverables)
    ? episode.deliverables
    : []
  ).map((deliverable) => ({
    id: String(deliverable?.id || ''),
    required: deliverable?.required === true,
    type: String(deliverable?.type || ''),
    value: String(deliverable?.value || ''),
    social_profiles: String(deliverable?.social_profiles || ''),
    missing_acknowledged: deliverable?.missing_acknowledged === true,
    missing_note: String(deliverable?.missing_note || ''),
    expected_by: String(deliverable?.expected_by || ''),
    guest_profile:
      deliverable?.id === 'guest-details'
        ? publicGuestReviewProfile(deliverable.guest_profile)
        : null,
    photo_selection:
      deliverable?.id === 'photos' ? deliverable.photo_selection || null : null,
  }));
  const assets = (Array.isArray(episode.assets) ? episode.assets : [])
    .map((asset) => ({
      asset_id: String(asset?.asset_id || ''),
      deliverable_id: String(asset?.deliverable_id || ''),
      status: String(asset?.status || ''),
      file_name: String(asset?.file_name || ''),
      size: Number(asset?.size) || 0,
      storage_verified: asset?.storage_verified === true,
    }))
    .sort((left, right) => left.asset_id.localeCompare(right.asset_id));
  const sponsorReads = (Array.isArray(episode.sponsor_read_assignments)
    ? episode.sponsor_read_assignments
    : []
  )
    .map((assignment) => ({
      assignment_id: String(assignment?.assignment_id || ''),
      requires_audio: assignment?.requires_audio === true,
      completed: assignment?.completed === true,
      script_version: String(assignment?.script_version || ''),
    }))
    .sort((left, right) =>
      left.assignment_id.localeCompare(right.assignment_id)
    );

  return JSON.stringify({
    episode_id: episodeId,
    status: String(episode.status || ''),
    title: String(episode.title || ''),
    target_release_date: String(episode.target_release_date || ''),
    recording_date: String(episode.recording_date || ''),
    recording_time: String(episode.recording_time || ''),
    recording_time_zone: String(episode.recording_time_zone || ''),
    host_person_ids: (Array.isArray(episode.host_person_ids)
      ? episode.host_person_ids
      : []
    )
      .map((personId) => String(personId || ''))
      .sort(),
    deliverables,
    assets,
    sponsor_reads: sponsorReads,
    microphone_plan: microphonePlan
      ? {
          episode_id: String(microphonePlan.episodeId || ''),
          host_ids: String(microphonePlan.hostIdsKey || ''),
          complete: microphonePlan.complete === true,
        }
      : null,
  });
}

export function getEpisodeStudioActionBlockers({
  episode = {},
  completion = {},
  dirty = false,
  saving = false,
  uploading = false,
  productionHandoffAvailable = true,
  hostResearchReviewConfirmed = false,
} = {}) {
  const busy = busyReason({ saving, uploading });
  const currentEpisode = episode || {};
  const currentCompletion = completion || {};
  const status = String(currentEpisode.status || '');
  const stagedEpisodeUrl = String(
    currentEpisode.staged_episode_url || ''
  ).trim();
  const invalidStagedUrl =
    stagedEpisodeUrl && !isSafeSpotifyStagingUrl(stagedEpisodeUrl)
      ? 'Use a secure Spotify link from spotify.com or spotify.link.'
      : '';
  const packageSubmitted = ['submitted', 'submitted_with_gaps'].includes(
    status
  );
  const changesCanBeRequested = [
    'submitted',
    'submitted_with_gaps',
    'accepted',
  ].includes(status);
  const acceptanceTaskBlocker = getEpisodeAcceptanceTaskBlocker(
    currentEpisode
  );
  const productionHandoffBlocker = productionHandoffAvailable
    ? ''
    : 'Assign an active production lead before accepting this package.';

  return {
    save: busy || (!dirty ? 'There are no unsaved Studio changes.' : ''),
    submit:
      busy ||
      (!currentCompletion.can_submit
        ? summarizeMissingItems(currentCompletion)
        : !hostResearchReviewConfirmed
          ? 'Complete the Host research & review confirmation before sending this package to the producer.'
        : ''),
    submitWithGaps:
      busy ||
      (!currentCompletion.can_submit_with_gaps
        ? 'Acknowledge every missing checklist item and complete required audio and final files first.'
        : !hostResearchReviewConfirmed
          ? 'Complete the Host research & review confirmation before sending this package to the producer.'
        : ''),
    requestChanges:
      busy ||
      invalidStagedUrl ||
      (!changesCanBeRequested
        ? 'Hosts must send the package to the producer before changes can be requested.'
        : !String(currentEpisode.producer_feedback || '').trim()
          ? 'Add a producer note explaining what the hosts need to change.'
          : ''),
    accept:
      busy ||
      invalidStagedUrl ||
      (!packageSubmitted
        ? 'Hosts must send the package to the producer before it can be accepted.'
        : acceptanceTaskBlocker || productionHandoffBlocker),
    advanceProduction: saving
      ? 'Wait for the current Studio update to finish.'
      : '',
    deliveryHealth:
      busy ||
      (status === 'accepted'
        ? 'The delivery outlook is locked after producer acceptance.'
        : ''),
  };
}
