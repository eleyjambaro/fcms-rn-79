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

import LocalUserAccountList from '../components/accounts/LocalUserAccountList';
import LocalUserAccountForm from '../components/forms/LocalUserAccountForm';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {ScrollView} from 'react-native-gesture-handler';
import {createCloudSubAccount} from '../serverDbQueries/v2/accounts';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';
import useCurrentUser from '../hooks/useCurrentUser';

function LocalUserAccounts(props) {
  const {navigation, viewMode} = props;
  const [
    createLocalUserAccountModalVisible,
    setCreateLocalUserAccountModalVisible,
  ] = useState(false);
  const {colors} = useTheme();
  const [authState] = useCurrentUser();
  const authUser = authState?.authUser;
  const queryClient = useQueryClient();
  const createLocalUserAccountMutation = useMutation(createCloudSubAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries(['cloudSubAccounts']);
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
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
    try {
      await createLocalUserAccountMutation.mutateAsync(values);
    } catch (error) {
      const msg =
        error?.response?.data?.message || 'Failed to create user account.';
      setErrorMessage(() => msg);
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
