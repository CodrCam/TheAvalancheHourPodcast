import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../../../lib/adminAuth';
import { logAdminAction } from '../../../../../lib/adminAudit';
import {
  applyGuestQuestionnaireProjectionToEpisode,
  createDefaultGuestQuestionnaire,
  getGuestQuestionnaireLinkState,
  getGuestQuestionnaireStudioCapabilities,
  GuestQuestionnaireValidationError,
  mergeGuestQuestionnaireConfiguration,
  projectGuestQuestionnaireResponse,
  sanitizeGuestQuestionnaireForStudio,
} from '../../../../../lib/guestQuestionnairePresentation.mjs';
import {
  getGuestQuestionnaire,
  saveGuestQuestionnaireAutofill,
  saveGuestQuestionnaireWithEpisode,
} from '../../../../../lib/guestQuestionnaireStore';
import {
  isGuestQuestionnaireTokenConfigured,
  issueGuestQuestionnaireToken,
} from '../../../../../lib/guestQuestionnaireToken.mjs';
import {
  completeGuestQuestionnaireWorkflowTask,
  GUEST_QUESTIONNAIRE_SENT_TASK_ID,
  reopenGuestQuestionnaireSentTaskForNewLink,
} from '../../../../../lib/guestQuestionnaireWorkflow.mjs';
import {
  isEpisodeAssetStorageConfigured,
} from '../../../../../lib/episodeAssetStorage';
import {
  getEpisodeRelationshipCapabilities,
  sanitizeEpisodeStudioForViewer,
} from '../../../../../lib/episodeStudioPresentation.mjs';
import { resetGuestQuestionnaireUploadBudget } from '../../../../../lib/guestQuestionnaireUploadBudget.mjs';
import { getEpisodeStudio } from '../../../../../lib/episodeStudioStore';
import { getStudioBindingForSubject } from '../../../../../lib/studioAccessStore';
import {
  getMicKitTracker,
  saveMicKitTracker,
} from '../../../../../lib/micKitStore';
import { upsertGuestMicKitRequest } from '../../../../../lib/guestQuestionnaireMicKit.mjs';

const ACTIONS = new Set([
  'save_configuration',
  'issue_link',
  'mark_shared',
  'revoke_link',
  'apply_response',
]);

function safeEpisodeSummary(episode = {}) {
  const sentTask = (Array.isArray(episode.production_tasks)
    ? episode.production_tasks
    : []
  ).find((task) => task?.task_id === GUEST_QUESTIONNAIRE_SENT_TASK_ID);
  return {
    episode_id: episode.episode_id,
    title: episode.title,
    recording_date: episode.recording_date,
    target_release_date: episode.target_release_date,
    updated_at: episode.updated_at,
    guest_questionnaire_shared: ['complete', 'waived'].includes(
      sentTask?.status
    ),
  };
}

function responseBody({
  record,
  episode,
  configured,
  canViewShipping,
  canEdit,
  canIssue,
  canApply,
  canRevoke,
  extra = {},
}) {
  const uploadStorageRequired = (record.upload_slots || []).some(
    (slot) => slot.visible !== false && slot.status === 'enabled'
  );
  const uploadsConfigured =
    !uploadStorageRequired || isEpisodeAssetStorageConfigured();
  return {
    ok: true,
    configured,
    can_edit: canEdit,
    can_issue: canIssue,
    can_apply: canApply,
    can_revoke: canRevoke,
    can_view_shipping: canViewShipping,
    uploads_configured: uploadsConfigured,
    ...sanitizeGuestQuestionnaireForStudio(record, { canViewShipping }),
    episode: safeEpisodeSummary(episode),
    ...extra,
  };
}

function isConflict(error) {
  return /conditional|transaction cancelled|changed elsewhere/i.test(
    String(error?.message || '')
  );
}

