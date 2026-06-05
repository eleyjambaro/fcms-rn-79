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
  TextInput,
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
  useQuery,
  useInfiniteQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';
import moment from 'moment';

import {revenues} from '../../__dummyData';
import RevenueGroupListItem from './RevenueGroupListItem';
import routes from '../../constants/routes';
import GrandTotal from '../purchases/GrandTotal';
import ManageListButton from '../buttons/ManageListButton';
import ListLoadingFooter from '../../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import ListEmpty from '../../components/stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import OptionsList from '../buttons/OptionsList';
import {
  createRevenue,
  createRevenueGroup,
  deleteRevenue,
  deleteRevenueGroup,
  getRevenueCategoryNames,
  getRevenueGroups,
  getRevenueGroupsGrandTotal,
  getRevenueSources,
  updateRevenue,
  updateRevenueGroup,
} from '../../localDbQueries/revenues';
import RevenueForm from '../forms/RevenueForm';
import RevenueGroupForm from '../forms/RevenueGroupForm';
import ErrorMessageModal from '../modals/ErrorMessageModal';
import useRoleAccess from '../../hooks/useRoleAccess';

const RevenueGroupList = props => {
  const {backAction, viewMode = 'list', dateFilter, highlightedItemId} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {can} = useRoleAccess();
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
  } = useInfiniteQuery(['revenueGroups', {dateFilter}], getRevenueGroups, {
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
  const {
    status: revenueGroupsGrandTotalStatus,
    data: revenueGroupsGrandTotalData,
  } = useQuery(
    ['revenueGroupsGrandTotal', {dateFilter}],
    getRevenueGroupsGrandTotal,
  );
  const {status: revenueCategoryNamesStatus, data: revenueCategoryNamesData} =
    useQuery(
      ['revenueCategoryNames', {id: focusedItem?.id}],
      getRevenueCategoryNames,
      {enabled: focusedItem ? true : false},
    );
  const createRevenueGroupMutation = useMutation(createRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
    },
  });
  const updateRevenueGroupMutation = useMutation(updateRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
    },
  });
  const deleteRevenueGroupMutation = useMutation(deleteRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
    },
  });

  // Distinct sub-key ('picker') from the manage list's infinite query
  // ('manage') so the two don't share a cache entry with incompatible shapes —
  // both still match invalidateQueries('revenueSources') by prefix.
  const {data: revenueSourcesData} = useQuery(
    ['revenueSources', {scope: 'picker'}],
    getRevenueSources,
  );
  const revenueSources = revenueSourcesData?.result || [];

  const createRevenueMutation = useMutation(createRevenue, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
      queryClient.invalidateQueries('revenues');
      queryClient.invalidateQueries('revenueEntries');
    },
  });
  const updateRevenueMutation = useMutation(updateRevenue, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
      queryClient.invalidateQueries('revenues');
      queryClient.invalidateQueries('revenueEntries');
    },
  });
  const deleteRevenueMutation = useMutation(deleteRevenue, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
      queryClient.invalidateQueries('revenueGroupsGrandTotal');
      queryClient.invalidateQueries('revenues');
      queryClient.invalidateQueries('revenueEntries');
    },
  });

  const [createRevenueGroupModalVisible, setCreateRevenueGroupModalVisible] =
    useState(false);
  const [updateRevenueGroupModalVisible, setUpdateRevenueGroupModalVisible] =
    useState(false);

  const [createRevenueModalVisible, setCreateRevenueModalVisible] =
    useState(false);
  // The external-revenue entry currently being edited (null = adding a new one).
  const [editingEntry, setEditingEntry] = useState(null);
  // The external-revenue entry pending deletion.
  const [focusedEntry, setFocusedEntry] = useState(null);

  const [deleteRevenueDialogVisible, setDeleteRevenueDialogVisible] =
    useState(false);
  const [deleteRevenueGroupDialogVisible, setDeleteRevenueGroupDialogVisible] =
    useState(false);

  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const showCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(true);
  const hideCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(false);
  const showUpdateRevenueGroupModal = () =>
    setUpdateRevenueGroupModalVisible(true);
  const hideUpdateRevenueGroupModal = () =>
    setUpdateRevenueGroupModalVisible(false);

  const showCreateRevenueModal = () => setCreateRevenueModalVisible(true);
  const hideCreateRevenueModal = () => setCreateRevenueModalVisible(false);

  const showDeleteRevenueDialog = () => setDeleteRevenueDialogVisible(true);
  const hideDeleteRevenueDialog = () => setDeleteRevenueDialogVisible(false);

  const showDeleteRevenueGroupDialog = () =>
    setDeleteRevenueGroupDialogVisible(true);
  const hideDeleteRevenueGroupDialog = () =>
    setDeleteRevenueGroupDialogVisible(false);

  const loadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const getAllPagesData = () => {
    let pagesData = [];

    if (data?.pages) {
      for (let page of data.pages) {
        pagesData.push(...page.result);
      }
    }

    return pagesData;
  };

  // The options bottom sheet is only used in manage-list mode. In the main
  // (list) view, per-source amounts are added/edited/deleted directly from the
  // accordion breakdown rows (see RevenueGroupListItem).
  const itemOptions = [
    ...(can('revenues.edit')
      ? [
          {
            label: `Update ${focusedItem?.name} revenue group`,
            icon: 'pencil-outline',
            handler: () => {
              showUpdateRevenueGroupModal();
              closeOptionsBottomSheet();
            },
          },
        ]
      : []),
    ...(can('revenues.delete')
      ? [
          {
            label: 'Delete',
            labelColor: colors.notification,
            icon: 'delete-outline',
            iconColor: colors.notification,
            handler: () => {
              showDeleteRevenueGroupDialog();
              closeOptionsBottomSheet();
            },
          },
        ]
      : []),
  ];

  const optionsBottomSheetModalRef = useRef(null);
  // Two options (update / delete group): 2 * 75 + 30 = 180.
  const optionsBottomSheetSnapPoints = useMemo(() => [120, 180], []);

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleConfirmDeleteRevenueGroup = async () => {
    try {
      await deleteRevenueGroupMutation.mutateAsync({
        id: focusedItem?.id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteRevenueGroupDialog();
    }
  };

  const handleConfirmDeleteRevenue = async () => {
    try {
      await deleteRevenueMutation.mutateAsync({
        id: focusedEntry?.id,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      hideDeleteRevenueDialog();
    }
  };

  // Accordion breakdown actions (list mode).
  const handleAddExternalRevenue = group => {
    setFocusedItem(() => group);
    setEditingEntry(() => null);
    showCreateRevenueModal();
  };

  const handleEditEntry = (group, entry) => {
    setFocusedItem(() => group);
    setEditingEntry(() => entry);
    showCreateRevenueModal();
  };

  const handleDeleteEntry = (group, entry) => {
    setFocusedItem(() => group);
    setFocusedEntry(() => entry);
    showDeleteRevenueDialog();
  };

  const handleManageSources = () => {
    hideCreateRevenueModal();
    navigation.navigate(routes.manageRevenueSources());
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
          {'Options'}
        </Text>
        <OptionsList options={itemOptions} />
      </BottomSheetView>
    );
  };

  const handleCancelCreateRevenueForm = () => {
    setEditingEntry(() => null);
    hideCreateRevenueModal();
  };

  const handleCancelCreateRevenueGroupForm = () => {
    hideCreateRevenueGroupModal();
  };

  const handleCancelUpdateRevenueGroupForm = () => {
    hideUpdateRevenueGroupModal();
  };

  const handleSubmitUpdateRevenueGroupForm = async (values, actions) => {
    console.log(values);

    try {
      await updateRevenueGroupMutation.mutateAsync({
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

    hideUpdateRevenueGroupModal();
  };

  const handleSubmitCreateRevenueForm = async (values, actions) => {
    try {
      if (editingEntry) {
        // Editing an existing per-source amount: only the amount changes.
        await updateRevenueMutation.mutateAsync({
          id: editingEntry.id,
          updatedValues: {amount: values.amount},
        });
      } else {
        await createRevenueMutation.mutateAsync({values});
      }
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      setEditingEntry(() => null);
      hideCreateRevenueModal();
    }
  };

  const handleSubmitCreateRevenueGroupForm = async (values, actions) => {
    console.log(values);
    try {
      await createRevenueGroupMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
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

    hideCreateRevenueGroupModal();
  };

  // TODO: Fix and implement this and display category names
  const renderRevenueCategoryNames = () => {
    if (revenueCategoryNamesStatus === 'loading') return null;
    if (revenueCategoryNamesStatus === 'error') return null;

    if (!revenueCategoryNamesData?.result?.length) {
      return null;
    }

    const categoryNames = revenueCategoryNamesData?.result;

    if (categoryNames.length > 1) {
      const lastCategoryName = categoryNames.pop();
      const categoryNamesCommaSeparated = categoryNames.join(', ');
      return (
        <Text>{categoryNamesCommaSeparated + ` and ${lastCategoryName}`}</Text>
      );
    } else {
      return <Text>{categoryNames[0]}</Text>;
    }
  };

  const renderItem = ({item}) => {
    return (
      <RevenueGroupListItem
        highlighted={item.id === highlightedItemId ? true : false}
        viewMode={viewMode}
        item={item}
        dateFilter={dateFilter}
        onPress={() => {
          setFocusedItem(() => item);
          if (viewMode === 'manage-list' && can('revenues.edit')) {
            showUpdateRevenueGroupModal();
          }
        }}
        onPressItemOptions={
          itemOptions.length === 0
            ? undefined
            : () => {
                setFocusedItem(() => item);
                openOptionsBottomSheet();
              }
        }
        onAddExternalRevenue={
          can('revenues.create') ? handleAddExternalRevenue : undefined
        }
        onEditEntry={can('revenues.edit') ? handleEditEntry : undefined}
        onDeleteEntry={can('revenues.delete') ? handleDeleteEntry : undefined}
      />
    );
  };

  const renderFooter = () => {
    if (isFetchingNextPage) {
      return <ListLoadingFooter />;
    }

    return null;
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

  const revenueGroups = getAllPagesData();

  const updateRevenueGroupFormInitialValues = {
    name: focusedItem?.name || '',
  };

  const revenueFormInitialValues = {
    revenue_group_id: focusedItem?.id?.toString() || '',
    revenue_group_date: dateFilter || '',
    revenue_source_id: editingEntry?.revenue_source_id?.toString() || '',
    amount: editingEntry?.amount?.toString() || '',
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createRevenueGroupModalVisible}
          onDismiss={hideCreateRevenueGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Revenue Group
          </Title>
          <RevenueGroupForm
            onSubmit={handleSubmitCreateRevenueGroupForm}
            onCancel={handleCancelCreateRevenueGroupForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={updateRevenueGroupModalVisible}
          onDismiss={hideUpdateRevenueGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Update Revenue Group
          </Title>
          <RevenueGroupForm
            initialValues={updateRevenueGroupFormInitialValues}
            revenueGroup={focusedItem}
            editMode
            autoFocus
            submitButtonTitle="Update"
            onSubmit={handleSubmitUpdateRevenueGroupForm}
            onCancel={handleCancelUpdateRevenueGroupForm}
          />
        </Modal>
      </Portal>
      <Portal>
        <Modal
          visible={createRevenueModalVisible}
          onDismiss={() => {
            setEditingEntry(() => null);
            setCreateRevenueModalVisible(() => false);
          }}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <View style={{alignItems: 'center', marginBottom: 20}}>
            <Title style={{textAlign: 'center'}}>
              {editingEntry
                ? `Edit ${focusedItem?.name} External Revenue`
                : `Add ${focusedItem?.name} External Revenue`}
            </Title>
            <Text style={{fontWeight: 'bold', color: colors.dark}}>
              {`${(dateFilter
                ? moment(dateFilter.split(' ')[0], 'YYYY-MM-DD')
                : moment()
              ).format('MMMM YYYY')}`}
            </Text>
          </View>
          <RevenueForm
            editMode={editingEntry ? true : false}
            revenue={editingEntry}
            sources={revenueSources}
            initialValues={revenueFormInitialValues}
            onSubmit={handleSubmitCreateRevenueForm}
            onCancel={handleCancelCreateRevenueForm}
            onManageSources={handleManageSources}
          />
        </Modal>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteRevenueGroupDialogVisible}
          onDismiss={hideDeleteRevenueGroupDialog}>
          <Dialog.Title>Delete revenue group?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Are you sure you want to delete revenue group? You can't undo this
              action.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteRevenueGroupDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteRevenueGroup}
              color={colors.notification}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <Portal>
        <Dialog
          visible={deleteRevenueDialogVisible}
          onDismiss={hideDeleteRevenueDialog}>
          <Dialog.Title>Delete external revenue?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Are you sure you want to delete ${
                focusedEntry?.revenue_source_name
                  ? focusedEntry.revenue_source_name + ' '
                  : ''
              }external revenue${
                focusedItem?.name ? ` for ${focusedItem.name}` : ''
              } for the month of ${(focusedEntry?.revenue_group_date
                ? moment(
                    focusedEntry.revenue_group_date.split(' ')[0],
                    'YYYY-MM-DD',
                  )
                : moment()
              ).format('MMMM YYYY')}? You can't undo this action.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={hideDeleteRevenueDialog}>Cancel</Button>
            <Button
              icon={'delete-outline'}
              onPress={handleConfirmDeleteRevenue}
              color={colors.notification}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <FlatList
        style={{backgroundColor: colors.surface}}
        data={revenueGroups}
        renderItem={renderItem}
        onEndReached={loadMore}
        onEndReachedThreshold={0.3}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={
          <ListEmpty
            actions={[
              {
                label: 'Create revenue group',
                handler: () => {
                  showCreateRevenueGroupModal();
                },
              },
            ]}
          />
        }
        refreshControl={
          <RefreshControl
            refreshing={isRefetching && !isFetchingNextPage}
            onRefresh={refetch}
            colors={[colors.primary, colors.accent, colors.dark]}
          />
        }
      />
      {viewMode === 'list' && revenueGroups.length > 0 && (
        <ManageListButton
          label="Manage revenue group list"
          onPress={() => navigation.navigate(routes.manageRevenueGroups())}
        />
      )}
      {viewMode === 'list' && (
        <ManageListButton
          label="Manage external revenue sources"
          onPress={() => navigation.navigate(routes.manageRevenueSources())}
        />
      )}
      {viewMode === 'list' && (
        <GrandTotal value={revenueGroupsGrandTotalData || 0} />
      )}
      {can('revenues.create') ? (
        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            icon="plus"
            onPress={showCreateRevenueGroupModal}>
            Create New Revenue Group
          </Button>
        </View>
      ) : null}
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

export default RevenueGroupList;
