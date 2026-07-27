import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../lib/adminAuth';
import { logAdminAction } from '../../../../lib/adminAudit';
import {
  getEpisodeRelationshipCapabilities,
  getEpisodeCompletion,
  configureEpisodeDeliverables,
  mergeEpisodeStudioManagerValues,
  mergeHostDeliverableValues,
  normalizeEpisodeStudio,
  isSafeEpisodeMaterialUrl,
  isSafeSpotifyStagingUrl,
  sanitizeEpisodeStudioForViewer,
} from '../../../../lib/episodeStudioPresentation.mjs';
import {
  getEpisodeStudio,
  deleteEpisodeStudio,
  saveEpisodeStudio,
} from '../../../../lib/episodeStudioStore';
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
import {
  deleteEpisodeAssetObject,
  isEpisodeAssetStorageConfigured,
} from '../../../../lib/episodeAssetStorage';
import {
  EpisodeStudioAssetCleanupError,
  deleteEpisodeStudioWithAssets,
} from '../../../../lib/episodeStudioDeletion.mjs';
import {
  buildProductionAdvance,
  getAvailableProductionLeadPersonIds,
  getNextProductionLeadPersonId,
  getProductionLeadPersonIds,
} from '../../../../lib/productionEscalation.mjs';
import { getEpisodeStudioViewCapabilities } from '../../../../lib/episodeStudioHostPreview.mjs';
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

      try {
        const deletion = await deleteEpisodeStudioWithAssets(
          result.episode,
          {
            deleteAsset: (asset) =>
              deleteEpisodeAssetObject(asset.object_key, {
                episodeId,
                versionId: asset.object_version_id,
              }),
            deleteRecord: () =>
              deleteEpisodeStudio(episodeId, {
                expectedUpdatedAt,
              }),
          }
        );

        logAdminAction(req, principal, 'episode_studio.delete', {
          episode_id: episodeId,
          title: result.episode.title,
          deleted_asset_count: deletion.deleted_asset_count,
          deleted_asset_bytes: deletion.deleted_asset_bytes,
        });

        return res.status(200).json({
          ok: true,
          ...deletion,
        });
      } catch (deleteError) {
        if (deleteError instanceof EpisodeStudioAssetCleanupError) {
          console.error('episode studio asset cleanup incomplete:', {
            episode_id: episodeId,
            deleted_asset_count: deleteError.deletedAssets.length,
            failed_asset_count: deleteError.failedAssets.length,
          });
          return res.status(502).json({
            ok: false,
            code: deleteError.code,
            deleted_asset_count: deleteError.deletedAssets.length,
            remaining_asset_count: deleteError.failedAssets.length,
            error:
              'Some stored files could not be removed, so the Episode Studio was kept. Retry deletion to finish the cleanup safely.',
          });
        }

        const conflict = /conditional/i.test(
          String(deleteError?.message || '')
        );
        return res.status(conflict ? 409 : 500).json({
          ok: false,
          error: conflict
            ? 'The stored files were cleaned up, but this Episode Studio changed before its record could be deleted. Refresh and retry to finish.'
            : 'The Episode Studio could not be deleted. Its record was kept.',
        });
      }
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
          result.episode,
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
        people: viewCapabilities.canManage
          ? directory.hosts.map(({ person_id, name }) => ({
              person_id,
              name,
            }))
          : [],
        producers: viewCapabilities.canManage
          ? directory.producers.map(
              ({ person_id, name, account_email }) => ({
                person_id,
                name,
                account_email,
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
      'review',
      'override_review',
      'update',
      'assign_sponsor_read',
      'remove_sponsor_read',
      'update_sponsor_read_assignment',
      'configure_checklist',
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

    if (action === 'advance_production') {
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
            'No active production lead is available. Activate Angie or Caleb before accepting this package.',
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
      const configuredEpisode = Array.isArray(
        req.body?.episode?.deliverables
      )
        ? configureEpisodeDeliverables(
            result.episode,
            req.body.episode.deliverables
          )
        : result.episode;
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
        const completion = getEpisodeCompletion(nextEpisode);
        const submissionMode = String(req.body?.submission_mode || 'complete');
        const provisional = submissionMode === 'with_gaps';

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

    const responseEpisode = resolveMessageAuthors(
      saved.episode,
      directory,
      principal,
      currentAuthorName
    );
    const sponsorData = await sponsorReadResponseData(
      responseEpisode,
      canConfigure
    );
    const responseRelationship = getEpisodeRelationshipCapabilities(
      saved.episode,
      membershipIdentity,
      principal
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
