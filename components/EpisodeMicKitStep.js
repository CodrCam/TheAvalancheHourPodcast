import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import styles from '../styles/EpisodeMicKitStep.module.css';

const PLAN_CHOICES = new Set([
  'request_kit',
  'use_own_equipment',
  'no_kit_needed',
]);

const REQUEST_STATUSES = new Set([
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
  'returned',
  'declined',
  'cancelled',
]);

const ACTIVE_REQUEST_STATUSES = new Set([
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
]);

const REQUEST_STATUS_META = {
  requested: {
    label: 'Request submitted',
    detail: 'The mic-kit team is reviewing the request.',
    tone: 'active',
  },
  approved: {
    label: 'Request approved',
    detail: 'The request is approved and waiting for its kit assignment.',
    tone: 'active',
  },
  waitlisted: {
    label: 'Request waitlisted',
    detail: 'The request is active, but a kit is not available yet.',
    tone: 'waiting',
  },
  assigned: {
    label: 'Kit assigned',
    detail: 'A kit has been matched to this host.',
    tone: 'ready',
  },
  checked_out: {
    label: 'Kit checked out',
    detail: 'The host has an active kit checkout for this episode.',
    tone: 'ready',
  },
  returned: {
    label: 'Previous kit returned',
    detail: 'Connect a current request or choose another recording plan.',
    tone: 'attention',
  },
  declined: {
    label: 'Request declined',
    detail: 'Choose another recording plan or submit a new request.',
    tone: 'attention',
  },
  cancelled: {
    label: 'Request cancelled',
    detail: 'Choose another recording plan or submit a new request.',
    tone: 'attention',
  },
};

function text(value, maxLength = 800) {
  return String(value || '').slice(0, maxLength);
}

function safeCoverage(value = {}) {
  const status = REQUEST_STATUSES.has(value.status) ? value.status : '';
  return {
    request_id: text(value.request_id, 120),
    host_person_id: text(value.host_person_id, 120),
    status,
    has_kit_assignment: value.has_kit_assignment === true,
    updated_at: text(value.updated_at, 50),
  };
}

function safePlan(value = {}) {
  return {
    host_person_id: text(value.host_person_id, 120),
    choice: PLAN_CHOICES.has(value.choice) ? value.choice : '',
    request_id: text(value.request_id, 120),
    equipment_note: text(value.equipment_note, 800),
    resolved: value.resolved === true,
    request_coverage:
      value.request_coverage && typeof value.request_coverage === 'object'
        ? safeCoverage(value.request_coverage)
        : null,
  };
}

function safePayload(value = {}) {
  return {
    episode_id: text(value.episode_id, 120),
    episode_updated_at: text(value.episode_updated_at, 50),
    tracker_configured: value.tracker_configured !== false,
    required: value.required === true,
    complete: value.complete === true,
    viewer_host_person_id: text(value.viewer_host_person_id, 120),
    can_edit: value.can_edit === true,
    plans: (Array.isArray(value.plans) ? value.plans : [])
      .slice(0, 5)
      .map(safePlan),
    request_coverage: (
      Array.isArray(value.request_coverage) ? value.request_coverage : []
    )
      .slice(0, 25)
      .map(safeCoverage),
  };
}

function draftsFromPayload(payload) {
  return Object.fromEntries(
    payload.plans.map((plan) => [
      plan.host_person_id,
      {
        choice: plan.choice,
        request_id: plan.request_id,
        equipment_note: plan.equipment_note,
      },
    ])
  );
}

function currentRequestForHost(coverage, hostPersonId, requestIdHint = '') {
  const active = coverage
    .filter(
      (request) =>
        request.host_person_id === hostPersonId &&
        ACTIVE_REQUEST_STATUSES.has(request.status)
    )
    .sort((left, right) => {
      if (left.request_id === requestIdHint) return -1;
      if (right.request_id === requestIdHint) return 1;
      return String(right.updated_at).localeCompare(String(left.updated_at));
    });
  return active[0] || null;
}

function planLabel(plan) {
  if (plan.choice === 'request_kit') return 'Avalanche Hour mic kit';
  if (plan.choice === 'use_own_equipment') return 'Own recording equipment';
  if (plan.choice === 'no_kit_needed') return 'No separate kit needed';
  return 'Plan needed';
}

function initials(name = '') {
  return String(name)
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('') || 'H';
}

