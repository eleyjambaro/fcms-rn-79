import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {useNavigation, useRoute} from '@react-navigation/native';
import {StyleSheet, Text, View, BackHandler} from 'react-native';
import {Button, useTheme, Paragraph, Dialog, Portal} from 'react-native-paper';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import routes from '../constants/routes';
import SellingMenuSummary from '../components/sellingMenus/SellingMenuSummary';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import OptionsList from '../components/buttons/OptionsList';
import {
  deleteSellingMenu,
  getSellingMenu,
} from '../localDbQueries/sellingMenus';
import AddedSellingMenuItemList from '../components/sellingMenus/AddedSellingMenuItemList';
import ScreenEmpty from '../components/stateIndicators/ScreenEmpty';

const SellingMenuView = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const sellingMenuId = route.params?.selling_menu_id;
  const {status, data, isRefetching} = useQuery(
    ['sellingMenu', {id: sellingMenuId}],
    getSellingMenu,
    {
      enabled: sellingMenuId ? true : false,
    },
  );
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const deleteSellingMenuMutation = useMutation(deleteSellingMenu, {
    onSuccess: () => {
      queryClient.invalidateQueries('sellingMenus');
      navigation.goBack();
    },
  });
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);

  const hideDeleteDialog = () => setDeleteDialogVisible(false);

  const itemOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        navigation.navigate(routes.editSellingMenu(), {
          selling_menu_id: sellingMenuId,
        });
        closeOptionsBottomSheet();
      },
    },
    {
      label: 'Delete',
      labelColor: colors.notification,
      icon: 'delete-outline',
      iconColor: colors.notification,
      handler: () => {
        showDeleteDialog();
        closeOptionsBottomSheet();
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, itemOptions.length * 75 + 30],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteItem = async () => {
    try {
      await deleteSellingMenuMutation.mutateAsync({
        id: sellingMenuId,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteDialog();
    }
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const renderBottomSheetBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const renderOptions = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Selling menu options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  if (status === 'loading' || isRefetching) {
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

  if (!sellingMenu) {
    return (
      <View style={styles.container}>
        <ScreenEmpty message="Menu not found" />
      </View>
    );
  }

  const deleteDialog = (
    <Portal>
      <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
        <Dialog.Title>Delete menu?</Dialog.Title>
        <Dialog.Content>
          <Paragraph>
            Are you sure you want to delete menu? You can't undo this action.
          </Paragraph>
        </Dialog.Content>
        <Dialog.Actions style={{justifyContent: 'space-around'}}>
          <Button onPress={hideDeleteDialog}>Cancel</Button>
          <Button
            icon={'delete-outline'}
            onPress={handleConfirmDeleteItem}
            color={colors.notification}>
            Delete menu
          </Button>
        </Dialog.Actions>
      </Dialog>
    </Portal>
  );

  return (
    <>
      {deleteDialog}
      <View style={styles.container}>
        {sellingMenu && (
          <SellingMenuSummary
            sellingMenu={sellingMenu}
            onPressItemOptions={openOptionsBottomSheet}
          />
        )}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            paddingHorizontal: 20,
            paddingVertical: 12,
            borderBottomWidth: 2,
            borderColor: colors.background,
            backgroundColor: colors.surface,
            // borderWidth: 2,
          }}>
          <Text style={{fontWeight: 'bold'}}>Menu Items</Text>
          <View style={{marginLeft: 'auto', marginRight: 45}}>
            <Text style={{fontWeight: '500', textAlign: 'right', fontSize: 13}}>
              Price
            </Text>
          </View>
        </View>
        <AddedSellingMenuItemList sellingMenuId={sellingMenuId} showFooter />
      </View>
      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions()}
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default SellingMenuView;
