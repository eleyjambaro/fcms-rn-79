import commaNumber from 'comma-number';
import moment from 'moment';

import {formatUOMAbbrev, padNumber} from './stringHelpers';

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

  // receipt header
  if (company && Object.keys(company)?.length > 0) {
    if (company.company_display_name) {
      receiptText += `${alignments.center}<D>${company.company_display_name}</D>\n`;

      if (company.branch) {
        receiptText += `${alignments.center}${company.branch}\n`;
      }
    }

    if (company.company_address) {
      receiptText += `${alignments.center}${company.company_address}\n`;
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
      )} ${item?.tax_id ? costMarkers.taxable : costMarkers.taxExempt}`;

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

    receiptText += `${alignments.right}TOTAL: <D>${commaNumber(
      parseFloat(grandTotalAmount || 0).toFixed(2),
    )}</D>\n`;
  }

  // receipt details
  if (salesInvoice) {
    const datetime = moment(
      salesInvoice.invoice_date.split(' ').join('T'),
    ).format('YYYY.MM.DD hh:mm:ss A');

    receiptText += `${dividers.dashed}\n`;
    receiptText += `Date: ${datetime}\n`;
    receiptText += `OR Number: ${padNumber(salesInvoice.id)}\n`;
    receiptText += `${dividers.dashed}`;
  }

  return receiptText;
};
