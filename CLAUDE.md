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

### Dual Authentication System

The app supports two auth modes that gate which navigation stack is rendered in `App.js`:

- **Cloud Auth** (`CloudAuthStackV2`): Email/OTP sign-in → device registration → branch selection. Tokens stored in `react-native-fast-secure-storage` under keys defined in `/src/constants/rnSecureStorageKeys.js`. State managed by `CloudAuthContextProvider`.
- **Local Auth** (`AuthStack`): On-device account with bcrypt password hashing and locally-generated JWT (16-hour expiry). State managed by `AuthContextProvider`.

### Dual Database System

- **Company DB**: SQLite database holding items, recipes, purchases, expenses, revenues, etc. Queried via `/src/localDbQueries/`.
- **Account DB**: Separate SQLite database for local accounts, roles, and companies.
- Both initialized via `useInitDBTables` hook. Direct SQL queries use a promise-based wrapper in `/src/localDb/`.
- Query builders in `/src/utils/localDbHelpers.js` support `%IN`, `%LIKE` filter operators and `createQueryFilter()`.

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

- `CloudAuthContextProvider` / `AuthContextProvider` — auth state
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
