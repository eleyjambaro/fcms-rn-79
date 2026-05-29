# Android Release Signing

This guide walks through generating an upload keystore for a Google Play release build, then wiring it into Gradle through an **untracked** local properties file so no credentials end up in the repo.

You only need to do steps 1 and 2 once per machine. Step 3 is the per-build check.

---

## TL;DR

1. Run `keytool` to create `my-upload-key.keystore`.
2. Put the keystore path + passwords in `~/.gradle/gradle.properties` (your home directory's Gradle config — not the project's `android/gradle.properties`).
3. `npm run bundle:android:release` produces a signed `.aab`.

---

## Step 1 — Generate the upload keystore

The keystore is a single binary file that holds your signing key. Google Play matches every upload against the fingerprint of this key, so **keep it safe and back it up**. If you lose it, you cannot publish updates to the same app listing.

Run this from anywhere (the working directory does not matter — the tool just writes the file to wherever you `cd`'d to):

```sh
keytool -genkeypair -v \
  -storetype PKCS12 \
  -keystore my-upload-key.keystore \
  -alias my-key-alias \
  -keyalg RSA -keysize 2048 \
  -validity 10000
```

`keytool` ships with the JDK. If you get `command not found`, make sure your JDK's `bin/` is on `PATH` (`java -version` should also work).

It will prompt you for:

| Prompt                                | What to enter                                                                          |
| ------------------------------------- | -------------------------------------------------------------------------------------- |
| Keystore password                     | A strong password. Write it down. You will need it again.                              |
| First and last name, org unit, etc.   | Identifying info — anything reasonable. This is embedded in the certificate.           |
| Is the above correct?                 | `yes`                                                                                  |
| Key password for `<my-key-alias>`     | Press RETURN to reuse the keystore password (recommended — keeps things simple).       |

When it finishes you will have a file named `my-upload-key.keystore` in the current directory.

### Where to put the file

Pick a long-term location **outside the repo**. Two common choices:

- `~/keystores/fcms/my-upload-key.keystore` — a dedicated keystores folder in your home directory. Recommended.
- `~/.gradle/keystores/my-upload-key.keystore` — alongside your Gradle config.

Move it there:

```sh
mkdir -p ~/keystores/fcms
mv my-upload-key.keystore ~/keystores/fcms/
```

Then back it up (1Password, an encrypted USB, etc.). Losing this file is unrecoverable.

---

## Step 2 — Wire it into Gradle via `~/.gradle/gradle.properties`

### What `~/.gradle/gradle.properties` is

There are two different Gradle properties files in play. They look similar but live in different places and do different jobs:

| File                                | Location                                          | Tracked in git? | What it holds                                |
| ----------------------------------- | ------------------------------------------------- | --------------- | -------------------------------------------- |
| **Project** `android/gradle.properties` | `<this-repo>/android/gradle.properties`           | Yes             | Non-secret build flags (Hermes, JVM args, …) |
| **User**    `~/.gradle/gradle.properties` | Your home directory: `/Users/<you>/.gradle/gradle.properties` | **No, per-user**            | Your signing credentials                     |

`~` is shell shorthand for your home directory. On macOS that is `/Users/<your-username>/`. So `~/.gradle/gradle.properties` is literally:

```
/Users/<your-username>/.gradle/gradle.properties
```

Gradle automatically merges both files at build time, with the home-directory one winning. That is the whole reason it works — secrets stay on your machine, never in the repo.

### Create the file

The `.gradle` directory in your home probably already exists (Gradle creates it on first run). Create the file if it does not exist yet:

```sh
mkdir -p ~/.gradle
touch ~/.gradle/gradle.properties
```

Open it in your editor:

```sh
open -e ~/.gradle/gradle.properties   # macOS TextEdit
# or
code ~/.gradle/gradle.properties      # VS Code
```

Add (or append) these four lines, using the path and passwords from step 1:

```properties
MYAPP_UPLOAD_STORE_FILE=/Users/<your-username>/keystores/fcms/my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=<the keystore password you set>
MYAPP_UPLOAD_KEY_PASSWORD=<same as above if you pressed RETURN in step 1>
```

Notes:

- Use the **absolute path** for `MYAPP_UPLOAD_STORE_FILE`. Relative paths resolve from `android/app/`, not from where you run Gradle.
- No quotes around the password, even if it contains spaces or symbols.
- If a password contains a backslash `\`, escape it as `\\`.
- Save the file.

### Verify Gradle can see it

From the repo root:

```sh
cd android && ./gradlew properties -q | grep MYAPP_UPLOAD
```

You should see all four `MYAPP_UPLOAD_*` lines echoed. If you see nothing, the file is missing, in the wrong location, or has a typo.

---

## Step 3 — Build a signed release bundle

From the repo root:

```sh
npm run bundle:android:release
```

This script (defined in `package.json`) runs `cd android && ./gradlew bundleRelease` with `ENVFILE=.env.production`. The signed AAB lands at:

```
android/app/build/outputs/bundle/release/app-release.aab
```

Upload that file to Google Play.

### Sanity checks

If the build succeeds but the AAB is unsigned, the `if (project.hasProperty('MYAPP_UPLOAD_STORE_FILE'))` guard in `android/app/build.gradle` did not see your properties — go back and re-check step 2.

To confirm the AAB is signed:

```sh
jarsigner -verify -verbose android/app/build/outputs/bundle/release/app-release.aab | tail -5
```

You should see `jar verified`.

---

## What is committed vs. not

| File                                     | In repo? | Notes                                                                |
| ---------------------------------------- | -------- | -------------------------------------------------------------------- |
| `android/gradle.properties`              | Yes      | Non-secret build flags. Has comments about the four `MYAPP_UPLOAD_*` props but no values. |
| `android/app/debug.keystore`             | Yes      | Standard React Native debug keystore. Identical across every RN project; not sensitive. |
| `~/.gradle/gradle.properties`            | No       | Your signing credentials. Per-developer.                             |
| `my-upload-key.keystore` (your copy)     | No       | Lives outside the repo. `.gitignore`'s `*.keystore` (with `!debug.keystore`) backs this up. |

If you ever see `my-upload-key.keystore` appear under `git status` inside the repo, do not commit it — move it out and update the path in `~/.gradle/gradle.properties`.
