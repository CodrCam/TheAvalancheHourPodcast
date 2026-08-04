import crypto from 'crypto';
import {
  applyGuestQuestionnaireProjectionToEpisode,
  GuestQuestionnaireValidationError,
  guestQuestionnaireResponseSummary,
  projectGuestQuestionnaireResponse,
  sanitizeGuestQuestionnaireForPublic,
  validateGuestQuestionnaireSubmission,
} from '../../lib/guestQuestionnairePresentation.mjs';
import {
  getGuestQuestionnaire,
  saveGuestQuestionnaireWithEpisode,
} from '../../lib/guestQuestionnaireStore';
import {
  getGuestQuestionnaireBearerToken,
  isGuestQuestionnairePublicAccessAllowed,
  verifyGuestQuestionnaireToken,
} from '../../lib/guestQuestionnaireToken.mjs';
import {
  consumeGuestQuestionnaireRateLimit,
  getGuestQuestionnaireClientAddress,
} from '../../lib/guestQuestionnaireRateLimit.mjs';
import {
  completeGuestQuestionnaireWorkflowTask,
  GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
  GUEST_QUESTIONNAIRE_SENT_TASK_ID,
} from '../../lib/guestQuestionnaireWorkflow.mjs';
import { getEpisodeStudio } from '../../lib/episodeStudioStore';
import {
  getMicKitTracker,
  saveMicKitTracker,
} from '../../lib/micKitStore';
import { upsertGuestMicKitRequest } from '../../lib/guestQuestionnaireMicKit.mjs';
import { publishGuestQuestionnaireSubmissionNotifications } from '../../lib/guestQuestionnaireNotifications';
import { getGuestQuestionnaireSubmissionIdempotency } from '../../lib/guestQuestionnaireSubmission.mjs';

const MAX_BODY_BYTES = 64 * 1024;

export const config = {
  api: {
    bodyParser: { sizeLimit: '70kb' },
  },
};

function isConflict(error) {
  return /conditional|transaction cancelled|changed elsewhere/i.test(
    String(error?.message || '')
  );
}

function publicResponse(record, episode) {
  return {
    ok: true,
    questionnaire: sanitizeGuestQuestionnaireForPublic(record),
    submission: guestQuestionnaireResponseSummary(record),
    episode: {
      title: episode.title,
      recording_date: episode.recording_date,
      target_release_date: episode.target_release_date,
    },
  };
}

async function publishSubmissionNotification(episode, revision) {
  try {
    await publishGuestQuestionnaireSubmissionNotifications({
      episode,
      responseRevision: revision,
    });
  } catch (error) {
    console.error(
      'guest questionnaire notification failed:',
      String(error?.message || 'notification unavailable')
    );
  }
}

