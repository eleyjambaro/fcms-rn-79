import convert from 'convert-units';
import commaNumber from 'comma-number';

// Normalize an id column value to a real null. Mirrors normalizeId in
// localDbQueries/items.js — a legacy double-quoting bug wrote the literal
// strings 'null'/'undefined' into id columns, and those are truthy.
const normalizeTaxId = value => {
  if (value === null || value === undefined) return null;
  const trimmed = String(value).trim();
  if (trimmed === '' || trimmed === 'null' || trimmed === 'undefined') {
    return null;
  }
  return value;
};

/**
 * Sales-side taxability for the T/E legend shown next to a sale line's price.
 *
 * The legend reflects the SELLING tax, never the cost tax (`tax_id`). Source of
 * truth differs by row shape:
 *   - A recorded sale_log row carries `ref_tax_id` — the item's sales tax AT
 *     SALE TIME (NULL/'' = sold tax-exempt). This is authoritative even if the
 *     item's current `sales_tax_id` later changed, so it is preferred whenever
 *     the column is present (Sales Invoice screen + recorded receipt prints).
 *   - A live cart row (Sales Register / checkout print) has no `ref_tax_id`; it
 *     carries the item's current `sales_tax_id_effective` / `sales_tax_id`.
 *
 * Using `tax_id` (the cost tax) here is the bug this helper replaces.
 */
export const isSalesTaxable = item => {
  if (!item) return false;
  if ('ref_tax_id' in item) {
    return Boolean(normalizeTaxId(item.ref_tax_id));
  }
  return Boolean(
    normalizeTaxId(item.sales_tax_id_effective ?? item.sales_tax_id),
  );
};

export const trimTextLength = (value, lengthLimit = 12) => {
  if (!value) {
    return '';
  }

  const text = value?.toString();

  if (lengthLimit === 0 || text.length <= lengthLimit) {
    return text;
  }

  return `${text.substring(0, lengthLimit)}...`;
};

/**
 * textTransform enum('none', 'uppercase', 'lowercase', 'capitalize')
 */
export const formatUOMAbbrev = (
  uomAbbrev,
  textTransform = 'uppercase',
  upperCaseLitersOnly = false,
) => {
  let formattedUOMAbbrev = '';

  /**
   * Support for "pc" abbrev
   */
  formattedUOMAbbrev = uomAbbrev === 'ea' ? 'pc' : uomAbbrev;

  if (textTransform === 'uppercase') {
    if (upperCaseLitersOnly) {
      formattedUOMAbbrev =
        uomAbbrev === 'l'
          ? formattedUOMAbbrev?.toUpperCase()
          : formattedUOMAbbrev;
    } else {
      formattedUOMAbbrev = formattedUOMAbbrev?.toUpperCase();
    }
  }

  if (textTransform === 'lowercase') {
    formattedUOMAbbrev = formattedUOMAbbrev?.toLocaleLowerCase();
  }

  return formattedUOMAbbrev;
};

/**
 * Batch Transfer UOM display rule (single source of truth).
 *
 * Every UOM abbreviation shown on a Batch Transfer screen must be uppercased,
 * except "ea" (Each) which renders as "ea (pc)" — users recognize "pc" (piece)
 * more readily than "EA". Use this on ALL Batch Transfer screens whenever a UOM
 * abbreviation is displayed (item rows, qty badges, input labels, etc.).
 */
export const formatTransferUOMAbbrev = uomAbbrev => {
  if (!uomAbbrev) return '';
  if (String(uomAbbrev).toLowerCase() === 'ea') return 'ea (pc)';
  return String(uomAbbrev).toUpperCase();
};

/**
 * Short, human-facing reference number for a Batch Transfer request, derived
 * from the (UUID) batch_transfer_group id — the first 8 characters. This is the
 * single source of the value shown as "#xxxxxxxx" on Batch Transfer screens and
 * stored on inventory_logs.batch_transfer_ref_no. The "#" prefix is NOT included
 * here; callers add it when displaying.
 */
export const formatBatchTransferRefNo = groupId => {
  if (!groupId) return '';
  return String(groupId).slice(0, 8);
};

export const formatUOM = (
  uomAbbrev,
  nounForm = 'singular',
  textTransform = 'none',
  textLengthLimit = 12,
) => {
  let formattedUOM = '';
  /**
   * Support for "pc" abbrev
   */
  formattedUOM =
    uomAbbrev === 'ea'
      ? `Piece${nounForm === 'plural' ? 's' : ''}`
      : convert().describe(uomAbbrev)?.[nounForm];

  if (textTransform === 'uppercase') {
    formattedUOM = formattedUOM.toUpperCase();
  }

  if (textTransform === 'lowercase') {
    formattedUOM = formattedUOM.toLocaleLowerCase();
  }

  return trimTextLength(`${formattedUOM}`, textLengthLimit);
};

