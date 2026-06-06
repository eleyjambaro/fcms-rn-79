import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import uuid from 'react-native-uuid';

import {getDBConnection, getCloudSyncParams} from '../localDb';
import {
  createQueryFilter,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';
import {scheduleSyncSoon} from '../services/syncService';

export const confirmSaleEntries = async ({
  saleDate,
  saleItems,
  paymentFormValues,
  onLimitReached,
  onSuccess,
}) => {
  if (!saleItems?.length) return;

  const salesInvoiceDate = saleDate
    ? `datetime('${saleDate}')`
    : `datetime('now', 'localtime')`;

  let createdInvoiceId = null;

  try {
    const db = await getDBConnection();

    if (await isMutationDisabled()) {
      onLimitReached &&
        onLimitReached({
          message: `Your items are now in Read-Only Mode and you can no longer insert your new sales`,
        });
      console.debug('Failed to add/remove stock, mutation is disabled.');

      return;
    }

    /**
     * TODO: Change code below from vendor data to customer data
     */

    // let vendor = {
    //   id: null,
    //   vendor_display_name: '',
    // };

    // /**
    //  * Validate vendor id
    //  */
    // if (values.vendor_id) {
    //   const getVendorQuery = `
    //   SELECT * FROM vendors WHERE id = '${parseInt(values.vendor_id)}'

    // `;

    //   const getVendorResult = await db.executeSql(getVendorQuery);
    //   const fetchedVendor = getVendorResult[0].rows.item(0);

    //   if (!fetchedVendor) {
    //     /**
    //      * We have an option to throw an error or just return.
    //      * Only throw an error if we want to restrict user from selecting
    //      * a deleted vendor during the confirm purchases screen is rendered.
    //      */

    //     actions?.setFieldValue('vendor_id', '');
    //     throw new Error('Failed to confirm batch purchases. Vendor not found.');
    //   } else {
    //     vendor = fetchedVendor;
    //   }
    // } else {
    //   actions?.setFieldValue('vendor_id', '');
    //   throw new Error('Failed to confirm batch purchases. Vendor not found.');
    // }

    // const vendorId = vendor.id ? parseInt(vendor.id) : 'null';
    // const vendorDisplayName = vendor.vendor_display_name
    //   ? `'${vendor.vendor_display_name}'`
    //   : 'null';
    // const officialReceiptNumber = values.official_receipt_number
    //   ? `'${values.official_receipt_number}'`
    //   : 'null';

    const accountUID = 'null';
    const customerId = 'null';
    const {deviceId, branchId} = await getCloudSyncParams();

    /**
     * Create invoice
     */
    const newInvoiceId = uuid.v4();
    const createInvoiceQuery = `
      INSERT INTO invoices (
        id,
        sold_by_account_uid,
        customer_id,
        invoice_date,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES (
        '${newInvoiceId}',
        ${accountUID},
        ${customerId},
        ${salesInvoiceDate},
        ${deviceId ? `'${deviceId}'` : 'NULL'},
        ${branchId ? `'${branchId}'` : 'NULL'},
        '${newInvoiceId}',
        CURRENT_TIMESTAMP
      )
    `;

    const createInvoiceResult = await db.executeSql(createInvoiceQuery);
    createdInvoiceId = createInvoiceResult[0]?.rowsAffected > 0 ? newInvoiceId : null;

    if (!createdInvoiceId) {
      throw Error('Missing invoice id.');
    }

    const getCreatedSalesInvoiceQuery = `
      SELECT * FROM invoices WHERE id = '${createdInvoiceId}'
    `;
    const getCreatedSalesInvoiceResult = await db.executeSql(
      getCreatedSalesInvoiceQuery,
    );
    const salesInvoice = getCreatedSalesInvoiceResult[0].rows.item(0);

    // insert each sale entries to Sale logs
    let insertSaleLogsQuery = `
      INSERT INTO sale_logs (
        id,
        item_id,
        ref_tax_id,
        ref_customer_id,
        sale_unit_selling_price,
        sale_unit_selling_price_net,
        sale_unit_selling_price_tax,
        sale_size_name,
        sale_in_size_qty,
        sale_in_size_qty_uom_abbrev,
        sale_tax_rate_percentage,
        sale_tax_name,
        sale_qty,
        sale_date,
        invoice_id,
        sold_by_account_uid,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    // insert each sale entries to Inventory logs
    let insertInventoryLogsQuery = `
      INSERT INTO inventory_logs (
        id,
        operation_id,
        item_id,
        ref_tax_id,
        adjustment_unit_cost,
        adjustment_unit_cost_net,
        adjustment_unit_cost_tax,
        adjustment_tax_rate_percentage,
        adjustment_tax_name,
        adjustment_qty,
        adjustment_date,
        invoice_id,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    // let tmpValues = `VALUES `;

    saleItems.forEach((item, index) => {
      const saleSizeName = item.option_name ? `'${item.option_name}'` : 'null';
      let inSizeQty = 1;
      let inSizeQtyUOMAbbrev = item.uom_abbrev;
      let unitSellingPrice = parseFloat(item.unit_selling_price || 0);
      let qty = parseFloat(item.saleQty || 0);
      const taxRatePercentage = parseFloat(item.tax_rate_percentage || 0);

      if (item.item_modifier_options_count > 0) {
        inSizeQty = parseFloat(item.in_option_qty);
        inSizeQtyUOMAbbrev = item.in_option_qty_uom_abbrev;
        unitSellingPrice = parseFloat(item.option_selling_price || 0);
      }

      if (item.menu_id) {
        inSizeQty = parseFloat(item.in_menu_qty);
        inSizeQtyUOMAbbrev = item.in_option_qty_uom_abbrev;
        unitSellingPrice = parseFloat(item.option_selling_price || 0);
      }

      // Selling side uses the item's sales tax (effective value falls back to
      // the cost tax when unset); the cost side below keeps the cost tax.
      const salesTaxRatePercentage = parseFloat(
        item.sales_tax_rate_percentage ?? item.tax_rate_percentage ?? 0,
      );

      const unitSellingPriceNet =
        unitSellingPrice / (salesTaxRatePercentage / 100 + 1);
      const unitSellingPriceTax = unitSellingPrice - unitSellingPriceNet;

      const unitCost = parseFloat(item.unit_cost || 0);
      const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
      const unitCostTax = unitCost - unitCostNet;

      const taxId = item.tax_id ? `'${item.tax_id}'` : 'null';
      const taxName = item.tax_name ? `'${item.tax_name}'` : 'null';

      // Effective sales tax recorded on the sale log (ref_tax_id / name).
      const salesRefTaxId =
        item.sales_tax_id_effective || item.tax_id
          ? `'${item.sales_tax_id_effective || item.tax_id}'`
          : 'null';
      const salesTaxName =
        item.sales_tax_name || item.tax_name
          ? `'${item.sales_tax_name || item.tax_name}'`
          : 'null';

      /**
       * Sale logs
       */

      const newSaleLogId = uuid.v4();
      insertSaleLogsQuery += `(
        '${newSaleLogId}',
        '${item.id}',
        ${salesRefTaxId},
        ${customerId},
        ${unitSellingPrice},
        ${unitSellingPriceNet},
        ${unitSellingPriceTax},
        ${saleSizeName},
        ${inSizeQty},
        '${inSizeQtyUOMAbbrev}',
        ${salesTaxRatePercentage},
        ${salesTaxName},
        ${qty},
        ${salesInvoiceDate},
        '${createdInvoiceId}',
        ${accountUID},
        ${deviceId ? `'${deviceId}'` : 'NULL'},
        ${branchId ? `'${branchId}'` : 'NULL'},
        '${newSaleLogId}',
        CURRENT_TIMESTAMP
      )`;

      if (saleItems.length - 1 !== index) {
        insertSaleLogsQuery += `,
          `;
      } else {
        insertSaleLogsQuery += ';';
      }

      /**
       * Convert size options before adding to inventory_logs
       */
      let itemUOMAbbrev = item.uom_abbrev;
      let itemUOMAbbrevPerPiece = item.uom_abbrev_per_piece;
      let itemQtyPerPiece = item.qty_per_piece;
      let qtyBasedOnItemUom;

      if (item.use_measurement_per_piece) {
        const convertedQtyBasedOnItemUOMPerPiece = convert(
          parseFloat(item.in_option_qty),
        )
          .from(item.in_option_qty_uom_abbrev)
          .to(itemUOMAbbrevPerPiece);

        const qtyInPiece =
          parseFloat(convertedQtyBasedOnItemUOMPerPiece) / itemQtyPerPiece;
        qtyBasedOnItemUom = qtyInPiece;
      } else {
        qtyBasedOnItemUom = convert(parseFloat(item.in_option_qty))
          .from(item.in_option_qty_uom_abbrev)
          .to(itemUOMAbbrev);
      }

      let usedStockQty = qtyBasedOnItemUom * qty;

      /**
       * Inventory logs
       */

      // operation code 'stock_usage' is Stock Usage Entry
      const newInvLogId = uuid.v4();
      insertInventoryLogsQuery += `(
        '${newInvLogId}',
        (SELECT id FROM operations WHERE code = 'stock_usage'),
        '${item.id}',
        ${taxId},
        ${unitCost},
        ${unitCostNet},
        ${unitCostTax},
        ${taxRatePercentage},
        ${taxName},
        ${usedStockQty},
        ${salesInvoiceDate},
        '${createdInvoiceId}',
        ${deviceId ? `'${deviceId}'` : 'NULL'},
        ${branchId ? `'${branchId}'` : 'NULL'},
        '${uuid.v4()}',
        CURRENT_TIMESTAMP
      )`;

      if (saleItems.length - 1 !== index) {
        insertInventoryLogsQuery += `,
          `;
      } else {
        insertInventoryLogsQuery += ';';
      }

      // tmp values
      // tmpValues += .`(
      //   ${item.id},
      //   ${unitSellingPrice}
      // )`;

      // if (result.rows.length - 1 !== index) {
      //   tmpValues += `,
      //     `;
      // }
    });

    await db.executeSql(insertSaleLogsQuery);
    await db.executeSql(insertInventoryLogsQuery);

    /**
     * Payment details
     */

    if (
      paymentFormValues.is_split_payment &&
      Object.keys(paymentFormValues.payments)?.length > 0
    ) {
      // insert each payments to payments table
      let insertPaymentsQuery = `
        INSERT INTO payments (
          id,
          invoice_id,
          payment_method,
          payment_amount,
          change_amount,
          payment_date,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (
        let index = 0;
        index < Object.keys(paymentFormValues.payments).length;
        index++
      ) {
        let payment =
          paymentFormValues.payments[
            Object.keys(paymentFormValues.payments)[index]
          ];

        const newPaymentId = uuid.v4();
        insertPaymentsQuery += `(
          '${newPaymentId}',
          '${createdInvoiceId}',
          '${payment?.payment_method}',
          ${parseFloat(payment?.payment_amount || 0)},
          ${parseFloat(payment?.change_amount || 0)},
          ${salesInvoiceDate},
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newPaymentId}',
          CURRENT_TIMESTAMP
        )`;

        if (Object.keys(paymentFormValues.payments).length - 1 !== index) {
          insertPaymentsQuery += `,
        `;
        } else {
          insertPaymentsQuery += ';';
        }
      }

      await db.executeSql(insertPaymentsQuery);
    } else {
      const newPaymentId2 = uuid.v4();
      const createPaymentDetailsQuery = `
      INSERT INTO payments (
        id,
        invoice_id,
        payment_method,
        payment_amount,
        change_amount,
        payment_date,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES (
        '${newPaymentId2}',
        '${createdInvoiceId}',
        '${paymentFormValues?.payment_method}',
        ${parseFloat(paymentFormValues?.payment_amount || 0)},
         ${parseFloat(paymentFormValues?.change_amount || 0)},
         ${salesInvoiceDate},
         ${deviceId ? `'${deviceId}'` : 'NULL'},
         ${branchId ? `'${branchId}'` : 'NULL'},
         '${newPaymentId2}',
         CURRENT_TIMESTAMP
      )
    `;

      await db.executeSql(createPaymentDetailsQuery);
    }

    // // update each item's last unit cost
    // const updateItemsLastUnitCostQuery = `
    //   WITH tmp(item_id, last_unit_cost) AS (${tmpValues})

    //   UPDATE items SET unit_cost = (SELECT last_unit_cost FROM tmp WHERE items.id = tmp.item_id),
    //   updated_at = CURRENT_TIMESTAMP

    //   WHERE id IN (SELECT item_id FROM tmp)
    // `;

    // const updateItemsCurrentStockResult = await db.executeSql(
    //   updateItemsLastUnitCostQuery,
    // );

    scheduleSyncSoon();
    onSuccess && onSuccess({salesInvoice});

    return {
      createdInvoiceId,
      saleItems,
    };
  } catch (error) {
    // delete created invoice
    if (createdInvoiceId) {
      const deleteInvoiceQuery = `
        UPDATE invoices SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = '${createdInvoiceId}';
      `;

      const deleteInvoiceResult = await db.executeSql(deleteInvoiceQuery);

      if (deleteInvoiceResult[0].rowsAffected === 0) {
        throw Error('Failed to delete created invoice.');
      }
    }

    console.debug(error);
    throw Error('Failed to confirm sale entries.');
  }
};

export const confirmFulfillingSalesOrders = async ({
  saleDate,
  salesOrderGroupId,
  saleItems,
  paymentFormValues,
  onLimitReached,
  onSuccess,
}) => {
  if (!saleItems?.length) return;

  const salesInvoiceDate = saleDate
    ? `datetime('${saleDate}')`
    : `datetime('now', 'localtime')`;

  let createdInvoiceId = null;

  try {
    const db = await getDBConnection();

    if (await isMutationDisabled()) {
      onLimitReached &&
        onLimitReached({
          message: `Your items are now in Read-Only Mode and you can no longer insert your new sales`,
        });
      console.debug('Failed to add/remove stock, mutation is disabled.');

      return;
    }

    /**
     * TODO: Change code below from vendor data to customer data
     */

    // let vendor = {
    //   id: null,
    //   vendor_display_name: '',
    // };

    // /**
    //  * Validate vendor id
    //  */
    // if (values.vendor_id) {
    //   const getVendorQuery = `
    //   SELECT * FROM vendors WHERE id = '${parseInt(values.vendor_id)}'

    // `;

    //   const getVendorResult = await db.executeSql(getVendorQuery);
    //   const fetchedVendor = getVendorResult[0].rows.item(0);

    //   if (!fetchedVendor) {
    //     /**
    //      * We have an option to throw an error or just return.
    //      * Only throw an error if we want to restrict user from selecting
    //      * a deleted vendor during the confirm purchases screen is rendered.
    //      */

    //     actions?.setFieldValue('vendor_id', '');
    //     throw new Error('Failed to confirm batch purchases. Vendor not found.');
    //   } else {
    //     vendor = fetchedVendor;
    //   }
    // } else {
    //   actions?.setFieldValue('vendor_id', '');
    //   throw new Error('Failed to confirm batch purchases. Vendor not found.');
    // }

    // const vendorId = vendor.id ? parseInt(vendor.id) : 'null';
    // const vendorDisplayName = vendor.vendor_display_name
    //   ? `'${vendor.vendor_display_name}'`
    //   : 'null';
    // const officialReceiptNumber = values.official_receipt_number
    //   ? `'${values.official_receipt_number}'`
    //   : 'null';

    const accountUID = 'null';
    const customerId = 'null';
    const {deviceId: salesDeviceId, branchId: salesBranchId} =
      await getCloudSyncParams();

    /**
     * Create invoice
     */
    const newInvoiceId = uuid.v4();
    const createInvoiceQuery = `
      INSERT INTO invoices (
        id,
        sold_by_account_uid,
        customer_id,
        invoice_date,
        sales_order_group_id,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES (
        '${newInvoiceId}',
        ${accountUID},
        ${customerId},
        ${salesInvoiceDate},
        ${salesOrderGroupId ? `'${salesOrderGroupId}'` : 'null'},
        ${salesDeviceId ? `'${salesDeviceId}'` : 'NULL'},
        ${salesBranchId ? `'${salesBranchId}'` : 'NULL'},
        '${newInvoiceId}',
        CURRENT_TIMESTAMP
      )
    `;

    await db.executeSql(createInvoiceQuery);
    createdInvoiceId = newInvoiceId;

    if (!createdInvoiceId) {
      throw Error('Missing invoice id.');
    }

    // insert each sale entries to Sale logs
    let insertSaleLogsQuery = `
      INSERT INTO sale_logs (
        id,
        item_id,
        ref_tax_id,
        ref_customer_id,
        sale_unit_selling_price,
        sale_unit_selling_price_net,
        sale_unit_selling_price_tax,
        sale_size_name,
        sale_in_size_qty,
        sale_in_size_qty_uom_abbrev,
        sale_tax_rate_percentage,
        sale_tax_name,
        sale_qty,
        sale_date,
        invoice_id,
        sold_by_account_uid,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    // insert each sale entries to Inventory logs
    let insertInventoryLogsQuery = `
      INSERT INTO inventory_logs (
        id,
        operation_id,
        item_id,
        ref_tax_id,
        adjustment_unit_cost,
        adjustment_unit_cost_net,
        adjustment_unit_cost_tax,
        adjustment_tax_rate_percentage,
        adjustment_tax_name,
        adjustment_qty,
        adjustment_date,
        invoice_id,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    let tmpValues = `VALUES `;

    saleItems.forEach((item, index) => {
      const saleSizeName = item.order_size_name
        ? `'${item.order_size_name}'`
        : 'null';
      let inSizeQty = 1;
      let inSizeQtyUOMAbbrev = item.uom_abbrev;
      let unitSellingPrice = parseFloat(item.unit_selling_price || 0);
      let qty = parseFloat(item.saleQty || 0);
      const taxRatePercentage = parseFloat(item.tax_rate_percentage || 0);

      if (item.item_modifier_options_count > 0) {
        inSizeQty = parseFloat(item.order_in_size_qty);
        inSizeQtyUOMAbbrev = item.order_in_size_qty_uom_abbrev;
        unitSellingPrice = parseFloat(item.order_unit_selling_price || 0);
      }

      // Selling side uses the item's sales tax (effective value falls back to
      // the cost tax when unset); the cost side below keeps the cost tax.
      const salesTaxRatePercentage = parseFloat(
        item.sales_tax_rate_percentage ?? item.tax_rate_percentage ?? 0,
      );

      const unitSellingPriceNet =
        unitSellingPrice / (salesTaxRatePercentage / 100 + 1);
      const unitSellingPriceTax = unitSellingPrice - unitSellingPriceNet;

      const unitCost = parseFloat(item.unit_cost || 0);
      const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
      const unitCostTax = unitCost - unitCostNet;

      const taxId = item.tax_id ? `'${item.tax_id}'` : 'null';
      const taxName = item.tax_name ? `'${item.tax_name}'` : 'null';

      // Effective sales tax recorded on the sale log (ref_tax_id / name).
      const salesRefTaxId =
        item.sales_tax_id_effective || item.tax_id
          ? `'${item.sales_tax_id_effective || item.tax_id}'`
          : 'null';
      const salesTaxName =
        item.sales_tax_name || item.tax_name
          ? `'${item.sales_tax_name || item.tax_name}'`
          : 'null';

      /**
       * Sale logs
       */

      const newSaleLogId = uuid.v4();
      insertSaleLogsQuery += `(
        '${newSaleLogId}',
        '${item.id}',
        ${salesRefTaxId},
        ${customerId},
        ${unitSellingPrice},
        ${unitSellingPriceNet},
        ${unitSellingPriceTax},
        ${saleSizeName},
        ${inSizeQty},
        '${inSizeQtyUOMAbbrev}',
        ${salesTaxRatePercentage},
        ${salesTaxName},
        ${qty},
        ${salesInvoiceDate},
        '${createdInvoiceId}',
        ${accountUID},
        ${salesDeviceId ? `'${salesDeviceId}'` : 'NULL'},
        ${salesBranchId ? `'${salesBranchId}'` : 'NULL'},
        '${newSaleLogId}',
        CURRENT_TIMESTAMP
      )`;

      if (saleItems.length - 1 !== index) {
        insertSaleLogsQuery += `,
          `;
      } else {
        insertSaleLogsQuery += ';';
      }

      /**
       * Convert size before adding to inventory_logs
       */
      let itemUOMAbbrev = item.uom_abbrev;
      let itemUOMAbbrevPerPiece = item.uom_abbrev_per_piece;
      let itemQtyPerPiece = item.qty_per_piece;
      let qtyBasedOnItemUom;

      if (item.use_measurement_per_piece) {
        const convertedQtyBasedOnItemUOMPerPiece = convert(
          parseFloat(item.order_in_size_qty),
        )
          .from(item.order_in_size_qty_uom_abbrev)
          .to(itemUOMAbbrevPerPiece);

        const qtyInPiece =
          parseFloat(convertedQtyBasedOnItemUOMPerPiece) / itemQtyPerPiece;
        qtyBasedOnItemUom = qtyInPiece;
      } else {
        qtyBasedOnItemUom = convert(parseFloat(item.order_in_size_qty))
          .from(item.order_in_size_qty_uom_abbrev)
          .to(itemUOMAbbrev);
      }

      let usedStockQty = qtyBasedOnItemUom * qty;

      /**
       * Inventory logs
       */

      // operation code 'stock_usage' is Stock Usage Entry
      const newInvLogId = uuid.v4();
      insertInventoryLogsQuery += `(
        '${newInvLogId}',
        (SELECT id FROM operations WHERE code = 'stock_usage'),
        '${item.id}',
        ${taxId},
        ${unitCost},
        ${unitCostNet},
        ${unitCostTax},
        ${taxRatePercentage},
        ${taxName},
        ${usedStockQty},
        ${salesInvoiceDate},
        '${createdInvoiceId}',
        ${salesDeviceId ? `'${salesDeviceId}'` : 'NULL'},
        ${salesBranchId ? `'${salesBranchId}'` : 'NULL'},
        '${newInvLogId}',
        CURRENT_TIMESTAMP
      )`;

      if (saleItems.length - 1 !== index) {
        insertInventoryLogsQuery += `,
          `;
      } else {
        insertInventoryLogsQuery += ';';
      }

      const totalFulfilledQty = qty + parseFloat(item.fulfilled_order_qty || 0);

      // tmp values
      tmpValues += `(
        ${item.order_id},
        ${totalFulfilledQty}
      )`;

      if (saleItems.length - 1 !== index) {
        tmpValues += `,
          `;
      }
    });

    await db.executeSql(insertSaleLogsQuery);
    await db.executeSql(insertInventoryLogsQuery);

    /**
     * Payment details
     */

    if (
      paymentFormValues.is_split_payment &&
      Object.keys(paymentFormValues.payments)?.length > 0
    ) {
      // insert each payments to payments table
      let insertPaymentsQuery = `
        INSERT INTO payments (
          id,
          invoice_id,
          payment_method,
          payment_amount,
          change_amount,
          payment_date,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (
        let index = 0;
        index < Object.keys(paymentFormValues.payments).length;
        index++
      ) {
        let payment =
          paymentFormValues.payments[
            Object.keys(paymentFormValues.payments)[index]
          ];

        const newPaymentId = uuid.v4();
        insertPaymentsQuery += `(
          '${newPaymentId}',
          '${createdInvoiceId}',
          '${payment?.payment_method}',
          ${parseFloat(payment?.payment_amount || 0)},
          ${parseFloat(payment?.change_amount || 0)},
          ${salesInvoiceDate},
          ${salesDeviceId ? `'${salesDeviceId}'` : 'NULL'},
          ${salesBranchId ? `'${salesBranchId}'` : 'NULL'},
          '${newPaymentId}',
          CURRENT_TIMESTAMP
        )`;

        if (Object.keys(paymentFormValues.payments).length - 1 !== index) {
          insertPaymentsQuery += `,
          `;
        } else {
          insertPaymentsQuery += ';';
        }
      }

      await db.executeSql(insertPaymentsQuery);
    } else {
      const createPaymentDetailsQuery = `
        INSERT INTO payments (
          id,
          invoice_id,
          payment_method,
          payment_amount,
          change_amount,
          payment_date,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES (
          '${uuid.v4()}',
          '${createdInvoiceId}',
          '${paymentFormValues?.payment_method}',
          ${parseFloat(paymentFormValues?.payment_amount || 0)},
          ${parseFloat(paymentFormValues?.change_amount || 0)},
          ${salesInvoiceDate},
          ${salesDeviceId ? `'${salesDeviceId}'` : 'NULL'},
          ${salesBranchId ? `'${salesBranchId}'` : 'NULL'},
          '${uuid.v4()}',
          CURRENT_TIMESTAMP
        )
      `;

      await db.executeSql(createPaymentDetailsQuery);
    }

    /**
     * Update sales orders
     */

    // // update each sales order's fulfilled order qty
    const updateFulfilledOrderQtyQuery = `
      WITH tmp(order_id, fulfilled_order_qty) AS (${tmpValues})

      UPDATE sales_orders SET fulfilled_order_qty = (SELECT fulfilled_order_qty FROM tmp WHERE sales_orders.id = tmp.order_id),
      updated_at = CURRENT_TIMESTAMP

      WHERE id IN (SELECT order_id FROM tmp)
    `;

    const updateFulfilledOrderQtyResult = await db.executeSql(
      updateFulfilledOrderQtyQuery,
    );

    scheduleSyncSoon();
    onSuccess && onSuccess();

    return {
      createdInvoiceId,
      saleItems,
    };
  } catch (error) {
    // delete created invoice
    if (createdInvoiceId) {
      // const deleteInvoiceQuery = `
      //   DELETE FROM invoices
      //   WHERE id = '${createdInvoiceId}';
      // `;
      // const deleteInvoiceResult = await db.executeSql(deleteInvoiceQuery);
      // if (deleteInvoiceResult[0].rowsAffected === 0) {
      //   throw Error('Failed to delete created invoice.');
      // }
    }

    console.debug(error);
    throw Error('Failed to confirm fulfilling sales orders.');
  }
};

export const addSaleEntriesToSalesOrders = async ({
  orderDate,
  saleItems,
  onLimitReached,
  onSuccess,
}) => {
  if (!saleItems?.length) return;

  const salesOrderDate = orderDate
    ? `datetime('${orderDate}')`
    : `datetime('now', 'localtime')`;

  let createdSalesOrderGroupId = null;

  try {
    const db = await getDBConnection();
    const {deviceId: salesOrderDeviceId, branchId: salesOrderBranchId} =
      await getCloudSyncParams();

    if (await isMutationDisabled()) {
      onLimitReached &&
        onLimitReached({
          message: `Your items are now in Read-Only Mode and you can no longer insert your new sales order`,
        });
      console.debug('Failed to add/remove stock, mutation is disabled.');

      return;
    }

    /**
     * TODO: Change code below from vendor data to customer data
     */

    // let vendor = {
    //   id: null,
    //   vendor_display_name: '',
    // };

    // /**
    //  * Validate vendor id
    //  */
    // if (values.vendor_id) {
    //   const getVendorQuery = `
    //   SELECT * FROM vendors WHERE id = '${parseInt(values.vendor_id)}'

    // `;

    //   const getVendorResult = await db.executeSql(getVendorQuery);
    //   const fetchedVendor = getVendorResult[0].rows.item(0);

    //   if (!fetchedVendor) {
    //     /**
    //      * We have an option to throw an error or just return.
    //      * Only throw an error if we want to restrict user from selecting
    //      * a deleted vendor during the confirm purchases screen is rendered.
    //      */

    //     actions?.setFieldValue('vendor_id', '');
    //     throw new Error('Failed to confirm batch purchases. Vendor not found.');
    //   } else {
    //     vendor = fetchedVendor;
    //   }
    // } else {
    //   actions?.setFieldValue('vendor_id', '');
    //   throw new Error('Failed to confirm batch purchases. Vendor not found.');
    // }

    // const vendorId = vendor.id ? parseInt(vendor.id) : 'null';
    // const vendorDisplayName = vendor.vendor_display_name
    //   ? `'${vendor.vendor_display_name}'`
    //   : 'null';
    // const officialReceiptNumber = values.official_receipt_number
    //   ? `'${values.official_receipt_number}'`
    //   : 'null';

    const accountUID = 'null';
    const customerId = 'null';

    /**
     * Create sales order group
     */
    const newSalesOrderGroupId = uuid.v4();
    const createSalesOrderGroupQuery = `
      INSERT INTO sales_order_groups (
        id,
        sold_by_account_uid,
        customer_id,
        order_date,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES (
        '${newSalesOrderGroupId}',
        ${accountUID},
        ${customerId},
        ${salesOrderDate},
        ${salesOrderDeviceId ? `'${salesOrderDeviceId}'` : 'NULL'},
        ${salesOrderBranchId ? `'${salesOrderBranchId}'` : 'NULL'},
        '${newSalesOrderGroupId}',
        CURRENT_TIMESTAMP
      )
    `;

    await db.executeSql(createSalesOrderGroupQuery);
    createdSalesOrderGroupId = newSalesOrderGroupId;

    if (!createdSalesOrderGroupId) {
      throw Error('Missing sales order group id.');
    }

    // insert each sale entries to Sales orders
    let insertSalesOrdersQuery = `
      INSERT INTO sales_orders (
        id,
        item_id,
        ref_tax_id,
        ref_customer_id,
        order_unit_selling_price,
        order_unit_selling_price_net,
        order_unit_selling_price_tax,
        order_size_name,
        order_in_size_qty,
        order_in_size_qty_uom_abbrev,
        order_tax_rate_percentage,
        order_tax_name,
        order_qty,
        order_date,
        sales_order_group_id,
        sold_by_account_uid,
        meta_order_size_option_id,
        meta_use_measurement_per_piece,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    // let tmpValues = `VALUES `;

    saleItems.forEach((item, index) => {
      const orderSizeOptionId = item.option_id
        ? `'${item.option_id}'`
        : 'null';
      const useMeasurementPerPiece = item.use_measurement_per_piece ? 1 : 0;
      const saleSizeName = item.option_name ? `'${item.option_name}'` : 'null';
      let inSizeQty = 1;
      let inSizeQtyUOMAbbrev = item.uom_abbrev;
      let unitSellingPrice = parseFloat(item.unit_selling_price || 0);
      let qty = parseFloat(item.saleQty || 0);
      // Sales orders have no cost side, so the recorded tax IS the item's sales
      // tax (effective value falls back to the cost tax when unset).
      const taxRatePercentage = parseFloat(
        item.sales_tax_rate_percentage ?? item.tax_rate_percentage ?? 0,
      );

      if (item.item_modifier_options_count > 0) {
        inSizeQty = parseFloat(item.in_option_qty);
        inSizeQtyUOMAbbrev = item.in_option_qty_uom_abbrev;
        unitSellingPrice = parseFloat(item.option_selling_price || 0);
      }

      const unitSellingPriceNet =
        unitSellingPrice / (taxRatePercentage / 100 + 1);
      const unitSellingPriceTax = unitSellingPrice - unitSellingPriceNet;

      const taxId =
        item.sales_tax_id_effective || item.tax_id
          ? `'${item.sales_tax_id_effective || item.tax_id}'`
          : 'null';
      const taxName =
        item.sales_tax_name || item.tax_name
          ? `'${item.sales_tax_name || item.tax_name}'`
          : 'null';

      const newSalesOrderId = uuid.v4();
      insertSalesOrdersQuery += `(
        '${newSalesOrderId}',
        '${item.id}',
        ${taxId},
        ${customerId},
        ${unitSellingPrice},
        ${unitSellingPriceNet},
        ${unitSellingPriceTax},
        ${saleSizeName},
        ${inSizeQty},
        '${inSizeQtyUOMAbbrev}',
        ${taxRatePercentage},
        ${taxName},
        ${qty},
        ${salesOrderDate},
        '${createdSalesOrderGroupId}',
        ${accountUID},
        ${orderSizeOptionId},
        ${useMeasurementPerPiece},
        ${salesOrderDeviceId ? `'${salesOrderDeviceId}'` : 'NULL'},
        ${salesOrderBranchId ? `'${salesOrderBranchId}'` : 'NULL'},
        '${newSalesOrderId}',
        CURRENT_TIMESTAMP
      )`;

      if (saleItems.length - 1 !== index) {
        insertSalesOrdersQuery += `,
          `;
      } else {
        insertSalesOrdersQuery += ';';
      }

      // tmp values
      // tmpValues += `(
      //   ${item.id},
      //   ${unitSellingPrice}
      // )`;

      // if (result.rows.length - 1 !== index) {
      //   tmpValues += `,
      //     `;
      // }
    });

    await db.executeSql(insertSalesOrdersQuery);

    // // update each item's last unit cost
    // const updateItemsLastUnitCostQuery = `
    //   WITH tmp(item_ifulfilled_order_qty) AS (${tmpValues})

    //   UPDATE items SET unit_cost = (SELECT last_unit_cost FROM tmp WHERE items.id = tmp.item_id),
    //   updated_at = CURRENT_TIMESTAMP

    //   WHERE id IN (SELECT item_id FROM tmp)
    // `;

    // const updateItemsCurrentStockResult = await db.executeSql(
    //   updateItemsLastUnitCostQuery,
    // );

    scheduleSyncSoon();
    onSuccess && onSuccess();

    return {
      createdSalesOrderGroupId,
      saleItems,
    };
  } catch (error) {
    // delete created sales order group
    if (createdSalesOrderGroupId) {
      const deleteSalesOrderGroupQuery = `
        UPDATE sales_order_groups SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
        WHERE id = '${createdSalesOrderGroupId}';
      `;

      const deleteSalesOrderGroupResult = await db.executeSql(
        deleteSalesOrderGroupQuery,
      );

      if (deleteSalesOrderGroupResult[0].rowsAffected === 0) {
        throw Error('Failed to delete created sales order group.');
      }
    }

    console.debug(error);
    throw Error('Failed to add sale entries to sales orders.');
  }
};
