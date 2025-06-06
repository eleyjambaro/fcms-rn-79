import convert from 'convert-units';
import * as RNFS from 'react-native-fs';
import XLSX from 'xlsx';

import {getDBConnection} from '../localDb';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import {getAppConfig} from '../constants/appConfig';
import RNFetchBlob from 'rn-fetch-blob';
import {extractNumber} from '../utils/stringHelpers';
import appDefaults from '../constants/appDefaults';

const removeDuplicatesFromArray = (array, valueKey) => {
  return array.reduce((result, element) => {
    let normalize = x => (typeof x === 'string' ? x.toLowerCase() : x);

    // if array of object
    if (typeof element === 'object') {
      if (!valueKey) {
        throw Error(
          'Cannot remove duplicates from array. Passing an array of objects without valueKey param',
        );
      }

      let normalizedValue = normalize(element[valueKey]);

      if (
        result.every(
          otherElement => normalize(otherElement[valueKey]) !== normalizedValue,
        )
      )
        result.push(element);

      return result;
    }

    // if array of string
    let normalizedElement = normalize(element);

    if (
      result.every(
        otherElement => normalize(otherElement) !== normalizedElement,
      )
    )
      result.push(element);

    return result;
  }, []);
};

const getAllDataFromDb = async (tableName, filter = {}) => {
  let queryFilter = createQueryFilter(filter);

  try {
    if (!tableName) {
      throw Error('Missing tableName param.');
    }

    const db = await getDBConnection();

    const getAllCategoriesFromDbQuery = `
      SELECT * FROM ${tableName} ${queryFilter}
    `;

    const getAllCategoriesFromDbResult = await db.executeSql(
      getAllCategoriesFromDbQuery,
    );

    const categoriesFromDb = [];
    getAllCategoriesFromDbResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        categoriesFromDb.push(result.rows.item(index));
      }
    });

    return categoriesFromDb;
  } catch (error) {
    console.debug(error);
    throw Error('Failed to get all data from database.');
  }
};

export const readInventoryDataTemplateFile = async ({filePath}) => {
  try {
    const data = await RNFS.readFile(filePath, 'ascii');
    const workbook = XLSX.read(data, {type: 'binary'});
    const workbookSheetNames = workbook.SheetNames;

    return {
      result: {
        filePath,
        workbookSheetNames,
      },
    };
  } catch (error) {
    console.debug(error);
    throw Error('Failed to read inventory data template.');
  }
};