export default function EpisodeMicKitStep({
  episodeId,
  hosts = [],
  requestIdHint = '',
  readOnly = false,
  onDataChange,
  onDirtyChange,
}) {
  const [payload, setPayload] = useState(null);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [savingHostId, setSavingHostId] = useState('');
  const [rowErrors, setRowErrors] = useState({});
  const [rowMessages, setRowMessages] = useState({});
  const [reloadKey, setReloadKey] = useState(0);
  const onDataChangeRef = useRef(onDataChange);
  const onDirtyChangeRef = useRef(onDirtyChange);

  useEffect(() => {
    onDataChangeRef.current = onDataChange;
  }, [onDataChange]);

  useEffect(() => {
    onDirtyChangeRef.current = onDirtyChange;
  }, [onDirtyChange]);

  useEffect(() => {
    if (!episodeId) {
      setLoading(false);
      setLoadError('This episode is not available yet.');
      return undefined;
    }

    const controller = new AbortController();
    let alive = true;

    async function loadPlan() {
      setLoading(true);
      setLoadError('');
      try {
        const response = await fetch(
          `/api/studio/episodes/${encodeURIComponent(episodeId)}/mic-kit`,
          {
            credentials: 'same-origin',
            signal: controller.signal,
          }
        );
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          throw new Error(
            data.error || 'Could not load the microphone plans.'
          );
        }
        if (!alive) return;
        const nextPayload = safePayload(data);
        setPayload(nextPayload);
        setDrafts(draftsFromPayload(nextPayload));
        onDataChangeRef.current?.(nextPayload);
      } catch (error) {
        if (!alive || error.name === 'AbortError') return;
        setLoadError(
          error.message || 'Could not load the microphone plans.'
        );
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadPlan();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [episodeId, reloadKey]);

  const displayHosts = useMemo(() => {
    const providedHosts = (Array.isArray(hosts) ? hosts : [])
      .map((host, index) => ({
        host_person_id: text(host?.host_person_id, 120),
        name: text(host?.name, 180) || `Host ${index + 1}`,
      }))
      .filter((host) => host.host_person_id);
    if (providedHosts.length || !payload) return providedHosts;
    return payload.plans.map((plan, index) => ({
      host_person_id: plan.host_person_id,
      name: `Host ${index + 1}`,
    }));
  }, [hosts, payload]);

  const plansByHost = useMemo(
    () =>
      new Map(
        (payload?.plans || []).map((plan) => [plan.host_person_id, plan])
      ),
    [payload]
  );

  useEffect(() => {
    const hasUnsavedPlan = (payload?.plans || []).some((plan) => {
      const draft = drafts[plan.host_person_id];
      if (!draft) return false;
      if (draft.choice === 'request_kit' && !draft.request_id) return false;
      return (
        draft.choice !== plan.choice ||
        String(draft.request_id || '') !== plan.request_id ||
        String(draft.equipment_note || '') !== plan.equipment_note
      );
    });
    onDirtyChangeRef.current?.(hasUnsavedPlan);
  }, [drafts, payload]);

  useEffect(
    () => () => {
      onDirtyChangeRef.current?.(false);
    },
    []
  );

  function updateDraft(hostPersonId, patch) {
    setDrafts((current) => ({
      ...current,
      [hostPersonId]: {
        choice: '',
        request_id: '',
        equipment_note: '',
        ...(current[hostPersonId] || {}),
        ...patch,
      },
    }));
    setRowErrors((current) => ({ ...current, [hostPersonId]: '' }));
    setRowMessages((current) => ({ ...current, [hostPersonId]: '' }));
  }

  async function savePlan(hostPersonId, override = null) {
    if (!payload || savingHostId || readOnly) return false;
    const draft = override || drafts[hostPersonId] || {};
    const equipmentNote = String(draft.equipment_note || '').trim();
    const requestId =
      draft.choice === 'request_kit' ? String(draft.request_id || '') : '';

    if (!PLAN_CHOICES.has(draft.choice)) {
      setRowErrors((current) => ({
        ...current,
        [hostPersonId]: 'Choose how you will record before saving.',
      }));
      return false;
    }
    if (draft.choice === 'request_kit' && !requestId) {
      setRowErrors((current) => ({
        ...current,
        [hostPersonId]:
          'Submit or connect an active mic-kit request first.',
      }));
      return false;
    }
    if (draft.choice === 'use_own_equipment' && !equipmentNote) {
      setRowErrors((current) => ({
        ...current,
        [hostPersonId]:
          'Briefly identify the microphone and headphones you will use.',
      }));
      return false;
    }

    setSavingHostId(hostPersonId);
    setRowErrors((current) => ({ ...current, [hostPersonId]: '' }));
    setRowMessages((current) => ({ ...current, [hostPersonId]: '' }));
    try {
      const response = await fetch(
        `/api/studio/episodes/${encodeURIComponent(episodeId)}/mic-kit`,
        {
          method: 'PATCH',
          credentials: 'same-origin',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            choice: draft.choice,
            request_id: requestId,
            equipment_note: equipmentNote,
            expected_updated_at: payload.episode_updated_at,
          }),
        }
      );
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(
          data.error || 'Could not save the microphone plan.'
        );
      }
      const nextPayload = safePayload(data);
      setPayload(nextPayload);
      setDrafts(draftsFromPayload(nextPayload));
      setRowMessages((current) => ({
        ...current,
        [hostPersonId]: 'Microphone plan saved.',
      }));
      onDataChangeRef.current?.(nextPayload);
      return true;
    } catch (error) {
      setRowErrors((current) => ({
        ...current,
        [hostPersonId]:
          error.message || 'Could not save the microphone plan.',
      }));
      return false;
    } finally {
      setSavingHostId('');
    }
  }

  if (loading && !payload) {
    return (
      <div className={styles.loadingState} role="status" aria-live="polite">
        <span className={styles.loadingMark} aria-hidden="true" />
        <div>
          <strong>Checking each host&apos;s microphone plan…</strong>
          <p>Loading only the episode&apos;s safe readiness status.</p>
        </div>
      </div>
    );
  }

  if (!payload) {
    return (
      <div className={styles.errorState} role="alert">
        <div>
          <strong>Microphone plans could not be loaded</strong>
          <p>{loadError}</p>
        </div>
        <button type="button" onClick={() => setReloadKey((value) => value + 1)}>
          Try again
        </button>
      </div>
    );
  }

  const readyCount = payload.plans.filter((plan) => plan.resolved).length;
  const requestHref = `/studio/mic-kits?episode_id=${encodeURIComponent(
    episodeId
  )}&return_to=${encodeURIComponent(
    `/studio/episodes/${encodeURIComponent(episodeId)}`
  )}`;

  return (
    <div className={styles.workspace} aria-busy={loading || savingHostId !== ''}>
      <header className={styles.summary}>
        <div>
          <span>Episode equipment readiness</span>
          <strong>
            {readyCount} of {displayHosts.length} host
            {displayHosts.length === 1 ? '' : 's'} ready
          </strong>
        </div>
        <span
          className={styles.completionBadge}
          data-complete={payload.complete ? 'true' : 'false'}
        >
          {payload.complete ? 'All plans ready' : 'Plans needed'}
        </span>
      </header>

      {!payload.tracker_configured ? (
        <div className={styles.serviceNotice} role="status">
          <strong>Mic-kit requests are temporarily unavailable.</strong>
          <span>
            Hosts can still confirm their own equipment or that no separate kit
            is needed.
          </span>
        </div>
      ) : null}

      {loadError ? (
        <div className={styles.refreshNotice} role="alert">
          <span>{loadError}</span>
          <button
            type="button"
            onClick={() => setReloadKey((value) => value + 1)}
          >
            Retry
          </button>
        </div>
      ) : null}

      <div className={styles.hostList}>
        {displayHosts.map((host) => {
          const plan =
            plansByHost.get(host.host_person_id) ||
            safePlan({ host_person_id: host.host_person_id });
          const requestStatus = plan.request_coverage?.status || '';
          const statusMeta = requestStatus
            ? REQUEST_STATUS_META[requestStatus]
            : null;
          const attention =
            plan.choice === 'request_kit' && plan.resolved !== true;
          const editable =
            !readOnly &&
            payload.can_edit &&
            payload.viewer_host_person_id === host.host_person_id;
          const activeRequest = currentRequestForHost(
            payload.request_coverage,
            host.host_person_id,
            requestIdHint
          );
          const draft = drafts[host.host_person_id] || {
            choice: plan.choice,
            request_id: plan.request_id,
            equipment_note: plan.equipment_note,
          };
          const dirty =
            draft.choice !== plan.choice ||
            String(draft.request_id || '') !== plan.request_id ||
            String(draft.equipment_note || '') !== plan.equipment_note;
          const saving = savingHostId === host.host_person_id;
          const needsRequest =
            draft.choice === 'request_kit' && !draft.request_id;

          return (
            <section
              key={host.host_person_id}
              className={styles.hostCard}
              data-attention={attention ? 'true' : 'false'}
              aria-labelledby={`mic-plan-host-${host.host_person_id}`}
            >
              <header className={styles.hostHeader}>
                <span className={styles.avatar} aria-hidden="true">
                  {initials(host.name)}
                </span>
                <div>
                  <h4 id={`mic-plan-host-${host.host_person_id}`}>
                    {host.name}
                  </h4>
                  <span>
                    {payload.viewer_host_person_id === host.host_person_id
                      ? 'Your recording plan'
                      : 'Assigned host'}
                  </span>
                </div>
                <span
                  className={styles.statusBadge}
                  data-tone={
                    attention
                      ? 'attention'
                      : plan.resolved
                        ? 'ready'
                        : 'neutral'
                  }
                >
                  {attention
                    ? 'Needs attention'
                    : plan.resolved
                      ? 'Plan ready'
                      : 'Plan needed'}
                </span>
              </header>

              <div className={styles.planSummary}>
                <div>
                  <span>Recording plan</span>
                  <strong>{planLabel(plan)}</strong>
                </div>
                {statusMeta ? (
                  <div>
                    <span>Mic-request status</span>
                    <strong data-tone={statusMeta.tone}>
                      {statusMeta.label}
                    </strong>
                  </div>
                ) : null}
                {plan.equipment_note ? (
                  <div className={styles.noteSummary}>
                    <span>Equipment note</span>
                    <p>{plan.equipment_note}</p>
                  </div>
                ) : null}
              </div>

              {statusMeta ? (
                <p
                  className={styles.statusDetail}
                  data-tone={statusMeta.tone}
                >
                  {statusMeta.detail}
                  {plan.request_coverage?.has_kit_assignment &&
                  !['assigned', 'checked_out'].includes(requestStatus)
                    ? ' A kit match is recorded.'
                    : ''}
                </p>
              ) : null}

              {editable ? (
                <form
                  className={styles.editor}
                  onSubmit={(event) => {
                    event.preventDefault();
                    savePlan(host.host_person_id);
                  }}
                >
                  <fieldset disabled={saving}>
                    <legend>Choose your recording setup</legend>
                    <div className={styles.choiceGrid}>
                      <label
                        className={styles.choice}
                        data-selected={
                          draft.choice === 'request_kit' ? 'true' : 'false'
                        }
                      >
                        <input
                          type="radio"
                          name={`mic-plan-choice-${host.host_person_id}`}
                          checked={draft.choice === 'request_kit'}
                          onChange={() =>
                            updateDraft(host.host_person_id, {
                              choice: 'request_kit',
                              request_id: activeRequest?.request_id || '',
                            })
                          }
                        />
                        <span>
                          <strong>Request a mic kit</strong>
                          <small>Connect an active episode request.</small>
                        </span>
                      </label>
                      <label
                        className={styles.choice}
                        data-selected={
                          draft.choice === 'use_own_equipment'
                            ? 'true'
                            : 'false'
                        }
                      >
                        <input
                          type="radio"
                          name={`mic-plan-choice-${host.host_person_id}`}
                          checked={draft.choice === 'use_own_equipment'}
                          onChange={() =>
                            updateDraft(host.host_person_id, {
                              choice: 'use_own_equipment',
                              request_id: '',
                            })
                          }
                        />
                        <span>
                          <strong>Use my equipment</strong>
                          <small>Confirm the microphone and headphones.</small>
                        </span>
                      </label>
                      <label
                        className={styles.choice}
                        data-selected={
                          draft.choice === 'no_kit_needed' ? 'true' : 'false'
                        }
                      >
                        <input
                          type="radio"
                          name={`mic-plan-choice-${host.host_person_id}`}
                          checked={draft.choice === 'no_kit_needed'}
                          onChange={() =>
                            updateDraft(host.host_person_id, {
                              choice: 'no_kit_needed',
                              request_id: '',
                            })
                          }
                        />
                        <span>
                          <strong>No separate kit needed</strong>
                          <small>For a shared studio or another setup.</small>
                        </span>
                      </label>
                    </div>
                  </fieldset>

                  {activeRequest &&
                  draft.choice !== 'request_kit' &&
                  (plan.request_id !== activeRequest.request_id ||
                    !plan.resolved) ? (
                    <div className={styles.requestAction}>
                      <div>
                        <strong>Active episode request found</strong>
                        <span>
                          Connect it here to replace the current recording
                          plan.
                        </span>
                      </div>
                      <button
                        type="button"
                        className={styles.connectButton}
                        disabled={saving}
                        onClick={() =>
                          savePlan(host.host_person_id, {
                            choice: 'request_kit',
                            request_id: activeRequest.request_id,
                            equipment_note: draft.equipment_note || '',
                          })
                        }
                      >
                        {saving ? 'Connecting…' : 'Connect request'}
                      </button>
                    </div>
                  ) : null}

                  {draft.choice === 'request_kit' ? (
                    <div className={styles.requestAction}>
                      {activeRequest ? (
                        <div>
                          <strong>Active episode request found</strong>
                          <span>
                            {REQUEST_STATUS_META[activeRequest.status]?.label ||
                              'Active request'}
                          </span>
                        </div>
                      ) : (
                        <div>
                          <strong>No active episode request yet</strong>
                          <span>
                            Submit the prefilled request, then return here to
                            connect it.
                          </span>
                        </div>
                      )}
                      {activeRequest ? (
                        plan.request_id !== activeRequest.request_id ||
                        !plan.resolved ? (
                          <button
                            type="button"
                            className={styles.connectButton}
                            disabled={saving}
                            onClick={() =>
                              savePlan(host.host_person_id, {
                                choice: 'request_kit',
                                request_id: activeRequest.request_id,
                                equipment_note: draft.equipment_note || '',
                              })
                            }
                          >
                            {saving ? 'Connecting…' : 'Connect request'}
                          </button>
                        ) : (
                          <span className={styles.connectedBadge}>Connected</span>
                        )
                      ) : payload.tracker_configured ? (
                        <Link href={requestHref}>Open prefilled request</Link>
                      ) : null}
                    </div>
                  ) : null}

                  {['use_own_equipment', 'no_kit_needed'].includes(
                    draft.choice
                  ) ? (
                    <label className={styles.equipmentField}>
                      <span>
                        Equipment note
                        <small>
                          {draft.choice === 'use_own_equipment'
                            ? 'Required'
                            : 'Optional'}
                        </small>
                      </span>
                      <textarea
                        value={draft.equipment_note || ''}
                        disabled={saving}
                        maxLength={800}
                        rows={2}
                        aria-required={
                          draft.choice === 'use_own_equipment' || undefined
                        }
                        placeholder={
                          draft.choice === 'use_own_equipment'
                            ? 'Microphone, headphones, and any relevant setup details'
                            : 'Optional context for the producer'
                        }
                        onChange={(event) =>
                          updateDraft(host.host_person_id, {
                            equipment_note: event.target.value,
                          })
                        }
                      />
                      <small>
                        {String(draft.equipment_note || '').length} / 800
                      </small>
                    </label>
                  ) : null}

                  <div className={styles.editorFooter}>
                    <div aria-live="polite">
                      {rowErrors[host.host_person_id] ? (
                        <p className={styles.rowError} role="alert">
                          {rowErrors[host.host_person_id]}
                        </p>
                      ) : rowMessages[host.host_person_id] ? (
                        <p className={styles.rowSuccess} role="status">
                          {rowMessages[host.host_person_id]}
                        </p>
                      ) : (
                        <span>
                          Only your assigned-host plan can be changed here.
                        </span>
                      )}
                    </div>
                    <button
                      type="submit"
                      className={styles.saveButton}
                      disabled={!dirty || saving || needsRequest}
                      title={
                        needsRequest
                          ? 'Submit or connect an active mic-kit request first.'
                          : !dirty
                            ? 'This plan is already saved.'
                            : undefined
                      }
                    >
                      {saving ? 'Saving…' : 'Save equipment plan'}
                    </button>
                  </div>
                </form>
              ) : null}
            </section>
          );
        })}
      </div>
    </div>
  );
}
