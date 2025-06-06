import React from 'react';
import {useTheme} from 'react-native-paper';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';

import Categories from '../screens/Categories';
import Items from '../screens/Items';
import InventoryHeader from '../components/headers/InventoryHeader';

const TopTab = createMaterialTopTabNavigator();

const ItemsTab = props => {
  const {viewMode, listItemDisplayMode} = props;
  const {colors} = useTheme();

  return (
    <>
      <InventoryHeader />
      <TopTab.Navigator
        screenOptions={() => ({
          tabBarScrollEnabled: true,
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
        <TopTab.Screen name="Categories">
          {props => <Categories {...props} viewMode={viewMode} />}
        </TopTab.Screen>
        <TopTab.Screen name="AllItems" options={{tabBarLabel: 'All Items'}}>
          {props => (
            <Items
              {...props}
              viewMode={viewMode}
              listItemDisplayMode={listItemDisplayMode}
            />
          )}
        </TopTab.Screen>
        <TopTab.Screen
          name="FinishedProducts"
          options={{tabBarLabel: 'Finished Products'}}>
          {props => (
            <Items
              {...props}
              filter={{'items.is_finished_product': 1}}
              viewMode={viewMode}
              listItemDisplayMode={listItemDisplayMode}
              showScanBarcodeButton={false}
            />
          )}
        </TopTab.Screen>
      </TopTab.Navigator>
    </>
  );
};

export default ItemsTab;