async function syncGuestMicKitRequest({
  questionnaire,
  episode,
  guestPlan,
  now,
}) {
  if (guestPlan?.choice !== 'request_kit') {
    return { request: null, configured: null };
  }
  let trackerResult = await getMicKitTracker();
  if (!trackerResult.configured) {
    return { request: null, configured: trackerResult.configured };
  }

  for (let attempt = 0; attempt < 2; attempt += 1) {
    const synced = upsertGuestMicKitRequest({
      tracker: trackerResult.tracker,
      questionnaire,
      episode,
      guestPlan,
      now,
    });
    if (!synced.request || !synced.changed) {
      return { request: synced.request, configured: true };
    }
    try {
      const saved = await saveMicKitTracker(synced.tracker, {
        expectedUpdatedAt: trackerResult.tracker.updated_at,
        updatedBy: 'guest-questionnaire',
      });
      return {
        request: saved.tracker.requests.find(
          (request) => request.request_id === synced.request.request_id
        ),
        configured: true,
      };
    } catch (error) {
      if (!isConflict(error) || attempt > 0) throw error;
      trackerResult = await getMicKitTracker();
    }
  }
  return { request: null, configured: true };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  res.setHeader('X-Robots-Tag', 'noindex, nofollow');
  if (!['GET', 'POST'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const bearerToken = getGuestQuestionnaireBearerToken(req);
  const rate = consumeGuestQuestionnaireRateLimit({
    token: bearerToken,
    address: getGuestQuestionnaireClientAddress(req),
    action: req.method === 'POST' ? 'submit' : 'read',
  });
  res.setHeader('X-RateLimit-Limit', String(rate.limit));
  res.setHeader('X-RateLimit-Remaining', String(rate.remaining));
  if (!rate.allowed) {
    res.setHeader('Retry-After', String(rate.retry_after_seconds));
    return res.status(429).json({
      ok: false,
      code: 'GUEST_QUESTIONNAIRE_RATE_LIMITED',
      error: 'Too many requests. Wait a few minutes and try again.',
    });
  }

  let tokenPayload;
  try {
    tokenPayload = verifyGuestQuestionnaireToken(bearerToken);
  } catch {
    return res.status(401).json({
      ok: false,
      code: 'GUEST_QUESTIONNAIRE_LINK_INVALID',
      error: 'This guest questionnaire link is invalid or expired.',
    });
  }

  try {
    const [stored, episodeResult] = await Promise.all([
      getGuestQuestionnaire(tokenPayload.episode_id),
      getEpisodeStudio(tokenPayload.episode_id),
    ]);
    const record = stored.questionnaire;
    const episode = episodeResult.episode;
    if (
      !record ||
      !episode ||
      !isGuestQuestionnairePublicAccessAllowed({
        tokenPayload,
        record,
        episode,
        now: new Date(),
      })
    ) {
      return res.status(410).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_UNAVAILABLE',
        error: 'This guest questionnaire is no longer available.',
      });
    }

    if (req.method === 'GET') {
      return res.status(200).json(publicResponse(record, episode));
    }
    if (episode.status === 'accepted') {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_QUESTIONNAIRE_HISTORY_LOCKED',
        error:
          'This episode is complete, so its guest-questionnaire response is read-only.',
      });
    }
    if (!req.headers['content-type']?.includes('application/json')) {
      return res.status(400).json({
        ok: false,
        error: 'Content-Type must be application/json',
      });
    }
    if (Buffer.byteLength(JSON.stringify(req.body || {}), 'utf8') > MAX_BODY_BYTES) {
      return res.status(413).json({
        ok: false,
        code: 'GUEST_RESPONSE_TOO_LARGE',
        error: 'The guest response is too large.',
      });
    }
    const submission = validateGuestQuestionnaireSubmission(req.body, record);
    if (!/^[a-z0-9._:-]{8,180}$/i.test(submission.submission_id)) {
      return res.status(400).json({
        ok: false,
        code: 'GUEST_SUBMISSION_ID_INVALID',
        error: 'Create a new submission ID before sending this form.',
      });
    }
    const idempotency = getGuestQuestionnaireSubmissionIdempotency(
      record.response,
      submission
    );
    if (idempotency.outcome !== 'new') {
      if (idempotency.outcome === 'reused_with_different_payload') {
        return res.status(409).json({
          ok: false,
          code: 'GUEST_SUBMISSION_ID_REUSED',
          error:
            'This submission ID was already used for different answers. Refresh and try again.',
        });
      }
      if (idempotency.outcome === 'locked') {
        return res.status(409).json({
          ok: false,
          code: 'GUEST_RESPONSE_LOCKED',
          error:
            'This questionnaire has already been submitted. Ask the episode team if a new response is needed.',
        });
      }
      await publishSubmissionNotification(
        episode,
        record.response.revision
      );
      return res.status(200).json({
        ok: true,
        idempotent: true,
        response: guestQuestionnaireResponseSummary(record),
      });
    }
    if (submission.expected_revision !== record.response.revision) {
      return res.status(409).json({
        ok: false,
        code: 'GUEST_RESPONSE_VERSION_CONFLICT',
        error:
          'This guest response changed elsewhere. Refresh before submitting again.',
      });
    }

    const submittedAt = new Date().toISOString();
    const nextRecord = {
      ...record,
      response: {
        ...record.response,
        status: 'submitted',
        response_id: record.response.response_id || crypto.randomUUID(),
        revision: record.response.revision + 1,
        answers: submission.answers,
        scheduling_acknowledged: submission.scheduling_acknowledged,
        scheduling_acknowledgements:
          submission.scheduling_acknowledgements,
        submission_id_hash: idempotency.submission_id_hash,
        submission_payload_hash: idempotency.submission_payload_hash,
        submitted_at: submittedAt,
        updated_at: submittedAt,
      },
    };

    const sentWorkflow = completeGuestQuestionnaireWorkflowTask(
      episode,
      GUEST_QUESTIONNAIRE_SENT_TASK_ID,
      {
        actorName: 'Episode guest',
        note: 'Guest questionnaire share link was used.',
        now: submittedAt,
      }
    );
    const receivedWorkflow = completeGuestQuestionnaireWorkflowTask(
      sentWorkflow.episode,
      GUEST_QUESTIONNAIRE_RECEIVED_TASK_ID,
      {
        actorName: 'Episode guest',
        note: 'Guest questionnaire submitted.',
        now: submittedAt,
      }
    );
    let projection = projectGuestQuestionnaireResponse(nextRecord);
    const micKitSync = await syncGuestMicKitRequest({
      questionnaire: nextRecord,
      episode: receivedWorkflow.episode,
      guestPlan: projection.production?.guest_mic_kit_plan,
      now: submittedAt,
    });
    if (micKitSync.request) {
      projection = {
        ...projection,
        production: {
          ...projection.production,
          guest_mic_kit_plan: {
            ...projection.production.guest_mic_kit_plan,
            request_id: micKitSync.request.request_id,
          },
        },
      };
    }
    const applied = applyGuestQuestionnaireProjectionToEpisode(
      receivedWorkflow.episode,
      projection,
      nextRecord.autofill
    );
    const autoFilledRecord = {
      ...nextRecord,
      autofill: {
        ...applied.autofill,
        applied_at: submittedAt,
        applied_by_person_id: 'guest-questionnaire',
      },
    };

    const saved = await saveGuestQuestionnaireWithEpisode(
      { questionnaire: autoFilledRecord, episode: applied.episode },
      {
        expectedQuestionnaireUpdatedAt: record.updated_at,
        expectedEpisodeUpdatedAt: episode.updated_at,
      }
    );
    await publishSubmissionNotification(
      saved.episode || episode,
      saved.questionnaire.response.revision
    );
    return res.status(200).json({
      ok: true,
      idempotent: false,
      response: guestQuestionnaireResponseSummary(saved.questionnaire),
    });
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
        code: 'GUEST_RESPONSE_VERSION_CONFLICT',
        error:
          'This guest response changed elsewhere. Refresh and try again.',
      });
    }
    console.error(
      'guest questionnaire public API failed:',
      String(error?.message || 'service unavailable')
    );
    return res.status(500).json({
      ok: false,
      error: 'The guest questionnaire could not be loaded or submitted.',
    });
  }
}
