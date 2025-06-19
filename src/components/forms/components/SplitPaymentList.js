import {StyleSheet, Text, View, Pressable} from 'react-native';
import React, {useState} from 'react';
import commaNumber from 'comma-number';
import {TextInput, useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {Dropdown} from 'react-native-paper-dropdown';

import useCurrencySymbol from '../../../hooks/useCurrencySymbol';
import {extractNumber, formatUOMAbbrev} from '../../../utils/stringHelpers';

const SplitPaymentList = props => {
  const {
    containerStyle,
    listItems,
    listItemKey,
    onPressItem,
    onPressDeleteListItem,
    handleChangeListItemValue,
    displayDeleteListItemButton = false,
  } = props;
  const currencySymbol = useCurrencySymbol();
  const [showDropDown, setShowDropDown] = useState(null);
  const {colors} = useTheme();

  if (!listItems?.length) return null;

  const paymentMethods = [
    {name: 'Cash', value: 'cash'},
    {name: 'Card', value: 'card'},
  ];

  const paymentMethodSelectionList = paymentMethods?.map(paymentMethod => {
    return {
      label: `${paymentMethod.name}`,
      value: `${paymentMethod.value}`,
    };
  });

  const list = listItems.map((listItem, index) => {
    return (
      <Pressable
        onPress={() => onPressItem && onPressItem(listItem, index)}
        key={listItem[listItemKey] || index}
        style={[styles.listItem, {borderColor: colors.neutralTint2}]}>
        <View style={{flex: 1}}>
          <View style={{flexDirection: 'row'}}>
            <View
              style={{
                backgroundColor: colors.neutralTint5,
                borderRadius: 5,
                padding: 15,
                marginRight: 3,
                marginBottom: 3,
              }}>
              <MaterialCommunityIcons
                name={
                  listItem.payment_method === 'card'
                    ? 'credit-card-outline'
                    : 'cash-multiple'
                }
                size={30}
                color={'black'}
                style={{marginLeft: 'auto'}}
              />
            </View>
            <View style={{flex: 1}}>
              <Dropdown
                mode={'flat'}
                visible={showDropDown === listItem.id}
                showDropDown={() => setShowDropDown(() => listItem.id)}
                onDismiss={() => setShowDropDown(null)}
                value={listItem.payment_method}
                hideMenuHeader
                onSelect={value => {
                  let updatedListItem = {
                    ...listItem,
                    payment_method: value,
                  };

                  handleChangeListItemValue(updatedListItem);
                }}
                options={paymentMethodSelectionList}
                activeColor={colors.accent}
                dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
                inputProps={{disabled: false}}
              />
            </View>
          </View>
          <TextInput
            label="Amount"
            onChangeText={value => {
              const extractedValue = extractNumber(value);
              const amount = extractedValue ? parseFloat(extractedValue) : '';

              let updatedListItem = {
                ...listItem,
                payment_amount: amount,
              };

              handleChangeListItemValue &&
                handleChangeListItemValue(updatedListItem);
            }}
            onBlur={() => {}}
            value={commaNumber(listItem?.payment_amount)?.toString() || ''}
            keyboardType="numeric"
          />
        </View>

        {displayDeleteListItemButton && (
          <Pressable
            style={styles.deleteOptionButtonContainer}
            onPress={() =>
              onPressDeleteListItem && onPressDeleteListItem(listItem, index)
            }>
            <MaterialCommunityIcons
              name="delete-forever"
              size={25}
              color={colors.dark}
            />
          </Pressable>
        )}
      </Pressable>
    );
  });

  return <View style={[styles.container, containerStyle]}>{list}</View>;
};

export default SplitPaymentList;

const styles = StyleSheet.create({
  container: {},
  listItem: {
    flexDirection: 'row',
    marginTop: -1,
    alignItems: 'center',
    paddingVertical: 20,
    paddingLeft: 15,
    paddingRight: 10,
    borderTopWidth: 1,
    borderBottomWidth: 1,
  },
  deleteOptionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 5,
  },
});
