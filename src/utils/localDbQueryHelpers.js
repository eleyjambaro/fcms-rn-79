import {getDBConnection} from '../localDb';
import getAppConfig from '../constants/appConfig';

export const createQueryFilter = (filter = {}, additionalFilter = {}) => {
  let queryFilterObj = {...filter};
  let queryFilter = '';

  if (additionalFilter && Object.keys(additionalFilter).length > 0) {
    for (let key in additionalFilter) {
      queryFilterObj[key] = additionalFilter[key];
    }
  }

  if (queryFilterObj && Object.keys(queryFilterObj).length > 0) {
    for (let key in queryFilterObj) {
      if (queryFilterObj[key] === '') {
        delete queryFilterObj[key];
      } else if (key === '%IN') {
        let operatorKeyAndValue = queryFilterObj['%IN'];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${
              operatorKeyAndValue.key
            } IN (${operatorKeyAndValue.value
              ?.map(value => `'${value}'`)
              ?.join(', ')}) `)
          : `WHERE ${operatorKeyAndValue.key} IN (${operatorKeyAndValue.value
              ?.map(value => `'${value}'`)
              ?.join(', ')}) `;
      } else if (key === '%LIKE') {
        let operatorKeyAndValue = queryFilterObj['%LIKE'];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${operatorKeyAndValue.key} LIKE ${operatorKeyAndValue.value} `)
          : `WHERE ${operatorKeyAndValue.key} LIKE ${operatorKeyAndValue.value} `;
      } else if (key === '%OR LIKE') {
        let operatorKeyAndValue = queryFilterObj['%OR LIKE'];
        queryFilter = queryFilter
          ? (queryFilter += `OR ${operatorKeyAndValue.key} LIKE ${operatorKeyAndValue.value} `)
          : `WHERE ${operatorKeyAndValue.key} LIKE ${operatorKeyAndValue.value} `;
      } else if (key === '%BETWEEN') {
        let operatorKeyAndStartEndValue = queryFilterObj['%BETWEEN'];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${operatorKeyAndStartEndValue.key} BETWEEN ${operatorKeyAndStartEndValue.start} AND ${operatorKeyAndStartEndValue.end} `)
          : `WHERE ${operatorKeyAndStartEndValue.key} BETWEEN ${operatorKeyAndStartEndValue.start} AND ${operatorKeyAndStartEndValue.end} `;
      } else {
        let value =
          typeof queryFilterObj[key] === 'string'
            ? `${queryFilterObj[key]}`
            : queryFilterObj[key];
        queryFilter = queryFilter
          ? (queryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  return queryFilter;
};

export const isInsertLimitReached = async (
  queryFrom = '',
  limit = 0,
  filter,
) => {
  try {
    const db = await getDBConnection();
    let queryFilter = createQueryFilter(filter);

    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM ${queryFrom}
      ${queryFilter}
    `;
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    if (limit > 0 && totalCount >= limit) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to limit insert query.');
  }
};

export const isMutationDisabled = async () => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();

    let isMutationDisabled = false;

    // 1.) check if insert category reached "more" than its limit
    if (appConfig?.insertCategoryLimit > 0) {
      let countQuery = `
        SELECT COUNT(*) FROM categories
      `;
      let totalCountResult = await db.executeSql(countQuery);
      let totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

      if (totalCount > appConfig.insertCategoryLimit) {
        isMutationDisabled = true;
        return isMutationDisabled;
      }
    }

    // 2.) check if at least one of categories reached "more" than insert item per category limit
    if (appConfig?.insertItemLimitPerCategory > 0) {
      let hasCategoryWithItemsMoreThanLimit = false;

      let countQuery = `
        SELECT COUNT(*) AS item_count_per_category, category_id AS category_id FROM items GROUP BY category_id
      `;
      let totalCountResult = await db.executeSql(countQuery);

      totalCountResult.forEach(result => {
        for (let index = 0; index < result.rows.length; index++) {
          const categoryIdCount = result.rows.item(index);

          if (
            categoryIdCount?.item_count_per_category >
            appConfig?.insertItemLimitPerCategory
          ) {
            hasCategoryWithItemsMoreThanLimit = true;
          }
        }
      });

      if (hasCategoryWithItemsMoreThanLimit) {
        isMutationDisabled = true;
        return isMutationDisabled;
      }
    }

    return isMutationDisabled;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to check if mutation is disabled.');
  }
};
