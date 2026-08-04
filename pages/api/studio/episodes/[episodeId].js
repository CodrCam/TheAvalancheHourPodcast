import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getEpisodeRelationshipCapabilities,
  getEpisodeCompletion,
  DEFAULT_EPISODE_DELIVERABLES,
  MAX_EPISODE_DELIVERABLES,
  configureEpisodeDeliverables,
  isEpisodeAssetExpired,
  mergeEpisodeStudioManagerValues,
  mergeHostDeliverableValues,
  normalizeEpisodeStudio,
  isSafeEpisodeMaterialUrl,
  isSafeSpotifyStagingUrl,
  sanitizeEpisodeStudioForViewer,
  updateEpisodePhotoSelection,
} from '../../../../lib/episodeStudioPresentation.mjs';
import {
  getEpisodeStudio,
  saveEpisodeStudio,
} from '../../../../lib/episodeStudioStore';
import {
  applyEpisodeMicKitReadinessToCompletion,
  getEpisodeMicKitSubmissionReadiness,
} from '../../../../lib/episodeMicKitPresentation.mjs';
import { getMicKitTracker } from '../../../../lib/micKitStore';
import { sendEpisodeSubmissionNotification } from '../../../../lib/episodeStudioNotifications';
import { listPeople } from '../../../../lib/peopleStore';
import { getPersonStudioCapabilities } from '../../../../lib/peopleStudioCapabilities.mjs';
import {
  getStudioBindingForSubject,
  listStudioBindings,
} from '../../../../lib/studioAccessStore';
import {
  pickStudioDisplayName,
  resolveStudioMessageAuthors,
} from '../../../../lib/studioIdentityPresentation.mjs';
import {
  getSponsorReadOperationalState,
  isSponsorReadAssignable,
} from '../../../../lib/sponsorReadPresentation.mjs';
import {
  getSponsorRead,
  listSponsorReads,
} from '../../../../lib/sponsorReadStore';
import { publishEpisodeNotifications } from '../../../../lib/episodeStudioEvents';
import { isEpisodeAssetStorageConfigured } from '../../../../lib/episodeAssetStorage';
import { filterEpisodeAssetsForViewer } from '../../../../lib/episodeAssetPolicy.mjs';
import { getEpisodeDeletionReadyAt } from '../../../../lib/episodeAssetGrantLifecycle.mjs';
import { finalizeEpisodeStudioDeletion } from '../../../../lib/episodeStudioDeletionCleanup';
import {
  getEpisodeStudioDeletionPlan,
} from '../../../../lib/episodeStudioDeletion.mjs';
import {
  buildProductionAdvance,
  getAvailableProductionLeadPersonIds,
  getNextProductionLeadPersonId,
  getProductionLeadPersonIds,
} from '../../../../lib/productionEscalation.mjs';
import { getEpisodeStudioViewCapabilities } from '../../../../lib/episodeStudioHostPreview.mjs';
import {
  addEpisodeProductionTaskDefinition,
  applyEpisodeProductionTaskUpdate,
  canEditEpisodeProductionTaskStructure,
  createDefaultEpisodeProductionTasks,
  editEpisodeProductionTaskDefinition,
  INTRO_RECORDING_LATEST_DAYS_BEFORE_AIR,
  isEpisodeProductionTaskOwner,
  moveEpisodeProductionTaskDefinition,
  normalizeEpisodeProductionTasks,
} from '../../../../lib/episodeProductionPlan.mjs';
import crypto from 'crypto';

const HOST_LOCKED_STATUSES = [
  'submitted',
  'submitted_with_gaps',
  'accepted',
];
const PRODUCER_REVIEW_STATUSES = [
  'needs_changes',
  'accepted',
];
const PRODUCER_PROOF_DELIVERABLE_ID = 'producer-proof-audio';
const INTRO_TASK_ID = 'intro-ready';
const PRODUCER_PROOF_TASK_ID = 'producer-proof-upload';
const PROOF_APPROVAL_TASK_ID = 'proof-listen-approval';
const WORKFLOW_CONFIG_FIELDS = [
  'label',
  'description',
  'days_before_air',
  'due_date',
  'due_date_overridden',
  'owner_type',
  'assigned_person_ids',
  'required',
];
const WORKFLOW_UPDATE_FIELDS = [
  'status',
  'intro_method',
  'intro_scheduled_for',
  'note',
  'evidence_url',
  'proof_decision',
  'subtasks',
  'assigned_person_ids',
  'due_date',
  'due_date_overridden',
];
const WORKFLOW_STRUCTURE_FIELDS = [
  'task_id',
  'id',
  'label',
  'title',
  'description',
  'instructions',
  'phase',
  'owner_type',
  'assigned_person_ids',
  'days_before_air',
  'due_date',
  'due_date_overridden',
  'dependencies',
  'required',
  'kind',
  'linked_deliverable_ids',
];

function productionTaskId(value = {}) {
  return String(value.task_id || value.id || '').trim();
}

function hasSamePersonIds(left = [], right = []) {
  const normalize = (value) =>
    [
      ...new Set(
        (Array.isArray(value) ? value : [])
          .map((personId) => String(personId || '').trim())
          .filter(Boolean)
      ),
    ].sort();
  return JSON.stringify(normalize(left)) === JSON.stringify(normalize(right));
}

function cleanWorkflowDate(value = '') {
  const date = String(value || '').trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return '';
  const [year, month, day] = date.split('-').map(Number);
  const parsed = new Date(Date.UTC(year, month - 1, day));
  return parsed.toISOString().slice(0, 10) === date ? date : '';
}

function daysBeforeDate(dateValue, days) {
  const date = cleanWorkflowDate(dateValue);
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  if (Number.isNaN(parsed.getTime())) return '';
  parsed.setUTCDate(parsed.getUTCDate() - Math.trunc(Number(days) || 0));
  return parsed.toISOString().slice(0, 10);
}

function hasUploadedDeliverableAsset(episode = {}, deliverableId = '') {
  return (Array.isArray(episode.assets) ? episode.assets : []).some(
    (asset) =>
      asset.deliverable_id === deliverableId &&
      asset.status === 'uploaded' &&
      !isEpisodeAssetExpired(asset)
  );
}

function getCurrentUploadedDeliverableAsset(
  episode = {},
  deliverableId = ''
) {
  return (Array.isArray(episode.assets) ? episode.assets : [])
    .filter(
      (asset) =>
        asset.deliverable_id === deliverableId &&
        asset.status === 'uploaded' &&
        !isEpisodeAssetExpired(asset)
    )
    .sort(
      (a, b) =>
        String(b.uploaded_at || '').localeCompare(
          String(a.uploaded_at || '')
        ) || String(b.asset_id || '').localeCompare(String(a.asset_id || ''))
    )[0];
}

function withProducerProofDeliverable(episode) {
  const hasProducerProof = episode.deliverables.some(
    (deliverable) => deliverable.id === PRODUCER_PROOF_DELIVERABLE_ID
  );
  if (
    !hasProducerProof &&
    episode.deliverables.length >= MAX_EPISODE_DELIVERABLES
  ) {
    throw new Error(
      'Episode Studio: remove one checklist item before enabling the private producer proof.'
    );
  }
  const template = DEFAULT_EPISODE_DELIVERABLES.find(
    (deliverable) => deliverable.id === PRODUCER_PROOF_DELIVERABLE_ID
  );
  if (!template) {
    throw new Error(
      'Episode Studio: the private producer proof step is unavailable.'
    );
  }
  return normalizeEpisodeStudio({
    ...episode,
    deliverables: [
      ...episode.deliverables.map((deliverable) =>
        deliverable.id === 'intro-audio'
          ? { ...deliverable, required: false }
          : deliverable
      ),
      ...(!hasProducerProof
        ? [
            {
              ...template,
              value: '',
              social_profiles: '',
              legacy_source_url: '',
            },
          ]
        : []),
    ],
  });
}

