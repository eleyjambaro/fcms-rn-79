import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';
import {getItem} from './items';

export const createOrGetUnsavedSellingMenu = async () => {
  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved selling menu
    let currentSellingMenuId = await AsyncStorage.getItem(
      'currentSellingMenuId',
    );

    const createSellingMenuQuery = `INSERT INTO selling_menus DEFAULT VALUES;`;

    if (!currentSellingMenuId) {
      // create new selling menu
      const createSellingMenuResult = await db.executeSql(
        createSellingMenuQuery,
      );

      if (createSellingMenuResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentSellingMenuId',
          createSellingMenuResult[0].insertId?.toString(),
        );

        currentSellingMenuId = createSellingMenuResult[0].insertId;
      } else {
        throw Error('Failed to create new selling menu');
      }
    }

    const getSellingMenuQuery = `SELECT * FROM selling_menus WHERE id = ${parseInt(
      currentSellingMenuId,
    )}`;
    const getSellingMenuResult = await db.executeSql(getSellingMenuQuery);
    const sellingMenu = getSellingMenuResult[0].rows.item(0);

    // has id but not found, OR found a selling menu that has already created
    if (!sellingMenu || (sellingMenu && !sellingMenu.is_draft)) {
      // create new sellingMenu
      const createSellingMenuResult = await db.executeSql(
        createSellingMenuQuery,
      );

      if (createSellingMenuResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentSellingMenuId',
          createSellingMenuResult[0].insertId?.toString(),
        );

        currentSellingMenuId = createSellingMenuResult[0].insertId;
      } else {
        throw Error('Failed to create new selling menu');
      }
    }

    return {
      result: sellingMenu,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create new or get unsaved selling menu');
  }
};

export const isSellingMenuHasSellingMenuItems = async ({queryKey}) => {
  const [_key, {sellingMenuId}] = queryKey;

  if (!sellingMenuId) return false;

  try {
    const db = await getDBConnection();

    const query = `SELECT * FROM selling_menu_items WHERE selling_menu_id = ${sellingMenuId}`;

    const result = await db.executeSql(query);

    if (result[0].rows.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to check if selling menu has selling menu items.');
  }
};

export const saveSellingMenu = async ({values, onSuccess}) => {
  const createSellingMenuQuery = `INSERT INTO selling_menus (
    is_draft,
    name,
    date_saved
  )
  
  VALUES(
    0,
    '${values.name.replace(/\'/g, "''")}',
    datetime('now')
  );`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved selling menu
    let currentSellingMenuId = null;

    currentSellingMenuId = await AsyncStorage.getItem('currentSellingMenuId');

    if (currentSellingMenuId) {
      // check if selling menu has selling menu items
      let hasSellingMenuItem = false;
      const isSellingMenuHasSellingMenuItemQuery = `SELECT * FROM selling_menu_items WHERE selling_menu_id = ${currentSellingMenuId}`;
      const isSellingMenuHasSellingMenuItemResult = await db.executeSql(
        isSellingMenuHasSellingMenuItemQuery,
      );

      if (isSellingMenuHasSellingMenuItemResult[0].rows.length > 0) {
        hasSellingMenuItem = true;
      } else {
        hasSellingMenuItem = false;
      }

      if (!hasSellingMenuItem) {
        throw Error('Selling menu with no selling menu items cannot be saved');
      }

      const updateAndSaveUnsavedSellingMenuQuery = `
        UPDATE selling_menus
        SET is_draft = 0,
        name = '${values.name.replace(/\'/g, "''")}',
        date_saved = datetime('now')
        WHERE id = ${parseInt(currentSellingMenuId)}
      `;

      const updateAndSaveUnsavedSellingMenuResult = await db.executeSql(
        updateAndSaveUnsavedSellingMenuQuery,
      );

      if (updateAndSaveUnsavedSellingMenuResult[0].rowsAffected > 0) {
        // update success
      } else {
        throw Error('Failed to update and save unsaved selling menu');
      }
    } else {
      // create new selling menu
      const createSellingMenuResult = await db.executeSql(
        createSellingMenuQuery,
      );

      if (createSellingMenuResult[0].rowsAffected > 0) {
        currentSellingMenuId = parseInt(createSellingMenuResult[0].insertId);
      } else {
        throw Error('Failed to update and save unsaved selling menu');
      }
    }

    onSuccess && onSuccess({sellingMenuId: parseInt(currentSellingMenuId)});

    // remove unsaved selling menu ID from storage
    await AsyncStorage.removeItem('currentSellingMenuId');
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create selling menu.');
  }
};

