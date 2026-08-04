import Image from 'next/image';
import { useMemo, useState } from 'react';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import CropRoundedIcon from '@mui/icons-material/CropRounded';
import ImageNotSupportedRoundedIcon from '@mui/icons-material/ImageNotSupportedRounded';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import TuneRoundedIcon from '@mui/icons-material/TuneRounded';
import PlainTextArea from './PlainTextArea';
import {
  EPISODE_FINAL_PHOTO_COUNT,
  getEpisodePhotoAssets,
  isEpisodePhotoSelectionConfirmed,
  normalizeEpisodePhotoSelection,
} from '../lib/episodePhotoSelection.mjs';
import styles from '../styles/EpisodePhotoSelectionReview.module.css';

function editableDraft(value = {}) {
  const selection = normalizeEpisodePhotoSelection(value);
  return {
    status: selection.status,
    items: selection.items.map((item) => ({
      asset_id: item.asset_id,
      needs_editing: item.needs_editing === true,
      needs_crop: item.needs_crop === true,
      editing_notes: item.editing_notes || '',
    })),
    general_notes: selection.general_notes || '',
  };
}

function draftFingerprint(value = {}) {
  const draft = editableDraft(value);
  return JSON.stringify({
    items: draft.items,
    general_notes: draft.general_notes,
  });
}

