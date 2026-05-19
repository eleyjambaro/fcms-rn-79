# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

FCMS (Food Cost Management System) is a React Native POS/inventory management app for food service businesses. It supports offline-first operation via local SQLite, cloud sync, multi-company/multi-branch setups, and thermal receipt printing.

## Commands

```bash
# Development
npm start                  # Start Metro bundler
npm run android            # Build and run on Android
npm run ios                # Build and run on iOS
npm run android:clean      # Clean Android build artifacts

# iOS setup (after npm install)
bundle install && bundle exec pod install

# Validation
npm run lint               # ESLint
npm test                   # Jest (run all tests)

# Environment
npm run sync-ip            # Sync local IP to .env (for cloud API dev)

# Dependency management
npm run check-dependencies # Check dependency alignment
npm run fix-dependencies   # Auto-fix dependency alignment
```

## Environment

Copy `.env.example` to `.env` and set `CLOUD_API_V2_BASE_URL` to your local server IP. Use `npm run sync-ip` to auto-populate it.

## Architecture

### Authentication System

**Cloud Auth is the primary and only supported auth mode.** Local Auth (`AuthStack`) is legacy and deprecated — do not build new features against it.

- **Cloud Auth** (`CloudAuthStackV2`): Email/password or OTP sign-in → device registration → branch selection. Tokens stored in `react-native-fast-secure-storage` under keys in `/src/constants/rnSecureStorageKeys.js`. State managed by `CloudAuthContextProvider`.
  - Sub-accounts (team members) sign in via `CloudV2SubAccountSignIn` and require a `device_id` tied to their account via `DeviceAccountAssignment` on the server.
  - `App.js` gates on `isCloudAuthenticated && hasDevice && hasBranch` — all three must be true to show `RootStack`.
- **Local Auth** (`AuthStack`): **Deprecated.** Do not add new features here.

### Multi-Company Data Isolation

**Each company gets its own SQLite database file.** This is enforced at the `getDBConnection()` level in `/src/localDb/index.js` — no query-level filtering is needed or used.

- Company DB filename: `FCMS_<companyId>` (e.g. `FCMS_abc-123...`). The fallback `FCMS.db` is only used in the unauthenticated state where no company data is accessed.
- `setActiveCompanyDb(companyId)` in `/src/localDb/index.js` sets the active company, creates tables (`createTables()`), runs migrations (`alterTables()`), and creates SQL views (`createViews()`). It is **async** and must be `await`ed.
- `getActiveCompanyId()` returns the currently active company ID — used by company-scoped AsyncStorage keys (e.g. units).
- `CloudAuthContextProvider` calls `setActiveCompanyDb` at every auth transition (restore, sign-in, sign-up, OTP verify) **before** dispatching state, so `isLoading` stays `true` until the DB is ready. It also seeds company defaults (`setDefaultUnits`, `createDefaultSettings`) at the same point.
- On sign-out or user switch, `queryClient.clear()` is called to purge React Query's cache so no prior company's data is visible to the next user.

### Dual Database System

- **Company DB** (`FCMS_<companyId>`): Items, recipes, purchases, expenses, revenues, settings, units, etc. Queried via `/src/localDbQueries/`. **Company-scoped — one file per company.**
- **Account DB** (`FCMSLocalAccount.db`): Legacy local auth data (accounts, roles, companies). Used only by the deprecated local auth system. Do not add new tables here.
- Direct SQL queries use a promise-based wrapper in `/src/localDb/`.
- Query builders in `/src/utils/localDbHelpers.js` support `%IN`, `%LIKE` filter operators and `createQueryFilter()`.

#### Company-scoped AsyncStorage

Units are stored in AsyncStorage under a company-scoped key (`units_<companyId>`), managed by `/src/localData/units.js`. `getActiveCompanyId()` is used to derive the key. Never use a bare hardcoded key for per-company data.

### Delta Sync (Cloud Sync)

All Company DB tables participate in delta sync **except**: `app_versions`, `operations`, `taxes`, `saved_printers`, `settings`, and `sync_metadata`. Account DB tables are never synced.

Delta sync tables receive four extra columns added via `alterTables()` in `/src/localDb/index.js`:

- `sync_id` — UUID assigned on insert, used as the cloud record key
- `updated_at` — set to `CURRENT_TIMESTAMP` on every insert/update/soft-delete
- `synced_at` — stamped by the sync service after a successful push
- `is_deleted` — soft-delete flag (`1` = deleted); **never use `DELETE FROM` on these tables**

**Soft-delete rule**: all deletions on delta sync tables must use `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP` instead of `DELETE FROM`. Hard deletes are only allowed on excluded tables (`app_versions`, `operations`, `taxes`, `saved_printers`, `settings`, `monthly_expenses`, and Account DB tables).

**Active views**: `createViews()` in `/src/localDb/index.js` creates an `active_<table>` SQLite view for every delta sync table (e.g. `active_items`, `active_inventory_logs`). Each view is defined as `SELECT * FROM <table> WHERE is_deleted != 1`. **All SELECT queries in `/src/localDbQueries/` must use these views instead of the base tables** so soft-deleted records are automatically excluded. Use an alias matching the original table name to keep column references working:

```sql
FROM active_items items
JOIN active_inventory_logs inventory_logs ON inventory_logs.item_id = items.id
```

INSERT / UPDATE / DELETE continue to target the base tables directly. To change what "active" means globally, update only `createViews()`.

Delta sync tables (defined in `DELTA_SYNC_TABLES` constant in `/src/localDb/index.js`):

