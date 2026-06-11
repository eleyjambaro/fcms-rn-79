import commaNumber from 'comma-number';
import moment from 'moment';

import {
  formatUOMAbbrev,
  isSalesTaxable,
  getInvoiceReceiptNumber,
} from './stringHelpers';

const getAlignments = () => {
  return {
    left: '\x1b\x61\x00', // ESC a 0: Left
    center: '\x1b\x61\x01', // ESC a 1: Center
    right: '\x1b\x61\x02', // ESC a 2: Right
  };
};

const getDividers = (maxColumns = 32) => {
  return {
    dashed: '-'.repeat(maxColumns),
    dotted: '.'.repeat(maxColumns),
    asterisks: '*'.repeat(maxColumns),
    doubleDashed: '='.repeat(maxColumns),
  };
};

const alignTextLeftAndRight = ({
  maxColumns = 32,
  leftText = '',
  rightText = '',
  spaceFiller = ' ',
}) => {
  const spaces = spaceFiller.repeat(
    maxColumns - leftText.length - rightText.length,
  );

  return `${leftText}${spaces}${rightText}`;
};

const costMarkers = {
  taxable: 'T',
  taxExempt: 'E',
};

// Thermal printers render only their active single-byte code page, so a
// multi-byte Unicode currency glyph prints as garbage (the printer decodes its
// UTF-8 bytes with a built-in, often CJK, code page — e.g. ₱ U+20B1 came out as
// a Chinese character). Map known non-ASCII symbols to an ASCII-safe label,
// pass ASCII symbols (e.g. "$") through unchanged, and drop any other non-ASCII
// symbol rather than print garbage.
const printerSafeCurrencyMap = {
  '₱': 'P', // Philippine peso — not present in any standard ESC/POS code page
};

const toPrinterSafeCurrencySymbol = symbol => {
  if (!symbol) {
    return '';
  }
  if (printerSafeCurrencyMap[symbol]) {
    return printerSafeCurrencyMap[symbol];
  }
  // ASCII symbols (e.g. "$") print fine as-is.
  if (/^[\x20-\x7E]+$/.test(symbol)) {
    return symbol;
  }
  // Unknown non-ASCII symbol: better blank than garbage.
  return '';
};

