import AsyncStorage from '@react-native-async-storage/async-storage';
import convert from 'convert-units';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';
import {getItem} from './items';

export const createOrGetUnsavedRecipe = async () => {
  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved recipe
    let currentRecipeId = await AsyncStorage.getItem('currentRecipeId');

    const createRecipeQuery = `INSERT INTO recipes DEFAULT VALUES;`;

    if (!currentRecipeId) {
      // create new recipe

      const createRecipeResult = await db.executeSql(createRecipeQuery);

      if (createRecipeResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentRecipeId',
          createRecipeResult[0].insertId?.toString(),
        );

        currentRecipeId = createRecipeResult[0].insertId;
      } else {
        throw Error('Failed to create new recipe');
      }
    }

    const getRecipeQuery = `SELECT * FROM recipes WHERE id = ${parseInt(
      currentRecipeId,
    )}`;
    const getRecipeResult = await db.executeSql(getRecipeQuery);
    const recipe = getRecipeResult[0].rows.item(0);

    // has id but not found, OR found a recipe that has already created
    if (!recipe || (recipe && !recipe.is_draft)) {
      // create new recipe
      const createRecipeResult = await db.executeSql(createRecipeQuery);

      if (createRecipeResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentRecipeId',
          createRecipeResult[0].insertId?.toString(),
        );

        currentRecipeId = createRecipeResult[0].insertId;
      } else {
        throw Error('Failed to create new recipe');
      }
    }

    return {
      result: recipe,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create new or get unsaved recipe');
  }
};

export const isRecipeHasIngredient = async ({queryKey}) => {
  const [_key, {recipeId}] = queryKey;

  if (!recipeId) return false;

  try {
    const db = await getDBConnection();

    const query = `SELECT * FROM ingredients WHERE recipe_id = ${recipeId}`;

    const result = await db.executeSql(query);

    if (result[0].rows.length > 0) {
      return true;
    } else {
      return false;
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to check if recipe has ingredient');
  }
};

export const saveRecipe = async ({
  values,
  linkToFinishedProduct = false,
  finishedProductId,
  onSuccess,
}) => {
  const groupName = values.groupName
    ? `'${values.groupName.replace(/\'/g, "''")}'`
    : 'null';
  const createRecipeQuery = `INSERT INTO recipes (
    is_draft,
    is_sub_recipe,
    group_name,
    name,
    yield,
    date_saved
  )
  
  VALUES(
    0,
    0,
    ${groupName},
    '${values.name.replace(/\'/g, "''")}',
    ${parseFloat(values.yield || 1)},
    datetime('now')
  );`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved recipe
    let currentRecipeId = null;

    currentRecipeId = await AsyncStorage.getItem('currentRecipeId');

    if (currentRecipeId) {
      // check if recipe has ingredients
      let hasIngredient = false;
      const isRecipeHasIngredientQuery = `SELECT * FROM ingredients WHERE recipe_id = ${currentRecipeId}`;
      const isRecipeHasIngredientResult = await db.executeSql(
        isRecipeHasIngredientQuery,
      );

      if (isRecipeHasIngredientResult[0].rows.length > 0) {
        hasIngredient = true;
      } else {
        hasIngredient = false;
      }

      if (!hasIngredient) {
        throw Error('Recipe with no ingredient cannot be saved');
      }

      const updateAndSaveUnsavedRecipeQuery = `
        UPDATE recipes
        SET is_draft = 0,
        group_name = '${values.group_name.replace(/\'/g, "''")}',
        name = '${values.name.replace(/\'/g, "''")}',
        yield = ${parseFloat(values.yield || 1)},
        date_saved = datetime('now')
        WHERE id = ${parseInt(currentRecipeId)}
      `;

      const updateAndSaveUnsavedRecipeResult = await db.executeSql(
        updateAndSaveUnsavedRecipeQuery,
      );

      if (updateAndSaveUnsavedRecipeResult[0].rowsAffected > 0) {
        // update success
      } else {
        throw Error('Failed to update and save unsaved recipe');
      }
    } else {
      // create new recipe
      const createRecipeResult = await db.executeSql(createRecipeQuery);

      if (createRecipeResult[0].rowsAffected > 0) {
        currentRecipeId = parseInt(createRecipeResult[0].insertId);
      } else {
        throw Error('Failed to update and save unsaved recipe');
      }
    }

    /**
     * Link the new created recipe to the finished product with deleted associated recipe
     */
    if (linkToFinishedProduct && finishedProductId) {
      const updateFinishedProductRecipeIdQuery = `
        UPDATE items
        SET recipe_id = ${parseInt(currentRecipeId)}
        WHERE is_finished_product = 1 AND id = ${parseInt(finishedProductId)}
      `;

      await db.executeSql(updateFinishedProductRecipeIdQuery);
    }

    onSuccess && onSuccess({recipeId: parseInt(currentRecipeId)});

    // remove unsaved recipe ID from storage
    await AsyncStorage.removeItem('currentRecipeId');
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create recipe.');
  }
};

