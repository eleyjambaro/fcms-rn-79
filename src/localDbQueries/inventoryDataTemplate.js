import convert from 'convert-units';
import * as RNFS from 'react-native-fs';
import XLSX from 'xlsx';
import uuid from 'react-native-uuid';
import SecureStorage from 'react-native-fast-secure-storage';

import {getDBConnection, getCloudSyncParams, OPERATION_DEFAULT_UUIDS} from '../localDb';
import {
  createQueryFilter,
  isInsertLimitReached,
} from '../utils/localDbQueryHelpers';
import {getAppConfig} from '../constants/appConfig';
import RNFetchBlob from 'rn-fetch-blob';
import {extractNumber} from '../utils/stringHelpers';
import appDefaults from '../constants/appDefaults';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';
import {generateMasterItemSku} from '../utils/generateMasterItemSku';
import {generateMasterItemDescription} from '../utils/generateMasterItemDescription';
import {generateMasterItemDedupKey} from '../utils/generateMasterItemDedupKey';

// Mirrors registerItem's loadCurrentAccountId — stamps audit field
// master_items.registered_by_account_id when the user is signed in.
const loadCurrentAccountId = async () => {
  try {
    const has = await SecureStorage.hasItem(rnStorageKeys.cloudV2AuthUser);
    if (!has) return null;
    const raw = await SecureStorage.getItem(rnStorageKeys.cloudV2AuthUser);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.account?.id ?? null;
  } catch {
    return null;
  }
};

// Full identity of the signed-in account, denormalized onto the IDT import
// audit row so every device can show the importer's name/email without an
// accounts lookup (the accounts endpoint is permission-gated and excludes the
// root account). Returns nulls when no one is signed in.
const loadCurrentAccountIdentity = async () => {
  try {
    const has = await SecureStorage.hasItem(rnStorageKeys.cloudV2AuthUser);
    if (!has) return {id: null, firstName: null, lastName: null, email: null};
    const raw = await SecureStorage.getItem(rnStorageKeys.cloudV2AuthUser);
    const account = (raw ? JSON.parse(raw) : null)?.account ?? null;
    return {
      id: account?.id ?? null,
      firstName: account?.first_name ?? null,
      lastName: account?.last_name ?? null,
      email: account?.email ?? null,
      isRoot: account?.is_root_account ?? null,
    };
  } catch {
    return {
      id: null,
      firstName: null,
      lastName: null,
      email: null,
      isRoot: null,
    };
  }
};

/**
 * Parse date values from Excel/CSV into JavaScript Date objects.
 * Handles: Excel serial numbers, MM/DD/YYYY strings, YYYY-MM-DD strings.
 */