export const formatQty = qty => {
  if (isNaN(qty)) return '';

  let output = commaNumber(parseFloat(qty)?.toFixed(2));

  return output;
};

export const formatUOMAsPackage = (
  uomAbbrev,
  uomAbbrevPerPiece,
  qtyPerPiece,
  packageType,
) => {
  /**
   * Sample output:
   * "150 Grams Per Piece"
   */

  let textOutput = `${formatUOM(uomAbbrev)}`; // Gram

  let nounForm = 'singular';

  if (uomAbbrevPerPiece && qtyPerPiece) {
    if (qtyPerPiece > 1) {
      nounForm = 'plural';
    }

    let packaging;

    if (!packageType) {
      packaging = 'Per Piece'; // 150 Grams Per Piece
    } else {
      packaging = `Per ${packageType}`; // 150 Grams Per Box
    }

    textOutput = `${formatQty(qtyPerPiece)} ${formatUOM(
      uomAbbrevPerPiece,
      nounForm,
      'none',
      0,
    )} ${packaging}`;
  }

  return textOutput;
};

export const formatQtyAndPackage = (
  qty,
  uomAbbrev,
  qtyPerPiece,
  uomAbbrevPerPiece,
  packageType,
) => {
  /**
   * Sample output:
   * "12 Pieces of 150 Grams"
   */
  let qtyNounForm = 'singular';
  let packaging;

  if (qty > 1) {
    qtyNounForm = 'plural';
  }

  if (!packageType) {
    packaging = uomAbbrev
      ? `${formatUOM(uomAbbrev, qtyNounForm, 'none', 0)}`
      : ''; // 12 Pieces
  } else {
    packaging = packageType ? `${packageType}` : ''; // 12 Box, TODO: make a plural and singular form of packageType
  }

  let textOutput = `${formatQty(qty)}${packaging ? ` ${packaging}` : ''}`; // 12 Pieces

  if (uomAbbrevPerPiece && qtyPerPiece) {
    let qtyPerPieceNounForm = 'singular';

    if (qtyPerPiece > 1) {
      qtyPerPieceNounForm = 'plural';
    }

    let uomPerPiece = `${formatUOM(
      uomAbbrevPerPiece,
      qtyPerPieceNounForm,
      'none',
      0,
    )}`; // Grams

    textOutput = `${formatQty(qty)} ${packaging} of ${formatQty(
      qtyPerPiece,
    )} ${uomPerPiece}`; // 12 Pieces of 150 Grams
  }

  return textOutput;
};

/**
 * Removes currency symbol and
 */
export const extractNumber = value => {
  if (!value) {
    return '';
  }

  const text = value?.toString();

  return text.replace(/[^0-9\.-]+/g, '');
};

// Sanitizes a currency amount text input: digits, at most one decimal point,
// and at most 2 decimal places. Returns a STRING so in-progress values like
// "100." and "100.50" (trailing zero) are preserved exactly while typing.
//
// Never round-trip an amount input back through parseFloat on every keystroke
// (e.g. `commaNumber(parseFloat(value))`): parseFloat("100.") is 100, so the
// decimal point gets dropped the instant it's typed and the following digits
// concatenate onto the integer part — the Split Payment "100.50 → 10050" bug.
export const sanitizeAmountInput = value => {
  if (value === null || value === undefined) return '';

  let text = value.toString().replace(/[^0-9.]/g, '');

  const firstDot = text.indexOf('.');
  if (firstDot !== -1) {
    const intPart = text.slice(0, firstDot);
    // Drop any further dots and cap the decimals at 2 places.
    const decPart = text
      .slice(firstDot + 1)
      .replace(/\./g, '')
      .slice(0, 2);
    text = `${intPart}.${decPart}`;
  }

  return text;
};

export const padNumber = (num = 0, pad = '0000000000') => {
  const str = '' + num;
  const ans = pad.substring(0, pad.length - str.length) + str;

  return ans;
};

/**
 * Official receipt (OR) number support.
 *
 * A branch can have multiple POS devices ringing up sales while offline, so an
 * OR number must be generated locally (the receipt prints at sale time with no
 * server round-trip) yet stay collision-free across devices that later sync
 * into the same branch dataset. We achieve that with a per-device sequence
 * prefixed by a short, stable code derived from the device's UUID:
 *
 *   OR-7K2A-0000123
 *      ^^^^ device code (deterministic from device_id)
 *           ^^^^^^^ zero-padded per-device sequence
 *
 * The final string is stored on invoices.official_receipt_number (an immutable,
 * synced receipt identifier) and rendered verbatim everywhere.
 */

