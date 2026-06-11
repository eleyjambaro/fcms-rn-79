import React from 'react';
import {StyleSheet, View} from 'react-native';
import {RadioButton, Text, useTheme} from 'react-native-paper';

import InputHeading from './InputHeading';

/**
 * Two-option radio toggle that lets the user choose how an item's selling price
 * is set: a single "Input Unit Selling Price" (writes items.unit_selling_price)
 * or "Add Selling Size Option" (per-size modifier_options). Mirrors the
 * cost_input_mode RadioButton.Group / UnitOrTotalCostRadioButtonWrapper pattern
 * used for the Unit Cost vs Total Cost choice in ItemForm.
 *
 * The presence of selling size options is the real source of truth in the POS
 * (item_modifier_options_count > 0 wins); this selector only drives which input
 * the user fills. Reused by the Add Item form and the Edit-mode Size Options
 * screen.
 */
const SellingPriceModeSelector = ({value, onChange, disabled, containerStyle}) => {
  const {colors} = useTheme();

  const rows = [
    {
      value: 'unit_price',
      label: 'Input Unit Selling Price',
      description: 'Sell at a single price per unit.',
    },
    {
      value: 'size_options',
      label: 'Add Selling Size Option',
      description: 'Sell by custom size/quantity options, each with its own price.',
    },
  ];

  return (
    <View
      style={[
        {
          marginVertical: 15,
          paddingTop: 10,
          paddingBottom: 5,
          paddingHorizontal: 5,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.neutralTint2,
          borderRadius: 15,
        },
        containerStyle,
      ]}>
      <InputHeading containerStyle={{marginBottom: 15}}>
        {'How would you like to set the selling price?'}
      </InputHeading>
      <RadioButton.Group
        onValueChange={newValue => {
          if (disabled || newValue === value) return;
          onChange?.(newValue);
        }}
        value={value}>
        {rows.map(row => (
          <View key={row.value} style={styles.row}>
            <View style={styles.textColumn}>
              <Text style={[styles.label, {color: colors.dark}]}>
                {row.label}
              </Text>
              <Text style={[styles.description, {color: colors.neutralTint1}]}>
                {row.description}
              </Text>
            </View>
            <View style={styles.radioColumn}>
              <RadioButton
                value={row.value}
                color={colors.primary}
                disabled={disabled}
              />
            </View>
          </View>
        ))}
      </RadioButton.Group>
    </View>
  );
};

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  textColumn: {
    flex: 1,
    paddingLeft: 10,
  },
  label: {
    fontSize: 15,
    fontWeight: '600',
  },
  description: {
    fontSize: 12,
    marginTop: 2,
  },
  radioColumn: {
    paddingHorizontal: 5,
  },
});

export default SellingPriceModeSelector;
