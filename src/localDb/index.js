import {
  enablePromise,
  openDatabase,
  SQLiteDatabase,
} from 'react-native-sqlite-storage';
import SecureStorage from 'react-native-fast-secure-storage';
import RNFS from 'react-native-fs';
import AsyncStorage from '@react-native-async-storage/async-storage';

import {appDefaults} from '../constants/appDefaults';
import {rnStorageKeys} from '../constants/rnSecureStorageKeys';

const {
  cloudV2DeviceId: cloudV2DeviceIdKey,
  cloudV2DesignatedBranch: cloudV2DesignatedBranchKey,
} = rnStorageKeys;

const loadCloudV2Item = async (key, parse = false) => {
  try {
    const has = await SecureStorage.hasItem(key);
    if (!has) return null;
    const raw = await SecureStorage.getItem(key);
    if (!raw) return null;
    if (parse) {
      try {
        return JSON.parse(raw);
      } catch {
        return null;
      }
    }
    return raw;
  } catch {
    return null;
  }
};

let _cloudSyncParamsCache = null;

/**
 * Returns the current Cloud v2 device ID and branch ID from SecureStorage.
 * Results are cached for the lifetime of the JS bundle (invalidated on sign-out
 * via invalidateCloudSyncParamsCache).
 */
export const getCloudSyncParams = async () => {
  if (_cloudSyncParamsCache !== null) return _cloudSyncParamsCache;
  const deviceId = await loadCloudV2Item(cloudV2DeviceIdKey);
  const branch = await loadCloudV2Item(cloudV2DesignatedBranchKey, true);
  _cloudSyncParamsCache = {
    deviceId: deviceId ?? null,
    branchId: branch?.id != null ? String(branch.id) : null,
  };
  return _cloudSyncParamsCache;
};

export const invalidateCloudSyncParamsCache = () => {
  _cloudSyncParamsCache = null;
};

enablePromise(true);

const localAccountDbName = appDefaults.localAccountDbName;

// Active company/branch IDs set by CloudAuthContextProvider on sign-in/restore.
// Each company+branch pair gets its own SQLite file so that data from different
// branches (and companies) on the same device is fully isolated.
let _activeCompanyId = null;
let _activeBranchId = null;

// Sets the active company+branch and ensures that DB tables exist before
// returning. Must be awaited before dispatching auth state changes so that
// components never open a DB that hasn't been initialised yet.
export const getActiveCompanyId = () => _activeCompanyId;
export const getActiveBranchId = () => _activeBranchId;

export const setActiveCompanyDb = async (companyId, branchId = null) => {
  _activeCompanyId = companyId ?? null;
  _activeBranchId = branchId ?? null;
  if (_activeCompanyId && _activeBranchId) {
    await migrateCompanyDbToBranchScopedDb(_activeCompanyId, _activeBranchId);
  }
  if (_activeCompanyId) {
    try {
      // createTables / alterTables are defined later in this file but are
      // already in scope by the time this function is called at runtime.
      await createTables();
      await alterTables();
      await createViews();
    } catch (e) {
      console.debug('[localDb] setActiveCompanyDb init error:', e);
    }
  }
};

export const getDBConnection = async () => {
  let name = appDefaults.dbName; // unauthenticated fallback
  if (_activeCompanyId && _activeBranchId) {
    name = `${appDefaults.dbName}_${_activeCompanyId}_${_activeBranchId}`;
  } else if (_activeCompanyId) {
    name = `${appDefaults.dbName}_${_activeCompanyId}`;
  }
  return openDatabase({name, location: 'default', readOnly: false});
};

// Renames the legacy company-only DB file to the new company+branch filename so
// existing users keep their data after the branch-scoped naming change.
// Uses moveFile (atomic rename) so no orphan is left behind. If the new file
// already exists the old one is simply deleted. Safe to call on every startup —
// once the old file is gone the RNFS.exists checks exit immediately.
//
// Also migrates the units_<companyId> AsyncStorage key to
// units_<companyId>_<branchId> in the same window: units written during the
// brief "signed in but no branch yet" phase would otherwise be orphaned and
// the user would see only default UoMs on the new branch.
const migrateCompanyDbToBranchScopedDb = async (companyId, branchId) => {
  try {
    const parts = RNFS.DocumentDirectoryPath.split('/');
    parts.pop();
    parts.push('databases');
    const databasesDir = parts.join('/');

    const oldPath = `${databasesDir}/${appDefaults.dbName}_${companyId}`;
    const newPath = `${databasesDir}/${appDefaults.dbName}_${companyId}_${branchId}`;

    const [oldExists, newExists] = await Promise.all([
      RNFS.exists(oldPath),
      RNFS.exists(newPath),
    ]);

    if (!newExists && oldExists) {
      await RNFS.moveFile(oldPath, newPath);
    } else if (newExists && oldExists) {
      await RNFS.unlink(oldPath);
    }

    // Migrate the AsyncStorage units key alongside the DB file. Only copy when
    // the branch-scoped key does not yet exist so we never clobber an
    // intentional newer set.
    try {
      const oldUnitsKey = `units_${companyId}`;
      const newUnitsKey = `units_${companyId}_${branchId}`;
      const [legacyUnits, scopedUnits] = await Promise.all([
        AsyncStorage.getItem(oldUnitsKey),
        AsyncStorage.getItem(newUnitsKey),
      ]);
      if (legacyUnits && !scopedUnits) {
        await AsyncStorage.setItem(newUnitsKey, legacyUnits);
      }
      if (legacyUnits) {
        await AsyncStorage.removeItem(oldUnitsKey);
      }
    } catch (unitsErr) {
      console.debug('[localDb] units key migration error:', unitsErr);
    }
  } catch (e) {
    console.debug('[localDb] migrateCompanyDbToBranchScopedDb error:', e);
  }
};

export const getLocalAccountDBConnection = async () => {
  return openDatabase({
    name: localAccountDbName,
    location: 'default',
    readOnly: false,
  });
};

