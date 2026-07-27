import { isSafeSpotifyStagingUrl } from './episodeStudioPresentation.mjs';

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

export function getEpisodeStudioActionBlockers({
  episode = {},
  completion = {},
  dirty = false,
  saving = false,
  uploading = false,
  productionHandoffAvailable = true,
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

  return {
    save: busy || (!dirty ? 'There are no unsaved Studio changes.' : ''),
    submit:
      busy ||
      (!currentCompletion.can_submit
        ? summarizeMissingItems(currentCompletion)
        : ''),
    submitWithGaps:
      busy ||
      (!currentCompletion.can_submit_with_gaps
        ? 'Acknowledge every missing checklist item and complete required audio and final files first.'
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
        : !productionHandoffAvailable
          ? 'Activate Angie or Caleb as a production lead before accepting this package.'
          : ''),
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
