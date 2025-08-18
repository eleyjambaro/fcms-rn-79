import React, {useEffect, useState} from 'react';
import {StyleSheet, ScrollView, View} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Banner,
  Text,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import SellingMenuForm from '../components/forms/SellingMenuForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useAddedSellingMenuItemsContext from '../hooks/useAddedSellingMenuItemsContext';
import {
  createOrGetUnsavedSellingMenu,
  saveSellingMenu,
  isUnsavedSellingMenuHasSellingMenuItems,
  deleteSellingMenuItems,
} from '../localDbQueries/sellingMenus';
import {getItem} from '../localDbQueries/items';
import routes from '../constants/routes';

const CreateSellingMenu = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  const {resetData} = useAddedSellingMenuItemsContext();
  const {status, data} = useQuery(
    ['currentSellingMenu'],
    createOrGetUnsavedSellingMenu,
  );
  const {
    status: isUnsavedSellingMenuHasSellingMenuItemsStatus,
    data: isUnsavedSellingMenuHasSellingMenuItemsData,
  } = useQuery(
    ['isUnsavedSellingMenuHasSellingMenuItems'],
    isUnsavedSellingMenuHasSellingMenuItems,
  );
  const queryClient = useQueryClient();
  const saveSellingMenuMutation = useMutation(saveSellingMenu, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentSellingMenu');
      queryClient.invalidateQueries('sellingMenus');
    },
  });
  const deleteSellingMenuItemsMutation = useMutation(deleteSellingMenuItems, {
    onSuccess: () => {
      queryClient.invalidateQueries('currentSellingMenu');
      queryClient.invalidateQueries('sellingMenus');
    },
  });
  const [newOrFromUnsavedDialogVisible, setNewOrFromUnsavedDialogVisible] =
    useState(false);
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [createdSellingMenuId, setCreatedSellingMenuId] = useState(null);

  const deleteUnsavedSellingMenuItems = async id => {
    try {
      await deleteSellingMenuItemsMutation.mutateAsync({
        id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      setNewOrFromUnsavedDialogVisible(() => false);
    }
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);

    try {
      await saveSellingMenuMutation.mutateAsync({
        values,
        onSuccess: ({sellingMenuId}) => {
          setCreatedSellingMenuId(() => sellingMenuId);
          setSuccessDialogVisible(() => true);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      resetData();
    }
  };

  useEffect(() => {
    return () => {
      resetData();
    };
  }, []);

  useEffect(() => {
    const runCheck = async () => {
      try {
        const hasIngredients = await isUnsavedSellingMenuHasSellingMenuItems();

        if (hasIngredients) {
          setNewOrFromUnsavedDialogVisible(() => true);
        }
      } catch (error) {
        console.debug(error);
      }
    };

    runCheck();
  }, []);

  if (
    status === 'loading' ||
    isUnsavedSellingMenuHasSellingMenuItemsStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    status === 'error' ||
    isUnsavedSellingMenuHasSellingMenuItemsStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  let initialValues = {
    name: data.result?.name || '',
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <Portal>
        <Dialog
          visible={newOrFromUnsavedDialogVisible}
          onDismiss={() => setNewOrFromUnsavedDialogVisible(() => false)}>
          <Dialog.Title>Continue editing your unsaved menu?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              You can keep editing menu items from your unsaved menu or start a
              new one from scratch.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setNewOrFromUnsavedDialogVisible(() => false);
              }}>
              Continue Editing
            </Button>
            <Button
              onPress={() => {
                if (
                  data?.result?.id &&
                  isUnsavedSellingMenuHasSellingMenuItemsData
                )
                  deleteUnsavedSellingMenuItems(data.result.id);
              }}
              color={colors.dark}>
              Start New
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={successDialogVisible}
          onDismiss={() => {
            setSuccessDialogVisible(() => false);
            navigation.goBack();
          }}>
          <Dialog.Title>Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>Menu successfully created.</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setSuccessDialogVisible(() => false);
              }}>
              Close
            </Button>
            <Button
              onPress={() => {
                if (createdSellingMenuId) {
                  setSuccessDialogVisible(() => false);
                  navigation.pop();
                  navigation.navigate(routes.sellingMenuView(), {
                    selling_menu_id: createdSellingMenuId,
                  });
                }
              }}
              color={colors.dark}>
              View menu
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <SellingMenuForm
        onSubmit={handleSubmit}
        isUnsavedRecipe={data.result?.id ? true : false}
        sellingMenuId={data.result?.id}
        initialValues={initialValues}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
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

export default CreateSellingMenu;