export const saveSubRecipe = async ({values}) => {
  const groupName = values.groupName
    ? `'${values.groupName.replace(/\'/g, "''")}'`
    : 'null';
  const createRecipeQuery = `INSERT INTO recipes (
    is_draft,
    group_name,
    name,
    yield,
    date_saved
  )
  
  VALUES(
    0,
    ${groupName},
    '${values.name.replace(/\'/g, "''")}',
    ${parseFloat(values.yield || 1)},
    datetime('now')
  );`;

  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved sub recipe
    let currentSubRecipeId = await AsyncStorage.getItem('currentSubRecipeId');

    if (currentSubRecipeId) {
      const updateAndSaveUnsavedSubRecipeQuery = `
        UPDATE recipes
        SET is_draft = 0,
        group_name = '${values.group_name.replace(/\'/g, "''")}',
        name = '${values.name.replace(/\'/g, "''")}',
        yield = ${parseFloat(values.yield || 1)},
        date_saved = datetime('now')
        WHERE id = ${parseInt(currentSubRecipeId)}
      `;

      // check if recipe has ingredients
      let hasIngredient = false;
      const isRecipeHasIngredientQuery = `SELECT * FROM ingredients WHERE recipe_id = ${currentSubRecipeId}`;
      const isRecipeHasIngredientResult = await db.executeSql(
        isRecipeHasIngredientQuery,
      );

      if (isRecipeHasIngredientResult[0].rows.length > 0) {
        hasIngredient = true;
      } else {
        hasIngredient = false;
      }

      if (!hasIngredient) {
        throw Error('Recipe with no ingredient cannot be saved');
      }

      const updateAndSaveUnsavedSubRecipeResult = await db.executeSql(
        updateAndSaveUnsavedSubRecipeQuery,
      );

      if (updateAndSaveUnsavedSubRecipeResult[0].rowsAffected === 0) {
        throw Error('Failed to update and save unsaved sub recipe');
      }
    } else {
      // create new sub recipe
      await db.executeSql(createRecipeQuery);
    }

    // remove unsaved recipe ID from storage
    await AsyncStorage.removeItem('currentSubRecipeId');
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create sub recipe.');
  }
};

export const getRecipes = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, limit = 1000000000}] = queryKey;
  const orderBy = '';
  let queryFilter = createQueryFilter(filter, {is_draft: 0});

  try {
    const db = await getDBConnection();
    const recipes = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM recipes

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        recipes.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: recipes,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get inventory logs.');
  }
};

export const getAllRecipesWithAllIngredients = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, recipeId, limit = 1000000000}] = queryKey;
  const orderBy = 'recipes.name, recipes.date_saved';

  let queryFilter = createQueryFilter(filter);

  try {
    const db = await getDBConnection();
    const recipeIngredients = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      recipes.id AS id,
      recipes.id AS recipe_id,
      recipes.name AS recipe_name,
      
      ingredients.item_id AS item_id,
      
      items.unit_cost AS inventory_unit_cost,

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
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_tax,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_net / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_tax / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost_tax,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_net / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_net,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_tax / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM ingredients

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
      ON inventory_logs_added_and_removed_totals.item_id = ingredients.item_id

      INNER JOIN items
      ON items.id = ingredients.item_id

      INNER JOIN recipes
      ON recipes.id = ingredients.recipe_id

      ${queryFilter}

      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        recipeIngredients.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: recipeIngredients,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get all recipes and all ingredients.');
  }
};

