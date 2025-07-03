## RNMediaStore

A React Native Android native module that provides MediaStore-based file access without requiring `MANAGE_EXTERNAL_STORAGE`. Supports persistent storage in public directories like Downloads, Documents, Pictures, etc.

---

### ✅ Features

- ✅ Write file to MediaStore directory (Downloads, Documents, etc.)
- ✅ Read file from MediaStore
- ✅ Delete file
- ✅ List directory contents with metadata
- ✅ Create and delete directories
- ✅ Move and copy local files to MediaStore
- ✅ Exposes directory paths like `DirectoryPath.Downloads`

---

### 📦 Installation

1. Place the native module under `android/app/src/main/java/com/rnmediastore`.
2. Register the module in `MainApplication.kt`:

```kotlin
import com.rnmediastore.RNMediaStorePackage

override fun getPackages(): List<ReactPackage> = listOf(
  ...,
  RNMediaStorePackage(),
)
```

3. Rebuild the project:

```bash
cd android && ./gradlew clean assembleDebug
```

---

### 📚 Usage (JS/TS)

```ts
import { NativeModules } from 'react-native';
const RNMediaStore = NativeModules.RNMediaStore;

await RNMediaStore.writeFile('example.txt', 'Hello, world!', 'text/plain');

const content = await RNMediaStore.readFile('example.txt');

await RNMediaStore.copyFileToMediaStore(
  '/data/user/0/com.yourapp/files/temp.txt',
  'copied.txt',
  'text/plain',
  'Download/myfolder'
);
```

---

### 🧩 TypeScript Definitions

```ts
type RNMediaStoreType = {
  writeFile: (fileName: string, content: string, mimeType: string, directory?: string) => Promise<string>;
  readFile: (fileName: string, directory?: string) => Promise<string>;
  deleteFile: (fileName: string, directory?: string) => Promise<boolean>;
  readDirectory: (directory?: string) => Promise<Array<{
    name: string;
    size: number;
    mimeType: string;
    dateAdded: number;
  }>>;
  deleteDirectory: (directory: string) => Promise<number>;
  copyFileToMediaStore: (sourcePath: string, fileName: string, mimeType: string, destinationPath: string) => Promise<string>;
  moveFileToMediaStore: (sourcePath: string, fileName: string, mimeType: string, destinationPath: string) => Promise<string>;
  DirectoryPath: {
    Downloads: string;
    Documents: string;
    Pictures: string;
    Movies: string;
    Music: string;
    DCIM: string;
    Screenshots: string;
  };
};
```

---

### 🖼 Example UI (React Native)

```tsx
import React, { useState } from 'react';
import { View, Text, Button, TextInput, ScrollView } from 'react-native';
import { NativeModules } from 'react-native';
const RNMediaStore = NativeModules.RNMediaStore;

export default function FileManager() {
  const [fileName, setFileName] = useState('example.txt');
  const [content, setContent] = useState('Hello, world!');
  const [result, setResult] = useState('');

  const write = async () => {
    try {
      const uri = await RNMediaStore.writeFile(fileName, content, 'text/plain', 'Download');
      setResult(`Written to: ${uri}`);
    } catch (e) {
      setResult(`Error: ${e.message}`);
    }
  };

  const read = async () => {
    try {
      const text = await RNMediaStore.readFile(fileName, 'Download');
      setResult(`Content: ${text}`);
    } catch (e) {
      setResult(`Error: ${e.message}`);
    }
  };

  return (
    <ScrollView contentContainerStyle={{ padding: 20 }}>
      <TextInput value={fileName} onChangeText={setFileName} placeholder="File name" style={{ borderWidth: 1, marginBottom: 10 }} />
      <TextInput value={content} onChangeText={setContent} placeholder="File content" multiline style={{ borderWidth: 1, marginBottom: 10 }} />
      <Button title="Write File" onPress={write} />
      <Button title="Read File" onPress={read} />
      <Text style={{ marginTop: 20 }}>{result}</Text>
    </ScrollView>
  );
}
```

---

### 📄 Supported MIME Types and Extensions

| File Type         | MIME Type                                                                 | File Extension  |
| ----------------- | ------------------------------------------------------------------------- | --------------- |
| Plain Text        | `text/plain`                                                              | `.txt`          |
| CSV               | `text/csv`                                                                | `.csv`          |
| JSON              | `application/json`                                                        | `.json`         |
| PDF               | `application/pdf`                                                         | `.pdf`          |
| Word Document     | `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `.docx`         |
| Excel Spreadsheet | `application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`       | `.xlsx`         |
| JPEG Image        | `image/jpeg`                                                              | `.jpg`, `.jpeg` |
| PNG Image         | `image/png`                                                               | `.png`          |
| MP4 Video         | `video/mp4`                                                               | `.mp4`          |
| MP3 Audio         | `audio/mpeg`                                                              | `.mp3`          |
| ZIP Archive       | `application/zip`                                                         | `.zip`          |

---

### 🛠 API Methods

```ts
RNMediaStore.writeFile(fileName, content, mimeType, directory?)
RNMediaStore.readFile(fileName, directory?)
RNMediaStore.deleteFile(fileName, directory?)
RNMediaStore.readDirectory(directory?)
RNMediaStore.deleteDirectory(directory)
RNMediaStore.copyFileToMediaStore(sourcePath, fileName, mimeType, destinationPath)
RNMediaStore.moveFileToMediaStore(sourcePath, fileName, mimeType, destinationPath)
```

> ✅ `directory` can include subdirectories like `Download/myfolder`

---

### 📂 Accessing Directory Paths

```ts
RNMediaStore.DirectoryPath.Downloads
RNMediaStore.DirectoryPath.Documents
RNMediaStore.DirectoryPath.Pictures
```

---

### 🧪 Compatibility

- React Native `0.79.4`
- `kotlinVersion = 2.0.21`
- `compileSdkVersion = 35`
- `targetSdkVersion = 35`
- `minSdkVersion = 24`
- `ndkVersion = 27.1.12297006`

---

Let me know if you'd like to include more examples or tests.

