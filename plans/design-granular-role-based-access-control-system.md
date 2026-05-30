# Granular, User-Friendly Role Permissions

## Context

Today, roles are edited by hand-typing raw JSON into a multiline `TextInput` in
[CloudRoles.js](src/screens/CloudRoles.js). The stored shape is a flat allow/deny list of
**module-level** strings:

```json
{ "enable": ["*"], "disable": ["recipes", "reports", "settings", "account.updateCompanyProfile"] }
```

Enforcement is **module-level only** and copy-pasted ~6 times as inline `if` blocks in
[MainTab.js](src/tabs/MainTab.js), [Home.js](src/screens/Home.js), and
[Account.js](src/screens/Account.js). There is no central registry of valid keys and no
way to express finer control — e.g. "a Chef who can create/read/update/delete recipes but
**cannot** Yield." The server ([RoleController.php](../fcms-api/src/app/Http/Controllers/RoleController.php))
only validates that `enable`/`disable` are arrays; contents are opaque.

**Goal:** a granular (CRUD + special actions per domain), user-friendly (checkbox/accordion)
role editor that is maintainable, scalable, and backward compatible — without a DB migration
or breaking existing roles.

**Approved scope (from clarifying Q&A):** Foundation + key-feature wiring · client-enforced
(server stays an opaque store) · **all** domains in the catalog · ship presets.

## Design decision

**Keep the `{enable, disable}` flat dot-key format.** It is backward compatible (no client
DB migration, server keeps accepting it), preserves the existing `*` / deny semantics, and
extends the dot-notation pattern already established by
[transferPermissions.js](src/constants/transferPermissions.js) (`transfer.create`, etc.).
We do **not** introduce a nested-object schema. Granularity comes from adding **action**
dot-keys (`recipes.yield`, `items.delete`) under each existing **module** key, plus a
central registry, a central check helper, and a checkbox editor that serializes to/from the
same on-disk format.

## 1. Permission registry — `src/constants/rolePermissions.js` (new)

Single source of truth for the catalog and the editor UI. Ordered list of **domains**; each
domain has a bare `moduleKey` (the legacy gate string + implicit ancestor of its actions)
and an ordered list of **actions** with full dot-keys + human labels. Follows the existing
`KEYS + LABELS` pattern of [transferPermissions.js](src/constants/transferPermissions.js).

```js
export const PERMISSION_DOMAINS = [
  { moduleKey: 'items', label: 'Items', icon: 'pricetags-outline', actions: [
      {key: 'items.view', label: 'View items'},
      {key: 'items.create', label: 'Register / add items'},
      {key: 'items.edit', label: 'Edit items'},
      {key: 'items.delete', label: 'Delete items'} ]},
  { moduleKey: 'recipes', label: 'Recipes', icon: 'book-outline', actions: [
      {key: 'recipes.view', label: 'View recipes'},
      {key: 'recipes.create', label: 'Create recipes'},
      {key: 'recipes.edit', label: 'Edit recipes'},
      {key: 'recipes.delete', label: 'Delete recipes'},
      {key: 'recipes.yield', label: 'Yield / produce finished product'} ]},  // gates "Yield Now"
  // ... transfer domain REUSES TRANSFER_PERMISSIONS/_LABELS (import, do not re-declare)
];
```

**Full catalog (all domains):** `items`, `recipes`(+yield), `logs`(view/void/adjust),
`inventory`, `batchPurchase`(view/create/confirm/delete), `stockUsage`(view/create/confirm/delete),
`transfer`(create/review/transfer_out/receive — **reuse** existing constants),
`salesLog`/`counter`/`salesOrders`(view/create/confirm/refund/void), `revenues`, `expenses`,
`vendors`, `categories`, `modifiers`, `sellingMenu`, `taxes`, `reports`(read/export),
`spoilage`, `dataSyncAndBackup`(backup/restore), `inventoryDataTemplate`(import/export),
`userManagement`(roles/accounts), `settings`(view/edit), `account.updateCompanyProfile`.

