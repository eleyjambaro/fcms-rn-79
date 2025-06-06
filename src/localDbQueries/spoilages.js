import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';

// TODO: Make it deleteSelectedMonthSpoilages
export const deleteRecipeIngredients = async ({id}) => {
  const deleteRecipeIngredientsQuery = `DELETE FROM ingredients WHERE recipe_id = ${id}`;

  try {
    const db = await getDBConnection();

    const deleteRecipeIngredientsResult = await db.executeSql(
      deleteRecipeIngredientsQuery,
    );

    if (!deleteRecipeIngredientsResult[0].rowsAffected > 0) {
      throw Error(`Failed to delete ingredients of recipe with id ${id}.`);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete ingredients of recipe.');
  }
};

export const addSpoilage = async ({values}) => {
  const getItemQuery = `SELECT * FROM items WHERE id = ${parseInt(
    values.item_id,
  )}`;

  try {
    const db = await getDBConnection();

    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    let inSpoilageQtyBasedOnItemUom;

    if (values.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(values.in_spoilage_qty),
      )
        .from(values.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev_per_piece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / item.qty_per_piece;
      inSpoilageQtyBasedOnItemUom = qtyInPiece;
    } else {
      inSpoilageQtyBasedOnItemUom = convert(parseFloat(values.in_spoilage_qty))
        .from(values.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev);
    }

    const spoilageDate = values.in_spoilage_date
      ? `datetime('${values.in_spoilage_date}')`
      : `datetime('now')`;

    const createSpoilageQuery = `INSERT INTO spoilages (
      item_id,
      in_spoilage_qty,
      in_spoilage_uom_abbrev,
      in_spoilage_qty_based_on_item_uom,
      use_measurement_per_piece,
      in_spoilage_date,
      remarks
    )
    
    VALUES(
      ${parseInt(values.item_id)},
      ${parseFloat(values.in_spoilage_qty)},
      '${values.in_spoilage_uom_abbrev}',
      ${parseFloat(inSpoilageQtyBasedOnItemUom)},
      ${values.use_measurement_per_piece === true ? 1 : 0},
      ${spoilageDate},
      '${values.remarks ? values.remarks.replace(/\'/g, "''") : ''}'
    );`;

    // add new spoilage
    const createSpoilageResult = await db.executeSql(createSpoilageQuery);
    const spoilage = createSpoilageResult[0].rows.item(0);

    return spoilage;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to add spoilage.');
  }
};

export const getSpoilages = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      exactDateFilter,
      monthToDateFilter,
      dateRangeFilter,
      limit = 1000000000,
      listOrder = 'DESC',
    },
  ] = queryKey;
  const orderBy = 'spoilages.in_spoilage_date';

  let selectedEndDate = ``;

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthYearDateFilter}', 'start of month')`,
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (exactDateFilter) {
    additionalFilter[
      'DATE(spoilages.in_spoilage_date)'
    ] = `DATE('${exactDateFilter}')`;

    selectedEndDate = `DATE('${exactDateFilter}')`;
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };

    selectedEndDate = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };

    selectedEndDate = `DATE('${dateRangeFilter.end}')`;
  }

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const spoilages = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ${listOrder}` : '';
    const selectQuery = `
      SELECT *,
      spoilages.id AS id,
      spoilages.item_id AS item_id,
      spoilages.remarks AS remarks,
      items.unit_cost AS inventory_unit_cost,
      items.name AS name,

      categories.name AS item_category_name,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty AS selected_month_grand_total_qty,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_tax,

      (selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost,
      (selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom) AS total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_qty,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_qty,
      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_qty - previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_grand_total_qty,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM spoilages

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.item_id AS item_id,
        selected_month_total_added_and_removed.item_name AS item_name,
        selected_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND ${selectedEndDate}
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.item_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN items ON items.id = selected_month_total_added_and_removed.item_id
        GROUP BY selected_month_total_added_and_removed.item_id
      ) AS selected_month_totals
      ON selected_month_totals.item_id = spoilages.item_id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.item_id AS item_id,
        previous_month_total_added_and_removed.item_name AS item_name,
        previous_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND ${selectedEndDate}
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_previous_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.item_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN items ON items.id = previous_month_total_added_and_removed.item_id
        GROUP BY previous_month_total_added_and_removed.item_id
      ) AS previous_month_totals
      ON previous_month_totals.item_id = spoilages.item_id

      INNER JOIN items
      ON items.id = spoilages.item_id
      INNER JOIN categories
      ON categories.id = items.category_id

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        spoilages.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: spoilages,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get spoilages.');
  }
};

