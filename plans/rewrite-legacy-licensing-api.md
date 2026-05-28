# Rewrite Legacy Licensing API → New FCMS API

## Context

FCMS's licensing API currently lives in Firebase Cloud Functions (`/Users/eleyjambaro/fcms-firebase`) and was built for the **deprecated local-auth model**. It is unfit for FCMS Cloud because:

- The activation flow requires `localAuthToken`, `accountUID`, `companyUID`, `localAccounts`, `localCompanies` — all local-auth artifacts that no longer exist in cloud auth (`fcms-rn-79/src/localDbQueries/license.js:282-290`).
- The JWT uses **HS256 with `deviceUID + keyPair` as the shared secret** (`fcms-firebase/functions/activateLicense.js:146`). The `keyPair` is returned to the client as `kp` and stored in Firestore, so the "secret" is effectively known to anyone who can read the device ID and license token. Anyone with both can forge new tokens.
- It has no concept of **branch switching on a single device** — a feature FCMS Cloud supports (`CloudAuthContextProvider`, `setDesignatedBranch`).
- It has no concept of **multi-device** or **multi-branch** caps. Each license binds to exactly one `deviceUID` and one `accountUID`.
- There is **no revocation, renewal, or regeneration** path.

We are replacing this entire API in the new Laravel 11 backend (`fcms-api/deploy-staging`) with a clean module that:

1. Authenticates admin and customer flows via Sanctum (no more local-auth coupling).
2. Signs license JWTs with **RS256 (asymmetric)** so clients verify but cannot forge.
3. Embeds `max_devices`, `allowed_device_ids`, `max_branches`, `allowed_branch_ids`, plan, and feature flags as signed claims.
4. Supports add-device / add-branch operations that re-issue the license token (so caps and allowlists stay in sync with the embedded claims).
5. Supports revocation, status lookup, and admin listing.
6. Keeps the **offline-first** property: the device verifies the token locally with a bundled public key; expiration = license expiration.

## Design Decisions (locked)

| Decision | Choice |
|---|---|
| JWT signing | **RS256** — server-only RSA private key; RN bundles public key |
| Allowlist model | **Caps at generation, bind-as-you-go** — admin sets `max_devices`/`max_branches`; activation and add-* endpoints append to the allowlist and re-issue the JWT |
| JWT lifetime | **`exp` = license expiration** — full offline window for the entire license duration |
| Admin auth | **`is_super_admin` boolean on `accounts` + `EnsureSuperAdmin` middleware** — gated under `Route::middleware(['auth:sanctum','super.admin'])` |
| Migration | **None** — no existing customers; clean cutover |
| Legacy repo | **Leave `fcms-firebase` in place** for reference |

### Security upgrade: HS256 → RS256

| Aspect | Old (HS256) | New (RS256) |
|---|---|---|
| Signing key | `deviceUID + keyPair` (shared, known to client) | RSA private key on server only |
| Verifying key | Same shared secret | RSA public key bundled in app |
| Forgeability | Client has the secret → can mint tokens | Client cannot mint tokens |
| Device binding | Built into the signing secret (fragile) | A signed `allowed_device_ids` claim (verifiable) |
| Key rotation | Impossible (per-license secret) | Single keypair; rotate by re-issuing tokens |

The RSA private key lives in `.env` (`LICENSE_JWT_PRIVATE_KEY`) and is read by the signer service. The public key ships inside the RN app bundle.

### JWT payload shape (new)

```json
{
  "iss": "fcms-api",
  "aud": "fcms-app",
  "sub": "<license_id>",
  "jti": "<unique-token-id>",
  "iat": 1700000000,
  "exp": 1800000000,
  "license_key": "<uuid>",
  "company_id": "<uuid>",
  "plan": "standard",
  "max_devices": 1,
  "allowed_device_ids": ["<uuid>", ...],
  "max_branches": 1,
  "allowed_branch_ids": ["<uuid>", ...],
  "features": {
    "enable_sales": true,
    "enable_backup_data_locally": true,
    "enable_recover_data_locally": true,
    "enable_export_reports": true,
    "insert_limit": 0,
    "insert_item_limit_per_category": 0,
    "insert_category_limit": 0,
    "insert_user_limit": 0
  }
}
```

