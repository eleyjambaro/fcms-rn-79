# FCMS MOBILE APP USER JOURNEY

**Version:** FINAL (Production Ready)

---

## 1. Initial State

**Default View:** Login Screen

### Login Form

- **Fields:** `email`, `password`
- **Actions:** \* `[Submit]`
  - `Don't have an account? [Sign Up]`

---

## SCENARIO 1: NEW ACCOUNT (Sign Up)

### 1. Create FCMS Cloud Account

#### 1.A. Company Details (Step 1)

- **UI:** Multi-step Form (Company Info)
- **Fields:** `company_name *`, `company_address`, `company_email *`
- **Actions:** `[Back]` (Returns to Login) | `[Next]`

#### 1.B. Login Details (Step 2)

- **Fields:** `email` (default = `company_email`), `password`
- **Action:** `[Submit]`

### 2. Email Verification via OTP

- **UI:** 6-digit OTP input
- **Backend Logic:**
  1. Call `POST /api/v2/auth/request-otp` → Receive `request_id`.
  2. Call `POST /api/v2/auth/verify-otp` with `email`, `otp`, and `request_id`.
- **On Success:** \* Receive Sanctum `auth_token` and account/company data.
  - **Action:** Store `auth_token` securely.

### 3. Device Registration

- **Library:** `src/lib/deviceInfo.js`
- **Execution:** \* `physical_device_id = getDeviceId()`
  - `device_fingerprint` = (Model + OS + Metadata)
- **API Call:** `POST /api/v2/devices/register`
- **Storage:** Securely store `device_id` and `device_token` (Android: **Keystore**, iOS: **Keychain**).

### 4. Branch Assignment Setup

#### 4.A. Check Assignment

- Call `GET /api/v2/devices/me`.
- **IF branch exists:** Save locally as `deviceDesignatedBranch` → Proceed to Home.
- **IF branch is NULL:** Proceed to Step 4.B.

#### 4.B. Branch Selection

- Call `GET /api/v2/branches`.
- **UI:** Branch list (Radio selection) + `[+ Create New Branch]` option.

#### 4.C. Branch Creation (Optional)

- Call `POST /api/v2/branches` with `name` and `address`.

#### 4.D. Assign Device

- Call `POST /api/v2/devices/assign-branch` with `device_id`, `branch_id`, and `force_reassign: false`.

### 5. Finalize & Navigate

- **Local State:** Save `deviceDesignatedBranch`, `device_id`, and `device_token`.
- **Navigation:** Route to **Home Screen (RootStack)**.

---

## SCENARIO 2: EXISTING USER (Sign In)

1.  **Authentication:** `POST /api/v2/auth/signin`. Store `auth_token`.
2.  **Device Check:** If `device_id` or `device_token` is missing locally, trigger `/devices/register`.
3.  **Branch Check:** Call `GET /api/v2/devices/me`.
    - If assigned: Save `deviceDesignatedBranch` → Home.
    - If unassigned: Fetch/Create branch → `/devices/assign-branch`.
4.  **Navigate:** Home Screen.

---

## IMPORTANT DATA MODEL RULES

### Device & Branch Schema

- **`devices` table:** Stores `id`, `company_id`, `device_name`, `physical_device_hash`. (Note: **No** `branch_id`).
- **`device_branch_assignments` table:** Handles the mapping via `device_id` and `branch_id`.

### Data Tagging Requirement

All transactional records (items, categories, inventory_logs, sale_logs) **MUST** include:

1.  `branch_id`
2.  `device_id`

---

## SECURITY & DEV NOTES

- **Security:** Never trust `physical_device_id` alone. Always validate with `device_token`. Use HTTPS and Bearer tokens.
- **Forms:** Formik + Yup.
- **Queries:** TanStack React Query (`src/serverDbQueries`).