export const getSpoilagesTotal = async ({queryKey, pageParam = 1}) => {
  const [
    _key,
    {
      filter,
      monthYearDateFilter,
      selectedMonthYearDateFilter,
      exactDateFilter,
      monthToDateFilter,
      dateRangeFilter,
    },
  ] = queryKey;

  let selectedEndDate = ``;

  let additionalFilter = {};

  if (monthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthYearDateFilter}', 'start of month')`,
      end: `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${monthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (selectedMonthYearDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${selectedMonthYearDateFilter}', 'start of month')`,
      end: `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`,
    };

    selectedEndDate = `DATE('${selectedMonthYearDateFilter}', 'start of month', '+1 month', '-1 day')`;
  } else if (exactDateFilter) {
    additionalFilter[
      'DATE(spoilages.in_spoilage_date)'
    ] = `DATE('${exactDateFilter}')`;

    selectedEndDate = `DATE('${exactDateFilter}')`;
  } else if (monthToDateFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${monthToDateFilter.start}', 'start of month')`,
      end: `DATE('${monthToDateFilter.end}')`,
    };

    selectedEndDate = `DATE('${monthToDateFilter.end}')`;
  } else if (dateRangeFilter) {
    additionalFilter['%BETWEEN'] = {
      key: 'DATE(spoilages.in_spoilage_date)',
      start: `DATE('${dateRangeFilter.start}')`,
      end: `DATE('${dateRangeFilter.end}')`,
    };

    selectedEndDate = `DATE('${dateRangeFilter.end}')`;
  }

  let queryFilter = createQueryFilter(filter, additionalFilter);

  try {
    const db = await getDBConnection();
    const query = `
      SELECT *,

      selected_month_totals.selected_month_total_added_stock_cost AS selected_month_total_added_stock_cost,
      selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_total_removed_stock_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net AS selected_month_total_added_stock_cost_net,
      selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_total_removed_stock_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax AS selected_month_total_added_stock_cost_tax,
      selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_total_removed_stock_cost_tax,
      selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty AS selected_month_grand_total_qty,
      selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost AS selected_month_grand_total_cost,
      selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net AS selected_month_grand_total_cost_net,
      selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax AS selected_month_grand_total_cost_tax,

      ((selected_month_totals.selected_month_total_added_stock_cost - selected_month_totals.selected_month_total_removed_stock_cost) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost,
      ((selected_month_totals.selected_month_total_added_stock_cost_net - selected_month_totals.selected_month_total_removed_stock_cost_net) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_net,
      ((selected_month_totals.selected_month_total_added_stock_cost_tax - selected_month_totals.selected_month_total_removed_stock_cost_tax) / (selected_month_totals.selected_month_total_added_stock_qty - selected_month_totals.selected_month_total_removed_stock_qty)) AS avg_unit_cost_tax,

      (selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost,
      (selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) AS added_stock_avg_unit_cost_tax,

      SUM(((selected_month_totals.selected_month_total_added_stock_cost / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost,
      SUM(((selected_month_totals.selected_month_total_added_stock_cost_net / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost_net,
      SUM(((selected_month_totals.selected_month_total_added_stock_cost_tax / selected_month_totals.selected_month_total_added_stock_qty) * spoilages.in_spoilage_qty_based_on_item_uom)) AS total_cost_tax,

      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_qty,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_qty,
      previous_month_totals.previous_month_total_added_stock_cost AS previous_month_total_added_stock_cost,
      previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_total_removed_stock_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net AS previous_month_total_added_stock_cost_net,
      previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_total_removed_stock_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax AS previous_month_total_added_stock_cost_tax,
      previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_total_removed_stock_cost_tax,
      previous_month_totals.previous_month_total_added_stock_qty - previous_month_totals.previous_month_total_removed_stock_qty AS previous_month_grand_total_qty,
      previous_month_totals.previous_month_total_added_stock_cost - previous_month_totals.previous_month_total_removed_stock_cost AS previous_month_grand_total_cost,
      previous_month_totals.previous_month_total_added_stock_cost_net - previous_month_totals.previous_month_total_removed_stock_cost_net AS previous_month_grand_total_cost_net,
      previous_month_totals.previous_month_total_added_stock_cost_tax - previous_month_totals.previous_month_total_removed_stock_cost_tax AS previous_month_grand_total_cost_tax
  
      FROM spoilages

      LEFT JOIN (
        SELECT selected_month_total_added_and_removed.item_id AS item_id,
        selected_month_total_added_and_removed.item_name AS item_name,
        selected_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_qty END), 0) AS selected_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost END), 0) AS selected_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_net END), 0) AS selected_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'add_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN selected_month_total_added_and_removed.operation_type = 'remove_stock' THEN selected_month_total_added_and_removed.total_stock_cost_tax END), 0) AS selected_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_net * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_selected_month_logs.adjustment_unit_cost_tax * from_earliest_to_selected_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND ${selectedEndDate}
          ) AS from_earliest_to_selected_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_selected_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_selected_month_logs.operation_id
          GROUP BY from_earliest_to_selected_month_logs.item_id, operations.type
        ) AS selected_month_total_added_and_removed
        LEFT JOIN items ON items.id = selected_month_total_added_and_removed.item_id
        GROUP BY selected_month_total_added_and_removed.item_id
      ) AS selected_month_totals
      ON selected_month_totals.item_id = spoilages.item_id

      LEFT JOIN (
        SELECT previous_month_total_added_and_removed.item_id AS item_id,
        previous_month_total_added_and_removed.item_name AS item_name,
        previous_month_total_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_added_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_qty END), 0) AS previous_month_total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_added_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost END), 0) AS previous_month_total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_net END), 0) AS previous_month_total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'add_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN previous_month_total_added_and_removed.operation_type = 'remove_stock' THEN previous_month_total_added_and_removed.total_stock_cost_tax END), 0) AS previous_month_total_removed_stock_cost_tax
        FROM (
          SELECT SUM(from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_qty,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_net * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(from_earliest_to_previous_month_logs.adjustment_unit_cost_tax * from_earliest_to_previous_month_logs.adjustment_qty) AS total_stock_cost_tax,
          operations.type AS operation_type,
          items.id AS item_id,
          items.name AS item_name,
          items.category_id AS item_category_id
          FROM (
            SELECT * FROM inventory_logs
            WHERE voided != 1
            AND DATE(inventory_logs.adjustment_date)
            BETWEEN (SELECT DATE(adjustment_date) FROM inventory_logs WHERE voided != 1 ORDER BY adjustment_date ASC LIMIT 1)
            AND ${selectedEndDate}
          ) AS from_earliest_to_previous_month_logs
          LEFT JOIN items ON items.id = from_earliest_to_previous_month_logs.item_id
          LEFT JOIN operations ON operations.id = from_earliest_to_previous_month_logs.operation_id
          GROUP BY from_earliest_to_previous_month_logs.item_id, operations.type
        ) AS previous_month_total_added_and_removed
        LEFT JOIN items ON items.id = previous_month_total_added_and_removed.item_id
        GROUP BY previous_month_total_added_and_removed.item_id
      ) AS previous_month_totals
      ON previous_month_totals.item_id = spoilages.item_id

      INNER JOIN items
      ON items.id = spoilages.item_id

      ${queryFilter}
    ;`;

    const result = await db.executeSql(query);
    const totalCost = result[0].rows.raw()[0]['total_cost'] || 0;
    const totalCostNet = result[0].rows.raw()[0]['total_cost_net'] || 0;
    const totalCostTax = result[0].rows.raw()[0]['total_cost_tax'] || 0;

    return {
      totalCost,
      totalCostNet,
      totalCostTax,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get spoilages.');
  }
};

