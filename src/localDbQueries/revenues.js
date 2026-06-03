import uuid from 'react-native-uuid';
import getAppConfig from '../constants/appConfig';
import {getDBConnection, getCloudSyncParams} from '../localDb';
import {isInsertLimitReached} from '../utils/localDbQueryHelpers';
import {scheduleSyncSoon} from '../services/syncService';

/**
 * A revenue group's monthly revenue is now computed as:
 *
 *   (net, VAT-exclusive internal POS sales for the group's categories in the month)
 * + (sum of that group's manual/external per-source NET amounts in the month)
 *
 * This replaces the legacy `SUM(revenues.amount)` everywhere the revenue-group
 * monthly total is needed (group lists, grand totals, item/category cost
 * percentage, reports). The builders below are the single source of truth so the
 * formula can never drift between call sites.
 *
 * `groupIdSql` and `dateSql` are RAW SQL fragments supplied by the caller, e.g.
 *   groupIdSql: `'revenue_groups.id'` (correlated) or `"'${revenueGroupId}'"` (literal)
 *   dateSql:    `"'${dateFilter}'"` or `"datetime('now', 'localtime')"`
 */

// Net (VAT-exclusive) internal sales for a group's categories in a month.
// Excludes voided and refunded sale logs. (Gross uses sale_unit_selling_price;
// this feature deliberately uses the net column.)
export const buildRevenueGroupMonthSalesSql = ({groupIdSql, dateSql}) => `
  (SELECT IFNULL(SUM(sl.sale_unit_selling_price_net * sl.sale_qty), 0)
   FROM active_sale_logs sl
   JOIN active_items it ON it.id = sl.item_id
   JOIN active_revenue_categories rc ON rc.category_id = it.category_id
   WHERE rc.revenue_group_id = ${groupIdSql}
     AND IFNULL(sl.voided, 0) = 0
     AND IFNULL(sl.is_refunded, 0) = 0
     AND strftime('%m %Y', sl.sale_date) = strftime('%m %Y', ${dateSql}))`;

// Sum of the group's manual/external (per-source) amounts in a month.
export const buildRevenueGroupMonthExternalSql = ({groupIdSql, dateSql}) => `
  (SELECT IFNULL(SUM(rv.amount), 0)
   FROM active_revenues rv
   WHERE rv.revenue_group_id = ${groupIdSql}
     AND strftime('%m %Y', rv.revenue_group_date) = strftime('%m %Y', ${dateSql}))`;

// Total revenue for a group in a month = internal sales + external amounts.
export const buildRevenueGroupMonthTotalSql = args =>
  `(${buildRevenueGroupMonthSalesSql(args)} + ${buildRevenueGroupMonthExternalSql(
    args,
  )})`;