export const getAllRecipesWithAllIngredientsTotal = async ({
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
      recipe_all_ingredients_total.recipe_id AS recipe_id,
      recipe_all_ingredients_total.total_cost AS recipe_all_ingredients_total_cost,
      recipe_all_ingredients_total.total_cost_net AS recipe_all_ingredients_total_cost_net,
      recipe_all_ingredients_total.total_cost_tax AS recipe_all_ingredients_total_cost_tax

      FROM recipes

      LEFT JOIN (
        SELECT ingredients.recipe_id AS recipe_id,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost_net / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_net,
        SUM(inventory_logs_added_and_removed_totals.total_added_stock_cost_tax / inventory_logs_added_and_removed_totals.total_added_stock_qty * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_tax
        FROM ingredients

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
        ON inventory_logs_added_and_removed_totals.item_id = ingredients.item_id
        GROUP BY ingredients.recipe_id
      ) AS recipe_all_ingredients_total
      ON recipe_all_ingredients_total.recipe_id = recipes.id
    ;`;

    const results = await db.executeSql(selectQuery);

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        let recipe = result.rows.item(index);
        recipeAllIngredientsTotal.push(recipe);
        recipeAllIngredientsTotalMap[recipe?.recipe_id] = recipe;
      }
    });

    return {
      result: recipeAllIngredientsTotal,
      resultMap: recipeAllIngredientsTotalMap,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get all recipes and all ingredients total.');
  }
};

export const getRecipe = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM recipes WHERE id = ${id}`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch recipe.');
  }
};

export const updateRecipe = async ({id, updatedValues}) => {
  const groupName = updatedValues.group_name
    ? `'${updatedValues.group_name.replace(/\'/g, "''")}'`
    : 'null';
  const updateRecipeQuery = `
    UPDATE recipes
    SET group_name = ${groupName},
    name = '${updatedValues.name.replace(/\'/g, "''")}',
    yield = ${parseFloat(updatedValues.yield || 1)}
    WHERE id = ${parseInt(id)}
  `;

  try {
    const db = await getDBConnection();
    return await db.executeSql(updateRecipeQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to update recipe.');
  }
};

export const deleteRecipe = async ({id}) => {
  const deleteRecipeQuery = `DELETE FROM recipes WHERE id = ${id}`;
  const deleteRecipeIngredientsQuery = `DELETE FROM ingredients WHERE recipe_id = ${id}`;

  try {
    const db = await getDBConnection();
    const deleteRecipeResult = await db.executeSql(deleteRecipeQuery);

    if (deleteRecipeResult[0].rowsAffected > 0) {
      await db.executeSql(deleteRecipeIngredientsQuery);
    }
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete recipe.');
  }
};

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

export const isUnsavedRecipeHasIngredient = async () => {
  try {
    const db = await getDBConnection();

    // check if there's an existing unsaved recipe
    let currentRecipeId = await AsyncStorage.getItem('currentRecipeId');

    if (!currentRecipeId) {
      return false;
    } else {
      // check if recipe has ingredients
      let hasIngredient = false;
      const isRecipeHasIngredientQuery = `SELECT * FROM ingredients WHERE recipe_id = ${currentRecipeId}`;
      const isRecipeHasIngredientResult = await db.executeSql(
        isRecipeHasIngredientQuery,
      );

      if (isRecipeHasIngredientResult[0].rows.length > 0) {
        hasIngredient = true;
      } else {
        hasIngredient = false;
      }

      if (!hasIngredient) {
        return false;
      } else {
        return true;
      }
    }
  } catch (error) {
    console.debug(error);
    throw Error(`Failed to check if there's an existing unsaved recipe`);
  }
};

export const createRecipeIngredient = async ({values, recipeId}) => {
  const getRecipeQuery = `SELECT * FROM recipes WHERE id = ${parseInt(
    recipeId,
  )}`;

  const getItemQuery = `SELECT * FROM items WHERE id = ${parseInt(
    values.item_id,
  )}`;

  try {
    const db = await getDBConnection();

    const getRecipeResult = await db.executeSql(getRecipeQuery);
    const recipe = getRecipeResult[0].rows.item(0);

    if (!recipe) {
      throw Error('Failed to fetch recipe');
    }

    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    let inRecipeQtyBasedOnItemUom;

    if (values.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(values.in_recipe_qty),
      )
        .from(values.in_recipe_uom_abbrev)
        .to(item.uom_abbrev_per_piece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / item.qty_per_piece;
      inRecipeQtyBasedOnItemUom = qtyInPiece;
    } else {
      inRecipeQtyBasedOnItemUom = convert(parseFloat(values.in_recipe_qty))
        .from(values.in_recipe_uom_abbrev)
        .to(item.uom_abbrev);
    }

    const getIngredientQuery = `SELECT * FROM ingredients WHERE item_id = ${item.id} AND recipe_id = ${recipe.id};`;
    const createIngredientQuery = `INSERT INTO ingredients (
      recipe_id,
      item_id,
      in_recipe_qty,
      in_recipe_uom_abbrev,
      in_recipe_qty_based_on_item_uom,
      use_measurement_per_piece
    )
    
    VALUES(
      ${parseInt(recipe.id)},
      ${parseInt(values.item_id)},
      ${parseFloat(values.in_recipe_qty)},
      '${values.in_recipe_uom_abbrev}',
      ${parseFloat(inRecipeQtyBasedOnItemUom)},
      ${values.use_measurement_per_piece === true ? 1 : 0}
    );`;

    const updateIngredientQuery = `UPDATE ingredients
      SET in_recipe_qty = ${parseFloat(values.in_recipe_qty)},
      in_recipe_uom_abbrev = '${values.in_recipe_uom_abbrev}',
      in_recipe_qty_based_on_item_uom = ${parseFloat(
        inRecipeQtyBasedOnItemUom,
      )},
      use_measurement_per_piece = ${
        values.use_measurement_per_piece === true ? 1 : 0
      }
      WHERE item_id = ${item.id}
      AND recipe_id = ${recipe.id}
    `;

    // check if there's an existing ingredient within the current recipe
    // before creating new one
    const getIngredientResult = await db.executeSql(getIngredientQuery);
    let currentIngredient = getIngredientResult[0].rows.item(0);

    if (!currentIngredient) {
      // create new ingredient
      const createIngredientResult = await db.executeSql(createIngredientQuery);
      currentIngredient = createIngredientResult[0].rows.item(0);
    } else {
      // update existing ingredient within the current recipe
      const updateIngredientResult = await db.executeSql(updateIngredientQuery);
      currentIngredient = updateIngredientResult[0].rows.item(0);
    }

    return currentIngredient;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create recipe ingredient.');
  }
};

// will be deleted in favor of createRecipeIngredient function
export const createIngredient = async ({values}) => {
  const getItemQuery = `SELECT * FROM items WHERE id = ${parseInt(
    values.item_id,
  )}`;

  const createRecipeQuery = `INSERT INTO recipes DEFAULT VALUES;`;

  try {
    const db = await getDBConnection();

    const getItemResult = await db.executeSql(getItemQuery);

    const item = getItemResult[0].rows.item(0);

    if (!item) {
      throw Error('Failed to fetch item');
    }

    // check if there's an existing unsaved recipe
    // before creating new one
    let currentRecipeId = await AsyncStorage.getItem('currentRecipeId');

    if (!currentRecipeId) {
      // create new recipe
      const createRecipeResult = await db.executeSql(createRecipeQuery);

      if (createRecipeResult[0].rowsAffected > 0) {
        await AsyncStorage.setItem(
          'currentRecipeId',
          createRecipeResult[0].insertId?.toString(),
        );

        currentRecipeId = createRecipeResult[0].insertId;
      } else {
        throw Error('Failed to create new recipe');
      }
    }

    const inRecipeQtyBasedOnItemUom = convert(parseFloat(values.in_recipe_qty))
      .from(values.in_recipe_uom_abbrev)
      .to(item.uom_abbrev);

    const getIngredientQuery = `SELECT * FROM ingredients WHERE item_id = ${item.id} AND recipe_id = ${currentRecipeId};`;
    const createIngredientQuery = `INSERT INTO ingredients (
      recipe_id,
      item_id,
      in_recipe_qty,
      in_recipe_uom_abbrev,
      in_recipe_qty_based_on_item_uom
    )
    
    VALUES(
      ${parseInt(currentRecipeId)},
      ${parseInt(values.item_id)},
      ${parseFloat(values.in_recipe_qty)},
      '${values.in_recipe_uom_abbrev}',
      ${parseFloat(inRecipeQtyBasedOnItemUom)}
    );`;

    const updateIngredientQuery = `UPDATE ingredients
      SET in_recipe_qty = ${parseFloat(values.in_recipe_qty)},
      in_recipe_uom_abbrev = '${values.in_recipe_uom_abbrev}',
      in_recipe_qty_based_on_item_uom = ${parseFloat(inRecipeQtyBasedOnItemUom)}
      WHERE item_id = ${item.id}
      AND recipe_id = ${currentRecipeId}
    `;

    // check if there's an existing ingredient within the current recipe
    // before creating new one
    const getIngredientResult = await db.executeSql(getIngredientQuery);
    let currentIngredient = getIngredientResult[0].rows.item(0);

    if (!currentIngredient) {
      // create new ingredient
      const createIngredientResult = await db.executeSql(createIngredientQuery);
      currentIngredient = createIngredientResult[0].rows.item(0);
    } else {
      // update existing ingredient within the current recipe
      const updateIngredientResult = await db.executeSql(updateIngredientQuery);
      currentIngredient = updateIngredientResult[0].rows.item(0);
    }

    return currentIngredient;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to register item.');
  }
};

export const getAllRecipeIngredients = async () => {
  const query = `
    SELECT * FROM ingredients;
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
    throw Error('Failed to fetch all ingredients.');
  }
};

export const getRecipeIngredients = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, recipeId, limit = 1000000000}] = queryKey;
  const orderBy = '';

  if (!recipeId) {
    return {
      page: pageParam,
      result: [],
      totalCount: 0,
    };
  }

  let queryFilter = createQueryFilter(filter, {
    'ingredients.recipe_id': recipeId,
  });

  try {
    const db = await getDBConnection();
    const recipeIngredients = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT *,
      ingredients.id AS id,
      ingredients.item_id AS item_id,
      items.unit_cost AS inventory_unit_cost,

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
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty)) AS avg_unit_cost_tax,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_net / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost_net,
      (inventory_logs_added_and_removed_totals.total_added_stock_cost_tax / inventory_logs_added_and_removed_totals.total_added_stock_qty) AS added_stock_avg_unit_cost_tax,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_net,
      ((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_tax
    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `
      FROM ingredients

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
      ON inventory_logs_added_and_removed_totals.item_id = ingredients.item_id

      INNER JOIN items
      ON items.id = ingredients.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);
    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        recipeIngredients.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: recipeIngredients,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get recipe ingredients.');
  }
};

