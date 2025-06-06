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
import VendorList from '../components/vendors/VendorList';
import VendorForm from '../components/forms/VendorForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {createVendor} from '../localDbQueries/vendors';
import {ScrollView} from 'react-native-gesture-handler';

function Vendors(props) {
  const {navigation, viewMode} = props;
  const [createVendorModalVisible, setCreateVendorModalVisible] =
    useState(false);
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const createVendorMutation = useMutation(createVendor, {
    onSuccess: () => {
      queryClient.invalidateQueries('vendors');
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const showCreateVendorModal = () => setCreateVendorModalVisible(true);
  const hideCreateVendorModal = () => setCreateVendorModalVisible(false);

  const handleCancel = () => {
    hideCreateVendorModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createVendorMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateVendorModal();
    }
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createVendorModalVisible}
          onDismiss={() => setCreateVendorModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Vendor
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <VendorForm onSubmit={handleSubmit} onCancel={handleCancel} />
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
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search vendor"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <VendorList
            viewMode={viewMode}
            filter={{
              '%LIKE': {key: 'vendor_display_name', value: `'%${keyword}%'`},
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" icon="plus" onPress={showCreateVendorModal}>
            Create Vendor
          </Button>
        </View>
      </View>
    </>
  );
}

export default Vendors;