function configureProductionTasks(
  episode,
  configurationValue,
  peopleById
) {
  const currentTasks = Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : [];
  const currentById = new Map(
    currentTasks.map((task) => [productionTaskId(task), task])
  );
  const requested = Array.isArray(configurationValue)
    ? configurationValue
    : [];
  const requestedIds = new Set();
  const patchesById = new Map();

  for (const value of requested) {
    const taskId = productionTaskId(value);
    if (!taskId || !currentById.has(taskId)) {
      throw new Error(
        'Episode Studio: workflow configuration contains an unknown production task.'
      );
    }
    if (requestedIds.has(taskId)) {
      throw new Error(
        `Episode Studio: workflow task "${taskId}" appears more than once.`
      );
    }
    requestedIds.add(taskId);
    const patch = {};
    for (const field of WORKFLOW_CONFIG_FIELDS) {
      if (Object.prototype.hasOwnProperty.call(value, field)) {
        patch[field] = value[field];
      }
    }

    if (Object.prototype.hasOwnProperty.call(patch, 'due_date')) {
      if (!cleanWorkflowDate(patch.due_date)) {
        throw new Error(
          'Episode Studio: every production deadline must use YYYY-MM-DD.'
        );
      }
      patch.due_date = cleanWorkflowDate(patch.due_date);
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'days_before_air')) {
      const days = Number(patch.days_before_air);
      if (!Number.isInteger(days) || days < 0 || days > 365) {
        throw new Error(
          'Episode Studio: days before air must be a whole number from 0 to 365.'
        );
      }
      patch.days_before_air = days;
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'owner_type')) {
      if (
        ![
          'hosts',
          'producer',
          'person',
          'hosts_and_producer',
        ].includes(patch.owner_type)
      ) {
        throw new Error(
          'Episode Studio: choose a valid production task owner type.'
        );
      }
    }
    if (Object.prototype.hasOwnProperty.call(patch, 'assigned_person_ids')) {
      const personIds = [
        ...new Set(
          (Array.isArray(patch.assigned_person_ids)
            ? patch.assigned_person_ids
            : []
          )
            .map((personId) => String(personId || '').trim())
            .filter(Boolean)
        ),
      ].slice(0, 8);
      if (personIds.some((personId) => !peopleById.has(personId))) {
        throw new Error(
          'Episode Studio: every production task assignee must be a current team profile.'
        );
      }
      const assignmentChanged = !hasSamePersonIds(
        personIds,
        currentById.get(taskId).assigned_person_ids
      );
      if (
        assignmentChanged &&
        personIds.some(
          (personId) => {
            const person = peopleById.get(personId);
            return (
              person?.account_active !== true ||
              (!person?.capabilities?.host && !person?.capabilities?.producer)
            );
          }
        )
      ) {
        throw new Error(
          'Episode Studio: production tasks can only be assigned to an active host or producer.'
        );
      }
      patch.assigned_person_ids = personIds;
    }
    const nextOwnerType =
      patch.owner_type || currentById.get(taskId).owner_type;
    const nextAssignedIds = Object.prototype.hasOwnProperty.call(
      patch,
      'assigned_person_ids'
    )
      ? patch.assigned_person_ids
      : currentById.get(taskId).assigned_person_ids || [];
    if (nextOwnerType === 'person' && !nextAssignedIds.length) {
      throw new Error(
        'Episode Studio: choose an accountable person for each named-owner task.'
      );
    }
    patchesById.set(taskId, patch);
  }

  return normalizeEpisodeProductionTasks(
    currentTasks.map((task) => ({
      ...task,
      ...(patchesById.get(productionTaskId(task)) || {}),
    })),
    episode.target_release_date
  );
}

function productionTaskStructureInput(value) {
  const source = value && typeof value === 'object' ? value : {};
  const patch = {};
  for (const field of WORKFLOW_STRUCTURE_FIELDS) {
    if (Object.prototype.hasOwnProperty.call(source, field)) {
      patch[field] = source[field];
    }
  }
  return patch;
}

function createCustomProductionTaskId(tasks = []) {
  const existingIds = new Set(
    (Array.isArray(tasks) ? tasks : []).map(productionTaskId).filter(Boolean)
  );
  for (let attempt = 0; attempt < 8; attempt += 1) {
    const taskId = `custom-task-${crypto.randomUUID()}`;
    if (!existingIds.has(taskId)) return taskId;
  }
  throw new Error('Episode Studio: could not create a unique production task.');
}

function validateProductionTaskAssignees(task, previousTask, peopleById) {
  const personIds = Array.isArray(task?.assigned_person_ids)
    ? task.assigned_person_ids
    : [];
  if (task?.owner_type !== 'person' && personIds.length) {
    throw new Error(
      'Episode Studio: relationship-owned tasks cannot also name individual assignees.'
    );
  }
  if (task?.owner_type === 'person' && !personIds.length) {
    throw new Error(
      'Episode Studio: choose an accountable person for this production task.'
    );
  }
  if (personIds.some((personId) => !peopleById.has(personId))) {
    throw new Error(
      'Episode Studio: every production task assignee must be a current team profile.'
    );
  }
  const assignmentChanged =
    !previousTask ||
    !hasSamePersonIds(personIds, previousTask.assigned_person_ids) ||
    task.owner_type !== previousTask.owner_type;
  if (
    assignmentChanged &&
    personIds.some((personId) => {
      const person = peopleById.get(personId);
      return (
        person?.account_active !== true ||
        (!person?.capabilities?.host && !person?.capabilities?.producer)
      );
    })
  ) {
    throw new Error(
      'Episode Studio: production tasks can only be assigned to an active host or producer.'
    );
  }
}

async function getPeopleDirectory() {
  const [result, bindingsResult] = await Promise.all([
    listPeople({
      allowStaticFallback: true,
      includeInactive: true,
    }),
    listStudioBindings(),
  ]);
  const bindingsByPerson = new Map(
    bindingsResult.bindings.map((binding) => [binding.person_id, binding])
  );
  const people = result.people.map((person) => ({
    person_id: person.person_id,
    name: person.name,
    capabilities: getPersonStudioCapabilities(person),
    account_email:
      bindingsByPerson.get(person.person_id)?.account_email || '',
    account_active: Boolean(
      bindingsByPerson.get(person.person_id)?.active
    ),
  }));
  const peopleById = new Map(
    people.map((person) => [person.person_id, person])
  );
  const peopleBySubject = new Map();

  for (const binding of bindingsResult.bindings) {
    if (!binding.active) continue;
    const person = peopleById.get(binding.person_id);
    if (!person) continue;
    if (binding.user_sub) peopleBySubject.set(binding.user_sub, person);
  }

  return {
    peopleById,
    peopleBySubject,
    hosts: people.filter((person) => person.capabilities.host),
    producers: people.filter((person) => person.capabilities.producer),
  };
}

function getPrincipalAuthorName(principal, binding, directory) {
  const person =
    (binding && directory.peopleById.get(binding.person_id)) ||
    directory.peopleBySubject.get(principal.subject);
  return pickStudioDisplayName(
    [person?.name, principal.displayName, principal.username],
    'Studio producer'
  );
}

function resolveMessageAuthors(
  episode,
  directory,
  principal,
  currentAuthorName
) {
  const namesByIdentifier = new Map(
    [...directory.peopleBySubject].map(([identifier, person]) => [
      identifier,
      person.name,
    ])
  );

  return {
    ...episode,
    messages: resolveStudioMessageAuthors(episode.messages, {
      namesByIdentifier,
      currentIdentifiers: [principal.subject, principal.username],
      currentAuthorName,
    }),
  };
}

function getDeliveryHealthActorRole(principal, binding, episode) {
  if (binding?.person_id === episode.producer_person_id) return 'producer';
  if (episode.host_person_ids.includes(binding?.person_id)) return 'host';
  if (principal.groups.includes('admin')) return 'admin';
  if (principal.groups.includes('studio_manager')) return 'studio_manager';
  return 'host';
}

