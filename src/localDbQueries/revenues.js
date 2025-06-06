import getAppConfig from '../constants/appConfig';
import {getDBConnection} from '../localDb';
import {isInsertLimitReached} from '../utils/localDbQueryHelpers';

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
    const selectQuery = `
      SELECT *,
      revenue_groups.id AS id,
      r.id AS revenue_id,
      (
        SELECT SUM(revenues.amount)
        FROM revenues
        WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')
      ) AS selected_month_grand_total_amount,
      (
        (r.amount /
        (
          SELECT SUM(revenues.amount)
          FROM revenues
          WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')
        )) * 100
      ) AS percentage
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM revenue_groups
      LEFT JOIN (SELECT * FROM revenues WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')) as r
      ON r.revenue_group_id = revenue_groups.id

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
    const countAllQuery = `SELECT SUM(revenues.amount) AS revenue_groups_grand_total`;
    const query = `
      FROM revenues
      WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')`;

    const result = await db.executeSql(countAllQuery + query);
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
      SELECT SUM(revenues.amount) AS revenue_groups_grand_total
      FROM revenues
      WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${dateFilter}')
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
      SELECT * FROM revenue_groups WHERE name = '${values.name.replace(
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
    const createRevenueGroupQuery = `INSERT INTO revenue_groups (
      name
    )
    
    VALUES(
      '${values.name.replace(/\'/g, "''")}'
    );`;

    const createRevenueGroupResult = await db.executeSql(
      createRevenueGroupQuery,
    );

    if (createRevenueGroupResult[0].rowsAffected === 0) {
      throw Error('Failed to create new revenue group');
    }

    const revenueGroupId = createRevenueGroupResult[0].insertId;

    // insert each category ids to revenue_categories table
    let insertRevenueCategoriesQuery = `
      INSERT INTO revenue_categories (
        revenue_group_id,
        category_id
      )
      
      VALUES
    `;

    values.category_ids.forEach((categoryId, index) => {
      insertRevenueCategoriesQuery += `(
          ${revenueGroupId},
          ${categoryId}
          
        )`;

      if (values.category_ids.length - 1 !== index) {
        insertRevenueCategoriesQuery += `,
            `;
      } else {
        insertRevenueCategoriesQuery += ';';
      }
    });

    await db.executeSql(insertRevenueCategoriesQuery);
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
      SELECT * FROM revenue_groups WHERE name = '${updatedValues.name.replace(
        /\'/g,
        "''",
      )}' AND id != ${id};
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
      SET name = '${updatedValues.name.replace(/\'/g, "''")}'
      WHERE id = ${id}
    `;

    const updateRevenueGroupResult = await db.executeSql(
      updateRevenueGroupQuery,
    );

    if (updateRevenueGroupResult[0].rowsAffected === 0) {
      throw Error('Failed to update expense.');
    }

    const deleteExistingRevenueCategoriesQuery = `
      DELETE FROM revenue_categories WHERE revenue_group_id = ${id};
    `;

    await db.executeSql(deleteExistingRevenueCategoriesQuery);

    // insert each new categories to revenue_categories table
    let insertRevenueCategoriesQuery = `
      INSERT INTO revenue_categories (
        revenue_group_id,
        category_id
      )

      VALUES
      `;

    updatedValues.category_ids.forEach((categoryId, index) => {
      insertRevenueCategoriesQuery += `(
        ${id},
        ${categoryId}
       
      )`;

      if (updatedValues.category_ids.length - 1 !== index) {
        insertRevenueCategoriesQuery += `,
      `;
      } else {
        insertRevenueCategoriesQuery += ';';
      }
    });

    await db.executeSql(insertRevenueCategoriesQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update revenue group.');
  }
};

export const deleteRevenueGroup = async ({id}) => {
  const deleteRevenueGroupQuery = `DELETE FROM revenue_groups WHERE id = ${id}`;
  const deleteRevenuesQuery = `DELETE FROM revenues WHERE revenue_group_id = ${id}`;

  try {
    const db = await getDBConnection();

    const deleteRevenueGroupResult = await db.executeSql(
      deleteRevenueGroupQuery,
    );

    if (deleteRevenueGroupResult[0].rowsAffected > 0) {
      await db.executeSql(deleteRevenuesQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete revenue groups.');
  }
};

export const createRevenue = async ({values}) => {
  try {
    const db = await getDBConnection();

    const getCurrentMonthRevenueQuery = `
      SELECT * FROM revenues
      WHERE strftime('%m %Y', revenues.revenue_group_date) = strftime('%m %Y', '${values.revenue_group_date}')
      AND revenue_group_id = ${values.revenue_group_id}
    `;

    const createRevenueQuery = `INSERT INTO revenues (
    revenue_group_id,
    revenue_group_date,
    amount
  )
  
  VALUES(
    ${values.revenue_group_id},
    '${values.revenue_group_date}',
    ${values.amount}
  );`;

    // check if there's an existing revenue within the current month
    let currentMonthRevenue = null;

    const getCurrentMonthRevenueResult = await db.executeSql(
      getCurrentMonthRevenueQuery,
    );
    currentMonthRevenue = getCurrentMonthRevenueResult[0].rows.item(0);

    // create new revenue
    if (!currentMonthRevenue) {
      await db.executeSql(createRevenueQuery);
      return;
    }

    // update current month revenue
    const updateCurrentMonthRevenueQuery = `
      UPDATE revenues
      SET amount = ${values.amount}
      WHERE id = ${currentMonthRevenue.id}
    `;

    await db.executeSql(updateCurrentMonthRevenueQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create revenue.');
  }
};

export const getRevenue = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM revenues WHERE id = ${id}`;

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
  SET amount = ${updatedValues.amount}
  WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update revenue.');
  }
};

export const deleteRevenue = async ({id}) => {
  const query = `DELETE FROM revenues WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    return await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete revenues.');
  }
};

export const getRevenueCategoryIds = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const getRevenueCategoryIdsQuery = `
    SELECT *
    FROM revenue_categories
    WHERE revenue_group_id = ${id}
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
    FROM revenue_categories
    JOIN categories ON categories.id = revenue_categories.category_id
    WHERE revenue_group_id = ${id}
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
