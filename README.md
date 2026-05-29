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

### Excluded from sync

| Category             | Tables                                       |
| -------------------- | -------------------------------------------- |
| Local Account DB     | `roles`, `accounts`, `companies`, `settings` |
| App-managed / seeded | `app_versions`, `operations`, `taxes`        |
| Device-local         | `saved_printers`, `sync_metadata`            |

# Troubleshooting

If you're having issues getting the above steps to work, see the [Troubleshooting](https://reactnative.dev/docs/troubleshooting) page.

# Learn More

To learn more about React Native, take a look at the following resources:

- [React Native Website](https://reactnative.dev) - learn more about React Native.
- [Getting Started](https://reactnative.dev/docs/environment-setup) - an **overview** of React Native and how setup your environment.
- [Learn the Basics](https://reactnative.dev/docs/getting-started) - a **guided tour** of the React Native **basics**.
- [Blog](https://reactnative.dev/blog) - read the latest official React Native **Blog** posts.
- [`@facebook/react-native`](https://github.com/facebook/react-native) - the Open Source; GitHub **repository** for React Native.
