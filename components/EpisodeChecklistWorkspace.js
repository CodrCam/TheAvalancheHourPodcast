import { useId, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowDownwardRoundedIcon from '@mui/icons-material/ArrowDownwardRounded';
import ArrowUpwardRoundedIcon from '@mui/icons-material/ArrowUpwardRounded';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import DoneRoundedIcon from '@mui/icons-material/DoneRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import styles from '../styles/EpisodeChecklistWorkspace.module.css';

export const EPISODE_CHECKLIST_MODES = {
  VIEW: 'view',
  CUSTOMIZE: 'customize',
};

function normalizeCount(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 0;
}

function renderSlot(slot, context) {
  return typeof slot === 'function' ? slot(context) : slot;
}

/**
 * Separates the host response experience from producer checklist setup.
 * Business logic and individual response fields stay with the parent through
 * the `renderView` and `renderBuilder` slots.
 */
export default function EpisodeChecklistWorkspace({
  id,
  eyebrow = 'Host production form',
  title = 'Assemble the episode',
  description =
    'Complete each requirement with the exact copy, links, and files the producer needs.',
  remainingCount = 0,
  totalCount,
  canCustomize = false,
  customizationLocked = false,
  customizationLockedReason = '',
  mode: controlledMode,
  defaultMode = EPISODE_CHECKLIST_MODES.VIEW,
  onModeChange,
  onAddRequirement,
  addDisabled = false,
  addDisabledReason = '',
  onSave,
  saveDisabled = false,
  saveDisabledReason = '',
  saving = false,
  dirty = false,
  onDone,
  renderView,
  renderBuilder,
  children,
  viewGuidance,
  builderGuidance,
  lockNotice,
  className = '',
}) {
  const generatedId = useId();
  const [internalMode, setInternalMode] = useState(
    defaultMode === EPISODE_CHECKLIST_MODES.CUSTOMIZE
      ? EPISODE_CHECKLIST_MODES.CUSTOMIZE
      : EPISODE_CHECKLIST_MODES.VIEW
  );
  const requestedMode = controlledMode ?? internalMode;
  const mode =
    canCustomize &&
    !customizationLocked &&
    requestedMode === EPISODE_CHECKLIST_MODES.CUSTOMIZE
      ? EPISODE_CHECKLIST_MODES.CUSTOMIZE
      : EPISODE_CHECKLIST_MODES.VIEW;
  const headingId = id || `episode-checklist-heading-${generatedId}`;
  const customizeHelpId = `${headingId}-customize-help`;
  const addHelpId = `${headingId}-add-help`;
  const saveHelpId = `${headingId}-save-help`;
  const normalizedRemainingCount = normalizeCount(remainingCount);
  const normalizedTotalCount =
    totalCount === undefined ? null : normalizeCount(totalCount);
  const context = {
    mode,
    isViewMode: mode === EPISODE_CHECKLIST_MODES.VIEW,
    isCustomizeMode: mode === EPISODE_CHECKLIST_MODES.CUSTOMIZE,
  };

  function requestMode(nextMode, event) {
    if (
      nextMode === EPISODE_CHECKLIST_MODES.CUSTOMIZE &&
      (!canCustomize || customizationLocked)
    ) {
      return;
    }

    if (controlledMode === undefined) setInternalMode(nextMode);
    onModeChange?.(nextMode, event);
  }

  function finishCustomizing(event) {
    const result = onDone?.(event);
    if (result === false) return;
    requestMode(EPISODE_CHECKLIST_MODES.VIEW, event);
  }

  const rootClassName = [
    styles.workspace,
    mode === EPISODE_CHECKLIST_MODES.CUSTOMIZE
      ? styles.customizeMode
      : styles.viewMode,
    className,
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <section
      className={rootClassName}
      aria-labelledby={headingId}
      data-mode={mode}
    >
      <header className={styles.header}>
        <div className={styles.headingCopy}>
          <span className={styles.eyebrow}>{eyebrow}</span>
          <h2 id={headingId}>{title}</h2>
          <p>{description}</p>
        </div>

        <div className={styles.headerActions}>
          <p className={styles.completionStatus} role="status">
            <strong>{normalizedRemainingCount}</strong>
            <span>
              required {normalizedRemainingCount === 1 ? 'item' : 'items'}
              {normalizedRemainingCount === 1 ? ' remains' : ' remain'}
              {normalizedTotalCount === null
                ? ''
                : ` out of ${normalizedTotalCount}`}
            </span>
          </p>

          {canCustomize && mode === EPISODE_CHECKLIST_MODES.VIEW ? (
            <div className={styles.customizeControl}>
              <button
                type="button"
                className={styles.secondaryButton}
                disabled={customizationLocked}
                aria-describedby={
                  customizationLocked && customizationLockedReason
                    ? customizeHelpId
                    : undefined
                }
                onClick={(event) =>
                  requestMode(EPISODE_CHECKLIST_MODES.CUSTOMIZE, event)
                }
              >
                <EditRoundedIcon aria-hidden="true" />
                Customize checklist
              </button>
              {customizationLocked && customizationLockedReason ? (
                <small id={customizeHelpId} className={styles.disabledReason}>
                  {customizationLockedReason}
                </small>
              ) : null}
            </div>
          ) : null}
        </div>
      </header>

      {lockNotice ? <div className={styles.lockNotice}>{lockNotice}</div> : null}

      {mode === EPISODE_CHECKLIST_MODES.CUSTOMIZE ? (
        <>
          <div className={styles.modeNotice} role="status">
            <div>
              <strong>Customize checklist</strong>
              <span>
                Edit the requirements hosts will see. Host responses and files
                stay out of this setup view.
              </span>
            </div>
            {dirty ? <em>Unsaved checklist changes</em> : null}
          </div>

          <div
            className={styles.builderToolbar}
            role="toolbar"
            aria-label="Checklist customization actions"
          >
            <div className={styles.toolbarCopy}>
              <strong>Checklist requirements</strong>
              <span>Add, reorder, or revise the host-facing steps.</span>
            </div>
            <div className={styles.toolbarActions}>
              <div className={styles.toolbarControl}>
                <button
                  type="button"
                  className={styles.secondaryButton}
                  disabled={addDisabled || typeof onAddRequirement !== 'function'}
                  aria-describedby={
                    addDisabled && addDisabledReason ? addHelpId : undefined
                  }
                  onClick={onAddRequirement}
                >
                  <AddRoundedIcon aria-hidden="true" />
                  Add requirement
                </button>
                {addDisabled && addDisabledReason ? (
                  <small id={addHelpId} className={styles.disabledReason}>
                    {addDisabledReason}
                  </small>
                ) : null}
              </div>

              <div className={styles.toolbarControl}>
                <button
                  type="button"
                  className={styles.primaryButton}
                  disabled={
                    saving ||
                    saveDisabled ||
                    typeof onSave !== 'function'
                  }
                  aria-describedby={
                    saveDisabled && saveDisabledReason ? saveHelpId : undefined
                  }
                  onClick={onSave}
                >
                  <SaveRoundedIcon aria-hidden="true" />
                  {saving ? 'Saving…' : 'Save checklist'}
                </button>
                {saveDisabled && saveDisabledReason ? (
                  <small id={saveHelpId} className={styles.disabledReason}>
                    {saveDisabledReason}
                  </small>
                ) : null}
              </div>

              <button
                type="button"
                className={styles.doneButton}
                onClick={finishCustomizing}
              >
                <DoneRoundedIcon aria-hidden="true" />
                Done
              </button>
            </div>
          </div>

          {builderGuidance ? (
            <div className={styles.guidance}>{builderGuidance}</div>
          ) : null}

          <div className={styles.builderContent}>
            {renderSlot(renderBuilder ?? children, context)}
          </div>
        </>
      ) : (
        <>
          {viewGuidance ? (
            <div className={styles.guidance}>{viewGuidance}</div>
          ) : null}
          <div className={styles.viewContent}>
            {renderSlot(renderView ?? children, context)}
          </div>
        </>
      )}
    </section>
  );
}

export function EpisodeChecklistBuilderList({
  children,
  emptyMessage = 'No checklist requirements yet.',
  ariaLabel = 'Checklist requirements',
}) {
  const hasChildren = Array.isArray(children)
    ? children.some(Boolean)
    : Boolean(children);

  return (
    <div className={styles.builderList} aria-label={ariaLabel}>
      {hasChildren ? (
        children
      ) : (
        <p className={styles.emptyBuilder}>{emptyMessage}</p>
      )}
    </div>
  );
}

/**
 * Compact shell for one requirement. Pass its form controls as `children`.
 */
export function EpisodeChecklistBuilderRow({
  id,
  index = 0,
  title = '',
  required = false,
  responseTypeLabel = '',
  children,
  onMoveUp,
  onMoveDown,
  onRemove,
  moveUpDisabled = false,
  moveDownDisabled = false,
  removeDisabled = false,
  actions,
}) {
  const position = normalizeCount(index) + 1;
  const safeTitle = String(title || '').trim() || `Requirement ${position}`;

  return (
    <article
      id={id}
      className={styles.builderRow}
      data-required={required ? 'true' : 'false'}
      aria-label={`${safeTitle} checklist requirement`}
    >
      <header className={styles.builderRowHeader}>
        <span className={styles.rowNumber} aria-hidden="true">
          {String(position).padStart(2, '0')}
        </span>
        <div>
          <span>Host-facing requirement</span>
          <h3>{safeTitle}</h3>
          {responseTypeLabel ? <small>{responseTypeLabel}</small> : null}
        </div>
        <span className={styles.requirementPill}>
          {required ? 'Required' : 'Optional'}
        </span>
      </header>

      <div className={styles.builderRowFields}>{children}</div>

      <footer className={styles.builderRowFooter}>
        <div
          className={styles.reorderActions}
          role="group"
          aria-label={`Reorder ${safeTitle}`}
        >
          <button
            type="button"
            disabled={moveUpDisabled || typeof onMoveUp !== 'function'}
            aria-label={`Move ${safeTitle} up`}
            onClick={onMoveUp}
          >
            <ArrowUpwardRoundedIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            disabled={moveDownDisabled || typeof onMoveDown !== 'function'}
            aria-label={`Move ${safeTitle} down`}
            onClick={onMoveDown}
          >
            <ArrowDownwardRoundedIcon aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.removeButton}
            disabled={removeDisabled || typeof onRemove !== 'function'}
            aria-label={`Remove ${safeTitle}`}
            onClick={onRemove}
          >
            <DeleteOutlineRoundedIcon aria-hidden="true" />
          </button>
        </div>
        {actions ? <div className={styles.rowActions}>{actions}</div> : null}
      </footer>
    </article>
  );
}
