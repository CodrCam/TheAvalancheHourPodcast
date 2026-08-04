import { useId } from 'react';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import LinkRoundedIcon from '@mui/icons-material/LinkRounded';
import SaveRoundedIcon from '@mui/icons-material/SaveRounded';
import PlainTextArea from './PlainTextArea';
import styles from '../styles/EpisodeProductionTaskWorkspace.module.css';

const COMPLETE_STATUSES = new Set(['complete', 'completed', 'waived']);

function renderSlot(slot, context) {
  return typeof slot === 'function' ? slot(context) : slot;
}

function humanize(value = '') {
  const normalized = String(value || '')
    .trim()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ');
  return normalized
    ? `${normalized.charAt(0).toUpperCase()}${normalized.slice(1)}`
    : '';
}

function isHttpsUrl(value = '') {
  const source = String(value || '').trim();
  if (!source) return true;
  try {
    return new URL(source).protocol === 'https:';
  } catch {
    return false;
  }
}

function normalizeDependency(item, index, overallComplete) {
  if (typeof item === 'string') {
    return {
      id: item || `dependency-${index + 1}`,
      label: humanize(item) || `Dependency ${index + 1}`,
      state: overallComplete ? 'complete' : 'waiting',
    };
  }

  const value = item && typeof item === 'object' ? item : {};
  const status = String(value.status || '').toLowerCase();
  const complete =
    value.complete === true ||
    value.completed === true ||
    COMPLETE_STATUSES.has(status);
  return {
    id: value.id || value.task_id || `dependency-${index + 1}`,
    label:
      value.label ||
      value.title ||
      humanize(value.id || value.task_id) ||
      `Dependency ${index + 1}`,
    state: complete ? 'complete' : status === 'in_progress' ? 'active' : 'waiting',
  };
}

