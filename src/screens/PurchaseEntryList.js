import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {
  Button,
  useTheme,
  Paragraph,
  Dialog,
  Portal,
  Provider,
  Modal,
  Title,
  Searchbar,
  FAB,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import FiltersList from '../components/buttons/FiltersList';
import PurchaseList from '../components/purchases/PurchaseList';
import {useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import {
  getCategories,
  deleteCategory,
  updateCategory,
} from '../localDbQueries/categories';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {getCurrentBatchPurchaseGroupId} from '../localDbQueries/batchPurchase';

const Purchases = props => {
  const {navigation, route} = props;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();
  const {
    status: getCurrentBatchPurchaseGroupIdStatus,
    data: getCurrentBatchPurchaseGroupIdData,
  } = useQuery(['currentBatchPurchaseGroupId'], getCurrentBatchPurchaseGroupId);
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {limit: 10000000000}],
    getCategories,
  );
  const [itemListFilters, setItemListFilters] = useState({
    'items.category_id': '',
    'operations.id': '',
    '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
  });
  const [currentCategory, setCurrentCategory] = useState('');

  const [successDialogVisible, setSuccessDialogVisible] = useState(false);

  const showSuccessDialog = () => setSuccessDialogVisible(true);
  const hideSuccessDialog = () => setSuccessDialogVisible(false);

  const onChangeSearch = keyword => {
    setKeyword(keyword);

    setItemListFilters(currentValues => {
      return {
        ...currentValues,
        '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
      };
    });
  };

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  useEffect(() => {
    if (route.params?.batchPurchaseSuccess) {
      showSuccessDialog();
    }
  }, [route.params?.batchPurchaseSuccess]);

  const handleCategoryFilterChange = (categoryId, categoryLabel) => {
    setItemListFilters(currentValues => {
      return {
        ...currentValues,
        'items.category_id': categoryId,
      };
    });

    setCurrentCategory(() => categoryLabel);
  };

  if (
    getCurrentBatchPurchaseGroupIdStatus === 'loading' ||
    categoriesStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    getCurrentBatchPurchaseGroupIdStatus === 'error' ||
    categoriesStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const currentBatchPurchaseGroupId = getCurrentBatchPurchaseGroupIdData;
  const categories = categoriesData.result;

  if (!categories) return null;

  const categoryFilterSelections = categories.map(category => {
    return {
      label: category.name,
      value: category.id,
    };
  });

  categoryFilterSelections.unshift({
    label: 'All',
    value: '',
  });

  return (
    <>
      <Portal>
        <Dialog visible={successDialogVisible} onDismiss={hideSuccessDialog}>
          <Dialog.Title>Batch Entries Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Your purchases have been successfully logged and made changes to
              your inventory
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                hideSuccessDialog();
              }}>
              Close
            </Button>
            <Button
              onPress={() => {
                navigation.navigate(routes.logs());
                hideSuccessDialog();
              }}
              color={colors.accent}>
              View Logs
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <View style={{flex: 1}}>
        <View style={{padding: 5, width: '100%'}}>
          <View style={{flexDirection: 'row'}}>
            <Searchbar
              placeholder="Search item"
              onChangeText={onChangeSearch}
              value={keyword}
              style={{flex: 1}}
            />
            <Pressable
              style={{
                justifyContent: 'center',
                alignItems: 'center',
                paddingHorizontal: 10,
              }}>
              <MaterialCommunityIcons
                name="barcode-scan"
                size={25}
                color={colors.dark}
                style={{marginLeft: 'auto'}}
              />
            </Pressable>
          </View>
        </View>
        <View>
          <FiltersList
            filters={categoryFilterSelections}
            value={itemListFilters['items.category_id']}
            onChange={handleCategoryFilterChange}
            containerStyle={{marginTop: 5, marginBottom: 8}}
          />
        </View>
        <PurchaseList
          filter={itemListFilters}
          currentBatchPurchaseGroupId={currentBatchPurchaseGroupId}
          currentCategory={currentCategory}
        />
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

export default Purchases;
