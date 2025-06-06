import React, {useState} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {
  FAB,
  Button,
  Modal,
  Title,
  TextInput,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';

import routes from '../constants/routes';
import ItemList from '../components/items/ItemList';
import PurchaseCategoryList from '../components/purchases/PurchaseCategoryList';
import useSearchbarContext from '../hooks/useSearchbarContext';
import CategoryList from '../components/categories/CategoryList';

const TopTab = createMaterialTopTabNavigator();

function PurchaseCategories(props) {
  const {navigation} = props;
  const [searchQuery, setSearchQuery] = useState('');
  const [createCategoryModalVisible, setCreateCategoryModalVisible] =
    useState(false);
  const {colors} = useTheme();

  const onChangeSearch = query => setSearchQuery(query);

  const handleFabPress = () => {
    setCreateCategoryModalVisible(() => true);
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createCategoryModalVisible}
          onDismiss={() => setCreateCategoryModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Category
          </Title>
          <TextInput label="Name (e.g. Beverage)" />
          <Button
            mode="contained"
            onPress={() => setCreateCategoryModalVisible(() => false)}
            style={{marginTop: 20}}>
            Create
          </Button>
          <Button
            onPress={() => setCreateCategoryModalVisible(() => false)}
            style={{marginTop: 10}}>
            Cancel
          </Button>
        </Modal>
      </Portal>
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search category"
            onChangeText={onChangeSearch}
            value={searchQuery}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <CategoryList viewMode="purchases" />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" icon="plus" onPress={handleFabPress}>
            Create Category
          </Button>
        </View>
      </View>
    </>
  );
}

const AllItems = props => {
  const {navigation} = props;
  const {colors} = useTheme();
  const {keyword, setKeyword} = useSearchbarContext();

  const onChangeSearch = keyword => setKeyword(keyword);

  const handlePressScanBarcode = () => {
    navigation.navigate('ScanBarcode');
  };

  const handleFabPress = () => {
    navigation.navigate('AddItem');
  };

  return (
    <View style={{flex: 1}}>
      <View style={{flexDirection: 'row', padding: 5}}>
        <Searchbar
          placeholder="Search item"
          onChangeText={onChangeSearch}
          value={keyword}
          style={{flex: 1}}
        />
        <Pressable
          onPress={handlePressScanBarcode}
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

      <View style={{flex: 1}}>
        <ItemList viewMode="purchases" />
      </View>

      <View
        style={{
          backgroundColor: 'white',
          padding: 10,
        }}>
        <Button mode="contained" icon="plus" onPress={handleFabPress}>
          Register Item
        </Button>
      </View>
    </View>
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

const ItemsTab = () => {
  const {colors} = useTheme();

  return (
    <TopTab.Navigator
      screenOptions={() => ({
        tabBarStyle: {
          elevation: 0,
          borderBottomWidth: 2,
          borderColor: colors.neutralTint5,
        },
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.dark,
        tabBarPressColor: colors.primary,
        tabBarIndicatorStyle: {
          backgroundColor: colors.primary,
          height: 3,
        },
        tabBarLabelStyle: {
          textTransform: 'none',
          fontWeight: '500',
          fontSize: 14,
        },
      })}>
      <TopTab.Screen
        name={routes.purchaseCategories()}
        options={{tabBarLabel: 'Categories'}}
        component={PurchaseCategories}
      />
      <TopTab.Screen
        name="AllItems"
        options={{tabBarLabel: 'All Items'}}
        component={AllItems}
      />
    </TopTab.Navigator>
  );
};

export default ItemsTab;
