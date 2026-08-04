import { useMemo, useState } from 'react';
import EpisodeStudioSettingsDrawer from './EpisodeStudioSettingsDrawer';
import PlainTextArea from './PlainTextArea';
import { EPISODE_PRODUCTION_BOARD_PHASES } from './EpisodeProductionBoard';
import styles from '../styles/EpisodeProductionTaskEditor.module.css';

const OWNER_TYPES = [
  { value: 'hosts', label: 'Host team' },
  { value: 'producer', label: 'Assigned producer' },
  { value: 'hosts_and_producer', label: 'Host team + producer' },
  { value: 'person', label: 'Specific teammate' },
];

const DEADLINE_DAY_OPTIONS = [30, 28, 21, 14, 10, 7, 5, 4, 3, 2, 1, 0];

function createDraft(task = {}, defaultPhaseId = '') {
  const daysBeforeAir = Number.isFinite(Number(task.days_before_air))
    ? Math.max(0, Math.trunc(Number(task.days_before_air)))
    : 10;

  return {
    label: String(task.label || ''),
    description: String(task.description || ''),
    phase:
      task.phase ||
      defaultPhaseId ||
      EPISODE_PRODUCTION_BOARD_PHASES[0].id,
    owner_type: task.owner_type || 'producer',
    assigned_person_ids: Array.isArray(task.assigned_person_ids)
      ? [...task.assigned_person_ids]
      : [],
    deadline_choice:
      task.due_date_overridden === true
        ? 'keep_fixed'
        : DEADLINE_DAY_OPTIONS.includes(daysBeforeAir)
          ? String(daysBeforeAir)
          : 'custom',
    days_before_air: String(daysBeforeAir),
    fixed_due_date: String(task.due_date || ''),
    required: task.required !== false,
    dependencies: Array.isArray(task.dependencies)
      ? [...task.dependencies]
      : [],
  };
}

