import {useState, useCallback} from 'react';
import {Portal, Dialog, Button, Text} from 'react-native-paper';

export default function useReinstallDetectedDialog() {
  const [visible, setVisible] = useState(false);
  const [onCreateNew, setOnCreateNew] = useState(() => () => {});
  const [onUseExisting, setOnUseExisting] = useState(() => () => {});

  const showReinstallDialog = useCallback((handlers = {}) => {
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

  const ReinstallDetectedDialog = () => (
    <Portal>
      <Dialog
        visible={visible}
        onDismiss={() => {
          // do nothing on dismiss, forces user to choose an action
        }}>
        <Dialog.Title>Welcome back!</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">
            You have previously installed this app on this device.
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-between'}}>
          <Button onPress={handleCreateNew}>Create New Data</Button>
          <Button onPress={handleUseExisting}>Use Existing Data</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  return {
    showReinstallDialog,
    dismiss,
    visible,
    ReinstallDetectedDialog,
  };
}