export const getRecipeIngredientItemIds = async ({queryKey}) => {
  const [_key, {recipeId}] = queryKey;

  if (!recipeId) {
    return {
      result: [],
    };
  }

  try {
    const db = await getDBConnection();
    const recipeIngredientItemIds = [];

    const getRecipeIngredientsQuery = `
      SELECT item_id FROM ingredients WHERE recipe_id = ${recipeId};
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
    throw Error('Failed to get recipe ingredients.');
  }
};

export const getRecipeIngredient = async ({queryKey}) => {
  const [_key, {id}] = queryKey;
  const query = `SELECT * FROM ingredients WHERE id = ${id};`;

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(query);

    return {
      result: result[0].rows.item(0),
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to fetch ingredient.');
  }
};

export const deleteRecipeIngredient = async ({id}) => {
  const query = `DELETE FROM ingredients WHERE id = ${parseInt(id)}`;

  try {
    const db = await getDBConnection();
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete ingredient.');
  }
};

export const getRecipeTotalCost = async ({queryKey}) => {
  const [_key, {recipeId}] = queryKey;

  const getRecipeTotalCostQuery = `
    SELECT SUM((inventory_logs_added_and_removed_totals.total_added_stock_cost - inventory_logs_added_and_removed_totals.total_removed_stock_cost) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost,
    SUM((inventory_logs_added_and_removed_totals.total_added_stock_cost_net - inventory_logs_added_and_removed_totals.total_removed_stock_cost_net) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_net,
    SUM((inventory_logs_added_and_removed_totals.total_added_stock_cost_tax - inventory_logs_added_and_removed_totals.total_removed_stock_cost_tax) / (inventory_logs_added_and_removed_totals.total_added_stock_qty - inventory_logs_added_and_removed_totals.total_removed_stock_qty) * ingredients.in_recipe_qty_based_on_item_uom) AS total_cost_tax
    FROM ingredients

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
    ON inventory_logs_added_and_removed_totals.item_id = ingredients.item_id

    WHERE ingredients.recipe_id = ${recipeId}
  `;

  if (!recipeId) {
    return {
      totalCost: 0,
      totalCostNet: 0,
      totalCostTax: 0,
    };
  }

  try {
    const db = await getDBConnection();
    const result = await db.executeSql(getRecipeTotalCostQuery);
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
    throw Error('Failed to get recipe total cost.');
  }
};

export const getRecipeRegisteredFinishedProduct = async ({queryKey}) => {
  const [_key, {recipeId}] = queryKey;

  try {
    const db = await getDBConnection();

    /**
     * Get by recipe_id (for newer version) OR
     * finished_product_origin_id (for older version; below version 1.1.111)
     */
    const getRecipeRegisteredFinishedProductQuery = `
      SELECT * FROM items
      WHERE is_finished_product = 1 AND (recipe_id = ${parseInt(
        recipeId,
      )} OR finished_product_origin_id = ${parseInt(recipeId)})
      ORDER BY date DESC
      LIMIT 1
    `;
    const result = await db.executeSql(getRecipeRegisteredFinishedProductQuery);
    const registeredFinishedProduct = result[0].rows.item(0);

    let item = null;

    if (registeredFinishedProduct) {
      /**
       * Get item
       */
      const getItemQueryData = await getItem({
        queryKey: ['item', {id: registeredFinishedProduct.id}],
      });
      item = getItemQueryData?.result;
    }

    return {
      result: item,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get recipe total cost.');
  }
};