export const getRevenueGroups = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, dateFilter, limit = 1000000000}] = queryKey;
  const orderBy = '';
  let queryFilterObj = {...filter};
  let queryFilter = '';

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
    const revenueGroups = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const dateSql = `'${dateFilter}'`;
    const groupIdSql = 'revenue_groups.id';
    const salesSql = buildRevenueGroupMonthSalesSql({groupIdSql, dateSql});
    const externalSql = buildRevenueGroupMonthExternalSql({groupIdSql, dateSql});
    const totalSql = buildRevenueGroupMonthTotalSql({groupIdSql, dateSql});

    // Per group: internal POS sales, external/manual amounts, and their total
    // (which is also the cost-percentage denominator). `amount` is kept as an
    // alias of the total for backward compatibility with older list rendering.
    const selectQuery = `
      SELECT *,
      revenue_groups.id AS id,
      ${salesSql} AS sales_total,
      ${externalSql} AS external_total,
      ${totalSql} AS total_amount,
      ${totalSql} AS amount
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_revenue_groups revenue_groups

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        revenueGroups.push(result.rows.item(index));
      }
    });

    // Each group's share of the (page's) grand total. Computed in JS to avoid a
    // nested grand-total subquery per row.
    const grandTotal = revenueGroups.reduce(
      (sum, group) => sum + (group.total_amount || 0),
      0,
    );
    revenueGroups.forEach(group => {
      group.selected_month_grand_total_amount = grandTotal;
      group.percentage =
        grandTotal > 0 ? ((group.total_amount || 0) / grandTotal) * 100 : 0;
    });

    return {
      page: pageParam,
      result: revenueGroups,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get revenue groups.');
  }
};

export const getRevenueGroupsGrandTotal = async ({queryKey}) => {
  const [_key, {dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const grandTotalSql = buildRevenueGroupMonthTotalSql({
      groupIdSql: 'revenue_groups.id',
      dateSql: `'${dateFilter}'`,
    });
    const query = `
      SELECT IFNULL(SUM(${grandTotalSql}), 0) AS revenue_groups_grand_total
      FROM active_revenue_groups revenue_groups`;

    const result = await db.executeSql(query);
    const grandTotal = result[0].rows.raw()[0]['revenue_groups_grand_total'];

    return grandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get revenue groups grand total.');
  }
};

export const getRevenueGroupsTotals = async ({queryKey}) => {
  const [_key, {dateFilter}] = queryKey;

  try {
    const db = await getDBConnection();
    const getRevenueGroupsGrandTotalAmountQuery = `
      SELECT IFNULL(SUM(${buildRevenueGroupMonthTotalSql({
        groupIdSql: 'revenue_groups.id',
        dateSql: `'${dateFilter}'`,
      })}), 0) AS revenue_groups_grand_total
      FROM active_revenue_groups revenue_groups
    `;

    const getRevenueGroupGrandTotalAmountResult = await db.executeSql(
      getRevenueGroupsGrandTotalAmountQuery,
    );
    const grandTotal =
      getRevenueGroupGrandTotalAmountResult[0].rows.raw()[0][
        'revenue_groups_grand_total'
      ] || 0;

    return {
      totals: {
        grandTotal,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get revenue groups grand total.');
  }
};

export const createRevenueGroup = async ({
  values,
  onInsertLimitReached,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('revenue_groups', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} revenue groups`,
        });
      console.debug('Failed to create revenue group, insert limit reached.');

      return;
    }

    if (!values?.category_ids?.length > 0) {
      throw Error(
        'Revenue group must have at least one category from inventory',
      );
    }

    /**
     * Validate revenue group name
     */
    if (!values.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Revenue group name is required',
        });
      throw Error('Revenue group name is required');
    }

    const getRevenueGroupByNameQuery = `
      SELECT * FROM active_revenue_groups revenue_groups WHERE name = '${values.name.replace(
        /\'/g,
        "''",
      )}';
    `;

    const getRevenueGroupByNameResult = await db.executeSql(
      getRevenueGroupByNameQuery,
    );
    const fetchedRevenueGroupByName =
      getRevenueGroupByNameResult[0].rows.item(0);

    if (fetchedRevenueGroupByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedRevenueGroupByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedRevenueGroupByName.name}" already exists. Please specify a different name.`,
      );
    }

    /**
     * Insert Revenue group
     */
    const {deviceId, branchId} = await getCloudSyncParams();
    const revenueGroupId = uuid.v4();
    const createRevenueGroupQuery = `INSERT INTO revenue_groups (
      id,
      name,
      device_id,
      branch_id,
      sync_id,
      updated_at
    )

    VALUES(
      '${revenueGroupId}',
      '${values.name.replace(/\'/g, "''")}',
      ${deviceId ? `'${deviceId}'` : 'NULL'},
      ${branchId ? `'${branchId}'` : 'NULL'},
      '${revenueGroupId}',
      CURRENT_TIMESTAMP
    );`;

    const createRevenueGroupResult = await db.executeSql(
      createRevenueGroupQuery,
    );

    if (createRevenueGroupResult[0].rowsAffected === 0) {
      throw Error('Failed to create new revenue group');
    }

    // insert each category ids to revenue_categories table
    let insertRevenueCategoriesQuery = `
      INSERT INTO revenue_categories (
        id,
        revenue_group_id,
        category_id,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
    `;

    values.category_ids.forEach((categoryId, index) => {
      const newRevenueCategoryId = uuid.v4();
      insertRevenueCategoriesQuery += `(
          '${newRevenueCategoryId}',
          '${revenueGroupId}',
          '${categoryId}',
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newRevenueCategoryId}',
          CURRENT_TIMESTAMP
        )`;

      if (values.category_ids.length - 1 !== index) {
        insertRevenueCategoriesQuery += `,
            `;
      } else {
        insertRevenueCategoriesQuery += ';';
      }
    });

    await db.executeSql(insertRevenueCategoriesQuery);
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create revenue group.');
  }
};

