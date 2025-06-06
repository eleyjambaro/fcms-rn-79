import uuid from 'react-native-uuid';
import convert from 'convert-units';
import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isInsertLimitReached,
  isMutationDisabled,
} from '../utils/localDbQueryHelpers';
import getAppConfig from '../constants/appConfig';
import {appDefaultsTypeRefs} from '../constants/appDefaults';

export const getItems = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter}] = queryKey;
  const limit = 10;
  const orderBy = 'items.name';
  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const items = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} ASC` : '';
    const selectAllQuery = `
      /* modifier_options table with modifier fields */
      WITH cte_item_modifier_options AS (
        SELECT * FROM modifier_options
        JOIN modifiers ON modifiers.id = modifier_options.modifier_id
      )

      SELECT *,
      COUNT(*) OVER () AS total_count,
      items.id AS id,
      items.name AS name,
      taxes.name AS tax_name,
      taxes.rate_percentage AS tax_rate_percentage,

      (
        SELECT COUNT(*)
        FROM cte_item_modifier_options cte_imo
        WHERE cte_imo.item_id = items.id
      ) AS item_modifier_options_count,

      inventory_logs_added_and_removed_totals.total_added_stock_qty AS total_added_stock_qty,
      inventory_logs_added_and_removed_totals.total_removed_stock_qty AS total_removed_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty,
      inventory_logs_added_and_removed_totals.total_added_stock_cost AS total_added_stock_cost,
      inventory_logs_added_and_removed_totals.total_removed_stock_cost AS total_removed_stock_cost,
      inventory_logs_added_and_removed_totals.total_added_stock_cost_net AS total_added_stock_cost_net,
      inventory_logs_added_and_removed_totals.total_removed_stock_cost_net AS total_removed_stock_cost_net,
      inventory_logs_added_and_removed_totals.total_added_stock_cost_tax AS total_added_stock_cost_tax,
      inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax AS total_removed_stock_cost_tax,
      inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost AS current_stock_cost,
      inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net AS current_stock_cost_net,
      inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax AS current_stock_cost_tax,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_net,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_tax
    `;
    const query = `
      FROM items
      LEFT JOIN (
        SELECT inventory_logs_added_and_removed.item_id AS item_id,
        inventory_logs_added_and_removed.item_name AS item_name,
        inventory_logs_added_and_removed.item_category_id AS item_category_id,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_added_stock_cost_net,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_removed_stock_cost_net,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_added_stock_cost_tax,
        IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_removed_stock_cost_tax
        FROM (
          SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
          SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
          SUM(inventory_logs.adjustment_unit_cost_net * inventory_logs.adjustment_qty) AS total_stock_cost_net,
          SUM(inventory_logs.adjustment_unit_cost_tax * inventory_logs.adjustment_qty) AS total_stock_cost_tax,
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

      LEFT JOIN taxes ON taxes.id = items.tax_id

      ${queryFilter}

      ${queryOrderBy}

      LIMIT ${limit} OFFSET ${offset}`;
    const results = await db.executeSql(selectAllQuery + query);
    const item = results?.[0]?.rows?.item(0);
    const totalCount = item?.total_count || 0;

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        items.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: items,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get items.');
  }
};

export const registerItem = async ({
  item,
  isFinishedProduct = false,
  finishedProductOriginId,
  finishedProductOriginTable,
  recipeId,
  recipeRegisteredFinishedProduct,
  onInsertLimitReached,
  onSuccess,
}) => {
  /**
   * 1 is equal to add_stock Initial Stock
   * 11 is equal to add_stock New Yield Stock
   */
  const operationId = isFinishedProduct ? 11 : 1;
  const yieldRefId = isFinishedProduct ? uuid.v4() : null;

  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();

    /**
     * Validate required values
     */
    if (item.uom_abbrev_per_piece && !parseFloat(item.qty_per_piece)) {
      throw Error(
        'Item Quantity Per Piece is required and must not be zero when UOM Per Piece has value.',
      );
    }

    // limit item per category
    if (
      appConfig.insertItemLimitPerCategory > 0 &&
      (await isInsertLimitReached(
        'items',
        appConfig.insertItemLimitPerCategory,
        {
          category_id: item.category_id,
        },
      ))
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit: appConfig?.insertItemLimitPerCategory,
          message: `You can only register up to ${appConfig?.insertItemLimitPerCategory} items per category`,
        });
      console.debug('Failed to register item, insert limit reached.');

      return;
    }

    let tax = {
      id: null,
      name: '',
      rate_percentage: 0,
    };

    /**
     * Validate updated value of item default tax id
     */
    if (item.tax_id) {
      const getDefaultTaxQuery = `
        SELECT * FROM taxes WHERE id = ${parseInt(item.tax_id)}
        
      `;

      const getDefaultTaxResult = await db.executeSql(getDefaultTaxQuery);
      const fetchedDefaultTax = getDefaultTaxResult[0].rows.item(0);

      if (!fetchedDefaultTax) {
        /**
         * We have an option to throw an error or just do nothing.
         * Only throw an error if we want to restrict user from selecting
         * a deleted tax during the edit item screen is rendered.
         */
        // throw new Error('Failed to register item. Default tax not found.');
      } else {
        tax = fetchedDefaultTax;
      }
    }

    let initStockTax = {
      id: null,
      name: '',
      rate_percentage: 0,
    };

    /**
     * Validate init stock applied tax id
     */
    if (item.initial_stock_applied_tax_id) {
      const getInitStockAppliedTaxQuery = `
        SELECT * FROM taxes WHERE id = ${parseInt(
          item.initial_stock_applied_tax_id,
        )}
        
      `;

      const getInitStockAppliedTaxResult = await db.executeSql(
        getInitStockAppliedTaxQuery,
      );
      const fetchedInitStockAppliedTax =
        getInitStockAppliedTaxResult[0].rows.item(0);

      if (!fetchedInitStockAppliedTax) {
        // it means applied tax was deleted
        /**
         * We have an option to throw an error or just do nothing.
         * Only throw an error if we want to restrict user from selecting
         * a deleted tax during the edit item screen is rendered.
         */
        // throw new Error(
        //   'Failed to register item. Initial stock applied tax not found.',
        // );
      } else {
        initStockTax = fetchedInitStockAppliedTax;
      }
    }

    // item default vendor
    let vendor = {
      id: null,
      vendor_display_name: '',
    };

    /**
     * Validate item default vendor id
     */
    if (item.vendor_id) {
      const getDefaultVendorQuery = `
        SELECT * FROM vendors WHERE id = ${parseInt(item.vendor_id)} 
      `;

      const getDefaultVendorResult = await db.executeSql(getDefaultVendorQuery);
      const fetchedDefaultVendor = getDefaultVendorResult[0].rows.item(0);

      if (!fetchedDefaultVendor) {
        /**
         * We have an option to throw an error or just do nothing.
         * Only throw an error if we want to restrict user from selecting
         * a deleted vendor during the edit item screen is rendered.
         */
        // throw new Error('Failed to register item. Default vendor not found.');
      } else {
        vendor = fetchedDefaultVendor;
      }
    }

    let initStockVendor = {
      id: null,
      vendor_display_name: '',
    };

    /**
     * Validate init stock vendor id
     */
    if (item.initial_stock_vendor_id) {
      const getInitStockVendorQuery = `
        SELECT * FROM vendors WHERE id = ${parseInt(
          item.initial_stock_vendor_id,
        )}
        
      `;

      const getInitStockVendorResult = await db.executeSql(
        getInitStockVendorQuery,
      );
      const fetchedInitStockVendor = getInitStockVendorResult[0].rows.item(0);

      if (!fetchedInitStockVendor) {
        // it means vendor was deleted
        /**
         * We have an option to throw an error or just do nothing.
         * Only throw an error if we want to restrict user from selecting
         * a deleted vendor during the edit item screen is rendered.
         */
        // throw new Error(
        //   'Failed to register item. Initial stock vendor not found.',
        // );
      } else {
        initStockVendor = fetchedInitStockVendor;
      }
    }

    let unitCost = parseFloat(item.unit_cost || 0);
    const initialStockQty = parseFloat(item.initial_stock_qty || 0);
    let taxRatePercentage = parseFloat(initStockTax?.rate_percentage || 0);
    let initStockTaxRatePercentage = parseFloat(
      initStockTax?.rate_percentage || 0,
    );

    let unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
    let unitCostTax = unitCost - unitCostNet;

    let initStockTaxId = initStockTax.id ? parseInt(initStockTax.id) : 'null';
    let initStockTaxName = initStockTax.name
      ? `'${initStockTax.name?.replace(/\'/g, "''")}'`
      : 'null';

    let initStockVendorId = initStockVendor.id
      ? parseInt(initStockVendor.id)
      : 'null';
    let initStockVendorDisplayName = initStockVendor.vendor_display_name
      ? `'${initStockVendor.vendor_display_name.replace(/\'/g, "''")}'`
      : 'null';

    if (isFinishedProduct) {
      unitCost = parseFloat(item.unit_cost || 0);
      unitCostNet = parseFloat(item.unit_cost_net || 0);
      unitCostTax = parseFloat(item.unit_cost_tax || 0);
      initStockTaxId = 'null';
      initStockTaxName = `'Yield Taxable Amount'`;
      initStockVendorId = 'null';
      initStockVendorDisplayName = 'null';
    }

    /**
     * Insert item
     */
    const insertItemQuery = `INSERT INTO items (
      category_id,
      is_finished_product,
      finished_product_origin_id,
      finished_product_origin_table,
      recipe_id,
      yield_ref_id,
      tax_id,
      preferred_vendor_id,
      name,
      uom_abbrev,
      unit_cost,
      unit_selling_price,
      uom_abbrev_per_piece,
      qty_per_piece,
      barcode,
      low_stock_level
    )
    
    VALUES(
      ${parseInt(item.category_id) || 'null'},
      ${isFinishedProduct ? 1 : 0},
      ${parseInt(finishedProductOriginId) || 'null'},
      '${finishedProductOriginTable ? finishedProductOriginTable : ''}',
      ${parseInt(recipeId) || 'null'},
      '${yieldRefId || ''}',
      ${initStockTaxId},
      ${initStockVendorId},
      '${item.name?.replace(/\'/g, "''")}',
      '${item.uom_abbrev}',
      ${unitCost},
      ${parseFloat(item.unit_selling_price || 0)},
      '${item.uom_abbrev_per_piece}',
      ${parseFloat(item.qty_per_piece || 0)},
      '${item.barcode || ''}',
      ${parseFloat(item.low_stock_level)}
    );`;

    let insertItemResult = null;
    let isInsertItemExecuted = false;
    let itemId = null;

    // run only if registering non finished product item
    // OR registering finished product and no registered finished product yet
    if (
      !isFinishedProduct ||
      (isFinishedProduct && !recipeRegisteredFinishedProduct)
    ) {
      insertItemResult = await db.executeSql(insertItemQuery);
      isInsertItemExecuted = true;
    }

    if (
      isInsertItemExecuted &&
      insertItemResult &&
      !insertItemResult[0]?.rowsAffected > 0
    ) {
      throw Error('Failed to register item, inventory log cancelled.');
    }

    if (
      isInsertItemExecuted &&
      insertItemResult &&
      insertItemResult[0]?.rowsAffected > 0 &&
      insertItemResult?.[0]?.insertId
    ) {
      itemId = insertItemResult[0].insertId;
    }

    if (isFinishedProduct && recipeRegisteredFinishedProduct) {
      itemId = recipeRegisteredFinishedProduct.id;
    }

    const beginningInventoryDate = item.beginning_inventory_date;
    const yieldDate = item.yield_date;

    let beginningInventoryDateFixedValue = beginningInventoryDate
      ? `datetime('${beginningInventoryDate}', 'start of month')`
      : `datetime('now', 'start of month')`;
    let adjustmentDateFixedValue = beginningInventoryDate
      ? `datetime('${beginningInventoryDate}', 'start of month', '-1 day')`
      : `datetime('now', 'start of month', '-1 day')`;

    // Change date if finished product
    if (isFinishedProduct) {
      beginningInventoryDateFixedValue = 'null';
      adjustmentDateFixedValue = `datetime('${yieldDate}')`;
    }

    const initStockOfficialReceiptNumber = item.official_receipt_number
      ? `'${item.official_receipt_number}'`
      : 'null';

    const addInventoryLogQuery = `INSERT INTO inventory_logs (
        operation_id,
        item_id,
        recipe_id,
        yield_ref_id,
        ref_tax_id,
        ref_vendor_id,
        vendor_display_name,
        adjustment_unit_cost,
        adjustment_unit_cost_net,
        adjustment_unit_cost_tax,
        adjustment_tax_rate_percentage,
        adjustment_tax_name,
        adjustment_qty,
        adjustment_date,
        beginning_inventory_date,
        official_receipt_number,
        remarks
      )
    
      VALUES(
        ${operationId},
        ${parseInt(itemId)},
        ${parseInt(recipeId) || 'null'},
        '${yieldRefId || ''}',
        ${initStockTaxId},
        ${initStockVendorId},
        ${initStockVendorDisplayName},
        ${unitCost},
        ${unitCostNet},
        ${unitCostTax},
        ${initStockTaxRatePercentage},
        ${initStockTaxName},
        ${initialStockQty},
        ${adjustmentDateFixedValue},
        ${beginningInventoryDateFixedValue},
        ${initStockOfficialReceiptNumber},
        '${item.remarks ? item.remarks.replace(/\'/g, "''") : ''}'
      );`;

    await db.executeSql(addInventoryLogQuery);

    if (isFinishedProduct && item?.required_ingredients?.length) {
      const ingredients = [];
      /**
       * Deduct recipe ingredients stock
       */
      // insert each ingredient item as stock usage entries to inventory logs
      let insertInventoryLogsQuery = `
          INSERT INTO inventory_logs (
            operation_id,
            item_id,
            recipe_id,
            yield_ref_id,
            adjustment_unit_cost,
            adjustment_unit_cost_net,
            adjustment_unit_cost_tax,
            adjustment_tax_rate_percentage,
            adjustment_tax_name,
            adjustment_qty,
            adjustment_date
          )
          
          VALUES
        `;

      for (let index = 0; index < item.required_ingredients.length; index++) {
        let ingredient = item.required_ingredients[index];
        ingredients.push(ingredient);

        const unitCost = parseFloat(ingredient.avg_unit_cost || 0);
        const qty = parseFloat(
          ingredient.ingredientQtyBasedOnUpdatedYield || 0,
        );

        const unitCostNet = parseFloat(ingredient.avg_unit_cost_net || 0);
        const unitCostTax = parseFloat(ingredient.avg_unit_cost_tax || 0);

        /**
         * NOTE: Tax name and tax rate percentage on removed stock logs
         * are for reference only. Note that items may have tax applied
         * on initial purchase but not on subsequent ones, in rare cases.
         */
        const taxName = ingredient.item_tax_name
          ? `'${ingredient.item_tax_name}'`
          : 'null';
        const taxRatePercentage = parseFloat(
          ingredient.item_tax_rate_percentage || 0,
        );

        // operation_id 6 is equal to Stock Usage Entry
        insertInventoryLogsQuery += `(
            6,
            ${ingredient.item_id},
            ${parseInt(recipeId) || 'null'},
            '${yieldRefId || ''}',
            ${unitCost},
            ${unitCostNet},
            ${unitCostTax},
            ${taxRatePercentage},
            ${taxName},
            ${qty},
            ${adjustmentDateFixedValue}
          )`;

        if (item.required_ingredients.length - 1 !== index) {
          insertInventoryLogsQuery += `,
          `;
        } else {
          insertInventoryLogsQuery += ';';
        }
      }

      await db.executeSql(insertInventoryLogsQuery);
    }

    /**
     * Create item selling size options
     */
    if (item?.selling_size_options?.length && itemId) {
      let insertedSellingSizeOptions = [];
      // Create modifier
      let modifierId;

      // create new modifier
      const createModifierQuery = `
        INSERT INTO modifiers (
          item_id,
          name,
          type_ref
        )

        VALUES (
          ${parseInt(itemId)},
          'Selling Size Options',
          '${appDefaultsTypeRefs.sellingSizeOptions}'
        );
      `;

      const createModifierResult = await db.executeSql(createModifierQuery);

      if (createModifierResult[0].rowsAffected > 0) {
        modifierId = createModifierResult[0].insertId;
      } else {
        throw Error(
          'Failed to create app default selling size options modifier',
        );
      }

      // Save item selling size options as modifier options
      let insertModifierOptionsQuery = `
        INSERT INTO modifier_options (
          modifier_id,
          option_name,
          option_selling_price,
          in_option_qty,
          in_option_qty_uom_abbrev,
          in_option_qty_based_on_item_uom,
          use_measurement_per_piece
        )
        
        VALUES
      `;

      for (let index = 0; index < item.selling_size_options.length; index++) {
        let modifierOption = item.selling_size_options[index];

        let itemUOMAbbrev = item.uom_abbrev;
        let itemUOMAbbrevPerPiece = item.uom_abbrev_per_piece;
        let itemQtyPerPiece = item.qty_per_piece;

        insertedSellingSizeOptions.push(modifierOption);

        let inOptionQtyBasedOnItemUom;

        if (modifierOption.use_measurement_per_piece) {
          const convertedQtyBasedOnItemUOMPerPiece = convert(
            parseFloat(modifierOption.in_option_qty),
          )
            .from(modifierOption.in_option_qty_uom_abbrev)
            .to(itemUOMAbbrevPerPiece);

          const qtyInPiece =
            parseFloat(convertedQtyBasedOnItemUOMPerPiece) / itemQtyPerPiece;
          inOptionQtyBasedOnItemUom = qtyInPiece;
        } else {
          inOptionQtyBasedOnItemUom = convert(
            parseFloat(modifierOption.in_option_qty),
          )
            .from(modifierOption.in_option_qty_uom_abbrev)
            .to(itemUOMAbbrev);
        }

        insertModifierOptionsQuery += `(
          ${parseInt(modifierId)},
          '${modifierOption.option_name.replace(/\'/g, "''")}',
          ${parseFloat(modifierOption.option_selling_price || 0)},
          ${parseFloat(modifierOption.in_option_qty)},
          '${modifierOption.in_option_qty_uom_abbrev}',
          ${parseFloat(inOptionQtyBasedOnItemUom)},
          ${modifierOption.use_measurement_per_piece === true ? 1 : 0}
        )`;

        if (item.selling_size_options.length - 1 !== index) {
          insertModifierOptionsQuery += `,
          `;
        } else {
          insertModifierOptionsQuery += ';';
        }
      }

      await db.executeSql(insertModifierOptionsQuery);
    }

    onSuccess && onSuccess({itemId});
  } catch (error) {
    console.debug(error);
    throw Error('Failed to register item.');
  }
};

export const getItem = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `
    /* modifier_options table with modifier fields */
    WITH cte_item_modifier_options AS (
      SELECT * FROM modifier_options
      JOIN modifiers ON modifiers.id = modifier_options.modifier_id
    )
    
    SELECT *,
    items.id AS id,
    items.name AS name,
    items.category_id AS category_id,
    categories.name AS category_name,
    (SELECT beginning_inventory_date FROM inventory_logs WHERE voided != 1 AND item_id = ${id} AND operation_id = 1) AS beginning_inventory_date,

    (
      SELECT COUNT(*)
      FROM cte_item_modifier_options cte_imo
      WHERE cte_imo.item_id = items.id
    ) AS item_modifier_options_count,

    inventory_logs_added_and_removed_totals.total_added_stock_qty AS total_added_stock_qty,
    inventory_logs_added_and_removed_totals.total_removed_stock_qty AS total_removed_stock_qty,
    inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty AS current_stock_qty,
    inventory_logs_added_and_removed_totals.total_added_stock_cost AS total_added_stock_cost,
    inventory_logs_added_and_removed_totals.total_removed_stock_cost AS total_removed_stock_cost,
    inventory_logs_added_and_removed_totals.total_added_stock_cost_net AS total_added_stock_cost_net,
    inventory_logs_added_and_removed_totals.total_removed_stock_cost_net AS total_removed_stock_cost_net,
    inventory_logs_added_and_removed_totals.total_added_stock_cost_tax AS total_added_stock_cost_tax,
    inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax AS total_removed_stock_cost_tax,
    inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost AS current_stock_cost,
    inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net AS current_stock_cost_net,
    inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax AS current_stock_cost_tax,
    ((inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost,
    ((inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_net,
    ((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_tax
    FROM items
    LEFT JOIN (
      SELECT inventory_logs_added_and_removed.item_id AS item_id,
      inventory_logs_added_and_removed.item_name AS item_name,
      inventory_logs_added_and_removed.item_category_id AS item_category_id,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_added_stock_qty,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_qty END), 0) AS total_removed_stock_qty,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_added_stock_cost,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost END), 0) AS total_removed_stock_cost,

      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_added_stock_cost_net,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_net END), 0) AS total_removed_stock_cost_net,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'add_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_added_stock_cost_tax,
      IFNULL(SUM(CASE WHEN inventory_logs_added_and_removed.operation_type = 'remove_stock' THEN inventory_logs_added_and_removed.total_stock_cost_tax END), 0) AS total_removed_stock_cost_tax
      FROM (
        SELECT SUM(inventory_logs.adjustment_qty) AS total_stock_qty,
        SUM(inventory_logs.adjustment_unit_cost * inventory_logs.adjustment_qty) AS total_stock_cost,
        SUM(inventory_logs.adjustment_unit_cost_net * inventory_logs.adjustment_qty) AS total_stock_cost_net,
        SUM(inventory_logs.adjustment_unit_cost_tax * inventory_logs.adjustment_qty) AS total_stock_cost_tax,
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
    LEFT JOIN categories ON categories.id = items.category_id
    LEFT JOIN revenue_categories ON revenue_categories.id = items.category_id
    LEFT JOIN revenue_groups ON revenue_groups.id = revenue_categories.revenue_group_id
    WHERE items.id = ${id}
  `;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch item.');
  }
};

export const updateItem = async ({
  id,
  updatedValues,
  onInsertLimitReached,
  onSuccess,
}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();

    if (await isMutationDisabled()) {
      onInsertLimitReached &&
        onInsertLimitReached({
          message: `Your items are now in Read-Only Mode and you are now`,
        });
      console.debug('Failed to update item, mutation is disabled.');

      return;
    }

    /**
     * Get item
     */
    const getItemQuery = `
      SELECT * FROM items WHERE id = ${id}
    `;

    const getItemResult = await db.executeSql(getItemQuery);

    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Item not found.');
    }

    /**
     * Validate required values
     */
    if (
      updatedValues.uom_abbrev_per_piece &&
      !parseFloat(updatedValues.qty_per_piece)
    ) {
      throw Error(
        'Item Quantity Per Piece is required and must not be zero when UOM Per Piece has value.',
      );
    }

    // if item category has changed
    if (parseInt(item.category_id) !== parseInt(updatedValues.category_id)) {
      // check item insert limit per category
      if (
        appConfig.insertItemLimitPerCategory > 0 &&
        (await isInsertLimitReached(
          'items',
          appConfig.insertItemLimitPerCategory,
          {
            category_id: updatedValues.category_id,
          },
        ))
      ) {
        onInsertLimitReached &&
          onInsertLimitReached({
            insertLimit: appConfig.insertItemLimitPerCategory,
            message: `Item failed to update. You can only have up to ${appConfig?.insertItemLimitPerCategory} items per category with this version of this app. You can update this item with new or other existing category, or increase your limit by upgrading your account.`,
          });
        console.debug('Failed to update item, limit per category reached.');

        return;
      }
    }

    /**
     * Get item initial stock inventory log
     */
    const getItemInitStockLogQuery = `SELECT * FROM inventory_logs WHERE voided != 1 AND item_id = ${parseInt(
      id,
    )} AND operation_id = 1`;

    const getItemInitStockLogResult = await db.executeSql(
      getItemInitStockLogQuery,
    );
    let itemInitStockLog = getItemInitStockLogResult[0].rows.item(0);

    if (!itemInitStockLog) {
      itemInitStockLog = {};
    }

    const defaultTaxEmptyValue = {
      id: null,
      name: '',
      rate_percentage: 0,
    };
    let tax = defaultTaxEmptyValue;

    /**
     * Get item default tax
     */
    if (item.tax_id) {
      const getItemDefaultTaxQuery = `
        SELECT * FROM taxes WHERE id = ${parseInt(item.tax_id)}
      `;

      const getItemDefaultTaxResult = await db.executeSql(
        getItemDefaultTaxQuery,
      );
      const fetchedItemDefaultTax = getItemDefaultTaxResult[0].rows.item(0);

      if (!fetchedItemDefaultTax) {
        // it means item default tax was deleted, default tax remains with null and zero values
      } else {
        tax = fetchedItemDefaultTax;
      }
    }

    /**
     * Validate updated value of item default tax id
     */
    if (updatedValues.tax_id) {
      // id 0 means user intentionally set the tax to null
      if (parseInt(updatedValues.tax_id) === 0) {
        tax = defaultTaxEmptyValue;
      } else {
        const getUpdatedDefaultTaxQuery = `
          SELECT * FROM taxes WHERE id = ${parseInt(updatedValues.tax_id)}
        `;

        const getUpdatedDefaultTaxResult = await db.executeSql(
          getUpdatedDefaultTaxQuery,
        );
        const fetchedUpdatedDefaultTax =
          getUpdatedDefaultTaxResult[0].rows.item(0);

        if (!fetchedUpdatedDefaultTax) {
          /**
           * We have an option to throw an error or just do nothing.
           * Only throw an error if we want to restrict user from selecting
           * a deleted tax during the edit item screen is rendered.
           */
          // throw new Error('Failed to update item. New default tax not found.');
        } else {
          tax = fetchedUpdatedDefaultTax;
        }
      }
    }

    let defaultInitStockTaxEmptyValue = {
      id: null,
      name: '',
      rate_percentage: 0,
    };
    let initStockTax = defaultInitStockTaxEmptyValue;

    /**
     * Check and set initial stock applied tax
     */
    if (itemInitStockLog?.ref_tax_id) {
      initStockTax = {
        id: itemInitStockLog.ref_tax_id,
        name: itemInitStockLog.adjustment_tax_name,
        rate_percentage: itemInitStockLog.adjustment_tax_rate_percentage,
      };
    }

    /**
     * Validate updated value of init stock applied tax id
     */
    if (updatedValues.initial_stock_applied_tax_id) {
      // id 0 means user intentionally set the tax to null
      if (parseInt(updatedValues.initial_stock_applied_tax_id) === 0) {
        initStockTax = defaultInitStockTaxEmptyValue;
      } else {
        const getUpdatedInitStockAppliedTaxQuery = `
        SELECT * FROM taxes WHERE id = ${parseInt(
          updatedValues.initial_stock_applied_tax_id,
        )}
        
      `;

        const getUpdatedInitStockAppliedTaxResult = await db.executeSql(
          getUpdatedInitStockAppliedTaxQuery,
        );
        const fetchedUpdatedInitStockAppliedTax =
          getUpdatedInitStockAppliedTaxResult[0].rows.item(0);

        if (!fetchedUpdatedInitStockAppliedTax) {
          // it means applied tax was deleted
          /**
           * We have an option to throw an error or just do nothing.
           * Only throw an error if we want to restrict user from selecting
           * a deleted tax during the edit item screen is rendered.
           */
          // throw new Error(
          //   'Failed to update item. New initial stock applied tax not found.',
          // );
        } else {
          initStockTax = fetchedUpdatedInitStockAppliedTax;
        }
      }
    }

    // item default vendor
    const defaultVendorEmptyValue = {
      id: null,
      vendor_display_name: '',
    };
    let vendor = defaultVendorEmptyValue;

    /**
     * Get item default (preferred) vendor
     */
    if (item.preferred_vendor_id) {
      const getItemDefaultVendorQuery = `
        SELECT * FROM vendors WHERE id = ${parseInt(item.preferred_vendor_id)}
      `;

      const getItemDefaultVendorResult = await db.executeSql(
        getItemDefaultVendorQuery,
      );
      const fetchedItemDefaultVendor =
        getItemDefaultVendorResult[0].rows.item(0);

      if (!fetchedItemDefaultVendor) {
        // it means item default vendor was deleted, default vendor remains with null and zero values
      } else {
        vendor = fetchedItemDefaultVendor;
      }
    }

    /**
     * Validate updated value of item default vendor id
     */
    if (updatedValues.vendor_id) {
      // id 0 means user intentionally set the value to null
      if (parseInt(updatedValues.vendor_id) === 0) {
        vendor = defaultVendorEmptyValue;
      } else {
        const getUpdatedDefaultVendorQuery = `
        SELECT * FROM vendors WHERE id = ${parseInt(updatedValues.vendor_id)}   
      `;

        const getUpdatedDefaultVendorResult = await db.executeSql(
          getUpdatedDefaultVendorQuery,
        );
        const fetchedUpdatedDefaultVendor =
          getUpdatedDefaultVendorResult[0].rows.item(0);

        if (!fetchedUpdatedDefaultVendor) {
          /**
           * We have an option to throw an error or just do nothing.
           * Only throw an error if we want to restrict user from selecting
           * a deleted vendor during the edit item screen is rendered.
           */
          // throw new Error('Failed to update item. New default vendor not found.');
        } else {
          vendor = fetchedUpdatedDefaultVendor;
        }
      }
    }

    const defaultInitStockVendorEmptyValue = {
      id: null,
      vendor_display_name: '',
    };
    let initStockVendor = defaultInitStockVendorEmptyValue;

    /**
     * Check and set initial stock vendor
     */
    if (itemInitStockLog?.ref_vendor_id) {
      initStockVendor = {
        id: itemInitStockLog.ref_vendor_id,
        vendor_display_name: itemInitStockLog.vendor_display_name,
      };
    }

    /**
     * Validate updated value of init stock vendor id
     */
    if (updatedValues.initial_stock_vendor_id) {
      // id 0 means user intentionally set the value to null
      if (parseInt(updatedValues.initial_stock_vendor_id) === 0) {
        initStockVendor = defaultInitStockVendorEmptyValue;
      } else {
        const getUpdatedInitStockVendorQuery = `
        SELECT * FROM vendors WHERE id = ${parseInt(
          updatedValues.initial_stock_vendor_id,
        )}
        
      `;

        const getUpdatedInitStockVendorResult = await db.executeSql(
          getUpdatedInitStockVendorQuery,
        );
        const fetchedUpdatedInitStockVendor =
          getUpdatedInitStockVendorResult[0].rows.item(0);

        if (!fetchedUpdatedInitStockVendor) {
          // it means vendor was deleted
          /**
           * We have an option to throw an error or just do nothing.
           * Only throw an error if we want to restrict user from selecting
           * a deleted vendor during the edit item screen is rendered.
           */
          // throw new Error(
          //   'Failed to update item. New initial stock vendor not found.',
          // );
        } else {
          initStockVendor = fetchedUpdatedInitStockVendor;
        }
      }
    }

    /**
     * Update Item
     */

    const unitCost = parseFloat(updatedValues.unit_cost || 0);
    const initialStockQty = parseFloat(updatedValues.initial_stock_qty || 0);
    const taxRatePercentage = parseFloat(initStockTax?.rate_percentage || 0);
    const initStockTaxRatePercentage = parseFloat(
      initStockTax?.rate_percentage || 0,
    );

    const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
    const unitCostTax = unitCost - unitCostNet;
    const defaultTaxId = tax.id ? parseInt(tax.id) : 'null';
    const defaultVendorId = vendor.id ? parseInt(vendor.id) : 'null';
    const initStockTaxId = initStockTax.id ? parseInt(initStockTax.id) : 'null';
    const initStockTaxName = initStockTax.name
      ? `'${initStockTax.name.replace(/\'/g, "''")}'`
      : 'null';

    const initStockVendorId = initStockVendor.id
      ? parseInt(initStockVendor.id)
      : 'null';
    const initStockVendorDisplayName = initStockVendor.vendor_display_name
      ? `'${initStockVendor.vendor_display_name.replace(/\'/g, "''")}'`
      : 'null';

    /**
     * NOTE: Item's 'current_stock_quantity' should not be updated using this
     * function directly, because updating item's current stock quantity
     * should be updated with add_stock or remove_stock reason value
     * that will be saved in inventory_logs database table.
     */

    /**
     * TODO: Disable item uom_abbrev mutation in certain condition
     */
    const updateItemQuery = `
      UPDATE items
      SET category_id = ${parseInt(updatedValues.category_id) || 'null'},
      tax_id = ${defaultTaxId},
      preferred_vendor_id = ${defaultVendorId},
      name = '${updatedValues.name.replace(/\'/g, "''")}',
      uom_abbrev = '${updatedValues.uom_abbrev}',
      uom_abbrev_per_piece = '${updatedValues.uom_abbrev_per_piece}',
      qty_per_piece = ${parseFloat(updatedValues.qty_per_piece || 0)},
      barcode = '${updatedValues.barcode || ''}',
      unit_selling_price = ${parseFloat(updatedValues.unit_selling_price || 0)},
      low_stock_level = ${parseFloat(updatedValues.low_stock_level)}
      WHERE id = ${id}
    `;

    const updateItemResult = await db.executeSql(updateItemQuery);

    if (updateItemResult[0].rowsAffected > 0) {
      const beginningInventoryDate = updatedValues.beginning_inventory_date;

      const beginningInventoryDateFixedValue = beginningInventoryDate
        ? `datetime('${beginningInventoryDate}', 'start of month')`
        : `datetime('now', 'start of month')`;
      const adjustmentDateFixedValue = beginningInventoryDate
        ? `datetime('${beginningInventoryDate}', 'start of month', '-1 day')`
        : `datetime('now', 'start of month', '-1 day')`;

      const initStockOfficialReceiptNumber =
        updatedValues.official_receipt_number
          ? `'${updatedValues.official_receipt_number}'`
          : 'null';

      /**
       * update item's initial stock log from inventory logs
       * NOTE: operation_id 1 is equal to Initial Stock
       */
      const updateLoggedInitialStockQuery = `
        UPDATE inventory_logs
        SET adjustment_unit_cost = ${unitCost},
        ref_tax_id = ${initStockTaxId},
        ref_vendor_id = ${initStockVendorId},
        vendor_display_name = ${initStockVendorDisplayName},
        adjustment_unit_cost_net = ${unitCostNet},
        adjustment_unit_cost_tax = ${unitCostTax},
        adjustment_tax_rate_percentage = ${initStockTaxRatePercentage},
        adjustment_tax_name = ${initStockTaxName},
        adjustment_qty = ${initialStockQty},
        adjustment_date = ${adjustmentDateFixedValue},
        beginning_inventory_date = ${beginningInventoryDateFixedValue},
        official_receipt_number = ${initStockOfficialReceiptNumber},
        remarks = '${
          updatedValues.remarks
            ? updatedValues.remarks.replace(/\'/g, "''")
            : ''
        }'
        WHERE item_id = ${id} AND operation_id = 1
      `;

      /**
       * NOTE: Skip updateLoggedInitialStockQuery if the item is a finished product.
       * Initital Stock add stock operation is not applicable with finished products.
       */
      if (!item.is_finished_product) {
        await db.executeSql(updateLoggedInitialStockQuery);
      }

      // if other uom to pc
      if (
        updatedValues.uom_abbrev &&
        updatedValues.uom_abbrev === 'ea' &&
        item.uom_abbrev !== 'ea' &&
        updatedValues.uom_abbrev_per_piece &&
        updatedValues.qty_per_piece
      ) {
        if (updatedValues.uom_abbrev_per_piece !== item.uom_abbrev) {
          throw Error(
            'Item current UOM must set as item UOM Per Piece in order to set measurement per piece values.',
          );
        }

        /**
         * Update inventory_logs adjustment_qty
         */
        const thisItemInventoryLogs = [];
        let tmpValues = `VALUES `;

        // get all inventory logs of this item
        const getAllInventoryLogsOfThisItemQuery = `
          SELECT * FROM inventory_logs WHERE item_id = ${parseInt(item.id)}
        `;
        const getAllInventoryLogsOfThisItemResult = await db.executeSql(
          getAllInventoryLogsOfThisItemQuery,
        );

        getAllInventoryLogsOfThisItemResult.forEach(result => {
          for (let index = 0; index < result.rows.length; index++) {
            let thisItemInventoryLog = result.rows.item(index);
            thisItemInventoryLogs.push(thisItemInventoryLog);

            const qtyInPiece =
              thisItemInventoryLog.adjustment_qty / updatedValues.qty_per_piece;

            // tmp values
            tmpValues += `(
              ${thisItemInventoryLog.id},
              ${parseFloat(qtyInPiece)}
            )`;

            if (result.rows.length - 1 !== index) {
              tmpValues += `,
              `;
            }
          }
        });

        // update each inventory log adjustment_qty
        const updateInventoryLogAdjustmentQtyQuery = `
          WITH tmp(inventory_log_id, adjustment_qty) AS (${tmpValues})

          UPDATE inventory_logs SET adjustment_qty = (SELECT adjustment_qty FROM tmp WHERE inventory_logs.id = tmp.inventory_log_id)

          WHERE id IN (SELECT inventory_log_id FROM tmp)
        `;

        if (thisItemInventoryLogs.length > 0) {
          const updateInventoryLogAdjustmentQtyResult = await db.executeSql(
            updateInventoryLogAdjustmentQtyQuery,
          );
        }
      }

      // everytime qty per piece updates
      if (
        updatedValues.qty_per_piece &&
        parseFloat(updatedValues.qty_per_piece) !==
          parseFloat(item.qty_per_piece)
      ) {
        /**
         * Update ingredients' in_recipe_qty_based_on_item_uom related to this item
         */
        const thisItemAsIngredients = [];
        let tmpValues = `VALUES `;

        // get all added ingredients associated with this item
        const getAllAddedIngredientsOfThisItemQuery = `
          SELECT * FROM ingredients WHERE item_id = ${parseInt(item.id)}
        `;
        const getAllAddedIngredientsOfThisItemResult = await db.executeSql(
          getAllAddedIngredientsOfThisItemQuery,
        );

        getAllAddedIngredientsOfThisItemResult.forEach(result => {
          for (let index = 0; index < result.rows.length; index++) {
            let thisItemAsIngredient = result.rows.item(index);
            thisItemAsIngredients.push(thisItemAsIngredient);

            let inRecipeQtyBasedOnItemUom;

            // Need to convert qty to qty in piece
            // if item measurement per piece is used OR if converting other uom to piece (ea)
            if (
              thisItemAsIngredient.use_measurement_per_piece ||
              (updatedValues.uom_abbrev &&
                updatedValues.uom_abbrev === 'ea' &&
                item.uom_abbrev !== 'ea' &&
                updatedValues.uom_abbrev_per_piece &&
                updatedValues.qty_per_piece)
            ) {
              const convertedQtyBasedOnItemUOMPerPiece = convert(
                parseFloat(thisItemAsIngredient.in_recipe_qty),
              )
                .from(thisItemAsIngredient.in_recipe_uom_abbrev)
                .to(updatedValues.uom_abbrev_per_piece);

              const qtyInPiece =
                parseFloat(convertedQtyBasedOnItemUOMPerPiece) /
                updatedValues.qty_per_piece;
              inRecipeQtyBasedOnItemUom = qtyInPiece;
            } else {
              inRecipeQtyBasedOnItemUom = convert(
                parseFloat(thisItemAsIngredient.in_recipe_qty),
              )
                .from(thisItemAsIngredient.in_recipe_uom_abbrev)
                .to(updatedValues.uom_abbrev);
            }

            // tmp values
            tmpValues += `(
              ${thisItemAsIngredient.id},
              ${parseFloat(inRecipeQtyBasedOnItemUom)}
            )`;

            if (result.rows.length - 1 !== index) {
              tmpValues += `,
              `;
            }
          }
        });

        // update each ingredient in_recipe_qty_based_on_item_uom
        const updateIngredientsInRecipeQtyBasedOnItemUOMQuery = `
          WITH tmp(ingredient_id, in_recipe_qty_based_on_item_uom) AS (${tmpValues})

          UPDATE ingredients SET in_recipe_qty_based_on_item_uom = (SELECT in_recipe_qty_based_on_item_uom FROM tmp WHERE ingredients.id = tmp.ingredient_id)

          WHERE id IN (SELECT ingredient_id FROM tmp)
        `;

        if (thisItemAsIngredients.length > 0) {
          const updateIngredientsInRecipeQtyBasedOnItemUOMResult =
            await db.executeSql(
              updateIngredientsInRecipeQtyBasedOnItemUOMQuery,
            );
        }

        /**
         * Update spoilages' in_spoilage_qty_based_on_item_uom related to this item
         */
        const thisItemAsSpoilages = [];
        tmpValues = `VALUES `;

        // get all added spoilages associated with this item
        const getAllAddedSpoilagesOfThisItemQuery = `
          SELECT * FROM spoilages WHERE item_id = ${parseInt(item.id)}
        `;
        const getAllAddedSpoilagesOfThisItemResult = await db.executeSql(
          getAllAddedSpoilagesOfThisItemQuery,
        );

        getAllAddedSpoilagesOfThisItemResult.forEach(result => {
          for (let index = 0; index < result.rows.length; index++) {
            let thisItemAsSpoilage = result.rows.item(index);
            thisItemAsSpoilages.push(thisItemAsSpoilage);

            let inOptionQtyBasedOnItemUom;

            // Need to convert qty to qty in piece
            // if item measurement per piece is used OR if converting other uom to piece (ea)
            if (
              thisItemAsSpoilage.use_measurement_per_piece ||
              (updatedValues.uom_abbrev &&
                updatedValues.uom_abbrev === 'ea' &&
                item.uom_abbrev !== 'ea' &&
                updatedValues.uom_abbrev_per_piece &&
                updatedValues.qty_per_piece)
            ) {
              const convertedQtyBasedOnItemUOMPerPiece = convert(
                parseFloat(thisItemAsSpoilage.in_spoilage_qty),
              )
                .from(thisItemAsSpoilage.in_spoilage_uom_abbrev)
                .to(updatedValues.uom_abbrev_per_piece);

              const qtyInPiece =
                parseFloat(convertedQtyBasedOnItemUOMPerPiece) /
                updatedValues.qty_per_piece;
              inOptionQtyBasedOnItemUom = qtyInPiece;
            } else {
              inOptionQtyBasedOnItemUom = convert(
                parseFloat(thisItemAsSpoilage.in_spoilage_qty),
              )
                .from(thisItemAsSpoilage.in_spoilage_uom_abbrev)
                .to(item.uom_abbrev);
            }

            // tmp values
            tmpValues += `(
              ${thisItemAsSpoilage.id},
              ${parseFloat(inOptionQtyBasedOnItemUom)}
            )`;

            if (result.rows.length - 1 !== index) {
              tmpValues += `,
              `;
            }
          }
        });

        // update each spoilage in_spoilage_qty_based_on_item_uom
        const updateIngredientsInSpoilageQtyBasedOnItemUOMQuery = `
          WITH tmp(spoilages_id, in_spoilage_qty_based_on_item_uom) AS (${tmpValues})

          UPDATE spoilages SET in_spoilage_qty_based_on_item_uom = (SELECT in_spoilage_qty_based_on_item_uom FROM tmp WHERE spoilages.id = tmp.spoilages_id)

          WHERE id IN (SELECT spoilages_id FROM tmp)
        `;

        if (thisItemAsSpoilages.length > 0) {
          const updateIngredientsInSpoilageQtyBasedOnItemUOMResult =
            await db.executeSql(
              updateIngredientsInSpoilageQtyBasedOnItemUOMQuery,
            );
        }
      }

      onSuccess && onSuccess({itemId: id});
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update item.');
  }
};

export const deleteItem = async ({id}) => {
  try {
    const db = await getDBConnection();
    const deleteItemQuery = `DELETE FROM items WHERE id = ${parseInt(id)}`;
    const deleteItemResult = await db.executeSql(deleteItemQuery);

    if (deleteItemResult[0].rowsAffected > 0) {
      const deleteAllItemInventoryLogsQuery = `
        DELETE FROM inventory_logs WHERE item_id = ${parseInt(id)}
      `;

      await db.executeSql(deleteAllItemInventoryLogsQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete item.');
  }
};
