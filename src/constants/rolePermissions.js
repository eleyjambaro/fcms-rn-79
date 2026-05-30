/**
 * Role permission catalog — the single source of truth for the granular,
 * checkbox-based role editor and the central permission-check helper
 * ([src/permissions/hasPermission.js](src/permissions/hasPermission.js)).
 *
 * ## Model
 *
 * Permissions are still stored on disk in the legacy backward-compatible shape:
 *
 *     { enable: ['*'], disable: ['recipes', 'reports', ...] }
 *
 * `enable` / `disable` hold dot-notation string keys. There are two levels:
 *
 *   - **module key** — the bare legacy gate string, e.g. `recipes`, `reports`,
 *     `settings`. It is ALSO the implicit ancestor of every action under it.
 *   - **action key**  — `<moduleKey>.<action>`, e.g. `recipes.yield`,
 *     `items.delete`. Granting/denying a module key cascades to its actions
 *     (see `hasPermission` ancestry rules).
 *
 * Because the module keys here are byte-identical to the strings the app
 * already gates on (Home buttons, MainTab tabs, Account sections), existing
 * roles keep working unchanged while new action keys add granularity.
 *
 * ## Maintenance rules
 *
 *   1. Every `moduleKey` MUST match the legacy gate string used in the app
 *      exactly (a regression test asserts the registry is a superset of every
 *      gate string in Home/MainTab/Account + the seeded roles).
 *   2. Every action `key` MUST be `<moduleKey>.<something>` so dot-ancestry
 *      links it to its module.
 *   3. Reuse existing key constants instead of re-declaring the literals
 *      (e.g. Batch Transfer keys come from `transferPermissions.js`).
 */

import {
  TRANSFER_PERMISSIONS,
  TRANSFER_PERMISSION_LABELS,
} from './transferPermissions';

/**
 * Ordered list of permission domains rendered as accordions in the editor.
 * Each domain: { moduleKey, label, icon, actions: [{ key, label }] }
 */
