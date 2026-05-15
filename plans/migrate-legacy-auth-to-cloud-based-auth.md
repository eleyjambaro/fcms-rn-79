# Plan: Cloud-Based Role-Based Sub-Accounts (FCMS)

## Context

The app had a legacy local SQLite auth system where a root account could create sub-accounts (employees) with enable/disable role permissions, all stored on-device. The app now exclusively uses FCMS Cloud auth (`CloudAuthStackV2`), but sub-accounts are still local-only. The goal is to make sub-account creation produce **real cloud accounts** with cloud login credentials, while preserving the same enable/disable role-permission model.

**User decisions:**
- Sub-accounts sign in with **email + password** (no OTP)
- Sub-accounts can only sign in on **devices explicitly assigned to them** by the owner
- **Full custom role CRUD** (Admin + Encoder built-ins + create/edit/delete custom roles)

---

## Part A — API (`/Users/eleyjambaro/fcms-api/src`)

### A1. New migrations (run in order)

**`database/migrations/2024_01_01_000011_create_roles_table.php`**
```php
Schema::create('roles', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('company_id')->constrained('companies')->cascadeOnDelete();
    $table->string('name');
    $table->text('role_config_json');      // {"enable":["*"],"disable":[...]}
    $table->boolean('is_app_default')->default(false);
    $table->timestamps();
    $table->softDeletes();
});
```

**`database/migrations/2024_01_01_000012_alter_accounts_add_role_fields.php`**
```php
Schema::table('accounts', function (Blueprint $table) {
    $table->boolean('is_root_account')->default(false)->after('email_verified_at');
    $table->foreignUuid('role_id')->nullable()->constrained('roles')->nullOnDelete()->after('is_root_account');
    $table->string('first_name')->nullable()->after('role_id');
    $table->string('last_name')->nullable()->after('first_name');
    $table->boolean('is_deactivated')->default(false)->after('last_name');
    $table->foreignUuid('created_by_account_id')->nullable()->constrained('accounts')->nullOnDelete()->after('is_deactivated');
});
```

**`database/migrations/2024_01_01_000013_create_device_account_assignments_table.php`**
```php
Schema::create('device_account_assignments', function (Blueprint $table) {
    $table->uuid('id')->primary();
    $table->foreignUuid('device_id')->constrained('devices')->cascadeOnDelete();
    $table->foreignUuid('account_id')->constrained('accounts')->cascadeOnDelete();
    $table->timestamps();
    $table->unique(['device_id', 'account_id']);
});
```
No soft deletes — a hard delete means "revoke access." One device can have many sub-accounts and vice versa.

### A2. New/modified models

**`app/Models/Role.php`** (new) — `HasUuids`, `SoftDeletes`, `belongsTo(Company)`, `hasMany(Account)`

**`app/Models/DeviceAccountAssignment.php`** (new) — `HasUuids`, `belongsTo(Device)`, `belongsTo(Account)`

**`app/Models/Account.php`** (modify) — add to `$fillable`: `is_root_account`, `role_id`, `first_name`, `last_name`, `is_deactivated`, `created_by_account_id`; add casts for booleans; add `belongsTo(Role)`, `hasMany(DeviceAccountAssignment)`, `belongsTo(Account, 'created_by_account_id')` relationships

### A3. EnsureHasPermission middleware

**`app/Http/Middleware/EnsureHasPermission.php`** (new) — registered as `permission` alias in `bootstrap/app.php`

Logic: root accounts bypass all checks. For non-root: load `account->role->role_config_json`, check feature key is in `enable` (or `enable[0]==='*'`) AND NOT in `disable`. Return 403 if not allowed.

### A4. AuthController changes (`app/Http/Controllers/AuthController.php`)

**`signup`:** After creating company/account, mark account `is_root_account = true` and seed two default roles for the company (Admin: `enable:['*'], disable:[]`; Encoder: `enable:['*'], disable:['revenues','recipes','reports','dataSyncAndBackup','inventoryDataTemplate','userManagement','settings','account.updateCompanyProfile']`).

