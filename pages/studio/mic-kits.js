import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import CalendarMonthRoundedIcon from '@mui/icons-material/CalendarMonthRounded';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import GroupsRoundedIcon from '@mui/icons-material/GroupsRounded';
import HeadsetMicRoundedIcon from '@mui/icons-material/HeadsetMicRounded';
import Inventory2RoundedIcon from '@mui/icons-material/Inventory2Rounded';
import LocalShippingRoundedIcon from '@mui/icons-material/LocalShippingRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import PlaceRoundedIcon from '@mui/icons-material/PlaceRounded';
import StudioLayout from '../../components/StudioLayout';
import AdminLayout from '../../components/AdminLayout';
import {
  MIC_KIT_STATUS_LABELS,
  applyMicKitStatus,
} from '../../lib/micKitPresentation.mjs';
import styles from '../../styles/MicKits.module.css';
import studioStyles from '../../styles/Studio.module.css';

const REQUEST_STATUS_LABELS = {
  requested: 'Waiting',
  approved: 'Approved',
  waitlisted: 'Waitlisted',
  assigned: 'Kit assigned',
  checked_out: 'Checked out',
  returned: 'Returned',
  declined: 'Declined',
  cancelled: 'Cancelled',
};

const EPISODE_STATUS_LABELS = {
  planning: 'Planning',
  in_progress: 'In progress',
  needs_changes: 'Changes requested',
};

const EMPTY_REQUEST = {
  country: 'US',
  city_region: '',
  need_by: '',
  recording_date: '',
  episode_id: '',
  notes: '',
  shipping: {
    recipient: '',
    address_line_1: '',
    address_line_2: '',
    city: '',
    region: '',
    postal_code: '',
    country: 'US',
  },
};

function formatDate(value) {
  if (!value) return 'Not set';
  const date = new Date(`${value}T12:00:00`);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      }).format(date);
}

function formatCountry(value) {
  if (value === 'US') return 'United States';
  if (value === 'CA') return 'Canada';
  return value || 'Home country not set';
}

function formatAddress(shipping) {
  if (!shipping) return '';
  return [
    shipping.recipient,
    shipping.address_line_1,
    shipping.address_line_2,
    [shipping.city, shipping.region, shipping.postal_code]
      .filter(Boolean)
      .join(', '),
    shipping.country,
  ]
    .filter(Boolean)
    .join(' · ');
}

function kitSummary(tracker) {
  const kits = (tracker?.kits || []).filter(
    (kit) => kit.status !== 'retired'
  );
  return {
    total: kits.length,
    available: kits.filter((kit) => kit.status === 'available').length,
    moving: kits.filter((kit) => kit.status === 'in_transit').length,
    attention: kits.filter((kit) => kit.status === 'maintenance').length,
    waiting: (tracker?.requests || []).filter((request) =>
      ['requested', 'approved', 'waitlisted'].includes(request.status)
    ).length,
  };
}

function defaultKitDraft(kit) {
  return {
    ...kit,
    possible_addition: kit.possible_addition === true,
  };
}

function comparableName(value) {
  return String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ');
}

function episodePriority(episode, today) {
  const priorityDate = episode.due_date || episode.target_release_date;
  if (!priorityDate) {
    return { label: 'Date pending', tone: 'planned' };
  }

  const day = 24 * 60 * 60 * 1000;
  const due = new Date(`${priorityDate}T12:00:00Z`).getTime();
  const current = new Date(`${today}T12:00:00Z`).getTime();
  const daysAway = Math.ceil((due - current) / day);
  if (daysAway < 0) return { label: 'Past due', tone: 'urgent' };
  if (daysAway <= 7) return { label: 'Mic priority', tone: 'urgent' };
  if (daysAway <= 21) return { label: 'Coming up', tone: 'soon' };
  return { label: 'Planned', tone: 'planned' };
}