| Table                       | File                                |
| --------------------------- | ----------------------------------- |
| `categories`                | `localDbQueries/categories.js`      |
| `items`                     | `localDbQueries/items.js`           |
| `modifiers`                 | `localDbQueries/modifiers.js`       |
| `modifier_options`          | `localDbQueries/modifiers.js`       |
| `vendors`                   | `localDbQueries/vendors.js`         |
| `vendor_contact_persons`    | `localDbQueries/vendors.js`         |
| `recipe_kinds`              | `localDbQueries/recipeKinds.js`     |
| `recipes`                   | `localDbQueries/recipes.js`         |
| `ingredients`               | `localDbQueries/recipes.js`         |
| `selling_menus`             | `localDbQueries/sellingMenus.js`    |
| `selling_menu_items`        | `localDbQueries/sellingMenus.js`    |
| `inventory_logs`            | `localDbQueries/items.js`           |
| `batch_purchase_groups`     | `localDbQueries/batchPurchase.js`   |
| `batch_purchase_entries`    | `localDbQueries/batchPurchase.js`   |
| `batch_stock_usage_groups`  | `localDbQueries/batchStockUsage.js` |
| `batch_stock_usage_entries` | `localDbQueries/batchStockUsage.js` |
| `invoices`                  | `localDbQueries/salesCounter.js`    |
| `sale_logs`                 | `localDbQueries/salesCounter.js`    |
| `sales_order_groups`        | `localDbQueries/salesCounter.js`    |
| `sales_orders`              | `localDbQueries/salesCounter.js`    |
| `payments`                  | `localDbQueries/salesCounter.js`    |
| `refunds`                   | `localDbQueries/salesCounter.js`    |
| `spoilages`                 | `localDbQueries/spoilages.js`       |
| `revenue_groups`            | `localDbQueries/revenues.js`        |
| `revenues`                  | `localDbQueries/revenues.js`        |
| `expense_groups`            | `localDbQueries/expenses.js`        |
| `expenses`                  | `localDbQueries/expenses.js`        |
| `revenue_deductions`        | `localDbQueries/expenses.js`        |
| `revenue_categories`        | `localDbQueries/revenues.js`        |

### Navigation Structure

Five navigation stacks in `/src/stacks/`:

- `RootStack` — main app (items, recipes, purchases, revenues, expenses, reports, account)
- `AuthStack` — local authentication
- `CloudAuthStackV2` — cloud auth and onboarding
- `AccountSetupStack` — new account creation
- `ReinstallDetectedStack` — data recovery flow

Navigation outside components uses `RootNavigation.js` ref.

### State Management

Context API with 13+ providers in `/src/context/providers/`. Key providers:

- `CloudAuthContextProvider` — cloud auth state **and** company DB lifecycle (activates company DB, seeds defaults, clears React Query cache on sign-out). `AuthContextProvider` is deprecated.
- `AppConfigContextProvider` — global app config
- `ItemFormContextProvider`, `RecipeFormContextProvider`, `ExpenseFormContextProvider`, `SellingMenuFormContextProvider` — form state
- `SearchbarContextProvider`, `SalesCounterContextProvider` — feature-specific state

Access via corresponding `use*Context` hooks in `/src/hooks/`.

### Data Fetching

- **React Query v4** (`@tanstack/react-query`) for all cloud API calls. Config: 5-min `staleTime`, 10-min `cacheTime`, `refetchOnWindowFocus` and `refetchOnReconnect` disabled.
- **Axios** instance in `/src/api/cloudApiV2.js` with 30s timeout and Bearer token injection.
- Server query functions in `/src/serverDbQueries/v2/`.
- After mutations, invalidate relevant queries via `queryClient.invalidateQueries(['key'])`.

### Form Pattern

Formik + Yup throughout. Form state often stored in Context Providers for cross-component access. Most forms are in `/src/modals/`.

### Modal vs Screen Conventions

- **Do NOT add new screens to `/src/modals/`**. That directory contains legacy full-screen modals that will be migrated to `/src/screens/` in the future.
- New reusable modals/dialogs go in `/src/components/modals/`.
- New full-screen views go in `/src/screens/`.

### Key Directories

| Path                       | Purpose                                                                                    |
| -------------------------- | ------------------------------------------------------------------------------------------ |
| `/src/screens/`            | Full-screen views (~82 screens)                                                            |
| `/src/components/`         | Reusable UI components                                                                     |
| `/src/components/modals/`  | Reusable modal/dialog components (use this for new modals)                                 |
| `/src/modals/`             | Legacy full-screen modals (do not add new files here; will be migrated to `/src/screens/`) |
| `/src/hooks/`              | Custom hooks (~29)                                                                         |
| `/src/stacks/`             | React Navigation stack definitions                                                         |
| `/src/tabs/`               | Bottom-tab screen components                                                               |
| `/src/context/providers/`  | Context providers                                                                          |
| `/src/localDbQueries/`     | SQLite query functions                                                                     |
| `/src/serverDbQueries/v2/` | Cloud API query functions                                                                  |
| `/src/constants/`          | App-wide constants, route names, storage keys                                              |
| `/src/services/`           | App segment init, permissions, version check                                               |

## Tech Stack Highlights

- **React Native 0.79** / **React 19** — mostly JavaScript (not TypeScript despite tsconfig)
- **React Navigation** — stack, bottom-tabs, drawer, material-top-tabs
- **react-native-paper** — Material Design UI components
- **SQLite** via `react-native-sqlite-storage`
- **Secure storage** via `react-native-fast-secure-storage`
- **Thermal printing** via `@tumihub/react-native-thermal-receipt-printer`
- **Device binding** — app registers to a specific device; device tokens stored in secure storage
