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
  const deletionPending = Boolean(episode?.deleted_at);

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
            <strong>
              {deletionPending
                ? 'Finish deleting this Episode Studio'
                : 'Delete this Episode Studio'}
            </strong>
            <p>
              {deletionPending
                ? 'The Studio is locked while previously issued upload links expire. Automatic cleanup will keep rechecking private storage; you can also return after the displayed safety window to finish now.'
                : `Permanently remove the Studio and all ${assetCount} ${
                    assetCount === 1 ? 'file' : 'files'
                  } stored for it${
                    assetBytes ? ` (${formatBytes(assetBytes)})` : ''
                  }. This cannot be undone.`}
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
            {deletionPending ? 'Finish deletion…' : 'Delete Studio…'}
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
                {deletionPending
                  ? 'Finish the protected storage sweep after all previously issued upload links have expired. A minimal cleanup marker temporarily retains the episode storage identifier, which may contain words from an older episode title, so automatic sweeps can remove any transfer already underway. It is normally purged within 30 days; questionnaire answers, notes, files, assignments, and the full title are removed sooner.'
                  : 'Deletion first locks the Studio until every previously issued upload link expires. After the safety window, the active Studio and questionnaire are removed. A minimal marker temporarily keeps the storage identifier, which may contain words from an older title, while automatic storage checks continue; it is normally purged within 30 days.'}
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
                  ? deletionPending
                    ? 'Finishing protected deletion…'
                    : 'Locking Studio for deletion…'
                  : deletionPending
                    ? 'Finish permanent deletion'
                    : 'Start protected deletion'}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </>
  );
}
