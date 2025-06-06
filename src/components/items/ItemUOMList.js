import React, {useState, useEffect, useRef, useCallback, useMemo} from 'react';
import {
  StyleSheet,
  Text,
  View,
  FlatList,
  Pressable,
  TouchableOpacity,
  BackHandler,
} from 'react-native';
import {useNavigation} from '@react-navigation/native';
import {Button, useTheme} from 'react-native-paper';
import convert from 'convert-units';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import ItemUOMListItem from './ItemUOMListItem';
import routes from '../../constants/routes';
import {addUnit} from '../../localData/units';

const camelCaseToTitleCase = text => {
  const result = text.replace(/([A-Z])/g, ' $1');
  return result.charAt(0).toUpperCase() + result.slice(1);
};

const ItemUOMList = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [focusedItem, setFocusedItem] = useState(null);
  const measures = ['mass', 'volume', 'each'];
  const queryClient = useQueryClient();
  const addUnitMutation = useMutation(addUnit, {
    onSuccess: () => {
      queryClient.invalidateQueries('units');
    },
  });

  let labels = [];
  let groupedUnitsWithLabel = [];

  for (let measure of measures) {
    labels.push({isLabel: true, title: measure});
  }

  for (let label of labels) {
    groupedUnitsWithLabel.push(label);
    groupedUnitsWithLabel = [
      ...groupedUnitsWithLabel,
      ...convert().list(label.title),
    ];
  }

  const renderItem = ({item}) => {
    if (item.isLabel) {
      return (
        <View
          style={{
            flex: 1,
            paddingVertical: 10,
            paddingHorizontal: 15,
            backgroundColor: colors.neutralTint5,
          }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {camelCaseToTitleCase(item.title)}
          </Text>
        </View>
      );
    }

    return (
      <ItemUOMListItem
        item={item}
        onPressItem={async () => {
          setFocusedItem(() => item);
          try {
            await addUnitMutation.mutateAsync({
              unit: item,
            });
          } catch (error) {
            console.debug(error);
          } finally {
            navigation.goBack();
          }
        }}
      />
    );
  };

  return (
    <FlatList
      style={{backgroundColor: colors.surface}}
      data={groupedUnitsWithLabel}
      keyExtractor={item => item.abbr}
      renderItem={renderItem}
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
    />
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

export default ItemUOMList;
