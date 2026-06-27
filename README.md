This is a new [**React Native**](https://reactnative.dev) project, bootstrapped using [`@react-native-community/cli`](https://github.com/react-native-community/cli).

# Getting Started

> **Note**: Make sure you have completed the [Set Up Your Environment](https://reactnative.dev/docs/set-up-your-environment) guide before proceeding.

## Step 1: Start Metro

First, you will need to run **Metro**, the JavaScript build tool for React Native.

To start the Metro dev server, run the following command from the root of your React Native project:

```sh
# Using npm
npm start

# OR using Yarn
yarn start
```

## Step 2: Build and run your app

With Metro running, open a new terminal window/pane from the root of your React Native project, and use one of the following commands to build and run your Android or iOS app:

### Android

```sh
# Using npm
npm run android

# OR using Yarn
yarn android
```

### Android over Wi-Fi (flaky USB / `InstallException: EOF`)

Some physical devices — notably the **ELI_NX9 POS tablet** — drop the USB
connection mid-install. The build succeeds, but `react-native run-android` fails
while pushing the APK with:

```
com.android.ddmlib.InstallException: EOF
  ... Caused by: java.io.EOFException: EOF
```

This is **not** a code or build problem — the APK is valid, the cable just can't
hold the transfer. Installing over Wi-Fi bypasses the cable entirely:

```sh
npm run android:wifi
```

The script (`scripts/android-wifi.sh`) auto-discovers the device, builds the
debug APK, installs it over Wi-Fi, wires up the Metro reverse tunnel, and
launches the app. Start Metro first (`npm start`) so the device can pull the JS
bundle.

#### One-time setup

You do **not** need the "Wireless debugging" toggle in Developer Options (that's
a separate Android 11+ pairing flow). This uses the classic `adb tcpip` method,
which only needs:

1. **USB debugging** enabled (Developer Options).
2. The device **plugged in via USB once** so adb can switch it into TCP mode.

After that first run the cable is optional.

#### How it works

On each run the script:

1. Reuses an existing wireless connection (`<ip>:5555`) if one is present.
2. Otherwise finds the USB device, reads its Wi-Fi IP, runs `adb tcpip 5555`,
   and `adb connect`s to it.
3. Builds with `./gradlew app:assembleDebug` (honoring `ENVFILE`, default
   `.env.development`).
4. Sets up `adb reverse tcp:8081` for Metro, installs, and launches
   `MainActivity`.

#### Reconnecting after a reboot

A device **reboot or Wi-Fi change resets it back to USB-only**. Plug in via USB
once and re-run `npm run android:wifi` — it re-enables TCP mode automatically.

If the device is still listening on TCP (hasn't rebooted) but you want to skip
discovery, pass the IP explicitly:

```sh
DEVICE_IP=192.168.254.102 npm run android:wifi
```

> The real fix is the USB link itself — try a known-good cable/port and check the
> device isn't toggling USB mode (charging vs. file transfer / power saving). The
> Wi-Fi path is the reliable workaround in the meantime.

### iOS

For iOS, remember to install CocoaPods dependencies (this only needs to be run on first clone or after updating native deps).

The first time you create a new project, run the Ruby bundler to install CocoaPods itself:

```sh
bundle install
```

Then, and every time you update your native dependencies, run:

```sh
bundle exec pod install
```

For more information, please visit [CocoaPods Getting Started guide](https://guides.cocoapods.org/using/getting-started.html).

```sh
# Using npm
npm run ios

# OR using Yarn
yarn ios
```

If everything is set up correctly, you should see your new app running in the Android Emulator, iOS Simulator, or your connected device.

This is one way to run your app — you can also build it directly from Android Studio or Xcode.

## Step 3: Modify your app

Now that you have successfully run the app, let's make changes!

Open `App.tsx` in your text editor of choice and make some changes. When you save, your app will automatically update and reflect these changes — this is powered by [Fast Refresh](https://reactnative.dev/docs/fast-refresh).

When you want to forcefully reload, for example to reset the state of your app, you can perform a full reload:

- **Android**: Press the <kbd>R</kbd> key twice or select **"Reload"** from the **Dev Menu**, accessed via <kbd>Ctrl</kbd> + <kbd>M</kbd> (Windows/Linux) or <kbd>Cmd ⌘</kbd> + <kbd>M</kbd> (macOS).
- **iOS**: Press <kbd>R</kbd> in iOS Simulator.

## Congratulations! :tada:

You've successfully run and modified your React Native App. :partying_face:

### Now what?

- If you want to add this new React Native code to an existing application, check out the [Integration guide](https://reactnative.dev/docs/integration-with-existing-apps).
- If you're curious to learn more about React Native, check out the [docs](https://reactnative.dev/docs/getting-started).

# Environment Configuration

The app reads its environment variables natively via [`react-native-config`](https://github.com/luggit/react-native-config). There is **no `.env` file in the repo** — only the templates `.env.development.example` and `.env.production.example`. You create the real files locally from those templates.

## First-time setup

1. **Copy the development template** and edit the values:

   ```sh
   cp .env.development.example .env.development
   ```

2. **Open `.env.development`** and set `CLOUD_API_V2_BASE_URL` to your local backend's URL. If your backend runs on this machine, you can shortcut this:

   ```sh
   npm run sync-ip
   ```

   That rewrites `CLOUD_API_V2_BASE_URL` in `.env.development` to `http://<your-en0-ip>:8080`. Re-run it any time your LAN IP changes.

3. **For production builds**, do the same with the production template (typically only the CI/release engineer needs this):

   ```sh
   cp .env.production.example .env.production
   ```

   Set `CLOUD_API_V2_BASE_URL` to the real production API URL.

## Environment variable schema

| Variable                  | Required | Purpose                                                              |
| ------------------------- | -------- | -------------------------------------------------------------------- |
| `APP_ENV`                 | Yes      | `dev` or `prod`. Drives feature gates in `src/constants/appConfig.js`. |
| `CLOUD_API_V2_BASE_URL`   | Yes      | Base URL for the v2 Cloud API (`src/api/cloudApiV2.js`).             |
| `LEGACY_CLOUD_API_URL`    | No       | Legacy v1 API URL. Defaults to `https://fcms.uxi.rocks`.             |
| `VERSION_CHECK_URL`       | No       | URL the version-check service polls. Has a sensible default.         |
| `IOS_STORE_URL`           | No       | iOS App Store URL surfaced in the "update available" modal.          |
| `ANDROID_STORE_URL`       | No       | Play Store URL surfaced in the "update available" modal.             |

`APP_ENV` and `CLOUD_API_V2_BASE_URL` are validated at app startup in `src/config/env.js`. If either is missing, the JS bundle throws on load and you get a red-screen telling you which variable is missing — so a misconfigured build cannot accidentally hit the wrong API.

## Running each environment

| Command                            | Loads               | Build mode |
| ---------------------------------- | ------------------- | ---------- |
| `npm run android`                  | `.env.development`  | debug      |
| `npm run android:prod`             | `.env.production`   | release    |
| `npm run ios`                      | `.env.development`  | debug      |
| `npm run ios:prod`                 | `.env.production`   | release    |
| `npm run bundle:android:release`   | `.env.production`   | release AAB |

The scripts pass `ENVFILE=<file>` to React Native, which `react-native-config` reads at build time.

## Network security (Android)

- **Debug builds** allow cleartext HTTP (so `npm run android` can reach `http://192.168.x.x:8080`). This is configured in `android/app/src/debug/res/xml/network_security_config.xml` and only applies to debug.
- **Release builds** deny cleartext entirely. Configured in `android/app/src/main/res/xml/network_security_config.xml`. Your production API must therefore be HTTPS.

# Release Builds & Signing

To produce a signed Google Play release bundle you need an upload keystore. Generate it once per machine, point Gradle at it via `~/.gradle/gradle.properties`, then `npm run bundle:android:release`.

The full step-by-step (including the exact `keytool` command, where to store the keystore, and what to put in `~/.gradle/gradle.properties`) lives in **[`android/SIGNING.md`](android/SIGNING.md)**.

Quick reminders:

- The project's `android/gradle.properties` is tracked and must not contain credentials.
- `~/.gradle/gradle.properties` (in your **home directory**, not the project) holds the credentials and is per-developer.
- Lose the keystore = cannot publish updates. Back it up.

# Database & Sync

## Dual Database

- **Company DB** — holds all business data (items, recipes, purchases, expenses, revenues, etc.). Queried via `src/localDbQueries/`.
- **Account DB** — separate SQLite DB for local accounts, roles, and companies. Never synced to the cloud.

## Delta Sync (Cloud Sync)

All Company DB tables participate in delta sync and receive the following columns via `alterTables()` in `src/localDb/index.js`:

| Column       | Purpose                                               |
| ------------ | ----------------------------------------------------- |
| `sync_id`    | UUID assigned on insert; used as the cloud record key |
| `updated_at` | Timestamp set on every insert / update / soft-delete  |
| `synced_at`  | Stamped by the sync service after a successful push   |
| `is_deleted` | Soft-delete flag — `1` means deleted                  |

**Soft-delete rule**: deletions on sync tables use `UPDATE … SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP` — never `DELETE FROM`.

### `settings` and `saved_printers` now sync (survive uninstall/reinstall)

Both used to be device-local. They are now delta-sync tables, so a user's config
and saved/default printers come back after an uninstall/reinstall (the server
re-binds the same `device_id` by physical-device hash, so the normal branch pull
restores the device's own rows). Two non-obvious rules:

- **`settings` is branch-shared.** `settings.id` is `TEXT` (= `sync_id`) and the
  `sync_id` is **deterministic per `(branch, name)`** via `getSettingSyncId()`
  (`src/localDb/index.js`), so every device in a branch converges on one row per
  setting name. Seeded defaults are stamped at the epoch sentinel
  `SETTINGS_SEED_SENTINEL` (`updated_at == synced_at`) so a fresh default neither
  pushes (clobbering a real server value) nor wins a pull against one; the first
  `updateSettings()` bumps `updated_at` so the change then pushes. Existing
  INTEGER-id installs are rebuilt by `migrateSettingsToTextId()`.
- **`saved_printers` is branch-stored but DEVICE-PRIVATE.** Every read in
  `src/localDbQueries/printers.js` filters `WHERE device_id = <this device>` so a
  tablet never sees or auto-connects to another device's printer. The default
  printer is the per-device `saved_printers.is_default` flag (not the legacy
  company-wide `default_printer_id` setting).

### Excluded from sync

| Category             | Tables                                  |
| -------------------- | --------------------------------------- |
| Local Account DB     | `roles`, `accounts`, `companies`        |
| App-managed / local  | `app_versions`, `operations`, `sync_metadata` |

# Inventory Data Template (IDT)

The IDT is the Excel file (`.xlsx`) that lets users bulk-import inventory items. The flow is:

1. **Download empty template** — Account screen → "Download Empty Inventory Data Template". Generates an XLSX with a fixed header row and 5 placeholder rows the user fills in.
2. **Import populated template** — Account screen → "Import Inventory Data Template". The user picks the file and the importer parses it into rows that flow through `insertTemplateDataToDb`.

## Source of truth: `src/constants/inventoryDataTemplate.js`

Both the export and the import read from one constants file:

```js
import {IDT_COLUMNS, normalizeHeader} from '../constants/inventoryDataTemplate';
```

`IDT_COLUMNS` is an array describing every column in order. Each entry:

| Key                  | Required | Purpose                                                                                                  |
| -------------------- | -------- | -------------------------------------------------------------------------------------------------------- |
| `field`              | yes      | Internal name used by `insertTemplateDataToDb` (e.g. `item_name`, `barcode`). Do not rename casually.    |
| `header`             | yes      | Exact human-facing string written to the empty template's header row (e.g. `'Item Name *'`).             |
| `required`           | yes      | If `true`, the importer aborts when this column is absent from the imported sheet.                       |
| `width`              | yes      | Column width (`wch`) applied by the export.                                                              |
| `acceptedNormalized` | no       | Extra normalized header forms accepted by the importer (see below). Default: just the normalized `header`.|

The order of entries determines the column order in the downloaded empty template.

## How the importer finds columns: normalized header matching

The importer does **not** read columns by position. It reads the actual header row of the user's file and matches each cell to a column in `IDT_COLUMNS` by **normalized form**:

```js
normalizeHeader('Qty Per Piece / Item Net Wt.')
// -> 'qtyperpieceitemnetwt'
```

The rule: lowercase, then strip every character that isn't `a-z` or `0-9`. So spaces, slashes, parentheses, asterisks, dots, hyphens, and case are all ignored — the user can lose the `*`, drop the parenthetical hint, change case, or add/remove whitespace and the column still matches.

For each `IDT_COLUMNS` entry, the importer accepts:

- `normalizeHeader(column.header)` (the canonical form — always accepted, no need to list it).
- Anything in `column.acceptedNormalized` (additional normalized forms).

This means the canonical header is matched automatically. You only add `acceptedNormalized` entries when you want to accept **shorter or alternative** wordings.

### Worked example

```js
{
  field: 'qty_per_piece',
  header: 'Qty Per Piece / Item Net Wt.',
  required: false,
  width: 30,
  acceptedNormalized: ['qtyperpiece', 'itemnetwt'],
},
```

| Header cell in the imported sheet     | Normalizes to            | Matches? |
| ------------------------------------- | ------------------------ | -------- |
| `Qty Per Piece / Item Net Wt.`        | `qtyperpieceitemnetwt`   | yes (canonical) |
| `qty per piece / item net wt`         | `qtyperpieceitemnetwt`   | yes (canonical, case-insensitive) |
| `Qty Per Piece`                       | `qtyperpiece`            | yes (alias) |
| `Item Net Wt.`                        | `itemnetwt`              | yes (alias) |
| `Quantity Per Piece`                  | `quantityperpiece`       | no — add `'quantityperpiece'` to `acceptedNormalized` if you want it |

## Behavior when columns are missing or unknown

- **Required column missing** (`required: true` field not found in the header row) — the importer aborts with an error message naming each missing header, e.g. `Cannot import. The following required column was not found in the selected sheet: Item Name *. Please download the latest empty Inventory Data Template…`. No items are imported.
- **Optional column missing** — silently skipped. Every row's value for that field is treated as empty string `''`.
- **Unknown column in the imported sheet** (a header the user added that isn't in `IDT_COLUMNS`) — ignored. No error.
- **Duplicate header cells** — the first matching column index wins.

## How to add a new column

1. Decide the `field` name (must match what `insertTemplateDataToDb` expects), the user-facing `header`, whether it's required, and the column width.
2. Insert a new entry into `IDT_COLUMNS` at the position where it should appear in the downloaded empty template.
3. That's it. The export will include the new column in the empty template; the importer will pick it up by header on any future imports.

**Older templates** downloaded before the new column was added will still import correctly — the missing column is treated as empty for every row (assuming it's optional). If you make the new column required, users on older templates must re-download.

## How to rename a header without breaking older templates

When you change a `header` string, every template a user downloaded **before** the rename still has the old header text. To keep those imports working:

1. Add the **old** header's normalized form to that column's `acceptedNormalized`. Run `normalizeHeader('old header text')` mentally — lowercase, drop non-alphanumerics — and add the result.
2. Update `header` to the new string.

Example — renaming `'Stock OR Number'` → `'Receipt Number'`:

```js
{
  field: 'official_receipt_number',
  header: 'Receipt Number',
  required: false,
  width: 20,
  acceptedNormalized: ['stockornumber'], // accept old template's "Stock OR Number"
},
```

## How to reorder columns

Reordering is just rearranging entries in `IDT_COLUMNS`. The export writes the new order; the import does not care about order because it matches by header name. Reordering does **not** break older downloaded templates — they still import correctly under their original order.

## Why this design

The importer used to read columns **by position** with a hardcoded 18-entry list. That meant every reorder, accidental swap, or mid-table insertion silently mis-mapped data into the wrong fields with no error. The current design eliminates that whole class of bug: column order in the spreadsheet is purely cosmetic, and the export and import can never drift because they read from the same `IDT_COLUMNS` constant.

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
