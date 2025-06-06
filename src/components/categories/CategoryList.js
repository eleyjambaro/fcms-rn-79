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
import {BottomSheetModal, BottomSheetBackdrop} from '@gorhom/bottom-sheet';
import {
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import {categories} from '../../__dummyData';
import CategoryListItem from './CategoryListItem';
import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import {
  getCategories,
  deleteCategory,
  updateCategory,
} from '../../localDbQueries/categories';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import CategoryForm from '../forms/CategoryForm';
import ErrorMessageModal from '../modals/ErrorMessageModal';

const CategoryList = props => {
  const {backAction, viewMode, filter} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
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
  } = useInfiniteQuery(['categories', {filter}], getCategories, {
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
  const updateCategoryMutation = useMutation(updateCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
  const deleteCategoryMutation = useMutation(deleteCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });

  const [updateCategoryModalVisible, setUpdateCategoryModalVisible] =
    useState(false);
  const [deleteDialogVisible, setDeleteDialogVisible] = useState(false);

  const [formErrorMessage, setFormErrorMessage] = useState('');

  const showUpdateCategoryModal = () => setUpdateCategoryModalVisible(true);
  const hideUpdateCategoryModal = () => setUpdateCategoryModalVisible(false);

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
    hideUpdateCategoryModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await updateCategoryMutation.mutateAsync({
        id: focusedItem?.id,
        updatedValues: values,
        onFormValidationError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }

    hideUpdateCategoryModal();
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
  };

  const categoryOptions = [
    {
      label: 'Edit',
      icon: 'pencil-outline',
      handler: () => {
        showUpdateCategoryModal();
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
    () => [120, categoryOptions.length * 80 + 70],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteCategory = async () => {
    try {
      await deleteCategoryMutation.mutateAsync({
        id: focusedItem.id,
        onError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
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
      <View style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Category options'}
        </Text>
        <OptionsList options={categoryOptions} />
      </View>
    );
  };

  const renderItem = ({item}) => {
    return (
      <CategoryListItem
        item={item}
        onPressItem={() => {
          setFocusedItem(() => item);

          if (viewMode === 'purchases') {
            navigation.navigate(routes.purchaseCategoryView(), {
              category_id: item.id,
            });
          } else if (viewMode === 'manage-categories') {
            showUpdateCategoryModal();
          } else {
            navigation.navigate(routes.categoryView(), {
              category_id: item.id,
            });
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
          visible={updateCategoryModalVisible}
          onDismiss={() => setUpdateCategoryModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Category
          </Title>
          <CategoryForm
            editMode={true}
            initialValues={{name: focusedItem?.name || ''}}
            submitButtonTitle="Update"
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog visible={deleteDialogVisible} onDismiss={hideDeleteDialog}>
          <Dialog.Title>Delete category?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete category? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteCategory}
              color={colors.notification}>
              Delete category
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
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

export default CategoryList;
