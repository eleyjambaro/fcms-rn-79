import React from 'react';
import {View} from 'react-native';
import {Button, Text, Card} from 'react-native-paper';
import * as DocumentPicker from '@react-native-documents/picker';
import moment from 'moment';

import manualDataRecovery from '../constants/dataRecovery';
import {extractBackupTimestamp} from '../utils/stringHelpers';

export default function SelectExistingAppData() {
  const [selectedFile, setSelectedFile] = React.useState(null);

  const handleSelectFile = async () => {
    try {
      const result = await DocumentPicker.pick({
        type: [DocumentPicker.types.allFiles],
        allowMultiSelection: false,
        mode: 'open',
        requestLongTermAccess: true,
        presentationStyle: 'fullScreen',
      });

      const file = result[0];

      const timestamp = extractBackupTimestamp(
        file?.name,
        manualDataRecovery.backupDbPrefix,
      );
      const backupDate = new Date(timestamp);
      const backupDateFormatted = moment(backupDate).format(
        'MMMM DD, YYYY, hh:mm A',
      );

      setSelectedFile({
        name: file.name,
        uri: file.uri,
        backupDate: backupDateFormatted,
      });
    } catch (err) {
      if (!DocumentPicker.isCancel(err)) {
        console.error('DocumentPicker Error:', err);
      }
    }
  };

  return (
    <View style={{flex: 1, justifyContent: 'center', padding: 20}}>
      <Text
        variant="titleLarge"
        style={{marginBottom: 20, textAlign: 'center'}}>
        To recover your existing data from this device, select a file from your
        Download/FCMS_Data folder
      </Text>

      <Button
        mode="contained"
        onPress={handleSelectFile}
        style={{marginBottom: 20}}>
        Select a File
      </Button>

      {selectedFile && (
        <Card style={{marginBottom: 20}}>
          <Card.Title title="Selected Backup" />
          <Card.Content>
            <Text>File: {selectedFile.name}</Text>
            <Text>{`Backed up date: ${selectedFile.backupDate}`}</Text>
          </Card.Content>
          <Card.Actions style={{marginTop: 10}}>
            <Button
              style={{flex: 1}}
              mode="outlined"
              onPress={() => {
                console.log('Recovering data from:', selectedFile);
              }}>
              Recover this selected data
            </Button>
          </Card.Actions>
        </Card>
      )}
    </View>
  );
}
