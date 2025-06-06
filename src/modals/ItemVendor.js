import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View, ScrollView} from 'react-native';
import {
  Checkbox,
  Divider,
  Button,
  Modal,
  Portal,
  TextInput,
  Title,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQueryClient, useMutation, useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import useItemFormContext from '../hooks/useItemFormContext';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import ManageListButton from '../components//buttons/ManageListButton';
import VendorForm from '../components/forms/VendorForm';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import {createVendor, getVendors} from '../localDbQueries/vendors';

const ItemVendor = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useItemFormContext();
  const {
    vendor_id: defaultSelectedVendorId,
    vendor_id_field_key: vendorIdFieldKey,
    is_vendor_id_required: isVendorIdRequired,
  } = route.params;
  const [createVendorModalVisible, setCreateVendorModalVisible] =
    useState(false);
  const [selectedVendor, setSelectedVendor] = useState(defaultSelectedVendorId);
  const queryClient = useQueryClient();
  const createVendorMutation = useMutation(createVendor, {
    onSuccess: () => {
      queryClient.invalidateQueries('vendors');
    },
  });
  const {status, data} = useQuery(['vendors', {limit: 100}], getVendors);
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  useEffect(() => {
    if (isVendorIdRequired) {
      return () => {
        formikActions.setFieldTouched('vendor_id');

        !selectedVendor
          ? formikActions.setFieldError('vendor_id', 'Vendor is required')
          : formikActions.setFieldError('vendor_id', '');
      };
    } else {
      return () => {};
    }
  }, []);

  const showCreateVendorModal = () => setCreateVendorModalVisible(true);
  const hideCreateVendorModal = () => setCreateVendorModalVisible(false);

  const handleVendorChange = selectedOption => {
    setSelectedVendor(() => selectedOption);
  };

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

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const vendors = data.result;
  const vendorSelection = vendors.map(vendor => {
    return {
      id: vendor.id,
      name: `${vendor.vendor_display_name}`,
    };
  });

  // id 0 on query means user intentionally set the value to null
  vendorSelection.unshift({
    id: '0',
    name: 'None',
  });

  return (
    <>
      <Portal>
        <Modal
          visible={createVendorModalVisible}
          onDismiss={hideCreateVendorModal}
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
      <View style={styles.container}>
        <Button
          mode="outlined"
          icon="plus"
          onPress={showCreateVendorModal}
          style={{marginVertical: 20}}>
          Create Vendor
        </Button>
        <Divider />
        <ScrollView>
          <CheckboxSelection
            value={selectedVendor}
            options={vendorSelection}
            optionLabelKey="name"
            optionValueKey="id"
            onChange={handleVendorChange}
          />
        </ScrollView>
        {vendors?.length > 0 && (
          <ManageListButton
            containerStyle={{paddingBottom: 10}}
            label="Manage vendors"
            onPress={() => navigation.navigate(routes.manageVendors())}
          />
        )}
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldValue(vendorIdFieldKey, selectedVendor);
            navigation.goBack();
          }}
          style={{marginVertical: 20}}>
          Done
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 7,
    backgroundColor: 'white',
  },
});

export default React.memo(ItemVendor);
