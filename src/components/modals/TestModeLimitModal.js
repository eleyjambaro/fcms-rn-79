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

const LimitReachedModal = props => {
  const {visible, onDismiss, title = 'Limit Reached', textContent = ''} = props;

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
            {`${textContent} using this FREE and limited app's feature access. `}
            You can activate or renew your license to increase your limit.
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

export default LimitReachedModal;

const styles = StyleSheet.create({});