export const PERMISSION_DOMAINS = [
  {
    moduleKey: 'items',
    label: 'Items',
    icon: 'tag-multiple-outline',
    actions: [
      {key: 'items.view', label: 'View items'},
      {key: 'items.create', label: 'Register / add items'},
      {key: 'items.edit', label: 'Edit items'},
      {key: 'items.delete', label: 'Delete items'},
    ],
  },
  {
    moduleKey: 'categories',
    label: 'Categories',
    icon: 'shape-outline',
    actions: [
      {key: 'categories.view', label: 'View categories'},
      {key: 'categories.create', label: 'Create categories'},
      {key: 'categories.edit', label: 'Edit categories'},
      {key: 'categories.delete', label: 'Delete categories'},
    ],
  },
  {
    moduleKey: 'recipes',
    label: 'Recipes',
    icon: 'book-outline',
    actions: [
      {key: 'recipes.view', label: 'View recipes'},
      {key: 'recipes.create', label: 'Create recipes'},
      {key: 'recipes.edit', label: 'Edit recipes'},
      {key: 'recipes.delete', label: 'Delete recipes'},
      {key: 'recipes.yield', label: 'Yield / produce finished product'},
    ],
  },
  {
    moduleKey: 'inventory',
    label: 'Inventory',
    icon: 'warehouse',
    actions: [{key: 'inventory.view', label: 'View inventory'}],
  },
  {
    moduleKey: 'logs',
    label: 'Inventory Logs',
    icon: 'clipboard-text-clock-outline',
    actions: [
      {key: 'logs.view', label: 'View inventory logs'},
      {key: 'logs.adjust', label: 'Adjust / recount stock'},
      {key: 'logs.void', label: 'Void inventory logs'},
    ],
  },
  {
    moduleKey: 'endingInventory',
    label: 'Ending Inventory',
    icon: 'clipboard-list-outline',
    actions: [{key: 'endingInventory.view', label: 'View ending inventory'}],
  },
  {
    moduleKey: 'batchPurchase',
    label: 'Purchases',
    icon: 'text-box-plus-outline',
    actions: [
      {key: 'batchPurchase.view', label: 'View purchase entries'},
      {key: 'batchPurchase.create', label: 'Add purchase entries'},
      {key: 'batchPurchase.confirm', label: 'Confirm purchases'},
      {key: 'batchPurchase.delete', label: 'Delete purchase entries'},
    ],
  },
  {
    moduleKey: 'stockUsage',
    label: 'Stock Usage',
    icon: 'text-box-minus-outline',
    actions: [
      {key: 'stockUsage.view', label: 'View stock usage entries'},
      {key: 'stockUsage.create', label: 'Add stock usage entries'},
      {key: 'stockUsage.confirm', label: 'Confirm stock usage'},
      {key: 'stockUsage.delete', label: 'Delete stock usage entries'},
    ],
  },
  {
    // Batch Transfer keys are owned by transferPermissions.js — reuse them.
    moduleKey: 'transfer',
    label: 'Batch Transfers',
    icon: 'swap-horizontal',
    actions: [
      {
        key: TRANSFER_PERMISSIONS.CREATE,
        label: TRANSFER_PERMISSION_LABELS[TRANSFER_PERMISSIONS.CREATE],
      },
      {
        key: TRANSFER_PERMISSIONS.REVIEW,
        label: TRANSFER_PERMISSION_LABELS[TRANSFER_PERMISSIONS.REVIEW],
      },
      {
        key: TRANSFER_PERMISSIONS.TRANSFER_OUT,
        label: TRANSFER_PERMISSION_LABELS[TRANSFER_PERMISSIONS.TRANSFER_OUT],
      },
      {
        key: TRANSFER_PERMISSIONS.RECEIVE,
        label: TRANSFER_PERMISSION_LABELS[TRANSFER_PERMISSIONS.RECEIVE],
      },
    ],
  },
  {
    moduleKey: 'spoilage',
    label: 'Spoilages',
    icon: 'delete-alert-outline',
    actions: [
      {key: 'spoilage.view', label: 'View spoilages'},
      {key: 'spoilage.create', label: 'Record spoilages'},
      {key: 'spoilage.edit', label: 'Edit spoilages'},
      {key: 'spoilage.delete', label: 'Delete spoilages'},
    ],
  },
  {
    moduleKey: 'vendors',
    label: 'Vendors',
    icon: 'truck-outline',
    actions: [
      {key: 'vendors.view', label: 'View vendors'},
      {key: 'vendors.create', label: 'Create vendors'},
      {key: 'vendors.edit', label: 'Edit vendors'},
      {key: 'vendors.delete', label: 'Delete vendors'},
    ],
  },
  {
    moduleKey: 'modifiers',
    label: 'Modifiers',
    icon: 'tune',
    actions: [
      {key: 'modifiers.view', label: 'View modifiers'},
      {key: 'modifiers.create', label: 'Create modifiers'},
      {key: 'modifiers.edit', label: 'Edit modifiers'},
      {key: 'modifiers.delete', label: 'Delete modifiers'},
    ],
  },
  {
    moduleKey: 'sellingMenu',
    label: 'Selling Menu',
    icon: 'silverware-fork-knife',
    actions: [
      {key: 'sellingMenu.view', label: 'View selling menus'},
      {key: 'sellingMenu.create', label: 'Create selling menus'},
      {key: 'sellingMenu.edit', label: 'Edit selling menus'},
      {key: 'sellingMenu.delete', label: 'Delete selling menus'},
    ],
  },
  {
    moduleKey: 'salesLog',
    label: 'Sales Log',
    icon: 'receipt',
    actions: [{key: 'salesLog.view', label: 'View sales log'}],
  },
  {
    moduleKey: 'counter',
    label: 'Sales Counter',
    icon: 'cash-register',
    actions: [
      {key: 'counter.view', label: 'Open sales counter'},
      {key: 'counter.create', label: 'Add sale entries'},
      {key: 'counter.confirm', label: 'Confirm sales'},
      {key: 'counter.refund', label: 'Refund sales'},
      {key: 'counter.void', label: 'Void sales'},
    ],
  },
  {
    moduleKey: 'salesOrders',
    label: 'Sales Orders',
    icon: 'clipboard-text-outline',
    actions: [
      {key: 'salesOrders.view', label: 'View sales orders'},
      {key: 'salesOrders.create', label: 'Create sales orders'},
      {key: 'salesOrders.confirm', label: 'Fulfill / confirm sales orders'},
    ],
  },
  {
    moduleKey: 'revenues',
    label: 'Revenues',
    icon: 'cash-plus',
    actions: [
      {key: 'revenues.view', label: 'View revenues'},
      {key: 'revenues.create', label: 'Create revenues'},
      {key: 'revenues.edit', label: 'Edit revenues'},
      {key: 'revenues.delete', label: 'Delete revenues'},
    ],
  },
  {
    moduleKey: 'expenses',
    label: 'Expenses',
    icon: 'cash-minus',
    actions: [
      {key: 'expenses.view', label: 'View expenses'},
      {key: 'expenses.create', label: 'Create expenses'},
      {key: 'expenses.edit', label: 'Edit expenses'},
      {key: 'expenses.delete', label: 'Delete expenses'},
    ],
  },
  {
    moduleKey: 'taxes',
    label: 'Taxes',
    icon: 'percent-outline',
    actions: [
      {key: 'taxes.view', label: 'View taxes'},
      {key: 'taxes.create', label: 'Create taxes'},
      {key: 'taxes.edit', label: 'Edit taxes'},
      {key: 'taxes.delete', label: 'Delete taxes'},
    ],
  },
  {
    moduleKey: 'reports',
    label: 'Reports',
    icon: 'chart-line',
    actions: [
      {key: 'reports.read', label: 'View reports'},
      {key: 'reports.export', label: 'Export reports'},
    ],
  },
  {
    moduleKey: 'inventoryDataTemplate',
    label: 'Inventory Data Template (IDT)',
    icon: 'file-table-outline',
    actions: [
      {key: 'inventoryDataTemplate.import', label: 'Import inventory template'},
      {key: 'inventoryDataTemplate.export', label: 'Export inventory as IDT'},
    ],
  },
  {
    moduleKey: 'dataSyncAndBackup',
    label: 'Data Sync & Backup',
    icon: 'cloud-sync-outline',
    actions: [
      {key: 'dataSyncAndBackup.backup', label: 'Back up data to this device'},
      {key: 'dataSyncAndBackup.restore', label: 'Recover data from this device'},
    ],
  },
  {
    moduleKey: 'userManagement',
    label: 'User Management',
    icon: 'shield-account-outline',
    actions: [
      {key: 'userManagement.viewMembers', label: 'View team members & roles'},
      {
        key: 'userManagement.manageMembers',
        label: 'Create / edit / deactivate team members',
      },
      {key: 'userManagement.manageRoles', label: 'Create / edit / delete roles'},
    ],
  },
  {
    moduleKey: 'settings',
    label: 'Settings',
    icon: 'cog-outline',
    actions: [
      {key: 'settings.view', label: 'View settings'},
      {key: 'settings.edit', label: 'Edit settings'},
    ],
  },
  {
    moduleKey: 'account',
    label: 'Company Profile',
    icon: 'office-building-outline',
    actions: [
      // Keep the exact legacy string used in the seeded Encoder disable list.
      {key: 'account.updateCompanyProfile', label: 'Edit company profile'},
    ],
  },
];