export const insertTemplateDataToDb = async ({
  values,
  beginningInventoryDate,
  onInsertLimitReached,
  onSuccess,
  onError,
}) => {
  try {
    const db = await getDBConnection();
    const appConfig = await getAppConfig();
    const {insertLimit, insertCategoryLimit, insertItemLimitPerCategory} =
      appConfig;

    /**
     * Iterate data from template
     */
    let listItemError = null;

    const templateCategoriesName = [];
    const templateTaxes = [];
    const templateVendorsName = [];
    let templateItems = [];

    for (let item of values) {
      /**
       * Check required fields
       */

      /* Check category name */
      if (!item.category_name) {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item without category name value`;

        if (item.count) {
          errorMessage += ` found on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      /* Check item name */
      if (!item.item_name) {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item without item name value`;

        if (item.count) {
          errorMessage += ` found on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      /* Check item uom abbrev */
      if (!item.uom_abbrev) {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item without unit of measurement (uom_abbrev) value`;

        if (item.count) {
          errorMessage += ` found on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      /* Item UOM abbrev "pc" support*/
      const itemUOMAbbrev =
        item.uom_abbrev.toLowerCase() === 'pc' ? 'ea' : item.uom_abbrev;

      /* Validate uom abbrev */
      try {
        convert().describe(itemUOMAbbrev.toLowerCase());
      } catch (error) {
        if (error) {
          console.debug(error);
          listItemError = error;
          let errorMessage = `Your ${appDefaults} IDT item list contains unsupported unit "${item.uom_abbrev}". Use one of: ml, mg, kg, pc, and so on. Found an item named "${item.item_name}" with invalid UOM Abbrev value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
        }

        return;
      }

      // Item UOM should be PC if UOM Per Piece is set
      if (item.uom_abbrev_per_piece && itemUOMAbbrev.toLowerCase() !== 'ea') {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid UOM. You can only use Item UOM Per Piece and Qty Per Piece if the item UOM value is "PC". Found an item named "${item.item_name}" with invalid UOM value`;

        if (item.count) {
          errorMessage += ` on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      // Item UOM should be PC if Qty Per Piece is set
      if (item.qty_per_piece && itemUOMAbbrev.toLowerCase() !== 'ea') {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid UOM. You can only use Item UOM Per Piece and Qty Per Piece if the item UOM value is "PC". Found an item named "${item.item_name}" with invalid UOM value`;

        if (item.count) {
          errorMessage += ` on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      // Require either Item UOM Per Piece or Qty Per Piece
      if (
        (item.uom_abbrev_per_piece && !item.qty_per_piece) ||
        (item.qty_per_piece && !item.uom_abbrev_per_piece)
      ) {
        listItemError = true;
        let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid values. Item "UOM Per Piece" is required if "Qty Per Piece" has a value, and vice versa. Found an item named "${item.item_name}" with invalid values`;

        if (item.count) {
          errorMessage += ` on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      if (item.uom_abbrev_per_piece) {
        /* Item UOM abbrev "pc" support*/
        const itemUOMAbbrevPerPiece =
          item.uom_abbrev_per_piece.toLowerCase() === 'pc'
            ? 'ea'
            : item.uom_abbrev_per_piece;

        /* Validate uom abbrev */
        try {
          convert().describe(itemUOMAbbrevPerPiece.toLowerCase());
        } catch (error) {
          if (error) {
            console.debug(error);
            listItemError = error;
            let errorMessage = `Your ${appDefaults} IDT item list contains unsupported UOM Per Piece "${item.uom_abbrev_per_piece}". Use one of: ml, mg, kg, pc, and so on. Found an item named "${item.item_name}" with invalid UOM Per Piece value`;

            if (item.count) {
              errorMessage += ` on count number ${item.count} of the list.`;
            } else {
              errorMessage += '.';
            }
            onError && onError({errorMessage});
          }

          return;
        }
      }

      /* Validate item Qty Per Piece */
      if (item.qty_per_piece) {
        const parsedQtyPerPiece = parseFloat(item.qty_per_piece);

        if (item.qty_per_piece === '-' || isNaN(parsedQtyPerPiece)) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid Qty Per Piece value. Valid quantity should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid Qty Per Piece value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.initial_stock_qty}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      /* Validate item unit cost */
      if (item.unit_cost) {
        const parsedUnitCost = parseFloat(item.unit_cost);

        // Support '-' unit cost value
        if (isNaN(parsedUnitCost) && item.unit_cost !== '-') {
          listItemError = true;
          let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid unit cost format. Valid unit cost should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid unit cost value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.unit_cost}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      /* Validate item total cost */
      if (item.total_cost) {
        const parsedTotalCost = parseFloat(item.total_cost);

        // Support '-' total cost value
        if (isNaN(parsedTotalCost) && item.total_cost !== '-') {
          listItemError = true;
          let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid total cost format. Valid total cost should be in decimal format e.g., 200, 200.75. Found an item named "${item.item_name}" with invalid total cost value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.total_cost}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      /* Validate item initial stock quantity */
      if (item.initial_stock_qty && item.initial_stock_qty !== '-') {
        const parsedInitStockQty = parseFloat(item.initial_stock_qty);

        if (isNaN(parsedInitStockQty)) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults} IDT item list contains item with invalid stock quantity value. Valid stock quantity should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid stock quantity value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.initial_stock_qty}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      /* Validate item tax rate percentage */
      if (item.tax_rate_percentage) {
        const parsedTaxRatePercentage = parseFloat(item.tax_rate_percentage);

        if (isNaN(parsedTaxRatePercentage)) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid tax percentage value or format. Valid tax percentage should be in decimal format with or without percentage (%) symbol, e.g. 20, 20.75. 20% 20.75%, 20 %, 20.75 %. Found an item named "${item.item_name}" with invalid tax percentage value or format`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      templateCategoriesName.push(item?.category_name);
      templateTaxes.push({
        tax_name: item?.tax_name,
        tax_rate_percentage: item?.tax_rate_percentage,
      });
      templateVendorsName.push(item?.vendor_name);
      templateItems.push(item);
    }

    /**
     * Insert categories
     */
    const uniqueCategoriesName = removeDuplicatesFromArray(
      templateCategoriesName,
    );

    /**
     * Get all categories from db
     */
    let categoriesFromDb = await getAllDataFromDb('categories');

    /**
     * Compare each unique category name from template to each category from db
     */
    const alreadyExistingCategoriesName = [];
    const notExistingCategoriesName = [];

    uniqueCategoriesName.forEach(uniqueCategoryName => {
      let isAlreadyExists = false;

      for (let categoryFromDb of categoriesFromDb) {
        if (
          uniqueCategoryName?.toLowerCase() ===
          categoryFromDb.name?.toLowerCase()
        ) {
          isAlreadyExists = true;
        }
      }

      if (isAlreadyExists) {
        alreadyExistingCategoriesName.push(uniqueCategoryName);
      } else {
        notExistingCategoriesName.push(uniqueCategoryName);
      }
    });

    /**
     * Check insert limit
     */
    if (
      insertCategoryLimit &&
      notExistingCategoriesName.length + categoriesFromDb.length >
        insertCategoryLimit
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit: insertCategoryLimit,
          message: `You're importing data that contains ${notExistingCategoriesName.length} new category(ies) to insert, and you already have ${categoriesFromDb.length} saved category(ies) in the inventory. You can only create up to ${insertCategoryLimit} categories`,
        });
      console.debug('Failed to create category, insert limit reached.');

      return;
    }

    /**
     * Insert not existing categories name to db
     */
    let insertedCategoriesName = [];

    if (notExistingCategoriesName.length > 0) {
      let insertNotExistingCategoriesNameToDbQuery = `
        INSERT INTO categories (
          name
        )

        VALUES
      `;

      for (let index = 0; index < notExistingCategoriesName.length; index++) {
        let notExistingCategoryName = notExistingCategoriesName[index];
        insertedCategoriesName.push(notExistingCategoryName);

        insertNotExistingCategoriesNameToDbQuery += `(
        '${notExistingCategoryName.replace(/\'/g, "''")}'
      )`;

        if (notExistingCategoriesName.length - 1 !== index) {
          insertNotExistingCategoriesNameToDbQuery += `,
          `;
        } else {
          insertNotExistingCategoriesNameToDbQuery += ';';
        }
      }

      await db.executeSql(insertNotExistingCategoriesNameToDbQuery);
    }

    /**
     * Get all categories from db once again. This time, we assume that all
     * categories we inserted from template were already in the database
     */
    categoriesFromDb = await getAllDataFromDb('categories');

    /**
     * create categoriesIdMap & categoriesByIdMap
     * categoriesIdMap key should be category name in lower case,
     * categoriesByIdMap values should be in its original letter case
     *
     * {meat: 1, poultry: 2} // categoriesIdMap
     * {1: 'Meat', 2: 'Poultry'} // categoriesByIdMap
     */
    let categoriesIdMap = {};
    let categoriesByIdMap = {};
    categoriesFromDb.forEach(category => {
      categoriesIdMap[category.name?.toLowerCase()] = category.id;
      categoriesByIdMap[category.id] = category.name;
    });

    /**
     * Insert taxes
     */
    const uniqueTaxes = removeDuplicatesFromArray(templateTaxes, 'tax_name');

    /**
     * Get all taxes from db
     */
    let taxesFromDb = await getAllDataFromDb('taxes');

    /**
     * Compare each unique tax name from template to each tax from db
     */
    const alreadyExistingTaxes = [];
    const notExistingTaxes = [];

    uniqueTaxes.forEach(uniqueTax => {
      // handle empty string value
      if (!uniqueTax || !uniqueTax.tax_name) {
        return;
      }

      let isAlreadyExists = false;

      for (let taxFromDb of taxesFromDb) {
        if (
          uniqueTax?.tax_name?.toLowerCase() === taxFromDb.name?.toLowerCase()
        ) {
          isAlreadyExists = true;
        }
      }

      if (isAlreadyExists) {
        alreadyExistingTaxes.push(uniqueTax);
      } else {
        notExistingTaxes.push(uniqueTax);
      }
    });

    /**
     * Check insert limit
     */
    if (
      insertLimit &&
      notExistingTaxes.length + taxesFromDb.length > insertLimit
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit: insertLimit,
          message: `You're importing data that contains ${notExistingTaxes.length} new tax(es) to insert, and you already have ${taxesFromDb.length} saved tax(es). You can only create up to ${insertLimit} taxes`,
        });
      console.debug('Failed to create tax, insert limit reached.');

      return;
    }

    /**
     * Insert not existing taxes to db
     */
    let insertedTaxes = [];

    if (notExistingTaxes.length > 0) {
      let insertNotExistingTaxesToDbQuery = `
        INSERT INTO taxes (
          name,
          rate_percentage
        )

        VALUES
      `;

      for (let index = 0; index < notExistingTaxes.length; index++) {
        let notExistingTax = notExistingTaxes[index];
        insertedTaxes.push(notExistingTax);

        insertNotExistingTaxesToDbQuery += `(
          '${notExistingTax?.tax_name.replace(/\'/g, "''")}',
          ${parseFloat(notExistingTax?.tax_rate_percentage) || 0}
        )`;

        if (notExistingTaxes.length - 1 !== index) {
          insertNotExistingTaxesToDbQuery += `,
          `;
        } else {
          insertNotExistingTaxesToDbQuery += ';';
        }
      }

      await db.executeSql(insertNotExistingTaxesToDbQuery);
    }

    /**
     * Get all taxes from db once again. This time, we assume that all
     * taxes we inserted from template were already in the database
     */
    taxesFromDb = await getAllDataFromDb('taxes');

    /**
     * create taxesIdMap & taxesByIdMap
     * taxesIdMap key should be tax name in lower case,
     * taxesByIdMap values should be in its original letter case
     *
     * {vat: 1} // taxesIdMap
     * {1: Vat} // taxesByIdMap
     * {vat: 20} // taxesRatePercentageMap
     */
    let taxesIdMap = {};
    let taxesByIdMap = {};
    let taxesRatePercentageMap = {};
    taxesFromDb.forEach(tax => {
      taxesIdMap[tax.name?.toLowerCase()] = tax.id;
      taxesByIdMap[tax.id] = tax.name;
      taxesRatePercentageMap[tax.name?.toLowerCase()] =
        tax.rate_percentage || 0;
    });

    /**
     * Insert vendors
     */
    const uniqueVendorsName = removeDuplicatesFromArray(templateVendorsName);

    /**
     * Get all vendors from db
     */
    let vendorsFromDb = await getAllDataFromDb('vendors');

    /**
     * Compare each unique vendor name from template to each vendor from db
     */
    const alreadyExistingVendorsName = [];
    const notExistingVendorsName = [];

    uniqueVendorsName.forEach(uniqueVendorName => {
      // handle empty string value
      if (!uniqueVendorName) {
        return;
      }

      let isAlreadyExists = false;

      for (let vendorFromDb of vendorsFromDb) {
        if (
          uniqueVendorName?.toLowerCase() ===
          vendorFromDb.vendor_display_name?.toLowerCase()
        ) {
          isAlreadyExists = true;
        }
      }

      if (isAlreadyExists) {
        alreadyExistingVendorsName.push(uniqueVendorName);
      } else {
        notExistingVendorsName.push(uniqueVendorName);
      }
    });

    /**
     * Check insert limit
     */
    if (
      insertLimit &&
      notExistingVendorsName.length + vendorsFromDb.length > insertLimit
    ) {
      onInsertLimitReached &&
        onInsertLimitReached({
          insertLimit: insertLimit,
          message: `You're importing data that contains ${notExistingVendorsName.length} new vendor(s) to insert, and you already have ${vendorsFromDb.length} saved vendor(s). You can only create up to ${insertLimit} vendors`,
        });
      console.debug('Failed to create vendor, insert limit reached.');

      return;
    }

    /**
     * Insert not existing vendors name to db
     */
    if (notExistingVendorsName.length > 0) {
      let insertedVendorsName = [];

      let insertNotExistingVendorsNameToDbQuery = `
        INSERT INTO vendors (
          vendor_display_name
        )
        
        VALUES
      `;

      for (let index = 0; index < notExistingVendorsName.length; index++) {
        let notExistingVendorName = notExistingVendorsName[index];
        insertedVendorsName.push(notExistingVendorName);

        insertNotExistingVendorsNameToDbQuery += `(
          '${notExistingVendorName.replace(/\'/g, "''")}'
        )`;

        if (notExistingVendorsName.length - 1 !== index) {
          insertNotExistingVendorsNameToDbQuery += `,
          `;
        } else {
          insertNotExistingVendorsNameToDbQuery += ';';
        }
      }

      await db.executeSql(insertNotExistingVendorsNameToDbQuery);
    }

    /**
     * Get all vendors from db once again. This time, we assume that all
     * vendors we inserted from template were already in the database
     */
    vendorsFromDb = await getAllDataFromDb('vendors');

    /**
     * create vendorsIdMap & vendorsByIdMap
     * vendorsIdMap key should be vendor name in lower case,
     * vendorsByIdMap values should be in its original letter case
     *
     * {xyz: 1} // vendorsIdMap
     * {1: XYZ} // vendorsByIdMap
     */
    let vendorsIdMap = {};
    let vendorsByIdMap = {};
    vendorsFromDb.forEach(vendor => {
      vendorsIdMap[vendor.vendor_display_name?.toLowerCase()] = vendor.id;
      vendorsByIdMap[vendor.id] = vendor.vendor_display_name;
    });

    /**
     * Insert items
     */
    const uniqueItems = removeDuplicatesFromArray(templateItems, 'item_name');

    /**
     * Get all items from db
     */
    let itemsFromDb = await getAllDataFromDb('items');

    /**
     * Compare each unique item name from template to each item from db
     */
    const alreadyExistingItems = [];
    const notExistingItems = [];

    uniqueItems.forEach(uniqueItem => {
      let isAlreadyExists = false;

      for (let itemFromDb of itemsFromDb) {
        if (
          uniqueItem?.item_name?.toLowerCase() ===
          itemFromDb.name?.toLowerCase()
        ) {
          isAlreadyExists = true;
        }
      }

      if (isAlreadyExists) {
        alreadyExistingItems.push(uniqueItem);
      } else {
        notExistingItems.push(uniqueItem);
      }
    });

    /**
     * Check insert limit
     */

    if (insertItemLimitPerCategory > 0) {
      // {1: 4, 2: 4}
      const existingItemsPerCategoryIdCountMap = {};

      // create existing items per category count map
      for (let itemFromDb of itemsFromDb) {
        if (existingItemsPerCategoryIdCountMap[itemFromDb.category_id]) {
          let existingCount =
            existingItemsPerCategoryIdCountMap[itemFromDb.category_id];

          existingItemsPerCategoryIdCountMap[itemFromDb.category_id] =
            parseInt(existingCount) + 1;
        } else {
          existingItemsPerCategoryIdCountMap[itemFromDb.category_id] = 1;
        }
      }

      // {1: 4, 2: 4}
      const notExistingItemsPerCategoryIdCountMap = {};

      for (let notExistingItem of notExistingItems) {
        const notExistingItemCategoryId =
          categoriesIdMap[notExistingItem.category_name.toLowerCase()];

        if (notExistingItemsPerCategoryIdCountMap[notExistingItemCategoryId]) {
          let existingCount =
            notExistingItemsPerCategoryIdCountMap[notExistingItemCategoryId];

          notExistingItemsPerCategoryIdCountMap[notExistingItemCategoryId] =
            parseInt(existingCount) + 1;
        } else {
          notExistingItemsPerCategoryIdCountMap[notExistingItemCategoryId] = 1;
        }
      }

      // existing category items + inserting category items
      const totalItemsPerCategoryId = {};

      for (let key in existingItemsPerCategoryIdCountMap) {
        if (key in notExistingItemsPerCategoryIdCountMap) {
          totalItemsPerCategoryId[key] =
            existingItemsPerCategoryIdCountMap[key] +
            notExistingItemsPerCategoryIdCountMap[key];
        } else {
          totalItemsPerCategoryId[key] =
            existingItemsPerCategoryIdCountMap[key];
        }
      }

      for (let key in notExistingItemsPerCategoryIdCountMap) {
        if (!(key in existingItemsPerCategoryIdCountMap)) {
          totalItemsPerCategoryId[key] =
            notExistingItemsPerCategoryIdCountMap[key];
        }
      }

      const exceedingLimitCategories = [];

      /** Get all categories that exceed the limit */
      for (let key in totalItemsPerCategoryId) {
        if (totalItemsPerCategoryId[key] > insertItemLimitPerCategory) {
          exceedingLimitCategories.push({
            categoryId: key,
            categoryName: categoriesByIdMap[key],
            itemToInsertCount: notExistingItemsPerCategoryIdCountMap[key] || 0,
            existingItemCount: existingItemsPerCategoryIdCountMap[key] || 0,
          });
        }
      }

      if (exceedingLimitCategories.length > 0) {
        onInsertLimitReached &&
          onInsertLimitReached({
            insertLimit: insertItemLimitPerCategory,
            message: `You're importing data that exceeds the limit of inserting items per category. You can only register up to ${insertItemLimitPerCategory} items per category`,
          });
        console.debug('Failed to create item, insert limit reached.');

        return;
      }
    } // End check insert limit

    /**
     * Insert not existing items to db
     */
    let insertingItems = [];
    let insertingItemsName = [];

    /**
     * create insertingItemsByNameMap
     * - key should be the item name in lower case
     *
     * {
     *  'apple juice': {
     *    item_name: 'Apple Juice',
     *    unit_cost: 20,
     *    ...
     *  }
     * }
     */
    let insertingItemsByNameMap = {};

    if (notExistingItems.length > 0) {
      let insertNotExistingItemsToDbQuery = `
        INSERT INTO items (
          category_id,
          tax_id,
          preferred_vendor_id,
          name,
          uom_abbrev,
          unit_cost,
          uom_abbrev_per_piece,
          qty_per_piece
        )

        VALUES
      `;

      for (let index = 0; index < notExistingItems.length; index++) {
        let item = notExistingItems[index];

        const categoryId = categoriesIdMap[item.category_name.toLowerCase()]
          ? parseInt(categoriesIdMap[item.category_name.toLowerCase()])
          : 'null';

        const taxId =
          item.tax_name && taxesIdMap[item.tax_name.toLowerCase()]
            ? parseInt(taxesIdMap[item.tax_name.toLowerCase()])
            : 'null';
        const taxName = item.tax_name
          ? `'${item.tax_name.replace(/\'/g, "''")}'`
          : 'null';
        const taxRatePercentage =
          item.tax_name && taxesRatePercentageMap[item.tax_name.toLowerCase()]
            ? parseFloat(taxesRatePercentageMap[item.tax_name.toLowerCase()])
            : 0;

        const vendorId =
          item.vendor_name && vendorsIdMap[item.vendor_name.toLowerCase()]
            ? parseInt(vendorsIdMap[item.vendor_name.toLowerCase()])
            : 'null';
        const vendorName = item.vendor_name
          ? `'${item.vendor_name.replace(/\'/g, "''")}'`
          : 'null';

        /* Item UOM abbrev "pc" support */
        const uomAbbrev =
          item.uom_abbrev.toLowerCase() === 'pc' ? 'ea' : item.uom_abbrev;
        let unitCost = parseFloat(extractNumber(item.unit_cost) || 0);
        let totalCost = parseFloat(extractNumber(item.total_cost) || 0);

        if (isNaN(unitCost) && item.unit_cost === '-') {
          unitCost = 0;
        }

        if (isNaN(totalCost) && item.total_cost === '-') {
          totalCost = 0;
        }

        let initialStockQty = parseFloat(
          extractNumber(item.initial_stock_qty) || 0,
        );

        if (isNaN(initialStockQty) && item.initial_stock_qty === '-') {
          initialStockQty = 0;
        }

        /**
         * Calculate unit cost
         * NOTE: We will use the calculated unit cost value ONLY IF: item has no unit_cost value but has a total_cost value from IDT.
         */
        if (!unitCost && totalCost && initialStockQty) {
          const calculatedUnitCost = totalCost / initialStockQty;
          unitCost = calculatedUnitCost;
        }

        const officialReceiptNumber = item.official_receipt_number
          ? `'${item.official_receipt_number}'`
          : 'null';

        const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
        const unitCostTax = unitCost - unitCostNet;

        /* Item UOM abbrev "pc" support */
        let uomAbbrevPerPiece = 'null';

        if (uomAbbrevPerPiece) {
          uomAbbrevPerPiece =
            item.uom_abbrev_per_piece.toLowerCase() === 'pc'
              ? 'ea'
              : item.uom_abbrev_per_piece;
        }

        let qtyPerPiece = parseFloat(extractNumber(item.qty_per_piece));

        if (isNaN(qtyPerPiece) || item.qty_per_piece === '-') {
          qtyPerPiece = 'null';
        }

        insertNotExistingItemsToDbQuery += `(
          ${categoryId},
          ${taxId},
          ${vendorId},
          '${item.item_name.trim().replace(/\'/g, "''")}',
          '${uomAbbrev.toLowerCase()}',
          ${unitCost},
          '${uomAbbrevPerPiece.toLowerCase()}',
          ${qtyPerPiece}
        )`;

        if (notExistingItems.length - 1 !== index) {
          insertNotExistingItemsToDbQuery += `,
          `;
        } else {
          insertNotExistingItemsToDbQuery += ';';
        }

        insertingItems.push(item);
        insertingItemsName.push(item.item_name.trim().replace(/\'/g, "''"));
        insertingItemsByNameMap[item.item_name.toLowerCase()] = item;
      }

      await db.executeSql(insertNotExistingItemsToDbQuery);
    }

    /**
     * Get all inserted items from db.
     */
    const insertedItemsFromDb = await getAllDataFromDb('items', {
      '%IN': {key: 'name', value: insertingItemsName},
    });

    /**
     * create insertedItemsIdMap & insertedItemsByIdMap
     * insertedItemsIdMap key should be item name in lower case,
     * insertedItemsByIdMap values should be in its original letter case
     *
     * {'whole chicken': 1} // insertedItemsIdMap
     * {1: 'Whole Chicken'} // insertedItemsByIdMap
     */
    let insertedItemsIdMap = {};
    let insertedItemsByIdMap = {};
    insertedItemsFromDb.forEach(item => {
      insertedItemsIdMap[item.name?.toLowerCase()] = item.id;
      insertedItemsByIdMap[item.id] = item.name;
    });

    if (notExistingItems.length > 0) {
      /**
       * Insert inserted item's initial stock (Pre-app Stock)
       */
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
          beginning_inventory_date,
          remarks
        )
        
        VALUES
      `;

      for (let index = 0; index < notExistingItems.length; index++) {
        let item = notExistingItems[index];

        const itemId = insertedItemsIdMap[item.item_name.toLowerCase()]
          ? parseInt(insertedItemsIdMap[item.item_name.toLowerCase()])
          : 'null';

        const categoryId = categoriesIdMap[item.category_name.toLowerCase()]
          ? parseInt(categoriesIdMap[item.category_name.toLowerCase()])
          : 'null';

        const taxId =
          item.tax_name && taxesIdMap[item.tax_name.toLowerCase()]
            ? parseInt(taxesIdMap[item.tax_name.toLowerCase()])
            : 'null';
        const taxName = item.tax_name
          ? `'${item.tax_name.replace(/\'/g, "''")}'`
          : 'null';
        const taxRatePercentage =
          item.tax_name && taxesRatePercentageMap[item.tax_name.toLowerCase()]
            ? parseFloat(taxesRatePercentageMap[item.tax_name.toLowerCase()])
            : 0;

        const vendorId =
          item.vendor_name && vendorsIdMap[item.vendor_name.toLowerCase()]
            ? parseInt(vendorsIdMap[item.vendor_name.toLowerCase()])
            : 'null';
        const vendorName = item.vendor_name
          ? `'${item.vendor_name.replace(/\'/g, "''")}'`
          : 'null';

        /* Item UOM abbrev "pc" support*/
        const uomAbbrev =
          item.uom_abbrev.toLowerCase() === 'pc' ? 'ea' : item.uom_abbrev;
        let unitCost = parseFloat(extractNumber(item.unit_cost) || 0);
        let totalCost = parseFloat(extractNumber(item.total_cost) || 0);

        if (isNaN(unitCost) && item.unit_cost === '-') {
          unitCost = 0;
        }

        let initialStockQty = parseFloat(
          extractNumber(item.initial_stock_qty) || 0,
        );

        if (isNaN(initialStockQty) && item.initial_stock_qty === '-') {
          initialStockQty = 0;
        }

        /**
         * Calculate unit cost
         * NOTE: We will use the calculated unit cost value ONLY IF: item has no unit_cost value but has a total_cost value from IDT.
         */
        if (!unitCost && totalCost && initialStockQty) {
          const calculatedUnitCost = totalCost / initialStockQty;
          unitCost = calculatedUnitCost;
        }

        const officialReceiptNumber = item.official_receipt_number
          ? `'${item.official_receipt_number}'`
          : 'null';

        const unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
        const unitCostTax = unitCost - unitCostNet;

        const beginningInventoryDateFixedValue = beginningInventoryDate
          ? `datetime('${beginningInventoryDate}', 'start of month')`
          : `datetime('now', 'start of month')`;
        const adjustmentDateFixedValue = beginningInventoryDate
          ? `datetime('${beginningInventoryDate}', 'start of month', '-1 day')`
          : `datetime('now', 'start of month', '-1 day')`;

        const remarks = item.remarks
          ? `'${item?.remarks?.replace(/\'/g, "''")}'`
          : 'null';

        // operation_id 1 is equal to Initial Stock (Pre-App Stock)
        insertInventoryLogsQuery += `(
          1,
          ${itemId},
          ${taxId},
          ${vendorId},
          ${vendorName},
          ${officialReceiptNumber},
          ${unitCost},
          ${unitCostNet},
          ${unitCostTax},
          ${taxRatePercentage},
          ${taxName},
          ${initialStockQty},
          ${adjustmentDateFixedValue},
          ${beginningInventoryDateFixedValue},
          ${remarks}
        )`;

        if (notExistingItems.length - 1 !== index) {
          insertInventoryLogsQuery += `,
        `;
        } else {
          insertInventoryLogsQuery += ';';
        }
      }

      await db.executeSql(insertInventoryLogsQuery);
    }

    const itemsTotal = notExistingItems.length + alreadyExistingItems.length;

    onSuccess &&
      onSuccess({
        successMessage: `Found ${itemsTotal} item${
          itemsTotal > 1 ? 's' : ''
        } in your selected worksheet. Inserted ${
          notExistingItems.length
        } new item${notExistingItems.length > 1 ? 's' : ''}. ${
          alreadyExistingItems.length
        } out of ${itemsTotal} item${itemsTotal > 1 ? 's' : ''} already exist${
          alreadyExistingItems.length > 1 ? '' : 's'
        }.`,
      });
  } catch (error) {
    console.debug(error);
    throw Error('Failed to insert template data to db.');
  }
};
