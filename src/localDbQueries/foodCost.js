import {getDBConnection} from '../localDb';

export const getItemCostPercentage = async ({queryKey}) => {
  const [_key, {filter}] = queryKey;
  const limit = 1000000000;
  const orderBy = 'inventory_logs.adjustment_date';
  let addedStockSumQueryFilterObj = {...filter};
  let addedStockSumQueryFilter = '';
  let removedStockSumQueryFilterObj = {...filter};
  let removedStockSumQueryFilter = '';

  addedStockSumQueryFilterObj['operations.type'] = 'add_stock';
  addedStockSumQueryFilterObj['inventory_logs.voided'] = 0;

  if (
    addedStockSumQueryFilterObj &&
    Object.keys(addedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in addedStockSumQueryFilterObj) {
      if (addedStockSumQueryFilterObj[key] === '') {
        delete addedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof addedStockSumQueryFilterObj[key] === 'string'
            ? `'${addedStockSumQueryFilterObj[key]}'`
            : addedStockSumQueryFilterObj[key];
        addedStockSumQueryFilter = addedStockSumQueryFilter
          ? (addedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  removedStockSumQueryFilterObj['operations.type'] = 'remove_stock';
  removedStockSumQueryFilterObj['inventory_logs.voided'] = 0;

  if (
    removedStockSumQueryFilterObj &&
    Object.keys(removedStockSumQueryFilterObj).length > 0
  ) {
    for (let key in removedStockSumQueryFilterObj) {
      if (removedStockSumQueryFilterObj[key] === '') {
        delete removedStockSumQueryFilterObj[key];
      } else {
        let value =
          typeof removedStockSumQueryFilterObj[key] === 'string'
            ? `'${removedStockSumQueryFilterObj[key]}'`
            : removedStockSumQueryFilterObj[key];
        removedStockSumQueryFilter = removedStockSumQueryFilter
          ? (removedStockSumQueryFilter += `AND ${key} = ${value} `)
          : `WHERE ${key} = ${value} `;
      }
    }
  }

  try {
    const db = await getDBConnection();

    const sumQuery = `
      SELECT SUM(adjustment_unit_cost * adjustment_qty) AS logs_total
    `;
    const addedStockSumQuery = `
      FROM inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN items ON items.id = inventory_logs.item_id

      ${addedStockSumQueryFilter}
    ;`;

    const removedStockSumQuery = `
      FROM inventory_logs
      INNER JOIN operations ON operations.id = inventory_logs.operation_id
      INNER JOIN items ON items.id = inventory_logs.item_id

      ${removedStockSumQueryFilter}
    ;`;

    const addedStockSumResult = await db.executeSql(
      sumQuery + addedStockSumQuery,
    );
    const removedStockSumResult = await db.executeSql(
      sumQuery + removedStockSumQuery,
    );
    const addedStockSum =
      addedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;
    const removedStockSum =
      removedStockSumResult[0].rows.raw()[0]['logs_total'] || 0;

    const itemGrandTotal = addedStockSum - removedStockSum;

    return itemGrandTotal;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item grand total.');
  }
};
