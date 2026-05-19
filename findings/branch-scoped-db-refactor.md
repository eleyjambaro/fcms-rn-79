# Branch-Scoped DB Refactor — Findings

Findings from the refactor that made the local SQLite database company+branch specific
(DB filename: `FCMS_<companyId>_<branchId>`).

---

## Critical: Data Loss for Existing Users

This is the most serious problem. Every device that already has a branch assigned has its
data stored in `FCMS_<companyId>.db`. After this change, the app opens
`FCMS_<companyId>_<branchId>.db` — a brand new empty file. All existing local SQLite data
(items, recipes, purchases, etc.) becomes invisible overnight.

- Any records that were already synced to the cloud will re-appear after the next sync
  completes.
- Any records that were created locally but **not yet synced** are permanently stranded in
  the old file and will never surface again.

**Solution**: A one-time migration at startup. Before opening the new file, check if
`FCMS_<companyId>_<branchId>.db` doesn't exist but `FCMS_<companyId>.db` does. If so,
rename/copy the old file to the new name. This should live in `setActiveCompanyDb` or a
dedicated migration step called from it.

---

## Moderate: Custom Units Silently Lost

AsyncStorage keys change from `units_<companyId>` to `units_<companyId>_<branchId>`. Any
custom units the user added (beyond defaults) are still stored under the old key, but
`unitsKey()` now generates the new key and never reads the old one. `setDefaultUnits` finds
nothing under the new key and seeds defaults — making it appear to the user as though their
customizations were wiped.

**Solution**: A one-time migration in `setDefaultUnits` (or in the
`setActiveCompanyDb`/`setDesignatedBranch` call site): read from the old `units_<companyId>`
key if the new `units_<companyId>_<branchId>` key doesn't exist yet, write to the new key,
then delete the old one.

---

## Minor: Orphaned DB Files on Disk

For every existing user, the old `FCMS_<companyId>.db` file will remain on the device
forever with no cleanup. On devices that are updated (rather than doing the rename migration
above), this is wasted space.

**Solution**: After a successful migration, rename or delete the old file, or schedule an
async cleanup.

---

## Minor: Double DB Initialization for New Sign-ins

For a user signing in fresh (no stored branch yet), the flow now runs `setActiveCompanyDb`
+ `createTables` + `alterTables` + `createViews` twice:

1. In `signIn` → opens `FCMS_<companyId>` (no branch yet), seeds defaults
2. In `setDesignatedBranch` → opens `FCMS_<companyId>_<branchId>`, seeds defaults again

The first DB file (`FCMS_<companyId>`) becomes an orphan immediately after branch selection.
This is harmless functionally but wasteful — you're initializing and seeding a DB you'll
never use again.

**Solution**: Skip the `setDefaultUnits` + `createDefaultSettings` call in
`signIn`/`signUp`/`setAuthFromVerify` when `branchId` is null (i.e., defer seeding entirely
to `setDesignatedBranch`). This requires verifying that no part of the registration flow
reads settings or units before the branch is selected — which appears to be the case since
`RootStack` gates on `hasBranch`.

---

## Design Note: `setDesignatedBranch` Inside a `useMemo(() => ..., [])`

`setDesignatedBranch` calls `getActiveCompanyId()` from the module to get the current
company ID, which works correctly at runtime since it reads the module-level
`_activeCompanyId` variable directly. No stale closure issue here. Just worth noting as a
non-obvious dependency.
