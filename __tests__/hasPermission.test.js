import {
  hasPermission,
  tabAccessState,
  ancestors,
} from '../src/permissions/hasPermission';

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

describe('ancestors', () => {
  test('returns the key plus its dot-ancestors, broadest last', () => {
    expect(ancestors('recipes.yield')).toEqual(['recipes.yield', 'recipes']);
    expect(ancestors('account.updateCompanyProfile')).toEqual([
      'account.updateCompanyProfile',
      'account',
    ]);
    expect(ancestors('items')).toEqual(['items']);
  });

  test('handles empty / non-string input', () => {
    expect(ancestors('')).toEqual([]);
    expect(ancestors(null)).toEqual([]);
    expect(ancestors(undefined)).toEqual([]);
  });
});

describe('hasPermission', () => {
  test('root account bypasses everything', () => {
    expect(hasPermission({enable: [], disable: []}, 'items.create', {isRoot: true})).toBe(true);
    expect(hasPermission(ENCODER, 'recipes.yield', {isRoot: true})).toBe(true);
    expect(hasPermission(null, 'anything', {isRoot: true})).toBe(true);
  });

  test('wildcard enables everything', () => {
    expect(hasPermission(ADMIN, 'items.create')).toBe(true);
    expect(hasPermission(ADMIN, 'recipes.yield')).toBe(true);
    expect(hasPermission(ADMIN, 'reports')).toBe(true);
  });

  test('exact key in enable', () => {
    const cfg = {enable: ['items.create'], disable: []};
    expect(hasPermission(cfg, 'items.create')).toBe(true);
    expect(hasPermission(cfg, 'items.delete')).toBe(false);
  });

  test('ancestor module key grants child actions', () => {
    const cfg = {enable: ['recipes'], disable: []};
    expect(hasPermission(cfg, 'recipes.yield')).toBe(true);
    expect(hasPermission(cfg, 'recipes.create')).toBe(true);
    expect(hasPermission(cfg, 'items.create')).toBe(false);
  });

  test('disable overrides at the exact key', () => {
    const cfg = {enable: ['*'], disable: ['recipes.yield']};
    expect(hasPermission(cfg, 'recipes.yield')).toBe(false);
    expect(hasPermission(cfg, 'recipes.create')).toBe(true);
  });

  test('disable overrides at an ancestor module', () => {
    const cfg = {enable: ['*'], disable: ['recipes']};
    expect(hasPermission(cfg, 'recipes.yield')).toBe(false);
    expect(hasPermission(cfg, 'recipes')).toBe(false);
    expect(hasPermission(cfg, 'items.create')).toBe(true);
  });

  test('Encoder denies every seeded-disabled module (and children), allows the rest', () => {
    // Disabled modules + a child action of each.
    expect(hasPermission(ENCODER, 'recipes')).toBe(false);
    expect(hasPermission(ENCODER, 'recipes.yield')).toBe(false);
    expect(hasPermission(ENCODER, 'reports')).toBe(false);
    expect(hasPermission(ENCODER, 'reports.read')).toBe(false);
    expect(hasPermission(ENCODER, 'revenues.view')).toBe(false);
    expect(hasPermission(ENCODER, 'settings.edit')).toBe(false);
    expect(hasPermission(ENCODER, 'userManagement.manageRoles')).toBe(false);
    expect(hasPermission(ENCODER, 'account.updateCompanyProfile')).toBe(false);
    // Not disabled -> allowed via wildcard.
    expect(hasPermission(ENCODER, 'items.create')).toBe(true);
    expect(hasPermission(ENCODER, 'vendors.view')).toBe(true);
    expect(hasPermission(ENCODER, 'logs.void')).toBe(true);
  });

  test('empty / missing config denies non-root', () => {
    expect(hasPermission({enable: [], disable: []}, 'items.view')).toBe(false);
    expect(hasPermission(null, 'items.view')).toBe(false);
    expect(hasPermission(undefined, 'items.view')).toBe(false);
  });

  test('no key denies', () => {
    expect(hasPermission(ADMIN, '')).toBe(false);
    expect(hasPermission(ADMIN, undefined)).toBe(false);
  });
});

describe('tabAccessState', () => {
  test('root is always allowed', () => {
    expect(tabAccessState(ENCODER, 'reports', {isRoot: true})).toBe('allow');
  });

  test('wildcard with no disable is allow', () => {
    expect(tabAccessState(ADMIN, 'reports')).toBe('allow');
    expect(tabAccessState(ADMIN, 'settings')).toBe('allow');
  });

  test('claimed but disabled is unauthorized', () => {
    expect(tabAccessState(ENCODER, 'reports')).toBe('unauthorized');
    expect(tabAccessState(ENCODER, 'settings')).toBe('unauthorized');
    expect(
      tabAccessState({enable: ['reports'], disable: ['reports']}, 'reports'),
    ).toBe('unauthorized');
  });

  test('no claim at all is hidden', () => {
    expect(tabAccessState({enable: ['recipes'], disable: []}, 'reports')).toBe(
      'hidden',
    );
    expect(tabAccessState({enable: [], disable: []}, 'settings')).toBe('hidden');
  });

  test('not-disabled module under Encoder is allow', () => {
    expect(tabAccessState(ENCODER, 'items')).toBe('allow');
  });
});
