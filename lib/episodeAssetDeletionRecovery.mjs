import { normalizeEpisodeStudio } from './episodeStudioPresentation.mjs';

function sameValue(left, right) {
  return JSON.stringify(left ?? null) === JSON.stringify(right ?? null);
}

export function restoreEpisodeAssetDeletionMetadata(
  currentValue,
  { beforeDeletion = {}, afterDeletion = {}, assetId = '' } = {}
) {
  const current = normalizeEpisodeStudio(currentValue);
  const before = normalizeEpisodeStudio(beforeDeletion);
  const after = normalizeEpisodeStudio(afterDeletion);
  const cleanAssetId = String(assetId || '').trim();
  const originalAsset = before.assets.find(
    (asset) => asset.asset_id === cleanAssetId
  );
  if (!originalAsset) return current;

  const priorTasks = new Map(
    before.production_tasks.map((task) => [task.task_id, task])
  );
  const removedTasks = new Map(
    after.production_tasks.map((task) => [task.task_id, task])
  );
  const productionTasks = current.production_tasks.map((task) => {
    const prior = priorTasks.get(task.task_id);
    const removed = removedTasks.get(task.task_id);
    return prior && removed && !sameValue(prior, removed) && sameValue(task, removed)
      ? prior
      : task;
  });

  const priorAssignments = new Map(
    before.sponsor_read_assignments.map((assignment) => [
      assignment.assignment_id,
      assignment,
    ])
  );
  const removedAssignments = new Map(
    after.sponsor_read_assignments.map((assignment) => [
      assignment.assignment_id,
      assignment,
    ])
  );
  const sponsorReadAssignments = current.sponsor_read_assignments.map(
    (assignment) => {
      const prior = priorAssignments.get(assignment.assignment_id);
      const removed = removedAssignments.get(assignment.assignment_id);
      return prior &&
        removed &&
        !sameValue(prior, removed) &&
        sameValue(assignment, removed)
        ? prior
        : assignment;
    }
  );

  const priorDeliverables = new Map(
    before.deliverables.map((deliverable) => [deliverable.id, deliverable])
  );
  const removedDeliverables = new Map(
    after.deliverables.map((deliverable) => [deliverable.id, deliverable])
  );
  const deliverables = current.deliverables.map((deliverable) => {
    const prior = priorDeliverables.get(deliverable.id);
    const removed = removedDeliverables.get(deliverable.id);
    if (
      !prior ||
      !removed ||
      sameValue(prior.photo_selection, removed.photo_selection) ||
      !sameValue(deliverable.photo_selection, removed.photo_selection)
    ) {
      return deliverable;
    }
    return {
      ...deliverable,
      photo_selection: prior.photo_selection,
    };
  });

  const next = {
    ...current,
    assets: current.assets.some((asset) => asset.asset_id === cleanAssetId)
      ? current.assets
      : [...current.assets, originalAsset],
    production_tasks: productionTasks,
    sponsor_read_assignments: sponsorReadAssignments,
    deliverables,
  };
  for (const field of [
    'production_workflow_updated_at',
    'production_workflow_updated_by_person_id',
    'production_workflow_updated_by_name',
  ]) {
    if (sameValue(current[field], after[field])) next[field] = before[field];
  }
  return normalizeEpisodeStudio(next);
}