Client gates:
1. Verify signature with bundled RSA public key.
2. `exp` not in past.
3. Current `device_id` (from `cloudV2DeviceId` secure storage) ∈ `allowed_device_ids`.
4. Current designated `branch_id` (from `cloudV2DesignatedBranch`) ∈ `allowed_branch_ids`.
5. `features` drives feature gates (replaces today's `appConfigFromLicense`).

### Allowed-IDs model: bind-as-you-go

When a license is generated, admin sets only the **caps** (`max_devices=1`, `max_branches=1`). The customer activates on their first device/branch, which appends to the allowlist. When they hit `Add device` or `Add branch` (up to `max_devices` / `max_branches`), the API re-issues a fresh JWT containing the updated allowlist.

This keeps generation simple (admin doesn't need to know customer device IDs) and the token always reflects the current truth.

### Token re-issue & offline-first

The JWT `exp` equals the **license expiration** (could be 1 year). Once issued, the device verifies locally and works fully offline until that date.

A token re-issue is required when:
- A new device is added (allowlist changed → existing tokens on other devices are now stale on that claim, but they still work for *their own* device).
- A new branch is added.
- The license is renewed or revoked.

Add-device / add-branch require an online call; revocation is enforced online too (an online client checks a small revocation endpoint at startup; offline devices remain functional until `exp` — accepted trade-off for offline-first).

## API Surface (new in fcms-api)

Customer-facing (Sanctum, company-scoped):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v2/licenses/activate` | Activate a license key for the authenticated company. Binds the current device + designated branch. Returns signed JWT. |
| `GET`  | `/api/v2/licenses/me` | Return current license status + a fresh JWT for this company. |
| `POST` | `/api/v2/licenses/add-device` | Add the current device to `allowed_device_ids` (if under cap). Returns new JWT. |
| `POST` | `/api/v2/licenses/add-branch` | Add a branch to `allowed_branch_ids` (if under cap). Returns new JWT. |
| `POST` | `/api/v2/licenses/refresh` | Re-issue a fresh JWT with current claims (no changes). |

Admin-only (super-admin):

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/api/v2/admin/licenses` | Generate a license. Inputs: `plan`, `max_devices`, `max_branches`, `duration_type`, `duration_length` or `exact_expiration_date`, `features` (override), `cost_per_duration`, `remarks`. Returns the license key. |
| `GET`  | `/api/v2/admin/licenses` | List licenses (paginated). |
| `GET`  | `/api/v2/admin/licenses/{id}` | Detail. |
| `POST` | `/api/v2/admin/licenses/{id}/revoke` | Revoke. |

## Database Schema (new migrations)

`licenses`:
- `id` uuid PK
- `license_key` uuid unique (the customer-facing key)
- `company_id` uuid FK nullable (set on activation)
- `plan` string
- `status` enum: `inactive`, `active`, `revoked`, `expired`
- `max_devices` int default 1
- `max_branches` int default 1
- `duration_type` enum: `days`, `minutes`, `exact_date`
- `duration_length` int nullable
- `expires_at` timestamp nullable (set on activation for `days`/`minutes`; set at generation for `exact_date`)
- `features` json
- `cost_per_duration` decimal default 0
- `remarks` text nullable
- `generated_by_account_id` uuid FK (super-admin who created it)
- `activated_at` timestamp nullable
- `revoked_at` timestamp nullable
- `created_at`, `updated_at`

`license_devices`:
- `id` uuid PK, `license_id` FK, `device_id` FK, `assigned_at`, unique(`license_id`, `device_id`)

`license_branches`:
- `id` uuid PK, `license_id` FK, `branch_id` FK, `assigned_at`, unique(`license_id`, `branch_id`)

`license_token_issuances` (audit + revocation):
- `id` uuid PK, `license_id` FK, `jti` unique, `device_id` FK nullable, `issued_at`, `expires_at`, `revoked_at` nullable

## Implementation Steps

### Backend (`/Users/eleyjambaro/fcms-api/deploy-staging`)

1. **Add `firebase/php-jwt` to composer** and configure `LICENSE_JWT_PRIVATE_KEY` / `LICENSE_JWT_PUBLIC_KEY` in `.env` (PEM-encoded multi-line strings via `\n` escape).
2. **Generate RSA keypair** (script in `php artisan` command or one-time openssl); commit only the public key for the RN bundle.
3. **Add `is_super_admin` boolean to `accounts`** in a new migration; create `EnsureSuperAdmin` middleware (`app/Http/Middleware/EnsureSuperAdmin.php`).
4. **Migrations** (`database/migrations/`):
   - `2024_01_01_000012_add_is_super_admin_to_accounts.php`
   - `2024_01_01_000013_create_licenses_table.php`
   - `2024_01_01_000014_create_license_devices_table.php`
   - `2024_01_01_000015_create_license_branches_table.php`
   - `2024_01_01_000016_create_license_token_issuances_table.php`
5. **Models** (`app/Models/`): `License`, `LicenseDevice`, `LicenseBranch`, `LicenseTokenIssuance` — all `HasUuids`, all `belongsTo` / `hasMany` per schema.
6. **Service** (`app/Services/LicenseTokenService.php`):
   - `issueToken(License $license, ?Device $currentDevice = null): string` — collects allowlists from DB, builds payload, signs with RS256, persists row in `license_token_issuances`.
   - `verifyClaims(License $license): void` — internal sanity check (not expired, not revoked).
7. **Controllers** (`app/Http/Controllers/`):
   - `LicenseController` — `activate`, `me`, `addDevice`, `addBranch`, `refresh`. All scoped by `$request->user()->company_id`. Reuse `formatBranch`-style helpers; use base `success()`/`error()`.
   - `Admin/LicenseController` — `index`, `store`, `show`, `revoke`.
8. **Routes** (`routes/api.php`):
   - Customer block: `Route::prefix('licenses')->middleware(['auth:sanctum', 'throttle:api'])`.
   - Admin block: `Route::prefix('admin/licenses')->middleware(['auth:sanctum', 'super.admin', 'throttle:api'])`.
9. **Tests** (`tests/Feature/`):
   - `LicenseActivationTest.php` — happy path, wrong company, already-activated, expired-on-generation.
   - `LicenseAddDeviceTest.php` — under cap, at cap, duplicate device.
   - `LicenseAddBranchTest.php` — under cap, at cap, branch not owned by company.
   - `AdminLicenseTest.php` — non-admin gated, generate + list + revoke flow.

### React Native (`/Users/eleyjambaro/fcms-rn-79`)

1. **Bundle RSA public key** at `src/keys/licensePublicKey.js` (export PEM string).
2. **Swap JWT library**: `react-native-pure-jwt` does not support RS256. Replace with an RS256-capable lib. Recommended path: `react-native-rsa-native` (already JSI-friendly) for `verifyWithRS256(token, publicKey)`, plus a thin helper that splits the JWT, base64url-decodes the payload, and validates `exp` and other claims in JS. Fallback if `react-native-rsa-native` has issues with PKCS#8 keys: `react-native-jose` or `jsrsasign`. Final pick made when implementing — all three are viable; verification at implementation time confirms which builds cleanly on RN 0.79 / iOS + Android.
3. **Add new endpoints** in `src/serverDbQueries/v2/licenses.js` (new file, mirrors `devices.js` style):
   - `activateLicense({license_key, device_id, branch_id})`
   - `getLicense()`
   - `addLicenseDevice({device_id})`
   - `addLicenseBranch({branch_id})`
   - `refreshLicense()`
4. **Rewrite `/src/localDbQueries/license.js`**:
   - Drop all local-auth lookups (`getLocalAccountDBConnection`, `accounts`, `companies` queries).
   - `activateLicense({values})` reads `cloudV2DeviceId` + `cloudV2DesignatedBranch` from secure storage, posts to new endpoint with Sanctum bearer token (already attached by `cloudApiV2.js` interceptor), persists returned JWT.
   - Drop `keyPair` (`kp`) entirely — only the JWT (`lt`) is stored.
   - `getLicenseStatus` decodes with bundled public key; reads new payload keys (`features`, `allowed_device_ids`, `allowed_branch_ids`, `exp`, etc.); also enforces device + branch membership.
5. **Update `/src/constants/appConfig.js`**: merge `payload.features` instead of `payload.appConfig`. Map old keys → new keys (or rename gates throughout; see below).
6. **Update `endpoints.js`** to point license calls to `${CLOUD_API_V2_BASE_URL}/api/v2/licenses/*` instead of Firebase.
7. **Update feature gates** — `Home.js`, `DisabledFeatureModal.js`, anywhere reading `appConfigFromLicense?.enableSales`. Either keep the field names (`enable_sales`) and adapt the mapper, or rename. Recommend **keep old camelCase names in client, snake_case in JWT**, transformed in `appConfig.js`.
8. **Add branch-switch gate**: in `CloudAuthContextProvider.setDesignatedBranch`, check `allowed_branch_ids` before allowing the switch; if not allowed and under cap, call `addLicenseBranch` automatically; if at cap, block with an upgrade prompt.

### Cleanup

- Delete `/src/__serverFunctions/FirebaseFunctions/activateLicense.js` (legacy reference copy).
- Delete the `localAuthToken`/`localAccounts`/`localCompanies` collection block in `activateLicense` (`license.js:234-280`).
- **No migration needed** — FCMS Cloud has no existing customers on the old API. Clean cutover.
- **Leave `/Users/eleyjambaro/fcms-firebase` untouched** as historical reference. Decommission in a later cleanup task once the new API is validated in production.

## Critical files to be modified

Backend (`fcms-api`):
- `deploy-staging/routes/api.php` — add license route groups
- `deploy-staging/app/Http/Controllers/LicenseController.php` (new)
- `deploy-staging/app/Http/Controllers/Admin/LicenseController.php` (new)
- `deploy-staging/app/Http/Middleware/EnsureSuperAdmin.php` (new)
- `deploy-staging/app/Services/LicenseTokenService.php` (new)
- `deploy-staging/app/Models/License.php` (new) + 3 join models
- `deploy-staging/database/migrations/2024_01_01_0000{12..16}_*.php` (new)
- `deploy-staging/config/auth.php` (only if super-admin guard is added — likely not needed)
- `deploy-staging/composer.json` — add `firebase/php-jwt`

Frontend (`fcms-rn-79`):
- `src/localDbQueries/license.js` — rewrite end-to-end
- `src/constants/appConfig.js` — read new claim names
- `src/constants/endpoints.js` — switch from Firebase URL to FCMS API
- `src/serverDbQueries/v2/licenses.js` (new) — modeled on `src/serverDbQueries/v2/devices.js`
- `src/keys/licensePublicKey.js` (new) — bundled RSA public key (PEM)
- `src/context/providers/CloudAuthContextProvider.js` — branch-switch gate (only the `setDesignatedBranch` path)
- `src/screens/ActivateLicense.js` — wire to new flow (mostly unchanged, just call shape differs)
- `src/components/forms/LicenseForm.js` — unchanged inputs, unchanged
- `package.json` — drop `react-native-pure-jwt`, add chosen RS256-capable library

## Existing utilities to reuse

- `DeviceController::register` pattern (`deploy-staging/app/Http/Controllers/DeviceController.php:18-57`) — duplicate the SHA-256 hashing + token issuance pattern in `LicenseTokenService`.
- Base `Controller::success()`/`error()` helpers (`deploy-staging/app/Http/Controllers/Controller.php:7-32`) — all new endpoints use these.
- `Device::currentAssignment()` (`app/Models/Device.php`) — to find the currently designated branch for the current device during `activate`.
- RN: `cloudApiV2.js` axios instance — already injects Sanctum bearer; new license calls just use this client.
- RN: `deviceInfo.getPhysicalDeviceId()` (`src/lib/deviceInfo.js`) — used for client-side identity; not sent to license API (we send the registered `device_id` UUID instead).

## Verification

End-to-end:

1. **Backend tests** — `docker exec fcms_api_app php artisan test tests/Feature/LicenseActivationTest.php` (etc.).
2. **Generate + activate**:
   - Use tinker or a seeded super-admin account to `POST /api/v2/admin/licenses` with `max_devices=2`, `max_branches=2`, `duration_length=30`.
   - From the RN app (cloud-authed, registered device, designated branch), enter the returned license key in `ActivateLicense`.
   - Verify the response JWT decodes locally with the public key.
   - Verify `getLicenseStatus` returns `isLicenseExpired=false`, `allowed_device_ids=[this device]`, `allowed_branch_ids=[this branch]`, `features.enable_sales=true`.
3. **Multi-device**:
   - Register a second device on the same company, sign in, call `add-device` from the RN app.
   - Verify both devices' license tokens carry the updated allowlist after each refreshes.
4. **Multi-branch switch**:
   - Create a 2nd branch, switch designated branch, verify `add-branch` is auto-called and the token re-issues.
   - Set `max_branches=1`, attempt to switch to a 2nd branch, verify the switch is blocked with an upgrade prompt.
5. **Offline expiration**:
   - Generate a 1-minute license (`duration_type=minutes`, `duration_length=1`), activate, kill network, wait, verify gates flip to "expired".
6. **Revocation**:
   - Admin revokes the license, refetch `/me`, verify the device's token is rejected (or, offline, that the next `add-*` call fails until the user reactivates).
7. **Forgery resistance**:
   - Manually tamper a JWT claim, verify the client refuses to decode.
   - Confirm the public key alone cannot mint a new valid token.