export default function MicKitsPage({ adminMode = false }) {
  const [tracker, setTracker] = useState(null);
  const [automation, setAutomation] = useState({
    recommendations: [],
    actions: [],
    metrics: {},
  });
  const [episodes, setEpisodes] = useState([]);
  const [episodesLoading, setEpisodesLoading] = useState(true);
  const [episodesError, setEpisodesError] = useState('');
  const [configured, setConfigured] = useState(true);
  const [canRequest, setCanRequest] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [showRequestForm, setShowRequestForm] = useState(false);
  const [showAddKit, setShowAddKit] = useState(false);
  const [requestDraft, setRequestDraft] = useState(EMPTY_REQUEST);
  const [newKit, setNewKit] = useState({ label: '', home_country: 'US' });
  const [editingKitId, setEditingKitId] = useState('');
  const [kitDraft, setKitDraft] = useState(null);
  const [responseDrafts, setResponseDrafts] = useState({});
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    let alive = true;

    async function loadTracker() {
      try {
        const response = await fetch(
          `/api/studio/mic-kits?view=${adminMode ? 'admin' : 'host'}`,
          {
          credentials: 'same-origin',
          }
        );
        const data = await response.json();
        if (!response.ok) {
          throw new Error(data.error || 'Could not open the mic kit board.');
        }
        if (!alive) return;
        setTracker(data.tracker);
        setConfigured(data.configured !== false);
        setCanRequest(data.can_request === true);
        setCanManage(data.can_manage === true);
        setAutomation(
          data.automation || {
            recommendations: [],
            actions: [],
            metrics: {},
          }
        );
      } catch (err) {
        if (alive) {
          setError(err.message || 'Could not open the mic kit board.');
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    loadTracker();
    return () => {
      alive = false;
    };
  }, [adminMode]);

  useEffect(() => {
    let alive = true;

    async function loadEpisodes() {
      setEpisodesLoading(true);
      setEpisodesError('');
      try {
        const response = await fetch(
          `/api/studio/episodes${
            adminMode || canManage ? '' : '?scope=mine'
          }`,
          { credentials: 'same-origin' }
        );
        const data = await response.json();
        if (!response.ok) {
          if (data.code === 'PROFILE_NOT_CONNECTED') {
            if (alive) setEpisodes([]);
            return;
          }
          throw new Error(
            data.error || 'Could not load the upcoming episode calendar.'
          );
        }
        if (alive) setEpisodes(data.episodes || []);
      } catch (err) {
        if (alive) {
          setEpisodesError(
            err.message || 'Could not load the upcoming episode calendar.'
          );
        }
      } finally {
        if (alive) setEpisodesLoading(false);
      }
    }

    loadEpisodes();
    return () => {
      alive = false;
    };
  }, [adminMode, canManage]);

  const today = new Date().toISOString().slice(0, 10);
  const summary = useMemo(() => kitSummary(tracker), [tracker]);
  const showManage = canManage;
  const recommendationsByRequestId = useMemo(
    () =>
      new Map(
        (automation.recommendations || []).map((recommendation) => [
          recommendation.request_id,
          recommendation,
        ])
      ),
    [automation.recommendations]
  );
  const requestsById = useMemo(
    () =>
      new Map(
        (tracker?.requests || []).map((request) => [
          request.request_id,
          request,
        ])
      ),
    [tracker]
  );
  const openRequests = useMemo(
    () =>
      (tracker?.requests || [])
        .filter((request) =>
          ['requested', 'approved', 'waitlisted', 'assigned'].includes(
            request.status
          )
        )
        .sort(
          (a, b) =>
            (recommendationsByRequestId.get(b.request_id)?.priority_score ||
              0) -
              (recommendationsByRequestId.get(a.request_id)
                ?.priority_score || 0) ||
            String(a.need_by || '9999').localeCompare(
              String(b.need_by || '9999')
            ) || a.requester_name.localeCompare(b.requester_name)
        ),
    [recommendationsByRequestId, tracker]
  );
  const recentClosedRequests = useMemo(
    () =>
      (tracker?.requests || [])
        .filter((request) =>
          ['returned', 'declined', 'cancelled'].includes(request.status)
        )
        .sort((a, b) =>
          String(b.updated_at || b.created_at).localeCompare(
            String(a.updated_at || a.created_at)
          )
        )
        .slice(0, 20),
    [tracker]
  );
  const upcomingEpisodes = useMemo(
    () =>
      episodes
        .filter(
          (episode) =>
            ['planning', 'in_progress', 'needs_changes'].includes(
              episode.status
            ) &&
            (!episode.target_release_date ||
              episode.target_release_date >= today)
        )
        .sort(
          (a, b) =>
            String(
              a.due_date || a.target_release_date || '9999'
            ).localeCompare(
              String(b.due_date || b.target_release_date || '9999')
            ) || a.title.localeCompare(b.title)
        )
        .slice(0, 8),
    [episodes, today]
  );
  const episodesById = useMemo(
    () =>
      new Map(
        episodes.map((episode) => [episode.episode_id, episode])
      ),
    [episodes]
  );
  const activeRequestPeople = useMemo(
    () =>
      new Set(
        (tracker?.requests || [])
          .filter((request) =>
            [
              'requested',
              'approved',
              'waitlisted',
              'assigned',
              'checked_out',
            ].includes(request.status)
          )
          .map((request) => request.requester_person_id)
          .filter(Boolean)
      ),
    [tracker]
  );
  const activeRequestNames = useMemo(
    () =>
      new Set(
        (tracker?.requests || [])
          .filter((request) =>
            [
              'requested',
              'approved',
              'waitlisted',
              'assigned',
              'checked_out',
            ].includes(request.status)
          )
          .map((request) => comparableName(request.requester_name))
          .filter(Boolean)
      ),
    [tracker]
  );

  async function mutate(action, payload = {}, method = 'PATCH') {
    if (working || !tracker) return false;
    setWorking(true);
    setMessage('');
    setError('');
    try {
      const response = await fetch(
        `/api/studio/mic-kits?view=${adminMode ? 'admin' : 'host'}`,
        {
        method,
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          expected_updated_at: tracker.updated_at || '',
          ...payload,
        }),
        }
      );
      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || 'Could not update the mic kit board.');
      }
      setTracker(data.tracker);
      setConfigured(data.configured !== false);
      setCanRequest(data.can_request === true);
      setCanManage(data.can_manage === true);
      setAutomation(
        data.automation || {
          recommendations: [],
          actions: [],
          metrics: {},
        }
      );
      return true;
    } catch (err) {
      setError(err.message || 'Could not update the mic kit board.');
      return false;
    } finally {
      setWorking(false);
    }
  }

  function updateRequestDraft(field, value) {
    setRequestDraft((current) => ({ ...current, [field]: value }));
  }

  function updateShipping(field, value) {
    setRequestDraft((current) => ({
      ...current,
      shipping: { ...current.shipping, [field]: value },
    }));
  }

  async function submitRequest(event) {
    event.preventDefault();
    const saved = await mutate(
      'create_request',
      { request: requestDraft },
      'POST'
    );
    if (!saved) return;
    setRequestDraft(EMPTY_REQUEST);
    setShowRequestForm(false);
    setMessage(
      'Your request is on the shared board. A coordinator can now assign the best kit without a group email.'
    );
  }

  async function cancelRequest(requestId) {
    const saved = await mutate('cancel_request', { request_id: requestId });
    if (saved) setMessage('The mic kit request was cancelled.');
  }

  function beginKitEdit(kit) {
    setEditingKitId(kit.kit_id);
    setKitDraft(defaultKitDraft(kit));
    setMessage('');
    setError('');
  }

  async function saveKit(event) {
    event.preventDefault();
    const saved = await mutate('update_kit', { kit: kitDraft });
    if (!saved) return;
    setEditingKitId('');
    setKitDraft(null);
    setMessage('The kit location and mailing plan were updated.');
  }

  async function addKit(event) {
    event.preventDefault();
    const saved = await mutate('add_kit', { kit: newKit });
    if (!saved) return;
    setNewKit({ label: '', home_country: 'US' });
    setShowAddKit(false);
    setMessage('The new mic kit was added to the shared inventory.');
  }

  async function confirmInventory() {
    const count = (tracker.kits || []).filter(
      (kit) => kit.status !== 'retired'
    ).length;
    const saved = await mutate('confirm_inventory', {
      inventory_note: `Confirmed working inventory: ${count} kit${
        count === 1 ? '' : 's'
      } in circulation.`,
    });
    if (saved) {
      setMessage(
        `Inventory confirmed at ${count} kit${count === 1 ? '' : 's'}.`
      );
    }
  }

  function updateResponseDraft(request, patch) {
    setResponseDrafts((current) => ({
      ...current,
      [request.request_id]: {
        status:
          current[request.request_id]?.status ||
          (['approved', 'waitlisted', 'declined'].includes(request.status)
            ? request.status
            : 'approved'),
        admin_response:
          current[request.request_id]?.admin_response ??
          request.admin_response ??
          '',
        ...patch,
      },
    }));
  }

  async function respondToRequest(request) {
    const draft = responseDrafts[request.request_id] || {
      status: ['approved', 'waitlisted', 'declined'].includes(request.status)
        ? request.status
        : 'approved',
      admin_response: request.admin_response || '',
    };
    const saved = await mutate('update_request', {
      request_id: request.request_id,
      status: draft.status,
      admin_response: draft.admin_response,
    });
    if (saved) {
      setMessage(`Response saved for ${request.requester_name}.`);
      setResponseDrafts((current) => {
        const next = { ...current };
        delete next[request.request_id];
        return next;
      });
    }
  }

  async function checkoutKit(kit) {
    const request = requestsById.get(kit.next_request_id);
    if (!request) return;
    const saved = await mutate('checkout_kit', {
      kit_id: kit.kit_id,
      request_id: request.request_id,
      due_back: kit.due_back || '',
    });
    if (saved) {
      setMessage(
        `${kit.label} is now checked out to ${request.requester_name}.`
      );
    }
  }

  async function checkinKit(kit) {
    const saved = await mutate('checkin_kit', { kit_id: kit.kit_id });
    if (saved) {
      setMessage(`${kit.label} is checked in and available again.`);
    }
  }

  async function prepareRecommendedHandoff(request) {
    const recommendation = recommendationsByRequestId.get(
      request.request_id
    );
    if (!recommendation?.recommended_kit_id) return;
    const saved = await mutate('apply_recommendation', {
      request_id: request.request_id,
    });
    if (saved) {
      setMessage(
        `${recommendation.recommended_kit_label} is assigned to ${request.requester_name}, with the ship-by date filled in.`
      );
    }
  }

  async function confirmReceipt(request) {
    const saved = await mutate('confirm_receipt', {
      request_id: request.request_id,
    });
    if (saved) {
      setMessage('Thanks—the kit is now checked out to you.');
    }
  }

  if (loading) {
    const LoadingLayout = adminMode ? AdminLayout : StudioLayout;
    return (
      <LoadingLayout
        requiredPermission={
          adminMode ? 'mic_kits:manage' : 'mic_kits:read'
        }
      >
        <div className={studioStyles.notice}>
          <h2>Opening the mic kit board…</h2>
          <p>Checking kit locations, requests, and upcoming handoffs.</p>
        </div>
      </LoadingLayout>
    );
  }

  const PageLayout = adminMode ? AdminLayout : StudioLayout;
  return (
    <PageLayout
      requiredPermission={
        adminMode ? 'mic_kits:manage' : 'mic_kits:read'
      }
    >
      <div className={styles.workspace}>
      <header className={studioStyles.pageHeader}>
        <div>
          <span className={studioStyles.eyebrow}>
            {adminMode ? 'Admin circulation desk' : 'Shared team logistics'}
          </span>
          <h1>{adminMode ? 'Mic Kit Checkout' : 'Mic Kits'}</h1>
          <p>
            {adminMode
              ? 'Review every request, respond to hosts, assign the right case, and check each kit out and back in like a library item.'
              : 'See how many kits are available, where the cases are, and request one for any recording date—even when every kit is currently checked out.'}
          </p>
        </div>
        {canRequest && !adminMode ? (
          <button
            type="button"
            className={studioStyles.primaryButton}
            onClick={() => setShowRequestForm((current) => !current)}
          >
            <HeadsetMicRoundedIcon aria-hidden="true" />
            {showRequestForm ? 'Close request form' : 'I need a mic kit'}
          </button>
        ) : null}
      </header>

      <div aria-live="polite">
        {message ? (
          <p className={studioStyles.successMessage}>{message}</p>
        ) : null}
        {error ? <p className={studioStyles.errorMessage}>{error}</p> : null}
      </div>

      {!configured ? (
        <section className={styles.setupNotice}>
          <LockRoundedIcon aria-hidden="true" />
          <div>
            <strong>Previewing the proposed board</strong>
            <p>
              The shared database connection is not available in this
              environment, so changes cannot be saved here yet.
            </p>
          </div>
        </section>
      ) : null}

      {!tracker?.inventory_confirmed ? (
        <section className={styles.inventoryNotice}>
          <Inventory2RoundedIcon aria-hidden="true" />
          <div>
            <strong>Working count: 4 reported + 1 possible</strong>
            <p>{tracker?.inventory_note}</p>
          </div>
          {showManage ? (
            <button
              type="button"
              className={studioStyles.secondaryButton}
              onClick={confirmInventory}
              disabled={working}
            >
              <CheckCircleRoundedIcon aria-hidden="true" />
              Confirm final count
            </button>
          ) : null}
        </section>
      ) : null}

      <section className={styles.summaryGrid} aria-label="Mic kit summary">
        <article>
          <strong>{summary.total}</strong>
          <span>In circulation</span>
        </article>
        <article>
          <strong>{summary.available}</strong>
          <span>Available now</span>
        </article>
        <article>
          <strong>{summary.moving}</strong>
          <span>In the mail</span>
        </article>
        <article>
          <strong>{summary.waiting}</strong>
          <span>Waiting requests</span>
        </article>
        <article className={summary.attention ? styles.attentionSummary : ''}>
          <strong>{summary.attention}</strong>
          <span>Need attention</span>
        </article>
      </section>

      {showRequestForm ? (
        <section className={styles.requestPanel}>
          <div className={styles.sectionHeading}>
            <div>
              <span>Self-service request</span>
              <h2>Tell the team when and where you need a kit</h2>
              <p>
                Your name, general location, and need-by date appear on the
                team board. Your street address stays private to you and the
                shipping coordinators.
              </p>
            </div>
            <LockRoundedIcon aria-label="Private shipping details" />
          </div>
          <form onSubmit={submitRequest} className={styles.form}>
            <div className={styles.fieldGrid}>
              <label>
                Country
                <select
                  value={requestDraft.country}
                  onChange={(event) => {
                    updateRequestDraft('country', event.target.value);
                    updateShipping('country', event.target.value);
                  }}
                  required
                >
                  <option value="US">United States</option>
                  <option value="CA">Canada</option>
                  <option value="AT">Austria</option>
                  <option value="IT">Italy</option>
                  <option value="CH">Switzerland</option>
                  <option value="XX">Other</option>
                </select>
              </label>
              <label>
                City / region shown to the team
                <input
                  value={requestDraft.city_region}
                  onChange={(event) =>
                    updateRequestDraft('city_region', event.target.value)
                  }
                  placeholder="Bend, Oregon"
                  maxLength={180}
                  required
                />
              </label>
              <label>
                Need the kit by
                <input
                  type="date"
                  value={requestDraft.need_by}
                  min={today}
                  onChange={(event) =>
                    updateRequestDraft('need_by', event.target.value)
                  }
                  required
                />
              </label>
              <label>
                Recording date <span>(if known)</span>
                <input
                  type="date"
                  value={requestDraft.recording_date}
                  min={today}
                  onChange={(event) =>
                    updateRequestDraft('recording_date', event.target.value)
                  }
                />
              </label>
              <label className={styles.fullField}>
                Episode assignment <span>(optional)</span>
                <select
                  value={requestDraft.episode_id}
                  onChange={(event) =>
                    updateRequestDraft('episode_id', event.target.value)
                  }
                  disabled={episodesLoading || !upcomingEpisodes.length}
                >
                  <option value="">
                    {episodesLoading
                      ? 'Loading your upcoming episodes…'
                      : 'Not tied to a specific episode'}
                  </option>
                  {upcomingEpisodes.map((episode) => (
                    <option
                      key={episode.episode_id}
                      value={episode.episode_id}
                    >
                      {episode.title} ·{' '}
                      {formatDate(
                        episode.due_date || episode.target_release_date
                      )}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <fieldset>
              <legend>Private mailing address</legend>
              <div className={styles.fieldGrid}>
                <label>
                  Recipient name
                  <input
                    value={requestDraft.shipping.recipient}
                    onChange={(event) =>
                      updateShipping('recipient', event.target.value)
                    }
                    autoComplete="name"
                    required
                  />
                </label>
                <label>
                  Address
                  <input
                    value={requestDraft.shipping.address_line_1}
                    onChange={(event) =>
                      updateShipping('address_line_1', event.target.value)
                    }
                    autoComplete="address-line1"
                    required
                  />
                </label>
                <label>
                  Address line 2 <span>(optional)</span>
                  <input
                    value={requestDraft.shipping.address_line_2}
                    onChange={(event) =>
                      updateShipping('address_line_2', event.target.value)
                    }
                    autoComplete="address-line2"
                  />
                </label>
                <label>
                  City
                  <input
                    value={requestDraft.shipping.city}
                    onChange={(event) =>
                      updateShipping('city', event.target.value)
                    }
                    autoComplete="address-level2"
                    required
                  />
                </label>
                <label>
                  State / province / region
                  <input
                    value={requestDraft.shipping.region}
                    onChange={(event) =>
                      updateShipping('region', event.target.value)
                    }
                    autoComplete="address-level1"
                    required
                  />
                </label>
                <label>
                  Postal code
                  <input
                    value={requestDraft.shipping.postal_code}
                    onChange={(event) =>
                      updateShipping('postal_code', event.target.value)
                    }
                    autoComplete="postal-code"
                    required
                  />
                </label>
              </div>
            </fieldset>

            <label className={styles.fullField}>
              Notes <span>(optional)</span>
              <textarea
                value={requestDraft.notes}
                onChange={(event) =>
                  updateRequestDraft('notes', event.target.value)
                }
                placeholder="Travel dates, access constraints, or anything the shipper should know."
                rows={3}
                maxLength={1200}
              />
            </label>

            <div className={styles.formActions}>
              <button
                type="submit"
                className={studioStyles.primaryButton}
                disabled={working}
              >
                {working ? 'Adding request…' : 'Add me to the queue'}
              </button>
              <button
                type="button"
                className={studioStyles.secondaryButton}
                onClick={() => setShowRequestForm(false)}
                disabled={working}
              >
                Cancel
              </button>
            </div>
          </form>
        </section>
      ) : null}

      <section className={styles.section}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Where’s my mic?</span>
            <h2>Kit locations and next handoffs</h2>
            <p>
              Retired kits remain recorded but are left out of the active
              count.
            </p>
          </div>
          {showManage ? (
            <button
              type="button"
              className={studioStyles.secondaryButton}
              onClick={() => setShowAddKit((current) => !current)}
            >
              <AddRoundedIcon aria-hidden="true" />
              Add a kit
            </button>
          ) : null}
        </div>

        {showAddKit && showManage ? (
          <form onSubmit={addKit} className={styles.addKitForm}>
            <label>
              Kit label
              <input
                value={newKit.label}
                onChange={(event) =>
                  setNewKit((current) => ({
                    ...current,
                    label: event.target.value,
                  }))
                }
                placeholder="TAH US Kit 4"
                required
              />
            </label>
            <label>
              Home country
              <select
                value={newKit.home_country}
                onChange={(event) =>
                  setNewKit((current) => ({
                    ...current,
                    home_country: event.target.value,
                  }))
                }
              >
                <option value="US">United States</option>
                <option value="CA">Canada</option>
                <option value="">Not set</option>
              </select>
            </label>
            <button
              type="submit"
              className={studioStyles.primaryButton}
              disabled={working}
            >
              Add kit
            </button>
          </form>
        ) : null}

        <div className={styles.kitGrid}>
          {(tracker?.kits || []).map((kit) => {
            const nextRequest = requestsById.get(kit.next_request_id);
            const editing = editingKitId === kit.kit_id && kitDraft;
            return (
              <article
                key={kit.kit_id}
                className={`${styles.kitCard} ${
                  kit.status === 'retired' ? styles.retiredCard : ''
                }`}
              >
                <div className={styles.kitCardHeader}>
                  <span className={styles.kitIcon}>
                    <HeadsetMicRoundedIcon aria-hidden="true" />
                  </span>
                  <div>
                    <div className={styles.kitTitleRow}>
                      <h3>{kit.label}</h3>
                      {kit.possible_addition ? (
                        <span className={styles.possibleBadge}>Possible</span>
                      ) : null}
                    </div>
                    <p>{formatCountry(kit.home_country)}</p>
                  </div>
                  <span
                    className={`${styles.statusBadge} ${
                      styles[`status_${kit.status}`] || ''
                    }`}
                  >
                    {MIC_KIT_STATUS_LABELS[kit.status] || kit.status}
                  </span>
                </div>

                <dl className={styles.kitDetails}>
                  <div>
                    <dt>Current holder</dt>
                    <dd>{kit.current_holder_name || 'Not confirmed'}</dd>
                  </div>
                  <div>
                    <dt>Current location</dt>
                    <dd>{kit.current_location || 'Not confirmed'}</dd>
                  </div>
                  <div>
                    <dt>Next recipient</dt>
                    <dd>
                      {nextRequest
                        ? `${nextRequest.requester_name} · ${formatDate(
                            nextRequest.need_by
                          )}`
                        : 'No one assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt>Ship by</dt>
                    <dd>{formatDate(kit.ship_by)}</dd>
                  </div>
                  {kit.checked_out_request_id ? (
                    <>
                      <div>
                        <dt>Checked out</dt>
                        <dd>{formatDate(kit.checked_out_at?.slice(0, 10))}</dd>
                      </div>
                      <div>
                        <dt>Due back</dt>
                        <dd>{formatDate(kit.due_back)}</dd>
                      </div>
                    </>
                  ) : null}
                </dl>

                {kit.tracking_url ? (
                  <a
                    href={kit.tracking_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.trackingLink}
                  >
                    <LocalShippingRoundedIcon aria-hidden="true" />
                    Track with {kit.carrier || 'carrier'}
                    {kit.tracking_number
                      ? ` · ${kit.tracking_number}`
                      : ''}
                  </a>
                ) : kit.tracking_number ? (
                  <p className={styles.trackingLink}>
                    <LocalShippingRoundedIcon aria-hidden="true" />
                    {kit.carrier || 'Tracking'} · {kit.tracking_number}
                  </p>
                ) : kit.tracking_available ? (
                  <p className={styles.privateTracking}>
                    <LockRoundedIcon aria-hidden="true" />
                    Tracking is private to the recipient and coordinators.
                  </p>
                ) : null}

                {showManage && !editing ? (
                  <div className={styles.formActions}>
                    <button
                      type="button"
                      className={studioStyles.secondaryButton}
                      onClick={() => beginKitEdit(kit)}
                    >
                      <EditRoundedIcon aria-hidden="true" />
                      Update kit
                    </button>
                    {kit.checked_out_request_id ? (
                      <button
                        type="button"
                        className={studioStyles.secondaryButton}
                        onClick={() => checkinKit(kit)}
                        disabled={working}
                      >
                        Check in kit
                      </button>
                    ) : null}
                    {nextRequest ? (
                      <button
                        type="button"
                        className={studioStyles.primaryButton}
                        onClick={() => checkoutKit(kit)}
                        disabled={working}
                      >
                        {kit.checked_out_request_id
                          ? `Complete handoff to ${nextRequest.requester_name}`
                          : `Check out to ${nextRequest.requester_name}`}
                      </button>
                    ) : null}
                  </div>
                ) : null}

                {editing ? (
                  <form onSubmit={saveKit} className={styles.kitEditor}>
                    <label>
                      Label
                      <input
                        value={kitDraft.label}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            label: event.target.value,
                          }))
                        }
                        required
                      />
                    </label>
                    <label>
                      Home country
                      <select
                        value={kitDraft.home_country}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            home_country: event.target.value,
                          }))
                        }
                      >
                        <option value="">Not set</option>
                        <option value="US">United States</option>
                        <option value="CA">Canada</option>
                      </select>
                    </label>
                    <label>
                      Status
                      <select
                        value={kitDraft.status}
                        onChange={(event) =>
                          setKitDraft((current) => {
                            return applyMicKitStatus(
                              current,
                              event.target.value
                            );
                          })
                        }
                      >
                        {Object.entries(MIC_KIT_STATUS_LABELS).map(
                          ([value, label]) => (
                            <option key={value} value={value}>
                              {label}
                            </option>
                          )
                        )}
                      </select>
                    </label>
                    <label>
                      Current holder
                      <input
                        value={kitDraft.current_holder_name}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            current_holder_name: event.target.value,
                          }))
                        }
                        placeholder="Host or storage contact"
                      />
                    </label>
                    <label>
                      Current city / region
                      <input
                        value={kitDraft.current_location}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            current_location: event.target.value,
                          }))
                        }
                        placeholder="Bend, Oregon"
                      />
                    </label>
                    <label>
                      Next request
                      <select
                        value={kitDraft.next_request_id}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            next_request_id: event.target.value,
                          }))
                        }
                      >
                        <option value="">No next recipient</option>
                        {openRequests.map((request) => (
                          <option
                            key={request.request_id}
                            value={request.request_id}
                          >
                            {request.requester_name} ·{' '}
                            {formatDate(request.need_by)}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label>
                      Ship by
                      <input
                        type="date"
                        value={kitDraft.ship_by}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            ship_by: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Due back
                      <input
                        type="date"
                        value={kitDraft.due_back}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            due_back: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <div className={styles.shippingPresetHeading}>
                      <strong>Reusable shipping preset</strong>
                      <span>
                        Enter the packed case measurements once so exports are
                        ready for label creation.
                      </span>
                    </div>
                    <label>
                      Packed weight (lb)
                      <input
                        type="number"
                        min="0.01"
                        max="999"
                        step="0.01"
                        value={kitDraft.package_weight_lb}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            package_weight_lb: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Length (in)
                      <input
                        type="number"
                        min="0.01"
                        max="999"
                        step="0.01"
                        value={kitDraft.package_length_in}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            package_length_in: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Width (in)
                      <input
                        type="number"
                        min="0.01"
                        max="999"
                        step="0.01"
                        value={kitDraft.package_width_in}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            package_width_in: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Height (in)
                      <input
                        type="number"
                        min="0.01"
                        max="999"
                        step="0.01"
                        value={kitDraft.package_height_in}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            package_height_in: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Carrier
                      <input
                        value={kitDraft.carrier}
                        disabled={kitDraft.status === 'available'}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            carrier: event.target.value,
                          }))
                        }
                        placeholder="USPS, UPS, Canada Post…"
                      />
                    </label>
                    <label>
                      Tracking number
                      <input
                        value={kitDraft.tracking_number}
                        disabled={kitDraft.status === 'available'}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            tracking_number: event.target.value,
                          }))
                        }
                      />
                    </label>
                    <label>
                      Tracking link
                      <input
                        type="url"
                        value={kitDraft.tracking_url}
                        disabled={kitDraft.status === 'available'}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            tracking_url: event.target.value,
                          }))
                        }
                        placeholder="https://…"
                      />
                    </label>
                    <label className={styles.fullField}>
                      Private coordinator notes
                      <textarea
                        value={kitDraft.notes}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            notes: event.target.value,
                          }))
                        }
                        rows={3}
                      />
                    </label>
                    <label className={styles.checkboxField}>
                      <input
                        type="checkbox"
                        checked={kitDraft.possible_addition}
                        onChange={(event) =>
                          setKitDraft((current) => ({
                            ...current,
                            possible_addition: event.target.checked,
                          }))
                        }
                      />
                      Keep marked as an unconfirmed possible kit
                    </label>
                    <div className={styles.formActions}>
                      <button
                        type="submit"
                        className={studioStyles.primaryButton}
                        disabled={working}
                      >
                        Save kit
                      </button>
                      <button
                        type="button"
                        className={studioStyles.secondaryButton}
                        onClick={() => {
                          setEditingKitId('');
                          setKitDraft(null);
                        }}
                        disabled={working}
                      >
                        Cancel
                      </button>
                    </div>
                  </form>
                ) : null}
              </article>
            );
          })}
        </div>
      </section>

      {showManage ? (
        <section className={styles.automationPanel}>
          <div className={styles.automationHeader}>
            <div>
              <span>Showrunner operations</span>
              <h2>Caleb’s next actions</h2>
              <p>
                Dates, episode assignments, kit locations, and request status
                are combined into one prioritized work list.
              </p>
            </div>
            <Link
              href="/api/studio/mic-kits/shipping-export"
              className={studioStyles.primaryButton}
            >
              <LocalShippingRoundedIcon aria-hidden="true" />
              Download USPS Click-N-Ship CSV
            </Link>
          </div>

          <div className={styles.automationMetrics}>
            <article>
              <strong>{automation.metrics?.ready_to_assign || 0}</strong>
              <span>Ready to auto-assign</span>
            </article>
            <article>
              <strong>{automation.metrics?.labels_to_create || 0}</strong>
              <span>Labels to create</span>
            </article>
            <article>
              <strong>{automation.metrics?.overdue_returns || 0}</strong>
              <span>Overdue returns</span>
            </article>
            <article>
              <strong>
                {automation.metrics?.uncovered_episode_hosts || 0}
              </strong>
              <span>Episode hosts without requests</span>
            </article>
          </div>

          <div className={styles.operationsGrid}>
            <div className={styles.nextActionList}>
              <h3>Prioritized work</h3>
              {(automation.actions || []).length ? (
                automation.actions.slice(0, 8).map((action) => {
                  const request = requestsById.get(action.request_id);
                  return (
                    <article
                      key={action.action_id}
                      className={`${styles.nextAction} ${
                        styles[`action_${action.urgency}`] || ''
                      }`}
                    >
                      <span>{action.urgency}</span>
                      <div>
                        <strong>{action.title}</strong>
                        <p>{action.detail}</p>
                      </div>
                      {action.kind === 'prepare_handoff' && request ? (
                        <button
                          type="button"
                          className={studioStyles.secondaryButton}
                          onClick={() =>
                            prepareRecommendedHandoff(request)
                          }
                          disabled={working}
                        >
                          Prepare handoff
                        </button>
                      ) : null}
                    </article>
                  );
                })
              ) : (
                <div className={styles.operationsClear}>
                  No urgent mic-kit work is waiting.
                </div>
              )}
            </div>

            <aside className={styles.shippingAutomation}>
              <span>Shipping automation</span>
              <h3>One clean handoff into label creation</h3>
              <p>
                The export includes US-origin handoffs inside USPS’s
                seven-day mailing window, with each host’s private address,
                ship date, and saved case measurements.
              </p>
              <div className={styles.shippingModes}>
                <span>
                  <strong>Available now</strong>
                  Click-N-Ship file upload
                </span>
                <span>
                  <strong>Next integration</strong>
                  Direct USPS labels after account onboarding
                </span>
              </div>
              <ol>
                <li>Use the recommendation to reserve a kit.</li>
                <li>Download the US-origin shipments as a mapped CSV.</li>
                <li>
                  Upload it to USPS Click-N-Ship, review rates, and paste
                  tracking back once.
                </li>
              </ol>
              <p className={styles.integrationNote}>
                Canada-origin handoffs stay out of this export so the team can
                choose the correct Canadian carrier. The shipping layer is
                separated so USPS OAuth label creation can replace the file
                upload later without changing the host workflow.
              </p>
              <div className={styles.integrationLinks}>
                <a
                  href="https://faq.usps.com/articles/Knowledge/Click-N-Ship-The-Basics"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  Click-N-Ship guide
                </a>
                <a
                  href="https://developers.usps.com/domesticlabelsv3"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  USPS label API
                </a>
              </div>
            </aside>
          </div>
        </section>
      ) : null}

      <div className={styles.planningGrid}>
      <section className={`${styles.section} ${styles.queueSection}`}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Upcoming demand</span>
            <h2>Request queue</h2>
            <p>
              Sorted by need-by date so the team can plan the shortest,
              least-expensive handoff.
            </p>
          </div>
        </div>

        {openRequests.length ? (
          <div className={styles.requestList}>
            {openRequests.map((request) => {
              const recommendation =
                recommendationsByRequestId.get(request.request_id);
              return (
              <article key={request.request_id} className={styles.requestCard}>
                <div className={styles.requestIdentity}>
                  <span className={styles.avatar}>
                    {request.requester_name.charAt(0).toUpperCase()}
                  </span>
                  <div>
                    <h3>{request.requester_name}</h3>
                    <p>
                      <PlaceRoundedIcon aria-hidden="true" />
                      {request.city_region} · {formatCountry(request.country)}
                    </p>
                  </div>
                </div>
                <dl>
                  <div>
                    <dt>Need by</dt>
                    <dd>{formatDate(request.need_by)}</dd>
                  </div>
                  <div>
                    <dt>Recording</dt>
                    <dd>{formatDate(request.recording_date)}</dd>
                  </div>
                  <div>
                    <dt>Status</dt>
                    <dd>
                      {REQUEST_STATUS_LABELS[request.status] || request.status}
                    </dd>
                  </div>
                  <div>
                    <dt>Assigned kit</dt>
                    <dd>
                      {tracker.kits.find(
                        (kit) => kit.kit_id === request.kit_id
                      )?.label || 'Not assigned'}
                    </dd>
                  </div>
                  <div>
                    <dt>Episode</dt>
                    <dd>
                      {episodesById.get(request.episode_id)?.title ||
                        'Not linked'}
                    </dd>
                  </div>
                </dl>
                {request.shipping ? (
                  <p className={styles.privateAddress}>
                    <LockRoundedIcon aria-hidden="true" />
                    <span>
                      <strong>Private mailing:</strong>{' '}
                      {formatAddress(request.shipping)}
                    </span>
                  </p>
                ) : null}
                {request.notes ? (
                  <p className={styles.requestNotes}>{request.notes}</p>
                ) : null}
                {request.admin_response ? (
                  <p className={styles.adminResponse}>
                    <strong>
                      Response from {request.admin_updated_by || 'admin'}:
                    </strong>{' '}
                    {request.admin_response}
                  </p>
                ) : null}
                {showManage && recommendation ? (
                  <div className={styles.priorityRecommendation}>
                    <div>
                      <span>{recommendation.priority_label}</span>
                      <strong>
                        {recommendation.recommended_kit_label
                          ? `${recommendation.recommended_kit_label} is the best current fit`
                          : 'No confirmed kit is available yet'}
                      </strong>
                      <p>{recommendation.reasons.join(' · ')}</p>
                      {recommendation.recommended_kit_id ? (
                        <em>
                          {recommendation.recommended_shipping_provider ===
                          'usps_click_n_ship'
                            ? 'USPS Click-N-Ship route'
                            : 'Separate carrier decision required'}
                        </em>
                      ) : null}
                    </div>
                    {recommendation.recommended_kit_id ? (
                      <button
                        type="button"
                        className={studioStyles.primaryButton}
                        onClick={() =>
                          prepareRecommendedHandoff(request)
                        }
                        disabled={working}
                      >
                        Prepare handoff
                      </button>
                    ) : null}
                  </div>
                ) : null}
                <div className={styles.requestActions}>
                  {request.is_mine && request.status === 'assigned' ? (
                    <button
                      type="button"
                      className={studioStyles.primaryButton}
                      onClick={() => confirmReceipt(request)}
                      disabled={working}
                    >
                      I received this kit
                    </button>
                  ) : null}
                  {request.is_mine || showManage ? (
                    <button
                      type="button"
                      className={studioStyles.secondaryButton}
                      onClick={() => cancelRequest(request.request_id)}
                      disabled={working}
                    >
                      Cancel request
                    </button>
                  ) : null}
                </div>
                {showManage &&
                ['requested', 'approved', 'waitlisted'].includes(
                  request.status
                ) ? (
                  <div className={styles.responseDesk}>
                    <label>
                      Decision
                      <select
                        value={
                          responseDrafts[request.request_id]?.status ||
                          (['approved', 'waitlisted', 'declined'].includes(
                            request.status
                          )
                            ? request.status
                            : 'approved')
                        }
                        onChange={(event) =>
                          updateResponseDraft(request, {
                            status: event.target.value,
                          })
                        }
                      >
                        <option value="approved">Approve</option>
                        <option value="waitlisted">Waitlist</option>
                        <option value="declined">Decline</option>
                      </select>
                    </label>
                    <label>
                      Response to host
                      <textarea
                        value={
                          responseDrafts[request.request_id]
                            ?.admin_response ??
                          request.admin_response ??
                          ''
                        }
                        onChange={(event) =>
                          updateResponseDraft(request, {
                            admin_response: event.target.value,
                          })
                        }
                        placeholder="Let the host know what happens next."
                        rows={2}
                        maxLength={1200}
                      />
                    </label>
                    <button
                      type="button"
                      className={studioStyles.primaryButton}
                      onClick={() => respondToRequest(request)}
                      disabled={working}
                    >
                      Send response
                    </button>
                  </div>
                ) : null}
              </article>
              );
            })}
          </div>
        ) : (
          <div className={studioStyles.emptyState}>
            <h2>No one is waiting for a kit</h2>
            <p>
              New requests will appear here automatically in need-by order.
            </p>
          </div>
        )}

        {recentClosedRequests.length ? (
          <details className={styles.recentHistory}>
            <summary>
              Recent returned, declined, and cancelled requests (
              {recentClosedRequests.length})
            </summary>
            <div>
              {recentClosedRequests.map((request) => (
                <article key={request.request_id}>
                  <span>
                    <strong>{request.requester_name}</strong>
                    {request.city_region
                      ? ` · ${request.city_region}`
                      : ''}
                  </span>
                  <span>{formatDate(request.need_by)}</span>
                  <span>
                    {tracker.kits.find(
                      (kit) => kit.kit_id === request.kit_id
                    )?.label || 'No kit recorded'}
                  </span>
                  <span>
                    {REQUEST_STATUS_LABELS[request.status] || request.status}
                  </span>
                </article>
              ))}
            </div>
          </details>
        ) : null}
      </section>

      <section className={`${styles.section} ${styles.episodeSection}`}>
        <div className={styles.sectionHeading}>
          <div>
            <span>Recording calendar</span>
            <h2>Upcoming episodes</h2>
            <p>
              Assigned hosts with the closest production dates should receive
              mic-kit priority.
            </p>
          </div>
          <CalendarMonthRoundedIcon aria-hidden="true" />
        </div>

        {episodesLoading ? (
          <div className={styles.episodeEmpty}>
            Loading upcoming episode assignments…
          </div>
        ) : episodesError ? (
          <div className={styles.episodeEmpty}>
            <strong>Episode calendar unavailable</strong>
            <p>{episodesError}</p>
          </div>
        ) : upcomingEpisodes.length ? (
          <div className={styles.episodeList}>
            {upcomingEpisodes.map((episode) => {
              const priority = episodePriority(episode, today);
              const hostNames = episode.host_names || [];
              const requestingHosts = hostNames.filter(
                (name, index) =>
                  activeRequestPeople.has(
                    episode.host_person_ids?.[index]
                  ) || activeRequestNames.has(comparableName(name))
              );
              return (
                <Link
                  key={episode.episode_id}
                  href={
                    adminMode
                      ? `/admin/studios/${episode.episode_id}`
                      : `/studio/episodes/${episode.episode_id}`
                  }
                  className={styles.episodeCard}
                >
                  <div className={styles.episodeCardHeader}>
                    <div>
                      <span>{episode.season || 'Episode Studio'}</span>
                      <h3>{episode.title}</h3>
                    </div>
                    <span
                      className={`${styles.priorityBadge} ${
                        styles[`priority_${priority.tone}`] || ''
                      }`}
                    >
                      {priority.label}
                    </span>
                  </div>

                  <div className={styles.episodeDates}>
                    <span>
                      <strong>{formatDate(episode.due_date)}</strong>
                      Host materials due
                    </span>
                    <span>
                      <strong>
                        {formatDate(episode.target_release_date)}
                      </strong>
                      Release date
                    </span>
                  </div>

                  <div className={styles.episodeHosts}>
                    <GroupsRoundedIcon aria-hidden="true" />
                    <div>
                      <span>Assigned hosts</span>
                      <strong>
                        {hostNames.length
                          ? hostNames.join(' + ')
                          : 'No hosts assigned'}
                      </strong>
                    </div>
                  </div>

                  <p
                    className={`${styles.requestCoverage} ${
                      requestingHosts.length
                        ? styles.requestCoverageActive
                        : ''
                    }`}
                  >
                    {requestingHosts.length
                      ? `Mic request on file: ${requestingHosts.join(', ')}`
                      : 'No active mic request from the assigned hosts'}
                  </p>

                  <span className={styles.episodeStatus}>
                    {EPISODE_STATUS_LABELS[episode.status] ||
                      episode.status}
                    <span aria-hidden="true">→</span>
                  </span>
                </Link>
              );
            })}
          </div>
        ) : (
          <div className={styles.episodeEmpty}>
            <strong>No upcoming episode assignments</strong>
            <p>
              New active Episode Studios will appear here automatically.
            </p>
          </div>
        )}
      </section>
      </div>

      <section className={styles.handoffGuide}>
        <div>
          <span>Simple handoff</span>
          <h2>How a kit moves</h2>
        </div>
        <ol>
          <li>
            <strong>1</strong>
            <span>A host adds a need-by date and private mailing address.</span>
          </li>
          <li>
            <strong>2</strong>
            <span>
              A coordinator assigns the closest available kit and a ship-by
              date.
            </span>
          </li>
          <li>
            <strong>3</strong>
            <span>
              The tracking number is visible to the recipient and
              coordinators.
            </span>
          </li>
          <li>
            <strong>4</strong>
            <span>
              After recording, the holder tapes the case and sends it to the
              next person with the provided label.
            </span>
          </li>
        </ol>
      </section>
      </div>
    </PageLayout>
  );
}