async function syncGuestMicKitRequest({
  questionnaire,
  episode,
  guestPlan,
  now,
}) {
  if (guestPlan?.choice !== 'request_kit') {
    return null;
  }
  let trackerResult = await getMicKitTracker();
  if (!trackerResult.configured) {
    return null;
  }
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const synced = upsertGuestMicKitRequest({
      tracker: trackerResult.tracker,
      questionnaire,
      episode,
      guestPlan,
      now,
    });
    if (!synced.request || !synced.changed) return synced.request;
    try {
      const saved = await saveMicKitTracker(synced.tracker, {
        expectedUpdatedAt: trackerResult.tracker.updated_at,
        updatedBy: 'guest-questionnaire',
      });
      return saved.tracker.requests.find(
        (request) => request.request_id === synced.request.request_id
      );
    } catch (error) {
      if (!isConflict(error) || attempt > 0) throw error;
      trackerResult = await getMicKitTracker();
    }
  }
  return null;
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }
  const principal = await requirePermissionAsync(
    req,
    res,
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.EPISODES_READ
      : ADMIN_PERMISSIONS.EPISODES_UPDATE
  );
  if (!principal) return;

  try {
    const episodeId = String(req.query.episodeId || '').trim();
    const episodeResult = await getEpisodeStudio(episodeId);
    if (!episodeResult.episode) {
      return res.status(404).json({
        ok: false,
        error: 'Episode Studio not found.',
      });
    }
    const episode = episodeResult.episode;
    if (episode.deletion_finalized_at) {
      return res.status(404).json({
        ok: false,
        error: 'Episode Studio not found.',
      });
    }
    const binding = await getStudioBindingForSubject(principal.subject);
    const identity = binding
      ? {
          person_id: binding.person_id,
          username: principal.username,
          subject: principal.subject,
          account_email: binding.account_email,
          identifiers: [binding.user_sub],
        }
      : {};
    const relationship = getEpisodeRelationshipCapabilities(
      episode,
      identity,
      principal
    );
    const canManage = principal.permissions.includes(
      ADMIN_PERMISSIONS.EPISODES_MANAGE
    );
    if (!canManage && !relationship.canHost && !relationship.canReview) {
      return res.status(403).json({
        ok: false,
        error:
          'Only an assigned host, assigned producer, or Studio manager can access this guest questionnaire.',
      });
    }
    const stored = await getGuestQuestionnaire(episodeId);
    const record =
      stored.questionnaire || createDefaultGuestQuestionnaire(episodeId);
    const effectiveLinkStatus = getGuestQuestionnaireLinkState(
      record.link
    ).status;
    const capabilities = getGuestQuestionnaireStudioCapabilities({
      canHost: relationship.canHost,
      canReview: relationship.canReview,
      canManage,
      episodeStatus: episode.status,
      archived: episode.archived || Boolean(episode.deleted_at),
      linkStatus: effectiveLinkStatus,
      responseStatus: record.response.status,
    });
    const canViewShipping = capabilities.can_view_shipping;
    const canEdit = capabilities.can_edit;
    const canIssue = capabilities.can_issue;
    const canApply = capabilities.can_apply;
    const canRevoke = capabilities.can_revoke;

    if (req.method === 'GET') {
      return res.status(200).json(
        responseBody({
          record,
          episode,
          configured: stored.configured,
          canViewShipping,
          canEdit,
          canIssue,
          canApply,
          canRevoke,
        })
      );
    }
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({
        ok: false,
        error: 'Content-Type must be application/json',
      });
    }
    if (!stored.configured) {
      return res.status(503).json({
        ok: false,
        error: 'Guest questionnaire storage is not configured.',
      });
    }
    const action = String(req.body?.action || '').trim();
    if (!ACTIONS.has(action)) {
      return res.status(400).json({
        ok: false,
        error: 'Choose a supported guest-questionnaire action.',
      });
    }
    if (action === 'revoke_link') {
      if (!canRevoke) {
        return res.status(403).json({
          ok: false,
          error:
            'Only an assigned producer or Studio manager can revoke this locked questionnaire link.',
        });
      }
    } else if (action === 'save_configuration' && !canEdit) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_HISTORY_LOCKED',
        error:
          'Questionnaire configuration is read-only after a response is submitted or the Episode Studio is locked.',
      });
    } else if (action === 'issue_link' && !canIssue) {
      return res.status(409).json({
        ok: false,
        code:
          record.response.status === 'submitted'
            ? 'GUEST_QUESTIONNAIRE_RESPONSE_LOCKED'
            : 'GUEST_QUESTIONNAIRE_HISTORY_LOCKED',
        error:
          record.response.status === 'submitted'
            ? 'The guest response is already submitted. Revoke the existing link if it should no longer open.'
            : 'This accepted or archived Episode Studio keeps its guest-questionnaire history read-only.',
      });
    } else if (action === 'mark_shared' && !canIssue) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_HISTORY_LOCKED',
        error:
          'This guest questionnaire can no longer be marked as newly shared.',
      });
    } else if (action === 'apply_response' && !canApply) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_RESPONSE_NOT_APPLICABLE',
        error:
          record.response.status === 'submitted'
            ? 'This accepted or archived Episode Studio keeps its guest-questionnaire history read-only.'
            : 'The guest has not submitted this questionnaire yet.',
      });
    }
    const expectedUpdatedAt = String(
      req.body?.expected_updated_at || ''
    ).trim();
    if (expectedUpdatedAt !== String(record.updated_at || '')) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_VERSION_CONFLICT',
        error:
          'This guest questionnaire changed elsewhere. Refresh and try again.',
      });
    }
    const actorPersonId = binding?.person_id || '';
    const actorName =
      String(principal.displayName || principal.username || '').trim() ||
      'Studio team';

    let saved;
    let extra = {};
    if (action === 'save_configuration') {
      const configured = mergeGuestQuestionnaireConfiguration(
        record,
        req.body?.questionnaire
      );
      saved = await saveGuestQuestionnaireWithEpisode(
        {
          episode,
          questionnaire: {
            ...configured,
            updated_by_person_id: actorPersonId,
          },
        },
        {
          expectedQuestionnaireUpdatedAt: expectedUpdatedAt,
          expectedEpisodeUpdatedAt: episode.updated_at,
        }
      );
    } else if (action === 'issue_link') {
      const uploadStorageRequired = (record.upload_slots || []).some(
        (slot) => slot.visible !== false && slot.status === 'enabled'
      );
      if (uploadStorageRequired && !isEpisodeAssetStorageConfigured()) {
        return res.status(503).json({
          ok: false,
          code: 'GUEST_QUESTIONNAIRE_UPLOADS_NOT_CONFIGURED',
          error:
            'Secure guest file storage must be configured before sharing a questionnaire with upload fields.',
        });
      }
      if (!isGuestQuestionnaireTokenConfigured()) {
        return res.status(503).json({
          ok: false,
          code: 'GUEST_QUESTIONNAIRE_LINKS_NOT_CONFIGURED',
          error:
            'Guest questionnaire share links are not configured securely.',
        });
      }
      const issued = issueGuestQuestionnaireToken({
        episodeId,
        expiresInDays: req.body?.expires_in_days,
      });
      const nextRecord = {
        ...record,
        link: {
          status: 'active',
          token_jti_hash: issued.token_jti_hash,
          issued_at: issued.issued_at,
          expires_at: issued.expires_at,
          revoked_at: '',
          issued_by_person_id: actorPersonId,
        },
        upload_budget: resetGuestQuestionnaireUploadBudget(
          issued.token_jti_hash
        ),
        updated_by_person_id: actorPersonId,
      };
      const reopened = reopenGuestQuestionnaireSentTaskForNewLink(
        episode,
        { actorPersonId, actorName }
      );
      saved = await saveGuestQuestionnaireWithEpisode(
        { questionnaire: nextRecord, episode: reopened.episode },
        {
          expectedQuestionnaireUpdatedAt: expectedUpdatedAt,
          expectedEpisodeUpdatedAt: episode.updated_at,
        }
      );
      extra = {
        share_token: issued.token,
        share_path: `/studio/guest-questionnaire#token=${encodeURIComponent(
          issued.token
        )}`,
      };
    } else if (action === 'mark_shared') {
      if (getGuestQuestionnaireLinkState(record.link).status !== 'active') {
        return res.status(409).json({
          ok: false,
          code: 'GUEST_QUESTIONNAIRE_LINK_NOT_ACTIVE',
          error: 'Create an active guest link before marking it as shared.',
        });
      }
      const workflow = completeGuestQuestionnaireWorkflowTask(
        episode,
        GUEST_QUESTIONNAIRE_SENT_TASK_ID,
        {
          actorPersonId,
          actorName,
          note: 'Private guest questionnaire link shared with the guest.',
        }
      );
      saved = workflow.changed
        ? await saveGuestQuestionnaireWithEpisode(
            { questionnaire: record, episode: workflow.episode },
            {
              expectedQuestionnaireUpdatedAt: expectedUpdatedAt,
              expectedEpisodeUpdatedAt: episode.updated_at,
            }
          )
        : { questionnaire: record, episode, configured: true };
    } else if (action === 'revoke_link') {
      saved = await saveGuestQuestionnaireWithEpisode(
        {
          episode,
          questionnaire: {
            ...record,
            link: {
              ...record.link,
              status: 'revoked',
              token_jti_hash: '',
              revoked_at: new Date().toISOString(),
            },
            updated_by_person_id: actorPersonId,
          },
        },
        {
          expectedQuestionnaireUpdatedAt: expectedUpdatedAt,
          expectedEpisodeUpdatedAt: episode.updated_at,
        }
      );
    } else {
      if (record.response.status !== 'submitted') {
        return res.status(409).json({
          ok: false,
          code: 'GUEST_QUESTIONNAIRE_RESPONSE_NOT_SUBMITTED',
          error: 'The guest has not submitted this questionnaire yet.',
        });
      }
      const expectedEpisodeUpdatedAt = String(
        req.body?.expected_episode_updated_at || ''
      ).trim();
      if (expectedEpisodeUpdatedAt !== episode.updated_at) {
        return res.status(409).json({
          ok: false,
          code: 'EPISODE_VERSION_CONFLICT',
          error:
            'The Episode Studio changed elsewhere. Refresh before applying the guest response.',
        });
      }
      let projection = projectGuestQuestionnaireResponse(record);
      const appliedAt = new Date().toISOString();
      const guestMicRequest = await syncGuestMicKitRequest({
        questionnaire: record,
        episode,
        guestPlan: projection.production?.guest_mic_kit_plan,
        now: appliedAt,
      });
      if (guestMicRequest) {
        projection = {
          ...projection,
          production: {
            ...projection.production,
            guest_mic_kit_plan: {
              ...projection.production.guest_mic_kit_plan,
              request_id: guestMicRequest.request_id,
            },
          },
        };
      }
      const applied = applyGuestQuestionnaireProjectionToEpisode(
        episode,
        projection,
        record.autofill
      );
      const nextRecord = {
        ...record,
        autofill: {
          ...applied.autofill,
          applied_at: appliedAt,
          applied_by_person_id: actorPersonId,
        },
        updated_by_person_id: actorPersonId,
      };
      saved = await saveGuestQuestionnaireAutofill(
        { questionnaire: nextRecord, episode: applied.episode },
        {
          expectedQuestionnaireUpdatedAt: expectedUpdatedAt,
          expectedEpisodeUpdatedAt,
        }
      );
      extra = {
        episode: sanitizeEpisodeStudioForViewer(saved.episode),
        autofill: {
          applied_fields: applied.applied_fields,
          skipped_fields: applied.skipped_fields,
        },
      };
    }

    logAdminAction(req, principal, `guest_questionnaire.${action}`, {
      episode_id: episodeId,
      response_revision: saved.questionnaire.response.revision,
    });
    const nextEpisode = saved.episode || episode;
    const nextCapabilities = getGuestQuestionnaireStudioCapabilities({
      canHost: relationship.canHost,
      canReview: relationship.canReview,
      canManage,
      episodeStatus: nextEpisode.status,
      archived: nextEpisode.archived || Boolean(nextEpisode.deleted_at),
      linkStatus: getGuestQuestionnaireLinkState(
        saved.questionnaire.link
      ).status,
      responseStatus: saved.questionnaire.response.status,
    });
    return res.status(200).json(
      responseBody({
        record: saved.questionnaire,
        episode: nextEpisode,
        configured: true,
        canViewShipping,
        canEdit: nextCapabilities.can_edit,
        canIssue: nextCapabilities.can_issue,
        canApply: nextCapabilities.can_apply,
        canRevoke: nextCapabilities.can_revoke,
        extra,
      })
    );
  } catch (error) {
    if (error instanceof GuestQuestionnaireValidationError) {
      return res.status(400).json({
        ok: false,
        code: error.code,
        error: error.message,
        details: error.details,
      });
    }
    if (isConflict(error)) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_VERSION_CONFLICT',
        error:
          'The guest questionnaire or Episode Studio changed elsewhere. Refresh and try again.',
      });
    }
    console.error('guest questionnaire Studio API failed:', error);
    return res.status(500).json({
      ok: false,
      error: 'The guest questionnaire could not be updated.',
    });
  }
}
