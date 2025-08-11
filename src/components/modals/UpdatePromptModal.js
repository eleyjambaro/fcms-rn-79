import React from 'react';
import {View, StyleSheet, Linking} from 'react-native';
import {Modal, Portal, Text, Button} from 'react-native-paper';

const UpdatePromptModal = ({
  visible,
  onDismiss,
  isForceUpdate,
  currentVersion,
  latestVersion,
  storeUrl,
}) => {
  const handleUpdate = async () => {
    try {
      await Linking.openURL(storeUrl);
    } catch (error) {
      console.error('Could not open store URL:', error);
    }
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={isForceUpdate ? undefined : onDismiss}
        contentContainerStyle={styles.container}
        dismissable={!isForceUpdate}>
        <Text style={styles.title}>
          {isForceUpdate ? 'Update Required' : 'Update Available'}
        </Text>
        <Text style={styles.message}>
          {isForceUpdate
            ? 'A new version of the app is required to continue.'
            : 'A new version of the app is available.'}
        </Text>
        <Text style={styles.version}>
          Current version: {currentVersion}
          {'\n'}
          Latest version: {latestVersion}
        </Text>
        <View style={styles.buttonContainer}>
          {!isForceUpdate && (
            <Button mode="outlined" onPress={onDismiss} style={styles.button}>
              Later
            </Button>
          )}
          <Button mode="contained" onPress={handleUpdate} style={styles.button}>
            Update Now
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'white',
    padding: 20,
    margin: 20,
    borderRadius: 8,
  },
  title: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 10,
    textAlign: 'center',
  },
  message: {
    fontSize: 16,
    marginBottom: 15,
    textAlign: 'center',
  },
  version: {
    fontSize: 14,
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
  },
  button: {
    minWidth: 120,
  },
});

export default UpdatePromptModal;