// Deterministic 4-char uppercase base36 code from a device UUID. Same device →
// same code forever, so the prefix stays constant for a device's whole OR
// sequence (which is what makes a lexicographic MAX of the stored string equal
// the numeric max of its zero-padded suffix). Falls back to '0000' when the
// device id is unknown.
export const getDeviceShortCode = deviceId => {
  if (!deviceId) return '0000';

  let hash = 0;
  for (let i = 0; i < deviceId.length; i++) {
    hash = (hash * 31 + deviceId.charCodeAt(i)) >>> 0;
  }

  return hash.toString(36).toUpperCase().padStart(4, '0').slice(-4);
};

// Builds the OR number string from a device code and a numeric sequence.
export const formatOfficialReceiptNumber = (deviceCode, seq) =>
  `OR-${deviceCode}-${padNumber(seq, '0000000')}`;

// Display value for an invoice. Uses the stored OR number when present, and
// falls back to the legacy short id form for pre-OR-number invoices so nothing
// breaks on historical records.
export const getInvoiceReceiptNumber = invoice => {
  if (!invoice) return '';
  if (invoice.official_receipt_number) return invoice.official_receipt_number;

  return `SI-${padNumber(invoice.id)}`;
};

/**
 * Sales order (SO) number support — mirrors the OR number above.
 *
 * A sales order needs a short, presentable identifier instead of its raw UUID,
 * generated locally (offline-first) yet collision-free across the branch's POS
 * devices once they sync. Same per-device scheme as the OR number: a stable
 * device code prefix + a zero-padded per-device sequence, e.g. "SO-7K2A-0000123".
 * Stored on sales_order_groups.sales_order_number as an immutable, synced value.
 */
export const formatSalesOrderNumber = (deviceCode, seq) =>
  `SO-${deviceCode}-${padNumber(seq, '0000000')}`;

// Display value for a sales order group. Uses the stored SO number when present,
// and falls back to the legacy short id form for pre-SO-number sales orders so
// nothing breaks on historical records.
export const getSalesOrderNumber = salesOrderGroup => {
  if (!salesOrderGroup) return '';
  if (salesOrderGroup.sales_order_number) {
    return salesOrderGroup.sales_order_number;
  }

  return `SO-${padNumber(salesOrderGroup.id)}`;
};

// Cashier display name for a sale. The root (owner) account is shown as "Owner";
// a team member shows their full name (first + last), falling back to email.
// `account` is the cloud auth account object ({ first_name, last_name,
// is_root_account, email }).
export const getCashierDisplayName = account => {
  if (!account) return '';
  if (account.is_root_account) return 'Owner';

  const fullName = `${account.first_name || ''} ${
    account.last_name || ''
  }`.trim();

  return fullName || account.email || '';
};

// Normalizes a checkout payment form into a { cash, card, change } breakdown.
// Handles both the single-payment shape ({ payment_method, payment_amount,
// change_amount }) and the split-payment shape ({ is_split_payment, payments:
// { <key>: { ... } } }). Mirrors how payments are persisted in confirmSaleEntries.
export const getPaymentBreakdownFromFormValues = paymentFormValues => {
  const breakdown = {cash: 0, card: 0, change: 0};
  if (!paymentFormValues) return breakdown;

  const addPayment = payment => {
    if (!payment) return;
    const amount = parseFloat(payment.payment_amount || 0) || 0;
    const change = parseFloat(payment.change_amount || 0) || 0;

    if (payment.payment_method === 'cash') {
      breakdown.cash += amount;
    } else if (payment.payment_method === 'card') {
      breakdown.card += amount;
    }

    breakdown.change += change;
  };

  if (paymentFormValues.is_split_payment && paymentFormValues.payments) {
    Object.values(paymentFormValues.payments).forEach(addPayment);
  } else {
    addPayment(paymentFormValues);
  }

  return breakdown;
};

/**
 * Extracts timestamp from backup file name
 * Supports both old format: fcms_data_${timestamp}.db
 * and new format: fcms_data_YYYY_MM_DD__HH-mm-A_${timestamp}.db
 * @param {string} fileName - The backup file name
 * @param {string} backupDbPrefix - The backup database prefix (e.g., 'fcms_data_')
 * @returns {string} The timestamp as a string
 */
export const extractBackupTimestamp = (fileName, backupDbPrefix) => {
  if (!fileName || !backupDbPrefix) {
    return null;
  }

  // Remove file extension
  const fileNameWithoutExtension = fileName.split('.')[0];

  // Split by underscores to handle new format with date/time
  const parts = fileNameWithoutExtension.split('_');

  // Get the last part which is the timestamp
  const timestamp = parts[parts.length - 1];

  return timestamp;
};
