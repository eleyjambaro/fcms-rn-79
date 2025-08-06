import React, {useState, useCallback} from 'react';
import {Modal, View, StyleSheet} from 'react-native';
import {Button, Text} from 'react-native-paper';

export default function useReinstallDetectedScreen() {
  const [visible, setVisible] = useState(false);
  const [onCreateNew, setOnCreateNew] = useState(() => () => {});
  const [onUseExisting, setOnUseExisting] = useState(() => () => {});

  const showReinstallDetectedScreen = useCallback((handlers = {}) => {
    if (handlers.onCreateNew) setOnCreateNew(() => handlers.onCreateNew);
    if (handlers.onUseExisting) setOnUseExisting(() => handlers.onUseExisting);
    setVisible(true);
  }, []);

  const dismiss = () => {
    setVisible(false);
  };

  const handleCreateNew = () => {
    dismiss();
    onCreateNew();
  };

  const handleUseExisting = () => {
    dismiss();
    onUseExisting();
  };

  const ReinstallDetectedScreen = () => (
    <Modal
      animationType="fade"
      transparent={false}
      visible={visible}
      onRequestClose={() => {
        // do nothing on dismiss, forces user to choose an action
      }}>
      <View style={styles.container}>
        <Text variant="headlineSmall" style={styles.title}>
          Welcome back!
        </Text>
        <Text variant="bodyMedium" style={styles.message}>
          You have previously installed and configured this app on this device.
          What do you want to do with your existing data from this device?
        </Text>

        <View style={styles.buttonContainer}>
          <Button
            mode="contained"
            onPress={handleCreateNew}
            style={styles.button}>
            Create New Data
          </Button>
          <Button
            mode="outlined"
            onPress={handleUseExisting}
            style={styles.button}>
            Use Existing Data
          </Button>
        </View>
      </View>
    </Modal>
  );

  return {
    showReinstallDetectedScreen,
    dismiss,
    visible,
    ReinstallDetectedScreen,
  };
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    textAlign: 'center',
    marginBottom: 16,
  },
  message: {
    textAlign: 'center',
    marginBottom: 32,
  },
  buttonContainer: {
    gap: 16,
  },
  button: {
    paddingVertical: 6,
  },
});