/** Flat list of every action: [{ key, label, moduleKey }]. */
export const ALL_ACTIONS = PERMISSION_DOMAINS.flatMap(domain =>
  domain.actions.map(action => ({...action, moduleKey: domain.moduleKey})),
);

/** Every action key in the catalog. */
export const ALL_ACTION_KEYS = ALL_ACTIONS.map(a => a.key);

/** Every module (bare) key in the catalog. */
export const ALL_MODULE_KEYS = PERMISSION_DOMAINS.map(d => d.moduleKey);

/**
 * Set of every key the registry "knows" (module keys + action keys). The
 * serializer uses this to carry forward any stored key it does not recognize
 * instead of silently dropping it.
 */
export const KNOWN_PERMISSION_KEYS = new Set([
  ...ALL_MODULE_KEYS,
  ...ALL_ACTION_KEYS,
]);

/**
 * Starting templates for the editor. Each `config` is a normal on-disk role
 * config, so applying a preset is just "load this config into the checkboxes".
 */
export const ROLE_PRESETS = [
  {
    id: 'admin',
    label: 'Admin',
    description: 'Full access to everything.',
    config: {enable: ['*'], disable: []},
  },
  {
    id: 'manager',
    label: 'Manager',
    description: 'Day-to-day operations; no user management or data backup.',
    config: {
      enable: ALL_MODULE_KEYS.filter(
        key =>
          !['userManagement', 'dataSyncAndBackup', 'account'].includes(key),
      ),
      disable: [],
    },
  },
  {
    id: 'encoder',
    label: 'Encoder',
    description: 'Data entry only. Matches the built-in Encoder role.',
    // Byte-identical to the server-seeded Encoder role.
    config: {
      enable: ['*'],
      disable: [
        'revenues',
        'recipes',
        'reports',
        'dataSyncAndBackup',
        'inventoryDataTemplate',
        'userManagement',
        'settings',
        'account.updateCompanyProfile',
      ],
    },
  },
  {
    id: 'chef',
    label: 'Chef',
    description: 'Full recipe control (including yield) plus read-only stock.',
    config: {enable: ['recipes', 'items.view', 'logs.view'], disable: []},
  },
];
