export const items = [
  {
    id: 1,
    name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'ea',
    quantity: 195,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 12,
    // Stock Usages
    remove_stock_qty: 90,
  },
  // {
  //   id: 2,
  //   name: 'Fillet Mignon Tenderloin Log',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 500.61,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 1.8,
  //   low_stock_level: 1,
  //   // Purchases
  //   add_stock_qty: 0,
  //   // Stock Usages
  //   remove_stock_qty: 1,
  // },
  // {
  //   id: 3,
  //   name: 'Ham',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 308.04,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 13.0,
  //   low_stock_level: 1,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 4,
  //   name: 'Liempo',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 218.8,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 5,
  //   low_stock_level: 1,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 5,
  //   name: 'Calamari',
  //   category_id: 4,
  //   category_name: 'Seafood',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 280.74,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 19,
  //   low_stock_level: 1,
  //   // Purchases
  //   add_stock_qty: 4,
  // },
  // {
  //   id: 6,
  //   name: 'Dori Fish',
  //   category_id: 4,
  //   category_name: 'Seafood',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 148.82,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 5,
  //   low_stock_level: 5,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 7,
  //   name: 'Salmon - Pink',
  //   category_id: 4,
  //   category_name: 'Seafood',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 355.0,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 26.2,
  //   low_stock_level: 5,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 8,
  //   name: 'Salami',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 817.63,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 7,
  //   low_stock_level: 5,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 9,
  //   name: 'Ground Pork',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 184.77,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 14,
  //   low_stock_level: 5,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
  // {
  //   id: 10,
  //   name: 'German Franks',
  //   category_id: 1,
  //   category_name: 'Meat',
  //   barcode: '',
  //   // Cost & Inventory
  //   unit_cost: 207.46,
  //   uom_id: 2,
  //   uom_name: 'Kilogram',
  //   uom_abbrev: 'kg',
  //   quantity: 8,
  //   low_stock_level: 5,
  //   // Purchases
  //   add_stock_qty: 0,
  // },
];

export const categories = [
  {
    id: 1,
    name: 'Meat',
  },
  {
    id: 2,
    name: 'Poultry',
  },
  {
    id: 3,
    name: 'Beverage',
  },
  {
    id: 4,
    name: 'Seafood',
  },
];

export const units = [
  {
    id: 1,
    name: 'Gram',
    abbrev: 'g',
    precision: 2,
  },
  {
    id: 2,
    name: 'Kilogram',
    abbrev: 'kg',
    precision: 2,
  },
  {
    id: 3,
    name: 'Piece',
    abbrev: 'pcs',
    precision: 0,
  },
];

export const purchaseLists = [
  {
    id: 1,
    purchase_number: 'P000000001',
    purchase_date: 'May 06, 2022',
    total_cost: 1307.52,
  },
  {
    id: 2,
    purchase_number: 'P000000002',
    purchase_date: 'May 10, 2022',
    total_cost: 1307.52,
  },
  {
    id: 3,
    purchase_number: 'P000000003',
    purchase_date: 'May 11, 2022',
    total_cost: 1307.52,
  },
  {
    id: 4,
    purchase_number: 'P000000004',
    purchase_date: 'May 12, 2022',
    total_cost: 1307.52,
  },
  {
    id: 5,
    purchase_number: 'P000000005',
    purchase_date: 'May 16, 2022',
    total_cost: 1307.52,
  },
  {
    id: 6,
    purchase_number: 'P000000006',
    purchase_date: 'May 17, 2022',
    total_cost: 1307.52,
  },
  {
    id: 7,
    purchase_number: 'P000000007',
    purchase_date: 'May 18, 2022',
    total_cost: 1307.52,
  },
];

export const stockUsageLists = [
  {
    id: 1,
    stock_usage_number: 'SU000000001',
    usage_date: 'May 06, 2022',
    total_cost: 1884.81,
  },
  {
    id: 2,
    stock_usage_number: 'SU000000002',
    usage_date: 'May 10, 2022',
    total_cost: 1884.81,
  },
  {
    id: 3,
    stock_usage_number: 'SU000000003',
    usage_date: 'May 11, 2022',
    total_cost: 1884.81,
  },
];

