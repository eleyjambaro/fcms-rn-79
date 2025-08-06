import {Platform, NativeModules} from 'react-native';

const {RNMediaStore} = NativeModules;

const logIOS = (method, ...args) => {
  console.log(`[iOS Placeholder] ${method}:`, ...args);
};

export async function readFile(fileName, directory) {
  if (Platform.OS === 'android') {
    return RNMediaStore.readFile(fileName, directory);
  } else {
    logIOS('readFile', fileName, directory);
    return null;
  }
}

export async function writeFile(
  fileName,
  content,
  mimeType = 'application/json',
  directory,
) {
  if (Platform.OS === 'android') {
    return RNMediaStore.writeFile(fileName, content, mimeType, directory);
  } else {
    logIOS('writeFile', fileName, content, mimeType, directory);
    return null;
  }
}

export async function deleteFile(fileName, directory) {
  if (Platform.OS === 'android') {
    return RNMediaStore.deleteFile(fileName, directory);
  } else {
    logIOS('deleteFile', fileName, directory);
    return false;
  }
}

export async function readDirectory(directory) {
  if (Platform.OS === 'android') {
    return RNMediaStore.readDirectory(directory);
  } else {
    logIOS('readDirectory', directory);
    return [];
  }
}

export async function deleteDirectory(directory) {
  if (Platform.OS === 'android') {
    return RNMediaStore.deleteDirectory(directory);
  } else {
    logIOS('deleteDirectory', directory);
    return 0;
  }
}

export async function copyFileToMediaStore(
  sourcePath,
  fileName,
  mimeType,
  destinationPath,
) {
  if (Platform.OS === 'android') {
    return RNMediaStore.copyFileToMediaStore(
      sourcePath,
      fileName,
      mimeType,
      destinationPath,
    );
  } else {
    logIOS(
      'copyFileToMediaStore',
      sourcePath,
      fileName,
      mimeType,
      destinationPath,
    );
    return null;
  }
}

export async function copyFileFromMediaStore(documentUri, destinationFullPath) {
  if (Platform.OS === 'android') {
    return RNMediaStore.copyFileFromMediaStore(
      documentUri,
      destinationFullPath,
    );
  } else {
    logIOS('copyFileFromMediaStore', documentUri, destinationFullPath);
    return null;
  }
}