export const createLocalAccountTables = async () => {
  let db;

  try {
    db = await getLocalAccountDBConnection();
  } catch (error) {
    throw error;
  }

  // create table if not exists
  const createRolesTableQuery = `CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_uid VARCHAR,
    name VARCHAR,
    role_config_json VARCHAR,
    app_version VARCHAR,
    is_app_default INTEGER DEFAULT 0
  );`;

  /**
   * Deprecated fields:
   * - role, in favor of role_id
   */
  const createAccountsTableQuery = `CREATE TABLE IF NOT EXISTS accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    account_uid VARCHAR,
    username VARCHAR,
    password VARCHAR,
    role VARCHAR,
    company_id INTEGER,
    company_uid VARCHAR,
    is_root_account INTEGER DEFAULT 0,
    profile_photo_path VARCHAR,

    first_name VARCHAR,
    last_name VARCHAR,
    email VARCHAR,
    is_deactivated INTEGER DEFAULT 0,
    reset_key VARCHAR,
    role_id VARCHAR,
    role_config_json VARCHAR,
    is_using_given_password INTEGER DEFAULT 1,

    CONSTRAINT fk_company
    FOREIGN KEY (company_id)
    REFERENCES companies(id),

    CONSTRAINT fk_role
    FOREIGN KEY (role_id)
    REFERENCES roles(id)
  );`;

  const createCompaniesTableQuery = `CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_uid VARCHAR,
    company_name VARCHAR,
    company_display_name VARCHAR,
    company_address VARCHAR,
    company_mobile_number VARCHAR,
    company_email VARCHAR,
    company_logo_path VARCHAR,
    branch VARCHAR
  );`;

  // Settings are now company-scoped (see createSettingsTableQuery at module level)
  const createSettingsTableQuery = `CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    value VARCHAR,
    setting_group VARCHAR,
    setting_sub_group VARCHAR,
    app_version VARCHAR
  );`;

  try {
    await db.executeSql(createRolesTableQuery);
    await db.executeSql(createAccountsTableQuery);
    await db.executeSql(createCompaniesTableQuery);
    await db.executeSql(createSettingsTableQuery);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

/**
 * Create App Table Queries
 */

const createAppVersionsTableQuery = `
  CREATE TABLE IF NOT EXISTS app_versions (
    id TEXT PRIMARY KEY NOT NULL,
    version VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL
  );
`;

const createCategoriesTableQuery = `
  CREATE TABLE IF NOT EXISTS categories (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR,
    category_photo_path VARCHAR,
    icon VARCHAR,
    color VARCHAR,
    is_active INTEGER DEFAULT 1,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createTaxesTableQuery = `
  CREATE TABLE IF NOT EXISTS taxes (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR,
    rate_percentage REAL,
    app_version VARCHAR,
    is_compound_tax INTEGER DEFAULT 0,
    is_app_default INTEGER DEFAULT 0,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createVendorsTableQuery = `
  CREATE TABLE IF NOT EXISTS vendors (
    id TEXT PRIMARY KEY NOT NULL,
    salutation VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    company_name VARCHAR,
    vendor_display_name VARCHAR,
    tin VARCHAR,
    email VARCHAR,
    phone_number VARCHAR(50),
    mobile_number VARCHAR(50),
    remarks VARCHAR(120),
    is_active INTEGER DEFAULT 1,
    vendor_photo_path VARCHAR,
    icon VARCHAR,
    color VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createVendorContactPersonsTableQuery = `
  CREATE TABLE IF NOT EXISTS vendor_contact_persons (
    id TEXT PRIMARY KEY NOT NULL,
    vendor_id TEXT,
    salutation VARCHAR,
    first_name VARCHAR,
    last_name VARCHAR,
    email VARCHAR,
    phone_number VARCHAR(50),
    mobile_number VARCHAR(50),
    designation VARCHAR(120),
    department VARCHAR(120),
    notes VARCHAR(120),
    contact_photo_path VARCHAR,
    icon VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_vendor
    FOREIGN KEY (vendor_id)
    REFERENCES vendors(id)
  );
`;

/**
 * NOTE: To avoid massive refactoring of code, we did not change
 * the name of other item's field, but here's the list of the fields
 * that should have been updated with the corresponding new names:
 *
 * unit_cost - (Should be last_unit_cost)
 * tax_id - (Should be default_tax_id)
 * preferred_vendor_id - (Can be renamed to default_vendor_id but not necessarily)
 */
const createItemsTableQuery = `
  CREATE TABLE IF NOT EXISTS items (
    id TEXT PRIMARY KEY NOT NULL,
    is_archived INTEGER DEFAULT 0,
    category_id TEXT,
    is_sub_recipe INTEGER DEFAULT 0,
    is_non_food INTEGER DEFAULT 0,
    is_finished_product INTEGER DEFAULT 0,
    finished_product_origin_id TEXT,
    finished_product_origin_table VARCHAR,
    recipe_id TEXT,
    sub_recipe_id TEXT,
    yield_ref_id VARCHAR,
    item_photo_path VARCHAR,
    icon VARCHAR,
    color VARCHAR,
    name VARCHAR NOT NULL,
    barcode VARCHAR,
    uom_abbrev VARCHAR,
    unit_cost REAL,
    uom_abbrev_per_piece VARCHAR,
    qty_per_piece REAL,
    tax_id TEXT,
    preferred_vendor_id TEXT,
    initial_stock_qty REAL,
    current_stock_qty REAL,
    low_stock_level REAL,
    unit_selling_price REAL,
    packaging_type VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id),

    CONSTRAINT fk_tax
    FOREIGN KEY (tax_id)
    REFERENCES taxes(id),

    CONSTRAINT fk_vendor
    FOREIGN KEY (preferred_vendor_id)
    REFERENCES vendors(id),

    CONSTRAINT fk_recipe
    FOREIGN KEY (recipe_id)
    REFERENCES recipes(id),

    CONSTRAINT fk_sub_recipe
    FOREIGN KEY (sub_recipe_id)
    REFERENCES recipes(id)
  );
`;

const createModifiersTableQuery = `
  CREATE TABLE IF NOT EXISTS modifiers (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR NOT NULL,
    item_id TEXT,
    is_app_default INTEGER DEFAULT 0,
    type_ref VARCHAR,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

const createModifierOptionsTableQuery = `
  CREATE TABLE IF NOT EXISTS modifier_options (
    id TEXT PRIMARY KEY NOT NULL,
    modifier_id TEXT,
    option_name VARCHAR NOT NULL,
    option_selling_price REAL,
    in_option_qty REAL,
    in_option_qty_uom_abbrev VARCHAR NOT NULL,
    in_option_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_modifier
    FOREIGN KEY (modifier_id)
    REFERENCES modifiers(id)
  );
`;

const createBatchPurchaseGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_purchase_groups (
    id TEXT PRIMARY KEY NOT NULL,
    confirmed INTEGER DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_confirmed DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createBatchPurchaseEntriesTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_purchase_entries (
    id TEXT PRIMARY KEY NOT NULL,
    batch_purchase_group_id TEXT,
    item_id TEXT,
    tax_id TEXT,
    vendor_id TEXT,
    add_stock_qty REAL NOT NULL,
    add_stock_unit_cost REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_batch_purchase_group
    FOREIGN KEY (batch_purchase_group_id)
    REFERENCES batch_purchase_groups(id),

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id),

    CONSTRAINT fk_tax
    FOREIGN KEY (tax_id)
    REFERENCES taxes(id),

    CONSTRAINT fk_vendor
    FOREIGN KEY (vendor_id)
    REFERENCES vendors(id)
  );
`;

const createBatchStockUsageGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_stock_usage_groups (
    id TEXT PRIMARY KEY NOT NULL,
    confirmed INTEGER DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_confirmed DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createBatchStockUsageEntriesTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_stock_usage_entries (
    id TEXT PRIMARY KEY NOT NULL,
    batch_stock_usage_group_id TEXT,
    item_id TEXT,
    remove_stock_qty REAL NOT NULL,
    remove_stock_unit_cost REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_batch_stock_usage_group
    FOREIGN KEY (batch_stock_usage_group_id)
    REFERENCES batch_stock_usage_groups(id),

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

/**
 * type VARCHAR: 'add_stock' | 'remove_stock'
 * name VARCHAR: e.g. 'New Purchase', 'Stock Transfer In', 'Stock Transfer Out'
 */
const createOperationsTableQuery = `
  CREATE TABLE IF NOT EXISTS operations (
    id TEXT PRIMARY KEY NOT NULL,
    code VARCHAR(100) DEFAULT NULL,
    type VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    app_version VARCHAR,
    list_item_order INTEGER,
    is_app_default INTEGER DEFAULT 0,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL
  );
`;

/**
 * ref_tax_id & ref_vendor_id below are for reference purpose only as it's name.
 * We have to save the actual adjustment's applied tax name, tax rate percentage,
 * vendor name, etc., because taxes and vendors are mutable and can be deleted.
 */

const createInventoryLogsTableQuery = `
  CREATE TABLE IF NOT EXISTS inventory_logs (
    id TEXT PRIMARY KEY NOT NULL,
    voided INTEGER DEFAULT 0,
    operation_id TEXT,
    item_id TEXT,
    recipe_id TEXT,
    yield_ref_id VARCHAR,
    ref_tax_id TEXT,
    ref_vendor_id TEXT,
    adjustment_unit_cost REAL DEFAULT 0,
    adjustment_unit_cost_net REAL DEFAULT 0,
    adjustment_unit_cost_tax REAL DEFAULT 0,
    adjustment_tax_rate_percentage REAL DEFAULT 0,
    adjustment_tax_name VARCHAR,
    adjustment_qty REAL NOT NULL,
    adjustment_date DATETIME,
    meta_use_measurement_per_piece INTEGER,
    meta_converted_from_uom_abbrev VARCHAR,
    meta_converted_from_qty REAL,
    beginning_inventory_date DATETIME,
    adjusted_by_account_uid VARCHAR,
    vendor_display_name VARCHAR,
    official_receipt_number VARCHAR,
    batch_purchase_group_id TEXT,
    batch_stock_usage_group_id TEXT,
    invoice_id TEXT,
    remarks VARCHAR(120),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_operation
    FOREIGN KEY (operation_id)
    REFERENCES operations(id),

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id),

    CONSTRAINT fk_recipe
    FOREIGN KEY (recipe_id)
    REFERENCES recipes(id),

    CONSTRAINT fk_batch_purchase_group
    FOREIGN KEY (batch_purchase_group_id)
    REFERENCES batch_purchase_groups(id),

    CONSTRAINT fk_invoice
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id)
  );
`;

const createInvoicesTableQuery = `
  CREATE TABLE IF NOT EXISTS invoices (
    id TEXT PRIMARY KEY NOT NULL,
    voided INTEGER DEFAULT 0,
    sold_by_account_uid VARCHAR,
    customer_id INTEGER,
    sales_order_group_id TEXT,
    remarks VARCHAR(120),
    invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createSaleLogsTableQuery = `
  CREATE TABLE IF NOT EXISTS sale_logs (
    id TEXT PRIMARY KEY NOT NULL,
    voided INTEGER DEFAULT 0,
    invoice_id TEXT,
    is_refunded INTEGER DEFAULT 0,
    refund_id TEXT,
    item_id TEXT,
    ref_tax_id TEXT,
    ref_customer_id INTEGER,
    sale_unit_selling_price REAL DEFAULT 0,
    sale_unit_selling_price_net REAL DEFAULT 0,
    sale_unit_selling_price_tax REAL DEFAULT 0,
    sale_size_name VARCHAR,
    sale_in_size_qty REAL,
    sale_in_size_qty_uom_abbrev VARCHAR,
    sale_tax_rate_percentage REAL DEFAULT 0,
    sale_tax_name VARCHAR,
    sale_qty REAL NOT NULL,
    sale_date DATETIME,
    sold_by_account_uid VARCHAR,
    remarks VARCHAR(120),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id),

    CONSTRAINT fk_invoice
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id),

    CONSTRAINT fk_refund
    FOREIGN KEY (refund_id)
    REFERENCES refunds(id)
  );
`;

const createSalesOrderGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS sales_order_groups (
    id TEXT PRIMARY KEY NOT NULL,
    voided INTEGER DEFAULT 0,
    sold_by_account_uid VARCHAR,
    customer_id INTEGER,
    remarks VARCHAR(120),
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createSalesOrdersTableQuery = `
  CREATE TABLE IF NOT EXISTS sales_orders (
    id TEXT PRIMARY KEY NOT NULL,
    voided INTEGER DEFAULT 0,
    invoice_id TEXT,
    sales_order_group_id TEXT,
    item_id TEXT,
    ref_tax_id TEXT,
    ref_customer_id INTEGER,
    order_unit_selling_price REAL DEFAULT 0,
    order_unit_selling_price_net REAL DEFAULT 0,
    order_unit_selling_price_tax REAL DEFAULT 0,
    order_size_name VARCHAR,
    order_in_size_qty REAL,
    order_in_size_qty_uom_abbrev VARCHAR,
    order_tax_rate_percentage REAL DEFAULT 0,
    order_tax_name VARCHAR,
    order_qty REAL NOT NULL,
    order_date DATETIME,
    fulfilled_order_qty REAL,
    sold_by_account_uid VARCHAR,
    remarks VARCHAR(120),
    meta_order_size_option_id TEXT,
    meta_use_measurement_per_piece INTEGER,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id),

    CONSTRAINT fk_invoice
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id),

    CONSTRAINT fk_sales_order_group
    FOREIGN KEY (sales_order_group_id)
    REFERENCES sales_order_groups(id)
  );
`;

const createPaymentsTableQuery = `
  CREATE TABLE IF NOT EXISTS payments (
    id TEXT PRIMARY KEY NOT NULL,
    invoice_id TEXT,
    payment_flow VARCHAR(255) DEFAULT 'in',
    payment_method VARCHAR(255) DEFAULT 'cash',
    payment_amount REAL,
    change_amount REAL DEFAULT 0,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    input_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_invoice
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id)
  );
`;

const createRefundsTableQuery = `
  CREATE TABLE IF NOT EXISTS refunds (
    id TEXT PRIMARY KEY NOT NULL,
    sale_log_id TEXT,
    refund_method VARCHAR,
    refund_amount REAL,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    input_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_sale_log
    FOREIGN KEY (sale_log_id)
    REFERENCES sale_logs(id)
  );
`;

const createSavedPrintersTableQuery = `
  CREATE TABLE IF NOT EXISTS saved_printers (
    id TEXT PRIMARY KEY NOT NULL,
    display_name VARCHAR,
    device_name VARCHAR,
    inner_mac_address VARCHAR,
    device_model VARCHAR,
    interface_type VARCHAR DEFAULT 'bluetooth',
    paper_width REAL DEFAULT 58,
    paper_width_uom_abbrev VARCHAR DEFAULT 'mm',
    auto_connect INTEGER DEFAULT 1,
    auto_print_receipt INTEGER DEFAULT 1,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL
  );
`;

const createRecipeKindsTableQuery = `
  CREATE TABLE IF NOT EXISTS recipe_kinds (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createRecipesTableQuery = `
  CREATE TABLE IF NOT EXISTS recipes (
    id TEXT PRIMARY KEY NOT NULL,
    is_draft INTEGER DEFAULT 1,
    is_sub_recipe INTEGER DEFAULT 0,
    recipe_kind_id TEXT,
    group_name VARCHAR,
    name VARCHAR,
    yield REAL DEFAULT 1,
    uom_abbrev VARCHAR,
    uom_abbrev_per_piece VARCHAR,
    qty_per_piece REAL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_saved DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_recipe_kind
    FOREIGN KEY (recipe_kind_id)
    REFERENCES recipe_kinds(id)
  );
`;

/**
 * in_recipe_qty_based_on_item_uom - (Should be converted_qty_based_on_item_uom)
 */
const createIngredientsTableQuery = `
  CREATE TABLE IF NOT EXISTS ingredients (
    id TEXT PRIMARY KEY NOT NULL,
    recipe_id TEXT,
    item_id TEXT,
    in_recipe_qty REAL NOT NULL,
    in_recipe_uom_abbrev VARCHAR,
    in_recipe_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_recipe
    FOREIGN KEY (recipe_id)
    REFERENCES recipes(id),

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

const createSpoilagesTableQuery = `
  CREATE TABLE IF NOT EXISTS spoilages (
    id TEXT PRIMARY KEY NOT NULL,
    item_id TEXT,
    in_spoilage_qty REAL NOT NULL,
    in_spoilage_uom_abbrev VARCHAR,
    in_spoilage_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER DEFAULT 0,
    in_spoilage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks VARCHAR(120),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

const createRevenueGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS revenue_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR NOT NULL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createRevenuesTableQuery = `
  CREATE TABLE IF NOT EXISTS revenues (
    id TEXT PRIMARY KEY NOT NULL,
    revenue_group_id TEXT,
    revenue_group_date DATETIME,
    amount REAL DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_revenue_group
    FOREIGN KEY (revenue_group_id)
    REFERENCES revenue_groups(id)
  );
`;

const createExpenseGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS expense_groups (
    id TEXT PRIMARY KEY NOT NULL,
    name VARCHAR NOT NULL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createExpensesTableQuery = `
  CREATE TABLE IF NOT EXISTS expenses (
    id TEXT PRIMARY KEY NOT NULL,
    expense_group_id TEXT,
    expense_group_date DATETIME,
    name VARCHAR NOT NULL,
    amount REAL DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_expense_group
    FOREIGN KEY (expense_group_id)
    REFERENCES expense_groups(id)
  );
`;

const createRevenueDeductionsTableQuery = `
  CREATE TABLE IF NOT EXISTS revenue_deductions (
    id TEXT PRIMARY KEY NOT NULL,
    revenue_group_id TEXT,
    expense_id TEXT,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_revenue_group
    FOREIGN KEY (revenue_group_id)
    REFERENCES revenue_groups(id),

    CONSTRAINT fk_expense
    FOREIGN KEY (expense_id)
    REFERENCES expenses(id)
  );
`;

const createRevenueCategoriesTableQuery = `
  CREATE TABLE IF NOT EXISTS revenue_categories (
    id TEXT PRIMARY KEY NOT NULL,
    revenue_group_id TEXT,
    category_id TEXT,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_revenue_grosup
    FOREIGN KEY (revenue_group_id)
    REFERENCES revenue_groups(id),

    CONSTRAINT fk_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
  );
`;

const createSellingMenusTableQuery = `
  CREATE TABLE IF NOT EXISTS selling_menus (
    id TEXT PRIMARY KEY NOT NULL,
    is_draft INTEGER DEFAULT 1,
    name VARCHAR,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_saved DATETIME,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const createSyncMetadataTableQuery = `
  CREATE TABLE IF NOT EXISTS sync_metadata (
    id TEXT PRIMARY KEY NOT NULL,
    entity_type VARCHAR(100) UNIQUE,
    last_pushed_at DATETIME DEFAULT NULL,
    last_pulled_at DATETIME DEFAULT NULL
  );
`;

const createSellingMenuItemsTableQuery = `
  CREATE TABLE IF NOT EXISTS selling_menu_items (
    id TEXT PRIMARY KEY NOT NULL,
    selling_menu_id TEXT,
    item_id TEXT,
    modifier_option_id TEXT,

    /*
      in_menu_qty is a multiplier of modifier_options.in_option_qty
      e.g.:

      item_name: "Coke"
      option_name: "Per Glass"
      in_option_qty: 8
      in_option_qty_uom_abbrev: "oz"
      in_menu_qty: 1

      It means:
      The menu includes 1 Glass (8 oz) of Coke.

      IF in_menu_qty is 2, with the same example above, it means:
      The menu includes 2 Glasses (8 oz each glass: a total of 16 oz) of Coke.
    */
    in_menu_qty REAL,

    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0,

    CONSTRAINT fk_selling_menu
    FOREIGN KEY (selling_menu_id)
    REFERENCES selling_menus(id),

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id),

    CONSTRAINT fk_modifier_option
    FOREIGN KEY (modifier_option_id)
    REFERENCES modifier_options(id)
  );
`;

const createSettingsTableQuery = `CREATE TABLE IF NOT EXISTS settings (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name VARCHAR,
  value VARCHAR,
  setting_group VARCHAR,
  setting_sub_group VARCHAR,
  app_version VARCHAR
);`;

// Local mirror of the centralized company-wide master item catalog. Each row
// represents a canonical product within the company; branch items (in the
// `items` table) link to a master entry via `master_item_sync_id` and
// denormalize the SKU into `items.sku` for offline display.
const createMasterItemsTableQuery = `
  CREATE TABLE IF NOT EXISTS master_items (
    id TEXT PRIMARY KEY NOT NULL,
    sku VARCHAR NOT NULL,
    description VARCHAR,
    barcode VARCHAR,
    uom_abbrev VARCHAR,
    uom_abbrev_per_piece VARCHAR,
    qty_per_piece REAL,
    packaging_type VARCHAR,
    registered_by_account_id VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    device_id VARCHAR DEFAULT NULL,
    branch_id VARCHAR DEFAULT NULL,
    sync_id VARCHAR(36) DEFAULT NULL,
    updated_at DATETIME DEFAULT NULL,
    synced_at DATETIME DEFAULT NULL,
    is_deleted INTEGER DEFAULT 0
  );
`;

const DELTA_SYNC_TABLES = [
  'taxes',
  'categories',
  'items',
  'master_items',
  'modifiers',
  'modifier_options',
  'vendors',
  'vendor_contact_persons',
  'recipe_kinds',
  'recipes',
  'ingredients',
  'selling_menus',
  'selling_menu_items',
  'inventory_logs',
  'batch_purchase_groups',
  'batch_purchase_entries',
  'batch_stock_usage_groups',
  'batch_stock_usage_entries',
  'invoices',
  'sale_logs',
  'sales_order_groups',
  'sales_orders',
  'payments',
  'refunds',
  'spoilages',
  'revenue_groups',
  'revenues',
  'expense_groups',
  'expenses',
  'revenue_deductions',
  'revenue_categories',
];

export const createViews = async () => {
  const db = await getDBConnection();
  for (const table of DELTA_SYNC_TABLES) {
    // DROP + CREATE so view-definition updates propagate to existing DBs.
    // NULL-safe: pulled records may carry is_deleted = NULL when the server
    // column was added after the row was created; without IFNULL these rows
    // would silently disappear from every screen using active_<table>.
    await db.executeSql(`DROP VIEW IF EXISTS active_${table}`);
    await db.executeSql(
      `CREATE VIEW active_${table} AS SELECT * FROM ${table} WHERE IFNULL(is_deleted, 0) != 1`,
    );
  }
};

export const createTables = async () => {
  let db;

  try {
    db = await getDBConnection();
  } catch (error) {
    throw error;
  }

  try {
    await db.executeSql(createAppVersionsTableQuery);
    await db.executeSql(createCategoriesTableQuery);
    await db.executeSql(createTaxesTableQuery);
    await db.executeSql(createVendorsTableQuery);
    await db.executeSql(createVendorContactPersonsTableQuery);
    await db.executeSql(createItemsTableQuery);
    await db.executeSql(createMasterItemsTableQuery);
    await db.executeSql(createBatchPurchaseGroupsTableQuery);
    await db.executeSql(createBatchPurchaseEntriesTableQuery);
    await db.executeSql(createBatchStockUsageGroupsTableQuery);
    await db.executeSql(createBatchStockUsageEntriesTableQuery);
    await db.executeSql(createOperationsTableQuery);
    await db.executeSql(createInventoryLogsTableQuery);
    await db.executeSql(createRecipeKindsTableQuery);
    await db.executeSql(createRecipesTableQuery);
    await db.executeSql(createIngredientsTableQuery);
    await db.executeSql(createSpoilagesTableQuery);
    await db.executeSql(createRevenueGroupsTableQuery);
    await db.executeSql(createRevenuesTableQuery);
    await db.executeSql(createExpenseGroupsTableQuery);
    await db.executeSql(createExpensesTableQuery);
    await db.executeSql(createRevenueDeductionsTableQuery);
    await db.executeSql(createRevenueCategoriesTableQuery);

    /** Sales */
    await db.executeSql(createInvoicesTableQuery);
    await db.executeSql(createSaleLogsTableQuery);
    await db.executeSql(createSalesOrderGroupsTableQuery);
    await db.executeSql(createSalesOrdersTableQuery);
    await db.executeSql(createPaymentsTableQuery);
    await db.executeSql(createRefundsTableQuery);
    await db.executeSql(createSavedPrintersTableQuery);
    await db.executeSql(createModifiersTableQuery);
    await db.executeSql(createModifierOptionsTableQuery);
    await db.executeSql(createSellingMenusTableQuery);
    await db.executeSql(createSellingMenuItemsTableQuery);
    await db.executeSql(createSyncMetadataTableQuery);
    await db.executeSql(createSettingsTableQuery);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const alterTables = async currentAppVersion => {
  let db;

  try {
    db = await getDBConnection();
  } catch (error) {
    throw error;
  }

  // Run the INTEGER→UUID migration before any other alterations.
  // The function is idempotent and skips if already migrated.
  try {
    await migrateIntegerIdsToUUID();
  } catch (error) {
    console.debug('[alterTables] UUID migration error:', error);
  }

  try {
    console.info(
      `Starting to alter tables for version ${currentAppVersion}...`,
    );

    /**
     * New columns from version 1.1.22
     */
    try {
      addNewTableColumnsQuery = `
        ALTER TABLE batch_purchase_entries ADD COLUMN tax_id INTEGER DEFAULT NULL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'batch_purchase_entries',
        'tax_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE batch_purchase_entries ADD COLUMN vendor_id INTEGER DEFAULT NULL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'batch_purchase_entries',
        'vendor_id',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.56
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN uom_abbrev_per_piece VARCHAR DEFAULT NULL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'uom_abbrev_per_piece',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN qty_per_piece REAL DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'qty_per_piece',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE ingredients ADD COLUMN use_measurement_per_piece INTEGER DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'ingredients',
        'use_measurement_per_piece',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE spoilages ADD COLUMN use_measurement_per_piece INTEGER DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'spoilages',
        'use_measurement_per_piece',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.81
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN is_finished_product INTEGER DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'is_finished_product',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.83
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN finished_product_origin_id INTEGER DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'finished_product_origin_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN finished_product_origin_table VARCHAR DEFAULT NULL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'finished_product_origin_table',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.87
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN unit_selling_price REAL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'unit_selling_price',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.99
       */
      addNewTableColumnsQuery = `
        ALTER TABLE invoices ADD COLUMN sales_order_group_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'invoices',
        'sales_order_group_id',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.102
       */
      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN invoice_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'invoice_id',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.111
       */
      addNewTableColumnsQuery = `
        ALTER TABLE recipes ADD COLUMN uom_abbrev VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'recipes',
        'uom_abbrev',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE recipes ADD COLUMN uom_abbrev_per_piece VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'recipes',
        'uom_abbrev_per_piece',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE recipes ADD COLUMN qty_per_piece REAL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'recipes',
        'qty_per_piece',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.111
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN recipe_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'recipe_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN recipe_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'recipe_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN yield_ref_id VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'yield_ref_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN yield_ref_id VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'yield_ref_id',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.115
       */
      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN meta_use_measurement_per_piece INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'meta_use_measurement_per_piece',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN meta_converted_from_uom_abbrev VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'meta_converted_from_uom_abbrev',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE inventory_logs ADD COLUMN meta_converted_from_qty REAL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'inventory_logs',
        'meta_converted_from_qty',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sale_logs ADD COLUMN sale_size_name VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sale_logs',
        'sale_size_name',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sale_logs ADD COLUMN sale_in_size_qty REAL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sale_logs',
        'sale_in_size_qty',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sale_logs ADD COLUMN sale_in_size_qty_uom_abbrev VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sale_logs',
        'sale_in_size_qty_uom_abbrev',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sales_orders ADD COLUMN order_size_name VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sales_orders',
        'order_size_name',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sales_orders ADD COLUMN order_in_size_qty REAL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sales_orders',
        'order_in_size_qty',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sales_orders ADD COLUMN order_in_size_qty_uom_abbrev VARCHAR;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sales_orders',
        'order_in_size_qty_uom_abbrev',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sales_orders ADD COLUMN meta_order_size_option_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sales_orders',
        'meta_order_size_option_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sales_orders ADD COLUMN meta_use_measurement_per_piece INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sales_orders',
        'meta_use_measurement_per_piece',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.120
       */
      addNewTableColumnsQuery = `
        ALTER TABLE sale_logs ADD COLUMN is_refunded INTEGER DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sale_logs',
        'is_refunded',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE sale_logs ADD COLUMN refund_id INTEGER;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'sale_logs',
        'refund_id',
        addNewTableColumnsQuery,
      );

      addNewTableColumnsQuery = `
        ALTER TABLE payments ADD COLUMN change_amount REAL DEFAULT 0;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'payments',
        'change_amount',
        addNewTableColumnsQuery,
      );

      /**
       * New columns from version 1.1.121
       */
      addNewTableColumnsQuery = `
        ALTER TABLE items ADD COLUMN packaging_type VARCHAR DEFAULT NULL;
      `;

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'packaging_type',
        addNewTableColumnsQuery,
      );

      /**
       * Add Foreign key to an existing table
       */
      let addForeignKeyToTableQuery = ``;

      addForeignKeyToTableQuery = `
        PRAGMA foreign_keys=off;

        BEGIN TRANSACTION;

        ALTER TABLE sale_logs RENAME TO _sale_logs_old;

        ${createSaleLogsTableQuery}

        INSERT INTO sale_logs SELECT * FROM _sale_logs_old;

        COMMIT;

        PRAGMA foreign_keys=on;
      `;

      await db.executeSql(addForeignKeyToTableQuery);
    } catch (error) {
      console.debug(error);
    } finally {
      // await logTableInfo(db, 'items');
    }

    /**
     * New columns for Cloud v2 device and branch association
     */
    try {
      const cloudSyncTables = [
        'app_versions',
        'categories',
        'taxes',
        'vendors',
        'vendor_contact_persons',
        'items',
        'modifiers',
        'modifier_options',
        'batch_purchase_groups',
        'batch_purchase_entries',
        'batch_stock_usage_groups',
        'batch_stock_usage_entries',
        'operations',
        'inventory_logs',
        'invoices',
        'sale_logs',
        'sales_order_groups',
        'sales_orders',
        'payments',
        'refunds',
        'saved_printers',
        'recipe_kinds',
        'recipes',
        'ingredients',
        'spoilages',
        'revenue_groups',
        'revenues',
        'expense_groups',
        'expenses',
        'revenue_deductions',
        'revenue_categories',
        'selling_menus',
        'selling_menu_items',
      ];

      for (const table of cloudSyncTables) {
        await executeSqlIfColumnNotExist(
          db,
          table,
          'device_id',
          `ALTER TABLE ${table} ADD COLUMN device_id VARCHAR DEFAULT NULL;`,
        );
        await executeSqlIfColumnNotExist(
          db,
          table,
          'branch_id',
          `ALTER TABLE ${table} ADD COLUMN branch_id VARCHAR DEFAULT NULL;`,
        );
      }

      // Backfill existing rows with saved Cloud v2 device and branch IDs
      const savedDeviceId = await loadCloudV2Item(cloudV2DeviceIdKey);
      const savedBranch = await loadCloudV2Item(
        cloudV2DesignatedBranchKey,
        true,
      );
      const backfillDeviceId = savedDeviceId ?? null;
      const backfillBranchId =
        savedBranch?.id != null ? String(savedBranch.id) : null;

      if (backfillDeviceId || backfillBranchId) {
        for (const table of cloudSyncTables) {
          await db.executeSql(
            `UPDATE ${table} SET device_id = ?, branch_id = ? WHERE device_id IS NULL;`,
            [backfillDeviceId, backfillBranchId],
          );
        }
      }
    } catch (error) {
      console.debug(
        '[alterTables] Error adding device_id/branch_id columns:',
        error,
      );
    }

    /**
     * New column: operations.code — stable string identifier for default operations.
     * Replaces hardcoded integer ID comparisons throughout the codebase.
     */
    try {
      await executeSqlIfColumnNotExist(
        db,
        'operations',
        'code',
        `ALTER TABLE operations ADD COLUMN code VARCHAR(100) DEFAULT NULL;`,
      );

      // Backfill codes for all known default operations by their fixed integer IDs
      const defaultOperationCodes = [
        {id: 1, code: 'pre_app_stock'},
        {id: 2, code: 'new_purchase'},
        {id: 3, code: 'inventory_recount_in'},
        {id: 4, code: 'stock_transfer_in'},
        {id: 5, code: 'initial_stock'},
        {id: 6, code: 'stock_usage'},
        {id: 7, code: 'inventory_recount_out'},
        {id: 10, code: 'stock_transfer_out'},
        {id: 11, code: 'new_yield_stock'},
      ];

      for (const op of defaultOperationCodes) {
        await db.executeSql(
          `UPDATE operations SET code = ? WHERE id = ? AND (code IS NULL OR code = '');`,
          [op.code, op.id],
        );
      }

      console.info(
        '[alterTables] operations.code column added and backfilled.',
      );
    } catch (error) {
      console.debug(
        '[alterTables] Error adding operations.code column:',
        error,
      );
    }

    /**
     * Master Item List columns on items.
     * - `sku` denormalizes the master_items.sku for offline display.
     * - `master_item_sync_id` is the stable join key to the company-wide
     *   master_items row; surviving SKU rewrites that may happen server-side
     *   when two branches register colliding SKUs offline.
     */
    try {
      await executeSqlIfColumnNotExist(
        db,
        'items',
        'sku',
        `ALTER TABLE items ADD COLUMN sku VARCHAR DEFAULT NULL;`,
      );

      await executeSqlIfColumnNotExist(
        db,
        'items',
        'master_item_sync_id',
        `ALTER TABLE items ADD COLUMN master_item_sync_id VARCHAR(36) DEFAULT NULL;`,
      );
    } catch (error) {
      console.debug('[alterTables] Error adding items.sku columns:', error);
    }

    /**
     * Master Item List variant-defining columns (Part 2C). These live
     * canonically on master_items and are mirrored onto every linked items
     * row via the server's MasterItemController::update endpoint. Schema
     * parity invariant: server migration 2024_01_01_000019 adds the same
     * columns.
     */
    try {
      await executeSqlIfColumnNotExist(
        db,
        'master_items',
        'barcode',
        `ALTER TABLE master_items ADD COLUMN barcode VARCHAR DEFAULT NULL;`,
      );
      await executeSqlIfColumnNotExist(
        db,
        'master_items',
        'uom_abbrev',
        `ALTER TABLE master_items ADD COLUMN uom_abbrev VARCHAR DEFAULT NULL;`,
      );
      await executeSqlIfColumnNotExist(
        db,
        'master_items',
        'uom_abbrev_per_piece',
        `ALTER TABLE master_items ADD COLUMN uom_abbrev_per_piece VARCHAR DEFAULT NULL;`,
      );
      await executeSqlIfColumnNotExist(
        db,
        'master_items',
        'qty_per_piece',
        `ALTER TABLE master_items ADD COLUMN qty_per_piece REAL DEFAULT NULL;`,
      );
      await executeSqlIfColumnNotExist(
        db,
        'master_items',
        'packaging_type',
        `ALTER TABLE master_items ADD COLUMN packaging_type VARCHAR DEFAULT NULL;`,
      );
    } catch (error) {
      console.debug(
        '[alterTables] Error adding master_items variant columns:',
        error,
      );
    }

    /**
     * New columns for JSON delta sync
     */
    try {
      const deltaSyncTables = [
        'taxes',
        'categories',
        'items',
        'master_items',
        'modifiers',
        'modifier_options',
        'vendors',
        'vendor_contact_persons',
        'recipe_kinds',
        'recipes',
        'ingredients',
        'selling_menus',
        'selling_menu_items',
        'inventory_logs',
        'batch_purchase_groups',
        'batch_purchase_entries',
        'batch_stock_usage_groups',
        'batch_stock_usage_entries',
        'invoices',
        'sale_logs',
        'sales_order_groups',
        'sales_orders',
        'payments',
        'refunds',
        'spoilages',
        'revenue_groups',
        'revenues',
        'expense_groups',
        'expenses',
        'revenue_deductions',
        'revenue_categories',
      ];

      for (const table of deltaSyncTables) {
        await executeSqlIfColumnNotExist(
          db,
          table,
          'sync_id',
          `ALTER TABLE ${table} ADD COLUMN sync_id VARCHAR(36) DEFAULT NULL;`,
        );
        await executeSqlIfColumnNotExist(
          db,
          table,
          'updated_at',
          `ALTER TABLE ${table} ADD COLUMN updated_at DATETIME DEFAULT NULL;`,
        );
        await executeSqlIfColumnNotExist(
          db,
          table,
          'synced_at',
          `ALTER TABLE ${table} ADD COLUMN synced_at DATETIME DEFAULT NULL;`,
        );
        await executeSqlIfColumnNotExist(
          db,
          table,
          'is_deleted',
          `ALTER TABLE ${table} ADD COLUMN is_deleted INTEGER DEFAULT 0;`,
        );
      }
    } catch (error) {
      console.debug('[alterTables] Error adding delta sync columns:', error);
    }
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const logTableInfo = async (db, tableName) => {
  if (!tableName || !db) return;

  try {
    let logTableInfoQuery = `PRAGMA table_info(${tableName});`;
    let tableData = [];
    let colMap = {};
    let existingTableColumnsArray = [];

    const logTableInfoResult = await db.executeSql(logTableInfoQuery);
    logTableInfoResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        const columnInfo = result.rows.item(index);
        tableData.push(columnInfo);
        colMap[columnInfo?.name] = columnInfo;
        existingTableColumnsArray.push(columnInfo?.name);
      }
    });

    console.info(`${tableName} columns: `, existingTableColumnsArray);
    console.info(`${tableName} columns details: `, tableData);
  } catch (error) {
    throw error;
  }
};

// Deprecated. In favor of executeSqlIfColumnNotExist (single column check)
export const executeSqlIfColumnsNotExist = async (
  db,
  tableName,
  columns = [],
  query = '',
) => {
  if (!db || !tableName || !columns.length || !query) {
    throw Error('Cannot execute query. Missing params.');
  }

  try {
    let logTableInfoQuery = `PRAGMA table_info(${tableName});`;
    let existingTableColumnsArray = [];

    const logTableInfoResult = await db.executeSql(logTableInfoQuery);
    logTableInfoResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        const columnInfo = result.rows.item(index);
        existingTableColumnsArray.push(columnInfo?.name);
      }
    });

    let hasExistingColumns = false;
    let queryResult = null;

    for (let column of columns) {
      if (existingTableColumnsArray.includes(column)) {
        console.info(`Column ${column} already exists in table ${tableName}`);
        hasExistingColumns = true;
      }
    }

    if (!hasExistingColumns) {
      queryResult = await db.executeSql(query);
    }

    return queryResult;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

export const executeSqlIfColumnNotExist = async (
  db,
  tableName,
  column,
  query = '',
) => {
  if (!db || !tableName || !column || !query) {
    throw Error('Cannot execute query. Missing params.');
  }

  try {
    let logTableInfoQuery = `PRAGMA table_info(${tableName});`;
    let existingTableColumnsArray = [];

    const logTableInfoResult = await db.executeSql(logTableInfoQuery);
    logTableInfoResult.forEach(result => {
      for (let index = 0; index < result.rows.length; index++) {
        const columnInfo = result.rows.item(index);
        existingTableColumnsArray.push(columnInfo?.name);
      }
    });

    let isExistingColumn = false;
    let queryResult = null;

    if (existingTableColumnsArray.includes(column)) {
      console.info(`Column ${column} already exists in table ${tableName}`);
      isExistingColumn = true;
    }

    if (!isExistingColumn) {
      queryResult = await db.executeSql(query);
    }

    return queryResult;
  } catch (error) {
    console.debug(error);
    throw error;
  }
};

// SQLite expression to generate a v4 UUID per row
const SQL_UUID_EXPR =
  `lower(hex(randomblob(4))) || '-' || lower(hex(randomblob(2))) || '-4' ||` +
  ` lower(substr(hex(randomblob(2)),2)) || '-' ||` +
  ` lower(substr('89ab', abs(random()) % 4 + 1, 1)) || lower(substr(hex(randomblob(2)),2)) || '-' ||` +
  ` lower(hex(randomblob(6)))`;

// Fixed deterministic UUIDs for the 9 built-in operations (keyed by code)
export const OPERATION_DEFAULT_UUIDS = {
  pre_app_stock: '00000001-0000-4000-a000-000000000001',
  new_purchase: '00000001-0000-4000-a000-000000000002',
  inventory_recount_in: '00000001-0000-4000-a000-000000000003',
  stock_transfer_in: '00000001-0000-4000-a000-000000000004',
  initial_stock: '00000001-0000-4000-a000-000000000005',
  stock_usage: '00000001-0000-4000-a000-000000000006',
  inventory_recount_out: '00000001-0000-4000-a000-000000000007',
  stock_transfer_out: '00000001-0000-4000-a000-000000000010',
  new_yield_stock: '00000001-0000-4000-a000-000000000011',
};

/**
 * One-time migration: converts all INTEGER PRIMARY KEY ids to UUID TEXT.
 * Safe to call on every startup — skips if already migrated.
 *
 * Strategy:
 * 1. Add _new_id TEXT column to every table.
 * 2. Populate _new_id (sync_id for delta-sync tables, fixed UUID for default
 *    operations, SQLite randomblob-generated UUID for everything else).
 * 3. Rename every table to _mig_<table>.
 * 4. Re-create every table with the updated TEXT-id schema.
 * 5. INSERT rows from _mig_ tables into new tables, joining _mig_ parents to
 *    resolve FK columns.
 * 6. Drop all _mig_ tables.
 */
export const migrateIntegerIdsToUUID = async () => {
  const db = await getDBConnection();

  // ── Phase A: detect whether migration is needed ──────────────────────────
  try {
    const infoResult = await db.executeSql('PRAGMA table_info(categories)');
    let categoriesIdType = null;
    for (let i = 0; i < infoResult[0].rows.length; i++) {
      const row = infoResult[0].rows.item(i);
      if (row.name === 'id') {
        categoriesIdType = row.type;
        break;
      }
    }
    if (categoriesIdType !== 'INTEGER') {
      console.info('[migrateIntegerIdsToUUID] Already migrated — skipping.');
      return;
    }
  } catch (e) {
    console.debug(
      '[migrateIntegerIdsToUUID] Could not detect migration state:',
      e,
    );
    return;
  }

  console.info('[migrateIntegerIdsToUUID] Starting INTEGER→UUID migration…');

  // ── Phase B: add _new_id to every table ───────────────────────────────────
  const allTables = [
    'app_versions',
    'categories',
    'taxes',
    'vendors',
    'vendor_contact_persons',
    'recipe_kinds',
    'recipes',
    'items',
    'modifiers',
    'modifier_options',
    'selling_menus',
    'operations',
    'batch_purchase_groups',
    'batch_stock_usage_groups',
    'invoices',
    'sales_order_groups',
    'ingredients',
    'batch_purchase_entries',
    'batch_stock_usage_entries',
    'spoilages',
    'revenue_groups',
    'expense_groups',
    'revenues',
    'expenses',
    'revenue_deductions',
    'revenue_categories',
    'selling_menu_items',
    'inventory_logs',
    'sale_logs',
    'refunds',
    'sales_orders',
    'payments',
    'saved_printers',
    'sync_metadata',
  ];

  for (const t of allTables) {
    try {
      await executeSqlIfColumnNotExist(
        db,
        t,
        '_new_id',
        `ALTER TABLE ${t} ADD COLUMN _new_id TEXT DEFAULT NULL;`,
      );
    } catch (e) {
      console.debug(
        `[migrateIntegerIdsToUUID] Error adding _new_id to ${t}:`,
        e,
      );
    }
  }

  // ── Phase C: populate _new_id ─────────────────────────────────────────────
  const deltaSyncTables = [
    'categories',
    'items',
    'modifiers',
    'modifier_options',
    'vendors',
    'vendor_contact_persons',
    'recipe_kinds',
    'recipes',
    'ingredients',
    'selling_menus',
    'selling_menu_items',
    'inventory_logs',
    'batch_purchase_groups',
    'batch_purchase_entries',
    'batch_stock_usage_groups',
    'batch_stock_usage_entries',
    'invoices',
    'sale_logs',
    'sales_order_groups',
    'sales_orders',
    'payments',
    'refunds',
    'spoilages',
    'revenue_groups',
    'revenues',
    'expense_groups',
    'expenses',
    'revenue_deductions',
    'revenue_categories',
  ];

  // Delta-sync tables: prefer existing sync_id as the new UUID
  for (const t of deltaSyncTables) {
    try {
      await db.executeSql(
        `UPDATE ${t} SET _new_id = sync_id WHERE sync_id IS NOT NULL AND (sync_id != '') AND (_new_id IS NULL OR _new_id = '');`,
      );
    } catch (e) {
      console.debug(
        `[migrateIntegerIdsToUUID] Error populating _new_id from sync_id for ${t}:`,
        e,
      );
    }
  }

  // Operations: assign deterministic UUIDs to built-in operations by code
  for (const [code, fixedUUID] of Object.entries(OPERATION_DEFAULT_UUIDS)) {
    try {
      await db.executeSql(
        `UPDATE operations SET _new_id = '${fixedUUID}' WHERE code = '${code}';`,
      );
    } catch (e) {
      console.debug(
        `[migrateIntegerIdsToUUID] Error setting fixed UUID for operation code=${code}:`,
        e,
      );
    }
  }

  // All remaining NULLs: generate random UUID via SQLite randomblob
  for (const t of allTables) {
    try {
      await db.executeSql(
        `UPDATE ${t} SET _new_id = ${SQL_UUID_EXPR} WHERE _new_id IS NULL OR _new_id = '';`,
      );
    } catch (e) {
      console.debug(
        `[migrateIntegerIdsToUUID] Error generating UUIDs for ${t}:`,
        e,
      );
    }
  }

  // ── Phase D: rename all tables to _mig_<table> ───────────────────────────
  try {
    await db.executeSql('PRAGMA foreign_keys=off;');
    for (const t of allTables) {
      await db.executeSql(`ALTER TABLE ${t} RENAME TO _mig_${t};`);
    }
  } catch (e) {
    console.debug(
      '[migrateIntegerIdsToUUID] Error during table rename phase:',
      e,
    );
    await db.executeSql('PRAGMA foreign_keys=on;');
    throw e;
  }

  // ── Phase E: create new tables with TEXT ids ──────────────────────────────
  try {
    await db.executeSql(createAppVersionsTableQuery);
    await db.executeSql(createCategoriesTableQuery);
    await db.executeSql(createTaxesTableQuery);
    await db.executeSql(createVendorsTableQuery);
    await db.executeSql(createVendorContactPersonsTableQuery);
    await db.executeSql(createRecipeKindsTableQuery);
    await db.executeSql(createRecipesTableQuery);
    await db.executeSql(createItemsTableQuery);
    await db.executeSql(createMasterItemsTableQuery);
    await db.executeSql(createModifiersTableQuery);
    await db.executeSql(createModifierOptionsTableQuery);
    await db.executeSql(createSellingMenusTableQuery);
    await db.executeSql(createOperationsTableQuery);
    await db.executeSql(createBatchPurchaseGroupsTableQuery);
    await db.executeSql(createBatchStockUsageGroupsTableQuery);
    await db.executeSql(createInvoicesTableQuery);
    await db.executeSql(createSalesOrderGroupsTableQuery);
    await db.executeSql(createIngredientsTableQuery);
    await db.executeSql(createBatchPurchaseEntriesTableQuery);
    await db.executeSql(createBatchStockUsageEntriesTableQuery);
    await db.executeSql(createSpoilagesTableQuery);
    await db.executeSql(createRevenueGroupsTableQuery);
    await db.executeSql(createExpenseGroupsTableQuery);
    await db.executeSql(createRevenuesTableQuery);
    await db.executeSql(createExpensesTableQuery);
    await db.executeSql(createRevenueDeductionsTableQuery);
    await db.executeSql(createRevenueCategoriesTableQuery);
    await db.executeSql(createSellingMenuItemsTableQuery);
    await db.executeSql(createInventoryLogsTableQuery);
    await db.executeSql(createSaleLogsTableQuery);
    await db.executeSql(createRefundsTableQuery);
    await db.executeSql(createSalesOrdersTableQuery);
    await db.executeSql(createPaymentsTableQuery);
    await db.executeSql(createSavedPrintersTableQuery);
    await db.executeSql(createSyncMetadataTableQuery);
  } catch (e) {
    console.debug(
      '[migrateIntegerIdsToUUID] Error during table creation phase:',
      e,
    );
    await db.executeSql('PRAGMA foreign_keys=on;');
    throw e;
  }

  // ── Phase F: insert data from _mig_ tables with FK mapping ───────────────
  try {
    // No-FK tables first
    await db.executeSql(`
      INSERT INTO app_versions (id, version, date, device_id, branch_id)
      SELECT _new_id, version, date, device_id, branch_id FROM _mig_app_versions;
    `);

    await db.executeSql(`
      INSERT INTO categories (id, name, category_photo_path, icon, color, is_active, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, name, category_photo_path, icon, color, is_active, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_categories;
    `);

    await db.executeSql(`
      INSERT INTO taxes (id, name, rate_percentage, app_version, is_compound_tax, is_app_default, device_id, branch_id)
      SELECT _new_id, name, rate_percentage, app_version, is_compound_tax, is_app_default, device_id, branch_id FROM _mig_taxes;
    `);

    await db.executeSql(`
      INSERT INTO vendors (id, salutation, first_name, last_name, company_name, vendor_display_name, tin, email, phone_number, mobile_number, remarks, is_active, vendor_photo_path, icon, color, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, salutation, first_name, last_name, company_name, vendor_display_name, tin, email, phone_number, mobile_number, remarks, is_active, vendor_photo_path, icon, color, date, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_vendors;
    `);

    await db.executeSql(`
      INSERT INTO vendor_contact_persons (id, vendor_id, salutation, first_name, last_name, email, phone_number, mobile_number, designation, department, notes, contact_photo_path, icon, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT vcp._new_id, v._new_id, vcp.salutation, vcp.first_name, vcp.last_name, vcp.email, vcp.phone_number, vcp.mobile_number, vcp.designation, vcp.department, vcp.notes, vcp.contact_photo_path, vcp.icon, vcp.date, vcp.device_id, vcp.branch_id, vcp.sync_id, vcp.updated_at, vcp.synced_at, COALESCE(vcp.is_deleted, 0)
      FROM _mig_vendor_contact_persons vcp
      LEFT JOIN _mig_vendors v ON v.id = vcp.vendor_id;
    `);

    await db.executeSql(`
      INSERT INTO recipe_kinds (id, name, date_created, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, name, date_created, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_recipe_kinds;
    `);

    await db.executeSql(`
      INSERT INTO recipes (id, is_draft, is_sub_recipe, recipe_kind_id, group_name, name, yield, uom_abbrev, uom_abbrev_per_piece, qty_per_piece, date_created, date_saved, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT r._new_id, r.is_draft, r.is_sub_recipe, rk._new_id, r.group_name, r.name, r.yield, r.uom_abbrev, r.uom_abbrev_per_piece, r.qty_per_piece, r.date_created, r.date_saved, r.device_id, r.branch_id, r.sync_id, r.updated_at, r.synced_at, COALESCE(r.is_deleted, 0)
      FROM _mig_recipes r
      LEFT JOIN _mig_recipe_kinds rk ON rk.id = r.recipe_kind_id;
    `);

    await db.executeSql(`
      INSERT INTO items (id, is_archived, category_id, is_sub_recipe, is_non_food, is_finished_product, finished_product_origin_id, finished_product_origin_table, recipe_id, sub_recipe_id, yield_ref_id, item_photo_path, icon, color, name, barcode, uom_abbrev, unit_cost, uom_abbrev_per_piece, qty_per_piece, tax_id, preferred_vendor_id, initial_stock_qty, current_stock_qty, low_stock_level, unit_selling_price, packaging_type, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT i._new_id, i.is_archived, cat._new_id, i.is_sub_recipe, i.is_non_food, COALESCE(i.is_finished_product, 0), origin._new_id, i.finished_product_origin_table, r._new_id, sr._new_id, i.yield_ref_id, i.item_photo_path, i.icon, i.color, i.name, i.barcode, i.uom_abbrev, i.unit_cost, i.uom_abbrev_per_piece, i.qty_per_piece, t._new_id, v._new_id, i.initial_stock_qty, i.current_stock_qty, i.low_stock_level, i.unit_selling_price, i.packaging_type, i.date, i.device_id, i.branch_id, i.sync_id, i.updated_at, i.synced_at, COALESCE(i.is_deleted, 0)
      FROM _mig_items i
      LEFT JOIN _mig_categories cat ON cat.id = i.category_id
      LEFT JOIN _mig_items origin ON origin.id = i.finished_product_origin_id
      LEFT JOIN _mig_recipes r ON r.id = i.recipe_id
      LEFT JOIN _mig_recipes sr ON sr.id = i.sub_recipe_id
      LEFT JOIN _mig_taxes t ON t.id = i.tax_id
      LEFT JOIN _mig_vendors v ON v.id = i.preferred_vendor_id;
    `);

    await db.executeSql(`
      INSERT INTO operations (id, code, type, name, app_version, list_item_order, is_app_default, device_id, branch_id)
      SELECT _new_id, code, type, name, app_version, list_item_order, is_app_default, device_id, branch_id FROM _mig_operations;
    `);

    await db.executeSql(`
      INSERT INTO modifiers (id, name, item_id, is_app_default, type_ref, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT m._new_id, m.name, i._new_id, m.is_app_default, m.type_ref, m.date_created, m.date_updated, m.device_id, m.branch_id, m.sync_id, m.updated_at, m.synced_at, COALESCE(m.is_deleted, 0)
      FROM _mig_modifiers m
      LEFT JOIN _mig_items i ON i.id = m.item_id;
    `);

    await db.executeSql(`
      INSERT INTO modifier_options (id, modifier_id, option_name, option_selling_price, in_option_qty, in_option_qty_uom_abbrev, in_option_qty_based_on_item_uom, use_measurement_per_piece, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT mo._new_id, m._new_id, mo.option_name, mo.option_selling_price, mo.in_option_qty, mo.in_option_qty_uom_abbrev, mo.in_option_qty_based_on_item_uom, mo.use_measurement_per_piece, mo.date_created, mo.date_updated, mo.device_id, mo.branch_id, mo.sync_id, mo.updated_at, mo.synced_at, COALESCE(mo.is_deleted, 0)
      FROM _mig_modifier_options mo
      LEFT JOIN _mig_modifiers m ON m.id = mo.modifier_id;
    `);

    await db.executeSql(`
      INSERT INTO selling_menus (id, is_draft, name, date_created, date_saved, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, is_draft, name, date_created, date_saved, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_selling_menus;
    `);

    await db.executeSql(`
      INSERT INTO batch_purchase_groups (id, confirmed, date_created, date_confirmed, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, confirmed, date_created, date_confirmed, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_batch_purchase_groups;
    `);

    await db.executeSql(`
      INSERT INTO batch_stock_usage_groups (id, confirmed, date_created, date_confirmed, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, confirmed, date_created, date_confirmed, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_batch_stock_usage_groups;
    `);

    await db.executeSql(`
      INSERT INTO invoices (id, voided, sold_by_account_uid, customer_id, sales_order_group_id, remarks, invoice_date, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT inv._new_id, inv.voided, inv.sold_by_account_uid, inv.customer_id, sog._new_id, inv.remarks, inv.invoice_date, inv.date, inv.last_update, inv.device_id, inv.branch_id, inv.sync_id, inv.updated_at, inv.synced_at, COALESCE(inv.is_deleted, 0)
      FROM _mig_invoices inv
      LEFT JOIN _mig_sales_order_groups sog ON sog.id = inv.sales_order_group_id;
    `);

    await db.executeSql(`
      INSERT INTO sales_order_groups (id, voided, sold_by_account_uid, customer_id, remarks, order_date, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, voided, sold_by_account_uid, customer_id, remarks, order_date, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_sales_order_groups;
    `);

    await db.executeSql(`
      INSERT INTO ingredients (id, recipe_id, item_id, in_recipe_qty, in_recipe_uom_abbrev, in_recipe_qty_based_on_item_uom, use_measurement_per_piece, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT ing._new_id, r._new_id, i._new_id, ing.in_recipe_qty, ing.in_recipe_uom_abbrev, ing.in_recipe_qty_based_on_item_uom, COALESCE(ing.use_measurement_per_piece, 0), ing.date, ing.device_id, ing.branch_id, ing.sync_id, ing.updated_at, ing.synced_at, COALESCE(ing.is_deleted, 0)
      FROM _mig_ingredients ing
      LEFT JOIN _mig_recipes r ON r.id = ing.recipe_id
      LEFT JOIN _mig_items i ON i.id = ing.item_id;
    `);

    await db.executeSql(`
      INSERT INTO batch_purchase_entries (id, batch_purchase_group_id, item_id, tax_id, vendor_id, add_stock_qty, add_stock_unit_cost, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT bpe._new_id, bpg._new_id, i._new_id, t._new_id, v._new_id, bpe.add_stock_qty, bpe.add_stock_unit_cost, bpe.date, bpe.device_id, bpe.branch_id, bpe.sync_id, bpe.updated_at, bpe.synced_at, COALESCE(bpe.is_deleted, 0)
      FROM _mig_batch_purchase_entries bpe
      LEFT JOIN _mig_batch_purchase_groups bpg ON bpg.id = bpe.batch_purchase_group_id
      LEFT JOIN _mig_items i ON i.id = bpe.item_id
      LEFT JOIN _mig_taxes t ON t.id = bpe.tax_id
      LEFT JOIN _mig_vendors v ON v.id = bpe.vendor_id;
    `);

    await db.executeSql(`
      INSERT INTO batch_stock_usage_entries (id, batch_stock_usage_group_id, item_id, remove_stock_qty, remove_stock_unit_cost, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT bsue._new_id, bsug._new_id, i._new_id, bsue.remove_stock_qty, bsue.remove_stock_unit_cost, bsue.date, bsue.device_id, bsue.branch_id, bsue.sync_id, bsue.updated_at, bsue.synced_at, COALESCE(bsue.is_deleted, 0)
      FROM _mig_batch_stock_usage_entries bsue
      LEFT JOIN _mig_batch_stock_usage_groups bsug ON bsug.id = bsue.batch_stock_usage_group_id
      LEFT JOIN _mig_items i ON i.id = bsue.item_id;
    `);

    await db.executeSql(`
      INSERT INTO spoilages (id, item_id, in_spoilage_qty, in_spoilage_uom_abbrev, in_spoilage_qty_based_on_item_uom, use_measurement_per_piece, in_spoilage_date, remarks, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT sp._new_id, i._new_id, sp.in_spoilage_qty, sp.in_spoilage_uom_abbrev, sp.in_spoilage_qty_based_on_item_uom, COALESCE(sp.use_measurement_per_piece, 0), sp.in_spoilage_date, sp.remarks, sp.date, sp.device_id, sp.branch_id, sp.sync_id, sp.updated_at, sp.synced_at, COALESCE(sp.is_deleted, 0)
      FROM _mig_spoilages sp
      LEFT JOIN _mig_items i ON i.id = sp.item_id;
    `);

    await db.executeSql(`
      INSERT INTO revenue_groups (id, name, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, name, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_revenue_groups;
    `);

    await db.executeSql(`
      INSERT INTO expense_groups (id, name, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT _new_id, name, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, COALESCE(is_deleted, 0) FROM _mig_expense_groups;
    `);

    await db.executeSql(`
      INSERT INTO revenues (id, revenue_group_id, revenue_group_date, amount, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT rv._new_id, rg._new_id, rv.revenue_group_date, rv.amount, rv.date_created, rv.date_updated, rv.device_id, rv.branch_id, rv.sync_id, rv.updated_at, rv.synced_at, COALESCE(rv.is_deleted, 0)
      FROM _mig_revenues rv
      LEFT JOIN _mig_revenue_groups rg ON rg.id = rv.revenue_group_id;
    `);

    await db.executeSql(`
      INSERT INTO expenses (id, expense_group_id, expense_group_date, name, amount, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT ex._new_id, eg._new_id, ex.expense_group_date, ex.name, ex.amount, ex.date_created, ex.date_updated, ex.device_id, ex.branch_id, ex.sync_id, ex.updated_at, ex.synced_at, COALESCE(ex.is_deleted, 0)
      FROM _mig_expenses ex
      LEFT JOIN _mig_expense_groups eg ON eg.id = ex.expense_group_id;
    `);

    await db.executeSql(`
      INSERT INTO revenue_deductions (id, revenue_group_id, expense_id, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT rd._new_id, rg._new_id, ex._new_id, rd.date_created, rd.date_updated, rd.device_id, rd.branch_id, rd.sync_id, rd.updated_at, rd.synced_at, COALESCE(rd.is_deleted, 0)
      FROM _mig_revenue_deductions rd
      LEFT JOIN _mig_revenue_groups rg ON rg.id = rd.revenue_group_id
      LEFT JOIN _mig_expenses ex ON ex.id = rd.expense_id;
    `);

    await db.executeSql(`
      INSERT INTO revenue_categories (id, revenue_group_id, category_id, date_created, date_updated, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT rc._new_id, rg._new_id, cat._new_id, rc.date_created, rc.date_updated, rc.device_id, rc.branch_id, rc.sync_id, rc.updated_at, rc.synced_at, COALESCE(rc.is_deleted, 0)
      FROM _mig_revenue_categories rc
      LEFT JOIN _mig_revenue_groups rg ON rg.id = rc.revenue_group_id
      LEFT JOIN _mig_categories cat ON cat.id = rc.category_id;
    `);

    await db.executeSql(`
      INSERT INTO selling_menu_items (id, selling_menu_id, item_id, modifier_option_id, in_menu_qty, date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT smi._new_id, sm._new_id, i._new_id, mo._new_id, smi.in_menu_qty, smi.date, smi.device_id, smi.branch_id, smi.sync_id, smi.updated_at, smi.synced_at, COALESCE(smi.is_deleted, 0)
      FROM _mig_selling_menu_items smi
      LEFT JOIN _mig_selling_menus sm ON sm.id = smi.selling_menu_id
      LEFT JOIN _mig_items i ON i.id = smi.item_id
      LEFT JOIN _mig_modifier_options mo ON mo.id = smi.modifier_option_id;
    `);

    await db.executeSql(`
      INSERT INTO inventory_logs (id, voided, operation_id, item_id, recipe_id, yield_ref_id, ref_tax_id, ref_vendor_id, adjustment_unit_cost, adjustment_unit_cost_net, adjustment_unit_cost_tax, adjustment_tax_rate_percentage, adjustment_tax_name, adjustment_qty, adjustment_date, meta_use_measurement_per_piece, meta_converted_from_uom_abbrev, meta_converted_from_qty, beginning_inventory_date, adjusted_by_account_uid, vendor_display_name, official_receipt_number, batch_purchase_group_id, batch_stock_usage_group_id, invoice_id, remarks, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT il._new_id, il.voided, op._new_id, i._new_id, r._new_id, il.yield_ref_id, tx._new_id, vn._new_id, il.adjustment_unit_cost, il.adjustment_unit_cost_net, il.adjustment_unit_cost_tax, il.adjustment_tax_rate_percentage, il.adjustment_tax_name, il.adjustment_qty, il.adjustment_date, il.meta_use_measurement_per_piece, il.meta_converted_from_uom_abbrev, il.meta_converted_from_qty, il.beginning_inventory_date, il.adjusted_by_account_uid, il.vendor_display_name, il.official_receipt_number, bpg._new_id, bsug._new_id, inv._new_id, il.remarks, il.date, il.last_update, il.device_id, il.branch_id, il.sync_id, il.updated_at, il.synced_at, COALESCE(il.is_deleted, 0)
      FROM _mig_inventory_logs il
      LEFT JOIN _mig_operations op ON op.id = il.operation_id
      LEFT JOIN _mig_items i ON i.id = il.item_id
      LEFT JOIN _mig_recipes r ON r.id = il.recipe_id
      LEFT JOIN _mig_taxes tx ON tx.id = il.ref_tax_id
      LEFT JOIN _mig_vendors vn ON vn.id = il.ref_vendor_id
      LEFT JOIN _mig_batch_purchase_groups bpg ON bpg.id = il.batch_purchase_group_id
      LEFT JOIN _mig_batch_stock_usage_groups bsug ON bsug.id = il.batch_stock_usage_group_id
      LEFT JOIN _mig_invoices inv ON inv.id = il.invoice_id;
    `);

    // sale_logs and refunds are circular — insert both using _mig_ cross-references
    await db.executeSql(`
      INSERT INTO refunds (id, sale_log_id, refund_method, refund_amount, transaction_date, input_date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT rf._new_id, sl._new_id, rf.refund_method, rf.refund_amount, rf.transaction_date, rf.input_date, rf.device_id, rf.branch_id, rf.sync_id, rf.updated_at, rf.synced_at, COALESCE(rf.is_deleted, 0)
      FROM _mig_refunds rf
      LEFT JOIN _mig_sale_logs sl ON sl.id = rf.sale_log_id;
    `);

    await db.executeSql(`
      INSERT INTO sale_logs (id, voided, invoice_id, is_refunded, refund_id, item_id, ref_tax_id, ref_customer_id, sale_unit_selling_price, sale_unit_selling_price_net, sale_unit_selling_price_tax, sale_size_name, sale_in_size_qty, sale_in_size_qty_uom_abbrev, sale_tax_rate_percentage, sale_tax_name, sale_qty, sale_date, sold_by_account_uid, remarks, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT sl._new_id, sl.voided, inv._new_id, COALESCE(sl.is_refunded, 0), rf._new_id, i._new_id, sl.ref_tax_id, sl.ref_customer_id, sl.sale_unit_selling_price, sl.sale_unit_selling_price_net, sl.sale_unit_selling_price_tax, sl.sale_size_name, sl.sale_in_size_qty, sl.sale_in_size_qty_uom_abbrev, sl.sale_tax_rate_percentage, sl.sale_tax_name, sl.sale_qty, sl.sale_date, sl.sold_by_account_uid, sl.remarks, sl.date, sl.last_update, sl.device_id, sl.branch_id, sl.sync_id, sl.updated_at, sl.synced_at, COALESCE(sl.is_deleted, 0)
      FROM _mig_sale_logs sl
      LEFT JOIN _mig_invoices inv ON inv.id = sl.invoice_id
      LEFT JOIN _mig_refunds rf ON rf.id = sl.refund_id
      LEFT JOIN _mig_items i ON i.id = sl.item_id;
    `);

    await db.executeSql(`
      INSERT INTO sales_orders (id, voided, invoice_id, sales_order_group_id, item_id, ref_tax_id, ref_customer_id, order_unit_selling_price, order_unit_selling_price_net, order_unit_selling_price_tax, order_size_name, order_in_size_qty, order_in_size_qty_uom_abbrev, order_tax_rate_percentage, order_tax_name, order_qty, order_date, fulfilled_order_qty, sold_by_account_uid, remarks, meta_order_size_option_id, meta_use_measurement_per_piece, date, last_update, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT so._new_id, so.voided, inv._new_id, sog._new_id, i._new_id, so.ref_tax_id, so.ref_customer_id, so.order_unit_selling_price, so.order_unit_selling_price_net, so.order_unit_selling_price_tax, so.order_size_name, so.order_in_size_qty, so.order_in_size_qty_uom_abbrev, so.order_tax_rate_percentage, so.order_tax_name, so.order_qty, so.order_date, so.fulfilled_order_qty, so.sold_by_account_uid, so.remarks, mo._new_id, so.meta_use_measurement_per_piece, so.date, so.last_update, so.device_id, so.branch_id, so.sync_id, so.updated_at, so.synced_at, COALESCE(so.is_deleted, 0)
      FROM _mig_sales_orders so
      LEFT JOIN _mig_invoices inv ON inv.id = so.invoice_id
      LEFT JOIN _mig_sales_order_groups sog ON sog.id = so.sales_order_group_id
      LEFT JOIN _mig_items i ON i.id = so.item_id
      LEFT JOIN _mig_modifier_options mo ON mo.id = so.meta_order_size_option_id;
    `);

    await db.executeSql(`
      INSERT INTO payments (id, invoice_id, payment_flow, payment_method, payment_amount, change_amount, payment_date, input_date, device_id, branch_id, sync_id, updated_at, synced_at, is_deleted)
      SELECT p._new_id, inv._new_id, p.payment_flow, p.payment_method, p.payment_amount, COALESCE(p.change_amount, 0), p.payment_date, p.input_date, p.device_id, p.branch_id, p.sync_id, p.updated_at, p.synced_at, COALESCE(p.is_deleted, 0)
      FROM _mig_payments p
      LEFT JOIN _mig_invoices inv ON inv.id = p.invoice_id;
    `);

    await db.executeSql(`
      INSERT INTO saved_printers (id, display_name, device_name, inner_mac_address, device_model, interface_type, paper_width, paper_width_uom_abbrev, auto_connect, auto_print_receipt, date, device_id, branch_id)
      SELECT _new_id, display_name, device_name, inner_mac_address, device_model, interface_type, paper_width, paper_width_uom_abbrev, auto_connect, auto_print_receipt, date, device_id, branch_id FROM _mig_saved_printers;
    `);

    await db.executeSql(`
      INSERT INTO sync_metadata (id, entity_type, last_pushed_at, last_pulled_at)
      SELECT _new_id, entity_type, last_pushed_at, last_pulled_at FROM _mig_sync_metadata;
    `);
  } catch (e) {
    console.debug(
      '[migrateIntegerIdsToUUID] Error during data insertion phase:',
      e,
    );
    await db.executeSql('PRAGMA foreign_keys=on;');
    throw e;
  }

  // ── Phase G: drop all _mig_ tables ───────────────────────────────────────
  try {
    for (const t of allTables) {
      await db.executeSql(`DROP TABLE IF EXISTS _mig_${t};`);
    }
  } catch (e) {
    console.debug('[migrateIntegerIdsToUUID] Error during cleanup phase:', e);
  }

  await db.executeSql('PRAGMA foreign_keys=on;');
  console.info('[migrateIntegerIdsToUUID] Migration complete ✓');
};

export const deleteTable = async (dbName, localAccountDb = false) => {
  let db;

  try {
    if (localAccountDb) {
      db = await getLocalAccountDBConnection();
    } else {
      db = await getDBConnection();
    }
  } catch (error) {
    throw error;
  }

  const query = `drop table ${dbName}`;

  try {
    await db.executeSql(query);
  } catch (error) {
    console.debug(error);
    throw error;
  }
};
