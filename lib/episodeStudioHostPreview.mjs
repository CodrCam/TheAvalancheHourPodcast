export const EPISODE_STUDIO_HOST_PREVIEW_MODE = 'host';

export function canPreviewEpisodeAsHost(
  capabilities = {},
  episodeRoles = []
) {
  const normalizedRoles = new Set(
    (Array.isArray(episodeRoles) ? episodeRoles : [])
      .map((role) => String(role || '').trim())
      .filter(Boolean)
  );
  const isHostOnlyEpisodeViewer =
    normalizedRoles.size === 1 && normalizedRoles.has('host');

  return (
    !isHostOnlyEpisodeViewer &&
    (capabilities.canManage === true ||
      capabilities.canReview === true ||
      capabilities.canConfigure === true)
  );
}

export function getEpisodeStudioViewCapabilities(
  capabilities = {},
  requestedMode = '',
  episodeRoles = []
) {
  const canUseHostPreview = canPreviewEpisodeAsHost(
    capabilities,
    episodeRoles
  );
  const hostPreview =
    requestedMode === EPISODE_STUDIO_HOST_PREVIEW_MODE && canUseHostPreview;

  if (!hostPreview) {
    return {
      ...capabilities,
      canUseHostPreview,
      hostPreview: false,
      hostPreviewReadOnly: false,
    };
  }

  return {
    ...capabilities,
    canManage: false,
    canHost: true,
    canReview: false,
    canUploadAssets: false,
    canConfigure: false,
    canAdminOverride: false,
    canAdvanceProduction: false,
    canUseHostPreview: true,
    hostPreview: true,
    hostPreviewReadOnly: true,
  };
}
