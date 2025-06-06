import AsyncStorage from '@react-native-async-storage/async-storage';
import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';

export const getItemsAndBatchPurchaseEntries = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, currentBatchPurchaseGroupId}] = queryKey;
  const limit = 10;
  const orderBy = 'categories.name, items.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();

    const purchaseEntries = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectQuery = `
      SELECT
      items.id AS id,
      items.id AS item_id,
      items.category_id AS item_category_id,
      items.tax_id AS item_tax_id,
      items.preferred_vendor_id AS item_vendor_id,
      items.name AS name,
      items.barcode AS barcode,
      items.uom_abbrev AS uom_abbrev,
      items.unit_cost AS unit_cost,
      items.uom_abbrev_per_piece AS uom_abbrev_per_piece,
      items.qty_per_piece AS qty_per_piece,
      items.initial_stock_qty AS initial_stock_qty,
      items.low_stock_level AS low_stock_level,

      inventory_logs_added_and_removed_totals.total_added_stock_qty AS total_added_stock_qty,
      inventory_logs_added_and_removed_totals.total_removed_stock_qty AS total_removed_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_cost AS total_added_stock_cost,
      inventory_logs_added_and_removed_totals.total_removed_stock_cost AS total_removed_stock_cost,
      inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost AS current_stock_cost,

      current_batch_purchase_group_entries.add_stock_qty AS add_stock_qty,
      current_batch_purchase_group_entries.add_stock_unit_cost AS add_stock_unit_cost,
      current_batch_purchase_group_entries.tax_id AS add_stock_tax_id,
      current_batch_purchase_group_entries.add_stock_unit_cost * current_batch_purchase_group_entries.add_stock_qty AS total_cost,

      current_batch_purchase_group_entries.batch_purchase_group_id AS batch_purchase_group_id,
      current_batch_purchase_group_entries.confirmed AS confirmed
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM (
        SELECT * FROM items
        WHERE is_finished_product = 0
      ) AS items

      LEFT JOIN (
        SELECT inventory_logs_added_and_removed.item_id AS item_id,
        inventory_logs_added_and_removed.item_name AS item_name,
        inventory_logs_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost
        FROM (
          SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
          SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM inventory_logs
          LEFT JOIN items ON items.id = inventory_logs.item_id
          LEFT JOIN operations ON operations.id = inventory_logs.operation_id
          WHERE inventory_logs.voided != 1
          GROUP BY inventory_logs.item_id, operations.type
        ) AS inventory_logs_added_and_removed
        LEFT JOIN items ON items.id = inventory_logs_added_and_removed.item_id
        GROUP BY inventory_logs_added_and_removed.item_id
      ) AS inventory_logs_added_and_removed_totals
      ON inventory_logs_added_and_removed_totals.item_id = items.id

      LEFT JOIN (
        SELECT *,
        batch_purchase_groups.id AS batch_purchase_group_id
        FROM batch_purchase_entries
        LEFT JOIN batch_purchase_groups ON batch_purchase_groups.id = batch_purchase_entries.batch_purchase_group_id
        WHERE batch_purchase_group_id = ${parseInt(
          currentBatchPurchaseGroupId || 0,
        )}
      ) AS current_batch_purchase_group_entries
      ON current_batch_purchase_group_entries.item_id = items.id

      LEFT JOIN categories ON categories.id = items.category_id    

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        purchaseEntries.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: purchaseEntries,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get purchase entries.');
  }
};

export const getBatchPurchaseEntries = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, currentBatchPurchaseGroupId}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  try {
    let additionalFilter = {};

    if (!currentBatchPurchaseGroupId) {
      throw new Error('Missing batch purchase group id param');
    }

    additionalFilter['batch_purchase_entries.batch_purchase_group_id'] =
      currentBatchPurchaseGroupId;

    let queryFilter = createQueryFilter(filter, additionalFilter);

    const db = await getDBConnection();
    const purchaseEntries = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT
      items.id AS id,
      items.id AS item_id,
      items.category_id AS item_category_id,
      items.name AS name,
      items.barcode AS barcode,
      items.uom_abbrev AS uom_abbrev,
      items.unit_cost AS unit_cost,
      items.uom_abbrev_per_piece AS uom_abbrev_per_piece,
      items.qty_per_piece AS qty_per_piece,
      items.initial_stock_qty AS initial_stock_qty,
      items.current_stock_qty AS current_stock_qty,
      items.low_stock_level AS low_stock_level,

      inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty,

      batch_purchase_entries.add_stock_qty AS add_stock_qty,
      batch_purchase_entries.add_stock_unit_cost AS add_stock_unit_cost,
      batch_purchase_entries.tax_id AS add_stock_tax_id,
      batch_purchase_entries.add_stock_unit_cost * batch_purchase_entries.add_stock_qty AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM items
      LEFT JOIN (
        SELECT inventory_logs_added_and_removed.item_id AS item_id,
        inventory_logs_added_and_removed.item_name AS item_name,
        inventory_logs_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost
        FROM (
          SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
          SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM inventory_logs
          LEFT JOIN items ON items.id = inventory_logs.item_id
          LEFT JOIN operations ON operations.id = inventory_logs.operation_id
          WHERE inventory_logs.voided != 1
          GROUP BY inventory_logs.item_id, operations.type
        ) AS inventory_logs_added_and_removed
        LEFT JOIN items ON items.id = inventory_logs_added_and_removed.item_id
        GROUP BY inventory_logs_added_and_removed.item_id
      ) AS inventory_logs_added_and_removed_totals
      ON inventory_logs_added_and_removed_totals.item_id = items.id

      INNER JOIN batch_purchase_entries ON batch_purchase_entries.item_id = items.id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        purchaseEntries.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: purchaseEntries,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get purchase entries.');
  }
};

export const getBatchPurchaseEntriesCount = async ({queryKey}) => {
  const [
    _key,
    {
      filter = {},
      autoFetchCurrentId = false,
      currentBatchPurchaseGroupId: currentBatchPurchaseGroupIdFromParam,
    },
  ] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  try {
    let currentBatchPurchaseGroupId = currentBatchPurchaseGroupIdFromParam;

    if (!currentBatchPurchaseGroupId && autoFetchCurrentId) {
      currentBatchPurchaseGroupId = await getCurrentBatchPurchaseGroupId();
    }

    if (!currentBatchPurchaseGroupId) {
      return 0;
    }

    queryFilterObj['batch_purchase_entries.batch_purchase_group_id'] =
      currentBatchPurchaseGroupId;

    if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
      for (let key in queryFilterObj) {
        if (queryFilterObj[key] === '') {
          delete queryFilterObj[key];
        } else {
          let value =
            typeof queryFilterObj[key] === 'string'
              ? `'${queryFilterObj[key]}'`
              : queryFilterObj[key];
          queryFilter = queryFilter
            ? (queryFilter += `AND ${key} = ${value} `)
            : `WHERE ${key} = ${value} `;
        }
      }
    }

    const db = await getDBConnection();
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM items
      INNER JOIN batch_purchase_entries ON batch_purchase_entries.item_id = items.id

      ${queryFilter}
    ;`;
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    return totalCount;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get purchase entries count.');
  }
};

export const getBatchPurchaseEntriesGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}, currentBatchPurchaseGroupId}] = queryKey;
  let queryFilter = '';

  try {
    if (!currentBatchPurchaseGroupId) {
      return 0;
    }

    queryFilter = createQueryFilter(filter, {
      'batch_purchase_entries.batch_purchase_group_id':
        currentBatchPurchaseGroupId,
    });

    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(batch_purchase_entries.add_stock_unit_cost * batch_purchase_entries.add_stock_qty)`;
    const query = `
      FROM items
      INNER JOIN batch_purchase_entries ON batch_purchase_entries.item_id = items.id

      ${queryFilter}
    ;`;
    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(batch_purchase_entries.add_stock_unit_cost * batch_purchase_entries.add_stock_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get purchase entries grand total.');
  }
};

export const createBatchPurchaseEntry = async ({values}) => {
  const createBatchPurchaseGroupQuery = `INSERT INTO batch_purchase_groups DEFAULT VALUES;`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unconfirmed Batch Purchase Group
    // before creating new one
    let currentBatchPurchaseGroupId = await AsyncStorage.getItem(
      'currentBatchPurchaseGroupId',
    );

    if (!currentBatchPurchaseGroupId) {
      // create new Batch Purchase Group
      const createBatchPurchaseGroupResult = await db.executeSql(
        createBatchPurchaseGroupQuery,
      );

      if (createBatchPurchaseGroupResult[0].rowsAffected > 0) {
        // Set created batch purchase group's id as current batch purchase group id
        await AsyncStorage.setItem(
          'currentBatchPurchaseGroupId',
          createBatchPurchaseGroupResult[0].insertId?.toString(),
        );

        currentBatchPurchaseGroupId =
          createBatchPurchaseGroupResult[0].insertId;
      } else {
        throw Error('Failed to create new batch purchase group');
      }
    }

    const getBatchPurchaseEntryQuery = `SELECT * FROM batch_purchase_entries WHERE item_id = ${values.item_id} AND batch_purchase_group_id = ${currentBatchPurchaseGroupId};`;
    const createBatchPurchaseEntryQuery = `INSERT INTO batch_purchase_entries (
      batch_purchase_group_id,
      item_id,
      tax_id,
      add_stock_qty,
      add_stock_unit_cost
    )
    
    VALUES(
      ${parseInt(currentBatchPurchaseGroupId)},
      ${parseInt(values.item_id)},
      ${parseInt(values.tax_id) || 'null'},
      ${parseFloat(values.add_stock_qty)},
      ${parseFloat(values.add_stock_unit_cost)}
    );`;

    const updateBatchPurchaseEntryQuery = `UPDATE batch_purchase_entries
      SET add_stock_qty = ${parseFloat(values.add_stock_qty)},
      add_stock_unit_cost = ${parseFloat(values.add_stock_unit_cost)},
      tax_id = ${parseInt(values.tax_id) || 'null'}
      WHERE item_id = ${parseInt(values.item_id)}
      AND batch_purchase_group_id = ${currentBatchPurchaseGroupId}
    `;

    const updateItemsDefaultTaxQuery = `
      UPDATE items
      SET tax_id = ${parseInt(values.tax_id) || 'null'}
      WHERE id = ${parseInt(values.item_id)}
    `;

    // check if there's an existing Batch Purchase Entry within the current Batch Purchase Group
    // before creating new one
    const getBatchPurchaseEntryResult = await db.executeSql(
      getBatchPurchaseEntryQuery,
    );
    let batchPurchaseEntry = getBatchPurchaseEntryResult[0].rows.item(0);

    if (!batchPurchaseEntry) {
      // avoid creating Batch Purchase Entry with 0 qty
      if (!parseFloat(values.add_stock_qty)) {
        batchPurchaseEntry = null;
        return batchPurchaseEntry;
      }

      // create new Batch Purchase Entry
      const createBatchPurchaseEntryResult = await db.executeSql(
        createBatchPurchaseEntryQuery,
      );
      batchPurchaseEntry = createBatchPurchaseEntryResult[0].rows.item(0);

      await db.executeSql(updateItemsDefaultTaxQuery);
    } else {
      // delete existing Batch Purchase Entry if the user wants to set the add_stock_qty to 0
      if (!parseFloat(values.add_stock_qty)) {
        const deleteBatchPurchaseEntryQuery = `
          DELETE FROM batch_purchase_entries
          WHERE id = ${parseInt(batchPurchaseEntry.id)}
        `;

        await db.executeSql(deleteBatchPurchaseEntryQuery);

        batchPurchaseEntry = null;
        return batchPurchaseEntry;
      }

      // update existing Batch Purchase Entry within the current Batch Purchase Group
      const updateBatchPurchaseEntryResult = await db.executeSql(
        updateBatchPurchaseEntryQuery,
      );
      batchPurchaseEntry = updateBatchPurchaseEntryResult[0].rows.item(0);

      await db.executeSql(updateItemsDefaultTaxQuery);
    }

    return batchPurchaseEntry;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create batch purchase entry.');
  }
};

// deprecated in favor of refactored getCurrentBatchPurchaseGroupId
// that will create a new batch purchase if there's nothing exists
export const hasCurrentBatchPurchaseGroup = async () => {
  try {
    const currentBatchPurchaseGroupId = await AsyncStorage.getItem(
      'currentBatchPurchaseGroupId',
    );

    if (!currentBatchPurchaseGroupId) {
      return false;
    }

    const db = await getDBConnection();

    // Validate batch purchase group
    const getBatchPurchaseGroupQuery = `
      SELECT * FROM batch_purchase_groups WHERE id = ${parseInt(
        currentBatchPurchaseGroupId,
      )}
    `;

    const getBatchPurchaseGroupResult = await db.executeSql(
      getBatchPurchaseGroupQuery,
    );
    const batchPurchaseGroup = getBatchPurchaseGroupResult[0].rows.item(0);

    if (!batchPurchaseGroup) {
      return false;
    }

    if (batchPurchaseGroup.confirmed) {
      // Delete current batch purchase group id if it was already confirmed
      await AsyncStorage.removeItem('currentBatchPurchaseGroupId');
      return false;
    } else {
      return true;
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed while checking current batch purchase group.');
  }
};

export const getCurrentBatchPurchaseGroupId = async () => {
  try {
    let batchPurchaseGroup = null;

    let currentBatchPurchaseGroupId = await AsyncStorage.getItem(
      'currentBatchPurchaseGroupId',
    );

    const db = await getDBConnection();

    if (currentBatchPurchaseGroupId) {
      // Validate batch purchase group id
      const getBatchPurchaseGroupQuery = `
      SELECT * FROM batch_purchase_groups WHERE id = ${parseInt(
        currentBatchPurchaseGroupId,
      )}
    `;

      const getBatchPurchaseGroupResult = await db.executeSql(
        getBatchPurchaseGroupQuery,
      );

      batchPurchaseGroup = getBatchPurchaseGroupResult[0].rows.item(0);
    }

    if (
      !currentBatchPurchaseGroupId ||
      (currentBatchPurchaseGroupId && !batchPurchaseGroup) ||
      (batchPurchaseGroup && batchPurchaseGroup.confirmed === 1)
    ) {
      if (
        (currentBatchPurchaseGroupId && !batchPurchaseGroup) ||
        (batchPurchaseGroup && batchPurchaseGroup.confirmed === 1)
      ) {
        // Delete current batch purchase group id if it was already confirmed or not found
        await AsyncStorage.removeItem('currentBatchPurchaseGroupId');
      }

      // Get the latest unconfirmed Batch Purchase Group
      const getLatestUnconfirmedBatchPurchaseGroupQuery = `
        SELECT * FROM batch_purchase_groups WHERE confirmed = 0 OR confirmed IS NULL OR confirmed = '' ORDER BY date_created DESC LIMIT 1
      `;

      const getLatestUnconfirmedBatchPurchaseGroupResult = await db.executeSql(
        getLatestUnconfirmedBatchPurchaseGroupQuery,
      );
      const latestUnconfirmedBatchPurchaseGroup =
        getLatestUnconfirmedBatchPurchaseGroupResult[0].rows.item(0);

      if (latestUnconfirmedBatchPurchaseGroup) {
        // Set the latest unconfirmed batch purchase group's id as current batch purchase group id
        await AsyncStorage.setItem(
          'currentBatchPurchaseGroupId',
          latestUnconfirmedBatchPurchaseGroup.id?.toString(),
        );

        return latestUnconfirmedBatchPurchaseGroup.id;
      } else {
        // create new Batch Purchase Group
        const createBatchPurchaseGroupQuery = `
          INSERT INTO batch_purchase_groups (
            confirmed
          )

          VALUES (
            0
          );
        `;
        const createBatchPurchaseGroupResult = await db.executeSql(
          createBatchPurchaseGroupQuery,
        );

        if (createBatchPurchaseGroupResult[0].rowsAffected > 0) {
          // Set created batch purchase group's id as current batch purchase group id
          await AsyncStorage.setItem(
            'currentBatchPurchaseGroupId',
            createBatchPurchaseGroupResult[0].insertId?.toString(),
          );

          return createBatchPurchaseGroupResult[0].insertId;
        } else {
          throw Error('Failed to create new batch purchase group');
        }
      }
    }

    return batchPurchaseGroup.id;
  } catch (error) {
    console.debug(error);
    throw Error('Failed fetching current batch purchase group id.');
  }
};

export const confirmBatchPurchaseEntries = async ({
  purchaseDate,
  currentBatchPurchaseGroupId,
  values,
  actions,
  onLimitReached,
  onSuccess,
}) => {
  const dateConfirmed = purchaseDate
    ? `datetime('${purchaseDate}')`
    : `datetime('now')`;

  try {
    const db = await getDBConnection();

    if (await isMutationDisabled()) {
      onLimitReached &&
        onLimitReached({
          message: `Your items are now in Read-Only Mode and you can no longer insert your new purchases`,
        });
      console.debug('Failed to add/remove stock, mutation is disabled.');

      return;
    }

    let vendor = {
      id: null,
      vendor_display_name: '',
    };

    /**
     * Validate vendor id
     */
    if (values.vendor_id) {
      const getVendorQuery = `
      SELECT * FROM vendors WHERE id = ${parseInt(values.vendor_id)}
      
    `;

      const getVendorResult = await db.executeSql(getVendorQuery);
      const fetchedVendor = getVendorResult[0].rows.item(0);

      if (!fetchedVendor) {
        /**
         * We have an option to throw an error or just return.
         * Only throw an error if we want to restrict user from selecting
         * a deleted vendor during the confirm purchases screen is rendered.
         */

        actions?.setFieldValue('vendor_id', '');
        throw new Error('Failed to confirm batch purchases. Vendor not found.');
      } else {
        vendor = fetchedVendor;
      }
    } else {
      actions?.setFieldValue('vendor_id', '');
      throw new Error('Failed to confirm batch purchases. Vendor not found.');
    }

    const vendorId = vendor.id ? parseInt(vendor.id) : 'null';
    const vendorDisplayName = vendor.vendor_display_name
      ? `'${vendor.vendor_display_name}'`
      : 'null';
    const officialReceiptNumber = values.official_receipt_number
      ? `'${values.official_receipt_number}'`
      : 'null';

    if (!currentBatchPurchaseGroupId) {
      throw Error(
        'Missing batch purchase group id param on confirm batch purchase query.',
      );
    }

    const batchPurchaseEntries = [];

    // get all batch purchase entries
    const getAllCurrentBatchPurchaseEntriesQuery = `
      SELECT *,
      items.id AS id,
      taxes.id AS item_tax_id,
      taxes.name AS item_tax_name,
      taxes.rate_percentage AS item_tax_rate_percentage
      FROM batch_purchase_entries
      INNER JOIN items ON items.id = batch_purchase_entries.item_id
      LEFT JOIN taxes ON taxes.id = batch_purchase_entries.tax_id
      WHERE batch_purchase_group_id = ${currentBatchPurchaseGroupId};
    `;

    const getAllCurrentBatchPurchaseEntriesResults = await db.executeSql(
      getAllCurrentBatchPurchaseEntriesQuery,
    );

    // insert each batch purchase entries to Inventory logs
    let insertInventoryLogsQuery = `
      INSERT INTO inventory_logs (
        operation_id,
        item_id,
        ref_tax_id,
        ref_vendor_id,
        vendor_display_name,
        official_receipt_number,
        adjustment_unit_cost,
        adjustment_unit_cost_net,
        adjustment_unit_cost_tax,
        adjustment_tax_rate_percentage,
        adjustment_tax_name,
        adjustment_qty,
        adjustment_date,
        batch_purchase_group_id
      )
      
      VALUES
    `;

    let tmpValues = `VALUES `;

    getAllCurrentBatchPurchaseEntriesResults.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let batchPurchaseEntry = result.rows.item(index);
        batchPurchaseEntries.push(batchPurchaseEntry);

        const unitCost = parseFloat(
          batchPurchaseEntry.add_stock_unit_cost || 0,
        );
        const qty = parseFloat(batchPurchaseEntry.add_stock_qty || 0);
        const taxRatePercentage = parseFloat(
          batchPurchaseEntry.item_tax_rate_percentage || 0,
        );

        const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
        const unitCostTax = unitCost - unitCostNet;

        const taxId = batchPurchaseEntry.item_tax_id
          ? `${parseInt(batchPurchaseEntry.item_tax_id)}`
          : 'null';
        const taxName = batchPurchaseEntry.item_tax_name
          ? `'${batchPurchaseEntry.item_tax_name}'`
          : 'null';

        // operation_id 2 is equal to New Purchase Entry
        insertInventoryLogsQuery += `(
          2,
          ${batchPurchaseEntry.item_id},
          ${taxId},
          ${vendorId},
          ${vendorDisplayName},
          ${officialReceiptNumber},
          ${unitCost},
          ${unitCostNet},
          ${unitCostTax},
          ${taxRatePercentage},
          ${taxName},
          ${qty},
          ${dateConfirmed},
          ${parseInt(currentBatchPurchaseGroupId)}
        )`;

        if (result.rows.length - 1 !== index) {
          insertInventoryLogsQuery += `,
            `;
        } else {
          insertInventoryLogsQuery += ';';
        }

        // tmp values
        tmpValues += `(
          ${batchPurchaseEntry.item_id},
          ${unitCost}
        )`;

        if (result.rows.length - 1 !== index) {
          tmpValues += `,
            `;
        }
      }
    });

    await db.executeSql(insertInventoryLogsQuery);

    // update each item's last unit cost
    const updateItemsLastUnitCostQuery = `
      WITH tmp(item_id, last_unit_cost) AS (${tmpValues})

      UPDATE items SET unit_cost = (SELECT last_unit_cost FROM tmp WHERE items.id = tmp.item_id)

      WHERE id IN (SELECT item_id FROM tmp)
    `;

    const updateItemsCurrentStockResult = await db.executeSql(
      updateItemsLastUnitCostQuery,
    );

    // delete each batch purchase entries
    const deleteBatchPurchaseEntriesQuery = `DELETE FROM batch_purchase_entries
      WHERE batch_purchase_group_id = ${parseInt(currentBatchPurchaseGroupId)}
    ;`;
    const deleteBatchPurchaseEntriesResult = await db.executeSql(
      deleteBatchPurchaseEntriesQuery,
    );

    if (deleteBatchPurchaseEntriesResult[0].rowsAffected === 0) {
      throw Error('Failed to delete batch purchase entries');
    }

    // update current Batch Purchase Group
    const updateBatchPurchaseGroupQuery = `UPDATE batch_purchase_groups
      SET confirmed = 1,
      date_confirmed = ${dateConfirmed}
      WHERE id = ${parseInt(currentBatchPurchaseGroupId)}
    `;

    const updateBatchPurchaseGroupResult = await db.executeSql(
      updateBatchPurchaseGroupQuery,
    );

    if (updateBatchPurchaseGroupResult[0].rowsAffected === 0) {
      throw Error(
        'Failed to confirm batch purchase entries while updating current batch purchase group',
      );
    }

    // remove current Batch Purchase Group ID from storage
    await AsyncStorage.removeItem('currentBatchPurchaseGroupId');

    onSuccess && onSuccess();

    return {
      batchPurchaseGroupId: currentBatchPurchaseGroupId,
      batchPurchaseEntries,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to confirm batch purchase entries.');
  }
};

export const getBatchPurchaseGroups = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'date_confirmed';
  let queryFilter = '';

  if (filter && Object.keys(filter).length > 0) {
    for (let key in filter) {
      if (filter[key] === '') {
        delete filter[key];
      }

      let value = '';
      let dateFilter = '';

      if (typeof filter[key] === 'string') {
        value = `'${filter[key]}'`;
      } else if (
        key === '__dateFilter' &&
        typeof filter[key] === 'object' &&
        Object.keys(filter[key]).length > 0
      ) {
        /**
         * Expecting object shapes:
         *
         * __dateFilter: {
         *    isDateRange: true,
         *    startDate: '2022-07-10',
         *    endDate: '09-08-22',
         *    dateFieldName: 'date_confirmed'
         * }
         */
        if (filter[key].isDateRange) {
          dateFilter = ` ${filter[key].dateFieldName} BETWEEN date('${filter[key].startDate}' AND date('${filter[key].endDate}') `;
        } else {
          /**
           * Expecting object shapes:
           *
           * __dateFilter: {
           *    isDateRange: false,
           *    date: '2022-09-08',
           *    dateFieldName: 'date_confirmed'
           * }
           */
          dateFilter = `${filter[key].dateFieldName} = date('${filter[key].date}')`;
        }
      } else {
        value = filter[key];
      }

      let expression = `${key} = ${value} `;

      if (filter[key].isDateFilter) {
        expression = dateFilter;
      }

      if (queryFilter) {
        queryFilter = queryFilter += `AND  ${expression} `;
      } else {
        queryFilter = `WHERE ${expression} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const batchPurchaseGroups = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT
      batch_purchase_groups.id,
      date_created,
      date_confirmed,
      SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM batch_purchase_groups
      INNER JOIN inventory_logs ON inventory_logs.batch_purchase_group_id = batch_purchase_groups.id

      GROUP BY batch_purchase_groups.id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        batchPurchaseGroups.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: batchPurchaseGroups,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch purchases.');
  }
};