export const updateRevenueGroup = async ({
  id,
  updatedValues,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();

    if (!updatedValues?.category_ids?.length > 0) {
      throw Error(
        'Revenue group must have at least one category from inventory',
      );
    }

    /**
     * Validate revenue group name
     */
    if (!updatedValues.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Revenue group name is required',
        });
      throw Error('Revenue group name is required');
    }

    const getRevenueGroupByNameQuery = `
      SELECT * FROM active_revenue_groups revenue_groups WHERE name = '${updatedValues.name.replace(
        /\'/g,
        "''",
      )}' AND id != '${id}';
    `;

    const getRevenueGroupByNameResult = await db.executeSql(
      getRevenueGroupByNameQuery,
    );
    const fetchedRevenueGroupByName =
      getRevenueGroupByNameResult[0].rows.item(0);

    if (fetchedRevenueGroupByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedRevenueGroupByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedRevenueGroupByName.name}" already exists. Please specify a different name.`,
      );
    }

    /**
     * Update Revenue group
     */

    const updateRevenueGroupQuery = `UPDATE revenue_groups
      SET name = '${updatedValues.name.replace(/\'/g, "''")}',
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${id}'
    `;

    const updateRevenueGroupResult = await db.executeSql(
      updateRevenueGroupQuery,
    );

    if (updateRevenueGroupResult[0].rowsAffected === 0) {
      throw Error('Failed to update expense.');
    }

    const deleteExistingRevenueCategoriesQuery = `
      UPDATE revenue_categories SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE revenue_group_id = '${id}';
    `;

    await db.executeSql(deleteExistingRevenueCategoriesQuery);

    const {deviceId, branchId} = await getCloudSyncParams();
    // insert each new categories to revenue_categories table
    let insertRevenueCategoriesQuery = `
      INSERT INTO revenue_categories (
        id,
        revenue_group_id,
        category_id,
        device_id,
        branch_id,
        sync_id,
        updated_at
      )

      VALUES
      `;

    updatedValues.category_ids.forEach((categoryId, index) => {
      const newRevenueCategoryId = uuid.v4();
      insertRevenueCategoriesQuery += `(
        '${newRevenueCategoryId}',
        '${id}',
        '${categoryId}',
        ${deviceId ? `'${deviceId}'` : 'NULL'},
        ${branchId ? `'${branchId}'` : 'NULL'},
        '${newRevenueCategoryId}',
        CURRENT_TIMESTAMP
      )`;

      if (updatedValues.category_ids.length - 1 !== index) {
        insertRevenueCategoriesQuery += `,
      `;
      } else {
        insertRevenueCategoriesQuery += ';';
      }
    });

    await db.executeSql(insertRevenueCategoriesQuery);
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update revenue group.');
  }
};

