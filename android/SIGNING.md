# Android Release Signing

The release `signingConfig` in `android/app/build.gradle` reads four properties:

```
MYAPP_UPLOAD_STORE_FILE
MYAPP_UPLOAD_KEY_ALIAS
MYAPP_UPLOAD_STORE_PASSWORD
MYAPP_UPLOAD_KEY_PASSWORD
```

These must not be committed. Set them per developer in `~/.gradle/gradle.properties`:

```properties
MYAPP_UPLOAD_STORE_FILE=/absolute/path/to/my-upload-key.keystore
MYAPP_UPLOAD_KEY_ALIAS=my-key-alias
MYAPP_UPLOAD_STORE_PASSWORD=<your password>
MYAPP_UPLOAD_KEY_PASSWORD=<your password>
```

Notes:

- `MYAPP_UPLOAD_STORE_FILE` can be an absolute path or a path relative to `android/app/` — Gradle's `file(...)` resolves relative paths from the module directory.
- If the four properties are not set, the release build will produce an unsigned AAB/APK. The Gradle `if (project.hasProperty(...))` guard in `android/app/build.gradle` is intentional.
- The upload keystore itself is also untracked (covered by `*.keystore` in `.gitignore`, with `!debug.keystore` exception for the shared RN debug keystore).
- To produce a release bundle: `npm run bundle:android:release`.
