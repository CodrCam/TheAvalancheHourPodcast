import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import EpisodeStudioSettingsDrawer from './EpisodeStudioSettingsDrawer';
import styles from '../styles/EpisodeProductionWorkDrawer.module.css';

const COMPLETE_STATUSES = new Set(['complete', 'waived']);

function formatDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function localDateKey(date = new Date()) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(
    2,
    '0'
  )}-${String(date.getDate()).padStart(2, '0')}`;
}

function dueCountdown(value, complete) {
  if (complete) return 'Completed';
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value || ''))) return 'No countdown';
  const due = new Date(`${value}T00:00:00Z`);
  const today = new Date(`${localDateKey()}T00:00:00Z`);
  const difference = Math.round((due.getTime() - today.getTime()) / 86400000);
  if (difference === 0) return 'Due today';
  if (difference === 1) return '1 day to go';
  if (difference > 1) return `${difference} days to go`;
  if (difference === -1) return '1 day overdue';
  return `${Math.abs(difference)} days overdue`;
}

function taskStatus(task = {}, context = {}) {
  if (context.overdue) return { label: 'Overdue', tone: 'overdue' };
  if (COMPLETE_STATUSES.has(task.status)) {
    return task.status === 'waived'
      ? { label: 'Waived', tone: 'complete' }
      : { label: 'Complete', tone: 'complete' };
  }
  if (context.dependenciesComplete === false) {
    return { label: 'Waiting', tone: 'waiting' };
  }
  if (task.status === 'in_progress') {
    return { label: 'In progress', tone: 'active' };
  }
  return { label: 'Ready to start', tone: 'ready' };
}

export default function EpisodeProductionWorkDrawer({
  open,
  task = {},
  context = {},
  phaseLabel = 'Production task',
  ownerLabel = 'Not assigned',
  canEditDefinition = false,
  saving = false,
  actions = null,
  onEditDefinition,
  onClose,
  children,
}) {
  const complete = COMPLETE_STATUSES.has(task.status);
  const status = taskStatus(task, context);

  return (
    <EpisodeStudioSettingsDrawer
      open={open}
      eyebrow={phaseLabel}
      title={task.label || 'Production task'}
      description={
        task.description ||
        'Keep the work, evidence, and handoff details together for this step.'
      }
      closeLabel={`Close ${task.label || 'production task'}`}
      closeDisabled={saving}
      onClose={onClose}
      footer={
        <div className={styles.footerActions}>
          {actions ? <div className={styles.statusActions}>{actions}</div> : null}
          {canEditDefinition ? (
            <button
              type="button"
              className={styles.editButton}
              disabled={saving}
              onClick={onEditDefinition}
            >
              <EditRoundedIcon aria-hidden="true" />
              Edit setup
            </button>
          ) : null}
          <button
            type="button"
            className={styles.doneButton}
            disabled={saving}
            onClick={onClose}
          >
            Done
          </button>
        </div>
      }
    >
      <div className={styles.metaStrip}>
        <div>
          <span className={styles.metaIcon} data-tone={status.tone}>
            <span aria-hidden="true" />
          </span>
          <span>
            <small>Status</small>
            <strong>{status.label}</strong>
          </span>
        </div>
        <div>
          <span className={styles.metaIcon}>
            <PersonRoundedIcon aria-hidden="true" />
          </span>
          <span>
            <small>Owner</small>
            <strong>{ownerLabel}</strong>
          </span>
        </div>
        <div>
          <span className={styles.metaIcon}>
            <CalendarMonthRoundedIcon aria-hidden="true" />
          </span>
          <span>
            <small>Due {formatDate(task.due_date)}</small>
            <strong data-overdue={context.overdue ? 'true' : 'false'}>
              {dueCountdown(task.due_date, complete)}
            </strong>
          </span>
        </div>
      </div>

      <div className={styles.workArea}>{children}</div>
    </EpisodeStudioSettingsDrawer>
  );
}