export const deleteRevenueGroup = async ({id}) => {
  const deleteRevenueGroupQuery = `UPDATE revenue_groups SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;
  const deleteRevenuesQuery = `UPDATE revenues SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE revenue_group_id = '${id}'`;

  try {
    const db = await getDBConnection();

    const deleteRevenueGroupResult = await db.executeSql(
      deleteRevenueGroupQuery,
    );

    if (deleteRevenueGroupResult[0].rowsAffected > 0) {
      await db.executeSql(deleteRevenuesQuery);
    }
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete revenue groups.');
  }
};

export const createRevenue = async ({values}) => {
  try {
    const db = await getDBConnection();

    if (!values?.revenue_source_id) {
      throw Error('An external revenue source is required.');
    }

    // Upsert keyed by (revenue group, month, source): one amount per source per
    // group per month. Multiple sources can be added to the same group/month.
    const getCurrentMonthRevenueQuery = `
      SELECT * FROM active_revenues revenues
      WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${values.revenue_group_date}')
      AND revenue_group_id = '${values.revenue_group_id}'
      AND revenue_source_id = '${values.revenue_source_id}'
    `;

    const {deviceId: revenueDeviceId, branchId: revenueBranchId} =
      await getCloudSyncParams();
    const newRevenueId = uuid.v4();
    const createRevenueQuery = `INSERT INTO revenues (
    id,
    revenue_group_id,
    revenue_source_id,
    revenue_group_date,
    amount,
    device_id,
    branch_id,
    sync_id,
    updated_at
  )

  VALUES(
    '${newRevenueId}',
    '${values.revenue_group_id}',
    '${values.revenue_source_id}',
    '${values.revenue_group_date}',
    ${values.amount},
    ${revenueDeviceId ? `'${revenueDeviceId}'` : 'NULL'},
    ${revenueBranchId ? `'${revenueBranchId}'` : 'NULL'},
    '${newRevenueId}',
    CURRENT_TIMESTAMP
  );`;

    // check if there's an existing revenue for this source within the month
    let currentMonthRevenue = null;

    const getCurrentMonthRevenueResult = await db.executeSql(
      getCurrentMonthRevenueQuery,
    );
    currentMonthRevenue = getCurrentMonthRevenueResult[0].rows.item(0);

    // create new revenue
    if (!currentMonthRevenue) {
      await db.executeSql(createRevenueQuery);
      scheduleSyncSoon();
      return;
    }

    // update current month revenue for this source
    const updateCurrentMonthRevenueQuery = `
      UPDATE revenues
      SET amount = ${values.amount},
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${currentMonthRevenue.id}'
    `;

    await db.executeSql(updateCurrentMonthRevenueQuery);
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create revenue.');
  }
};

/**
 * Per-source external revenue rows for a revenue group in a given month,
 * joined to the source name. Used by the accordion breakdown. Rows with a NULL
 * or soft-deleted source (legacy unnamed external amounts) still appear, with a
 * NULL `revenue_source_name`.
 */
export const getRevenueEntries = async ({queryKey}) => {
  const [_key, {revenueGroupId, dateFilter}] = queryKey;
  const query = `
    SELECT revenues.*,
    revenue_sources.name AS revenue_source_name
    FROM active_revenues revenues
    LEFT JOIN active_revenue_sources revenue_sources
      ON revenue_sources.id = revenues.revenue_source_id
    WHERE revenues.revenue_group_id = '${revenueGroupId}'
    AND strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')
    ORDER BY revenue_sources.name ASC
  `;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    const entries = [];
    for (let index = 0; index < result[0].rows.length; index++) {
      entries.push(result[0].rows.item(index));
    }

    return {result: entries};
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch revenue entries.');
  }
};

export const getRevenue = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM active_revenues revenues WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch recipe kind.');
  }
};

export const updateRevenue = async ({id, updatedValues}) => {
  const query = `UPDATE revenues
  SET amount = ${updatedValues.amount},
  updated_at = CURRENT_TIMESTAMP
  WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update revenue.');
  }
};

export const deleteRevenue = async ({id}) => {
  const query = `UPDATE revenues SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);
    scheduleSyncSoon();
    return result;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete revenues.');
  }
};

export const getRevenueCategoryIds = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getRevenueCategoryIdsQuery = `
    SELECT *
    FROM active_revenue_categories revenue_categories
    WHERE revenue_group_id = '${id}'
  `;

  try {
    const db = await getDBConnection();
    let revenueCategoryIds = [];
    const results = await db.executeSql(getRevenueCategoryIdsQuery);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        revenueCategoryIds.push(result.rows.item(index)?.category_id);
      }
    });

    return {
      result: revenueCategoryIds,
    };
  } catch (error) {
    console.debug(error);
    throw Error(`Failed to fetch revenue category ID's.`);
  }
};

export const getRevenueCategoryNames = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getRevenueCategoryNamesQuery = `
    SELECT *
    FROM active_revenue_categories revenue_categories
    JOIN active_categories categories ON categories.id = revenue_categories.category_id
    WHERE revenue_group_id = '${id}'
  `;

  try {
    const db = await getDBConnection();
    let revenueCategoryNames = [];
    const results = await db.executeSql(getRevenueCategoryNamesQuery);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        revenueCategoryNames.push(result.rows.item(index)?.name);
      }
    });

    return {
      result: revenueCategoryNames,
    };
  } catch (error) {
    console.debug(error);
    throw Error(`Failed to fetch revenue category names.`);
  }
};

/**
 * Reusable external POS / revenue sources (e.g. "External POS1", "Portable
 * Terminal"). Managed once and reused across revenue groups and months. Returns
 * an infinite-query-compatible shape so the same query feeds both the manage
 * list and the source picker.
 */
export const getRevenueSources = async ({queryKey, pageParam = 1}) => {
  const [_key, {limit = 1000000000} = {}] = queryKey;

  try {
    const db = await getDBConnection();
    const revenueSources = [];
    const offset = (pageParam - 1) * limit;
    const selectQuery = `SELECT * `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM active_revenue_sources revenue_sources
      ORDER BY name ASC
      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        revenueSources.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: revenueSources,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get revenue sources.');
  }
};