**`signin`:** Add optional `device_id` field. If account is not root: require `device_id`, verify a `device_account_assignments` record exists for `(account_id, device_id)`. If `is_deactivated`, return 403.

**`formatAccount` helper:** Expand to include `first_name`, `last_name`, `is_root_account`, `is_deactivated`, `role_id`, `role_config` (decoded from role's JSON; root accounts always get `{enable:['*'],disable:[]}`). Load `role` relationship in `me()` and `verifyOtp()`.

### A5. New controllers

**`RoleController`** — company-scoped CRUD (`GET/POST /api/v2/roles`, `GET/PUT/DELETE /api/v2/roles/{id}`). Guard DELETE: return 422 if `is_app_default = true`.

**`AccountController`** — company-scoped sub-account CRUD (`GET/POST /api/v2/accounts`, `GET/PUT/DELETE /api/v2/accounts/{id}`). Filters `is_root_account = false`. Validates that `role_id` belongs to same company. Guard DELETE: cannot delete root accounts.

**`DeviceAccountAssignmentController`** — (`GET/POST /api/v2/device-account-assignments`, `DELETE /api/v2/device-account-assignments/{id}`). `store` is idempotent via `firstOrCreate`. `index` accepts `?account_id=` or `?device_id=` query params.

### A6. Routes (`routes/api.php`)

```php
Route::middleware(['auth:sanctum', 'throttle:api', 'permission:userManagement'])
    ->group(function () {
        Route::apiResource('roles', RoleController::class);
        Route::apiResource('accounts', AccountController::class);
        Route::apiResource('device-account-assignments', DeviceAccountAssignmentController::class)
            ->only(['index', 'store', 'destroy']);
    });
```

---

## Part B — RN App (`/Users/eleyjambaro/fcms-rn-79/src`)

### B1. New server query files

**`serverDbQueries/v2/accounts.js`** — `getCloudSubAccounts`, `createCloudSubAccount`, `updateCloudSubAccount({id, ...values})`, `deleteCloudSubAccount(id)`. Follow auth header pattern from existing `v2/devices.js`.

**`serverDbQueries/v2/roles.js`** — `getCloudRoles`, `createCloudRole`, `updateCloudRole`, `deleteCloudRole`

**`serverDbQueries/v2/deviceAccountAssignments.js`** — `getCloudDeviceAccountAssignments(params)`, `createCloudDeviceAccountAssignment({device_id, account_id})`, `deleteCloudDeviceAccountAssignment(id)`

### B2. Constants

**`constants/rnSecureStorageKeys.js`** — no new key needed (sub-account sign-in reuses the same `cloudV2AuthToken` and `cloudV2AuthUser` keys)

**`constants/routes.js`** — add `cloudV2SubAccountSignIn: () => 'CloudV2SubAccountSignIn'`, `cloudRoles: () => 'CloudRoles'`

### B3. Context & hooks

**`context/providers/CloudAuthContextProvider.js`** — add `switchUser` action that clears `authToken`/`authUser` only (preserves `deviceId`, `deviceToken`, `designatedBranch`). Add corresponding `SWITCH_USER` reducer case. The standard `signIn` action already works for sub-accounts since it only updates auth fields.

**`hooks/useCurrentUser.js`** — remove `is_root_account: true` override. Spread `cloudState.authUser.account` directly; `is_root_account` and `role_config` come from the API response and are stored in `authUser.account`.

```js
const authUser = cloudState.authUser
  ? { ...cloudState.authUser.account }  // includes is_root_account, role_config from API
  : null;
```

### B4. Sub-account sign-in screen

**`screens/CloudV2SubAccountSignIn.js`** (new) — email + password form. On submit: reads `cloudAuthState.deviceId` from context; POSTs to `/api/v2/auth/signin` with `{email, password, device_id}`. On success: calls `cloudActions.signIn(data)` (standard action). If `deviceId` is null (device not yet set up by owner), shows error: "This device must be set up by the account owner first."

**`stacks/CloudAuthStackV2.js`** — add `CloudV2SubAccountSignIn` screen to Phase 1 stack. Add a "Sign in as team member" link to the existing `CloudV2SignIn` screen.

End-to-end flow:
1. Owner registers device + branch (existing OTP flow) → `cloudV2DeviceId` + `cloudV2DesignatedBranch` saved
2. Owner signs out OR uses "Switch User" → `App.js` shows `CloudAuthStackV2`
3. Employee taps "Sign in as team member" → `CloudV2SubAccountSignIn`
4. API validates password + `device_account_assignments` → returns `role_config`, `is_root_account: false`
5. `cloudActions.signIn` updates `authToken`/`authUser`; device/branch preserved in SecureStorage
6. `App.js` gates pass → `RootStack` renders with correct role restrictions

### B5. Update existing user management UI

**`screens/LocalUserAccounts.js`** — replace `createLocalUserAccount` mutation with `createCloudSubAccount`. Replace query invalidation key with `['cloudSubAccounts']`.

**`components/accounts/LocalUserAccountList.js`** — replace `getLocalUserAccounts` / `updateLocalUserAccount` / `deleteLocalUserAccount` with cloud counterparts. Switch from `useInfiniteQuery` to `useQuery` (flat list, no pagination needed).

**`components/forms/LocalUserAccountForm.js`** — replace `getRoles` (local SQLite) with `getCloudRoles`. Map `data?.data ?? []` as the roles list.

### B6. New screens

**`screens/CloudRoles.js`** (new) — list company roles from `getCloudRoles`. Create/edit via modal (Formik form with `name` field and `role_config_json` text editor for MVP). Delete with guard (shows API error message if built-in role). Register in `RootStack.js` under `routes.cloudRoles()`.

**`components/modals/ManageSubAccountDevicesModal.js`** (new) — shown from the sub-account's bottom sheet "Manage Device Access" option. Lists company devices, shows checkboxes for assigned ones. Calls `createCloudDeviceAccountAssignment` / `deleteCloudDeviceAccountAssignment`.

### B7. RootStack

**`stacks/RootStack.js`** — add `CloudRoles` screen import and `Stack.Screen` entry.

---

## Implementation Order

**API first:**
1. Migrations (000011 → 000012 → 000013)
2. Role model + DeviceAccountAssignment model
3. Update Account model
4. EnsureHasPermission middleware + register alias
5. AuthController (formatAccount, signup seeding, signin device check)
6. RoleController, AccountController, DeviceAccountAssignmentController
7. routes/api.php
8. `php artisan migrate`

**RN after API is up:**
9. `v2/accounts.js`, `v2/roles.js`, `v2/deviceAccountAssignments.js`
10. Update `routes.js`, `useCurrentUser.js`, `CloudAuthContextProvider.js`
11. `CloudV2SubAccountSignIn.js` screen + update `CloudAuthStackV2.js`
12. Update `LocalUserAccountForm.js`, `LocalUserAccountList.js`, `LocalUserAccounts.js`
13. `CloudRoles.js` screen + `ManageSubAccountDevicesModal.js`
14. Update `RootStack.js`

---

## Verification

1. After signup: `GET /api/v2/roles` returns Admin + Encoder. `GET /api/v2/auth/me` shows `is_root_account: true`.
2. Create sub-account with Encoder role. Sign in with wrong device → 403. Assign device → sign in succeeds with `is_root_account: false` and Encoder `role_config`.
3. Deactivate sub-account → sign in returns 403.
4. Sub-account with Encoder role calling `GET /api/v2/roles` → 403 (userManagement disabled).
5. Root account calling same → 200.
6. Custom role CRUD works; DELETE on Admin/Encoder returns 422.
7. In RN app: sign in as Encoder sub-account → Reports and Settings tabs show `UnauthorizedAccount`. Revenues missing from Home.
8. `CloudRoles` screen: create/edit/delete custom roles. Cannot delete built-ins.
9. "Switch User" preserves device/branch so sub-account can immediately sign in.