async function sponsorReadResponseData(episode, canManage) {
  let result;
  try {
    result = await listSponsorReads();
  } catch (error) {
    console.error('sponsor read library lookup unavailable:', error);
    return {
      episode: sanitizeEpisodeStudioForViewer({
        ...episode,
        sponsor_read_assignments: (
          episode.sponsor_read_assignments || []
        ).map((assignment) => ({
          ...assignment,
          library_check_unavailable: true,
        })),
      }),
      available_sponsor_reads: [],
    };
  }
  const readsById = new Map(
    (result.sponsor_reads || []).map((read) => [
      read.sponsor_read_id,
      read,
    ])
  );
  const today = new Date().toISOString().slice(0, 10);
  return {
    episode: sanitizeEpisodeStudioForViewer({
      ...episode,
      sponsor_read_assignments: (episode.sponsor_read_assignments || []).map(
        (assignment) => {
          const current = readsById.get(assignment.sponsor_read_id);
          const currentState = current
            ? getSponsorReadOperationalState(current, today)
            : 'retired';
          return {
            ...assignment,
            library_state: currentState,
            library_version_number: current?.version_number || 0,
            script_changed:
              Boolean(current) &&
              current.version_number !== assignment.version_number,
            script_expired:
              currentState === 'expired' ||
              Boolean(
                assignment.expiration_date &&
                  assignment.expiration_date < today
              ),
            script_retired:
              !current || currentState === 'retired',
          };
        }
      ),
    }),
    available_sponsor_reads: canManage
      ? (result.sponsor_reads || [])
          .filter((read) => isSponsorReadAssignable(read, today))
          .map((read) => ({
            sponsor_read_id: read.sponsor_read_id,
            sponsor_id: read.sponsor_id,
            sponsor_name: read.sponsor_name,
            script_title: read.script_title,
            version_number: read.version_number,
            effective_date: read.effective_date,
            expiration_date: read.expiration_date,
          }))
      : [],
  };
}

