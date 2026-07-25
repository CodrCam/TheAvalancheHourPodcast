import { normalizeMicKitTracker } from './micKitPresentation.mjs';

const USPS_CLICK_N_SHIP_COLUMNS = [
  'Reference',
  'Recipient Name',
  'Recipient Email',
  'Recipient Address Line 1',
  'Recipient Address Line 2',
  'Recipient City',
  'Recipient State / Province',
  'Recipient Postal Code',
  'Recipient Country',
  'Sender Name',
  'Sender Address Line 1',
  'Sender Address Line 2',
  'Sender City',
  'Sender State / Province',
  'Sender Postal Code',
  'Sender Country',
  'Ship By',
  'Need By',
  'Recording Date',
  'Package Weight (lb)',
  'Package Length (in)',
  'Package Width (in)',
  'Package Height (in)',
];

function hasCompleteShippingAddress(shipping) {
  return Boolean(
    shipping?.recipient &&
      shipping?.address_line_1 &&
      shipping?.city &&
      shipping?.region &&
      shipping?.postal_code &&
      shipping?.country
  );
}

function safeSpreadsheetValue(value) {
  const text = String(value ?? '');
  return /^[=+\-@]/.test(text) ? `'${text}` : text;
}

function csvCell(value) {
  const text = safeSpreadsheetValue(value).replace(/"/g, '""');
  return `"${text}"`;
}

function cleanDate(value) {
  const date = String(value || '').slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : '';
}

function shiftDate(value, days) {
  const date = cleanDate(value);
  if (!date) return '';
  const parsed = new Date(`${date}T12:00:00Z`);
  parsed.setUTCDate(parsed.getUTCDate() + days);
  return parsed.toISOString().slice(0, 10);
}

export function listReadyMicKitShipments(trackerValue) {
  const tracker = normalizeMicKitTracker(trackerValue);
  return tracker.kits.flatMap((kit) => {
    if (!kit.next_request_id || !kit.ship_by) {
      return [];
    }
    const request = tracker.requests.find(
      (candidate) => candidate.request_id === kit.next_request_id
    );
    const currentHolderRequest = tracker.requests.find(
      (candidate) =>
        candidate.request_id === kit.checked_out_request_id
    );
    if (
      !request ||
      request.status !== 'assigned' ||
      !hasCompleteShippingAddress(request.shipping)
    ) {
      return [];
    }
    return [
      {
        kit_id: kit.kit_id,
        kit_label: kit.label,
        request_id: request.request_id,
        requester_name: request.requester_name,
        origin_country:
          currentHolderRequest?.shipping?.country || kit.home_country,
        shipping_provider:
          (currentHolderRequest?.shipping?.country || kit.home_country) ===
          'US'
            ? 'usps_click_n_ship'
            : 'manual_carrier',
        ship_by: kit.ship_by,
        need_by: request.need_by,
        recording_date: request.recording_date,
        recipient: request.shipping.recipient,
        email: request.requester_email,
        address_line_1: request.shipping.address_line_1,
        address_line_2: request.shipping.address_line_2,
        city: request.shipping.city,
        region: request.shipping.region,
        postal_code: request.shipping.postal_code,
        country: request.shipping.country,
        sender: currentHolderRequest?.shipping || null,
        package_weight_lb: kit.package_weight_lb,
        package_length_in: kit.package_length_in,
        package_width_in: kit.package_width_in,
        package_height_in: kit.package_height_in,
      },
    ];
  });
}

export function listUspsClickNShipShipments(trackerValue, options = {}) {
  const today =
    cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  const latestClickNShipDate = shiftDate(today, 7);
  return listReadyMicKitShipments(trackerValue)
    .filter(
      (shipment) =>
        shipment.shipping_provider === 'usps_click_n_ship' &&
        shipment.ship_by <= latestClickNShipDate
    )
    .map((shipment) => ({
      ...shipment,
      ship_by: shipment.ship_by < today ? today : shipment.ship_by,
    }));
}

export function buildUspsClickNShipCsv(trackerValue, options = {}) {
  const rows = listUspsClickNShipShipments(trackerValue, options);
  const values = rows.map((shipment) => [
    `${shipment.kit_label} · ${shipment.request_id}`,
    shipment.recipient,
    shipment.email,
    shipment.address_line_1,
    shipment.address_line_2,
    shipment.city,
    shipment.region,
    shipment.postal_code,
    shipment.country,
    shipment.sender?.recipient,
    shipment.sender?.address_line_1,
    shipment.sender?.address_line_2,
    shipment.sender?.city,
    shipment.sender?.region,
    shipment.sender?.postal_code,
    shipment.sender?.country,
    shipment.ship_by,
    shipment.need_by,
    shipment.recording_date,
    shipment.package_weight_lb,
    shipment.package_length_in,
    shipment.package_width_in,
    shipment.package_height_in,
  ]);
  return [
    USPS_CLICK_N_SHIP_COLUMNS.map(csvCell).join(','),
    ...values.map((row) => row.map(csvCell).join(',')),
  ].join('\r\n');
}