> **Critical:** `moduleKey` strings must stay byte-identical to the strings already gated in
> [Home.js:147-150](src/screens/Home.js#L147-L150), [MainTab.js](src/tabs/MainTab.js), and
> [Account.js](src/screens/Account.js) (`recipes`, `reports`, `settings`, `logs`, `inventory`,
> `vendors`, `spoilage`, `salesLog`, `counter`, `salesOrders`, `sellingMenu`,
> `dataSyncAndBackup`, `inventoryDataTemplate`, `userManagement`). The registry's moduleKey set
> must be a **superset** of every string in the seeded roles and those three files (add a
> dev-time test asserting this — see Verification).

**Presets** (same on-disk format, so "apply preset" == "load a config"):

```js
export const ROLE_PRESETS = [
  {id:'admin',   label:'Admin (full access)', config:{enable:['*'], disable:[]}},
  {id:'manager', label:'Manager',             config:{enable:[/* module keys */], disable:[]}},
  {id:'encoder', label:'Encoder',             config:{enable:['*'], disable:[/* byte-identical to seeded Encoder */]}},
  {id:'chef',    label:'Chef',                config:{enable:['recipes','items.view','logs.view'], disable:[]}},
];
```

Make the Encoder preset byte-identical to the server seed so applying it reproduces the seed.

## 2. Check helper + hook (the single reader of role config)

`src/permissions/hasPermission.js` (pure) and `src/hooks/useRoleAccess.js` (hook).
**Name `useRoleAccess`** — the existing `src/hooks/usePermissions.js` is unrelated (device
storage) and must not be reused.

```js
// hasPermission(roleConfig, key, {isRoot}) — key e.g. 'recipes.yield'
//   chain = ancestors(key)  // ['recipes.yield','recipes']
//   if isRoot                              -> true
//   if any(chain) in disable               -> false   // disable wins, at exact key OR ancestor
//   if '*' in enable                       -> true
//   if any(chain) in enable                -> true     // ancestor module grants child action
//   else                                   -> false    // (matches legacy `else { hide }`)
```

This generalizes the canonical inline check to dot-key ancestry. **It is provably identical
to today's behavior for every currently-stored role:** Admin (`*`) → all allow; Encoder
(`enable:['*']` + disable list) → each disabled module and its children denied, rest allowed;
bare-key gates map to a single-element chain. The only new capability is meaningful inference
for dot-keys, which no stored role uses yet.

`useRoleAccess()` reads `authUser` via [useCurrentUser](src/hooks/useCurrentUser.js), derives
`isRoot` + `roleConfig`, and returns `{ can(key), isRoot, roleConfig }`.

## 3. Editor serialization (load + save) — `src/permissions/serializeRoleConfig.js` (new)

**LOAD (config → checked action keys):** reuse `hasPermission` so loading is defined by the
exact same semantics as enforcement (no second interpretation to drift):

```
checked(A.key) = hasPermission(config, A.key, {isRoot:false})  // for every action in registry
```

Result: `enable:['*']` → all checked; Encoder → all except disabled modules' actions;
`enable:['recipes']` → all `recipes.*` checked.

**SAVE (checked set → config):** explicit **grant-list** model (predictable 1:1 with the
checkboxes; `disable` stays `[]`):

```
1. if EVERY registry action is checked        -> {enable:['*'], disable:[]}
2. else: enable = []
        for each domain D:
          if all of D.actions checked  -> enable.push(D.moduleKey)   // bare key: legacy gate + ancestor grant
          else                         -> push each checked action key
        carry forward any original enable/disable entries NOT represented by any registry
          action (unknown-key passthrough — never silently drop)
        -> {enable, disable:[]}
3. ROUND-TRIP GUARD: if loadChecked(newConfig) deep-equals loadChecked(originalConfig),
        re-emit originalConfig verbatim (so an unedited Encoder saves back byte-identical).
```

Snapshot `originalConfig` at load. The guard guarantees **loading then saving an unchanged
legacy role does not corrupt it**. If the user *does* edit, an Encoder-style deny-list
re-serializes as an equivalent grant-list — semantically identical under `hasPermission`,
intended, documented. Always emitting the bare `moduleKey` for fully-checked modules keeps
every legacy `enable.includes('recipes')` gate working.

## 4. Editor UI — `src/components/roles/RolePermissionEditor.js` (new)

Replaces the `role_config_json` `TextInput` block in
[CloudRoles.js:235-257](src/screens/CloudRoles.js#L235-L257). Reuses react-native-paper.

- **Preset picker row** (top): `Chip`/`Button` per `ROLE_PRESETS`; tap → load preset config
  into the tree (confirm if dirty).
- **Per domain:** `List.Accordion` (label + icon); inside, one `Checkbox.Item` per action.
- **Per-domain master toggle** with 3 states — RN-Paper has no true indeterminate checkbox;
  use a right-accessory icon: `checkbox-marked` (all) / `minus-box-outline` (partial) /
  `checkbox-blank-outline` (none). Tap = check-all when not all, else uncheck-all.
- Hold `checkedKeys` as a `Set` in the editor; serialize on submit inside
  [CloudRoles.js](src/screens/CloudRoles.js) `handleFormSubmit`. Keep the existing
  create/update/delete React Query mutations and modal scaffolding. Simplify the Yup schema
  to "name required" (the editor cannot produce invalid JSON); optionally require ≥1 action.

## 5. Wiring enforcement (this pass)

`src/components/permissions/PermissionGate.js` (new): `<PermissionGate permission="recipes.yield">…</PermissionGate>`
renders children only when `useRoleAccess().can(permission)`.

- **Recipe Yield** — wrap the "Yield Now" `Button` in
  [RecipeSummary.js:229-238](src/components/recipes/RecipeSummary.js#L229-L238) with
  `permission="recipes.yield"`; add a defense-in-depth block in
  [ProduceFinishedProductStock.js](src/modals/ProduceFinishedProductStock.js) (early-return
  unauthorized if `!can('recipes.yield')`) so back-nav/deep-links can't bypass.
- **Items** — gate the "Register Item" button in [Items.js](src/screens/Items.js) with
  `items.create`; filter the Edit/Delete entries in the `itemOptions` array of
  [ItemList.js](src/components/items/ItemList.js) by `can('items.edit')` / `can('items.delete')`.
- **Refactor the 6 inline checks** to use the helper, behavior-identical:
  - [MainTab.js](src/tabs/MainTab.js) reports/settings — preserve the **3-way** outcome
    (`allow` / render `UnauthorizedAccount` when matched-but-disabled / `null` when no claim).
    Add a small `tabAccessState(config, key, isRoot) -> 'allow'|'unauthorized'|'hidden'` helper
    so this nuance stays centralized (a plain boolean would lose the `UnauthorizedAccount`
    distinction).
  - [Account.js](src/screens/Account.js) `renderDataSyncAndBackupSection` /
    `renderInventoryDataTemplateSection` / `renderUsersSection` — these return `null`, so a
    plain `can(moduleKey)` suffices; keep the root-only extra Drawer items branch.
  - [Home.js](src/screens/Home.js) `renderMainButtons` (~544) and
    `renderHighlightedFirstRowButtons` (~514) → `.filter(btn => can(btn))`. The highlighted
    batch buttons (`batchPurchase`, `batchTransfer`, `endingInventory`) move from "root/`*`
    only" to real-key gating via `can()` — an intentional improvement consistent with the
    granular goal (they're now in the registry).

Use the `can` hook in array-building code (Home, ItemList options); use `PermissionGate` for
single JSX subtrees (Yield button, Register Item button).

## 6. Server (minimal — client-enforced)

**No required change.** [RoleController.php](../fcms-api/src/app/Http/Controllers/RoleController.php)
`store`/`update` validate only valid-JSON + `enable`/`disable` arrays; granular dot-keys
already pass. [EnsureHasPermission.php](../fcms-api/src/app/Http/Middleware/EnsureHasPermission.php)
and the seeded defaults in [AuthController.php](../fcms-api/src/app/Http/Controllers/AuthController.php)
stay as-is and remain valid. No migration. (Optional, **deferred**: a server-side key
allowlist — rejected for now because it couples server deploys to every new client key and
risks rejecting forward-compatible clients.)

## 7. Backward compatibility

- All existing roles behave identically (proof in §2); roles are REST-only, not in delta sync.
- The editor opens any legacy role (load = `hasPermission`) and re-saves losslessly (round-trip
  guard re-emits original bytes on a no-op save).
- Presets are stored-format configs; Encoder preset reproduces the seed byte-for-byte.
- Ship order, each independently shippable: (1) registry + `hasPermission` + hook + tests →
  (2) refactor the 6 gates (behavior-identical, regression-verify) → (3) editor swap in
  CloudRoles → (4) wire Yield + items gating.

## 8. Verification

- **Unit — `hasPermission`** (`src/permissions/__tests__/hasPermission.test.js`): root bypass;
  `*`; exact key; ancestor grant (`enable:['recipes']` ⇒ `recipes.yield`/`recipes.create` true);
  disable override at exact key and ancestor (`disable:['recipes']` ⇒ `recipes.yield` false);
  full Encoder config ⇒ each seeded-disabled module false / others true; Admin ⇒ all true;
  `account.updateCompanyProfile` denial.
- **Unit — serializer**: Admin load→save ⇒ `{enable:['*'],disable:[]}`; Encoder unedited
  load→save ⇒ byte-identical seed; `enable:['recipes']` ⇒ all recipes checked ⇒ save ⇒
  `enable:['recipes']`; uncheck `recipes.yield` ⇒ grant-list of the other `recipes.*` keys;
  unknown-key passthrough preserved.
- **Registry guard test**: every key in the seeded roles + every gate string in Home/MainTab/
  Account exists in the registry (catches §1 superset requirement).
- **Manual E2E**: create a "Chef" role = all `recipes.*` except `recipes.yield` (+ `items.view`);
  assign to a sub-account; sign in → "Yield Now" hidden, ProduceFinishedProductStock blocks
  direct nav, recipe create/edit/delete still work. Regression: Admin sub-account = everything;
  Encoder sub-account = reports/settings/recipes/etc. hidden exactly as before.
- `npm run lint` and `npm test`.

## Files

**Create:**
- [src/constants/rolePermissions.js](src/constants/rolePermissions.js) — registry + presets
- [src/permissions/hasPermission.js](src/permissions/hasPermission.js) — pure helper + `ancestors`
- [src/permissions/serializeRoleConfig.js](src/permissions/serializeRoleConfig.js) — load/save
- [src/hooks/useRoleAccess.js](src/hooks/useRoleAccess.js) — hook (NOT `usePermissions`)
- [src/components/permissions/PermissionGate.js](src/components/permissions/PermissionGate.js)
- [src/components/roles/RolePermissionEditor.js](src/components/roles/RolePermissionEditor.js)
- `src/permissions/__tests__/` — `hasPermission.test.js`, `serializeRoleConfig.test.js`, registry guard test

**Modify:**
- [src/screens/CloudRoles.js](src/screens/CloudRoles.js) — swap JSON box for editor; simplify Yup
- [src/tabs/MainTab.js](src/tabs/MainTab.js) — reports/settings via `tabAccessState`
- [src/screens/Account.js](src/screens/Account.js) — 3 section gates via `can()`
- [src/screens/Home.js](src/screens/Home.js) — button filters via `can()`
- [src/components/recipes/RecipeSummary.js](src/components/recipes/RecipeSummary.js) — gate Yield
- [src/modals/ProduceFinishedProductStock.js](src/modals/ProduceFinishedProductStock.js) — defense-in-depth
- [src/screens/Items.js](src/screens/Items.js) — gate Register Item
- [src/components/items/ItemList.js](src/components/items/ItemList.js) — filter Edit/Delete options

**Server:** none required (optional deferred allowlist in RoleController.php).

## Top risks

1. **Serializer unknown-key drop** — must include the unknown-key passthrough + the registry
   superset guard test. Highest-risk corner of the round-trip.
2. **MainTab 3-way state** — keep `tabAccessState`; a plain boolean loses `UnauthorizedAccount` vs `null`.
3. **Indeterminate master toggle** — RN-Paper has no native indeterminate checkbox; use the dash-icon accessory.
