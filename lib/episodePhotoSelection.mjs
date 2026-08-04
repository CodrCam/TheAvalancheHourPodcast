export const EPISODE_PHOTO_DELIVERABLE_ID = 'photos';
export const EPISODE_FINAL_PHOTO_COUNT = 3;

function cleanText(value, maxLength = 1200) {
  return String(value ?? '').trim().slice(0, maxLength);
}

function cleanId(value, maxLength = 180) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_.:-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, maxLength);
}

function cleanTimestamp(value) {
  const text = cleanText(value, 50);
  if (!text) return '';
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? '' : parsed.toISOString();
}

function plainObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value
    : {};
}

function isAssetExpired(asset = {}, now = new Date()) {
  const expiresAt = cleanTimestamp(asset.retention_expires_at);
  const comparison = now instanceof Date ? now : new Date(now);
  const comparisonTime = Number.isNaN(comparison.getTime())
    ? Date.now()
    : comparison.getTime();
  return Boolean(
    expiresAt && new Date(expiresAt).getTime() <= comparisonTime
  );
}

function normalizeSelectionItem(value = {}, index = 0) {
  const source = plainObject(value);
  const objectVersionId = cleanText(source.object_version_id, 1024);
  return {
    asset_id: cleanId(source.asset_id || source.id),
    object_version_id: objectVersionId,
    version_bound:
      Boolean(objectVersionId) || source.version_bound === true,
    position: index + 1,
    needs_editing: source.needs_editing === true,
    needs_crop: source.needs_crop === true,
    editing_notes: cleanText(
      source.editing_notes || source.notes,
      1200
    ),
  };
}

export function createEmptyEpisodePhotoSelection() {
  return {
    status: 'draft',
    items: [],
    general_notes: '',
    updated_at: '',
    updated_by_person_id: '',
    updated_by_name: '',
    confirmed_at: '',
    confirmed_by_person_id: '',
    confirmed_by_name: '',
  };
}

export function normalizeEpisodePhotoSelection(value = {}) {
  const source = plainObject(value);
  const seen = new Set();
  const items = (Array.isArray(source.items)
    ? source.items
    : Array.isArray(source.selections)
      ? source.selections
      : []
  )
    .map(normalizeSelectionItem)
    .filter((item) => {
      if (!item.asset_id || seen.has(item.asset_id)) return false;
      seen.add(item.asset_id);
      return true;
    })
    .slice(0, EPISODE_FINAL_PHOTO_COUNT)
    .map((item, index) => ({ ...item, position: index + 1 }));
  const confirmed =
    source.status === 'confirmed' &&
    items.length === EPISODE_FINAL_PHOTO_COUNT;

  return {
    status: confirmed ? 'confirmed' : 'draft',
    items,
    general_notes: cleanText(source.general_notes, 2400),
    updated_at: cleanTimestamp(source.updated_at),
    updated_by_person_id: cleanId(source.updated_by_person_id),
    updated_by_name: cleanText(source.updated_by_name, 180),
    confirmed_at: confirmed ? cleanTimestamp(source.confirmed_at) : '',
    confirmed_by_person_id: confirmed
      ? cleanId(source.confirmed_by_person_id)
      : '',
    confirmed_by_name: confirmed
      ? cleanText(source.confirmed_by_name, 180)
      : '',
  };
}

export function getEpisodePhotoAssets(assets = [], { now = new Date() } = {}) {
  return (Array.isArray(assets) ? assets : []).filter(
    (asset) =>
      cleanId(asset?.asset_id) &&
      cleanId(asset?.deliverable_id) === EPISODE_PHOTO_DELIVERABLE_ID &&
      asset?.category === 'image' &&
      asset?.status === 'uploaded' &&
      !isAssetExpired(asset, now)
  );
}

function selectionMatchesAsset(item, asset) {
  if (!asset) return false;
  const storedVersion = cleanText(asset.object_version_id, 1024);
  if (storedVersion) {
    return (
      Boolean(item.object_version_id) &&
      item.object_version_id === storedVersion
    );
  }
  return asset.storage_verified === true && item.version_bound === true;
}

export function isEpisodePhotoSelectionConfirmed(
  selectionOrDeliverable = {},
  assets = [],
  { now = new Date() } = {}
) {
  const source = plainObject(selectionOrDeliverable);
  const selection = normalizeEpisodePhotoSelection(
    source.photo_selection || source
  );
  if (
    selection.status !== 'confirmed' ||
    selection.items.length !== EPISODE_FINAL_PHOTO_COUNT
  ) {
    return false;
  }
  const assetById = new Map(
    getEpisodePhotoAssets(assets, { now }).map((asset) => [
      cleanId(asset.asset_id),
      asset,
    ])
  );
  return selection.items.every((item) =>
    selectionMatchesAsset(item, assetById.get(item.asset_id))
  );
}