export default async function handler(req, res) {
  if (!['GET', 'PATCH', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH,DELETE');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.EPISODES_READ
      : req.method === 'DELETE'
        ? ADMIN_PERMISSIONS.EPISODES_MANAGE
        : ADMIN_PERMISSIONS.EPISODES_UPDATE;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    const episodeId = String(req.query.episodeId || '').trim();
    const result = await getEpisodeStudio(episodeId);
    if (!result.episode) {
      return res
        .status(404)
        .json({ ok: false, error: 'Episode Studio not found.' });
    }
    if (result.episode.deletion_finalized_at) {
      return res
        .status(404)
        .json({ ok: false, error: 'Episode Studio not found.' });
    }

    const canManage = principal.permissions.includes(
      ADMIN_PERMISSIONS.EPISODES_MANAGE
    );
    const binding = await getStudioBindingForSubject(principal.subject);
    const membershipIdentity = binding
      ? {
          person_id: binding.person_id,
          username: principal.username,
          subject: principal.subject,
          account_email: binding.account_email,
          identifiers: [binding.user_sub],
        }
      : {};
    const relationship = getEpisodeRelationshipCapabilities(
      result.episode,
      membershipIdentity,
      principal
    );
    const {
      roles: episodeMembership,
      canHost,
      canReview,
      canUploadAssets,
      canConfigure,
      canAdminOverride,
    } = relationship;
    if (!relationship.canAccess) {
      return res.status(403).json({
        ok: false,
        error: 'This Episode Studio is not assigned to your account.',
      });
    }

    if (req.method === 'DELETE') {
      if (!canManage) {
        return res.status(403).json({
          ok: false,
          error: 'Only a Studio manager can delete an Episode Studio.',
        });
      }
      if (!req.headers['content-type']?.includes('application/json')) {
        return res.status(400).json({
          ok: false,
          error: 'Content-Type must be application/json',
        });
      }

      const expectedUpdatedAt = String(
        req.body?.expected_updated_at || ''
      ).trim();
      const confirmationTitle = String(
        req.body?.confirmation_title || ''
      ).trim();
      if (
        !expectedUpdatedAt ||
        expectedUpdatedAt !== result.episode.updated_at
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'This Episode Studio changed in another session. Refresh before deleting it.',
        });
      }
      if (
        confirmationTitle !== result.episode.title ||
        req.body?.delete_assets !== true
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Type the exact Episode Studio title and confirm permanent file deletion.',
        });
      }

      let deletionEpisode = result.episode;
      try {
        if (
          !deletionEpisode.deleted_at ||
          Number.isNaN(new Date(deletionEpisode.deleted_at).getTime())
        ) {
          const tombstoned = await saveEpisodeStudio(
            {
              ...deletionEpisode,
              deleted_at: new Date().toISOString(),
            },
            { expectedUpdatedAt }
          );
          deletionEpisode = tombstoned.episode;
        }
        const plan = getEpisodeStudioDeletionPlan(deletionEpisode);
        const cleanup = await finalizeEpisodeStudioDeletion(deletionEpisode);
        if (cleanup.pending) {
          const safeReadyAt = getEpisodeDeletionReadyAt(deletionEpisode);
          if (!safeReadyAt) {
            throw new Error(
              'Episode Studio: deletion timing could not be verified.'
            );
          }
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((safeReadyAt.getTime() - Date.now()) / 1000)
          );
          res.setHeader('Retry-After', String(retryAfterSeconds));
          logAdminAction(req, principal, 'episode_studio.delete_pending', {
            episode_id: episodeId,
            title: result.episode.title,
            deletion_ready_at: safeReadyAt.toISOString(),
          });
          return res.status(202).json({
            ok: true,
            pending_deletion: true,
            storage_cleanup_pending:
              cleanup.storage_cleanup_pending === true,
            deletion_ready_at: safeReadyAt.toISOString(),
            retry_after_seconds: retryAfterSeconds,
            episode: sanitizeEpisodeStudioForViewer(deletionEpisode),
          });
        }
        const deletion = {
          episode_id: plan.episode_id,
          title: plan.title,
          deleted_asset_count: plan.asset_count,
          deleted_asset_bytes: plan.asset_bytes,
          deleted_storage_version_count:
            cleanup.deleted_storage_version_count,
        };

        logAdminAction(req, principal, 'episode_studio.delete', {
          episode_id: episodeId,
          title: result.episode.title,
          deleted_asset_count: deletion.deleted_asset_count,
          deleted_asset_bytes: deletion.deleted_asset_bytes,
        });

        return res.status(200).json({
          ok: true,
          durable_cleanup_active: true,
          ...deletion,
        });
      } catch (deleteError) {
        const conflict = /conditional/i.test(
          String(deleteError?.message || '')
        );
        const storage = /Episode asset:|secure storage/i.test(
          String(deleteError?.message || '')
        );
        return res.status(conflict ? 409 : storage ? 502 : 500).json({
          ok: false,
          episode: deletionEpisode.deleted_at
            ? sanitizeEpisodeStudioForViewer(deletionEpisode)
            : undefined,
          error: conflict
            ? 'This Episode Studio changed while deletion was being prepared. Refresh and retry to finish safely.'
            : storage
              ? 'Secure storage could not finish the protected episode-prefix cleanup. The Studio remains locked so deletion can be retried safely.'
            : 'The Episode Studio could not be deleted. Its record was kept.',
        });
      }
    }

    if (req.method === 'PATCH' && result.episode.deleted_at) {
      return res.status(409).json({
        ok: false,
        code: 'EPISODE_STUDIO_DELETION_PENDING',
        error:
          'This Episode Studio is being deleted. Retry the deletion instead of making new changes.',
      });
    }

    const directory = await getPeopleDirectory();
    const { peopleById } = directory;
    const currentAuthorName = getPrincipalAuthorName(
      principal,
      binding,
      directory
    );
    const hostNames = result.episode.host_person_ids.map(
      (personId) => peopleById.get(personId)?.name || personId
    );
    const productionLeadPersonIds =
      getAvailableProductionLeadPersonIds(
        getProductionLeadPersonIds(),
        [...peopleById.values()]
          .filter(
            (person) =>
              person.account_active && person.capabilities.producer
          )
          .map((person) => person.person_id)
      );
    const canAdvanceProduction =
      result.episode.status === 'accepted' &&
      result.episode.production_stage === 'lead_review' &&
      Boolean(binding?.person_id) &&
      result.episode.production_lead_person_id === binding.person_id;

    if (req.method === 'GET') {
      const viewCapabilities = getEpisodeStudioViewCapabilities(
        {
          canManage,
          canHost,
          canReview,
          canUploadAssets,
          canConfigure,
          canAdminOverride,
          canAdvanceProduction,
        },
        String(req.query.view || '')
      );
      const sponsorData = await sponsorReadResponseData(
        resolveMessageAuthors(
          filterEpisodeAssetsForViewer(result.episode, {
            roles: episodeMembership,
            canManage,
            viewerPersonId: binding?.person_id || '',
          }),
          directory,
          principal,
          currentAuthorName
        ),
        viewCapabilities.canConfigure
      );
      return res.status(200).json({
        ok: true,
        configured: result.configured,
        ...viewCapabilities,
        production_handoff_available: productionLeadPersonIds.length > 0,
        production_lead_name:
          peopleById.get(result.episode.production_lead_person_id)?.name ||
          '',
        viewer_person_id: binding?.person_id || '',
        episode_roles: episodeMembership,
        episode: sponsorData.episode,
        available_sponsor_reads: sponsorData.available_sponsor_reads,
        asset_uploads_configured: isEpisodeAssetStorageConfigured(),
        completion: getEpisodeCompletion(result.episode),
        host_names: hostNames,
        people: viewCapabilities.canConfigure
          ? directory.hosts.map(({ person_id, name, account_active }) => ({
              person_id,
              name,
              account_active,
            }))
          : [],
        producers: viewCapabilities.canConfigure
          ? directory.producers.map(
              ({ person_id, name, account_email, account_active }) => ({
                person_id,
                name,
                account_active,
                ...(viewCapabilities.canManage ? { account_email } : {}),
              })
            )
          : [],
      });
    }

    if (!req.headers['content-type']?.includes('application/json')) {
      return res
        .status(400)
        .json({ ok: false, error: 'Content-Type must be application/json' });
    }

    const action = String(req.body?.action || 'save').trim();
    const allowedActions = new Set([
      'save',
      'submit',
      'set_delivery_health',
      'message',
      'update_communication_note',
      'review',
      'override_review',
      'update',
      'assign_sponsor_read',
      'remove_sponsor_read',
      'update_sponsor_read_assignment',
      'configure_checklist',
      'configure_workflow',
      'add_workflow_task',
      'edit_workflow_task',
      'move_workflow_task',
      'update_workflow_task',
      'update_photo_selection',
      'advance_production',
    ]);
    if (!allowedActions.has(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a valid Episode Studio action.',
      });
    }
    const expectedUpdatedAt = String(req.body?.expected_updated_at || '');
    let nextEpisode;
    let notification = null;
    const previousDeliveryHealth = result.episode.delivery_health;

    if (
      action === 'add_workflow_task' ||
      action === 'edit_workflow_task'
    ) {
      if (
        !canEditEpisodeProductionTaskStructure({ canManage, canReview })
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'Only the assigned producer or a Studio manager can add or edit production tasks.',
        });
      }
      const taskInput =
        req.body?.task && typeof req.body.task === 'object'
          ? req.body.task
          : {};
      const structureInput = productionTaskStructureInput(taskInput);
      const editableStructureFields = [
        'label',
        'title',
        'description',
        'instructions',
        'phase',
        'owner_type',
        'assigned_person_ids',
        'days_before_air',
        'due_date',
        'due_date_overridden',
        'dependencies',
        'required',
      ];
      if (
        !editableStructureFields.some((field) =>
          Object.prototype.hasOwnProperty.call(structureInput, field)
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Choose production task details to save.',
        });
      }
      const currentTasks = Array.isArray(result.episode.production_tasks)
        ? result.episode.production_tasks
        : [];
      if (!currentTasks.length) {
        return res.status(409).json({
          ok: false,
          error:
            'Enable the default production workflow before adding or editing tasks.',
        });
      }
      const actor = {
        personId: binding?.person_id || '',
        personName: currentAuthorName,
        canManage,
        canReview,
      };
      const workflowUpdatedAt = new Date().toISOString();
      try {
        let structuredEpisode;
        let previousTask = null;
        let savedTaskId = '';
        if (action === 'add_workflow_task') {
          delete structureInput.task_id;
          delete structureInput.id;
          delete structureInput.kind;
          delete structureInput.linked_deliverable_ids;
          savedTaskId = createCustomProductionTaskId(currentTasks);
          structuredEpisode = addEpisodeProductionTaskDefinition(
            result.episode,
            structureInput,
            actor,
            { taskId: savedTaskId, now: workflowUpdatedAt }
          );
        } else {
          savedTaskId = String(req.body?.task_id || '').trim();
          previousTask = currentTasks.find(
            (task) => productionTaskId(task) === savedTaskId
          );
          if (!previousTask) {
            return res.status(404).json({
              ok: false,
              error: 'Production workflow task not found.',
            });
          }
          structuredEpisode = editEpisodeProductionTaskDefinition(
            result.episode,
            savedTaskId,
            structureInput,
            actor,
            { now: workflowUpdatedAt }
          );
        }
        const savedTask = structuredEpisode.production_tasks.find(
          (task) => productionTaskId(task) === savedTaskId
        );
        validateProductionTaskAssignees(
          savedTask,
          previousTask,
          peopleById
        );
        nextEpisode = normalizeEpisodeStudio({
          ...structuredEpisode,
          production_workflow_updated_at: workflowUpdatedAt,
          production_workflow_updated_by_person_id:
            binding?.person_id || '',
          production_workflow_updated_by_name: currentAuthorName,
        });
      } catch (workflowError) {
        const workflowMessage = String(workflowError?.message || '');
        const conflict = /cycle|depend|completed task|at most 50 tasks/i.test(
          workflowMessage
        );
        return res.status(conflict ? 409 : 400).json({
          ok: false,
          error:
            workflowMessage ||
            'Could not save the production task structure.',
        });
      }
    } else if (action === 'move_workflow_task') {
      if (
        !canEditEpisodeProductionTaskStructure({ canManage, canReview })
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'Only the assigned producer or a Studio manager can move production tasks.',
        });
      }
      const currentTasks = Array.isArray(result.episode.production_tasks)
        ? result.episode.production_tasks
        : [];
      if (!currentTasks.length) {
        return res.status(409).json({
          ok: false,
          error:
            'Enable the default production workflow before moving tasks.',
        });
      }
      const taskId = String(req.body?.task_id || '').trim();
      if (
        !taskId ||
        !currentTasks.some(
          (task) => productionTaskId(task) === taskId
        )
      ) {
        return res.status(404).json({
          ok: false,
          error: 'Production workflow task not found.',
        });
      }

      const workflowUpdatedAt = new Date().toISOString();
      try {
        const movedEpisode = moveEpisodeProductionTaskDefinition(
          result.episode,
          taskId,
          {
            target_phase: req.body?.target_phase,
            target_index: req.body?.target_index,
          },
          {
            personId: binding?.person_id || '',
            personName: currentAuthorName,
            canManage,
            canReview,
          }
        );
        nextEpisode = normalizeEpisodeStudio({
          ...movedEpisode,
          production_workflow_updated_at: workflowUpdatedAt,
          production_workflow_updated_by_person_id:
            binding?.person_id || '',
          production_workflow_updated_by_name: currentAuthorName,
        });
      } catch (workflowError) {
        const workflowMessage = String(workflowError?.message || '');
        return res.status(400).json({
          ok: false,
          error:
            workflowMessage || 'Could not move the production workflow task.',
        });
      }
    } else if (action === 'configure_workflow') {
      if (!canManage) {
        return res.status(403).json({
          ok: false,
          error:
            'Only a Studio manager can configure production deadlines and owners.',
        });
      }
      const resetToDefault = req.body?.reset_to_default === true;
      const currentTasks = Array.isArray(result.episode.production_tasks)
        ? result.episode.production_tasks
        : [];
      if (resetToDefault && currentTasks.length) {
        return res.status(409).json({
          ok: false,
          error:
            'This episode already has a production workflow. Edit its current deadlines and owners instead of resetting completed work.',
        });
      }
      if (
        !resetToDefault &&
        !Array.isArray(req.body?.production_tasks)
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Send the production tasks that should be configured.',
        });
      }
      if (!resetToDefault && !currentTasks.length) {
        return res.status(409).json({
          ok: false,
          error:
            'Enable the default production workflow before customizing its deadlines and owners.',
        });
      }

      const configuredAt = new Date().toISOString();
      const workflowEpisode = withProducerProofDeliverable(result.episode);
      const productionTasks = resetToDefault
        ? createDefaultEpisodeProductionTasks(
            workflowEpisode.target_release_date
          )
        : configureProductionTasks(
            workflowEpisode,
            req.body.production_tasks,
            peopleById
          );
      nextEpisode = normalizeEpisodeStudio({
        ...workflowEpisode,
        production_tasks: productionTasks,
        production_workflow_updated_at: configuredAt,
        production_workflow_updated_by_person_id: binding?.person_id || '',
        production_workflow_updated_by_name: currentAuthorName,
      });
    } else if (action === 'update_workflow_task') {
      const tasks = Array.isArray(result.episode.production_tasks)
        ? result.episode.production_tasks
        : [];
      const taskId = String(req.body?.task_id || '').trim();
      const task = tasks.find(
        (candidate) => productionTaskId(candidate) === taskId
      );
      if (!task) {
        return res.status(404).json({
          ok: false,
          error: 'Production workflow task not found.',
        });
      }
      const actorRoles = [
        ...new Set([
          ...episodeMembership,
          ...(Array.isArray(principal.groups) ? principal.groups : []),
        ]),
      ];
      if (
        !canManage &&
        !isEpisodeProductionTaskOwner(
          task,
          result.episode,
          binding?.person_id || '',
          actorRoles
        )
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'Only this task’s assigned owner or a Studio manager can update it.',
        });
      }

      const taskInput =
        req.body?.task && typeof req.body.task === 'object'
          ? req.body.task
          : req.body || {};
      const patch = {};
      for (const field of WORKFLOW_UPDATE_FIELDS) {
        if (Object.prototype.hasOwnProperty.call(taskInput, field)) {
          patch[field] = taskInput[field];
        }
      }
      if (!Object.keys(patch).length) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a production task update.',
        });
      }
      const managerOnlyFields = [
        'assigned_person_ids',
        'due_date',
        'due_date_overridden',
      ];
      if (
        !canManage &&
        managerOnlyFields.some((field) =>
          Object.prototype.hasOwnProperty.call(patch, field)
        )
      ) {
        return res.status(403).json({
          ok: false,
          error:
            'Only a Studio manager can change a production task deadline or owner.',
        });
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'assigned_person_ids')) {
        const personIds = [
          ...new Set(
            (Array.isArray(patch.assigned_person_ids)
              ? patch.assigned_person_ids
              : []
            )
              .map((personId) => String(personId || '').trim())
              .filter(Boolean)
          ),
        ].slice(0, 8);
        if (
          personIds.some((personId) => !peopleById.has(personId)) ||
          (task.owner_type === 'person' && !personIds.length)
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'Choose a current team profile for this production task owner.',
          });
        }
        const assignmentChanged = !hasSamePersonIds(
          personIds,
          task.assigned_person_ids
        );
        if (
          assignmentChanged &&
          personIds.some(
            (personId) => {
              const person = peopleById.get(personId);
              return (
                person?.account_active !== true ||
                (!person?.capabilities?.host &&
                  !person?.capabilities?.producer)
              );
            }
          )
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'Choose an active host or producer for this production task owner.',
          });
        }
        patch.assigned_person_ids = personIds;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'due_date_overridden')) {
        if (typeof patch.due_date_overridden !== 'boolean') {
          return res.status(400).json({
            ok: false,
            error: 'Choose whether this task uses a custom deadline.',
          });
        }
        if (
          patch.due_date_overridden === true &&
          !Object.prototype.hasOwnProperty.call(patch, 'due_date')
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Add the custom task deadline before saving it.',
          });
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'due_date') &&
        patch.due_date_overridden !== false
      ) {
        const dueDate = cleanWorkflowDate(patch.due_date);
        if (!dueDate) {
          return res.status(400).json({
            ok: false,
            error: 'Choose a valid production task deadline.',
          });
        }
        patch.due_date = dueDate;
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'status')) {
        const requestedStatus = String(patch.status || '').trim();
        patch.status = ['completed', 'done'].includes(requestedStatus)
          ? 'complete'
          : requestedStatus === 'blocked'
            ? 'in_progress'
            : requestedStatus;
        if (
          ![
            'not_started',
            'in_progress',
            'complete',
            'waived',
          ].includes(patch.status)
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Choose a valid production task status.',
          });
        }
        if (patch.status === 'waived' && !canManage) {
          return res.status(403).json({
            ok: false,
            error: 'Only a Studio manager can waive a required task.',
          });
        }
      }
      if (
        Object.prototype.hasOwnProperty.call(patch, 'evidence_url') &&
        String(patch.evidence_url || '').trim() &&
        !isSafeEpisodeMaterialUrl(patch.evidence_url)
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Production evidence links must use secure HTTPS.',
        });
      }
      if (Object.prototype.hasOwnProperty.call(patch, 'subtasks')) {
        if (!Array.isArray(patch.subtasks)) {
          return res.status(400).json({
            ok: false,
            error: 'Production task substeps must be a list.',
          });
        }
        patch.subtasks = patch.subtasks.map((subtask) => ({
          ...subtask,
          id: subtask?.id || subtask?.subtask_id,
          completed:
            subtask?.completed === true || subtask?.complete === true,
        }));
      }

      const resultingStatus = patch.status || task.status;
      if (taskId === INTRO_TASK_ID && resultingStatus === 'complete') {
        const introMethod = String(
          patch.intro_method ?? task.intro_method ?? ''
        ).trim();
        if (!['recorded', 'scheduled_with_producer'].includes(introMethod)) {
          return res.status(400).json({
            ok: false,
            error:
              'Choose whether the intro was uploaded or scheduled with the producer before completing this step.',
          });
        }
        patch.intro_method = introMethod;
        if (
          introMethod === 'recorded' &&
          !hasUploadedDeliverableAsset(result.episode, 'intro-audio')
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'Upload the recorded intro audio before completing this workflow step.',
          });
        }
        if (introMethod === 'scheduled_with_producer') {
          const scheduledFor = cleanWorkflowDate(
            patch.intro_scheduled_for ?? task.intro_scheduled_for
          );
          const latestAllowed = daysBeforeDate(
            result.episode.target_release_date,
            INTRO_RECORDING_LATEST_DAYS_BEFORE_AIR
          );
          if (!scheduledFor) {
            return res.status(400).json({
              ok: false,
              error:
                'Add the scheduled producer recording date before completing this step.',
            });
          }
          if (!latestAllowed || scheduledFor > latestAllowed) {
            return res.status(400).json({
              ok: false,
              error: `Schedule the producer recording session on or before ${
                latestAllowed || 'ten days before air'
              }.`,
            });
          }
          patch.intro_scheduled_for = scheduledFor;
        }
      }

      const currentProducerProof = getCurrentUploadedDeliverableAsset(
        result.episode,
        PRODUCER_PROOF_DELIVERABLE_ID
      );
      const hasProducerProof = Boolean(currentProducerProof);
      if (
        [PRODUCER_PROOF_TASK_ID, PROOF_APPROVAL_TASK_ID].includes(taskId) &&
        resultingStatus === 'complete' &&
        !hasProducerProof
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'The producer must upload the private proof before this step can be completed.',
        });
      }
      if (taskId === PROOF_APPROVAL_TASK_ID) {
        const proofDecision = String(
          patch.proof_decision ?? task.proof_decision ?? 'pending'
        ).trim();
        if (
          !['pending', 'approved', 'changes_requested'].includes(
            proofDecision
          )
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Choose a valid private-proof decision.',
          });
        }
        patch.proof_decision = proofDecision;
        if (proofDecision !== 'pending') {
          if (!hasProducerProof) {
            return res.status(400).json({
              ok: false,
              error:
                'Download and review the uploaded private proof before recording a decision.',
            });
          }
          patch.evidence_asset_id = currentProducerProof.asset_id;
        }
        if (resultingStatus === 'complete' && proofDecision !== 'approved') {
          return res.status(400).json({
            ok: false,
            error: 'Approve the private proof before completing this step.',
          });
        }
        if (proofDecision === 'approved' && resultingStatus !== 'complete') {
          return res.status(400).json({
            ok: false,
            error:
              'Mark the private proof complete when recording its approval.',
          });
        }
        if (proofDecision === 'changes_requested') {
          if (resultingStatus !== 'in_progress') {
            return res.status(400).json({
              ok: false,
              error:
                'A proof with requested changes must remain in progress.',
            });
          }
          if (
            String(
              patch.note ?? task.evidence_note ?? task.note ?? ''
            ).trim().length < 4
          ) {
            return res.status(400).json({
              ok: false,
              error: 'Add a short note describing the requested proof change.',
            });
          }
        }
      }
      if (
        patch.status === 'waived' &&
        String(
          patch.note ?? task.evidence_note ?? task.note ?? ''
        ).trim().length < 4
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Add a short audit note before waiving this task.',
        });
      }

      const workflowUpdatedAt = new Date().toISOString();
      try {
        const updated = applyEpisodeProductionTaskUpdate(
          result.episode,
          taskId,
          patch,
          {
            personId: binding?.person_id || '',
            personName: currentAuthorName,
            roles: actorRoles,
            canManage,
          },
          { now: workflowUpdatedAt }
        );
        nextEpisode = normalizeEpisodeStudio({
          ...updated,
          production_workflow_updated_at: workflowUpdatedAt,
          production_workflow_updated_by_person_id:
            binding?.person_id || '',
          production_workflow_updated_by_name: currentAuthorName,
        });
      } catch (workflowError) {
        const workflowMessage = String(workflowError?.message || '');
        return res.status(/depend|prerequi/i.test(workflowMessage) ? 409 : 400).json({
          ok: false,
          error:
            workflowMessage || 'Could not update the production workflow task.',
        });
      }
    } else if (action === 'update_photo_selection') {
      const hostCanEditPhotos =
        canHost && !HOST_LOCKED_STATUSES.includes(result.episode.status);
      if (!canManage && !canReview && !hostCanEditPhotos) {
        return res.status(403).json({
          ok: false,
          error:
            'Only an assigned host, the assigned producer, or a Studio manager can review final episode photos.',
        });
      }
      if (result.episode.archived || result.episode.status === 'accepted') {
        return res.status(409).json({
          ok: false,
          error:
            'The confirmed photo history is read-only after the episode is accepted or archived.',
        });
      }
      if (
        !req.body?.photo_selection ||
        typeof req.body.photo_selection !== 'object' ||
        Array.isArray(req.body.photo_selection)
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Choose the final episode photo set to save.',
        });
      }
      try {
        nextEpisode = updateEpisodePhotoSelection(
          result.episode,
          req.body.photo_selection,
          {
            personId: binding?.person_id || '',
            personName: currentAuthorName,
          },
          { now: new Date() }
        );
      } catch (photoError) {
        return res.status(400).json({
          ok: false,
          error:
            String(photoError?.message || '') ||
            'Could not save the final episode photo set.',
        });
      }
    } else if (action === 'advance_production') {
      if (!canAdvanceProduction) {
        return res.status(403).json({
          ok: false,
          error:
            'Only the production lead currently holding this handoff can advance it.',
        });
      }
      nextEpisode = buildProductionAdvance(result.episode, {
        actorPersonId: binding.person_id,
        actorName: currentAuthorName,
        leadPersonIds: productionLeadPersonIds,
      });
    } else if (action === 'set_delivery_health') {
      if (result.episode.status === 'accepted') {
        return res.status(409).json({
          ok: false,
          error:
            'Accepted episodes are complete. Reopen the episode before changing its delivery outlook.',
        });
      }
      const deliveryHealth = String(req.body?.delivery_health || '');
      if (!['on_track', 'off_track'].includes(deliveryHealth)) {
        return res.status(400).json({
          ok: false,
          error: 'Choose On track or Off track.',
        });
      }
      nextEpisode = {
        ...result.episode,
        delivery_health: deliveryHealth,
        delivery_health_updated_at: new Date().toISOString(),
        delivery_health_updated_by_person_id: binding?.person_id || '',
        delivery_health_updated_by_name: currentAuthorName,
        delivery_health_updated_by_role: getDeliveryHealthActorRole(
          principal,
          binding,
          result.episode
        ),
      };
    } else if (action === 'update_communication_note') {
      if (!canReview && !canAdminOverride) {
        return res.status(403).json({
          ok: false,
          error: 'Only a producer or Studio manager can update host direction.',
        });
      }
      nextEpisode = normalizeEpisodeStudio({
        ...result.episode,
        producer_feedback: String(req.body?.producer_feedback || '')
          .trim()
          .slice(0, 4000),
      });
    } else if (action === 'message') {
      const body = String(req.body?.message || '').trim().slice(0, 2400);
      if (body.length < 2) {
        return res.status(400).json({
          ok: false,
          error: 'Write a message before posting it.',
        });
      }
      nextEpisode = {
        ...result.episode,
        messages: [
          ...(result.episode.messages || []),
          {
            message_id: `message-${crypto.randomUUID()}`,
            body,
            author_name: currentAuthorName,
            author_role: canReview
              ? 'producer'
              : canHost
                ? 'host'
                : canManage
                  ? 'studio_manager'
                  : 'creator',
            created_at: new Date().toISOString(),
          },
        ].slice(-100),
      };
    } else if (action === 'assign_sponsor_read') {
      if (!canConfigure) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const readId = String(req.body?.sponsor_read_id || '').trim();
      const readResult = await getSponsorRead(readId);
      const read = readResult.sponsor_read;
      if (!read || !isSponsorReadAssignable(read)) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a current approved sponsor read.',
        });
      }
      const existingAssignment = result.episode.sponsor_read_assignments.find(
        (assignment) => assignment.sponsor_read_id === read.sponsor_read_id
      );
      const snapshot = {
        assignment_id:
          existingAssignment?.assignment_id ||
          `sponsor-read-assignment-${crypto.randomUUID()}`,
        sponsor_read_id: read.sponsor_read_id,
        sponsor_id: read.sponsor_id,
        sponsor_name: read.sponsor_name,
        script_title: read.script_title,
        approved_text: read.approved_text,
        pronunciation_guidance: read.pronunciation_guidance,
        host_instructions: read.host_instructions,
        effective_date: read.effective_date,
        expiration_date: read.expiration_date,
        version_number: read.version_number,
        source_state: read.state,
        requires_audio: req.body?.requires_audio === true,
        recording_mode:
          req.body?.recording_mode === 'included_in_voice_file'
            ? 'included_in_voice_file'
            : 'separate_upload',
        audio_asset_id: existingAssignment?.audio_asset_id || '',
        audio_url: existingAssignment?.audio_url || '',
        completed:
          req.body?.requires_audio === true
            ? existingAssignment?.completed === true
            : true,
        assigned_at: new Date().toISOString(),
        assigned_by_person_id: binding?.person_id || '',
        assigned_by_name: currentAuthorName,
        completed_at: existingAssignment?.completed_at || '',
        completed_by_person_id:
          existingAssignment?.completed_by_person_id || '',
        completed_by_name: existingAssignment?.completed_by_name || '',
      };
      nextEpisode = normalizeEpisodeStudio({
        ...result.episode,
        sponsor_read_assignments: [
          ...result.episode.sponsor_read_assignments.filter(
            (assignment) =>
              assignment.sponsor_read_id !== read.sponsor_read_id
          ),
          snapshot,
        ],
      });
    } else if (action === 'remove_sponsor_read') {
      if (!canConfigure) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const assignmentId = String(req.body?.assignment_id || '').trim();
      nextEpisode = normalizeEpisodeStudio({
        ...result.episode,
        sponsor_read_assignments:
          result.episode.sponsor_read_assignments.filter(
            (assignment) => assignment.assignment_id !== assignmentId
          ),
      });
    } else if (action === 'update_sponsor_read_assignment') {
      if (!canHost && !canManage) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (
        !canManage &&
        HOST_LOCKED_STATUSES.includes(result.episode.status)
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'This sponsor read is locked while the package is with the producer.',
        });
      }
      const assignmentId = String(req.body?.assignment_id || '').trim();
      const assignment = result.episode.sponsor_read_assignments.find(
        (candidate) => candidate.assignment_id === assignmentId
      );
      if (!assignment) {
        return res.status(404).json({
          ok: false,
          error: 'Sponsor read assignment not found.',
        });
      }
      const audioUrl = String(req.body?.audio_url || '').trim();
      const audioAssetId = String(req.body?.audio_asset_id || '').trim();
      const completed = req.body?.completed === true;
      const audioAsset = result.episode.assets.find(
        (candidate) =>
          candidate.asset_id === audioAssetId &&
          candidate.content_type.startsWith('audio/')
      );
      if (
        assignment.requires_audio &&
        completed &&
        !audioAsset &&
        !isSafeEpisodeMaterialUrl(audioUrl)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Add a secure HTTPS sponsor-audio link before marking this read complete.',
        });
      }
      nextEpisode = normalizeEpisodeStudio({
        ...result.episode,
        sponsor_read_assignments:
          result.episode.sponsor_read_assignments.map((candidate) =>
            candidate.assignment_id === assignmentId
              ? {
                  ...candidate,
                  audio_asset_id: audioAsset?.asset_id || '',
                  audio_url: audioUrl,
                  completed,
                  completed_at: completed ? new Date().toISOString() : '',
                  completed_by_person_id: completed
                    ? binding?.person_id || ''
                    : '',
                  completed_by_name: completed ? currentAuthorName : '',
                }
              : candidate
          ),
      });
    } else if (action === 'configure_checklist') {
      if (!canConfigure) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (
        ['submitted', 'submitted_with_gaps', 'accepted'].includes(
          result.episode.status
        )
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'Reopen the host package before changing its checklist structure.',
        });
      }
      nextEpisode = configureEpisodeDeliverables(
        result.episode,
        req.body?.deliverables
      );
      nextEpisode = normalizeEpisodeStudio({
        ...nextEpisode,
        canonical_assets_required:
          req.body?.canonical_assets_required === true,
      });
    } else if (
      (canReview && action === 'review') ||
      (canAdminOverride && action === 'override_review')
    ) {
      const status = String(req.body?.status || '');
      if (!PRODUCER_REVIEW_STATUSES.includes(status)) {
        return res
          .status(400)
          .json({ ok: false, error: 'Choose a valid producer status.' });
      }
      if (
        status === 'accepted' &&
        !['submitted', 'submitted_with_gaps'].includes(result.episode.status)
      ) {
        return res.status(409).json({
          ok: false,
          error: 'Hosts must submit the episode package before it is accepted.',
        });
      }
      if (
        status === 'needs_changes' &&
        !['submitted', 'submitted_with_gaps', 'accepted'].includes(
          result.episode.status
        )
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'Changes can be requested only after the host package is submitted.',
        });
      }
      const stagedEpisodeUrl = String(
        req.body?.staged_episode_url ?? result.episode.staged_episode_url
      ).trim();
      if (
        stagedEpisodeUrl &&
        !isSafeSpotifyStagingUrl(stagedEpisodeUrl)
      ) {
        return res.status(400).json({
          ok: false,
          error:
            'Use a secure Spotify staging link from spotify.com or spotify.link.',
        });
      }
      if (
        status === 'needs_changes' &&
        !String(req.body?.producer_feedback || '').trim()
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Add a producer note before requesting changes.',
        });
      }
      if (
        status === 'accepted' &&
        !productionLeadPersonIds.length
      ) {
        return res.status(409).json({
          ok: false,
          error:
            'No active production lead is available. Assign an active production lead before accepting this package.',
        });
      }
      const overrideReason = String(req.body?.override_reason || '')
        .trim()
        .slice(0, 1000);
      if (action === 'override_review' && overrideReason.length < 8) {
        return res.status(400).json({
          ok: false,
          error: 'Add an audit reason for the administrator override.',
        });
      }
      const nextLeadPersonId =
        status === 'accepted'
          ? getNextProductionLeadPersonId(
              result.episode.producer_person_id,
              productionLeadPersonIds
            )
          : '';
      nextEpisode = {
        ...result.episode,
        status,
        production_stage:
          status === 'accepted'
            ? nextLeadPersonId
              ? 'lead_review'
              : 'complete'
            : 'host_preparation',
        production_lead_person_id: nextLeadPersonId,
        production_handoff_at:
          status === 'accepted' ? new Date().toISOString() : '',
        production_completed_at:
          status === 'accepted' && !nextLeadPersonId
            ? new Date().toISOString()
            : '',
        production_advanced_by_person_id:
          status === 'accepted' ? binding?.person_id || '' : '',
        production_advanced_by_name:
          status === 'accepted' ? currentAuthorName : '',
        staged_episode_url: stagedEpisodeUrl,
        producer_feedback: req.body?.producer_feedback || '',
        reviewed_at: new Date().toISOString(),
        reviewed_by_person_id: binding?.person_id || '',
        reviewed_by_name: currentAuthorName,
        review_override: action === 'override_review',
        review_override_reason:
          action === 'override_review' ? overrideReason : '',
      };
    } else if (canManage && action === 'update') {
      let configuredEpisode = Array.isArray(
        req.body?.episode?.deliverables
      )
        ? configureEpisodeDeliverables(
            result.episode,
            req.body.episode.deliverables
          )
        : result.episode;
      if (
        Array.isArray(req.body?.episode?.production_tasks) &&
        result.episode.production_tasks.length
      ) {
        const workflowUpdatedAt = new Date().toISOString();
        configuredEpisode = withProducerProofDeliverable(configuredEpisode);
        configuredEpisode = normalizeEpisodeStudio({
          ...configuredEpisode,
          production_tasks: configureProductionTasks(
            configuredEpisode,
            req.body.episode.production_tasks,
            peopleById
          ),
          production_workflow_updated_at: workflowUpdatedAt,
          production_workflow_updated_by_person_id:
            binding?.person_id || '',
          production_workflow_updated_by_name: currentAuthorName,
        });
      }
      const proposed = mergeEpisodeStudioManagerValues(
        configuredEpisode,
        req.body?.episode
      );
      if (
        !proposed.host_person_ids.length ||
        proposed.host_person_ids.some(
          (personId) => !peopleById.get(personId)?.capabilities.host
        )
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Every assignment must point to a host profile.',
        });
      }
      if (
        proposed.producer_person_id &&
        !peopleById.get(proposed.producer_person_id)?.capabilities.producer
      ) {
        return res.status(400).json({
          ok: false,
          error: 'Choose a valid producer profile.',
        });
      }
      const selectedProducer = peopleById.get(proposed.producer_person_id);
      if (!proposed.producer_email && selectedProducer?.account_email) {
        proposed.producer_email = selectedProducer.account_email;
      }
      nextEpisode =
        canHost && !HOST_LOCKED_STATUSES.includes(result.episode.status)
        ? mergeHostDeliverableValues(proposed, req.body?.episode?.deliverables)
        : proposed;
    } else {
      if (
        !canHost ||
        !principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_UPDATE)
      ) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (
        action === 'submit' &&
        !principal.permissions.includes(ADMIN_PERMISSIONS.EPISODES_SUBMIT)
      ) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (HOST_LOCKED_STATUSES.includes(result.episode.status)) {
        return res.status(409).json({
          ok: false,
          error:
            'This episode is with the producer. A producer must request changes before hosts can edit it again.',
        });
      }

      const hostDeliverables = mergeHostDeliverableValues(
        result.episode,
        req.body?.deliverables || []
      );
      nextEpisode = normalizeEpisodeStudio(
        {
          ...hostDeliverables,
          producer_directions: Object.prototype.hasOwnProperty.call(
            req.body || {},
            'producer_directions'
          )
            ? req.body.producer_directions
            : result.episode.producer_directions,
        },
        result.episode
      );
      if (action === 'submit') {
        const baseCompletion = getEpisodeCompletion(nextEpisode);
        const submissionMode = String(req.body?.submission_mode || 'complete');
        const provisional = submissionMode === 'with_gaps';
        let trackerResult;
        try {
          trackerResult = await getMicKitTracker();
        } catch (micKitError) {
          console.error(
            'episode microphone plan validation unavailable:',
            micKitError
          );
          return res.status(503).json({
            ok: false,
            code: 'EPISODE_MICROPHONE_PLAN_VALIDATION_UNAVAILABLE',
            error:
              'The microphone request tracker could not be verified. Try submitting again before sending this package to the producer.',
            completion: baseCompletion,
          });
        }
        const microphonePlan = getEpisodeMicKitSubmissionReadiness(
          nextEpisode,
          trackerResult.tracker
        );
        const completion = applyEpisodeMicKitReadinessToCompletion(
          baseCompletion,
          microphonePlan
        );

        if (
          microphonePlan.required &&
          !microphonePlan.complete &&
          ((!provisional && !completion.can_submit) ||
            (provisional && !completion.can_submit_with_gaps))
        ) {
          return res.status(provisional ? 400 : 409).json({
            ok: false,
            code: 'EPISODE_MICROPHONE_PLAN_UNRESOLVED',
            error: provisional
              ? 'Acknowledge the unresolved Microphone plan with a short resolution note before submitting with known gaps.'
              : 'Every assigned host must resolve the Microphone plan. Connect an active episode mic-kit request, document tested equipment, or confirm that no kit is needed.',
            completion,
            microphone_plan: microphonePlan,
          });
        }

        if (
          (!provisional && !completion.can_submit) ||
          (provisional && !completion.can_submit_with_gaps)
        ) {
          return res.status(400).json({
            ok: false,
            code: 'EPISODE_INCOMPLETE',
            error: provisional
              ? 'Acknowledge every missing item and explain the plan to resolve it before sending this package.'
              : 'Complete every required item before sending this episode to the producer.',
            completion,
          });
        }

        nextEpisode.status = provisional
          ? 'submitted_with_gaps'
          : 'submitted';
        nextEpisode.production_stage = 'producer_review';
        nextEpisode.production_lead_person_id = '';
        nextEpisode.production_handoff_at = '';
        nextEpisode.production_completed_at = '';
        nextEpisode.production_advanced_by_person_id = '';
        nextEpisode.production_advanced_by_name = '';
        nextEpisode.submitted_at = new Date().toISOString();
        nextEpisode.producer_feedback = '';
      } else if (result.episode.status === 'planning') {
        nextEpisode.status = 'in_progress';
      }
    }

    const saved = await saveEpisodeStudio(nextEpisode, {
      expectedUpdatedAt,
    });
    const submitted =
      action === 'submit' &&
      ['submitted', 'submitted_with_gaps'].includes(saved.episode.status);

    if (submitted) {
      try {
        notification = await sendEpisodeSubmissionNotification(saved.episode, {
          hostNames,
          provisional: saved.episode.status === 'submitted_with_gaps',
        });
      } catch (notificationError) {
        console.error(
          'episode studio producer notification failed:',
          notificationError
        );
        notification = {
          sent: false,
          reason:
            'The episode was submitted, but the producer email could not be sent.',
        };
      }
    }

    try {
      await publishEpisodeNotifications({
        previousEpisode: result.episode,
        episode: saved.episode,
        action,
        actorPersonId: binding?.person_id || '',
        actorName: currentAuthorName,
        productionLeadPersonIds,
      });
    } catch (notificationError) {
      console.error(
        'episode studio in-app notification generation failed:',
        notificationError
      );
    }

    logAdminAction(req, principal, `episode_studio.${action}`, {
      episode_id: saved.episode.episode_id,
      status: saved.episode.status,
      completion: getEpisodeCompletion(saved.episode).percent,
      ...(action === 'set_delivery_health'
        ? {
            previous_delivery_health: previousDeliveryHealth,
            delivery_health: saved.episode.delivery_health,
            delivery_health_updated_by_name:
              saved.episode.delivery_health_updated_by_name,
            delivery_health_updated_by_role:
              saved.episode.delivery_health_updated_by_role,
          }
        : {}),
    });

    const responseRelationship = getEpisodeRelationshipCapabilities(
      saved.episode,
      membershipIdentity,
      principal
    );
    const responseEpisode = resolveMessageAuthors(
      filterEpisodeAssetsForViewer(saved.episode, {
        roles: responseRelationship.roles,
        canManage: responseRelationship.canManage,
        viewerPersonId: binding?.person_id || '',
      }),
      directory,
      principal,
      currentAuthorName
    );
    const sponsorData = await sponsorReadResponseData(
      responseEpisode,
      canConfigure
    );
    const responseCanAdvanceProduction =
      saved.episode.status === 'accepted' &&
      saved.episode.production_stage === 'lead_review' &&
      Boolean(binding?.person_id) &&
      saved.episode.production_lead_person_id === binding.person_id;
    return res.status(200).json({
      ok: true,
      episode: sponsorData.episode,
      available_sponsor_reads: sponsorData.available_sponsor_reads,
      asset_uploads_configured: isEpisodeAssetStorageConfigured(),
      completion: getEpisodeCompletion(saved.episode),
      host_names: saved.episode.host_person_ids.map(
        (personId) => peopleById.get(personId)?.name || personId
      ),
      canManage: responseRelationship.canManage,
      canHost: responseRelationship.canHost,
      canReview: responseRelationship.canReview,
      canUploadAssets: responseRelationship.canUploadAssets,
      canConfigure: responseRelationship.canConfigure,
      canAdminOverride: responseRelationship.canAdminOverride,
      canAdvanceProduction: responseCanAdvanceProduction,
      production_handoff_available: productionLeadPersonIds.length > 0,
      production_lead_name:
        peopleById.get(saved.episode.production_lead_person_id)?.name ||
        '',
      viewer_person_id: binding?.person_id || '',
      episode_roles: responseRelationship.roles,
      notification,
    });
  } catch (err) {
    console.error('episode studio detail error:', err);
    const message = String(err.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /Episode Studio:|required|invalid|HTTPS/i.test(message);
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'This Episode Studio changed in another session. Refresh before saving.'
        : message || 'Failed to update the Episode Studio.',
    });
  }
}
