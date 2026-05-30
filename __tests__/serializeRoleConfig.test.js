import {
  loadCheckedSet,
  serializeRoleConfig,
} from '../src/permissions/serializeRoleConfig';
import {ALL_ACTION_KEYS} from '../src/constants/rolePermissions';

const ADMIN = {enable: ['*'], disable: []};
const ENCODER = {
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
};

describe('loadCheckedSet', () => {
  test('wildcard checks every action', () => {
    const checked = loadCheckedSet(ADMIN);
    expect(checked.size).toBe(ALL_ACTION_KEYS.length);
  });

  test('module key checks all of its actions', () => {
    const checked = loadCheckedSet({enable: ['recipes'], disable: []});
    expect(checked.has('recipes.view')).toBe(true);
    expect(checked.has('recipes.yield')).toBe(true);
    expect(checked.has('items.create')).toBe(false);
  });

  test('Encoder leaves disabled modules unchecked', () => {
    const checked = loadCheckedSet(ENCODER);
    expect(checked.has('recipes.yield')).toBe(false);
    expect(checked.has('reports.read')).toBe(false);
    expect(checked.has('items.create')).toBe(true);
  });
});

describe('serializeRoleConfig — round trips', () => {
  test('Admin round-trips to wildcard', () => {
    const checked = loadCheckedSet(ADMIN);
    expect(serializeRoleConfig(checked, ADMIN)).toEqual({
      enable: ['*'],
      disable: [],
    });
  });

  test('unedited Encoder is re-emitted byte-for-byte', () => {
    const checked = loadCheckedSet(ENCODER);
    const result = serializeRoleConfig(checked, ENCODER);
    expect(result).toEqual(ENCODER);
    expect(JSON.stringify(result)).toBe(JSON.stringify(ENCODER));
  });

  test('unedited module-grant role is preserved', () => {
    const original = {enable: ['recipes'], disable: []};
    const checked = loadCheckedSet(original);
    expect(serializeRoleConfig(checked, original)).toEqual(original);
  });
});

describe('serializeRoleConfig — edits', () => {
  test('unchecking yield drops to an explicit grant-list without recipes/yield', () => {
    const original = {enable: ['recipes'], disable: []};
    const checked = loadCheckedSet(original);
    checked.delete('recipes.yield');

    const result = serializeRoleConfig(checked, original);

    expect(result.disable).toEqual([]);
    expect(result.enable).toEqual(
      expect.arrayContaining([
        'recipes.view',
        'recipes.create',
        'recipes.edit',
        'recipes.delete',
      ]),
    );
    expect(result.enable).not.toContain('recipes');
    expect(result.enable).not.toContain('recipes.yield');
  });

  test('fully-checked everything collapses to wildcard', () => {
    const checked = new Set(ALL_ACTION_KEYS);
    const original = {enable: [], disable: []};
    expect(serializeRoleConfig(checked, original)).toEqual({
      enable: ['*'],
      disable: [],
    });
  });

  test('fully-checked module collapses to its bare module key', () => {
    const checked = new Set([
      'items.view',
      'items.create',
      'items.edit',
      'items.delete',
    ]);
    const result = serializeRoleConfig(checked, {enable: [], disable: []});
    expect(result.enable).toContain('items');
    expect(result.enable).not.toContain('items.view');
  });
});

describe('serializeRoleConfig — unknown-key passthrough', () => {
  test('preserves an unknown disable key on a no-op save', () => {
    const original = {enable: ['*'], disable: ['someFutureModule']};
    const checked = loadCheckedSet(original);
    const result = serializeRoleConfig(checked, original);
    expect(result.disable).toContain('someFutureModule');
  });

  test('carries an unknown enable key through an edit', () => {
    const original = {enable: ['*', 'someFutureModule'], disable: []};
    const checked = loadCheckedSet(original);
    checked.delete('items.delete'); // force an effective change

    const result = serializeRoleConfig(checked, original);
    expect(result.enable).toContain('someFutureModule');
    // items module is now partial, so it must not collapse to the bare key.
    expect(result.enable).not.toContain('items');
  });
});