export const createRevenueSource = async ({
  values,
  onInsertLimitReached,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const insertLimit = appConfig?.insertLimit;

    if (
      insertLimit > 0 &&
      (await isInsertLimitReached('revenue_sources', insertLimit))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit,
          message: `You can only create up to ${insertLimit} revenue sources`,
        });
      console.debug('Failed to create revenue source, insert limit reached.');

      return;
    }

    if (!values.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Revenue source name is required',
        });
      throw Error('Revenue source name is required');
    }

    const getRevenueSourceByNameQuery = `
      SELECT * FROM active_revenue_sources revenue_sources WHERE name = '${values.name.replace(
        /\'/g,
        "''",
      )}';
    `;

    const getRevenueSourceByNameResult = await db.executeSql(
      getRevenueSourceByNameQuery,
    );
    const fetchedRevenueSourceByName =
      getRevenueSourceByNameResult[0].rows.item(0);

    if (fetchedRevenueSourceByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedRevenueSourceByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedRevenueSourceByName.name}" already exists. Please specify a different name.`,
      );
    }

    const {deviceId, branchId} = await getCloudSyncParams();
    const revenueSourceId = uuid.v4();
    const createRevenueSourceQuery = `INSERT INTO revenue_sources (
      id,
      name,
      device_id,
      branch_id,
      sync_id,
      updated_at
    )

    VALUES(
      '${revenueSourceId}',
      '${values.name.replace(/\'/g, "''")}',
      ${deviceId ? `'${deviceId}'` : 'NULL'},
      ${branchId ? `'${branchId}'` : 'NULL'},
      '${revenueSourceId}',
      CURRENT_TIMESTAMP
    );`;

    const createRevenueSourceResult = await db.executeSql(
      createRevenueSourceQuery,
    );

    if (createRevenueSourceResult[0].rowsAffected === 0) {
      throw Error('Failed to create new revenue source');
    }

    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create revenue source.');
  }
};

export const updateRevenueSource = async ({
  id,
  updatedValues,
  onFormValidationError,
}) => {
  try {
    const db = await getDBConnection();

    if (!updatedValues.name) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: 'Revenue source name is required',
        });
      throw Error('Revenue source name is required');
    }

    const getRevenueSourceByNameQuery = `
      SELECT * FROM active_revenue_sources revenue_sources WHERE name = '${updatedValues.name.replace(
        /\'/g,
        "''",
      )}' AND id != '${id}';
    `;

    const getRevenueSourceByNameResult = await db.executeSql(
      getRevenueSourceByNameQuery,
    );
    const fetchedRevenueSourceByName =
      getRevenueSourceByNameResult[0].rows.item(0);

    if (fetchedRevenueSourceByName) {
      onFormValidationError &&
        onFormValidationError({
          fieldName: 'name',
          errorMessage: `The name "${fetchedRevenueSourceByName.name}" already exists. Please specify a different name.`,
        });
      throw Error(
        `The name "${fetchedRevenueSourceByName.name}" already exists. Please specify a different name.`,
      );
    }

    const updateRevenueSourceQuery = `UPDATE revenue_sources
      SET name = '${updatedValues.name.replace(/\'/g, "''")}',
      updated_at = CURRENT_TIMESTAMP
      WHERE id = '${id}'
    `;

    const updateRevenueSourceResult = await db.executeSql(
      updateRevenueSourceQuery,
    );

    if (updateRevenueSourceResult[0].rowsAffected === 0) {
      throw Error('Failed to update revenue source.');
    }

    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update revenue source.');
  }
};

export const deleteRevenueSource = async ({id}) => {
  const deleteRevenueSourceQuery = `UPDATE revenue_sources SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE id = '${id}'`;
  // Soft-delete the per-source amounts captured against this source too.
  const deleteRevenuesQuery = `UPDATE revenues SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP WHERE revenue_source_id = '${id}'`;

  try {
    const db = await getDBConnection();

    const deleteRevenueSourceResult = await db.executeSql(
      deleteRevenueSourceQuery,
    );

    if (deleteRevenueSourceResult[0].rowsAffected > 0) {
      await db.executeSql(deleteRevenuesQuery);
    }
    scheduleSyncSoon();
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete revenue source.');
  }
};