export const getSellingMenus = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = '';
  let queryFilter = createQueryFilter(filter, {is_draft: 0});

  try {
    const db = await getDBConnection();
    const sellingMenus = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM selling_menus

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        sellingMenus.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: sellingMenus,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get selling menus.');
  }
};

export const getAllSellingMenusWithAllSellingMenuItems = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = 'selling_menus.name, selling_menus.date_saved';

  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const sellingMenuItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      selling_menus.id AS id,
      selling_menus.id AS selling_menu_id,
      selling_menus.name AS selling_menu_name,
      selling_menu_items.item_id AS item_id
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM selling_menu_items

      INNER JOIN items
      ON items.id = selling_menu_items.item_id

      INNER JOIN selling_menus
      ON selling_menus.id = selling_menu_items.selling_menu_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        sellingMenuItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: sellingMenuItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get all selling menus and all selling menu items.');
  }
};

// TODO: Refactor this function to get all selling menus with all seliing menu items total
export const getAllSellingMenusWithAllSellingMenuItemsTotal = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key] = queryKey;

  try {
    const db = await getDBConnection();
    const recipeAllIngredientsTotal = [];
    const recipeAllIngredientsTotalMap = {};

    const selectQuery = `
      SELECT
      recipe_all_ingredients_total.selling_menu_id AS selling_menu_id,
      recipe_all_ingredients_total.total_cost AS recipe_all_ingredients_total_cost,
      recipe_all_ingredients_total.total_cost_net AS recipe_all_ingredients_total_cost_net,
      recipe_all_ingredients_total.total_cost_tax AS recipe_all_ingredients_total_cost_tax

      FROM selling_menus

      LEFT JOIN (
        SELECT selling_menu_items.selling_menu_id AS selling_menu_id,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost / inventory_logs_added_and_removed_totals.total_added_stock_qty * selling_menu_items.in_recipe_qty_based_on_item_uom) AS total_cost,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost_net / inventory_logs_added_and_removed_totals.total_added_stock_qty * selling_menu_items.in_recipe_qty_based_on_item_uom) AS total_cost_net,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost_tax / inventory_logs_added_and_removed_totals.total_added_stock_qty * selling_menu_items.in_recipe_qty_based_on_item_uom) AS total_cost_tax
        FROM selling_menu_items

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
        ON inventory_logs_added_and_removed_totals.item_id = selling_menu_items.item_id
        GROUP BY selling_menu_items.selling_menu_id
      ) AS recipe_all_ingredients_total
      ON recipe_all_ingredients_total.selling_menu_id = sellingMenus.id
    ;`;

    const results = await db.executeSql(selectQuery);

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let sellingMenu = result.rows.item(index);
        recipeAllIngredientsTotal.push(sellingMenu);
        recipeAllIngredientsTotalMap[sellingMenu?.selling_menu_id] =
          sellingMenu;
      }
    });

    return {
      result: recipeAllIngredientsTotal,
      resultMap: recipeAllIngredientsTotalMap,
    };
  } catch (error) {
    console.debug(error);
    throw Error(
      'Failed to get all selling menus and all selling menu items total.',
    );
  }
};

export const getSellingMenu = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM selling_menus WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch selling menu.');
  }
};