export const getSpoilage = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM spoilages WHERE id = ${id};`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch spoilage.');
  }
};

export const updateSpoilage = async ({id, updatedValues}) => {
  try {
    const db = await getDBConnection();

    const getSpoilageQuery = `SELECT * FROM spoilages WHERE id = ${parseInt(
      id,
    )}`;
    const getSpoilageResult = await db.executeSql(getSpoilageQuery);
    const spoilage = getSpoilageResult[0].rows.item(0);

    if (!spoilage) {
      throw Error('Failed to fetch spoilage');
    }

    const getItemQuery = `SELECT * FROM items WHERE id = ${parseInt(
      spoilage.item_id,
    )}`;
    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    let inSpoilageQtyBasedOnItemUom;

    if (updatedValues.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(updatedValues.in_spoilage_qty),
      )
        .from(updatedValues.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev_per_piece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / item.qty_per_piece;
      inSpoilageQtyBasedOnItemUom = qtyInPiece;
    } else {
      inSpoilageQtyBasedOnItemUom = convert(
        parseFloat(updatedValues.in_spoilage_qty),
      )
        .from(updatedValues.in_spoilage_uom_abbrev)
        .to(item.uom_abbrev);
    }

    const spoilageDate = updatedValues.in_spoilage_date
      ? `datetime('${updatedValues.in_spoilage_date}')`
      : `datetime('now')`;

    const updateSpoilageQuery = `
      UPDATE spoilages
      SET in_spoilage_qty = ${parseFloat(updatedValues.in_spoilage_qty)},
      in_spoilage_uom_abbrev = '${updatedValues.in_spoilage_uom_abbrev}',
      in_spoilage_qty_based_on_item_uom = ${parseFloat(
        inSpoilageQtyBasedOnItemUom,
      )},
      use_measurement_per_piece = ${
        updatedValues.use_measurement_per_piece === true ? 1 : 0
      },
      in_spoilage_date = ${spoilageDate},
      remarks = '${
        updatedValues.remarks ? updatedValues.remarks.replace(/\'/g, "''") : ''
      }'
      WHERE id = ${parseInt(id)}
    `;

    return await db.executeSql(updateSpoilageQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update spoilage.');
  }
};

export const deleteSpoilage = async ({id}) => {
  const query = `DELETE FROM spoilages WHERE id = ${parseInt(id)}`;

  try {
    const db = await getDBConnection();
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete spoilage.');
  }
};