function normalizeRequirement(item, index, packageHref) {
  const value =
    item && typeof item === 'object'
      ? item
      : { id: String(item || ''), label: humanize(item) };
  const id = value.id || value.deliverable_id || `requirement-${index + 1}`;
  const baseHref = String(packageHref || '').replace(/#.*$/, '');
  const href =
    value.href ||
    (baseHref && id
      ? `${baseHref}#deliverable-${encodeURIComponent(id)}`
      : '');
  const status = String(value.status || '').toLowerCase();
  const complete =
    value.complete === true ||
    value.completed === true ||
    COMPLETE_STATUSES.has(status);

  return {
    ...value,
    id,
    href,
    label: value.label || value.title || humanize(id) || 'Package requirement',
    complete,
  };
}

function defaultFormatDateTime(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function auditValue(audit, camelKey, snakeKey, task) {
  if (Object.prototype.hasOwnProperty.call(audit, camelKey)) {
    return audit[camelKey];
  }
  if (Object.prototype.hasOwnProperty.call(audit, snakeKey)) {
    return audit[snakeKey];
  }
  return task?.[snakeKey] || '';
}

/**
 * Compact, controlled detail workspace intended for an expanded production
 * board card. Persistence and workflow decisions stay with the parent.
 */
export default function EpisodeProductionTaskWorkspace({
  task = {},
  context = {},
  workingNote,
  evidenceUrl,
  canEditDetails,
  saving = false,
  saveDisabled = false,
  onWorkingNoteChange,
  onEvidenceUrlChange,
  onSaveDetails,
  noteLabel = 'Working note',
  noteHelp =
    'Keep handoff context, decisions, or the next useful action with this step.',
  noteMaxLength = 2400,
  evidenceLabel = 'Evidence or source link',
  evidenceHelp =
    'Optional. Link to the approved source, proof, scheduled item, or handoff using HTTPS.',
  evidenceUrlRequired = false,
  evidenceUrlError = '',
  packageRequirements,
  packageHref = '',
  onRequirementNavigate,
  dependencies,
  dependenciesComplete,
  audit = {},
  formatDateTime = defaultFormatDateTime,
  renderDeadlineControl,
  renderOwnerControl,
  renderManagerControls,
  managerControls,
  children,
  saveLabel = 'Save details',
  statusMessage = '',
  ariaLabel,
  className = '',
}) {
  const generatedId = useId();
  const baseId = `production-task-workspace-${generatedId}`;
  const noteId = `${baseId}-note`;
  const noteHelpId = `${baseId}-note-help`;
  const noteCountId = `${baseId}-note-count`;
  const evidenceId = `${baseId}-evidence`;
  const evidenceHelpId = `${baseId}-evidence-help`;
  const evidenceErrorId = `${baseId}-evidence-error`;
  const deadlineId = `${baseId}-deadline`;
  const ownerId = `${baseId}-owner`;
  const noteValue = String(
    workingNote === undefined ? task.evidence_note || '' : workingNote || ''
  );
  const evidenceValue = String(
    evidenceUrl === undefined ? task.evidence_url || '' : evidenceUrl || ''
  );
  const explicitCanEdit =
    canEditDetails === undefined ? context.canUpdate === true : canEditDetails;
  const canEdit = explicitCanEdit === true;
  const noteEditable = canEdit && typeof onWorkingNoteChange === 'function';
  const evidenceEditable =
    canEdit && typeof onEvidenceUrlChange === 'function';
  const resolvedDependenciesComplete =
    dependenciesComplete === undefined
      ? context.dependenciesComplete !== false
      : dependenciesComplete !== false;
  const dependencySource = Array.isArray(dependencies)
    ? dependencies
    : Array.isArray(context.dependencyLabels)
      ? context.dependencyLabels
      : Array.isArray(task.dependencies)
        ? task.dependencies
        : [];
  const dependencyItems = dependencySource.map((item, index) =>
    normalizeDependency(item, index, resolvedDependenciesComplete)
  );
  const requirementSource = Array.isArray(packageRequirements)
    ? packageRequirements
    : Array.isArray(task.linked_deliverable_ids)
      ? task.linked_deliverable_ids
      : [];
  const requirementItems = requirementSource.map((item, index) =>
    normalizeRequirement(item, index, packageHref)
  );
  const computedEvidenceError = evidenceValue.trim()
    ? isHttpsUrl(evidenceValue)
      ? ''
      : 'Use a full HTTPS URL.'
    : evidenceUrlRequired
      ? 'Add an HTTPS URL before saving.'
      : '';
  const visibleEvidenceError = evidenceUrlError || computedEvidenceError;
  const canSave =
    canEdit &&
    !saving &&
    !saveDisabled &&
    !visibleEvidenceError &&
    typeof onSaveDetails === 'function';
  const controlContext = {
    task,
    context,
    disabled: saving,
    canEditDetails: canEdit,
    ids: {
      deadline: deadlineId,
      owner: ownerId,
    },
  };
  const deadlineControl = renderSlot(renderDeadlineControl, controlContext);
  const ownerControl = renderSlot(renderOwnerControl, controlContext);
  const customManagerControls = renderSlot(
    renderManagerControls || managerControls,
    controlContext
  );
  const extraContent = renderSlot(children, controlContext);
  const taskAudit = audit && typeof audit === 'object' ? audit : {};
  const auditStatus = String(taskAudit.status || task.status || '').toLowerCase();
  const completedAt = auditValue(
    taskAudit,
    'completedAt',
    'completed_at',
    task
  );
  const completedBy = auditValue(
    taskAudit,
    'completedBy',
    'completed_by_name',
    task
  );
  const updatedAt = auditValue(taskAudit, 'updatedAt', 'updated_at', task);
  const updatedBy = auditValue(
    taskAudit,
    'updatedBy',
    'updated_by_name',
    task
  );
  const hasAudit = Boolean(
    auditStatus || completedAt || completedBy || updatedAt || updatedBy
  );

  function changeEvidence(event) {
    onEvidenceUrlChange?.(event.target.value, event);
  }

  function saveDetails(event) {
    event.preventDefault();
    if (!canSave) return;
    onSaveDetails(
      {
        evidence_note: noteValue,
        evidence_url: evidenceValue.trim(),
      },
      event,
      task
    );
  }

  return (
    <section
      className={`${styles.workspace}${className ? ` ${className}` : ''}`}
      aria-label={
        ariaLabel || `${task.label || 'Production step'} details workspace`
      }
    >
      {dependencyItems.length ? (
        <section className={styles.compactSection} aria-label="Dependencies">
          <div className={styles.sectionHeading}>
            <strong>Dependencies</strong>
            <span>
              {resolvedDependenciesComplete ? 'Ready' : 'Waiting'}
            </span>
          </div>
          <ul className={styles.chipList}>
            {dependencyItems.map((dependency) => (
              <li
                key={dependency.id}
                className={styles.dependencyChip}
                data-state={dependency.state}
              >
                {dependency.state === 'complete' ? (
                  <CheckRoundedIcon aria-hidden="true" />
                ) : (
                  <span className={styles.statusDot} aria-hidden="true" />
                )}
                {dependency.label}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {requirementItems.length ? (
        <section
          className={styles.compactSection}
          aria-label="Linked package requirements"
        >
          <div className={styles.sectionHeading}>
            <strong>Package requirements</strong>
            <span>{requirementItems.length} linked</span>
          </div>
          <ul className={styles.requirementList}>
            {requirementItems.map((requirement) => (
              <li key={requirement.id} data-complete={requirement.complete}>
                {requirement.href ? (
                  <a
                    href={requirement.href}
                    target={requirement.target}
                    rel={
                      requirement.target === '_blank'
                        ? 'noreferrer'
                        : undefined
                    }
                    onClick={(event) =>
                      onRequirementNavigate?.(requirement, event)
                    }
                  >
                    <LinkRoundedIcon aria-hidden="true" />
                    <span>{requirement.label}</span>
                    {requirement.complete ? (
                      <CheckRoundedIcon aria-label="Complete" />
                    ) : null}
                  </a>
                ) : (
                  <span>
                    <LinkRoundedIcon aria-hidden="true" />
                    {requirement.label}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {deadlineControl || ownerControl || customManagerControls ? (
        <section
          className={styles.managerControls}
          aria-label="Manager task settings"
        >
          {deadlineControl}
          {ownerControl}
          {customManagerControls}
        </section>
      ) : null}

      {extraContent ? (
        <div className={styles.extraContent}>{extraContent}</div>
      ) : null}

      <form className={styles.detailsForm} onSubmit={saveDetails} noValidate>
        <label className={styles.field} htmlFor={noteId}>
          <span>{noteLabel}</span>
          {noteHelp ? <small id={noteHelpId}>{noteHelp}</small> : null}
          <PlainTextArea
            id={noteId}
            value={noteValue}
            maxLength={noteMaxLength}
            readOnly={!noteEditable}
            disabled={saving}
            aria-describedby={
              [noteHelp ? noteHelpId : '', noteCountId]
                .filter(Boolean)
                .join(' ') || undefined
            }
            onValueChange={onWorkingNoteChange}
          />
          <small id={noteCountId} className={styles.characterCount}>
            {noteValue.length.toLocaleString()} /{' '}
            {noteMaxLength.toLocaleString()}
          </small>
        </label>

        <label className={styles.field} htmlFor={evidenceId}>
          <span>{evidenceLabel}</span>
          {evidenceHelp ? <small id={evidenceHelpId}>{evidenceHelp}</small> : null}
          <div className={styles.urlField}>
            <LinkRoundedIcon aria-hidden="true" />
            <input
              id={evidenceId}
              type="url"
              inputMode="url"
              value={evidenceValue}
              pattern="https://.*"
              required={evidenceUrlRequired}
              readOnly={!evidenceEditable}
              disabled={saving}
              aria-invalid={visibleEvidenceError ? 'true' : undefined}
              aria-describedby={
                [
                  evidenceHelp ? evidenceHelpId : '',
                  visibleEvidenceError ? evidenceErrorId : '',
                ]
                  .filter(Boolean)
                  .join(' ') || undefined
              }
              onChange={changeEvidence}
            />
          </div>
          {visibleEvidenceError ? (
            <small id={evidenceErrorId} className={styles.fieldError} role="alert">
              {visibleEvidenceError}
            </small>
          ) : null}
          {isHttpsUrl(evidenceValue) && evidenceValue.trim() ? (
            <a
              className={styles.openEvidence}
              href={evidenceValue.trim()}
              target="_blank"
              rel="noreferrer"
            >
              Open saved link
            </a>
          ) : null}
        </label>

        {typeof onSaveDetails === 'function' ? (
          <div className={styles.formFooter}>
            <span className={styles.statusMessage} role="status" aria-live="polite">
              {statusMessage}
            </span>
            <button type="submit" disabled={!canSave}>
              <SaveRoundedIcon aria-hidden="true" />
              {saving ? 'Saving…' : saveLabel}
            </button>
          </div>
        ) : null}
      </form>

      {hasAudit ? (
        <details className={styles.audit} aria-label="Task activity details">
          <summary>
            <strong>Activity</strong>
            <span>
              {completedAt
                ? `Completed ${formatDateTime(completedAt)}`
                : updatedAt
                  ? `Updated ${formatDateTime(updatedAt)}`
                  : humanize(auditStatus)}
            </span>
          </summary>
          <dl>
            {auditStatus ? (
              <div>
                <dt>Status</dt>
                <dd>{humanize(auditStatus)}</dd>
              </div>
            ) : null}
            {completedBy ? (
              <div>
                <dt>{auditStatus === 'waived' ? 'Waived by' : 'Completed by'}</dt>
                <dd>{completedBy}</dd>
              </div>
            ) : null}
            {completedAt ? (
              <div>
                <dt>{auditStatus === 'waived' ? 'Waived' : 'Completed'}</dt>
                <dd>
                  <time dateTime={completedAt}>{formatDateTime(completedAt)}</time>
                </dd>
              </div>
            ) : null}
            {updatedBy ? (
              <div>
                <dt>Last saved by</dt>
                <dd>{updatedBy}</dd>
              </div>
            ) : null}
            {updatedAt ? (
              <div>
                <dt>Last saved</dt>
                <dd>
                  <time dateTime={updatedAt}>{formatDateTime(updatedAt)}</time>
                </dd>
              </div>
            ) : null}
          </dl>
        </details>
      ) : null}
    </section>
  );
}
