import React, {useState, useEffect} from 'react';
import {View} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import LocalUserAccountList from '../components/accounts/LocalUserAccountList';
import LocalUserAccountForm from '../components/forms/LocalUserAccountForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {createVendor} from '../localDbQueries/vendors';
import {ScrollView} from 'react-native-gesture-handler';
import {createLocalUserAccount} from '../localDbQueries/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import useAuthContext from '../hooks/useAuthContext';

function LocalUserAccounts(props) {
  const {navigation, viewMode} = props;
  const [
    createLocalUserAccountModalVisible,
    setCreateLocalUserAccountModalVisible,
  ] = useState(false);
  const {colors} = useTheme();
  const [authState] = useAuthContext();
  const authUser = authState?.authUser;
  const queryClient = useQueryClient();
  const createLocalUserAccountMutation = useMutation(createLocalUserAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('localUserAccounts');
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [formErrorMessage, setErrorMessage] = useState('');

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const showCreateLocalUserAccountModal = () =>
    setCreateLocalUserAccountModalVisible(true);
  const hideCreateLocalUserAccountModal = () =>
    setCreateLocalUserAccountModalVisible(false);

  const handleCancel = () => {
    hideCreateLocalUserAccountModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createLocalUserAccountMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onError: ({errorMessage}) => {
          setErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
      return;
    }

    actions.resetForm();
    hideCreateLocalUserAccountModal();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createLocalUserAccountModalVisible}
          onDismiss={() => setCreateLocalUserAccountModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create User
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <LocalUserAccountForm
              authUser={authUser}
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </ScrollView>
        </Modal>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search user"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <LocalUserAccountList
            viewMode={viewMode}
            filter={{
              '%LIKE': {key: 'first_name', value: `'%${keyword}%'`},
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" onPress={showCreateLocalUserAccountModal}>
            Create User
          </Button>
        </View>
      </View>
    </>
  );
}

export default LocalUserAccounts;
