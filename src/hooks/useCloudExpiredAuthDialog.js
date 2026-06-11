import {Portal, Dialog, Button, Text} from 'react-native-paper';
import useCloudAuthContext from './useCloudAuthContext';

// Cloud-auth counterpart of useExpiredAuthDialog (which is wired to the
// deprecated local AuthContextProvider). Surfaces the "session expired" prompt
// for cloud users when their token is rejected (401) on restore or while the
// app is open. The sign-out itself has already been performed by
// CloudAuthContextProvider at the point the dialog is shown, so dismissing only
// needs to hide the dialog.
export default function useCloudExpiredAuthDialog() {
  const [, , {expiredAuthTokenDialogVisible}, {setExpiredAuthTokenDialogVisible}] =
    useCloudAuthContext();

  const dismissExpiredAuthDialog = () => {
    setExpiredAuthTokenDialogVisible(false);
  };

  const CloudExpiredAuthDialog = () => (
    <Portal>
      <Dialog
        visible={expiredAuthTokenDialogVisible}
        onDismiss={dismissExpiredAuthDialog}>
        <Dialog.Title>Session expired</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">
            Your session has expired. Please sign in again.
          </Text>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button onPress={dismissExpiredAuthDialog}>Okay</Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  return {
    expiredAuthTokenDialogVisible,
    dismissExpiredAuthDialog,
    CloudExpiredAuthDialog,
  };
}