function daysBeforeDate(dateValue, daysValue) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateValue || ''))) return '';
  const days = Number(daysValue);
  if (!Number.isInteger(days) || days < 0) return '';
  const date = new Date(`${dateValue}T12:00:00Z`);
  if (Number.isNaN(date.getTime())) return '';
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function formatLongDate(value) {
  if (!value) return '';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function phaseLabel(phaseId) {
  return (
    EPISODE_PRODUCTION_BOARD_PHASES.find((phase) => phase.id === phaseId)
      ?.label || 'Production'
  );
}

function ownerLabel(ownerType, assignedPersonIds, ownerOptions) {
  if (ownerType === 'person') {
    const selectedNames = ownerOptions
      .filter((person) => assignedPersonIds.includes(person.person_id))
      .map((person) => person.name);

    if (!selectedNames.length) return 'Choose a teammate';
    if (selectedNames.length === 1) return selectedNames[0];
    return `${selectedNames.length} teammates`;
  }

  return (
    OWNER_TYPES.find((option) => option.value === ownerType)?.label ||
    'Choose an owner'
  );
}

export default function EpisodeProductionTaskEditor({
  open,
  mode = 'create',
  task = null,
  tasks = [],
  defaultPhaseId = '',
  ownerOptions = [],
  airDate = '',
  hasAssignedProducer = true,
  saving = false,
  serverError = '',
  onClose,
  onSave,
}) {
  const [draft, setDraft] = useState(() =>
    createDraft(task || {}, defaultPhaseId)
  );
  const [validationError, setValidationError] = useState('');

  const availableDependencies = useMemo(
    () =>
      (Array.isArray(tasks) ? tasks : [])
        .filter(
          (candidate) =>
            candidate.task_id && candidate.task_id !== task?.task_id
        )
        .sort(
          (left, right) =>
            Number(left.sort_order || 0) - Number(right.sort_order || 0) ||
            String(left.label || '').localeCompare(String(right.label || ''))
        ),
    [task?.task_id, tasks]
  );
  const calculatedDueDate = daysBeforeDate(
    airDate,
    Number(draft.days_before_air)
  );
  const editing = mode === 'edit' && Boolean(task?.task_id);
  const selectedOwnerLabel = ownerLabel(
    draft.owner_type,
    draft.assigned_person_ids,
    ownerOptions
  );
  const deadlineDays = Number(draft.days_before_air);
  const hasValidDeadlineDays =
    Number.isInteger(deadlineDays) && deadlineDays >= 0 && deadlineDays <= 365;
  const deadlineRuleLabel =
    draft.deadline_choice === 'keep_fixed'
      ? 'Fixed deadline'
      : hasValidDeadlineDays
        ? deadlineDays === 0
          ? 'Air date'
          : `Day ${deadlineDays}`
        : 'Choose timing';
  const deadlineDetailLabel =
    draft.deadline_choice === 'keep_fixed'
      ? formatLongDate(draft.fixed_due_date) || 'Date unavailable'
      : hasValidDeadlineDays
        ? deadlineDays === 0
          ? 'Due when the episode airs'
          : `${deadlineDays} ${deadlineDays === 1 ? 'day' : 'days'} before air`
        : 'Enter a whole number from 0 to 365';
  const displayedDueDate =
    draft.deadline_choice === 'keep_fixed'
      ? draft.fixed_due_date
      : calculatedDueDate;

  function updateDraft(patch) {
    setDraft((current) => ({ ...current, ...patch }));
    setValidationError('');
  }

  function toggleDependency(taskId) {
    const selected = new Set(draft.dependencies);
    if (selected.has(taskId)) selected.delete(taskId);
    else if (selected.size >= 20) {
      setValidationError('Choose no more than 20 prerequisite tasks.');
      return;
    } else selected.add(taskId);
    updateDraft({ dependencies: [...selected] });
  }

  function toggleAssignee(personId) {
    const selected = new Set(draft.assigned_person_ids);
    if (selected.has(personId)) selected.delete(personId);
    else if (selected.size >= 8) {
      setValidationError('Choose no more than 8 accountable teammates.');
      return;
    } else selected.add(personId);
    updateDraft({ assigned_person_ids: [...selected] });
  }

  async function submit(event) {
    event.preventDefault();
    const label = draft.label.trim();
    const description = draft.description.trim();
    const daysBeforeAir = Number(draft.days_before_air);

    if (!label) {
      setValidationError('Add a clear task name before saving.');
      return;
    }
    if (!description) {
      setValidationError(
        'Add short instructions so the owner knows what completion means.'
      );
      return;
    }
    if (
      !EPISODE_PRODUCTION_BOARD_PHASES.some(
        (phase) => phase.id === draft.phase
      )
    ) {
      setValidationError('Choose where this task belongs on the board.');
      return;
    }
    if (
      draft.owner_type === 'producer' &&
      !hasAssignedProducer
    ) {
      setValidationError(
        'Assign a producer to the episode or choose another owner.'
      );
      return;
    }
    if (
      draft.owner_type === 'person' &&
      !draft.assigned_person_ids.length
    ) {
      setValidationError('Choose at least one teammate for this task.');
      return;
    }
    if (
      draft.deadline_choice !== 'keep_fixed' &&
      (!Number.isInteger(daysBeforeAir) ||
        daysBeforeAir < 0 ||
        daysBeforeAir > 365)
    ) {
      setValidationError(
        'Days before air must be a whole number from 0 to 365.'
      );
      return;
    }

    const definition = {
      label,
      description,
      phase: draft.phase,
      owner_type: draft.owner_type,
      assigned_person_ids:
        draft.owner_type === 'person' ? draft.assigned_person_ids : [],
      required: draft.required,
      dependencies: draft.dependencies,
    };
    if (draft.deadline_choice !== 'keep_fixed') {
      definition.days_before_air = Number.isInteger(daysBeforeAir)
        ? daysBeforeAir
        : 0;
      definition.due_date_overridden = false;
    }

    await onSave?.(definition, task);
  }

  return (
    <EpisodeStudioSettingsDrawer
      open={open}
      onClose={onClose}
      closeDisabled={saving}
      title={editing ? 'Edit production task' : 'Add production task'}
      description={
        editing
          ? 'Update the card details, owner, and deadline. After saving, drag the tile on the board to reposition it.'
          : 'Create a card with an owner and air-date deadline. Once it is on the board, drag the tile wherever it belongs.'
      }
      eyebrow="Production workflow"
      closeLabel={editing ? 'Close task editor' : 'Close new task form'}
      footer={
        <>
          <button
            type="button"
            className={styles.cancelButton}
            disabled={saving}
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            type="submit"
            form="production-task-editor-form"
            className={styles.saveButton}
            disabled={saving}
          >
            {saving ? 'Saving…' : editing ? 'Save task' : 'Add to board'}
          </button>
        </>
      }
    >
      <form
        id="production-task-editor-form"
        className={styles.form}
        onSubmit={submit}
      >
        <aside className={styles.taskPreview} aria-label="Task card summary">
          <div className={styles.previewTopline}>
            <span>Board card preview</span>
            <span
              className={styles.requirementBadge}
              data-required={draft.required ? 'true' : 'false'}
            >
              {draft.required ? 'Required' : 'Optional'}
            </span>
          </div>
          <strong className={styles.previewTitle}>
            {draft.label.trim() || 'Untitled production task'}
          </strong>
          <div className={styles.previewMeta}>
            <span>{phaseLabel(draft.phase)}</span>
            <span>{selectedOwnerLabel}</span>
            <span className={styles.previewDeadline}>{deadlineRuleLabel}</span>
          </div>
        </aside>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              01
            </span>
            <div>
              <span>Task details</span>
              <h3>Make the next action obvious</h3>
            </div>
          </div>

          <label className={styles.field}>
            <span className={styles.fieldHeading}>
              <span>Task name</span>
              <small>{draft.label.length}/180</small>
            </span>
            <input
              type="text"
              value={draft.label}
              maxLength="180"
              autoComplete="off"
              onChange={(event) => updateDraft({ label: event.target.value })}
            />
          </label>

          <label className={styles.field}>
            <span className={styles.fieldHeading}>
              <span>Instructions</span>
              <small>{draft.description.length}/1600</small>
            </span>
            <PlainTextArea
              value={draft.description}
              maxLength={1600}
              rows={5}
              onValueChange={(value) => updateDraft({ description: value })}
            />
            <small>
              Pasted checklists and line breaks stay intact. Drag the lower edge
              or expand the writing area when you need more room.
            </small>
          </label>

          <label className={styles.field}>
            <span>Board phase</span>
            <select
              value={draft.phase}
              onChange={(event) => updateDraft({ phase: event.target.value })}
            >
              {EPISODE_PRODUCTION_BOARD_PHASES.map((phase) => (
                <option key={phase.id} value={phase.id}>
                  {phase.label}
                </option>
              ))}
            </select>
            <small>
              This sets the starting column. After saving, drag the tile on the
              production board to move or reorder it.
            </small>
          </label>
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              02
            </span>
            <div>
              <span>Ownership</span>
              <h3>Choose who is accountable</h3>
            </div>
          </div>

          <label className={styles.field}>
            <span>Owner</span>
            <select
              value={draft.owner_type}
              onChange={(event) =>
                updateDraft({ owner_type: event.target.value })
              }
            >
              {OWNER_TYPES.map((option) => (
                <option
                  key={option.value}
                  value={option.value}
                  disabled={
                    option.value === 'producer' && !hasAssignedProducer
                  }
                >
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          {draft.owner_type === 'person' ? (
            <fieldset className={styles.ownerList}>
              <legend>Accountable teammates</legend>
              {ownerOptions.length ? (
                ownerOptions.map((person) => (
                  <label
                    key={person.person_id}
                    className={styles.checkRow}
                    data-selected={
                      draft.assigned_person_ids.includes(person.person_id)
                        ? 'true'
                        : 'false'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={draft.assigned_person_ids.includes(
                        person.person_id
                      )}
                      onChange={() => toggleAssignee(person.person_id)}
                    />
                    <span>
                      <strong>{person.name}</strong>
                      <small>
                        {person.account_active === false
                          ? 'Inactive account · retained for existing assignments only'
                          : 'Active host or producer'}
                      </small>
                    </span>
                  </label>
                ))
              ) : (
                <p className={styles.emptyDependencies}>
                  No eligible teammates are available.
                </p>
              )}
            </fieldset>
          ) : null}
        </section>

        <section className={styles.section}>
          <div className={styles.sectionHeading}>
            <span className={styles.sectionNumber} aria-hidden="true">
              03
            </span>
            <div>
              <span>Deadline</span>
              <h3>Connect the card to the air date</h3>
            </div>
          </div>

          <div className={styles.deadlineComposer}>
            <div className={styles.deadlineSummary} aria-live="polite">
              <span>Air-date rule</span>
              <strong>{deadlineRuleLabel}</strong>
              <small>{deadlineDetailLabel}</small>
            </div>

            <label className={`${styles.field} ${styles.deadlineField}`}>
              <span>Deadline timing</span>
              <select
                value={draft.deadline_choice}
                onChange={(event) => {
                  const choice = event.target.value;
                  updateDraft({
                    deadline_choice: choice,
                    ...(DEADLINE_DAY_OPTIONS.includes(Number(choice))
                      ? { days_before_air: choice }
                      : null),
                  });
                }}
              >
                {draft.deadline_choice === 'keep_fixed' ? (
                  <option value="keep_fixed">
                    Keep fixed date — {formatLongDate(draft.fixed_due_date)}
                  </option>
                ) : null}
                {DEADLINE_DAY_OPTIONS.map((days) => (
                  <option key={days} value={String(days)}>
                    {days === 0
                      ? 'Day 0 · Air date'
                      : `Day ${days} · ${days} ${days === 1 ? 'day' : 'days'} before air`}
                  </option>
                ))}
                <option value="custom">Custom number of days…</option>
              </select>
            </label>
          </div>

          {draft.deadline_choice === 'custom' ? (
            <label className={styles.field}>
              <span>Custom days before air</span>
              <input
                type="number"
                min="0"
                max="365"
                step="1"
                inputMode="numeric"
                value={draft.days_before_air}
                onChange={(event) =>
                  updateDraft({
                    days_before_air: event.target.value,
                  })
                }
              />
            </label>
          ) : null}

          <div
            className={styles.calculatedDate}
            data-available={displayedDueDate ? 'true' : 'false'}
          >
            <span>Calculated due date</span>
            <strong>
              {draft.deadline_choice === 'keep_fixed'
                ? formatLongDate(draft.fixed_due_date) || 'Date unavailable'
                : calculatedDueDate
                  ? formatLongDate(calculatedDueDate)
                  : 'Waiting for an air date'}
            </strong>
            <small>
              {draft.deadline_choice === 'keep_fixed'
                ? 'Select a Day rule above to reconnect this task to the episode air date.'
                : calculatedDueDate
                  ? 'The board will keep the date aligned and count down automatically.'
                  : 'Once the episode has an air date, this updates automatically.'}
            </small>
          </div>

          <label
            className={`${styles.checkRow} ${styles.releaseRequirement}`}
            data-selected={draft.required ? 'true' : 'false'}
          >
            <input
              type="checkbox"
              checked={draft.required}
              onChange={(event) =>
                updateDraft({ required: event.target.checked })
              }
            />
            <span>
              <strong>Required for release</strong>
              <small>
                If this task is late and unfinished, the episode automatically
                goes off track.
              </small>
            </span>
          </label>
        </section>

        <details className={styles.advancedSection}>
          <summary className={styles.advancedSummary}>
            <span className={styles.advancedSummaryIcon} aria-hidden="true">
              ↳
            </span>
            <span className={styles.advancedSummaryText}>
              <strong>Advanced: blocking tasks</strong>
              <small>
                {draft.dependencies.length
                  ? `${draft.dependencies.length} ${
                      draft.dependencies.length === 1 ? 'blocker' : 'blockers'
                    } selected`
                  : 'Optional · no blockers selected'}
              </small>
            </span>
            <span className={styles.advancedChevron} aria-hidden="true">
              +
            </span>
          </summary>

          <div className={styles.advancedBody}>
            <p className={styles.advancedExplanation}>
              Board order is changed by dragging tiles after creation. Only add
              a blocker when this task truly cannot begin until another task is
              complete.
            </p>

            {availableDependencies.length ? (
              <fieldset className={styles.dependencyList}>
                <legend>Tasks that must be completed first</legend>
                {availableDependencies.map((candidate) => (
                  <label
                    key={candidate.task_id}
                    className={`${styles.checkRow} ${styles.dependencyRow}`}
                    data-selected={
                      draft.dependencies.includes(candidate.task_id)
                        ? 'true'
                        : 'false'
                    }
                  >
                    <input
                      type="checkbox"
                      checked={draft.dependencies.includes(candidate.task_id)}
                      onChange={() => toggleDependency(candidate.task_id)}
                    />
                    <span>
                      <strong>{candidate.label}</strong>
                      <small>{phaseLabel(candidate.phase)}</small>
                    </span>
                  </label>
                ))}
              </fieldset>
            ) : (
              <p className={styles.emptyDependencies}>
                There are no other tasks available to use as blockers.
              </p>
            )}
          </div>
        </details>

        {editing ? (
          <p className={styles.auditNote}>
            Editing this definition keeps the task’s notes, evidence, progress,
            and completion history intact.
          </p>
        ) : null}

        {validationError || serverError ? (
          <p className={styles.error} role="alert">
            {validationError || serverError}
          </p>
        ) : null}
      </form>
    </EpisodeStudioSettingsDrawer>
  );
}
