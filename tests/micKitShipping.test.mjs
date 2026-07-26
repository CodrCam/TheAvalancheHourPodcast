import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildUspsClickNShipCsv,
  listReadyMicKitShipments,
  listUspsClickNShipShipments,
} from '../lib/micKitShipping.mjs';
import { DEFAULT_MIC_KIT_TRACKER } from '../lib/micKitPresentation.mjs';

function shippingTracker() {
  return {
    ...DEFAULT_MIC_KIT_TRACKER,
    kits: [
      {
        ...DEFAULT_MIC_KIT_TRACKER.kits[0],
        status: 'available',
        next_request_id: 'ready-request',
        ship_by: '2026-08-01',
        package_weight_lb: '4.5',
        package_length_in: '18',
        package_width_in: '12',
        package_height_in: '8',
      },
    ],
    requests: [
      {
        request_id: 'ready-request',
        requester_name: 'CSV Host',
        requester_email: 'host@example.com',
        country: 'US',
        need_by: '2026-08-07',
        recording_date: '2026-08-08',
        status: 'assigned',
        kit_id: 'tah-us-1',
        shipping: {
          recipient: '=CSV Host',
          address_line_1: '123 Main Street',
          address_line_2: 'Unit 4',
          city: 'Bozeman',
          region: 'MT',
          postal_code: '59715',
          country: 'US',
        },
      },
    ],
  };
}

test('lists only assigned shipments that are ready for a label', () => {
  const shipments = listReadyMicKitShipments(shippingTracker(), {
    today: '2026-07-25',
  });

  assert.equal(shipments.length, 1);
  assert.equal(shipments[0].kit_label, 'TAH US Kit 1');
  assert.equal(shipments[0].package_weight_lb, '4.5');
  assert.equal(shipments[0].postal_code, '59715');
  assert.equal(shipments[0].shipping_provider, 'usps_click_n_ship');
});

test('builds a USPS Click-N-Ship mapping CSV and blocks spreadsheet formulas', () => {
  const csv = buildUspsClickNShipCsv(shippingTracker(), {
    today: '2026-07-25',
  });

  assert.match(csv, /"Recipient Address Line 1"/);
  assert.match(csv, /"Package Weight \(lb\)"/);
  assert.match(csv, /"'=CSV Host"/);
  assert.match(csv, /"123 Main Street"/);
  assert.match(csv, /"4\.5"/);
});

test('includes a current host as the sender for a direct handoff', () => {
  const tracker = shippingTracker();
  tracker.kits[0].status = 'with_holder';
  tracker.kits[0].checked_out_request_id = 'current-holder';
  tracker.requests.push({
    request_id: 'current-holder',
    requester_name: 'Current Host',
    status: 'checked_out',
    kit_id: 'tah-us-1',
    shipping: {
      recipient: 'Current Host',
      address_line_1: '44 Sender Way',
      city: 'Bend',
      region: 'OR',
      postal_code: '97701',
      country: 'US',
    },
  });

  const shipment = listUspsClickNShipShipments(tracker, {
    today: '2026-07-25',
  })[0];
  const csv = buildUspsClickNShipCsv(tracker, {
    today: '2026-07-25',
  });

  assert.equal(shipment.sender.address_line_1, '44 Sender Way');
  assert.match(csv, /"Sender Address Line 1"/);
  assert.match(csv, /"44 Sender Way"/);
});

test('keeps Canada-origin handoffs out of Caleb’s USPS export', () => {
  const tracker = shippingTracker();
  tracker.kits[0].home_country = 'CA';

  assert.equal(
    listReadyMicKitShipments(tracker, { today: '2026-07-25' }).length,
    1
  );
  assert.equal(
    listUspsClickNShipShipments(tracker, {
      today: '2026-07-25',
    }).length,
    0
  );
  assert.doesNotMatch(
    buildUspsClickNShipCsv(tracker, { today: '2026-07-25' }),
    /CSV Host/
  );
});

test('omits assigned shipments until the mailing address is complete', () => {
  const tracker = shippingTracker();
  tracker.requests[0].shipping.postal_code = '';

  assert.equal(
    listReadyMicKitShipments(tracker, { today: '2026-07-25' }).length,
    0
  );
});

test('holds future shipments until they enter the seven-day USPS window', () => {
  const tracker = shippingTracker();
  tracker.kits[0].ship_by = '2026-08-02';

  assert.equal(
    listUspsClickNShipShipments(tracker, {
      today: '2026-07-25',
    }).length,
    0
  );
});

test('moves an overdue USPS mail date to today in the export', () => {
  const tracker = shippingTracker();
  tracker.kits[0].ship_by = '2026-07-20';

  const shipments = listUspsClickNShipShipments(tracker, {
    today: '2026-07-25',
  });

  assert.equal(shipments[0].ship_by, '2026-07-25');
});
