import { useEffect, useRef, useState } from 'react';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import styles from '../styles/EpisodeStudio.module.css';

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

export default function EpisodeStudioDeletionControl({
  episode,
  saving = false,
  uploading = false,
  deleting = false,
  onDelete,
}) {
  const [open, setOpen] = useState(false);
  const [confirmation, setConfirmation] = useState('');
  const [assetsConfirmed, setAssetsConfirmed] = useState(false);
  const confirmationInputRef = useRef(null);
  const assetCount = episode?.assets?.length || 0;
  const assetBytes = (episode?.assets || []).reduce(
    (total, asset) => total + Math.max(0, Number(asset.size) || 0),
    0
  );
  const confirmationMatches =
    confirmation === String(episode?.title || '');

  function close() {
    if (deleting) return;
    setOpen(false);
    setConfirmation('');
    setAssetsConfirmed(false);
  }

  useEffect(() => {
    if (!open) return;
    const frame = window.requestAnimationFrame(() => {
      confirmationInputRef.current?.focus();
    });
    const closeOnEscape = (event) => {
      if (event.key === 'Escape' && !deleting) {
        setOpen(false);
        setConfirmation('');
        setAssetsConfirmed(false);
      }
    };
    window.addEventListener('keydown', closeOnEscape);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener('keydown', closeOnEscape);
    };
  }, [deleting, open]);

  if (!episode) return null;

  return (
    <>
      <details className={styles.dangerZone}>
        <summary>Danger zone</summary>
        <div>
          <div>
            <strong>Delete this Episode Studio</strong>
            <p>
              Permanently remove the Studio and all {assetCount}{' '}
              {assetCount === 1 ? 'file' : 'files'} stored for it
              {assetBytes ? ` (${formatBytes(assetBytes)})` : ''}. This cannot
              be undone.
            </p>
          </div>
          <button
            type="button"
            className={styles.dangerButton}
            disabled={saving || deleting || uploading}
            onClick={() => {
              setConfirmation('');
              setAssetsConfirmed(false);
              setOpen(true);
            }}
          >
            <DeleteOutlineRoundedIcon aria-hidden="true" />
            Delete Studio…
          </button>
        </div>
      </details>

      {open ? (
        <div
          className={styles.dialogBackdrop}
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) close();
          }}
        >
          <section
            className={styles.deleteDialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-studio-title"
            aria-describedby="delete-studio-description"
          >
            <span className={styles.deleteDialogIcon} aria-hidden="true">
              <WarningAmberRoundedIcon />
            </span>
            <div>
              <span className={styles.eyebrow}>Permanent deletion</span>
              <h2 id="delete-studio-title">Delete this Studio?</h2>
              <p id="delete-studio-description">
                The Studio record and every uploaded S3 file tied to it will
                be permanently removed. If storage cleanup fails, the Studio
                record will be kept so the deletion can be retried safely.
              </p>
            </div>
            <div className={styles.deleteSummary}>
              <span>Studio</span>
              <strong>{episode.title}</strong>
              <span>Stored files</span>
              <strong>
                {assetCount}
                {assetBytes ? ` · ${formatBytes(assetBytes)}` : ''}
              </strong>
            </div>
            <label className={styles.deleteConfirmationField}>
              Type the exact title to continue
              <strong>{episode.title}</strong>
              <input
                ref={confirmationInputRef}
                value={confirmation}
                onChange={(event) => setConfirmation(event.target.value)}
                autoComplete="off"
              />
            </label>
            <label className={styles.deleteAssetConfirmation}>
              <input
                type="checkbox"
                checked={assetsConfirmed}
                onChange={(event) => setAssetsConfirmed(event.target.checked)}
              />
              I understand that all uploaded files will be permanently deleted
              from storage.
            </label>
            <div className={styles.deleteDialogActions}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={deleting}
                onClick={close}
              >
                Keep Studio
              </button>
              <button
                type="button"
                className={styles.dangerButton}
                disabled={
                  deleting || !confirmationMatches || !assetsConfirmed
                }
                onClick={() => onDelete?.({ confirmationTitle: confirmation })}
              >
                <DeleteOutlineRoundedIcon aria-hidden="true" />
                {deleting
                  ? 'Deleting files and Studio…'
                  : 'Permanently delete Studio'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
