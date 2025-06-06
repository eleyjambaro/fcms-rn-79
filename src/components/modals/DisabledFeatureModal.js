import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {
  Button,
  Paragraph,
  Dialog,
  Portal,
  useTheme,
  Modal,
  Title,
} from 'react-native-paper';

import * as RootNavigation from '../../../RootNavigation';
import routes from '../../constants/routes';
import appDefaults from '../../constants/appDefaults';

const DisabledFeatureModal = props => {
  const {
    visible,
    onDismiss,
    title = 'Upgrade Your Account',
    textContent = '',
  } = props;

  const renderTitle = () => {
    if (!title) return null;

    return (
      <Title style={{marginBottom: 15, textAlign: 'center'}}>{title}</Title>
    );
  };

  const renderModalContent = () => {
    return (
      <View>
        <View>
          <Text style={{textAlign: 'center'}}>
            {`Unlock other ${appDefaults.appDisplayName} features by activating or renewing your digital license.`}
          </Text>
        </View>
        <Button
          mode="contained"
          icon="chevron-right"
          contentStyle={{flexDirection: 'row-reverse'}}
          onPress={() => {
            RootNavigation.navigate(routes.activateLicense());
            onDismiss && onDismiss();
          }}
          style={{marginTop: 20}}>
          Activate License
        </Button>
        <Button onPress={onDismiss} style={{marginTop: 10}}>
          Cancel
        </Button>
      </View>
    );
  };

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => onDismiss && onDismiss()}
        contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
        {renderTitle()}
        {renderModalContent()}
      </Modal>
    </Portal>
  );
};

export default DisabledFeatureModal;

const styles = StyleSheet.create({});
