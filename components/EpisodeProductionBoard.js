import { useId, useMemo, useRef, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import DragIndicatorRoundedIcon from '@mui/icons-material/DragIndicatorRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import styles from '../styles/EpisodeProductionBoard.module.css';

export const EPISODE_PRODUCTION_BOARD_PHASES = [
  {
    id: 'host_preparation',
    label: 'Host preparation',
    shortLabel: 'Host prep',
    description: 'Guest, recording, intro, and show-notes handoff',
  },
  {
    id: 'producer_review',
    label: 'Producer review',
    shortLabel: 'Producer review',
    description: 'Private proof delivery and host approval',
  },
  {
    id: 'publishing',
    label: 'Publishing',
    shortLabel: 'Publishing',
    description: 'Final episode package and promotion scheduling',
  },
  {
    id: 'release_coordination',
    label: 'Release coordination',
    shortLabel: 'Release',
    description: 'Approved guest assets and release handoff',
  },
];

const COMPLETE_STATUSES = new Set(['complete', 'waived']);
const BOARD_FILTERS = [
  { id: 'all', label: 'All' },
  { id: 'open', label: 'Open' },
  { id: 'mine', label: 'Mine' },
  { id: 'overdue', label: 'Overdue' },
  { id: 'completed', label: 'Completed' },
];

function taskId(task = {}) {
  return task.task_id || task.id || '';
}

function taskIsComplete(task = {}) {
  return COMPLETE_STATUSES.has(task.status);
}

function defaultTaskIsOverdue(task = {}, today = '') {
  return (
    task.required !== false &&
    !taskIsComplete(task) &&
    /^\d{4}-\d{2}-\d{2}$/.test(String(task.due_date || '')) &&
    task.due_date < today
  );
}

function defaultOwnerLabel(task = {}) {
  if (task.owner_type === 'hosts') return 'Host team';
  if (task.owner_type === 'producer') return 'Producer';
  if (task.owner_type === 'hosts_and_producer') return 'Hosts + producer';
  if (task.owner_type === 'person') return 'Assigned teammate';
  return 'Not assigned';
}

function defaultDependenciesComplete(task = {}, tasks = []) {
  const dependencies = Array.isArray(task.dependencies)
    ? task.dependencies
    : [];
  return dependencies.every((dependencyId) =>
    tasks.some(
      (candidate) =>
        taskId(candidate) === dependencyId && taskIsComplete(candidate)
    )
  );
}

function defaultDependencyLabels(task = {}, tasks = []) {
  const dependencies = Array.isArray(task.dependencies)
    ? task.dependencies
    : [];
  return dependencies
    .map(
      (dependencyId) =>
        tasks.find((candidate) => taskId(candidate) === dependencyId)?.label
    )
    .filter(Boolean);
}

function formatDueDate(value) {
  if (!value) return 'Not scheduled';
  const date = new Date(`${value}T12:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

function getLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getCalendarDayDifference(value, today) {
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(String(value || '')) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(String(today || ''))
  ) {
    return null;
  }

  const dueDate = new Date(`${value}T00:00:00Z`);
  const currentDate = new Date(`${today}T00:00:00Z`);
  if (Number.isNaN(dueDate.getTime()) || Number.isNaN(currentDate.getTime())) {
    return null;
  }
  return Math.round((dueDate.getTime() - currentDate.getTime()) / 86400000);
}

function formatDueCountdown(value, today, complete) {
  if (complete) return 'Completed';
  const difference = getCalendarDayDifference(value, today);
  if (difference === null) return 'Date not set';
  if (difference === 0) return 'Due today';
  if (difference === 1) return '1 day to go';
  if (difference > 1) return `${difference} days to go`;
  if (difference === -1) return '1 day overdue';
  return `${Math.abs(difference)} days overdue`;
}

function defaultIsMyTask(task = {}, viewerId = '') {
  if (!viewerId) return false;
  const normalizedViewerId = String(viewerId);
  return [
    task.assignee_id,
    task.assigned_to,
    task.assigned_user_id,
    task.owner_id,
    task.owner_user_id,
  ].some((candidate) => String(candidate || '') === normalizedViewerId);
}

function getStatus(task, { complete, overdue, dependenciesComplete }) {
  if (overdue) return { key: 'overdue', label: 'Overdue' };
  if (complete) {
    return task.status === 'waived'
      ? { key: 'waived', label: 'Waived' }
      : { key: 'complete', label: 'Complete' };
  }
  if (!dependenciesComplete) return { key: 'waiting', label: 'Waiting' };
  if (task.status === 'in_progress') {
    return { key: 'in_progress', label: 'In progress' };
  }
  return { key: 'not_started', label: 'Not started' };
}

function normalizeDependencyLabels(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  if (typeof value === 'string' && value.trim()) return [value.trim()];
  return [];
}

function DefaultTaskActions({ task, context, onTaskAction }) {
  if (!context.canUpdate || !onTaskAction) return null;

  if (context.complete) {
    return (
      <button
        type="button"
        className={styles.secondaryAction}
        onClick={() => onTaskAction(task, 'reopen')}
      >
        Reopen step
      </button>
    );
  }

  return (
    <>
      {task.status === 'not_started' ? (
        <button
          type="button"
          className={styles.secondaryAction}
          disabled={!context.dependenciesComplete}
          onClick={() => onTaskAction(task, 'start')}
        >
          Start step
        </button>
      ) : null}
      <button
        type="button"
        className={styles.primaryAction}
        disabled={!context.dependenciesComplete}
        onClick={() => onTaskAction(task, 'complete')}
      >
        Mark complete
      </button>
    </>
  );
}

/**
 * Presentational four-phase board for an episode's production tasks.
 * Workflow-specific controls stay with the parent through the render callbacks.
 */
export default function EpisodeProductionBoard({
  productionTasks,
  production_tasks: productionTasksAlias,
  getOwnerLabel = defaultOwnerLabel,
  canUpdateTask = () => false,
  areDependenciesComplete = defaultDependenciesComplete,
  getDependencyLabels = defaultDependencyLabels,
  isTaskComplete = taskIsComplete,
  isTaskOverdue,
  onTaskAction,
  onOpenTask,
  canMoveTasks = false,
  onMoveTask,
  moveTaskDisabledReason = '',
  renderTaskActions,
  renderTaskDetails,
  canEditTasks = false,
  canAddTasks,
  onAddTask,
  onEditTask,
  renderAddTaskAction,
  renderEditTaskAction,
  addTaskLabel = 'Add task',
  editTaskLabel = 'Edit task',
  isMyTask,
  viewerId = '',
  getTaskSearchText,
  initialFilter = 'all',
  showMineFilter = true,
  initialPhase = EPISODE_PRODUCTION_BOARD_PHASES[0].id,
  emptyMessage = 'No steps in this phase yet.',
  ariaLabel = 'Episode production board',
  today = getLocalDateKey(),
}) {
  const pickerId = useId();
  const searchId = useId();
  const boardViewportRef = useRef(null);
  const draggedTaskIdRef = useRef('');
  const dragTargetRef = useRef(null);
  const validInitialPhase = EPISODE_PRODUCTION_BOARD_PHASES.some(
    (phase) => phase.id === initialPhase
  )
    ? initialPhase
    : EPISODE_PRODUCTION_BOARD_PHASES[0].id;
  const [activePhase, setActivePhase] = useState(validInitialPhase);
  const validInitialFilter = BOARD_FILTERS.some(
    (filter) => filter.id === initialFilter
  )
    ? initialFilter
    : 'all';
  const [activeFilter, setActiveFilter] = useState(validInitialFilter);
  const [searchQuery, setSearchQuery] = useState('');
  const [draggedTaskId, setDraggedTaskId] = useState('');
  const [dragTarget, setDragTarget] = useState(null);
  const [moveControl, setMoveControl] = useState(null);
  const [moveAnnouncement, setMoveAnnouncement] = useState('');
  const opensTaskWorkspace = typeof onOpenTask === 'function';
  const tasks = useMemo(
    () => {
      const sourceTasks = Array.isArray(productionTasks)
        ? productionTasks
        : Array.isArray(productionTasksAlias)
          ? productionTasksAlias
          : [];
      return [...sourceTasks].sort(
        (left, right) =>
          Number(left.sort_order || 0) - Number(right.sort_order || 0)
      );
    },
    [productionTasks, productionTasksAlias]
  );
  const taskRecords = tasks.map((task) => {
    const complete = Boolean(isTaskComplete(task, tasks));
    const overdue = isTaskOverdue
      ? Boolean(isTaskOverdue(task, today))
      : defaultTaskIsOverdue(task, today);
    const dependenciesComplete = Boolean(
      areDependenciesComplete(task, tasks)
    );
    const dependencyLabels = normalizeDependencyLabels(
      getDependencyLabels(task, tasks)
    );
    const canUpdate = Boolean(canUpdateTask(task));
    const baseContext = {
      complete,
      overdue,
      canUpdate,
      dependenciesComplete,
      dependencyLabels,
      tasks,
    };
    const canEdit =
      typeof canEditTasks === 'function'
        ? Boolean(canEditTasks(task, baseContext))
        : Boolean(canEditTasks);
    const context = { ...baseContext, canEdit };
    const status = getStatus(task, context);
    const ownerLabel = getOwnerLabel(task) || 'Not assigned';
    const mine = isMyTask
      ? Boolean(isMyTask(task, { viewerId, ownerLabel, context }))
      : defaultIsMyTask(task, viewerId);
    const customSearchText = getTaskSearchText
      ? getTaskSearchText(task, { ownerLabel, status, context })
      : '';
    const searchText = [
      task.label,
      task.description,
      ownerLabel,
      status.label,
      task.due_date,
      ...dependencyLabels,
      customSearchText,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();

    return {
      task,
      complete,
      overdue,
      mine,
      context,
      status,
      ownerLabel,
      searchText,
    };
  });
  const normalizedSearchQuery = searchQuery.trim().toLocaleLowerCase();
  const filterCounts = {
    all: taskRecords.length,
    open: taskRecords.filter((record) => !record.complete).length,
    mine: taskRecords.filter((record) => record.mine).length,
    overdue: taskRecords.filter((record) => record.overdue).length,
    completed: taskRecords.filter((record) => record.complete).length,
  };
  const visibleTaskRecords = taskRecords.filter((record) => {
    const matchesSearch =
      !normalizedSearchQuery || record.searchText.includes(normalizedSearchQuery);
    const matchesFilter =
      activeFilter === 'all' ||
      (activeFilter === 'open' && !record.complete) ||
      (activeFilter === 'mine' && record.mine) ||
      (activeFilter === 'overdue' && record.overdue) ||
      (activeFilter === 'completed' && record.complete);
    return matchesSearch && matchesFilter;
  });
  const filterIsActive = activeFilter !== 'all' || Boolean(normalizedSearchQuery);
  const mineFilterAvailable = Boolean(isMyTask || viewerId);

  function taskMoveDisabledReason(record) {
    if (!record) return '';
    const reason =
      typeof moveTaskDisabledReason === 'function'
        ? moveTaskDisabledReason(record.task, record.context)
        : moveTaskDisabledReason;
    return String(reason || '').trim();
  }

  function taskHasMovePermission(record) {
    if (!onMoveTask || !record) return false;
    return typeof canMoveTasks === 'function'
      ? Boolean(canMoveTasks(record.task, record.context))
      : Boolean(canMoveTasks);
  }

  function taskCanMove(record) {
    return taskHasMovePermission(record) && !taskMoveDisabledReason(record);
  }

  const boardHasMovePermission = taskRecords.some(taskHasMovePermission);
  const boardCanMove = taskRecords.some(taskCanMove);
  const boardMoveDisabledReason = boardHasMovePermission
    ? taskRecords
        .filter(taskHasMovePermission)
        .map(taskMoveDisabledReason)
        .find(Boolean)
    : '';

  function canAddToPhase(phaseId) {
    return typeof canAddTasks === 'function'
      ? Boolean(
          canAddTasks({
            phaseId,
            phases: EPISODE_PRODUCTION_BOARD_PHASES,
            tasks,
          })
        )
      : canAddTasks === undefined
        ? typeof canEditTasks === 'boolean' && canEditTasks
        : Boolean(canAddTasks);
  }

  const canAdd = canAddToPhase(activePhase);

  function requestAddTask(phaseId = activePhase) {
    const phase = EPISODE_PRODUCTION_BOARD_PHASES.find(
      (candidate) => candidate.id === phaseId
    );
    onAddTask?.(phaseId, { phase, tasks });
  }

  function requestEditTask(task, context) {
    onEditTask?.(task, context);
  }

  function phaseTasksWithout(phaseId, excludedTaskId) {
    return tasks.filter(
      (task) => task.phase === phaseId && taskId(task) !== excludedTaskId
    );
  }

  function requestMoveTask(task, targetPhase, requestedIndex) {
    const movingTaskId = taskId(task);
    const destinationTasks = phaseTasksWithout(targetPhase, movingTaskId);
    const targetIndex = Math.max(
      0,
      Math.min(Number(requestedIndex) || 0, destinationTasks.length)
    );
    const sourceTaskIds = tasks
      .filter((candidate) => candidate.phase === task.phase)
      .map(taskId);
    const sourceIndex = sourceTaskIds.indexOf(movingTaskId);

    if (task.phase === targetPhase && sourceIndex === targetIndex) {
      setMoveAnnouncement(
        `${task.label || 'Task'} is already in that position.`
      );
      return false;
    }

    const orderedByPhase = new Map(
      EPISODE_PRODUCTION_BOARD_PHASES.map((phase) => [
        phase.id,
        phaseTasksWithout(phase.id, movingTaskId).map(taskId),
      ])
    );
    const destinationTaskIds = orderedByPhase.get(targetPhase) || [];
    destinationTaskIds.splice(targetIndex, 0, movingTaskId);
    orderedByPhase.set(targetPhase, destinationTaskIds);

    const knownPhaseIds = new Set(
      EPISODE_PRODUCTION_BOARD_PHASES.map(({ id }) => id)
    );
    const orderedTaskIds = EPISODE_PRODUCTION_BOARD_PHASES.flatMap(
      (phase) => orderedByPhase.get(phase.id) || []
    );
    tasks.forEach((candidate) => {
      const candidateId = taskId(candidate);
      if (
        candidateId !== movingTaskId &&
        !knownPhaseIds.has(candidate.phase)
      ) {
        orderedTaskIds.push(candidateId);
      }
    });

    onMoveTask({
      taskId: movingTaskId,
      sourcePhase: task.phase,
      sourceIndex,
      targetPhase,
      targetIndex,
      orderedTaskIds,
    });
    setActivePhase(targetPhase);

    const phaseLabel =
      EPISODE_PRODUCTION_BOARD_PHASES.find(
        (phase) => phase.id === targetPhase
      )?.label || targetPhase;
    setMoveAnnouncement(
      `Moved ${task.label || 'task'} to ${phaseLabel}, position ${
        targetIndex + 1
      }.`
    );
    setMoveControl(null);
    return true;
  }

  function openMoveControl(record) {
    const movingTaskId = taskId(record.task);
    if (moveControl?.taskId === movingTaskId) {
      setMoveControl(null);
      return;
    }

    const sourceTasks = tasks.filter(
      (candidate) => candidate.phase === record.task.phase
    );
    setMoveControl({
      taskId: movingTaskId,
      targetPhase: record.task.phase,
      targetIndex: Math.max(0, sourceTasks.indexOf(record.task)),
    });
  }

  function beginTaskDrag(event, record) {
    if (!taskCanMove(record)) {
      event.preventDefault();
      return;
    }

    const movingTaskId = taskId(record.task);
    draggedTaskIdRef.current = movingTaskId;
    dragTargetRef.current = null;
    setDraggedTaskId(movingTaskId);
    setDragTarget(null);
    setMoveControl(null);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', movingTaskId);

    const cardFrame = event.currentTarget.parentElement;
    if (cardFrame && event.dataTransfer.setDragImage) {
      const bounds = cardFrame.getBoundingClientRect();
      event.dataTransfer.setDragImage(
        cardFrame,
        Math.min(event.clientX - bounds.left, bounds.width),
        Math.min(event.clientY - bounds.top, bounds.height)
      );
    }
  }

  function finishTaskDrag() {
    draggedTaskIdRef.current = '';
    dragTargetRef.current = null;
    setDraggedTaskId('');
    setDragTarget(null);
  }

  function setCardDropTarget(event, phaseId, targetTaskId) {
    const movingTaskId = draggedTaskIdRef.current;
    if (!movingTaskId) return;

    event.preventDefault();
    event.stopPropagation();
    event.dataTransfer.dropEffect = 'move';
    if (movingTaskId === targetTaskId) {
      dragTargetRef.current = null;
      setDragTarget(null);
      return;
    }

    const destinationTasks = phaseTasksWithout(phaseId, movingTaskId);
    const anchorIndex = destinationTasks.findIndex(
      (task) => taskId(task) === targetTaskId
    );
    if (anchorIndex < 0) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    const position = event.clientY > bounds.top + bounds.height / 2
      ? 'after'
      : 'before';
    const nextTarget = {
      phaseId,
      targetIndex: anchorIndex + (position === 'after' ? 1 : 0),
      anchorTaskId: targetTaskId,
      position,
    };
    dragTargetRef.current = nextTarget;
    setDragTarget(nextTarget);
  }

  function setPhaseDropTarget(event, phaseId) {
    const movingTaskId = draggedTaskIdRef.current;
    if (!movingTaskId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    const nextTarget = {
      phaseId,
      targetIndex: phaseTasksWithout(phaseId, movingTaskId).length,
      anchorTaskId: '',
      position: 'end',
    };
    dragTargetRef.current = nextTarget;
    setDragTarget(nextTarget);
  }

  function dropTask(event, fallbackPhaseId) {
    event.preventDefault();
    event.stopPropagation();
    const movingTaskId =
      draggedTaskIdRef.current || event.dataTransfer.getData('text/plain');
    const movingRecord = taskRecords.find(
      (record) => taskId(record.task) === movingTaskId
    );
    const currentDragTarget = dragTargetRef.current || dragTarget;
    if (movingRecord && currentDragTarget) {
      requestMoveTask(
        movingRecord.task,
        currentDragTarget.phaseId || fallbackPhaseId,
        currentDragTarget.targetIndex
      );
    }
    finishTaskDrag();
  }

  function setVisibleCardsExpanded(expanded) {
    boardViewportRef.current
      ?.querySelectorAll("details:not([data-opens-workspace='true'])")
      .forEach((card) => {
        card.open = expanded;
      });
  }

  function clearBoardFilters() {
    setSearchQuery('');
    setActiveFilter('all');
  }

  return (
    <section className={styles.board} aria-label={ariaLabel}>
      <div className={styles.boardHeader}>
        <div>
          <h2>Production Board</h2>
          <p>
            {boardCanMove
              ? 'Drag a tile by its move handle, or select the handle for precise controls.'
              : boardMoveDisabledReason
                ? boardMoveDisabledReason
                : 'Open a card to review details, update work, or edit the task.'}
          </p>
        </div>
        <div className={styles.boardHeaderActions}>
          {canAdd && (onAddTask || renderAddTaskAction) ? (
            renderAddTaskAction ? (
              renderAddTaskAction({
                defaultPhaseId: activePhase,
                phases: EPISODE_PRODUCTION_BOARD_PHASES,
                tasks,
                onAdd: requestAddTask,
              })
            ) : (
              <button
                type="button"
                className={styles.addTaskAction}
                onClick={() => requestAddTask()}
              >
                <AddRoundedIcon aria-hidden="true" />
                {addTaskLabel}
              </button>
            )
          ) : null}
        </div>
      </div>

      <div className={styles.boardToolbar}>
        <div className={styles.searchControl}>
          <label htmlFor={searchId}>Find a step</label>
          <div>
            <SearchRoundedIcon
              className={styles.searchIcon}
              aria-hidden="true"
            />
            <input
              id={searchId}
              type="search"
              value={searchQuery}
              placeholder="Search tasks, owners, or instructions"
              onChange={(event) => setSearchQuery(event.target.value)}
            />
            {searchQuery ? (
              <button type="button" onClick={() => setSearchQuery('')}>
                Clear
              </button>
            ) : null}
          </div>
        </div>

        <div className={styles.filterControl}>
          <span>Show</span>
          <div
            className={styles.filterButtons}
            role="group"
            aria-label="Task filters"
          >
            {BOARD_FILTERS.filter(
              (filter) => filter.id !== 'mine' || showMineFilter
            ).map((filter) => {
              const mineUnavailable =
                filter.id === 'mine' && !mineFilterAvailable;
              return (
                <button
                  key={filter.id}
                  type="button"
                  aria-pressed={activeFilter === filter.id}
                  disabled={mineUnavailable}
                  title={
                    mineUnavailable
                      ? 'Assignment information is unavailable for this view.'
                      : undefined
                  }
                  onClick={() => setActiveFilter(filter.id)}
                >
                  {filter.label}
                  <span>{filterCounts[filter.id]}</span>
                </button>
              );
            })}
          </div>
        </div>

        {!opensTaskWorkspace ? (
          <div
            className={styles.expandControls}
            role="group"
            aria-label="Task card display"
          >
            <button
              type="button"
              disabled={!visibleTaskRecords.length}
              onClick={() => setVisibleCardsExpanded(true)}
            >
              Expand all
            </button>
            <button
              type="button"
              disabled={!visibleTaskRecords.length}
              onClick={() => setVisibleCardsExpanded(false)}
            >
              Collapse all
            </button>
          </div>
        ) : null}
      </div>

      <p className={styles.resultSummary} aria-live="polite">
        Showing {visibleTaskRecords.length} of {taskRecords.length} steps
      </p>
      <p className={styles.srOnly} aria-live="polite" aria-atomic="true">
        {moveAnnouncement}
      </p>

      <div className={styles.mobilePhaseControl}>
        <label htmlFor={pickerId}>Show phase</label>
        <select
          id={pickerId}
          value={activePhase}
          onChange={(event) => setActivePhase(event.target.value)}
        >
          {EPISODE_PRODUCTION_BOARD_PHASES.map((phase) => {
            const phaseRecords = taskRecords.filter(
              (record) => record.task.phase === phase.id
            );
            const completeCount = phaseRecords.filter(
              (record) => record.complete
            ).length;
            return (
              <option key={phase.id} value={phase.id}>
                {phase.label} ({completeCount}/{phaseRecords.length} complete)
              </option>
            );
          })}
        </select>
      </div>

      {visibleTaskRecords.length || !filterIsActive ? (
        <div
          className={styles.boardViewport}
          tabIndex="0"
          ref={boardViewportRef}
        >
          <div className={styles.boardGrid}>
            {EPISODE_PRODUCTION_BOARD_PHASES.map((phase) => {
              const allPhaseRecords = taskRecords.filter(
                (record) => record.task.phase === phase.id
              );
              const phaseTaskRecords = visibleTaskRecords.filter(
                (record) => record.task.phase === phase.id
              );
              const phaseCompleteCount = allPhaseRecords.filter(
                (record) => record.complete
              ).length;
              const progressValue = allPhaseRecords.length
                ? Math.round(
                    (phaseCompleteCount / allPhaseRecords.length) * 100
                  )
                : 0;
              const phaseCanAdd = canAddToPhase(phase.id);
              return (
                <section
                  key={phase.id}
                  className={styles.phaseColumn}
                  data-phase={phase.id}
                  data-active={activePhase === phase.id ? 'true' : 'false'}
                  data-drag-over={
                    draggedTaskId && dragTarget?.phaseId === phase.id
                      ? 'true'
                      : 'false'
                  }
                  aria-labelledby={`${pickerId}-${phase.id}`}
                >
                  <header className={styles.phaseHeader}>
                    <div className={styles.phaseTitleRow}>
                      <div>
                        <p>{phase.shortLabel}</p>
                        <h3 id={`${pickerId}-${phase.id}`}>{phase.label}</h3>
                      </div>
                      <span
                        aria-label={`${phaseTaskRecords.length} visible steps`}
                      >
                        {filterIsActive
                          ? `${phaseTaskRecords.length}/${allPhaseRecords.length}`
                          : allPhaseRecords.length}
                      </span>
                    </div>
                    <small>{phase.description}</small>
                    <div className={styles.phaseProgress}>
                      <div>
                        <span>
                          {phaseCompleteCount} of {allPhaseRecords.length}{' '}
                          complete
                        </span>
                        <span>{progressValue}%</span>
                      </div>
                      <progress
                        max="100"
                        value={progressValue}
                        aria-label={`${phase.label}: ${progressValue}% complete`}
                      />
                    </div>
                  </header>

                  <div
                    className={styles.taskStack}
                    data-drop-at-end={
                      draggedTaskId &&
                      dragTarget?.phaseId === phase.id &&
                      dragTarget?.position === 'end'
                        ? 'true'
                        : 'false'
                    }
                    onDragOver={(event) => setPhaseDropTarget(event, phase.id)}
                    onDrop={(event) => dropTask(event, phase.id)}
                  >
                    {phaseTaskRecords.length ? (
                      phaseTaskRecords.map((record) => {
                        const {
                          task,
                          complete,
                          overdue,
                          context,
                          status,
                          ownerLabel,
                        } = record;
                        const { dependenciesComplete, dependencyLabels } =
                          context;
                        const movingTaskId = taskId(task);
                        const movable = taskCanMove(record);
                        const moveDisabledReason =
                          taskMoveDisabledReason(record);
                        const showMoveHandle = Boolean(
                          taskHasMovePermission(record)
                        );
                        const moveControlIsOpen =
                          moveControl?.taskId === movingTaskId;
                        const destinationTasks = moveControlIsOpen
                          ? phaseTasksWithout(
                              moveControl.targetPhase,
                              movingTaskId
                            )
                          : [];
                        const actions = renderTaskActions ? (
                          renderTaskActions(task, context)
                        ) : (
                          <DefaultTaskActions
                            task={task}
                            context={context}
                            onTaskAction={onTaskAction}
                          />
                        );
                        const editAction =
                          context.canEdit &&
                          (onEditTask || renderEditTaskAction)
                            ? renderEditTaskAction
                              ? renderEditTaskAction(task, {
                                  ...context,
                                  onEdit: () =>
                                    requestEditTask(task, context),
                                })
                              : (
                                  <button
                                    type="button"
                                    className={styles.editTaskAction}
                                    onClick={() =>
                                      requestEditTask(task, context)
                                    }
                                    aria-label={`${editTaskLabel}: ${
                                      task.label || 'Untitled production step'
                                    }`}
                                  >
                                    <EditRoundedIcon aria-hidden="true" />
                                    {editTaskLabel}
                                  </button>
                                )
                            : null;

                        return (
                          <div
                            key={movingTaskId}
                            className={styles.taskCardFrame}
                            data-overdue={overdue ? 'true' : 'false'}
                            data-complete={complete ? 'true' : 'false'}
                            data-editable={editAction ? 'true' : 'false'}
                            data-movable={showMoveHandle ? 'true' : 'false'}
                            data-dragging={
                              draggedTaskId === movingTaskId ? 'true' : 'false'
                            }
                            data-drop-position={
                              dragTarget?.anchorTaskId === movingTaskId
                                ? dragTarget.position
                                : undefined
                            }
                            onDragOver={(event) =>
                              setCardDropTarget(
                                event,
                                phase.id,
                                movingTaskId
                              )
                            }
                            onDrop={(event) => dropTask(event, phase.id)}
                          >
                            {showMoveHandle ? (
                              <button
                                type="button"
                                className={styles.dragHandle}
                                draggable={movable}
                                data-disabled={movable ? 'false' : 'true'}
                                aria-disabled={movable ? undefined : 'true'}
                                aria-expanded={moveControlIsOpen}
                                aria-controls={
                                  moveControlIsOpen
                                    ? `${pickerId}-move-${movingTaskId}`
                                    : undefined
                                }
                                aria-label={`Move ${
                                  task.label || 'untitled production step'
                                }`}
                                title={
                                  moveDisabledReason ||
                                  'Drag to move, or select for move controls'
                                }
                                onClick={() => {
                                  if (movable) {
                                    openMoveControl(record);
                                  } else {
                                    setMoveAnnouncement(
                                      moveDisabledReason ||
                                        'This task cannot be moved.'
                                    );
                                  }
                                }}
                                onDragStart={(event) =>
                                  beginTaskDrag(event, record)
                                }
                                onDragEnd={finishTaskDrag}
                              >
                                <DragIndicatorRoundedIcon aria-hidden="true" />
                              </button>
                            ) : null}
                            <details
                              className={styles.taskCard}
                              data-overdue={overdue ? 'true' : 'false'}
                              data-complete={complete ? 'true' : 'false'}
                              data-opens-workspace={
                                opensTaskWorkspace ? 'true' : 'false'
                              }
                            >
                              <summary
                                className={styles.taskSummary}
                                aria-haspopup={
                                  opensTaskWorkspace ? 'dialog' : undefined
                                }
                                aria-label={
                                  opensTaskWorkspace
                                    ? `${
                                        task.label ||
                                        'Untitled production step'
                                      }. ${status.label}. Open task workspace.`
                                    : undefined
                                }
                                onClick={
                                  opensTaskWorkspace
                                    ? (event) => {
                                        event.preventDefault();
                                        onOpenTask(task, context);
                                      }
                                    : undefined
                                }
                              >
                                <div className={styles.summaryTop}>
                                  <h4>
                                    {task.label || 'Untitled production step'}
                                  </h4>
                                  <span
                                    className={styles.statusBadge}
                                    data-status={status.key}
                                  >
                                    {status.key === 'overdue' ? (
                                      <WarningAmberRoundedIcon aria-hidden="true" />
                                    ) : status.key === 'complete' ? (
                                      <CheckCircleRoundedIcon aria-hidden="true" />
                                    ) : null}
                                    {status.label}
                                  </span>
                                </div>
                                <dl className={styles.taskMetadata}>
                                  <div>
                                    <dt>Owner</dt>
                                    <dd>{ownerLabel}</dd>
                                  </div>
                                  <div>
                                    <dt>Due</dt>
                                    <dd>
                                      <time
                                        dateTime={task.due_date || undefined}
                                      >
                                        {formatDueDate(task.due_date)}
                                      </time>
                                      <small
                                        data-overdue={
                                          overdue ? 'true' : 'false'
                                        }
                                      >
                                        {formatDueCountdown(
                                          task.due_date,
                                          today,
                                          complete
                                        )}
                                      </small>
                                    </dd>
                                  </div>
                                </dl>
                              </summary>

                              <div className={styles.taskBody}>
                                {task.description ? (
                                  <p>{task.description}</p>
                                ) : null}
                                {!dependenciesComplete && !complete ? (
                                  <p className={styles.dependencyNote}>
                                    <strong>Waiting for:</strong>{' '}
                                    {dependencyLabels.length
                                      ? dependencyLabels.join(' + ')
                                      : 'Required earlier steps'}
                                  </p>
                                ) : null}
                                {renderTaskDetails
                                  ? renderTaskDetails(task, context)
                                  : null}
                                {editAction || actions ? (
                                  <div className={styles.taskActionBar}>
                                    {editAction ? (
                                      <div
                                        className={styles.taskEditActionSlot}
                                      >
                                        {editAction}
                                      </div>
                                    ) : null}
                                    {actions ? (
                                      <div className={styles.taskActions}>
                                        {actions}
                                      </div>
                                    ) : null}
                                  </div>
                                ) : null}
                              </div>
                            </details>
                            {moveControlIsOpen ? (
                              <form
                                id={`${pickerId}-move-${movingTaskId}`}
                                className={styles.movePanel}
                                onSubmit={(event) => {
                                  event.preventDefault();
                                  requestMoveTask(
                                    task,
                                    moveControl.targetPhase,
                                    moveControl.targetIndex
                                  );
                                }}
                              >
                                <div className={styles.movePanelHeading}>
                                  <div>
                                    <strong>Move tile</strong>
                                    <span>
                                      Notes and dependencies stay attached.
                                    </span>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setMoveControl(null)}
                                  >
                                    Cancel
                                  </button>
                                </div>
                                <div className={styles.moveFields}>
                                  <label>
                                    <span>Phase</span>
                                    <select
                                      value={moveControl.targetPhase}
                                      onChange={(event) => {
                                        const targetPhase = event.target.value;
                                        setMoveControl((current) => ({
                                          ...current,
                                          targetPhase,
                                          targetIndex: phaseTasksWithout(
                                            targetPhase,
                                            movingTaskId
                                          ).length,
                                        }));
                                      }}
                                    >
                                      {EPISODE_PRODUCTION_BOARD_PHASES.map(
                                        (candidatePhase) => (
                                          <option
                                            key={candidatePhase.id}
                                            value={candidatePhase.id}
                                          >
                                            {candidatePhase.label}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </label>
                                  <label>
                                    <span>Position</span>
                                    <select
                                      value={moveControl.targetIndex}
                                      onChange={(event) =>
                                        setMoveControl((current) => ({
                                          ...current,
                                          targetIndex: Number(
                                            event.target.value
                                          ),
                                        }))
                                      }
                                    >
                                      <option value="0">
                                        {destinationTasks.length
                                          ? 'First in phase'
                                          : 'Only task in phase'}
                                      </option>
                                      {destinationTasks.map(
                                        (destinationTask, index) => (
                                          <option
                                            key={taskId(destinationTask)}
                                            value={index + 1}
                                          >
                                            After{' '}
                                            {destinationTask.label ||
                                              'untitled task'}
                                          </option>
                                        )
                                      )}
                                    </select>
                                  </label>
                                </div>
                                <button
                                  type="submit"
                                  className={styles.confirmMoveAction}
                                >
                                  Move task
                                </button>
                              </form>
                            ) : null}
                          </div>
                        );
                      })
                    ) : (
                      <p className={styles.emptyColumn}>
                        {allPhaseRecords.length && filterIsActive
                          ? 'No matching steps in this phase.'
                          : emptyMessage}
                      </p>
                    )}
                  </div>
                  {phaseCanAdd && (onAddTask || renderAddTaskAction) ? (
                    onAddTask ? (
                      <button
                        type="button"
                        className={styles.phaseAddAction}
                        onClick={() => requestAddTask(phase.id)}
                        aria-label={`${addTaskLabel} to ${phase.label}`}
                      >
                        <AddRoundedIcon aria-hidden="true" />
                        <span>{addTaskLabel}</span>
                      </button>
                    ) : (
                      <div className={styles.phaseAddActionSlot}>
                        {renderAddTaskAction({
                          defaultPhaseId: phase.id,
                          phases: EPISODE_PRODUCTION_BOARD_PHASES,
                          tasks,
                          placement: 'phase',
                          onAdd: () => requestAddTask(phase.id),
                        })}
                      </div>
                    )
                  ) : null}
                </section>
              );
            })}
          </div>
        </div>
      ) : (
        <div className={styles.emptyFilteredState} role="status">
          <h3>No steps match this view</h3>
          <p>Try another filter or a broader search.</p>
          <button type="button" onClick={clearBoardFilters}>
            Show all steps
          </button>
        </div>
      )}
    </section>
  );
}
