import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
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
import TaxForm from '../components/forms/TaxForm';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import {ScrollView} from 'react-native-gesture-handler';
import {createTax, getTaxes} from '../localDbQueries/taxes';

const ItemTax = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useItemFormContext();
  const {tax_id: defaultSelectedTaxId, tax_id_field_key: taxIdFieldKey} =
    route.params;
  const [createTaxModalVisible, setCreateTaxModalVisible] = useState(false);
  const [selectedTax, setSelectedTax] = useState(defaultSelectedTaxId);
  const queryClient = useQueryClient();
  const createTaxMutation = useMutation(createTax, {
    onSuccess: () => {
      queryClient.invalidateQueries('taxes');
    },
  });
  const {status, data} = useQuery(['taxes', {limit: 100}], getTaxes);
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  /**
   * NOTE: Code below is for reference only if we want tax id to be required
   * in the future version for some reason.
   */
  // useEffect(() => {
  //   return () => {
  //     formikActions.setFieldTouched('tax_id');

  //     !selectedTax
  //       ? formikActions.setFieldError('tax_id', 'Required')
  //       : formikActions.setFieldError('tax_id', '');
  //   };
  // }, []);

  const showCreateTaxModal = () => setCreateTaxModalVisible(true);
  const hideCreateTaxModal = () => setCreateTaxModalVisible(false);

  const handleTaxChange = selectedOption => {
    setSelectedTax(() => selectedOption);
  };

  const handleCancel = () => {
    hideCreateTaxModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createTaxMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateTaxModal();
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

  const taxes = data.result;
  const taxSelection = taxes.map(tax => {
    return {
      id: tax.id,
      name: `${tax.name} (${tax.rate_percentage}%)`,
    };
  });

  // id 0 on query means user intentionally set the value to null
  taxSelection.unshift({
    id: '0',
    name: 'None',
  });

  return (
    <>
      <Portal>
        <Modal
          visible={createTaxModalVisible}
          onDismiss={hideCreateTaxModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Tax
          </Title>
          <TaxForm onSubmit={handleSubmit} onCancel={handleCancel} />
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
          onPress={showCreateTaxModal}
          style={{marginVertical: 20}}>
          Create Tax
        </Button>
        <Divider />
        <ScrollView>
          <CheckboxSelection
            value={selectedTax}
            options={taxSelection}
            optionLabelKey="name"
            optionValueKey="id"
            onChange={handleTaxChange}
          />
        </ScrollView>
        {taxes?.length > 0 && (
          <ManageListButton
            containerStyle={{paddingBottom: 10}}
            label="Manage taxes"
            onPress={() => navigation.navigate(routes.manageTaxes())}
          />
        )}
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldValue(taxIdFieldKey, selectedTax);
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

export default React.memo(ItemTax);
