# 📱 RNDeviceId

A lightweight, Play Store–friendly React Native Android native module to retrieve the device's unique `ANDROID_ID`. No permissions required. No Play Store restrictions.

## 🚀 Features

- ✅ Safe to use — no permissions required
- 📦 Uses `Settings.Secure.ANDROID_ID`
- 🔐 Does **not** access restricted identifiers (IMEI, MAC, etc.)
- ⚡ Fast and minimal native code (Kotlin)
- 🧩 Works with React Native 0.79+

---

## 🛠 Installation

### 1. Clone or copy the `RNDeviceId` module into your Android project:

```
your-react-native-project/
├── android/
│   └── app/
│       └── src/
│           └── main/
│               └── java/
│                   └── com/
│                       └── yourapp/
│                           └── rndeviceid/
│                               ├── RNDeviceIdModule.kt
│                               └── RNDeviceIdPackage.kt
```

> Make sure the package name matches your project’s Java/Kotlin package (e.g., `com.yourapp.rndeviceid`).

---

### 2. Register the Module

Open `android/app/src/main/java/com/yourapp/MainApplication.java` and add:

```java
import com.yourapp.rndeviceid.RNDeviceIdPackage;

@Override
protected List<ReactPackage> getPackages() {
  return Arrays.<ReactPackage>asList(
    new MainReactPackage(),
    new RNDeviceIdPackage()
  );
}
```

---

## 📦 Usage

### JavaScript

```js
import { NativeModules } from 'react-native';

const { RNDeviceId } = NativeModules;

export async function getDeviceId() {
  try {
    const id = await RNDeviceId.getAndroidId();
    console.log('Device ID:', id);
    return id;
  } catch (error) {
    console.error('Error fetching device ID', error);
    return null;
  }
}
```

---

## 🧠 About `ANDROID_ID`

- Unique per device + signing key + user.
- Can change after:
  - Factory reset
  - App uninstall & reinstall (if signing key changes)
- No special permissions required
- Google officially recommends it over restricted IDs

**Reference**: [Android Docs — Settings.Secure.ANDROID_ID](https://developer.android.com/reference/android/provider/Settings.Secure#ANDROID_ID)

---

## ❌ Avoid These Identifiers

| Identifier     | Reason Not to Use                            |
|----------------|----------------------------------------------|
| IMEI / MEID    | Requires restricted permission (Play Store disallowed) |
| MAC Address    | Always returns dummy value `02:00:00:00:00:00` |
| Serial Number  | Inaccessible in Android 10+ |
| Advertising ID | Requires new [AD_ID permission](https://support.google.com/googleplay/android-developer/answer/6048248) |

---

## 📋 License

MIT — do whatever you want. Just don't track users unethically. 😄

---

## 👨‍💻 Author

Developed by [Your Name].  
Contributions and issues welcome!