import {useEffect} from 'react';
import {useQueryClient} from '@tanstack/react-query';
import {Portal, Dialog, Button, Text} from 'react-native-paper';
import useAuthContext from './useAuthContext';

export default function useExpiredAuthDialog() {
  const queryClient = useQueryClient();
  const [
    authState,
    {signOut},
    {expiredAuthTokenDialogVisible},
    {setExpiredAuthTokenDialogVisible},
  ] = useAuthContext();

  const authTokenData = queryClient.getQueryData(['authTokenStatus']);

  useEffect(() => {
    if (authTokenData?.result?.isAuthTokenExpired && authState.authToken) {
      setExpiredAuthTokenDialogVisible(true);
    }
  }, [authTokenData, authState.authToken]);

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
