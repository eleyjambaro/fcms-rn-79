import React, {useState, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {Chip, useTheme} from 'react-native-paper';

const SelectionButtonList = props => {
  const {
    selections = [],
    containerStyle,
    selectMany = false,
    defaultValue,
    onChange,
  } = props;
  const {colors} = useTheme();
  const emptyDefaultValue = selectMany ? [] : '';
  const [value, setValue] = useState(
    defaultValue ? defaultValue : emptyDefaultValue,
  );

  useEffect(() => {
    onChange && onChange(value);
  }, [value]);

  const handlePress = newValue => {
    setValue(currentValue => {
      if (selectMany) {
        if (currentValue.includes(newValue)) {
          return currentValue.filter(
            selectedValue => selectedValue !== newValue,
          );
        } else {
          return [...currentValue, newValue];
        }
      }

      return newValue;
    });
  };

  const isSelected = currentSelectionValue => {
    if (selectMany) {
      if (value.includes(currentSelectionValue)) {
        return true;
      } else {
        return false;
      }
    }

    if (value === currentSelectionValue) {
      return true;
    } else {
      return false;
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      {selections.map(selection => {
        return (
          <Chip
            key={selection.label}
            selected={isSelected(selection.value)}
            onPress={() => {
              handlePress(selection.value);
              selection.handler && selection.handler();
            }}
            style={[
              styles.itemContainer,
              {borderColor: colors.neutralTint3},
              isSelected(selection.value) && {backgroundColor: colors.accent},
            ]}
            textStyle={[value === selection.value && {fontWeight: 'bold'}]}
            mode="outlined">
            {selection.label}
          </Chip>
        );
      })}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 10,
  },
  itemContainer: {
    marginRight: 10,
    marginBottom: 10,
    backgroundColor: 'white',
  },
});

export default SelectionButtonList;