export function getEpisodePhotoSelectionReadiness(
  selectionOrDeliverable = {},
  assets = [],
  options = {}
) {
  const source = plainObject(selectionOrDeliverable);
  const selection = normalizeEpisodePhotoSelection(
    source.photo_selection || source
  );
  const availableAssets = getEpisodePhotoAssets(assets, options);
  return {
    required_count: EPISODE_FINAL_PHOTO_COUNT,
    selected_count: selection.items.length,
    available_count: availableAssets.length,
    confirmed: isEpisodePhotoSelectionConfirmed(
      selection,
      availableAssets,
      options
    ),
    status: selection.status,
  };
}

export function buildEpisodePhotoSelection(
  currentValue = {},
  updateValue = {},
  assets = [],
  actor = {},
  { now = new Date() } = {}
) {
  const current = normalizeEpisodePhotoSelection(currentValue);
  const update = plainObject(updateValue);
  const requestedItems = Array.isArray(update.items) ? update.items : [];
  if (requestedItems.length > EPISODE_FINAL_PHOTO_COUNT) {
    throw new Error(
      `Episode photos: choose exactly ${EPISODE_FINAL_PHOTO_COUNT} final images.`
    );
  }

  const availableById = new Map(
    getEpisodePhotoAssets(assets, { now }).map((asset) => [
      cleanId(asset.asset_id),
      asset,
    ])
  );
  const seen = new Set();
  const items = requestedItems.map((requested, index) => {
    const normalized = normalizeSelectionItem(requested, index);
    if (!normalized.asset_id || seen.has(normalized.asset_id)) {
      throw new Error(
        'Episode photos: each final image must be selected only once.'
      );
    }
    seen.add(normalized.asset_id);
    const asset = availableById.get(normalized.asset_id);
    if (!asset) {
      throw new Error(
        'Episode photos: a selected image is unavailable or no longer belongs to the Photos step.'
      );
    }
    const objectVersionId = cleanText(asset.object_version_id, 1024);
    if (!objectVersionId) {
      throw new Error(
        'Episode photos: a selected image is missing its immutable storage version.'
      );
    }
    return {
      ...normalized,
      object_version_id: objectVersionId,
      version_bound: true,
      position: index + 1,
    };
  });

  const requestedStatus = update.status === 'confirmed'
    ? 'confirmed'
    : 'draft';
  if (
    requestedStatus === 'confirmed' &&
    items.length !== EPISODE_FINAL_PHOTO_COUNT
  ) {
    throw new Error(
      `Episode photos: select exactly ${EPISODE_FINAL_PHOTO_COUNT} images before confirming the final set.`
    );
  }

  const timestamp = cleanTimestamp(now) || new Date(now).toISOString();
  const personId = cleanId(
    actor.person_id || actor.personId || actor.actor_person_id
  );
  const personName = cleanText(
    actor.person_name || actor.personName || actor.name,
    180
  );
  const confirmed = requestedStatus === 'confirmed';
  return {
    status: requestedStatus,
    items,
    general_notes: Object.prototype.hasOwnProperty.call(
      update,
      'general_notes'
    )
      ? cleanText(update.general_notes, 2400)
      : current.general_notes,
    updated_at: timestamp,
    updated_by_person_id: personId,
    updated_by_name: personName,
    confirmed_at: confirmed ? timestamp : '',
    confirmed_by_person_id: confirmed ? personId : '',
    confirmed_by_name: confirmed ? personName : '',
  };
}

export function removeAssetFromEpisodePhotoSelection(
  value = {},
  assetId = ''
) {
  const selection = normalizeEpisodePhotoSelection(value);
  const cleanAssetId = cleanId(assetId);
  if (!cleanAssetId) return selection;
  const items = selection.items.filter(
    (item) => item.asset_id !== cleanAssetId
  );
  if (items.length === selection.items.length) return selection;
  return {
    ...selection,
    status: 'draft',
    items: items.map((item, index) => ({ ...item, position: index + 1 })),
    confirmed_at: '',
    confirmed_by_person_id: '',
    confirmed_by_name: '',
  };
}

export function sanitizeEpisodePhotoSelectionForViewer(value = {}) {
  const selection = normalizeEpisodePhotoSelection(value);
  return {
    ...selection,
    items: selection.items.map((item) => {
      const safe = {
        ...item,
        version_bound: Boolean(item.object_version_id || item.version_bound),
      };
      delete safe.object_version_id;
      return safe;
    }),
  };
}
