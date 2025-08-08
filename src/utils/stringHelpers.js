import convert from 'convert-units';
import commaNumber from 'comma-number';

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

export const padNumber = (num = 0, pad = '0000000000') => {
  const str = '' + num;
  const ans = pad.substring(0, pad.length - str.length) + str;

  return ans;
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