export const updateSellingMenu = async ({id, updatedValues}) => {
  const updateSellingMenuQuery = `
    UPDATE selling_menus
    SET name = '${updatedValues.name.replace(/\'/g, "''")}'
    WHERE id = ${parseInt(id)}
  `;

  try {
    const db = await getDBConnection();
    return await db.executeSql(updateSellingMenuQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update selling menu.');
  }
};

export const deleteSellingMenu = async ({id}) => {
  const deleteRecipeQuery = `DELETE FROM selling_menus WHERE id = ${id}`;
  const deleteRecipeIngredientsQuery = `DELETE FROM selling_menu_items WHERE selling_menu_id = ${id}`;

  try {
    const db = await getDBConnection();
    const deleteRecipeResult = await db.executeSql(deleteRecipeQuery);

    if (deleteRecipeResult[0].rowsAffected > 0) {
      await db.executeSql(deleteRecipeIngredientsQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete selling menu.');
  }
};

export const deleteSellingMenuItems = async ({id}) => {
  const deleteRecipeIngredientsQuery = `DELETE FROM selling_menu_items WHERE selling_menu_id = ${id}`;

  try {
    const db = await getDBConnection();

    const deleteRecipeIngredientsResult = await db.executeSql(
      deleteRecipeIngredientsQuery,
    );

    if (!deleteRecipeIngredientsResult[0].rowsAffected > 0) {
      throw Error(
        `Failed to delete selling_menu_items of sellingMenu with id ${id}.`,
      );
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete selling menu items of selling menu.');
  }
};

export const isUnsavedSellingMenuHasSellingMenuItems = async () => {
  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved selling menu
    let currentSellingMenuId = await AsyncStorage.getItem(
      'currentSellingMenuId',
    );

    if (!currentSellingMenuId) {
      return false;
    } else {
      // check if selling menu has selling menu items
      let hasSellingMenuItem = false;
      const isSellingMenuHasSellingMenuItemQuery = `SELECT * FROM selling_menu_items WHERE selling_menu_id = ${currentSellingMenuId}`;
      const isSellingMenuHasSellingMenuItemResult = await db.executeSql(
        isSellingMenuHasSellingMenuItemQuery,
      );

      if (isSellingMenuHasSellingMenuItemResult[0].rows.length > 0) {
        hasSellingMenuItem = true;
      } else {
        hasSellingMenuItem = false;
      }

      if (!hasSellingMenuItem) {
        return false;
      } else {
        return true;
      }
    }
  } catch (error) {
    console.debug(error);
    throw Error(`Failed to check if there's an existing unsaved selling menu`);
  }
};

export const createSellingMenuItem = async ({values, sellingMenuId}) => {
  const getSellingMenuQuery = `SELECT * FROM selling_menus WHERE id = ${parseInt(
    sellingMenuId,
  )}`;

  const getItemQuery = `SELECT * FROM items WHERE id = ${parseInt(
    values.item_id,
  )}`;

  try {
    const db = await getDBConnection();

    const getSellingMenuResult = await db.executeSql(getSellingMenuQuery);
    const sellingMenu = getSellingMenuResult[0].rows.item(0);

    if (!sellingMenu) {
      throw Error('Failed to fetch selling menu');
    }

    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    const getSellingMenuItemQuery = `SELECT * FROM selling_menu_items WHERE item_id = ${item.id} AND selling_menu_id = ${sellingMenu.id};`;
    const createSellingMenuItemQuery = `INSERT INTO selling_menu_items (
      selling_menu_id,
      item_id,
      modifier_option_id,
      in_menu_qty
    )
    
    VALUES(
      ${parseInt(sellingMenu.id)},
      ${parseInt(values.item_id)},
      ${parseInt(values.size_option_id)},
      ${parseFloat(values.in_menu_qty)}
    );`;

    const updateSellingMenuItemQuery = `UPDATE selling_menu_items
      SET in_menu_qty = ${parseFloat(values.in_menu_qty)},
      modifier_option_id = ${parseInt(values.size_option_id)}
      WHERE item_id = ${item.id}
      AND selling_menu_id = ${parseInt(sellingMenu.id)}
    `;

    // check if there's an existing selling menu item within the current selling menu
    // before creating new one
    const getSellingMenuItemResult = await db.executeSql(
      getSellingMenuItemQuery,
    );
    let currentSellingMenuItem = getSellingMenuItemResult[0].rows.item(0);

    if (!currentSellingMenuItem) {
      // create new selling menu item
      const createSellingMenuItemResult = await db.executeSql(
        createSellingMenuItemQuery,
      );
      currentSellingMenuItem = createSellingMenuItemResult[0].rows.item(0);
    } else {
      // update existing selling menu item within the current selling menu
      const updateSellingMenuItemResult = await db.executeSql(
        updateSellingMenuItemQuery,
      );
      currentSellingMenuItem = updateSellingMenuItemResult[0].rows.item(0);
    }

    return currentSellingMenuItem;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create selling menu item.');
  }
};

export const getAllSellingMenuItems = async () => {
  const query = `
    SELECT * FROM selling_menu_items;
  `;
  try {
    let allIngredients = [];
    const db = await getDBConnection();
    const results = await db.executeSql(query);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        allIngredients.push(result.rows.item(index));
      }
    });

    return {
      result: allIngredients,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch all selling menu items.');
  }
};

export const getSellingMenuItems = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, sellingMenuId, limit = 1000000000}] = queryKey;
  const orderBy = '';

  if (!sellingMenuId) {
    return {
      page: pageParam,
      result: [],
      totalCount: 0,
    };
  }

  let queryFilter = createQueryFilter(filter, {
    'selling_menu_items.selling_menu_id': sellingMenuId,
  });

  try {
    const db = await getDBConnection();
    const sellingMenuItems = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      selling_menu_items.id AS id,
      selling_menu_items.item_id AS item_id,
      modifier_options.in_option_qty_uom_abbrev AS in_menu_qty_uom_abbrev,
      modifier_options.option_selling_price * selling_menu_items.in_menu_qty AS total_selling_price
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM selling_menu_items

      INNER JOIN items
      ON items.id = selling_menu_items.item_id

      INNER JOIN modifier_options
      ON modifier_options.id = selling_menu_items.modifier_option_id

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        sellingMenuItems.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: sellingMenuItems,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get selling menu items.');
  }
};

