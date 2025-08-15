import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
  RefreshControl,
  ScrollView,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
  Modal,
  Title,
} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import LocalUserAccountListItem from './LocalUserAccountListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import LocalUserAccountForm from '../forms/LocalUserAccountForm';
import {
  deleteLocalUserAccount,
  getLocalUserAccounts,
  updateLocalUserAccount,
} from '../../localDbQueries/accounts';
import ErrorMessageModal from '../modals/ErrorMessageModal';
import useAuthContext from '../../hooks/useAuthContext';

const LocalUserAccountList = props => {
  const {backAction, viewMode, filter} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [authState] = useAuthContext();
  const authUser = authState?.authUser;
  const [focusedItem, setFocusedItem] = useState(null);
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    status,
    error,
    refetch,
    isRefetching,
  } = useInfiniteQuery(['localUserAccounts', {filter}], getLocalUserAccounts, {
    getNextPageParam: (lastPage, pages) => {
      let pagesResult = [];

      for (let page of pages) {
        pagesResult.push(...page.result);
      }

      if (pagesResult.length < lastPage.totalCount) {
        return lastPage.page + 1;
      }
    },
    networkMode: 'always',
  });
  const queryClient = useQueryClient();
  const updateLocalUserAccountMutation = useMutation(updateLocalUserAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('localUserAccounts');
    },
  });
  const deleteLocalUserAccountMutation = useMutation(deleteLocalUserAccount, {
    onSuccess: () => {
      queryClient.invalidateQueries('localUserAccounts');
    },
  });

  const [
    updateLocalUserAccountModalVisible,
    setUpdateLocalUserAccountModalVisible,
  ] = useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const [formErrorMessage, setErrorMessage] = useState('');

  const showUpdateLocalUserAccountModal = () =>
    setUpdateLocalUserAccountModalVisible(true);
  const hideUpdateLocalUserAccountModal = () =>
    setUpdateLocalUserAccountModalVisible(false);

  const showDeleteDialog = () => setDeleteDialogVisible(true);
  const hideDeleteDialog = () => setDeleteDialogVisible(false);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  const handleCancel = () => {
    hideUpdateLocalUserAccountModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateLocalUserAccountMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
        onError: ({errorMessage}) => {
          setErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }

    hideUpdateLocalUserAccountModal();
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const localUserAccountOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        showUpdateLocalUserAccountModal();
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
    () => [120, localUserAccountOptions.length * 80 + 70],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteLocalUserAccount = async () => {
    try {
      await deleteLocalUserAccountMutation.mutateAsync({
        id: focusedItem.id,
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
          {'Account options'}
        </Text>
        <OptionsList options={localUserAccountOptions} />
      </BottomSheetView>
    );
  };

  const renderItem = ({item}) => {
    return (
      <LocalUserAccountListItem
        item={item}
        showOptionButton={authUser?.is_root_account ? true : false}
        onPressItem={() => {
          setFocusedItem(() => item);

          if (viewMode === 'list') {
            showUpdateLocalUserAccountModal();
          }

          if (viewMode === 'manage-users') {
            showUpdateLocalUserAccountModal();
          }
        }}
        onPressItemOptions={() => {
          setFocusedItem(() => item);
          openOptionsBottomSheet();
        }}
      />
    );
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

  return (
    <>
      <Portal>
        <Modal
          visible={updateLocalUserAccountModalVisible}
          onDismiss={() => setUpdateLocalUserAccountModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Local User Account
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <LocalUserAccountForm
              editMode={true}
              userAccountUID={focusedItem?.account_uid}
              authUser={authUser}
              initialValues={{
                first_name: focusedItem?.first_name || '',
                last_name: focusedItem?.last_name || '',
                email: focusedItem?.email || '',
                role_id: focusedItem?.role_id || '',
              }}
              submitButtonTitle="Update"
              onSubmit={handleSubmit}
              onCancel={handleCancel}
            />
          </ScrollView>
        </Modal>
      </Portal>
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
          <Dialog.Title>Delete local user account?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete user account? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteLocalUserAccount}
              color={colors.notification}>
              Delete user
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setErrorMessage(() => '');
        }}
      />

      <FlatList
        style={{backgroundColor: colors.surface}}
        data={getAllPagesData()}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <View
            style={{
              flex: 1,
              padding: 20,
              justifyContent: 'center',
              alignItems: 'center',
            }}>
            <Text>No data to display</Text>
          </View>
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
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
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default LocalUserAccountList;
