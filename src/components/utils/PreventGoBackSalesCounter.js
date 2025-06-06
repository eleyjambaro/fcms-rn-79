import React, {useEffect, useState} from 'react';
import {Dialog, Paragraph, Button, Portal, useTheme} from 'react-native-paper';

function PreventGoBackSalesCounter({navigation, hasUnsavedChanges}) {
  const {colors} = useTheme();

  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [event, setEvent] = useState(null);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      if (!hasUnsavedChanges) {
        // If we don't have unsaved changes, then we don't need to do anything
        return;
      }

      // Prevent default behavior of leaving the screen
      e.preventDefault();

      // Prompt the user before leaving the screen
      setExitDialogVisible(() => true);
      setEvent(() => e);
    });

    return unsubscribe;
  }, [navigation, hasUnsavedChanges]);

  return (
    <Portal>
      <Dialog
        visible={exitDialogVisible}
        onDismiss={() => setExitDialogVisible(() => false)}>
        <Dialog.Title>Discard sales entries?</Dialog.Title>
        <Dialog.Content>
          <Paragraph>
            You have unconfirmed sales entries. Are you sure to discard them and
            leave the screen?
          </Paragraph>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button
            onPress={() => {
              setExitDialogVisible(() => false);
            }}>
            Don't Leave
          </Button>
          <Button
            onPress={() => {
              if (!event) return;

              setExitDialogVisible(() => false);
              navigation.dispatch(event.data.action);
            }}
            color={colors.notification}>
            Discard
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );
}

export default PreventGoBackSalesCounter;
