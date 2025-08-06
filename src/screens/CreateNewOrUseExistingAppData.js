import React from 'react';
import {View} from 'react-native';
import {Button, Text, Modal} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import RNRestart from 'react-native-restart';

import {ignoreExistingAppData} from '../lib/appInstalledIndicator';

export default function CreateNewOrUseExistingAppData() {
  const navigation = useNavigation();
  const [showModal, setShowModal] = React.useState(false);

  return (
    <View style={{flex: 1, justifyContent: 'center', padding: 20}}>
      <Text
        variant="titleLarge"
        style={{marginBottom: 30, textAlign: 'center'}}>
        You have previously installed and configured this app on this device.
        What do you want to do with your existing data?
      </Text>

      <Button
        mode="contained"
        onPress={() => navigation.navigate('SelectExistingAppData')}
        style={{marginBottom: 20}}>
        Use Existing Data
      </Button>

      <Button mode="outlined" onPress={() => setShowModal(true)}>
        Create New Data
      </Button>

      <Modal
        visible={showModal}
        onDismiss={() => setShowModal(false)}
        contentContainerStyle={{
          backgroundColor: 'white',
          padding: 24,
          margin: 20,
          borderRadius: 10,
        }}>
        <Text variant="titleMedium" style={{marginBottom: 20}}>
          Are you sure you want to ignore your existing data from this device
          and create new data?
        </Text>

        <Button
          mode="contained"
          onPress={async () => {
            await ignoreExistingAppData();
            setShowModal(false);
            RNRestart.restart();
          }}>
          Yes, Create New Data
        </Button>

        <Button onPress={() => setShowModal(false)} style={{marginTop: 15}}>
          Cancel
        </Button>
      </Modal>
    </View>
  );
}
