import convert from 'convert-units';

import {appDefaultsTypeRefs} from '../constants/appDefaults';
import {getDBConnection} from '../localDb';
import {createQueryFilter} from '../utils/localDbQueryHelpers';

export const isItemHasModifierOptions = async ({queryKey}) => {
  const [_key, {itemId, filter}] = queryKey;

  let queryFilter = createQueryFilter(filter, {
    'modifiers.item_id': itemId,
  });

  try {
    const db = await getDBConnection();
    const selectQuery = `
      SELECT * FROM modifier_options

      LEFT JOIN modifiers
      ON modifiers.id = modifier_options.modifier_id

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to check if item has modifier options.');
  }
};

export const getItemSellingSizeModifierOptions = async ({
  queryKey,
  pageParam = 1,
}) => {
  const [_key, {filter, itemId, limit = 1000000000}] = queryKey;
  const orderBy = '';

  if (!itemId) {
    return {
      page: pageParam,
      result: [],
      totalCount: 0,
    };
  }

  let queryFilter = createQueryFilter(filter, {
    'modifiers.item_id': itemId,
    'modifiers.type_ref': `'${appDefaultsTypeRefs.sellingSizeOptions}'`,
  });

  try {
    const db = await getDBConnection();
    const modifierOptions = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT modifiers.name AS modifier_name,
      modifiers.item_id AS modifier_item_id,
      modifier_options.id AS option_id,
      modifier_options.option_name AS option_name,
      modifier_options.option_selling_price AS option_selling_price,
      modifier_options.in_option_qty AS in_option_qty,
      modifier_options.in_option_qty_uom_abbrev AS in_option_qty_uom_abbrev,
      modifier_options.in_option_qty_based_on_item_uom AS in_option_qty_based_on_item_uom,
      modifier_options.use_measurement_per_piece AS use_measurement_per_piece

    `;
    const countAllQuery = `SELECT COUNT(*) `;
    const query = `  
      FROM modifier_options

      INNER JOIN modifiers
      ON modifiers.id = modifier_options.modifier_id
      INNER JOIN items
      ON items.id = modifiers.item_id

      ${queryFilter}
      
      ${queryOrderBy}

      ${limit > 0 ? `LIMIT ${limit} OFFSET ${offset}` : ''}
    ;`;

    const results = await db.executeSql(selectQuery + query);

    const totalCountResult = await db.executeSql(countAllQuery + query);
    const totalCount = totalCountResult?.[0]?.rows?.raw()?.[0]?.['COUNT(*)'];

    results.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        modifierOptions.push(result.rows.item(index));
      }
    });

    return {
      page: pageParam,
      result: modifierOptions,
      totalCount,
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get item selling size modifier options.');
  }
};

export const createItemSellingSizeOption = async ({itemId, values}) => {
  try {
    const db = await getDBConnection();

    if (!itemId) {
      throw Error('Missing itemId parameter.');
    }

    const getItemQuery = `
      SELECT * FROM items WHERE id = ${parseInt(itemId)}
    `;
    const getItemResult = await db.executeSql(getItemQuery);
    const item = getItemResult[0].rows.item(0);

    if (!item) throw Error('Item not found');

    let modifierId;

    // check if item has already have Selling Size Modifier
    const getItemSellingSizeModifierQuery = `
      SELECT * FROM modifiers WHERE item_id = ${parseInt(itemId)}
      AND type_ref = '${appDefaultsTypeRefs.sellingSizeOptions}'
    `;

    const getItemSellingSizeModifierResult = await db.executeSql(
      getItemSellingSizeModifierQuery,
    );

    const sellingSizeModifier =
      getItemSellingSizeModifierResult[0].rows.item(0);

    if (!sellingSizeModifier) {
      // create selling size modifier
      const createSellingSizeModifierQuery = `
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

      const createSellingSizeModifierResult = await db.executeSql(
        createSellingSizeModifierQuery,
      );

      if (createSellingSizeModifierResult[0].rowsAffected > 0) {
        modifierId = createSellingSizeModifierResult[0].insertId;
      } else {
        throw Error('Failed to create app default selling size modifier');
      }
    } else {
      modifierId = sellingSizeModifier.id;
    }

    let itemUOMAbbrev = item.uom_abbrev;
    let itemUOMAbbrevPerPiece = item.uom_abbrev_per_piece;
    let itemQtyPerPiece = item.qty_per_piece;
    let inOptionQtyBasedOnItemUom;

    if (values.use_measurement_per_piece) {
      const convertedQtyBasedOnItemUOMPerPiece = convert(
        parseFloat(values.in_option_qty),
      )
        .from(values.in_option_qty_uom_abbrev)
        .to(itemUOMAbbrevPerPiece);

      const qtyInPiece =
        parseFloat(convertedQtyBasedOnItemUOMPerPiece) / itemQtyPerPiece;
      inOptionQtyBasedOnItemUom = qtyInPiece;
    } else {
      inOptionQtyBasedOnItemUom = convert(parseFloat(values.in_option_qty))
        .from(values.in_option_qty_uom_abbrev)
        .to(itemUOMAbbrev);
    }

    const createSizeOptionQuery = `
      INSERT INTO modifier_options (
        modifier_id,
        option_name,
        option_selling_price,
        in_option_qty,
        in_option_qty_uom_abbrev,
        in_option_qty_based_on_item_uom,
        use_measurement_per_piece
      )
      
      VALUES (
        ${parseInt(modifierId)},
        '${values.option_name.replace(/\'/g, "''")}',
        ${parseFloat(values.option_selling_price || 0)},
        ${parseFloat(values.in_option_qty)},
        '${values.in_option_qty_uom_abbrev}',
        ${parseFloat(inOptionQtyBasedOnItemUom)},
        ${values.use_measurement_per_piece === true ? 1 : 0}
      )
    `;
    const createSizeOptionResult = await db.executeSql(createSizeOptionQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to create size option.');
  }
};

export const deleteItemSellingSizeOption = async ({id}) => {
  try {
    const db = await getDBConnection();
    const deleteSizeOptionQuery = `DELETE FROM modifier_options WHERE id = ${parseInt(
      id,
    )}`;
    const deleteSizeOptionResult = await db.executeSql(deleteSizeOptionQuery);
  } catch (error) {
    console.debug(error);
    throw Error('Failed to delete item.');
  }
};

export const getItemModifierOptions = async ({queryKey, pageParam = 1}) => {
  const [_key, {filter, itemId, limit = 1000000000}] = queryKey;
  const orderBy = '';

  if (!itemId) {
    return {
      page: pageParam,
      result: [],
      totalCount: 0,
    };
  }

  let queryFilter = createQueryFilter(filter, {
    'ingredients.recipe_id': itemId,
  });

  try {
    const db = await getDBConnection();
    const recipeIngredients = [];
    const offset = (pageParam - 1) * limit;
    const queryOrderBy = orderBy ? `ORDER BY ${orderBy} DESC` : '';
    const selectQuery = `
      SELECT * FROM modifier_options

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