function formatSavedAt(value = '') {
  const date = new Date(value);
  if (!value || Number.isNaN(date.getTime())) return '';
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

export default function EpisodePhotoSelectionReview({
  episodeId = '',
  assets = [],
  selection = {},
  canEdit = false,
  disabledReason = '',
  saving = false,
  onSave,
}) {
  const normalizedSelection = useMemo(
    () => normalizeEpisodePhotoSelection(selection),
    [selection]
  );
  const [draft, setDraft] = useState(() => editableDraft(selection));
  const [previewFailures, setPreviewFailures] = useState({});
  const [localMessage, setLocalMessage] = useState('');
  const baselineFingerprint = draftFingerprint(normalizedSelection);
  const currentFingerprint = draftFingerprint(draft);
  const dirty = currentFingerprint !== baselineFingerprint;
  const selectedIndexById = new Map(
    draft.items.map((item, index) => [item.asset_id, index])
  );
  const availableAssets = getEpisodePhotoAssets(assets);
  const orderedAssets = [
    ...draft.items
      .map((item) =>
        availableAssets.find((asset) => asset.asset_id === item.asset_id)
      )
      .filter(Boolean),
    ...availableAssets.filter(
      (asset) => !selectedIndexById.has(asset.asset_id)
    ),
  ];
  const selectedCount = draft.items.length;
  const readyToConfirm = selectedCount === EPISODE_FINAL_PHOTO_COUNT;
  const confirmed =
    !dirty && isEpisodePhotoSelectionConfirmed(normalizedSelection, assets);

  function toggleAsset(assetId) {
    if (!canEdit || saving) return;
    setLocalMessage('');
    setDraft((current) => {
      const existingIndex = current.items.findIndex(
        (item) => item.asset_id === assetId
      );
      if (existingIndex >= 0) {
        return {
          ...current,
          status: 'draft',
          items: current.items.filter((item) => item.asset_id !== assetId),
        };
      }
      if (current.items.length >= EPISODE_FINAL_PHOTO_COUNT) {
        setLocalMessage(
          `Remove one selected image before choosing another. The final set is limited to ${EPISODE_FINAL_PHOTO_COUNT}.`
        );
        return current;
      }
      return {
        ...current,
        status: 'draft',
        items: [
          ...current.items,
          {
            asset_id: assetId,
            needs_editing: false,
            needs_crop: false,
            editing_notes: '',
          },
        ],
      };
    });
  }

  function updateItem(assetId, patch) {
    setLocalMessage('');
    setDraft((current) => ({
      ...current,
      status: 'draft',
      items: current.items.map((item) =>
        item.asset_id === assetId ? { ...item, ...patch } : item
      ),
    }));
  }

  function moveItem(assetId, offset) {
    if (!canEdit || saving) return;
    setLocalMessage('');
    setDraft((current) => {
      const items = [...current.items];
      const index = items.findIndex((item) => item.asset_id === assetId);
      const destination = index + offset;
      if (index < 0 || destination < 0 || destination >= items.length) {
        return current;
      }
      [items[index], items[destination]] = [items[destination], items[index]];
      return { ...current, status: 'draft', items };
    });
  }

  async function save(status) {
    if (!canEdit || saving || typeof onSave !== 'function') return;
    setLocalMessage('');
    const result = await onSave({
      status,
      items: draft.items,
      general_notes: draft.general_notes,
    });
    if (result) {
      setLocalMessage(
        status === 'confirmed'
          ? 'Three final images confirmed for production.'
          : 'Photo review draft saved.'
      );
    }
  }

  return (
    <section className={styles.review} aria-label="Final photo review">
      <div className={styles.heading}>
        <div>
          <span className={styles.eyebrow}>Final image review</span>
          <h4>Choose the three production images</h4>
          <p>
            Pick exactly three, place the cover image first, and flag anything
            that needs cropping or editing before the graphic is built.
          </p>
        </div>
        <div
          className={styles.countBadge}
          data-confirmed={confirmed ? 'true' : 'false'}
        >
          {confirmed ? <CheckCircleRoundedIcon aria-hidden="true" /> : null}
          <strong>{selectedCount} / {EPISODE_FINAL_PHOTO_COUNT}</strong>
          <span>{confirmed ? 'Confirmed' : 'Selected'}</span>
        </div>
      </div>

      {!availableAssets.length ? (
        <div className={styles.emptyState}>
          <ImageNotSupportedRoundedIcon aria-hidden="true" />
          <div>
            <strong>No reviewable images yet</strong>
            <p>
              Guest questionnaire photo uploads will appear here automatically.
              Hosts and producers can also upload images to this step.
            </p>
          </div>
        </div>
      ) : (
        <div className={styles.assetGrid}>
          {orderedAssets.map((asset) => {
            const selectedIndex = selectedIndexById.get(asset.asset_id);
            const isSelected = selectedIndex !== undefined;
            const item = isSelected ? draft.items[selectedIndex] : null;
            const previewFailed = previewFailures[asset.asset_id] === true;
            const previewUrl = `/api/studio/episodes/${encodeURIComponent(
              episodeId
            )}/assets/${encodeURIComponent(asset.asset_id)}?preview=thumbnail`;
            const downloadUrl = `/api/studio/episodes/${encodeURIComponent(
              episodeId
            )}/assets/${encodeURIComponent(asset.asset_id)}`;
            return (
              <article
                key={asset.asset_id}
                className={styles.assetCard}
                data-selected={isSelected ? 'true' : 'false'}
              >
                <div className={styles.preview}>
                  {previewFailed ? (
                    <div className={styles.previewFallback}>
                      <ImageNotSupportedRoundedIcon aria-hidden="true" />
                      <span>Safe preview unavailable</span>
                      <small>Download the original to review this format.</small>
                    </div>
                  ) : (
                    <Image
                      src={previewUrl}
                      alt={`Preview of ${asset.label || asset.file_name}`}
                      fill
                      sizes="(max-width: 680px) 100vw, 320px"
                      unoptimized
                      onError={() =>
                        setPreviewFailures((current) => ({
                          ...current,
                          [asset.asset_id]: true,
                        }))
                      }
                    />
                  )}
                  {isSelected ? (
                    <span className={styles.orderBadge}>
                      {selectedIndex + 1}
                    </span>
                  ) : null}
                </div>

                <div className={styles.assetMeta}>
                  <strong>{asset.label || asset.file_name}</strong>
                  <span>{asset.file_name}</span>
                  <a href={downloadUrl}>
                    <OpenInNewRoundedIcon aria-hidden="true" />
                    Download original
                  </a>
                </div>

                <div className={styles.assetActions}>
                  <button
                    type="button"
                    className={isSelected ? styles.removeButton : styles.pickButton}
                    disabled={!canEdit || saving}
                    onClick={() => toggleAsset(asset.asset_id)}
                  >
                    {isSelected ? 'Remove from final three' : 'Choose this image'}
                  </button>
                  {isSelected ? (
                    <div className={styles.orderActions}>
                      <button
                        type="button"
                        disabled={!canEdit || saving || selectedIndex === 0}
                        aria-label={`Move ${asset.file_name} earlier`}
                        onClick={() => moveItem(asset.asset_id, -1)}
                      >
                        <ArrowUpwardRoundedIcon aria-hidden="true" />
                        Earlier
                      </button>
                      <button
                        type="button"
                        disabled={
                          !canEdit ||
                          saving ||
                          selectedIndex === draft.items.length - 1
                        }
                        aria-label={`Move ${asset.file_name} later`}
                        onClick={() => moveItem(asset.asset_id, 1)}
                      >
                        <ArrowDownwardRoundedIcon aria-hidden="true" />
                        Later
                      </button>
                    </div>
                  ) : null}
                </div>

                {isSelected ? (
                  <div className={styles.editingPanel}>
                    <div className={styles.editFlags}>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.needs_crop === true}
                          disabled={!canEdit || saving}
                          onChange={(event) =>
                            updateItem(asset.asset_id, {
                              needs_crop: event.target.checked,
                            })
                          }
                        />
                        <CropRoundedIcon aria-hidden="true" />
                        Needs crop
                      </label>
                      <label>
                        <input
                          type="checkbox"
                          checked={item.needs_editing === true}
                          disabled={!canEdit || saving}
                          onChange={(event) =>
                            updateItem(asset.asset_id, {
                              needs_editing: event.target.checked,
                            })
                          }
                        />
                        <TuneRoundedIcon aria-hidden="true" />
                        Needs editing
                      </label>
                    </div>
                    <label className={styles.notesField}>
                      <span>Crop or editing instructions</span>
                      <PlainTextArea
                        value={item.editing_notes || ''}
                        maxLength={1200}
                        disabled={!canEdit || saving}
                        onValueChange={(editingNotes) =>
                          updateItem(asset.asset_id, {
                            editing_notes: editingNotes,
                          })
                        }
                      />
                    </label>
                  </div>
                ) : null}
              </article>
            );
          })}
        </div>
      )}

      <label className={styles.generalNotes}>
        <span>Instructions for the complete three-image set</span>
        <small>
          Add cover treatment, caption, credit, placement, or images to avoid.
        </small>
        <PlainTextArea
          value={draft.general_notes || ''}
          maxLength={2400}
          disabled={!canEdit || saving}
          onValueChange={(generalNotes) =>
            setDraft((current) => ({
              ...current,
              status: 'draft',
              general_notes: generalNotes,
            }))
          }
        />
      </label>

      <div className={styles.footer}>
        <div className={styles.status} role="status" aria-live="polite">
          {localMessage ? <strong>{localMessage}</strong> : null}
          {!localMessage && disabledReason ? <span>{disabledReason}</span> : null}
          {!localMessage && confirmed ? (
            <span>
              Confirmed{normalizedSelection.confirmed_by_name
                ? ` by ${normalizedSelection.confirmed_by_name}`
                : ''}
              {normalizedSelection.confirmed_at
                ? ` · ${formatSavedAt(normalizedSelection.confirmed_at)}`
                : ''}
            </span>
          ) : null}
          {!localMessage && dirty ? <span>Unsaved photo-review changes</span> : null}
        </div>
        {canEdit ? (
          <div className={styles.footerActions}>
            <button
              type="button"
              className={styles.secondaryButton}
              disabled={saving || (!dirty && normalizedSelection.status === 'draft')}
              onClick={() => save('draft')}
            >
              Save draft
            </button>
            <button
              type="button"
              className={styles.confirmButton}
              disabled={saving || !readyToConfirm || (confirmed && !dirty)}
              title={
                readyToConfirm
                  ? 'Confirm this order for production.'
                  : `Choose exactly ${EPISODE_FINAL_PHOTO_COUNT} images first.`
              }
              onClick={() => save('confirmed')}
            >
              <CheckCircleRoundedIcon aria-hidden="true" />
              Confirm final three
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}
