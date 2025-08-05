import {enablePromise, openDatabase} from 'react-native-sqlite-storage';
import {appDefaults} from '../constants/appDefaults';

enablePromise(true);

const dbName = appDefaults.dbName;

export const getDBConnection = async () => {
  return openDatabase({name: dbName, location: 'default', readOnly: false});
};

/**
 * App Local Accounts & Config/Settings Table Queries
 */
// create table if not exists
const createRolesTableQuery = `
  CREATE TABLE IF NOT EXISTS roles (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    role_uid VARCHAR,
    name VARCHAR,
    role_config_json VARCHAR,
    app_version VARCHAR,
    is_app_default INTEGER DEFAULT 0
  );
`;

/**
 * Deprecated fields:
 * - role, in favor of role_id
 */
const createAccountsTableQuery = `
  CREATE TABLE IF NOT EXISTS accounts (
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
  );
`;

const createCompaniesTableQuery = `
  CREATE TABLE IF NOT EXISTS companies (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    company_uid VARCHAR,
    company_name VARCHAR,
    company_display_name VARCHAR,
    company_address VARCHAR,
    company_mobile_number VARCHAR,
    company_email VARCHAR,
    company_logo_path VARCHAR,
    branch VARCHAR
  );
`;

const createSettingsTableQuery = `
  CREATE TABLE IF NOT EXISTS settings (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    value VARCHAR,
    setting_group VARCHAR,
    setting_sub_group VARCHAR,
    app_version VARCHAR
  );
`;

/**
 * App Primary Feature Table Queries
 */

const createAppVersionsTableQuery = `
  CREATE TABLE IF NOT EXISTS app_versions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    version VARCHAR,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createCategoriesTableQuery = `
  CREATE TABLE IF NOT EXISTS categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    category_photo_path VARCHAR,
    icon VARCHAR,
    color VARCHAR,
    is_active INTEGER DEFAULT 1
  );
`;

const createTaxesTableQuery = `
  CREATE TABLE IF NOT EXISTS taxes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    rate_percentage REAL,
    app_version VARCHAR,
    is_compound_tax INTEGER DEFAULT 0,
    is_app_default INTEGER DEFAULT 0
  );
`;

const createVendorsTableQuery = `
  CREATE TABLE IF NOT EXISTS vendors (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
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
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createVendorContactPersonsTableQuery = `
  CREATE TABLE IF NOT EXISTS vendor_contact_persons (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    vendor_id INTEGER,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_archived INTEGER DEFAULT 0,
    category_id INTEGER,
    is_sub_recipe INTEGER DEFAULT 0,
    is_non_food INTEGER DEFAULT 0,
    is_finished_product INTEGER DEFAULT 0,
    finished_product_origin_id INTEGER,
    finished_product_origin_table VARCHAR,
    recipe_id INTEGER,
    sub_recipe_id INTEGER,
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
    tax_id INTEGER,
    preferred_vendor_id INTEGER,
    initial_stock_qty REAL,
    current_stock_qty REAL,
    low_stock_level REAL,
    unit_selling_price REAL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    item_id INTEGER,
    is_app_default INTEGER DEFAULT 0,
    type_ref VARCHAR,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

const createModifierOptionsTableQuery = `
  CREATE TABLE IF NOT EXISTS modifier_options (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    modifier_id INTEGER,
    option_name VARCHAR NOT NULL,
    option_selling_price REAL,
    in_option_qty REAL,
    in_option_qty_uom_abbrev VARCHAR NOT NULL,
    in_option_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

    CONSTRAINT fk_modifier
    FOREIGN KEY (modifier_id)
    REFERENCES modifiers(id)
  );
`;

const createBatchPurchaseGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_purchase_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmed INTEGER DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_confirmed DATETIME
  );
`;

const createBatchPurchaseEntriesTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_purchase_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_purchase_group_id INTEGER,
    item_id INTEGER,
    tax_id INTEGER,
    vendor_id INTEGER,
    add_stock_qty REAL NOT NULL,
    add_stock_unit_cost REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    confirmed INTEGER DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_confirmed DATETIME
  );
