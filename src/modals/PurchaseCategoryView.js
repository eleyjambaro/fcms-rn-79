import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {FAB, Button, Searchbar, useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useRoute} from '@react-navigation/native';
import {
  Tabs,
  TabScreen,
  useTabIndex,
  useTabNavigation,
} from 'react-native-paper-tabs';
import {useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import {categories} from '../__dummyData';
import ItemList from '../components/items/ItemList';
import CategoryDetails from '../components/categories/CategoryDetails';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import Entries from '../components/purchases/Entries';
import {getCategory} from '../localDbQueries/categories';
import useSearchbarContext from '../hooks/useSearchbarContext';

function PurchaseCategoryView(props) {
  const {navigation} = props;
  const [searchQuery, setSearchQuery] = useState('');
  const {colors} = useTheme();
  const route = useRoute();
  const categoryId = route.params?.category_id;
  const {status, data} = useQuery(['category', {id: categoryId}], getCategory);
  const {keyword, setKeyword} = useSearchbarContext();

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handlePressRegisterItem = () => {
    navigation.navigate(routes.addItem(), {category_id: categoryId});
  };

  if (!categoryId) return null;

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

  const category = data.result;

  if (!category) return null;

  return (
    <View style={styles.container}>
      <CategoryDetails category={category} containerStyle={{marginBottom: 5}} />
      <Tabs
        // defaultIndex={0} // default = 0
        uppercase={false} // true/false | default=true | labels are uppercase
        // showTextLabel={false} // true/false | default=false (KEEP PROVIDING LABEL WE USE IT AS KEY INTERNALLY + SCREEN READERS)
        // iconPosition // leading, top | default=leading
        style={{
          backgroundColor: colors.surface,
        }} // works the same as AppBar in react-native-paper
        // dark={false} // works the same as AppBar in react-native-paper
        // theme={} // works the same as AppBar in react-native-paper
        // mode="scrollable" // fixed, scrollable | default=fixed
        // onChangeIndex={(newIndex) => {}} // react on index change
        // showLeadingSpace={true} //  (default=true) show leading space in scrollable tabs inside the header
        // disableSwipe={false} // (default=false) disable swipe to left/right gestures
      >
        <TabScreen label="Purchase Entries">
          <Entries
            entryType="purchase"
            filter={{
              'items.category_id': category.id,
              'operations.id': 2, // Operation id 2 is equal to: Add stock - New Purchase (inventory operation)
            }}
            viewMode="category-view"
          />
        </TabScreen>
        <TabScreen label="Items">
          <View style={{flex: 1}}>
            <View style={{flexDirection: 'row', padding: 5}}>
              <Searchbar
                placeholder={`Search ${category.name}`}
                onChangeText={onChangeSearch}
                value={keyword}
                style={{flex: 1}}
              />
            </View>
            <View style={{flex: 1, backgroundColor: colors.surface}}>
              <ItemList
                filter={{
                  category_id: categoryId,
                  '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
                }}
                viewMode="purchases"
              />
            </View>

            <View
              style={{
                backgroundColor: 'white',
                padding: 10,
              }}>
              <Button
                mode="contained"
                icon="plus"
                onPress={handlePressRegisterItem}>
                Register Item
              </Button>
            </View>
          </View>
        </TabScreen>
      </Tabs>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});

export default PurchaseCategoryView;
