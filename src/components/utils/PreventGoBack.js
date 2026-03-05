import React, {useEffect, useState} from 'react';
import {Dialog, Paragraph, Button, Portal, useTheme} from 'react-native-paper';

function PreventGoBack({navigation, hasUnsavedChanges}) {
  const {colors} = useTheme();
  const [exitDialogVisible, setExitDialogVisible] = useState(false);
  const [event, setEvent] = useState(null);

  // Keep a ref so the beforeRemove listener always reads the latest value
  // without needing to be re-registered every time it changes.
  const hasUnsavedChangesRef = React.useRef(hasUnsavedChanges);
  useEffect(() => {
    hasUnsavedChangesRef.current = hasUnsavedChanges;
  }, [hasUnsavedChanges]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', e => {
      // Read the ref — always current, never stale
      if (!hasUnsavedChangesRef.current) {
        return;
      }
      e.preventDefault();
      setExitDialogVisible(() => true);
      setEvent(() => e);
    });
    return unsubscribe;
  }, [navigation]); // only re-register when navigation changes, not on every dirty change

  return (
    <Portal>
      <Dialog
        visible={exitDialogVisible}
        onDismiss={() => setExitDialogVisible(() => false)}>
        <Dialog.Title>Discard changes?</Dialog.Title>
        <Dialog.Content>
          <Paragraph>
            You have unsaved changes. Are you sure to discard them and leave the
            screen?
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

export default PreventGoBack;
