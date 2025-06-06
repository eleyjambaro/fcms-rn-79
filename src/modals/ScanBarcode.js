import React, {useState, useRef} from 'react';
import {View, StyleSheet} from 'react-native';
// import {RNCamera} from 'react-native-camera';
import Ionicons from 'react-native-vector-icons/Ionicons';

import useSearchbarContext from '../hooks/useSearchbarContext';

const ScanBarcode = props => {
  const {navigation, onBarCodeRead} = props;
  const [torchOn, setTorchOn] = useState(false);
  const cameraRef = useRef();
  const {setKeyword} = useSearchbarContext();

  const handleBarCodeRead = e => {
    setKeyword(e.data);
    onBarCodeRead && onBarCodeRead(e.data);
    navigation.goBack();
  };

  const handleTorch = value => {
    if (value === true) {
      setTorchOn(() => false);
    } else {
      setTorchOn(() => true);
    }
  };

  return (
    <View style={styles.container}>
      {/* <RNCamera
        style={styles.preview}
        onBarCodeRead={handleBarCodeRead}
        ref={cameraRef}
        type={RNCamera.Constants.Type.back}
        flashMode={
          torchOn
            ? RNCamera.Constants.FlashMode.torch
            : RNCamera.Constants.FlashMode.off
        }
        autoFocus="on"
        captureAudio={false}>
        <View
          style={{
            flex: 1,
            width: '100%',
            justifyContent: 'center',
            alignItems: 'center',
          }}>
          <View style={styles.tintedBackground} />
          <View
            style={{
              width: '60%',
              height: 2,
              backgroundColor: 'rgba(255,0,0,0.5)',
              position: 'absolute',
            }}
          />
          <Ionicons
            name="md-scan-outline"
            size={400}
            style={{maxWidth: '100%'}}
            color={'rgba(255,255,255,0.5)'}
          />
          <View style={styles.tintedBackground} />
        </View>
      </RNCamera> */}
    </View>
  );
};
const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  preview: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  cameraIcon: {
    margin: 5,
    height: 40,
    width: 40,
  },
  tintedBackground: {
    backgroundColor: 'rgba(0,0,0,0.5)',
    flex: 1,
    width: '100%',
  },
  bottomOverlay: {
    position: 'absolute',
    width: '100%',
    flex: 20,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});

export default ScanBarcode;
