import crypto from 'crypto';
import {
  ADMIN_PERMISSIONS,
  requirePermissionAsync,
} from '../../../lib/adminAuth';
import { logAdminAction } from '../../../lib/adminAudit';
import { buildMicKitAutomation } from '../../../lib/micKitAutomation.mjs';
import {
  MIC_KIT_REQUEST_STATUSES,
  MIC_KIT_STATUSES,
  normalizeMicKitTracker,
  sanitizeMicKitTrackerForViewer,
} from '../../../lib/micKitPresentation.mjs';
import {
  getMicKitTracker,
  saveMicKitTracker,
} from '../../../lib/micKitStore';
import { listEpisodeStudios } from '../../../lib/episodeStudioStore';
import { getStudioBindingForSubject } from '../../../lib/studioAccessStore';

function cleanText(value, maxLength = 240) {
  return String(value || '').trim().slice(0, maxLength);
}

function cleanDate(value) {
  const date = cleanText(value, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function cleanCountry(value) {
  return cleanText(value, 2).toUpperCase();
}

function cleanDecimal(value, max = 999) {
  const parsed = Number.parseFloat(String(value ?? ''));
  if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return '';
  return String(Math.round(parsed * 100) / 100);
}

function isRequestOwner(request, principal) {
  return Boolean(
    (principal.subject &&
      request.requester_subject === principal.subject) ||
      (principal.username &&
        request.requester_email === principal.username.toLowerCase())
  );
}

function actorLabel(principal) {
  return principal.displayName || principal.username || 'Studio team member';
}

function requireJson(req, res) {
  if (!req.headers['content-type']?.includes('application/json')) {
    res
      .status(400)
      .json({ ok: false, error: 'Content-Type must be application/json' });
    return false;
  }
  return true;
}

function requestInput(req, principal, binding) {
  const input = req.body?.request || {};
  const now = new Date().toISOString();
  const country = cleanCountry(input.country);
  const cityRegion = cleanText(input.city_region, 180);
  const needBy = cleanDate(input.need_by);
  const shipping = {
    recipient: cleanText(input.shipping?.recipient, 120),
    address_line_1: cleanText(input.shipping?.address_line_1, 180),
    address_line_2: cleanText(input.shipping?.address_line_2, 180),
    city: cleanText(input.shipping?.city, 120),
    region: cleanText(input.shipping?.region, 120),
    postal_code: cleanText(input.shipping?.postal_code, 40),
    country: cleanCountry(input.shipping?.country || country),
  };

  if (!country || !cityRegion || !needBy) {
    throw new Error(
      'Mic kit request: add your country, city or region, and need-by date.'
    );
  }
  if (
    !shipping.recipient ||
    !shipping.address_line_1 ||
    !shipping.city ||
    !shipping.region ||
    !shipping.postal_code ||
    !shipping.country
  ) {
    throw new Error(
      'Mic kit request: add the complete private mailing address for this shipment.'
    );
  }

  return {
    request_id: `mic-request-${crypto.randomUUID()}`,
    requester_subject: principal.subject,
    requester_person_id: binding?.person_id || '',
    requester_name: actorLabel(principal),
    requester_email: String(principal.username || '').toLowerCase(),
    country,
    city_region: cityRegion,
    need_by: needBy,
    recording_date: cleanDate(input.recording_date),
    episode_id: cleanText(input.episode_id, 120),
    planned_due_back: '',
    status: 'requested',
    kit_id: '',
    notes: cleanText(input.notes, 1200),
    admin_response: '',
    admin_updated_at: '',
    admin_updated_by: '',
    shipping,
    created_at: now,
    updated_at: now,
  };
}

function viewerFor(principal, canManage) {
  return {
    subject: principal.subject,
    username: principal.username,
    canManage,
  };
}

function responsePayload(result, principal, canManage, episodes = []) {
  return {
    ok: true,
    configured: result.configured,
    source: result.source,
    can_request: principal.permissions.includes(
      ADMIN_PERMISSIONS.MIC_KITS_REQUEST
    ),
    can_manage: canManage,
    automation: canManage
      ? buildMicKitAutomation(result.tracker, episodes)
      : null,
    tracker: sanitizeMicKitTrackerForViewer(
      result.tracker,
      viewerFor(principal, canManage)
    ),
  };
}

function syncKitAssignment(tracker, kit, nextRequestId) {
  const previousRequestId = kit.next_request_id;
  if (previousRequestId && previousRequestId !== nextRequestId) {
    const previousRequest = tracker.requests.find(
      (request) => request.request_id === previousRequestId
    );
    if (
      previousRequest?.status === 'assigned' &&
      previousRequest.kit_id === kit.kit_id
    ) {
      previousRequest.status = 'requested';
      previousRequest.kit_id = '';
      previousRequest.updated_at = new Date().toISOString();
    }
  }

  if (!nextRequestId) return;
  const otherAssignedKit = tracker.kits.find(
    (candidate) =>
      candidate.kit_id !== kit.kit_id &&
      candidate.next_request_id === nextRequestId
  );
  if (otherAssignedKit) {
    throw new Error(
      `Mic kit tracker: that request is already assigned to ${otherAssignedKit.label}.`
    );
  }
  const nextRequest = tracker.requests.find(
    (request) => request.request_id === nextRequestId
  );
  if (!nextRequest) {
    throw new Error('Mic kit tracker: that request no longer exists.');
  }
  if (
    ['checked_out', 'returned', 'declined', 'cancelled'].includes(
      nextRequest.status
    )
  ) {
    throw new Error(
      'Mic kit tracker: completed or cancelled requests cannot be assigned.'
    );
  }

  nextRequest.status = 'assigned';
  nextRequest.kit_id = kit.kit_id;
  nextRequest.updated_at = new Date().toISOString();
}

function closePreviousCheckout(tracker, kit, nextRequestId, principal, now) {
  if (
    !kit.checked_out_request_id ||
    kit.checked_out_request_id === nextRequestId
  ) {
    return;
  }
  const previousRequest = tracker.requests.find(
    (request) => request.request_id === kit.checked_out_request_id
  );
  if (previousRequest?.status === 'checked_out') {
    previousRequest.status = 'returned';
    previousRequest.admin_updated_at = now;
    previousRequest.admin_updated_by = actorLabel(principal);
    previousRequest.updated_at = now;
  }
}

function clearQueuedRequestFromKits(tracker, requestId) {
  tracker.kits = tracker.kits.map((kit) => {
    if (kit.next_request_id !== requestId) return kit;
    const hasCurrentHolder = Boolean(kit.checked_out_request_id);
    return {
      ...kit,
      status:
        !hasCurrentHolder && kit.status === 'reserved'
          ? 'available'
          : kit.status,
      next_request_id: '',
      ship_by: '',
      due_back: hasCurrentHolder ? kit.due_back : '',
    };
  });
}

export const config = { api: { bodyParser: { sizeLimit: '500kb' } } };

export default async function handler(req, res) {
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET,POST,PATCH');
    return res.status(405).json({ ok: false, error: 'Method not allowed' });
  }

  const permission =
    req.method === 'GET'
      ? ADMIN_PERMISSIONS.MIC_KITS_READ
      : ADMIN_PERMISSIONS.MIC_KITS_REQUEST;
  const principal = await requirePermissionAsync(req, res, permission);
  if (!principal) return;

  try {
    const canManage =
      req.query.view === 'admin' &&
      principal.permissions.includes(ADMIN_PERMISSIONS.MIC_KITS_MANAGE);
    const result = await getMicKitTracker();
    let automationEpisodes = [];
    if (canManage) {
      try {
        const episodeResult = await listEpisodeStudios();
        automationEpisodes = episodeResult.episodes || [];
      } catch (episodeError) {
        console.error(
          'mic kit episode automation unavailable:',
          episodeError
        );
      }
    }

    if (req.method === 'GET') {
      return res
        .status(200)
        .json(
          responsePayload(
            result,
            principal,
            canManage,
            automationEpisodes
          )
        );
    }
    if (!requireJson(req, res)) return;

    const action = cleanText(
      req.body?.action || (req.method === 'POST' ? 'create_request' : ''),
      60
    );
    const tracker = normalizeMicKitTracker(result.tracker);
    const expectedUpdatedAt = cleanText(req.body?.expected_updated_at, 40);
    const now = new Date().toISOString();

    if (action === 'create_request') {
      const binding = await getStudioBindingForSubject(principal.subject);
      const request = requestInput(req, principal, binding);
      if (request.episode_id) {
        const episodeSource = canManage
          ? automationEpisodes
          : (await listEpisodeStudios()).episodes;
        const episode = episodeSource.find(
          (candidate) => candidate.episode_id === request.episode_id
        );
        if (
          !episode ||
          !binding?.person_id ||
          !episode.host_person_ids.includes(binding.person_id)
        ) {
          return res.status(400).json({
            ok: false,
            error:
              'Mic kit request: choose one of your assigned upcoming episodes.',
          });
        }
      }
      tracker.requests.push(request);
      logAdminAction(req, principal, 'mic_kit.request_create', {
        request_id: request.request_id,
        country: request.country,
        need_by: request.need_by,
      });
    } else if (action === 'cancel_request') {
      const requestId = cleanText(req.body?.request_id, 100);
      const request = tracker.requests.find(
        (candidate) => candidate.request_id === requestId
      );
      if (!request) {
        return res
          .status(404)
          .json({ ok: false, error: 'Mic kit request not found.' });
      }
      if (!canManage && !isRequestOwner(request, principal)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      if (
        ['checked_out', 'returned', 'declined', 'cancelled'].includes(
          request.status
        )
      ) {
        return res.status(409).json({
          ok: false,
          error: 'That mic kit request is already closed.',
        });
      }
      request.status = 'cancelled';
      request.updated_at = now;
      clearQueuedRequestFromKits(tracker, request.request_id);
      logAdminAction(req, principal, 'mic_kit.request_cancel', {
        request_id: request.request_id,
      });
    } else if (action === 'confirm_receipt') {
      const requestId = cleanText(req.body?.request_id, 100);
      const request = tracker.requests.find(
        (candidate) => candidate.request_id === requestId
      );
      if (!request) {
        return res
          .status(404)
          .json({ ok: false, error: 'Mic kit request not found.' });
      }
      if (!canManage && !isRequestOwner(request, principal)) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }
      const kit = tracker.kits.find(
        (candidate) =>
          candidate.kit_id === request.kit_id ||
          candidate.next_request_id === request.request_id
      );
      if (
        !kit ||
        request.status !== 'assigned' ||
        kit.next_request_id !== request.request_id
      ) {
        return res.status(409).json({
          ok: false,
          error: 'That mic kit is not ready to be received.',
        });
      }
      closePreviousCheckout(
        tracker,
        kit,
        request.request_id,
        principal,
        now
      );
      kit.status = 'with_holder';
      kit.current_holder_name = request.requester_name;
      kit.current_location = request.city_region;
      kit.next_request_id = '';
      kit.checked_out_request_id = request.request_id;
      kit.checked_out_at = now;
      kit.due_back = request.planned_due_back || kit.due_back;
      request.status = 'checked_out';
      request.kit_id = kit.kit_id;
      request.updated_at = now;
      logAdminAction(req, principal, 'mic_kit.receipt_confirm', {
        kit_id: kit.kit_id,
        request_id: request.request_id,
      });
    } else {
      if (!canManage) {
        return res.status(403).json({ ok: false, error: 'Forbidden' });
      }

      if (action === 'add_kit') {
        const label = cleanText(req.body?.kit?.label, 100);
        if (!label) {
          return res
            .status(400)
            .json({ ok: false, error: 'Give the mic kit a label.' });
        }
        const kit = {
          kit_id: `mic-kit-${crypto.randomUUID()}`,
          label,
          home_country: cleanCountry(req.body?.kit?.home_country),
          status: 'needs_confirmation',
          current_holder_name: '',
          current_location: '',
          next_request_id: '',
          ship_by: '',
          carrier: '',
          tracking_number: '',
          tracking_url: '',
          notes: '',
          possible_addition: false,
          checked_out_request_id: '',
          checked_out_at: '',
          due_back: '',
          package_weight_lb: '',
          package_length_in: '',
          package_width_in: '',
          package_height_in: '',
        };
        tracker.kits.push(kit);
        logAdminAction(req, principal, 'mic_kit.inventory_add', {
          kit_id: kit.kit_id,
          label: kit.label,
        });
      } else if (action === 'update_kit') {
        const input = req.body?.kit || {};
        const kitId = cleanText(input.kit_id, 100);
        const kit = tracker.kits.find(
          (candidate) => candidate.kit_id === kitId
        );
        if (!kit) {
          return res
            .status(404)
            .json({ ok: false, error: 'Mic kit not found.' });
        }
        const nextRequestId = cleanText(input.next_request_id, 100);
        syncKitAssignment(tracker, kit, nextRequestId);
        const status = cleanText(input.status, 40);
        Object.assign(kit, {
          label: cleanText(input.label, 100) || kit.label,
          home_country: cleanCountry(input.home_country),
          status: MIC_KIT_STATUSES.includes(status) ? status : kit.status,
          current_holder_name: cleanText(input.current_holder_name, 120),
          current_location: cleanText(input.current_location, 160),
          next_request_id: nextRequestId,
          ship_by: cleanDate(input.ship_by),
          carrier: cleanText(input.carrier, 80),
          tracking_number: cleanText(input.tracking_number, 160),
          tracking_url: cleanText(input.tracking_url, 1200),
          notes: cleanText(input.notes, 1200),
          possible_addition: input.possible_addition === true,
          checked_out_request_id: kit.checked_out_request_id,
          checked_out_at: kit.checked_out_at,
          due_back: cleanDate(input.due_back),
          package_weight_lb: cleanDecimal(input.package_weight_lb),
          package_length_in: cleanDecimal(input.package_length_in),
          package_width_in: cleanDecimal(input.package_width_in),
          package_height_in: cleanDecimal(input.package_height_in),
        });
        if (
          kit.status === 'retired' &&
          (kit.next_request_id || kit.checked_out_request_id)
        ) {
          throw new Error(
            'Mic kit tracker: clear its assignment or check it in before retiring this kit.'
          );
        }
        logAdminAction(req, principal, 'mic_kit.inventory_update', {
          kit_id: kit.kit_id,
          status: kit.status,
          next_request_id: kit.next_request_id,
        });
      } else if (action === 'update_request') {
        const requestId = cleanText(req.body?.request_id, 100);
        const request = tracker.requests.find(
          (candidate) => candidate.request_id === requestId
        );
        if (!request) {
          return res
            .status(404)
            .json({ ok: false, error: 'Mic kit request not found.' });
        }
        const status = cleanText(req.body?.status, 40);
        const responseStatuses = new Set([
          'requested',
          'approved',
          'waitlisted',
          'declined',
          'cancelled',
        ]);
        if (
          !MIC_KIT_REQUEST_STATUSES.includes(status) ||
          !responseStatuses.has(status)
        ) {
          return res.status(400).json({
            ok: false,
            error: 'Choose a valid mic kit request status.',
          });
        }
        if (
          request.status === 'checked_out' &&
          status !== 'checked_out'
        ) {
          return res.status(409).json({
            ok: false,
            error:
              'Check the physical kit back in before closing this request.',
          });
        }
        request.status = status;
        request.admin_response = cleanText(
          req.body?.admin_response,
          1200
        );
        request.admin_updated_at = now;
        request.admin_updated_by = actorLabel(principal);
        request.updated_at = now;
        if (
          ['waitlisted', 'declined', 'cancelled'].includes(status)
        ) {
          clearQueuedRequestFromKits(tracker, request.request_id);
          request.kit_id = '';
        }
        logAdminAction(req, principal, 'mic_kit.request_update', {
          request_id: request.request_id,
          status,
        });
      } else if (action === 'checkout_kit') {
        const kitId = cleanText(req.body?.kit_id, 100);
        const requestId = cleanText(req.body?.request_id, 100);
        const kit = tracker.kits.find(
          (candidate) => candidate.kit_id === kitId
        );
        const request = tracker.requests.find(
          (candidate) => candidate.request_id === requestId
        );
        if (!kit || !request) {
          return res.status(404).json({
            ok: false,
            error: 'Choose a valid mic kit and request.',
          });
        }
        if (kit.checked_out_request_id === request.request_id) {
          return res.status(409).json({
            ok: false,
            error: `${kit.label} is already checked out.`,
          });
        }
        if (
          ['checked_out', 'returned', 'declined', 'cancelled'].includes(
            request.status
          )
        ) {
          return res.status(409).json({
            ok: false,
            error: 'That request cannot be checked out.',
          });
        }
        if (
          ['maintenance', 'retired'].includes(kit.status)
        ) {
          return res.status(409).json({
            ok: false,
            error: `${kit.label} must return to circulation before it can be checked out.`,
          });
        }
        closePreviousCheckout(
          tracker,
          kit,
          request.request_id,
          principal,
          now
        );
        if (
          kit.next_request_id &&
          kit.next_request_id !== request.request_id
        ) {
          const previousRequest = tracker.requests.find(
            (candidate) =>
              candidate.request_id === kit.next_request_id
          );
          if (
            previousRequest?.status === 'assigned' &&
            previousRequest.kit_id === kit.kit_id
          ) {
            previousRequest.status = 'requested';
            previousRequest.kit_id = '';
            previousRequest.updated_at = now;
          }
        }
        for (const candidate of tracker.kits) {
          if (
            candidate.kit_id !== kit.kit_id &&
            candidate.next_request_id === request.request_id
          ) {
            candidate.next_request_id = '';
            candidate.ship_by = '';
          }
        }
        kit.status = 'with_holder';
        kit.current_holder_name = request.requester_name;
        kit.current_location = request.city_region;
        kit.next_request_id = '';
        kit.checked_out_request_id = request.request_id;
        kit.checked_out_at = now;
        kit.due_back =
          request.planned_due_back || cleanDate(req.body?.due_back);
        request.status = 'checked_out';
        request.kit_id = kit.kit_id;
        request.admin_updated_at = now;
        request.admin_updated_by = actorLabel(principal);
        request.updated_at = now;
        logAdminAction(req, principal, 'mic_kit.checkout', {
          kit_id: kit.kit_id,
          request_id: request.request_id,
          due_back: kit.due_back,
        });
      } else if (action === 'apply_recommendation') {
        const requestId = cleanText(req.body?.request_id, 100);
        const automation = buildMicKitAutomation(
          tracker,
          automationEpisodes
        );
        const recommendation = automation.recommendations.find(
          (candidate) => candidate.request_id === requestId
        );
        const request = tracker.requests.find(
          (candidate) => candidate.request_id === requestId
        );
        const kit = tracker.kits.find(
          (candidate) =>
            candidate.kit_id === recommendation?.recommended_kit_id
        );
        if (!request || !recommendation) {
          return res.status(404).json({
            ok: false,
            error: 'That mic kit recommendation is no longer available.',
          });
        }
        if (!kit) {
          return res.status(409).json({
            ok: false,
            error:
              'No confirmed available kit currently fits this request.',
          });
        }
        syncKitAssignment(tracker, kit, request.request_id);
        const directHandoff = Boolean(kit.checked_out_request_id);
        kit.status = directHandoff ? 'with_holder' : 'reserved';
        kit.next_request_id = request.request_id;
        kit.ship_by = recommendation.recommended_ship_by;
        request.planned_due_back = recommendation.recommended_due_back;
        if (!directHandoff) {
          kit.due_back = recommendation.recommended_due_back;
        }
        request.admin_response =
          request.admin_response ||
          (directHandoff
            ? `${kit.label} is planned as a direct handoff from ${kit.current_holder_name || 'the current host'}. Shipping details will follow.`
            : `${kit.label} has been reserved. Shipping details will follow.`);
        request.admin_updated_at = now;
        request.admin_updated_by = actorLabel(principal);
        request.updated_at = now;
        logAdminAction(req, principal, 'mic_kit.recommendation_apply', {
          kit_id: kit.kit_id,
          request_id: request.request_id,
          ship_by: kit.ship_by,
        });
      } else if (action === 'checkin_kit') {
        const kitId = cleanText(req.body?.kit_id, 100);
        const kit = tracker.kits.find(
          (candidate) => candidate.kit_id === kitId
        );
        if (!kit) {
          return res
            .status(404)
            .json({ ok: false, error: 'Mic kit not found.' });
        }
        if (!kit.checked_out_request_id) {
          return res.status(409).json({
            ok: false,
            error: `${kit.label} is not checked out.`,
          });
        }
        const request = tracker.requests.find(
          (candidate) =>
            candidate.request_id === kit.checked_out_request_id
        );
        if (request) {
          request.status = 'returned';
          request.admin_updated_at = now;
          request.admin_updated_by = actorLabel(principal);
          request.updated_at = now;
        }
        const returnedRequestId = kit.checked_out_request_id;
        Object.assign(kit, {
          status: kit.next_request_id ? 'reserved' : 'available',
          current_holder_name: '',
          current_location: '',
          checked_out_request_id: '',
          checked_out_at: '',
          due_back: kit.next_request_id
            ? tracker.requests.find(
                (candidate) =>
                  candidate.request_id === kit.next_request_id
              )?.planned_due_back || ''
            : '',
          ship_by: '',
          carrier: '',
          tracking_number: '',
          tracking_url: '',
        });
        logAdminAction(req, principal, 'mic_kit.checkin', {
          kit_id: kit.kit_id,
          request_id: returnedRequestId,
        });
      } else if (action === 'confirm_inventory') {
        tracker.inventory_confirmed = true;
        tracker.inventory_note =
          cleanText(req.body?.inventory_note, 1200) ||
          `Inventory confirmed by ${actorLabel(principal)}.`;
        logAdminAction(req, principal, 'mic_kit.inventory_confirm', {
          active_kit_count: tracker.kits.filter(
            (kit) => kit.status !== 'retired'
          ).length,
        });
      } else {
        return res
          .status(400)
          .json({ ok: false, error: 'Choose a valid mic kit action.' });
      }
    }

    const saved = await saveMicKitTracker(tracker, {
      expectedUpdatedAt,
      updatedBy: actorLabel(principal),
    });
    return res
      .status(req.method === 'POST' ? 201 : 200)
      .json(
        responsePayload(
          saved,
          principal,
          canManage,
          automationEpisodes
        )
      );
  } catch (error) {
    console.error('mic kit tracker error:', error);
    const message = String(error.message || '');
    const conflict = /conditional/i.test(message);
    const validation = /mic kit|tracking|request|shipment|address/i.test(
      message
    );
    return res.status(conflict ? 409 : validation ? 400 : 500).json({
      ok: false,
      error: conflict
        ? 'The mic kit board changed in another session. Refresh and try again.'
        : validation
          ? message
          : 'Could not update the mic kit board.',
    });
  }
}