export const getSellingMenuItemIds = async ({queryKey}) => {
  const [_key, {sellingMenuId}] = queryKey;

  if (!sellingMenuId) {
    return {
      result: [],
    };
  }

  try {
    const db = await getDBConnection();
    const recipeIngredientItemIds = [];

    const getRecipeIngredientsQuery = `
      SELECT item_id FROM selling_menu_items WHERE selling_menu_id = ${sellingMenuId};
    `;

    const results = await db.executeSql(getRecipeIngredientsQuery);
    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        recipeIngredientItemIds.push(result.rows.item(index)?.item_id);
      }
    });

    return {
      result: recipeIngredientItemIds,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get selling menu item IDs.');
  }
};

export const getSellingMenuItem = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM selling_menu_items WHERE id = ${id};`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch selling menu item.');
  }
};

export const deleteSellingMenuItem = async ({id}) => {
  const query = `DELETE FROM selling_menu_items WHERE id = ${parseInt(id)}`;

  try {
    const db = await getDBConnection();
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete selling menu item.');
  }
};

export const getSellingMenuTotalSellingPrice = async ({queryKey}) => {
  const [_key, {sellingMenuId}] = queryKey;

  if (!sellingMenuId) {
    return {
      totalPrice: 0,
      totalPriceNet: 0,
      totalPriceTax: 0,
    };
  }

  try {
    const db = await getDBConnection();

    const query = `
      SELECT SUM(modifier_options.option_selling_price * selling_menu_items.in_menu_qty) as totalPrice
      FROM selling_menu_items
      INNER JOIN modifier_options ON modifier_options.id = selling_menu_items.modifier_option_id
      WHERE selling_menu_items.selling_menu_id = ${sellingMenuId}
    `;

    const result = await db.executeSql(query);
    const totals = result[0].rows.item(0);

    return {
      totalPrice: totals.totalPrice || 0,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get selling menu total selling price.');
  }
};
