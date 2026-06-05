import {
  canAccessModule,
  moduleAccessState,
} from '../src/permissions/moduleAccess';

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
// The "Chef (Spoilage Limited)" / view-only style role from the bug report.
const SPOILAGE_VIEW_ONLY = {enable: ['spoilage.view'], disable: []};

describe('canAccessModule', () => {
  test('root account can access any module', () => {
    expect(canAccessModule(null, 'spoilage', {isRoot: true})).toBe(true);
    expect(canAccessModule(ENCODER, 'reports', {isRoot: true})).toBe(true);
  });

  test('wildcard enables every module', () => {
    expect(canAccessModule(ADMIN, 'spoilage')).toBe(true);
    expect(canAccessModule(ADMIN, 'settings')).toBe(true);
  });

  test('a partial (view-only) grant makes the module visible — the bug fix', () => {
    // can('spoilage') is false here (the original bug); canAccessModule is true.
    expect(canAccessModule(SPOILAGE_VIEW_ONLY, 'spoilage')).toBe(true);
  });

  test('any single action under the module grants visibility', () => {
    expect(canAccessModule({enable: ['items.create'], disable: []}, 'items')).toBe(
      true,
    );
    expect(
      canAccessModule({enable: ['transfer.receive'], disable: []}, 'transfer'),
    ).toBe(true);
  });

  test('a module with no granted action is not accessible', () => {
    // Only spoilage is granted, so vendors (and its actions) are not.
    expect(canAccessModule(SPOILAGE_VIEW_ONLY, 'vendors')).toBe(false);
    expect(canAccessModule({enable: [], disable: []}, 'spoilage')).toBe(false);
  });

  test('a module fully disabled is not accessible even under wildcard', () => {
    expect(canAccessModule(ENCODER, 'settings')).toBe(false);
    expect(canAccessModule(ENCODER, 'recipes')).toBe(false);
  });

  test('a not-disabled module under Encoder stays accessible', () => {
    expect(canAccessModule(ENCODER, 'items')).toBe(true);
    expect(canAccessModule(ENCODER, 'vendors')).toBe(true);
  });

  test('empty / missing key or config denies non-root', () => {
    expect(canAccessModule(ADMIN, '')).toBe(false);
    expect(canAccessModule(null, 'items')).toBe(false);
    expect(canAccessModule(undefined, 'items')).toBe(false);
  });
});

describe('moduleAccessState', () => {
  test('root is always allow', () => {
    expect(moduleAccessState(ENCODER, 'settings', {isRoot: true})).toBe('allow');
  });

  test('partial grant resolves to allow (fixes hidden tile/tab)', () => {
    expect(moduleAccessState(SPOILAGE_VIEW_ONLY, 'spoilage')).toBe('allow');
  });

  test('Encoder keeps unauthorized for claimed-but-disabled modules', () => {
    // Regression guard: must match tabAccessState behavior byte-for-byte.
    expect(moduleAccessState(ENCODER, 'settings')).toBe('unauthorized');
    expect(moduleAccessState(ENCODER, 'reports')).toBe('unauthorized');
  });

  test('an unclaimed module is hidden', () => {
    expect(moduleAccessState(SPOILAGE_VIEW_ONLY, 'reports')).toBe('hidden');
    expect(moduleAccessState({enable: [], disable: []}, 'settings')).toBe(
      'hidden',
    );
  });

  test('admin allows everything', () => {
    expect(moduleAccessState(ADMIN, 'settings')).toBe('allow');
    expect(moduleAccessState(ADMIN, 'reports')).toBe('allow');
  });
});
