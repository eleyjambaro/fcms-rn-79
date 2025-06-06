import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {Button, Paragraph, Dialog, Portal, useTheme} from 'react-native-paper';

const ErrorMessageModal = props => {
  const {visible, onDismiss, title = '', textContent = ''} = props;

  const renderTitle = () => {
    if (!title) return null;

    return <Dialog.Title>{title}</Dialog.Title>;
  };

  return (
    <Portal>
      <Dialog visible={visible} onDismiss={onDismiss}>
        {renderTitle()}
        <Dialog.Content>
          <Paragraph>{textContent}</Paragraph>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button
            onPress={() => {
              onDismiss && onDismiss();
            }}>
            Okay
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
};

export default ErrorMessageModal;

const styles = StyleSheet.create({});