export const purchasedItems = [
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 1,
    purchase_date: '05/06/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 2,
    purchase_date: '05/10/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 3,
    purchase_date: '05/11/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 4,
    purchase_date: '05/12/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 5,
    purchase_date: '05/16/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 6,
    purchase_date: '05/17/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    add_stock_qty: 12,
    purchase_id: 7,
    purchase_date: '05/18/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 1,
    purchase_date: '05/06/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 2,
    purchase_date: '05/10/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 3,
    purchase_date: '05/11/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 4,
    purchase_date: '05/12/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 5,
    purchase_date: '05/16/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 6,
    purchase_date: '05/17/22',
  },
  {
    item_id: 5,
    item_name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    add_stock_qty: 4,
    purchase_id: 7,
    purchase_date: '05/18/22',
  },
];

export const usedItems = [
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    remove_stock_qty: 12,
    stock_usage_id: 1,
    stock_usage_date: '05/06/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    remove_stock_qty: 12,
    stock_usage_id: 2,
    stock_usage_date: '05/10/22',
  },
  {
    item_id: 1,
    item_name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'pcs',
    remove_stock_qty: 12,
    stock_usage_id: 3,
    stock_usage_date: '05/11/22',
  },
  {
    item_id: 2,
    item_name: 'Fillet Mignon Tenderloin Log',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 500.61,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    remove_stock_qty: 4,
    stock_usage_id: 1,
    stock_usage_date: '05/06/22',
  },
  {
    item_id: 2,
    item_name: 'Fillet Mignon Tenderloin Log',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 500.61,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    remove_stock_qty: 4,
    stock_usage_id: 2,
    stock_usage_date: '05/10/22',
  },
  {
    item_id: 2,
    item_name: 'Fillet Mignon Tenderloin Log',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    unit_cost: 500.61,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    remove_stock_qty: 4,
    stock_usage_id: 3,
    stock_usage_date: '05/11/22',
  },
];

export const recipeKinds = [
  {
    label: 'Food',
    value: 'food',
  },
  {
    label: 'Beverage',
    value: 'beverage',
  },
];

export const recipes = [
  {
    id: 1,
    name: 'Baby Back Ribs',
    yield: 1,
    groupName: '',
    category: 'Food',
    selling_price_with_vat: 980.0,
  },
  {
    id: 2,
    name: 'Baby Back Ribs (Half Slab)',
    yield: 1,
    groupName: '',
    category: 'Food',
    selling_price_with_vat: 595.0,
  },
];

export const ingredients = [
  {
    id: 1,
    recipe_id: 1,
    name: 'Ribs; Cooked (800 Grams)',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 300.5,
    recipe_qty: 1,
    recipe_unit: 'ea',
  },
  {
    id: 2,
    recipe_id: 1,
    name: 'BBQ Sauce',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 0.12,
    recipe_qty: 105,
    recipe_unit: 'ml',
  },
  {
    id: 3,
    recipe_id: 1,
    name: 'Fries',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 0.08,
    recipe_qty: 120,
    recipe_unit: 'g',
  },
  {
    id: 4,
    recipe_id: 2,
    name: 'Ribs; Cooked (400 Grams)',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 300.5,
    recipe_qty: 0.5,
    recipe_unit: 'ea',
  },
  {
    id: 5,
    recipe_id: 2,
    name: 'BBQ Sauce',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 0.12,
    recipe_qty: 60,
    recipe_unit: 'ml',
  },
  {
    id: 6,
    recipe_id: 2,
    name: 'Fries',
    inventory_qty: 10,
    inventory_unit: 'kg',
    inventory_unit_cost: 0.08,
    recipe_qty: 120,
    recipe_unit: 'g',
  },
];

export const categoryGroups = [
  {
    id: 1,
    name: 'Food',
  },
  {
    id: 2,
    name: 'BWL',
  },
];

export const revenues = [
  {
    id: 1,
    category_group_id: 1,
    category_group_name: 'Food',
    total_revenue: 5492033.31,
  },
  {
    id: 2,
    category_group_id: 2,
    category_group_name: 'Beverage',
    total_revenue: 818589.94,
  },
  {
    id: 3,
    category_group_id: 3,
    category_group_name: 'Beer',
    total_revenue: 324456.54,
  },
  {
    id: 4,
    category_group_id: 4,
    category_group_name: 'Wine',
    total_revenue: 31507.12,
  },
  {
    id: 5,
    category_group_id: 5,
    category_group_name: 'Liquor',
    total_revenue: 311892.27,
  },
  {
    id: 6,
    category_group_id: 6,
    category_group_name: 'Cigarettes',
    total_revenue: 27681.53,
  },
];

