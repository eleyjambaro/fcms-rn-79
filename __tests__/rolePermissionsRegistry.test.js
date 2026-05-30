import {
  PERMISSION_DOMAINS,
  ALL_MODULE_KEYS,
  ALL_ACTION_KEYS,
  KNOWN_PERMISSION_KEYS,
  ROLE_PRESETS,
} from '../src/constants/rolePermissions';

// Bare module gate strings the app checks at runtime (Home buttons, MainTab
// tabs, Account sections, Home highlighted-button mapping). The registry MUST
// be a superset of these or a gate would silently always-hide.
const MODULE_GATE_STRINGS = [
  // Home main buttons
  'recipes',
  'revenues',
  'inventory',
  'logs',
  'vendors',
  'spoilage',
  'salesLog',
  'counter',
  'salesOrders',
  'sellingMenu',
  // Home highlighted buttons (batchTransfer maps to `transfer`)
  'batchPurchase',
  'transfer',
  'endingInventory',
  // MainTab tabs
  'reports',
  'settings',
  // Account sections
  'dataSyncAndBackup',
  'inventoryDataTemplate',
  'userManagement',
];

// Action keys wired to real gates in this pass.
const WIRED_ACTION_KEYS = [
  'recipes.yield',
  'items.create',
  'items.edit',
  'items.delete',
];

// Every key referenced by the seeded built-in roles.
const SEEDED_ROLE_KEYS = [
  'revenues',
  'recipes',
  'reports',
  'dataSyncAndBackup',
  'inventoryDataTemplate',
  'userManagement',
  'settings',
  'account.updateCompanyProfile',
];

describe('registry structural invariants', () => {
  test('every action key is prefixed by its domain module key', () => {
    for (const domain of PERMISSION_DOMAINS) {
      for (const action of domain.actions) {
        expect(action.key.startsWith(`${domain.moduleKey}.`)).toBe(true);
      }
    }
  });

  test('module keys are unique', () => {
    expect(new Set(ALL_MODULE_KEYS).size).toBe(ALL_MODULE_KEYS.length);
  });

  test('action keys are unique', () => {
    expect(new Set(ALL_ACTION_KEYS).size).toBe(ALL_ACTION_KEYS.length);
  });
});

describe('registry is a superset of every gate string', () => {
  test('all module gate strings exist as module keys', () => {
    for (const key of MODULE_GATE_STRINGS) {
      expect(ALL_MODULE_KEYS).toContain(key);
    }
  });

  test('all wired action keys exist as action keys', () => {
    for (const key of WIRED_ACTION_KEYS) {
      expect(ALL_ACTION_KEYS).toContain(key);
    }
  });

  test('all seeded role keys are known to the registry', () => {
    for (const key of SEEDED_ROLE_KEYS) {
      expect(KNOWN_PERMISSION_KEYS.has(key)).toBe(true);
    }
  });
});

describe('presets', () => {
  test('the Encoder preset is byte-identical to the seeded Encoder role', () => {
    const encoder = ROLE_PRESETS.find(p => p.id === 'encoder');
    expect(encoder.config).toEqual({
      enable: ['*'],
      disable: SEEDED_ROLE_KEYS,
    });
  });

  test('every preset config has enable and disable arrays', () => {
    for (const preset of ROLE_PRESETS) {
      expect(Array.isArray(preset.config.enable)).toBe(true);
      expect(Array.isArray(preset.config.disable)).toBe(true);
    }
  });
});
