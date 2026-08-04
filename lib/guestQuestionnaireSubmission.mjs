import crypto from 'crypto';

function sha256(value) {
  return crypto
    .createHash('sha256')
    .update(String(value || ''), 'utf8')
    .digest('hex');
}

function sortedObject(value = {}) {
  const source =
    value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  return Object.fromEntries(
    Object.entries(source).sort(([left], [right]) =>
      left.localeCompare(right)
    )
  );
}

export function hashGuestQuestionnaireSubmissionId(value) {
  return sha256(String(value || '').trim());
}

export function hashGuestQuestionnaireSubmissionPayload(value = {}) {
  return sha256(
    JSON.stringify({
      answers: sortedObject(value.answers),
      scheduling_acknowledgements: sortedObject(
        value.scheduling_acknowledgements
      ),
    })
  );
}

export function getGuestQuestionnaireSubmissionIdempotency(
  responseValue = {},
  submissionValue = {}
) {
  const response =
    responseValue && typeof responseValue === 'object' ? responseValue : {};
  const submissionIdHash = hashGuestQuestionnaireSubmissionId(
    submissionValue.submission_id
  );
  const payloadHash = hashGuestQuestionnaireSubmissionPayload(
    submissionValue
  );
  const sameId =
    Boolean(response.submission_id_hash) &&
    response.submission_id_hash === submissionIdHash;
  return {
    submission_id_hash: submissionIdHash,
    submission_payload_hash: payloadHash,
    outcome: !sameId
      ? response.status === 'submitted'
        ? 'locked'
        : 'new'
      : response.submission_payload_hash === payloadHash
        ? 'idempotent'
        : 'reused_with_different_payload',
  };
}