`;

const createBatchStockUsageEntriesTableQuery = `
  CREATE TABLE IF NOT EXISTS batch_stock_usage_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    batch_stock_usage_group_id INTEGER,
    item_id INTEGER,
    remove_stock_qty REAL NOT NULL,
    remove_stock_unit_cost REAL NOT NULL,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    type VARCHAR NOT NULL,
    name VARCHAR NOT NULL,
    app_version VARCHAR,
    list_item_order INTEGER,
    is_app_default INTEGER DEFAULT 0
  );
`;

/**
 * ref_tax_id & ref_vendor_id below are for reference purpose only as it's name.
 * We have to save the actual adjustment's applied tax name, tax rate percentage,
 * vendor name, etc., because taxes and vendors are mutable and can be deleted.
 */

const createInventoryLogsTableQuery = `
  CREATE TABLE IF NOT EXISTS inventory_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voided INTEGER DEFAULT 0,
    operation_id INTEGER,
    item_id INTEGER,
    recipe_id INTEGER,
    yield_ref_id VARCHAR,
    ref_tax_id INTEGER,
    ref_vendor_id INTEGER,
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
    batch_purchase_group_id INTEGER,
    batch_stock_usage_group_id INTEGER,
    invoice_id INTEGER,
    remarks VARCHAR(120),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voided INTEGER DEFAULT 0,
    sold_by_account_uid VARCHAR,
    customer_id INTEGER,
    sales_order_group_id INTEGER,
    remarks VARCHAR(120),
    invoice_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createSaleLogsTableQuery = `
  CREATE TABLE IF NOT EXISTS sale_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voided INTEGER DEFAULT 0,
    invoice_id INTEGER,
    is_refunded INTEGER DEFAULT 0,
    refund_id INTEGER,
    item_id INTEGER,
    ref_tax_id INTEGER,
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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voided INTEGER DEFAULT 0,
    sold_by_account_uid VARCHAR,
    customer_id INTEGER,
    remarks VARCHAR(120),
    order_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createSalesOrdersTableQuery = `
  CREATE TABLE IF NOT EXISTS sales_orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    voided INTEGER DEFAULT 0,
    invoice_id INTEGER,
    sales_order_group_id INTEGER,
    item_id INTEGER,
    ref_tax_id INTEGER,
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
    meta_order_size_option_id INTEGER,
    meta_use_measurement_per_piece INTEGER,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    last_update DATETIME DEFAULT CURRENT_TIMESTAMP,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    invoice_id INTEGER,
    payment_flow VARCHAR(255) DEFAULT 'in',
    payment_method VARCHAR(255) DEFAULT 'cash',
    payment_amount REAL,
    change_amount REAL DEFAULT 0,
    payment_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    input_date DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_invoice
    FOREIGN KEY (invoice_id)
    REFERENCES invoices(id)
  );
`;

const createRefundsTableQuery = `
  CREATE TABLE IF NOT EXISTS refunds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    sale_log_id INTEGER,
    refund_method VARCHAR,
    refund_amount REAL,
    transaction_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    input_date DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_sale_log
    FOREIGN KEY (sale_log_id)
    REFERENCES sale_logs(id)
  );
`;

const createSavedPrintersTableQuery = `
  CREATE TABLE IF NOT EXISTS saved_printers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    display_name VARCHAR,
    device_name VARCHAR,
    inner_mac_address VARCHAR,
    device_model VARCHAR,
    interface_type VARCHAR DEFAULT 'bluetooth',
    paper_width REAL DEFAULT 58,
    paper_width_uom_abbrev VARCHAR DEFAULT 'mm',
    auto_connect INTEGER DEFAULT 1,
    auto_print_receipt INTEGER DEFAULT 1,
    date DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createRecipeKindsTableQuery = `
  CREATE TABLE IF NOT EXISTS recipe_kinds (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`;

