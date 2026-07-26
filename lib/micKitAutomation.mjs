import {
  normalizeMicKitTracker,
} from './micKitPresentation.mjs';

const ACTIVE_REQUEST_STATUSES = new Set([
  'requested',
  'approved',
  'waitlisted',
  'assigned',
  'checked_out',
]);

const ASSIGNABLE_REQUEST_STATUSES = new Set([
  'requested',
  'approved',
  'waitlisted',
]);

const URGENCY_ORDER = {
  urgent: 0,
  high: 1,
  medium: 2,
  low: 3,
};

function cleanDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function dateAtNoon(value) {
  const date = cleanDate(value);
  return date ? new Date(`${date}T12:00:00Z`) : null;
}

function daysBetween(from, to) {
  const start = dateAtNoon(from);
  const end = dateAtNoon(to);
  if (!start || !end) return null;
  return Math.ceil((end.getTime() - start.getTime()) / 86400000);
}

function shiftDate(value, days) {
  const date = dateAtNoon(value);
  if (!date) return '';
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function priorityForDate(value, today) {
  const daysAway = daysBetween(today, value);
  if (daysAway === null) {
    return { score: 10, label: 'Date pending', urgency: 'low' };
  }
  if (daysAway < 0) {
    return { score: 140, label: 'Past due', urgency: 'urgent' };
  }
  if (daysAway <= 3) {
    return { score: 120, label: 'Urgent', urgency: 'urgent' };
  }
  if (daysAway <= 10) {
    return { score: 90, label: 'Next up', urgency: 'high' };
  }
  if (daysAway <= 21) {
    return { score: 65, label: 'Upcoming', urgency: 'medium' };
  }
  if (daysAway <= 45) {
    return { score: 40, label: 'Planned', urgency: 'low' };
  }
  return { score: 20, label: 'Later', urgency: 'low' };
}

function recommendationForRequest(request, episode, today) {
  const priorityDate =
    request.recording_date ||
    request.need_by ||
    episode?.recording_date ||
    episode?.due_date ||
    episode?.target_release_date ||
    '';
  const priority = priorityForDate(priorityDate, today);
  const reasons = [];
  let score = priority.score;

  if (request.recording_date) {
    reasons.push(`Recording ${request.recording_date}`);
    score += 20;
  } else if (request.need_by) {
    reasons.push(`Needed by ${request.need_by}`);
  }
  if (episode) {
    reasons.push(`Assigned to “${episode.title}”`);
    score += 15;
  }
  if (request.status === 'approved') {
    reasons.push('Approved and ready to assign');
    score += 12;
  } else if (request.status === 'requested') {
    reasons.push('Awaiting coordinator response');
    score += 8;
  } else if (request.status === 'waitlisted') {
    reasons.push('Currently waitlisted');
  }

  return {
    request_id: request.request_id,
    requester_name: request.requester_name,
    episode_id: episode?.episode_id || request.episode_id || '',
    episode_title: episode?.title || '',
    priority_date: priorityDate,
    priority_score: score,
    priority_label: priority.label,
    urgency: priority.urgency,
    reasons,
    recommended_kit_id: '',
    recommended_kit_label: '',
    recommended_shipping_provider: '',
    recommended_ship_by: '',
    recommended_due_back: '',
  };
}

function currentRequestForKit(tracker, kit) {
  return tracker.requests.find(
    (request) => request.request_id === kit.checked_out_request_id
  );
}

function originCountryForKit(tracker, kit) {
  return (
    currentRequestForKit(tracker, kit)?.shipping?.country ||
    kit.home_country ||
    ''
  );
}

function plannedShipBy(kit, request, tracker, today) {
  const originCountry = originCountryForKit(tracker, kit);
  const crossBorder =
    Boolean(originCountry && request.country) &&
    originCountry !== request.country;
  const needBy = request.need_by || request.recording_date;
  const proposed = shiftDate(needBy, crossBorder ? -12 : -6);
  return proposed && proposed > today ? proposed : today;
}

function canPlanKit(tracker, kit, request, today) {
  if (
    kit.next_request_id ||
    ['needs_confirmation', 'maintenance', 'retired', 'returning'].includes(
      kit.status
    )
  ) {
    return false;
  }
  if (kit.status === 'available' && !kit.checked_out_request_id) {
    return true;
  }
  if (
    kit.status === 'with_holder' &&
    kit.checked_out_request_id &&
    kit.due_back
  ) {
    return kit.due_back <= plannedShipBy(kit, request, tracker, today);
  }
  return false;
}

function selectKit(kits, request, tracker, today) {
  const eligible = kits.filter((kit) =>
    canPlanKit(tracker, kit, request, today)
  );
  eligible.sort((a, b) => {
    const aSameCountry =
      originCountryForKit(tracker, a) === request.country ? 0 : 1;
    const bSameCountry =
      originCountryForKit(tracker, b) === request.country ? 0 : 1;
    const aAvailable = a.status === 'available' ? 0 : 1;
    const bAvailable = b.status === 'available' ? 0 : 1;
    return (
      aSameCountry - bSameCountry ||
      aAvailable - bAvailable ||
      String(a.due_back || '9999').localeCompare(
        String(b.due_back || '9999')
      ) ||
      a.label.localeCompare(b.label)
    );
  });
  return eligible[0] || null;
}

function activeRequestsByPerson(tracker) {
  const people = new Set();
  for (const request of tracker.requests) {
    if (
      ACTIVE_REQUEST_STATUSES.has(request.status) &&
      request.requester_person_id
    ) {
      people.add(request.requester_person_id);
    }
  }
  return people;
}

export function buildMicKitAutomation(
  trackerValue,
  episodesValue = [],
  options = {}
) {
  const tracker = normalizeMicKitTracker(trackerValue);
  const episodes = Array.isArray(episodesValue) ? episodesValue : [];
  const today = cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  const episodesById = new Map(
    episodes.map((episode) => [episode.episode_id, episode])
  );
  const unclaimedKits = tracker.kits.filter(
    (kit) =>
      !kit.next_request_id &&
      !['needs_confirmation', 'maintenance', 'retired', 'returning'].includes(
        kit.status
      )
  );

  const recommendations = tracker.requests
    .filter((request) => ASSIGNABLE_REQUEST_STATUSES.has(request.status))
    .map((request) =>
      recommendationForRequest(
        request,
        episodesById.get(request.episode_id),
        today
      )
    )
    .sort(
      (a, b) =>
        b.priority_score - a.priority_score ||
        String(a.priority_date || '9999').localeCompare(
          String(b.priority_date || '9999')
        ) ||
        a.requester_name.localeCompare(b.requester_name)
    );

  for (const recommendation of recommendations) {
    const request = tracker.requests.find(
      (candidate) => candidate.request_id === recommendation.request_id
    );
    const kit = selectKit(unclaimedKits, request, tracker, today);
    if (!kit) continue;

    recommendation.recommended_kit_id = kit.kit_id;
    recommendation.recommended_kit_label = kit.label;
    const originCountry = originCountryForKit(tracker, kit);
    recommendation.recommended_shipping_provider =
      originCountry === 'US' ? 'usps_click_n_ship' : 'manual_carrier';
    recommendation.recommended_ship_by = plannedShipBy(
      kit,
      request,
      tracker,
      today
    );
    recommendation.recommended_due_back = shiftDate(
      request.recording_date || request.need_by,
      request.recording_date ? 3 : 10
    );
    if (kit.checked_out_request_id) {
      recommendation.reasons.push(
        `${kit.current_holder_name || 'Current host'} can hand it off after ${kit.due_back}`
      );
    }
    unclaimedKits.splice(unclaimedKits.indexOf(kit), 1);
  }

  const actions = [];
  if (!tracker.inventory_confirmed) {
    actions.push({
      action_id: 'confirm-inventory',
      urgency: 'high',
      kind: 'inventory',
      title: 'Confirm the working mic-kit count',
      detail: 'The board is still using the reported four-plus-one inventory.',
      request_id: '',
      kit_id: '',
    });
  }

  for (const recommendation of recommendations) {
    const request = tracker.requests.find(
      (candidate) => candidate.request_id === recommendation.request_id
    );
    if (request.status === 'requested') {
      actions.push({
        action_id: `review-${request.request_id}`,
        urgency: recommendation.urgency,
        kind: 'review_request',
        title: `Review ${request.requester_name}’s request`,
        detail: recommendation.reasons.join(' · '),
        request_id: request.request_id,
        kit_id: recommendation.recommended_kit_id,
      });
    } else if (recommendation.recommended_kit_id) {
      actions.push({
        action_id: `prepare-${request.request_id}`,
        urgency: recommendation.urgency,
        kind: 'prepare_handoff',
        title: `Prepare ${recommendation.recommended_kit_label}`,
        detail: `Recommended for ${request.requester_name}; ship by ${recommendation.recommended_ship_by}.`,
        request_id: request.request_id,
        kit_id: recommendation.recommended_kit_id,
      });
    }
  }

  for (const kit of tracker.kits) {
    const request = tracker.requests.find(
      (candidate) => candidate.request_id === kit.next_request_id
    );
    if (request?.status === 'assigned') {
      if (!kit.ship_by) {
        actions.push({
          action_id: `ship-date-${kit.kit_id}`,
          urgency: 'high',
          kind: 'shipping',
          title: `Set a ship date for ${kit.label}`,
          detail: `Assigned to ${request.requester_name}.`,
          request_id: request.request_id,
          kit_id: kit.kit_id,
        });
      }
      const originCountry = originCountryForKit(tracker, kit);
      if (originCountry && originCountry !== 'US') {
        actions.push({
          action_id: `carrier-${kit.kit_id}`,
          urgency: 'high',
          kind: 'carrier_route',
          title: `Choose the carrier for ${kit.label}`,
          detail: `This handoff starts in ${originCountry}, so it does not belong in Caleb’s USPS export.`,
          request_id: request.request_id,
          kit_id: kit.kit_id,
        });
      } else if (!kit.package_weight_lb) {
        actions.push({
          action_id: `package-${kit.kit_id}`,
          urgency: 'medium',
          kind: 'package_setup',
          title: `Save the package weight for ${kit.label}`,
          detail:
            'Enter it once on the kit record so future USPS labels need less manual editing.',
          request_id: request.request_id,
          kit_id: kit.kit_id,
        });
      }
      const daysUntilShip = daysBetween(today, kit.ship_by);
      if (
        kit.ship_by &&
        daysUntilShip !== null &&
        daysUntilShip <= 3 &&
        !kit.tracking_number &&
        !kit.tracking_url
      ) {
        actions.push({
          action_id: `label-${kit.kit_id}`,
          urgency: kit.ship_by < today ? 'urgent' : 'high',
          kind: 'shipping',
          title: `Create the label for ${kit.label}`,
          detail: `Shipment to ${request.requester_name} is due ${kit.ship_by}.`,
          request_id: request.request_id,
          kit_id: kit.kit_id,
        });
      }
    }
    if (
      kit.checked_out_request_id &&
      kit.due_back &&
      kit.due_back < today
    ) {
      actions.push({
        action_id: `overdue-${kit.kit_id}`,
        urgency: 'urgent',
        kind: 'overdue_return',
        title: `${kit.label} is past its return date`,
        detail: `${kit.current_holder_name || 'The current holder'} was due to return it ${kit.due_back}.`,
        request_id: kit.checked_out_request_id,
        kit_id: kit.kit_id,
      });
    }
  }

  const requestPeople = activeRequestsByPerson(tracker);
  const upcomingEpisodes = episodes.filter(
    (episode) =>
      ['planning', 'in_progress', 'needs_changes'].includes(episode.status) &&
      (!(
        episode.recording_date ||
        episode.target_release_date
      ) ||
        (episode.recording_date || episode.target_release_date) >= today)
  );
  let uncoveredEpisodeHosts = 0;
  for (const episode of upcomingEpisodes) {
    const priority = priorityForDate(
      episode.recording_date ||
        episode.due_date ||
        episode.target_release_date,
      today
    );
    if (!['urgent', 'high', 'medium'].includes(priority.urgency)) continue;
    const uncovered = (episode.host_person_ids || []).filter(
      (personId) => !requestPeople.has(personId)
    );
    uncoveredEpisodeHosts += uncovered.length;
    if (uncovered.length) {
      actions.push({
        action_id: `episode-${episode.episode_id}`,
        urgency: priority.urgency,
        kind: 'episode_coverage',
        title: `Check mic coverage for “${episode.title}”`,
        detail: `${uncovered.length} assigned host${uncovered.length === 1 ? '' : 's'} do not have an active mic request.`,
        request_id: '',
        kit_id: '',
        episode_id: episode.episode_id,
      });
    }
  }

  actions.sort(
    (a, b) =>
      (URGENCY_ORDER[a.urgency] ?? 9) -
        (URGENCY_ORDER[b.urgency] ?? 9) ||
      a.title.localeCompare(b.title)
  );

  return {
    generated_at: new Date().toISOString(),
    recommendations,
    actions: actions.slice(0, 30),
    metrics: {
      open_requests: tracker.requests.filter((request) =>
        ACTIVE_REQUEST_STATUSES.has(request.status)
      ).length,
      ready_to_assign: recommendations.filter(
        (recommendation) => recommendation.recommended_kit_id
      ).length,
      labels_to_create: actions.filter(
        (action) =>
          action.kind === 'shipping' &&
          action.action_id.startsWith('label-')
      ).length,
      overdue_returns: actions.filter(
        (action) => action.kind === 'overdue_return'
      ).length,
      uncovered_episode_hosts: uncoveredEpisodeHosts,
      manual_carrier_routes: actions.filter(
        (action) => action.kind === 'carrier_route'
      ).length,
      package_presets_missing: actions.filter(
        (action) => action.kind === 'package_setup'
      ).length,
    },
  };
}
