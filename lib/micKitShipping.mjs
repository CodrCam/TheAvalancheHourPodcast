import { normalizeMicKitTracker } from './micKitPresentation.mjs';

const PIRATE_SHIP_COLUMNS = [
  'Order ID',
  'Name',
  'Address Line 1',
  'Address Line 2',
  'City',
  'State',
  'Zip',
  'Country',
  'Ship Date',
  'Weight (Pounds)',
  'Length',
  'Width',
  'Height',
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
    const isDirectHandoff = Boolean(kit.checked_out_request_id);
    if (
      !request ||
      request.status !== 'assigned' ||
      !hasCompleteShippingAddress(request.shipping) ||
      (isDirectHandoff &&
        !hasCompleteShippingAddress(currentHolderRequest?.shipping))
    ) {
      return [];
    }
    const originCountry =
      currentHolderRequest?.shipping?.country || kit.home_country;
    return [
      {
        kit_id: kit.kit_id,
        kit_label: kit.label,
        request_id: request.request_id,
        requester_name: request.requester_name,
        origin_country: originCountry,
        origin_kind: isDirectHandoff ? 'direct_handoff' : 'home_base',
        shipping_provider:
          originCountry === 'US'
            ? isDirectHandoff
              ? 'pirate_ship_manual'
              : 'pirate_ship_spreadsheet'
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

export function listPirateShipSpreadsheetShipments(
  trackerValue,
  options = {}
) {
  const today =
    cleanDate(options.today) || new Date().toISOString().slice(0, 10);
  return listReadyMicKitShipments(trackerValue)
    .filter(
      (shipment) =>
        shipment.shipping_provider === 'pirate_ship_spreadsheet'
    )
    .map((shipment) => ({
      ...shipment,
      ship_by: shipment.ship_by < today ? today : shipment.ship_by,
    }));
}

export function buildPirateShipCsv(trackerValue, options = {}) {
  const rows = listPirateShipSpreadsheetShipments(trackerValue, options);
  const values = rows.map((shipment) => [
    `${shipment.kit_label} · ${shipment.request_id}`,
    shipment.recipient,
    shipment.address_line_1,
    shipment.address_line_2,
    shipment.city,
    shipment.region,
    shipment.postal_code,
    shipment.country,
    shipment.ship_by,
    shipment.package_weight_lb,
    shipment.package_length_in,
    shipment.package_width_in,
    shipment.package_height_in,
  ]);
  return [
    PIRATE_SHIP_COLUMNS.map(csvCell).join(','),
    ...values.map((row) => row.map(csvCell).join(',')),
  ].join('\r\n');
}
