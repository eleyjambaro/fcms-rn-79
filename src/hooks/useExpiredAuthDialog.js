import {Portal, Dialog, Button, Text} from 'react-native-paper';
import useCurrentUser from './useCurrentUser';

export default function useExpiredAuthDialog() {
  const [
    _authState,
    {signOut},
    {expiredAuthTokenDialogVisible},
    {setExpiredAuthTokenDialogVisible},
  ] = useCurrentUser();

  const dismissExpiredAuthDialog = () => {
    signOut();
    setExpiredAuthTokenDialogVisible(false);
  };

  const ExpiredAuthDialog = () => (
    <Portal>
      <Dialog
        visible={expiredAuthTokenDialogVisible}
        onDismiss={dismissExpiredAuthDialog}>
        <Dialog.Title>Session expired!</Dialog.Title>
        <Dialog.Content>
          <Text variant="bodyMedium">
            Your authentication session has expired. Please log in again.
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
    ExpiredAuthDialog,
  };
}