export const getBatchPurchaseGroupGrandTotal = async ({queryKey}) => {
  const [_key, {filter = {}, id}] = queryKey;
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (!id) return 0;

  queryFilterObj['batch_purchase_groups.id'] = id;

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const countAllQuery = `SELECT SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty)`;
    const query = `
      FROM batch_purchase_groups
      INNER JOIN inventory_logs ON inventory_logs.batch_purchase_group_id = batch_purchase_groups.id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(countAllQuery + query);
    const grandTotal =
      result[0].rows.raw()[0][
        'SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty)'
      ];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch purchases.');
  }
};

export const getBatchPurchaseGroup = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM batch_purchase_groups WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch batch purchase group.');
  }
};

export const getBatchPurchaseGroupItems = async ({queryKey, pageParam = 1}) => {
  const [_key, {batchPurchaseGroupId, filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

  queryFilterObj['batch_purchase_group_id'] = batchPurchaseGroupId;

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `'${queryFilterObj[key]}'`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();
    const batchPurchaseGroupItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      inventory_logs.adjustment_unit_cost AS add_stock_unit_cost,
      inventory_logs.adjustment_qty AS add_stock_qty,
      inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty AS total_cost
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM inventory_logs
      INNER JOIN items ON items.id = inventory_logs.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        batchPurchaseGroupItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: batchPurchaseGroupItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get batch purchase group items.');
  }
};

/**
 * TODO: Implement this code and deprecate deleteAllBatchPurchaseGroupsAndEntries
 */
export const deleteUnconfirmedBatchPurchaseGroupsAndEntries = async () => {
  try {
    const db = await getDBConnection();

    let currentBatchPurchaseGroupId = 0;

    // Get the current existing unconfirmed Batch Purchase Group
    const currentBatchPurchaseGroupIdStringValue = await AsyncStorage.getItem(
      'currentBatchPurchaseGroupId',
    );

    currentBatchPurchaseGroupId = parseInt(
      currentBatchPurchaseGroupIdStringValue || 0,
    );

    /**
     * Get all unconfirmed batch purchase groups
     */
    const getAllUnconfirmedBatchPurchaseGroupsQuery = `
      SELECT * FROM batch_purchase_groups WHERE confirmed != 1
    `;

    let unconfirmedBatchPurchaseGroupIds = [];

    const getAllUnconfirmedBatchPurchaseGroupsRresult = await db.executeSql(
      getAllUnconfirmedBatchPurchaseGroupsQuery,
    );

    getAllUnconfirmedBatchPurchaseGroupsRresult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let batchPurchaseGroup = result.rows.item(index);
        unconfirmedBatchPurchaseGroupIds.push(batchPurchaseGroup?.id);
      }
    });

    if (!unconfirmedBatchPurchaseGroupIds.length > 0) return;

    const deleteUnconfirmedBatchPurchaseEntries = `DELETE FROM batch_purchase_entries WHERE batch_purchase_group_id IN (${unconfirmedBatchPurchaseGroupIds
      ?.map(value => `${value}`)
      ?.join(
        ', ',
      )}) AND batch_purchase_group_id != ${currentBatchPurchaseGroupId}`;

    await db.executeSql(deleteUnconfirmedBatchPurchaseEntries);

    const deleteUnconfirmedBatchPurchaseGroups = `DELETE FROM batch_purchase_groups WHERE id IN (${unconfirmedBatchPurchaseGroupIds
      ?.map(value => `${value}`)
      ?.join(', ')}) AND id != ${currentBatchPurchaseGroupId}`;

    await db.executeSql(deleteUnconfirmedBatchPurchaseGroups);
  } catch (error) {
    console.debug(error);
  }
};

// deprecated. Do not call it anymore from version 1.1.65 and higher
export const deleteAllBatchPurchaseGroupsAndEntries = async () => {
  const deleteBatchPurchaseGroups = `DELETE FROM batch_purchase_groups`;
  const deleteBatchPurchaseEntries = `DELETE FROM batch_purchase_entries`;

  try {
    const db = await getDBConnection();
    await db.executeSql(deleteBatchPurchaseGroups);
    await db.executeSql(deleteBatchPurchaseEntries);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete batch purchase groups and entries.');
  }
};
