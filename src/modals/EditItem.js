import React, {useState} from 'react';
import {StyleSheet, ScrollView} from 'react-native';
import {Button, useTheme, Paragraph, Dialog, Portal} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import ItemForm from '../components/forms/ItemForm';
import routes from '../constants/routes';
import {updateItem, getItem} from '../localDbQueries/items';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useAppConfigContext from '../hooks/useAppConfigContext';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';

const EditItem = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const itemId = route.params?.item_id;
  const queryClient = useQueryClient();
  const {status, data} = useQuery(['item', {id: itemId}], getItem, {
    enabled: itemId ? true : false,
  });
  const updateItemMutation = useMutation(updateItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await updateItemMutation.mutateAsync({
        id: itemId,
        updatedValues: values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: () => {
          actions.resetForm();
          navigation.goBack();
        },
      });
    } catch (error) {
      console.debug(error);
    }
  };

  if (!itemId) return null;

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

  const item = data.result;

  if (!item) return null;

  return (
    <ScrollView style={styles.container}>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ItemForm
        item={item}
        initialValues={{
          ...item,
          vendor_id: item.preferred_vendor_id,
          cost_input_mode: item?.uom_abbrev_per_piece
            ? 'total_cost'
            : 'unit_cost',
        }}
        onSubmit={handleSubmit}
        editMode={true}
      />
      {/* <Divider />
      <Button
        mode="contained"
        color={colors.accent}
        onPress={() => navigation.goBack()}
        style={{marginVertical: 20}}>
        Delete Item
      </Button> */}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  surface: {
    padding: 8,
    height: 80,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

export default EditItem;
