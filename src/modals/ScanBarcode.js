import React, {useEffect, useRef, useState, useCallback} from 'react';
import {
  View,
  Text,
  StyleSheet,
  Platform,
  PermissionsAndroid,
  Linking,
} from 'react-native';
import {Camera} from 'react-native-camera-kit';
import {Button} from 'react-native-paper';

import useSearchbarContext from '../hooks/useSearchbarContext';

const PERMISSION = {
  CHECKING: 'checking',
  GRANTED: 'granted',
  DENIED: 'denied',
};

const ScanBarcode = props => {
  const {navigation, route} = props;
  const {setKeyword} = useSearchbarContext();
  const [permission, setPermission] = useState(PERMISSION.CHECKING);
  // Guard so a rapid stream of native scan events only triggers a single
  // callback + navigation. Without it the camera can fire onReadCode several
  // times before the screen unmounts.
  const hasHandledRef = useRef(false);

  // Optional callback supplied (via navigation params) by the screen that
  // opened the scanner. When absent — e.g. callers that just want the value in
  // the active search field — fall back to the global searchbar keyword.
  const onBarCodeRead = route?.params?.onBarCodeRead;

  useEffect(() => {
    let isMounted = true;

    const requestCameraPermission = async () => {
      try {
        if (Platform.OS === 'android') {
          const granted = await PermissionsAndroid.request(
            PermissionsAndroid.PERMISSIONS.CAMERA,
            {
              title: 'Camera Permission',
              message: 'Camera access is required to scan barcodes.',
              buttonPositive: 'Allow',
              buttonNegative: 'Deny',
            },
          );
          if (isMounted) {
            setPermission(
              granted === PermissionsAndroid.RESULTS.GRANTED
                ? PERMISSION.GRANTED
                : PERMISSION.DENIED,
            );
          }
        } else {
          // iOS shows the native camera authorization prompt automatically when
          // the <Camera /> mounts (requires NSCameraUsageDescription).
          if (isMounted) setPermission(PERMISSION.GRANTED);
        }
      } catch (error) {
        console.debug(error);
        if (isMounted) setPermission(PERMISSION.DENIED);
      }
    };

    requestCameraPermission();

    return () => {
      isMounted = false;
    };
  }, []);

  const handleReadCode = useCallback(
    event => {
      if (hasHandledRef.current) return;

      const value = event?.nativeEvent?.codeStringValue ?? '';
      if (!value) return;

      hasHandledRef.current = true;

      if (typeof onBarCodeRead === 'function') {
        onBarCodeRead(value);
      } else {
        setKeyword(value);
      }

      navigation.goBack();
    },
    [navigation, onBarCodeRead, setKeyword],
  );

  if (permission === PERMISSION.DENIED) {
    return (
      <View style={[styles.container, styles.centered]}>
        <Text style={styles.messageText}>
          Camera permission is required to scan barcodes. Enable it in Settings
          to continue.
        </Text>
        <Button
          mode="contained"
          onPress={() => Linking.openSettings()}
          style={styles.settingsButton}>
          Open Settings
        </Button>
        <Button onPress={() => navigation.goBack()} style={styles.goBackButton}>
          Go Back
        </Button>
      </View>
    );
  }

  if (permission === PERMISSION.CHECKING) {
    return <View style={styles.container} />;
  }

  return (
    <View style={styles.container}>
      <Camera
        style={StyleSheet.absoluteFill}
        cameraType="back"
        scanBarcode
        onReadCode={handleReadCode}
        showFrame
        laserColor="red"
        frameColor="white"
      />
      <View style={styles.instructionContainer} pointerEvents="none">
        <Text style={styles.instructionText}>
          Point the camera at a barcode to scan
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  centered: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  messageText: {
    color: '#fff',
    fontSize: 16,
    textAlign: 'center',
  },
  settingsButton: {
    marginTop: 16,
  },
  goBackButton: {
    marginTop: 8,
  },
  instructionContainer: {
    position: 'absolute',
    bottom: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  instructionText: {
    color: '#fff',
    fontSize: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    overflow: 'hidden',
  },
});

export default ScanBarcode;
