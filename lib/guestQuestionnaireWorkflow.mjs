import { applyEpisodeProductionTaskUpdate } from './episodeProductionPlan.mjs';

export const GUEST_QUESTIONNAIRE_SENT_TASK_ID = 'guest-prep-sent';
export const GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID = 'guest-prep-received';

export function completeGuestQuestionnaireWorkflowTask(
  episodeValue = {},
  taskId,
  {
    actorPersonId = '',
    actorName = 'Guest questionnaire',
    note = '',
    now = new Date(),
  } = {}
) {
  const episode =
    episodeValue && typeof episodeValue === 'object' ? episodeValue : {};
  const task = (Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : []
  ).find((candidate) => candidate?.task_id === taskId);
  if (!task || ['complete', 'waived'].includes(task.status)) {
    return { episode, changed: false };
  }
  return {
    episode: applyEpisodeProductionTaskUpdate(
      episode,
      taskId,
      {
        status: 'complete',
        note: String(note || '').trim().slice(0, 2400),
      },
      {
        personId: actorPersonId,
        personName: actorName,
        roles: ['studio_manager'],
        canManage: true,
      },
      { now }
    ),
    changed: true,
  };
}

export function reopenGuestQuestionnaireSentTask(
  episodeValue = {},
  {
    actorPersonId = '',
    actorName = 'Guest questionnaire',
    now = new Date(),
  } = {}
) {
  const episode =
    episodeValue && typeof episodeValue === 'object' ? episodeValue : {};
  const task = (Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : []
  ).find(
    (candidate) => candidate?.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID
  );
  if (!task || !['complete', 'waived'].includes(task.status)) {
    return { episode, changed: false };
  }
  return {
    episode: applyEpisodeProductionTaskUpdate(
      episode,
      GUEST_QUESTIONNAIRE_SENT_TASK_ID,
      {
        status: 'in_progress',
        note: 'Replacement guest link created and waiting to be shared.',
      },
      {
        personId: actorPersonId,
        personName: actorName,
        roles: ['studio_manager'],
        canManage: true,
      },
      { now, allowCompletedDependents: true }
    ),
    changed: true,
  };
}

export function reopenGuestQuestionnaireSentTaskForNewLink(
  episodeValue = {},
  options = {}
) {
  return reopenGuestQuestionnaireSentTask(episodeValue, options);
}