const createRecipesTableQuery = `
  CREATE TABLE IF NOT EXISTS recipes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    is_draft INTEGER DEFAULT 1,
    is_sub_recipe INTEGER DEFAULT 0,
    recipe_kind_id INTEGER,
    group_name VARCHAR,
    name VARCHAR,
    yield REAL DEFAULT 1,
    uom_abbrev VARCHAR,
    uom_abbrev_per_piece VARCHAR,
    qty_per_piece REAL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_saved DATETIME,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    recipe_id INTEGER,
    item_id INTEGER,
    in_recipe_qty REAL NOT NULL,
    in_recipe_uom_abbrev VARCHAR,
    in_recipe_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER DEFAULT 0,
    date DATETIME DEFAULT CURRENT_TIMESTAMP,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    item_id INTEGER,
    in_spoilage_qty REAL NOT NULL,
    in_spoilage_uom_abbrev VARCHAR,
    in_spoilage_qty_based_on_item_uom REAL,
    use_measurement_per_piece INTEGER DEFAULT 0,
    in_spoilage_date DATETIME DEFAULT CURRENT_TIMESTAMP,
    remarks VARCHAR(120),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_item
    FOREIGN KEY (item_id)
    REFERENCES items(id)
  );
`;

const createRevenueGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS revenue_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME
  );
`;

const createRevenuesTableQuery = `
  CREATE TABLE IF NOT EXISTS revenues (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revenue_group_id INTEGER,
    revenue_group_date DATETIME,
    amount REAL DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

    CONSTRAINT fk_revenue_group
    FOREIGN KEY (revenue_group_id)
    REFERENCES revenue_groups(id)
  );
`;

const createExpenseGroupsTableQuery = `
  CREATE TABLE IF NOT EXISTS expense_groups (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name VARCHAR NOT NULL,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME
  );
`;

const createExpensesTableQuery = `
  CREATE TABLE IF NOT EXISTS expenses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    expense_group_id INTEGER,
    expense_group_date DATETIME,
    name VARCHAR NOT NULL,
    amount REAL DEFAULT 0,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

    CONSTRAINT fk_expense_group
    FOREIGN KEY (expense_group_id)
    REFERENCES expense_groups(id)
  );
`;

const createRevenueDeductionsTableQuery = `
  CREATE TABLE IF NOT EXISTS revenue_deductions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revenue_group_id INTEGER,
    expense_id INTEGER,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

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
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    revenue_group_id INTEGER,
    category_id INTEGER,
    date_created DATETIME DEFAULT CURRENT_TIMESTAMP,
    date_updated DATETIME,

    CONSTRAINT fk_revenue_grosup
    FOREIGN KEY (revenue_group_id)
    REFERENCES revenue_groups(id),

    CONSTRAINT fk_category
    FOREIGN KEY (category_id)
    REFERENCES categories(id)
  );
`;

export const createTables = async () => {
  let db;

  try {
    db = await getDBConnection();
  } catch (error) {
    throw error;
  }

  try {
    /**
     * App Local Accounts & Config/Settings
     */
    await db.executeSql(createRolesTableQuery);
    await db.executeSql(createAccountsTableQuery);
    await db.executeSql(createCompaniesTableQuery);
    await db.executeSql(createSettingsTableQuery);

    /**
     * App Primary Feature Tables
     */
    await db.executeSql(createAppVersionsTableQuery);
    await db.executeSql(createCategoriesTableQuery);
    await db.executeSql(createTaxesTableQuery);
    await db.executeSql(createVendorsTableQuery);
    await db.executeSql(createVendorContactPersonsTableQuery);
    await db.executeSql(createItemsTableQuery);
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

export const deleteTable = async dbName => {
  let db;

  try {
    db = await getDBConnection();
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