const parseExcelDate = dateValue => {
  if (!dateValue) return null;

  // Already a Date object
  if (dateValue instanceof Date) {
    return isNaN(dateValue.getTime()) ? null : dateValue;
  }

  // Excel serial number
  if (typeof dateValue === 'number') {
    if (dateValue > 1000) {
      const excelEpoch = new Date(1900, 0, 1);
      const date = new Date(
        excelEpoch.getTime() + (dateValue - 2) * 24 * 60 * 60 * 1000,
      );
      return isNaN(date.getTime()) ? null : date;
    }
  }

  // String values
  if (typeof dateValue === 'string') {
    const trimmed = dateValue.trim();
    if (!trimmed) return null;

    // Excel serial as string
    if (/^\d+(\.\d+)?$/.test(trimmed)) {
      const serial = parseFloat(trimmed);
      if (serial > 1000) {
        const excelEpoch = new Date(1900, 0, 1);
        const date = new Date(
          excelEpoch.getTime() + (serial - 2) * 24 * 60 * 60 * 1000,
        );
        return isNaN(date.getTime()) ? null : date;
      }
    }

    // MM/DD/YYYY format
    const slashMatch = trimmed.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (slashMatch) {
      const month = parseInt(slashMatch[1], 10) - 1;
      const day = parseInt(slashMatch[2], 10);
      const year = parseInt(slashMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          !isNaN(date.getTime()) &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // ISO date YYYY-MM-DD. Build a LOCAL-midnight Date from the parts, the
    // same as the MM/DD/YYYY and MM-DD-YYYY branches. `new Date('YYYY-MM-DD')`
    // parses as UTC midnight, which then shifts the calendar day once the value
    // is serialised on a non-UTC device — so we construct from components to
    // keep every parse path on a consistent local-midnight basis.
    const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (isoMatch) {
      const year = parseInt(isoMatch[1], 10);
      const month = parseInt(isoMatch[2], 10) - 1;
      const day = parseInt(isoMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          !isNaN(date.getTime()) &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // MM-DD-YYYY with dashes
    const dashMatch = trimmed.match(/^(\d{1,2})-(\d{1,2})-(\d{4})$/);
    if (dashMatch) {
      const month = parseInt(dashMatch[1], 10) - 1;
      const day = parseInt(dashMatch[2], 10);
      const year = parseInt(dashMatch[3], 10);
      if (month >= 0 && month <= 11 && day >= 1 && day <= 31) {
        const date = new Date(year, month, day);
        if (
          !isNaN(date.getTime()) &&
          date.getMonth() === month &&
          date.getDate() === day
        ) {
          return date;
        }
      }
    }

    // Last resort
    const date = new Date(trimmed);
    return isNaN(date.getTime()) ? null : date;
  }

  return null;
};

// Format a Date to a 'YYYY-MM-DD' string from its LOCAL calendar fields. IDT
// purchase/transfer dates are date-only; using toISOString() here converts to
// UTC and shifts the day on non-UTC devices (a local-midnight Date in UTC+8
// serialises to the previous day). parseExcelDate yields local-midnight Dates,
// so local getters reproduce the exact calendar day the user typed in the sheet.
const formatLocalDateOnly = date => {
  if (!(date instanceof Date) || isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  return `${year}-${month}-${day}`;
};

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
    const {deviceId, branchId} = await getCloudSyncParams();
    const {
      id: importedByAccountId,
      firstName: importedByFirstName,
      lastName: importedByLastName,
      email: importedByEmail,
      isRoot: importedByIsRoot,
    } = await loadCurrentAccountIdentity();
    const idtImportId = uuid.v4();
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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item without category name value`;

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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item without item name value`;

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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item without unit of measurement (uom_abbrev) value`;

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
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains unsupported unit "${item.uom_abbrev}". Use one of: ml, mg, kg, pc, and so on. Found an item named "${item.item_name}" with invalid UOM Abbrev value`;

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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid UOM. You can only use Item UOM Per Piece and Qty Per Piece if the item UOM value is "PC". Found an item named "${item.item_name}" with invalid UOM value`;

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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid UOM. You can only use Item UOM Per Piece and Qty Per Piece if the item UOM value is "PC". Found an item named "${item.item_name}" with invalid UOM value`;

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
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid values. Item "UOM Per Piece" is required if "Qty Per Piece" has a value, and vice versa. Found an item named "${item.item_name}" with invalid values`;

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
            let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains unsupported UOM Per Piece "${item.uom_abbrev_per_piece}". Use one of: ml, mg, kg, pc, and so on. Found an item named "${item.item_name}" with invalid UOM Per Piece value`;

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
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid Qty Per Piece value. Valid quantity should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid Qty Per Piece value`;

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
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid unit cost format. Valid unit cost should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid unit cost value`;

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
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid total cost format. Valid total cost should be in decimal format e.g., 200, 200.75. Found an item named "${item.item_name}" with invalid total cost value`;

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
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid stock quantity value. Valid stock quantity should be in decimal format e.g., 20, 20.75. Found an item named "${item.item_name}" with invalid stock quantity value`;

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

      /* Validate mutual exclusivity: cannot have both purchase_date and transfer_in_date */
      if (item.purchase_date && item.transfer_in_date) {
        listItemError = true;
        let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with both Purchase Date and Transfer In Date. An item cannot have both dates in the same row...`;
        if (item.count) {
          errorMessage += ` on count number ${item.count} of the list.`;
        } else {
          errorMessage += '.';
        }
        onError && onError({errorMessage});
        return;
      }

      /* DEBUG: Log purchase date value */
      if (item.purchase_date) {
        console.log('DEBUG - Purchase Date Info:');
        console.log('  Item:', item.item_name);
        console.log('  Raw Value:', item.purchase_date);
        console.log('  Type:', typeof item.purchase_date);
        console.log('  Is Number:', typeof item.purchase_date === 'number');
        console.log(
          '  String Test:',
          /^\d+(\.\d+)?$/.test(String(item.purchase_date)),
        );
      }

      /* Validate purchase date */
      if (item.purchase_date) {
        // Parse the date using helper function
        const purchaseDate = parseExcelDate(item.purchase_date);

        if (!purchaseDate || isNaN(purchaseDate.getTime())) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid purchase date format. Valid date formats include: YYYY-MM-DD (e.g., 2024-01-15), MM/DD/YYYY (e.g., 01/15/2024), or Excel date format. Found an item named "${item.item_name}" with invalid purchase date value`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.purchase_date}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }

        // Validate that purchase date is not in the future
        const today = new Date();
        today.setHours(0, 0, 0, 0); // Start of today

        if (purchaseDate > today) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with purchase date in the future. Purchase date cannot be later than today. Found an item named "${item.item_name}" with future purchase date`;

          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.purchase_date}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }
      }

      /* Validate transfer in date */
      if (item.transfer_in_date) {
        const transferInDate = parseExcelDate(item.transfer_in_date);

        if (!transferInDate || isNaN(transferInDate.getTime())) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with invalid transfer in date format...`;
          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.transfer_in_date}.`;
          } else {
            errorMessage += '.';
          }
          onError && onError({errorMessage});
          return;
        }

        const today = new Date();
        today.setHours(0, 0, 0, 0);
        if (transferInDate > today) {
          listItemError = true;
          let errorMessage = `Your ${appDefaults.appDisplayName} IDT item list contains item with transfer in date in the future...`;
          if (item.count) {
            errorMessage += ` on count number ${item.count} of the list. Invalid value: ${item.transfer_in_date}.`;
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
     * Get all categories from db (active only — soft-deleted rows must not
     * count as existing, or imports would link to / skip deleted records).
     */
    let categoriesFromDb = await getAllDataFromDb('active_categories');

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
          id,
          name,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (let index = 0; index < notExistingCategoriesName.length; index++) {
        let notExistingCategoryName = notExistingCategoriesName[index];
        insertedCategoriesName.push(notExistingCategoryName);

        const newCategoryId = uuid.v4();
        insertNotExistingCategoriesNameToDbQuery += `(
        '${newCategoryId}',
        '${notExistingCategoryName.replace(/\'/g, "''")}',
        ${deviceId ? `'${deviceId}'` : 'NULL'},
        ${branchId ? `'${branchId}'` : 'NULL'},
        '${newCategoryId}',
        CURRENT_TIMESTAMP
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
    categoriesFromDb = await getAllDataFromDb('active_categories');

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
     * Get all taxes from db (active only)
     */
    let taxesFromDb = await getAllDataFromDb('active_taxes');

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
          id,
          name,
          rate_percentage,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (let index = 0; index < notExistingTaxes.length; index++) {
        let notExistingTax = notExistingTaxes[index];
        insertedTaxes.push(notExistingTax);

        const newTaxId = uuid.v4();
        insertNotExistingTaxesToDbQuery += `(
          '${newTaxId}',
          '${notExistingTax?.tax_name.replace(/\'/g, "''")}',
          ${parseFloat(notExistingTax?.tax_rate_percentage) || 0},
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newTaxId}',
          CURRENT_TIMESTAMP
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
    taxesFromDb = await getAllDataFromDb('active_taxes');

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
     * Get all vendors from db (active only)
     */
    let vendorsFromDb = await getAllDataFromDb('active_vendors');

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
          id,
          vendor_display_name,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (let index = 0; index < notExistingVendorsName.length; index++) {
        let notExistingVendorName = notExistingVendorsName[index];
        insertedVendorsName.push(notExistingVendorName);

        const newVendorId = uuid.v4();
        insertNotExistingVendorsNameToDbQuery += `(
          '${newVendorId}',
          '${notExistingVendorName.replace(/\'/g, "''")}',
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newVendorId}',
          CURRENT_TIMESTAMP
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
    vendorsFromDb = await getAllDataFromDb('active_vendors');

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
     * Get all items from db (active only — a soft-deleted item must NOT be
     * treated as already existing, otherwise re-importing a previously deleted
     * item is skipped as a duplicate).
     */
    let itemsFromDb = await getAllDataFromDb('active_items');

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
    // Mirror of items rows we're about to insert — written into master_items
    // immediately after the items INSERT so each imported item has a canonical
    // company-wide catalog entry, the same shape registerItem produces.
    const masterItemRowsToInsert = [];

    // Cross-branch dedup: probe the local active_master_items view for any
    // canonical master that already covers the variant tuple we're about to
    // import. Branches typically pull the company's master catalog via sync
    // before importing — so when Branch B imports the same IDT Branch A
    // already imported, every row in this map skips the master INSERT and
    // links to Branch A's master via the same sync_id + sku. The server
    // re-checks on push as a race-safety net for concurrent imports.
    //
    // Tolerated when the column doesn't exist (pre-migration DBs): falls
    // through with an empty map and behaves like the old code path.
    const existingMastersByDedupKey = new Map();
    try {
      const [mastersRes] = await db.executeSql(
        `SELECT sync_id, sku, dedup_key FROM active_master_items WHERE dedup_key IS NOT NULL AND dedup_key != ''`,
      );
      for (let i = 0; i < mastersRes.rows.length; i++) {
        const row = mastersRes.rows.item(i);
        if (!existingMastersByDedupKey.has(row.dedup_key)) {
          existingMastersByDedupKey.set(row.dedup_key, {
            sync_id: row.sync_id,
            sku: row.sku,
          });
        }
      }
    } catch (probeErr) {
      console.debug(
        '[insertTemplateDataToDb] master_items dedup probe failed (likely pre-migration DB):',
        probeErr?.message ?? probeErr,
      );
    }
    let mergedMasterCount = 0;

    if (notExistingItems.length > 0) {
      let insertNotExistingItemsToDbQuery = `
        INSERT INTO items (
          id,
          category_id,
          tax_id,
          preferred_vendor_id,
          name,
          uom_abbrev,
          unit_cost,
          uom_abbrev_per_piece,
          qty_per_piece,
          barcode,
          packaging_type,
          sku,
          master_item_sync_id,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (let index = 0; index < notExistingItems.length; index++) {
        let item = notExistingItems[index];

        const categoryId = categoriesIdMap[item.category_name.toLowerCase()]
          ? categoriesIdMap[item.category_name.toLowerCase()]
          : 'null';

        const taxId =
          item.tax_name && taxesIdMap[item.tax_name.toLowerCase()]
            ? taxesIdMap[item.tax_name.toLowerCase()]
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
            ? vendorsIdMap[item.vendor_name.toLowerCase()]
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

        // Variant-defining values for both items + master_items. Trim and
        // lowercase to match registerItem's normalization so two branches that
        // pick the same master see consistent data.
        const packagingTypeRaw = String(item.packaging_type ?? '').trim().toLowerCase();
        const barcodeRaw = String(item.barcode ?? '').trim();
        const packagingTypeSql = packagingTypeRaw.replace(/'/g, "''");
        const barcodeSql = barcodeRaw.replace(/'/g, "''");

        // Computed up front because dedup key depends on it. NULL for the
        // master qty column means "no per-piece variant" — distinct from
        // qty=0, which would imply a zero-quantity per-piece identity.
        const qtyPerPieceNumber = parseFloat(extractNumber(item.qty_per_piece));
        const hasQtyPerPiece =
          !isNaN(qtyPerPieceNumber) &&
          qtyPerPieceNumber > 0 &&
          item.qty_per_piece !== '-';

        // Master Item List link. First try the existing-masters map (seeded
        // from active_master_items above, plus any master we created earlier
        // in this same IDT pass). On match we reuse the canonical sync_id +
        // sku — the items row attaches to the same master as every other
        // branch that imported this product. On miss, generate fresh ones
        // and seed the map so a downstream row in this same IDT with an
        // identical dedup tuple still collapses to one master.
        const rowDedupKey = generateMasterItemDedupKey({
          name: item.item_name,
          uom_abbrev: uomAbbrev.toLowerCase(),
          uom_abbrev_per_piece: uomAbbrevPerPiece.toLowerCase(),
          qty_per_piece: hasQtyPerPiece ? qtyPerPieceNumber : null,
          packaging_type: packagingTypeRaw,
          barcode: barcodeRaw,
        });
        const matchedMaster = rowDedupKey
          ? existingMastersByDedupKey.get(rowDedupKey)
          : null;

        const generatedSku = matchedMaster
          ? String(matchedMaster.sku ?? '')
          : generateMasterItemSku(item.item_name);
        const newMasterItemSyncId = matchedMaster
          ? String(matchedMaster.sync_id)
          : uuid.v4();
        const skuSqlLiteral = generatedSku.replace(/'/g, "''");

        const newItemId = uuid.v4();
        insertNotExistingItemsToDbQuery += `(
          '${newItemId}',
          '${categoryId}',
          '${taxId}',
          '${vendorId}',
          '${item.item_name.trim().replace(/\'/g, "''")}',
          '${uomAbbrev.toLowerCase()}',
          ${unitCost},
          '${uomAbbrevPerPiece.toLowerCase()}',
          ${qtyPerPiece},
          '${barcodeSql}',
          '${packagingTypeSql}',
          '${skuSqlLiteral}',
          '${newMasterItemSyncId}',
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newItemId}',
          CURRENT_TIMESTAMP
        )`;

        // Stash a parallel master_items row — but only when we're creating a
        // brand-new master. When matchedMaster is set, the items row above
        // already links to an existing canonical master via the reused
        // sync_id + sku, so emitting another master_items row would just
        // recreate the duplicate we're trying to prevent.
        if (matchedMaster) {
          mergedMasterCount++;
        } else {
          masterItemRowsToInsert.push({
            syncId: newMasterItemSyncId,
            sku: generatedSku,
            itemName: item.item_name,
            uomAbbrev: uomAbbrev.toLowerCase(),
            uomAbbrevPerPiece: uomAbbrevPerPiece.toLowerCase(),
            qtyPerPieceNumber: hasQtyPerPiece ? qtyPerPieceNumber : null,
            qtyPerPieceSql: hasQtyPerPiece ? String(qtyPerPieceNumber) : 'NULL',
            packagingType: packagingTypeRaw,
            barcode: barcodeRaw,
            dedupKey: rowDedupKey,
          });
          // Seed the lookup so a later row in this same IDT with the same
          // dedup tuple collapses onto the master we just generated.
          if (rowDedupKey) {
            existingMastersByDedupKey.set(rowDedupKey, {
              sync_id: newMasterItemSyncId,
              sku: generatedSku,
            });
          }
        }

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

      // Mirror every newly-inserted items row into master_items, the same way
      // registerItem's no-picker path does. Non-fatal — if the master INSERT
      // fails for any reason, the items rows are already saved; the masters
      // can be backfilled later by `php artisan masteritems:backfill`.
      if (masterItemRowsToInsert.length > 0) {
        try {
          const registeredByAccountId = await loadCurrentAccountId();
          const escapeSql = s => String(s ?? '').replace(/'/g, "''");
          let insertMasterItemsQuery = `INSERT INTO master_items (
            id,
            sku,
            name,
            description,
            barcode,
            uom_abbrev,
            uom_abbrev_per_piece,
            qty_per_piece,
            packaging_type,
            dedup_key,
            registered_by_account_id,
            device_id,
            branch_id,
            sync_id,
            updated_at
          ) VALUES `;

          masterItemRowsToInsert.forEach((row, idx) => {
            // Strip+recompose so an IDT row like "Argentina Corned Beef Can 260g"
            // with packaging=can and qty=260g doesn't end up with duplicated
            // tokens in the canonical description.
            const description = escapeSql(
              generateMasterItemDescription({
                name: row.itemName,
                uom_abbrev: row.uomAbbrev,
                uom_abbrev_per_piece: row.uomAbbrevPerPiece,
                qty_per_piece: row.qtyPerPieceNumber,
                packaging_type: row.packagingType,
              }),
            );
            const skuSql = escapeSql(row.sku);
            const nameSql = escapeSql(row.itemName);
            const barcodeSql = escapeSql(row.barcode);
            const uomAbbrevSql = escapeSql(row.uomAbbrev);
            const uomAbbrevPerPieceSql = escapeSql(row.uomAbbrevPerPiece);
            const packagingTypeSql = escapeSql(row.packagingType);
            const dedupKeySql = escapeSql(row.dedupKey);

            insertMasterItemsQuery += `(
              '${row.syncId}',
              '${skuSql}',
              '${nameSql}',
              '${description}',
              '${barcodeSql}',
              '${uomAbbrevSql}',
              '${uomAbbrevPerPieceSql}',
              ${row.qtyPerPieceSql},
              '${packagingTypeSql}',
              '${dedupKeySql}',
              ${registeredByAccountId ? `'${registeredByAccountId}'` : 'NULL'},
              ${deviceId ? `'${deviceId}'` : 'NULL'},
              ${branchId ? `'${branchId}'` : 'NULL'},
              '${row.syncId}',
              CURRENT_TIMESTAMP
            )`;

            insertMasterItemsQuery +=
              idx === masterItemRowsToInsert.length - 1 ? ';' : ',';
          });

          await db.executeSql(insertMasterItemsQuery);
        } catch (masterErr) {
          console.debug(
            '[insertTemplateDataToDb] Failed to insert master_items rows:',
            masterErr?.message ?? masterErr,
          );
        }
      }
    }

    /**
     * Get all inserted items from db.
     */
    const insertedItemsFromDb = await getAllDataFromDb('active_items', {
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
       * Insert audit row for this IDT import event. Every inventory_logs row
       * below stamps the same idt_import_id so the UI can group logs by the
       * import that produced them and surface importer + date provenance.
       */
      const toSqlText = value =>
        value ? `'${String(value).replace(/'/g, "''")}'` : 'NULL';
      const insertIdtImportQuery = `
        INSERT INTO inventory_data_template_imports (
          id,
          imported_by_account_id,
          imported_by_first_name,
          imported_by_last_name,
          imported_by_email,
          imported_by_is_root,
          imported_at,
          device_id,
          branch_id,
          sync_id,
          updated_at
        ) VALUES (
          '${idtImportId}',
          ${importedByAccountId ? `'${importedByAccountId}'` : 'NULL'},
          ${toSqlText(importedByFirstName)},
          ${toSqlText(importedByLastName)},
          ${toSqlText(importedByEmail)},
          ${importedByIsRoot ? 1 : 0},
          CURRENT_TIMESTAMP,
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${idtImportId}',
          CURRENT_TIMESTAMP
        );
      `;
      await db.executeSql(insertIdtImportQuery);

      /**
       * Insert inventory logs for imported items
       * - operation_id initial_stock UUID - when no purchase date
       * - operation_id new_purchase UUID - when purchase date is provided
       * - operation_id stock_transfer_in UUID - when transfer_in_date is provided
       */
      let insertInventoryLogsQuery = `
        INSERT INTO inventory_logs (
          id,
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
          remarks,
          idt_import_id,
          device_id,
          branch_id,
          sync_id,
          updated_at
        )

        VALUES
      `;

      for (let index = 0; index < notExistingItems.length; index++) {
        let item = notExistingItems[index];

        const itemId = insertedItemsIdMap[item.item_name.toLowerCase()]
          ? insertedItemsIdMap[item.item_name.toLowerCase()]
          : 'null';

        const categoryId = categoriesIdMap[item.category_name.toLowerCase()]
          ? categoriesIdMap[item.category_name.toLowerCase()]
          : 'null';

        const taxId =
          item.tax_name && taxesIdMap[item.tax_name.toLowerCase()]
            ? taxesIdMap[item.tax_name.toLowerCase()]
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
            ? vendorsIdMap[item.vendor_name.toLowerCase()]
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

        const remarks = item.remarks
          ? `'${item?.remarks?.replace(/\'/g, "''")}'`
          : 'null';

        /* Create inventory log */
        let operationId;
        let adjustmentDateValue;
        let beginningInventoryDateValue;

        if (item.purchase_date) {
          operationId = OPERATION_DEFAULT_UUIDS.new_purchase;
          const purchaseDate = parseExcelDate(item.purchase_date);
          const purchaseDateLocal = formatLocalDateOnly(purchaseDate);
          adjustmentDateValue = `datetime('${purchaseDateLocal}')`;
          beginningInventoryDateValue = 'null';
        } else if (item.transfer_in_date) {
          operationId = OPERATION_DEFAULT_UUIDS.stock_transfer_in;
          const transferInDate = parseExcelDate(item.transfer_in_date);
          const transferInDateLocal = formatLocalDateOnly(transferInDate);
          adjustmentDateValue = `datetime('${transferInDateLocal}')`;
          beginningInventoryDateValue = 'null';
        } else {
          operationId = OPERATION_DEFAULT_UUIDS.initial_stock;
          beginningInventoryDateValue = beginningInventoryDate
            ? `datetime('${beginningInventoryDate}', 'start of month')`
            : `datetime('now', 'localtime', 'start of month')`;
          adjustmentDateValue = beginningInventoryDate
            ? `datetime('${beginningInventoryDate}', 'start of month', '-1 day')`
            : `datetime('now', 'localtime', 'start of month', '-1 day')`;
        }

        const newInvLogId = uuid.v4();
        insertInventoryLogsQuery += `(
          '${newInvLogId}',
          '${operationId}',
          '${itemId}',
          '${taxId}',
          '${vendorId}',
          ${vendorName},
          ${officialReceiptNumber},
          ${unitCost},
          ${unitCostNet},
          ${unitCostTax},
          ${taxRatePercentage},
          ${taxName},
          ${initialStockQty},
          ${adjustmentDateValue},
          ${beginningInventoryDateValue},
          ${remarks},
          '${idtImportId}',
          ${deviceId ? `'${deviceId}'` : 'NULL'},
          ${branchId ? `'${branchId}'` : 'NULL'},
          '${newInvLogId}',
          CURRENT_TIMESTAMP
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
    // Sentence about master-list dedup is appended only when something
    // actually got merged so unrelated imports stay quiet.
    const mergedSentence =
      mergedMasterCount > 0
        ? ` ${mergedMasterCount} new item${
            mergedMasterCount > 1 ? 's were' : ' was'
          } linked to existing item${
            mergedMasterCount > 1 ? 's' : ''
          } in the company-wide Master Item List (no duplicate was created).`
        : '';

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
        }.${mergedSentence}`,
      });
  } catch (error) {
    console.debug(error);
    throw Error('Failed to insert template data to db.');
  }
};
