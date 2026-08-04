export const EPISODE_ASSET_GRANT_SAFETY_MS = 60 * 1000;
export const EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_MS = 60 * 60 * 1000;
export const EPISODE_DELETION_TOMBSTONE_RETENTION_MS =
  30 * 24 * 60 * 60 * 1000;

function parsedTimestamp(value) {
  const timestamp = Date.parse(String(value || '').trim());
  return Number.isNaN(timestamp) ? null : timestamp;
}

export function recordEpisodeAssetUploadGrant(episodeValue = {}, expiresAt) {
  const candidate = parsedTimestamp(expiresAt);
  if (candidate === null) {
    throw new Error('Episode asset: upload authorization expiry is invalid.');
  }
  const current = parsedTimestamp(
    episodeValue.asset_upload_grants_expire_at
  );
  return {
    ...episodeValue,
    asset_upload_grants_expire_at: new Date(
      current === null ? candidate : Math.max(current, candidate)
    ).toISOString(),
  };
}

export function getEpisodeDeletionReadyAt(
  episodeValue = {},
  {
    safetyMs = EPISODE_ASSET_GRANT_SAFETY_MS,
    legacyGrantExpiryMs = EPISODE_ASSET_UPLOAD_GRANT_EXPIRY_MS,
  } = {}
) {
  const deletedAt = parsedTimestamp(episodeValue.deleted_at);
  if (deletedAt === null) return null;
  const grantExpiresAt = parsedTimestamp(
    episodeValue.asset_upload_grants_expire_at
  );
  const latestPossibleGrantExpiry =
    grantExpiresAt ??
    deletedAt + Math.max(0, Number(legacyGrantExpiryMs) || 0);
  return new Date(
    Math.max(deletedAt, latestPossibleGrantExpiry) +
      Math.max(0, Number(safetyMs) || 0)
  );
}

export function createEpisodeDeletionTombstone(
  episodeValue = {},
  {
    finalizedAt = new Date().toISOString(),
    retentionMs = EPISODE_DELETION_TOMBSTONE_RETENTION_MS,
  } = {}
) {
  const episodeId = String(episodeValue.episode_id || '').trim();
  const deletedAt = String(episodeValue.deleted_at || '').trim();
  if (!episodeId || parsedTimestamp(deletedAt) === null) {
    throw new Error('Episode Studio: a valid deletion tombstone is required.');
  }
  const cleanFinalizedAt = new Date(finalizedAt).toISOString();
  const purgeAt = new Date(
    new Date(cleanFinalizedAt).getTime() +
      Math.max(0, Number(retentionMs) || 0)
  ).toISOString();
  return {
    schema_version: episodeValue.schema_version,
    episode_id: episodeId,
    title: 'Deleted Episode Studio',
    deleted_at: new Date(deletedAt).toISOString(),
    deletion_finalized_at: cleanFinalizedAt,
    deletion_tombstone_purge_at: purgeAt,
    asset_upload_grants_expire_at:
      parsedTimestamp(episodeValue.asset_upload_grants_expire_at) === null
        ? ''
        : new Date(
            episodeValue.asset_upload_grants_expire_at
          ).toISOString(),
    archived: true,
    archived_at: cleanFinalizedAt,
    created_at: cleanFinalizedAt,
    updated_at: cleanFinalizedAt,
  };
}

export function getEpisodeDeletionTombstonePurgeAt(episodeValue = {}) {
  const explicit = parsedTimestamp(
    episodeValue.deletion_tombstone_purge_at
  );
  if (explicit !== null) return new Date(explicit);
  const finalizedAt = parsedTimestamp(episodeValue.deletion_finalized_at);
  if (finalizedAt === null) return null;
  return new Date(
    finalizedAt + EPISODE_DELETION_TOMBSTONE_RETENTION_MS
  );
}