export const itemLogs = [
  {
    id: 1,
    name: 'Burger Patty',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 15.38,
    uom_id: 3,
    uom_name: 'Piece',
    uom_abbrev: 'ea',
    quantity: 195,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 12,
    // Stock Usages
    remove_stock_qty: 90,
    // Adjustments
    adjustment_type: 'add',
    adjustment_reason: 'Stock Transfer In',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 2,
    name: 'Fillet Mignon Tenderloin Log',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 500.61,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 1.8,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 0,
    // Stock Usages
    remove_stock_qty: 1,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Spoilage',
    adjustment_date: '05/06/22',
    adjustment_qty: 4,
  },
  {
    id: 3,
    name: 'Ham',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 308.04,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 13.0,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Stock Transfer Out',
    adjustment_date: '05/06/22',
    adjustment_qty: 3,
  },
  {
    id: 4,
    name: 'Liempo',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 218.8,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 5,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'add',
    adjustment_reason: 'New Purchase',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 5,
    name: 'Calamari',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    // Cost & Inventory
    unit_cost: 280.74,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 19,
    low_stock_level: 1,
    // Purchases
    add_stock_qty: 4,
    // Adjustments
    adjustment_type: 'add',
    adjustment_reason: 'Inventory Re-count',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 6,
    name: 'Dori Fish',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    // Cost & Inventory
    unit_cost: 148.82,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 5,
    low_stock_level: 5,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Inventory Re-count',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 7,
    name: 'Salmon - Pink',
    category_id: 4,
    category_name: 'Seafood',
    barcode: '',
    // Cost & Inventory
    unit_cost: 355.0,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 26.2,
    low_stock_level: 5,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'add',
    adjustment_reason: 'Stock Transfer In',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 8,
    name: 'Salami',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 817.63,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 7,
    low_stock_level: 5,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Stock Transfer Out',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 9,
    name: 'Ground Pork',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 184.77,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 14,
    low_stock_level: 5,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Stock Transfer Out',
    adjustment_date: '05/06/22',
    adjustment_qty: 5,
  },
  {
    id: 10,
    name: 'German Franks',
    category_id: 1,
    category_name: 'Meat',
    barcode: '',
    // Cost & Inventory
    unit_cost: 207.46,
    uom_id: 2,
    uom_name: 'Kilogram',
    uom_abbrev: 'kg',
    quantity: 8,
    low_stock_level: 5,
    // Purchases
    add_stock_qty: 0,
    // Adjustments
    adjustment_type: 'remove',
    adjustment_reason: 'Missing',
    adjustment_date: '05/06/22',
    adjustment_qty: 1,
  },
];

export const expensesGroup = [
  {
    id: 1,
    name: 'Managers Meal',
    total_food_cost: 7371.53,
    total_expense: 25425.46,
  },
  {
    id: 2,
    name: 'Complimentaries',
    total_food_cost: 112658.8,
    total_expense: 404356.71,
  },
  {
    id: 3,
    name: 'R & D',
    total_food_cost: 500.72,
    total_expense: 1727.0,
  },
  {
    id: 4,
    name: 'Representation',
    total_food_cost: 11616.45,
    total_expense: 40066.81,
  },
];

export const expenses = [
  {
    group_id: 1,
    group_name: 'Managers Meal',
    name: 'A3EW',
    amount: 25425.46,
  },
  {
    group_id: 2,
    group_name: 'Complimentaries',
    name: 'A3ME',
    amount: 0,
  },
  {
    group_id: 2,
    group_name: 'Complimentaries',
    name: 'Granton',
    amount: 0,
  },
  {
    group_id: 2,
    group_name: 'Complimentaries',
    name: 'VIP BFF',
    amount: 383146.91,
  },
  {
    group_id: 2,
    group_name: 'Complimentaries',
    name: 'Stockholders E1',
    amount: 21209.8,
  },
  {
    group_id: 2,
    group_name: 'Complimentaries',
    name: 'S. Citizen',
    amount: 0,
  },
  {
    group_id: 3,
    group_name: 'R & D',
    name: 'A3RD',
    amount: 1727,
  },
  {
    group_id: 4,
    group_name: 'Representation',
    name: 'Birthday K1',
    amount: 0,
  },
  {
    group_id: 4,
    group_name: 'Representation',
    name: 'Wow Food K2',
    amount: 0,
  },
  {
    group_id: 4,
    group_name: 'Representation',
    name: 'Wow Drink K3',
    amount: 0,
  },
  {
    group_id: 4,
    group_name: 'Representation',
    name: 'Wow BWL',
    amount: 0,
  },
  {
    group_id: 4,
    group_name: 'Representation',
    name: 'A3R',
    amount: 40066.81,
  },
];
