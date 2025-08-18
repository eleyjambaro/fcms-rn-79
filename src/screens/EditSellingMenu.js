import React from 'react';
import {StyleSheet, View} from 'react-native';
import {Button, useTheme, Divider} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import {
  getSellingMenu,
  updateSellingMenu,
} from '../localDbQueries/sellingMenus';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import SellingMenuForm from '../components/forms/SellingMenuForm';

const EditSellingMenu = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const sellingMenuId = route.params?.selling_menu_id;
  const queryClient = useQueryClient();
  const {status, data} = useQuery(
    ['sellingMenu', {id: sellingMenuId}],
    getSellingMenu,
    {
      enabled: sellingMenuId ? true : false,
    },
  );
  const updateSellingMenuMutation = useMutation(updateSellingMenu, {
    onSuccess: () => {
      queryClient.invalidateQueries('sellingMenus');
    },
  });

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateSellingMenuMutation.mutateAsync({
        id: sellingMenuId,
        updatedValues: values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      navigation.goBack();
    }
  };

  if (!sellingMenuId) return null;

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

  const sellingMenu = data.result;

  if (!sellingMenu) return null;

  const initialValues = {
    name: sellingMenu.name || '',
  };

  return (
    <View style={styles.container}>
      <SellingMenuForm
        onSubmit={handleSubmit}
        sellingMenuId={sellingMenu.id}
        initialValues={initialValues}
        editMode={true}
      />
    </View>
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

export default EditSellingMenu;