export const printSalesInvoice = ({
  printer: _printer,
  salesInvoice,
  salesInvoiceItems,
  salesInvoiceTotals,
  salesInvoiceTotalsAlignment = 'left-and-right',
  company,
  currencySymbol,
}) => {
  let maxColumns = 32;
  const alignments = getAlignments();
  const dividers = getDividers();
  let receiptText = '';

  // receipt header — company name, then branch name, then branch address
  // (mirrors the test-print layout: "My Store" / "123 Main Street" / ...).
  if (company && Object.keys(company)?.length > 0) {
    if (company.name) {
      receiptText += `${alignments.center}<D>${company.name}</D>\n`;
    }

    if (company.branch_name) {
      receiptText += `${alignments.center}${company.branch_name}\n`;
    }

    if (company.branch_address) {
      receiptText += `${alignments.center}${company.branch_address}\n`;
    }

    receiptText += `\n`;
  }

  receiptText += `${dividers.doubleDashed}\n`;
  receiptText += `${alignments.center}SALES INVOICE\n`;
  receiptText += `${dividers.doubleDashed}\n`;

  if (salesInvoiceItems && salesInvoiceItems.length > 0) {
    // receipt item list
    for (let item of salesInvoiceItems) {
      let saleQty = `${commaNumber(
        parseFloat(item.sale_qty || 0).toFixed(item.sale_qty % 1 ? 2 : 0),
      )} ${formatUOMAbbrev(item.uom_abbrev)}`;

      let unitSellingPrice = `@ ${commaNumber(
        parseFloat(item?.unit_selling_price || 0).toFixed(2),
      )}`;

      /**
       * from sales invoice item list
       */
      if (item.sale_size_name) {
        saleQty = `x ${commaNumber(
          parseFloat(item.sale_qty || 0).toFixed(item.sale_qty % 1 ? 2 : 0),
        )}`;

        unitSellingPrice = `@ ${commaNumber(
          parseFloat(item?.sale_unit_selling_price || 0).toFixed(2),
        )}`;
      }

      /**
       * from sales register ticket item list
       */
      if (item.option_name) {
        saleQty = `x ${commaNumber(
          parseFloat(item.sale_qty || 0).toFixed(item.sale_qty % 1 ? 2 : 0),
        )}`;

        unitSellingPrice = `@ ${commaNumber(
          parseFloat(item?.option_selling_price || 0).toFixed(2),
        )}`;
      }

      let subTotal = `${commaNumber(
        parseFloat(item?.subtotal_amount || 0).toFixed(2),
      )} ${isSalesTaxable(item) ? costMarkers.taxable : costMarkers.taxExempt}`;

      let leftText = `${saleQty}  ${unitSellingPrice}`;
      let rightText = `${subTotal}`;
      let textInARow = alignTextLeftAndRight({leftText, rightText});

      receiptText += `${item.name}\n`;

      // item size name below item name
      let itemSizeName;

      /**
       * from sales invoice item list
       */
      if (item.sale_size_name) {
        itemSizeName = `${item.sale_size_name}`;

        if (item.sale_in_size_qty) {
          itemSizeName += ` (${item.sale_in_size_qty} ${formatUOMAbbrev(
            item.sale_in_size_qty_uom_abbrev,
          )?.toUpperCase()})\n`;
        } else {
          itemSizeName += '\n';
        }

        receiptText += itemSizeName;
      }

      /**
       * from sales register ticket item list
       */
      if (item.option_name) {
        itemSizeName = `${item.option_name}`;

        if (item.in_option_qty) {
          itemSizeName += ` (${item.in_option_qty} ${formatUOMAbbrev(
            item.in_option_qty_uom_abbrev,
          )?.toUpperCase()})\n`;
        } else {
          itemSizeName += '\n';
        }

        receiptText += itemSizeName;
      }

      receiptText += `${textInARow}\n`;
      receiptText += `\n`;
    }
  }

  // receipt totals
  if (salesInvoiceTotals) {
    const {
      grandTotalAmount,
      totalTaxableAmount,
      totalTaxExemptAmount,
      totalTaxAmount,
    } = salesInvoiceTotals;

    if (totalTaxableAmount !== undefined || totalTaxableAmount !== null) {
      if (salesInvoiceTotalsAlignment === 'right') {
        receiptText += `${alignments.right}Taxable (T): ${commaNumber(
          parseFloat(totalTaxableAmount || 0).toFixed(2),
        )}\n`;
      } else if (salesInvoiceTotalsAlignment === 'left-and-right') {
        receiptText += alignTextLeftAndRight({
          leftText: `Taxable (T):`,
          rightText: `${commaNumber(
            parseFloat(totalTaxableAmount || 0).toFixed(2),
          )}\n`,
        });
      }
    }

    if (totalTaxExemptAmount !== undefined || totalTaxExemptAmount !== null) {
      if (salesInvoiceTotalsAlignment === 'right') {
        receiptText += `${alignments.right}Tax-Exempt (E): ${commaNumber(
          parseFloat(totalTaxExemptAmount || 0).toFixed(2),
        )}\n`;
      } else if (salesInvoiceTotalsAlignment === 'left-and-right') {
        receiptText += alignTextLeftAndRight({
          leftText: `Tax-Exempt (E):`,
          rightText: `${commaNumber(
            parseFloat(totalTaxExemptAmount || 0).toFixed(2),
          )}\n`,
        });
      }
    }

    if (totalTaxAmount !== undefined || totalTaxAmount !== null) {
      if (salesInvoiceTotalsAlignment === 'right') {
        receiptText += `${alignments.right}Tax Amount: ${commaNumber(
          parseFloat(totalTaxAmount || 0).toFixed(2),
        )}\n`;
      } else if (salesInvoiceTotalsAlignment === 'left-and-right') {
        receiptText += alignTextLeftAndRight({
          leftText: `Tax Amount:`,
          rightText: `${commaNumber(
            parseFloat(totalTaxAmount || 0).toFixed(2),
          )}\n`,
        });
      }
    }

    // Currency symbol is intentionally shown on the TOTAL line only, and is
    // sanitized for the printer's code page (see toPrinterSafeCurrencySymbol).
    const printableCurrencySymbol = toPrinterSafeCurrencySymbol(currencySymbol);
    receiptText += `${alignments.right}TOTAL: <D>${
      printableCurrencySymbol ? `${printableCurrencySymbol} ` : ''
    }${commaNumber(parseFloat(grandTotalAmount || 0).toFixed(2))}</D>\n`;
  }

  // receipt details
  if (salesInvoice) {
    const datetime = moment(
      salesInvoice.invoice_date.split(' ').join('T'),
    ).format('YYYY.MM.DD hh:mm:ss A');

    receiptText += `${dividers.dashed}\n`;
    receiptText += `Date: ${datetime}\n`;
    receiptText += `OR Number: ${getInvoiceReceiptNumber(salesInvoice)}\n`;
    receiptText += `${dividers.dashed}`;
  }

  return receiptText;
};
