import React from 'react';
import {StyleSheet, ScrollView} from 'react-native';
import {Chip, useTheme} from 'react-native-paper';

const FiltersList = props => {
  const {filters = [], containerStyle, value = '', onChange} = props;
  const {colors} = useTheme();

  const handlePress = (value, label) => {
    onChange && onChange(value, label);
  };

  return (
    <ScrollView
      style={[styles.container, containerStyle]}
      horizontal
      showsHorizontalScrollIndicator={false}>
      {filters.map(filter => {
        return (
          <Chip
            key={filter.label}
            onPress={() => {
              handlePress(filter.value, filter.label);
              filter.handler && filter.handler();
            }}
            icon={filter.icon ? `${filter.icon}` : undefined}
            style={[
              styles.itemContainer,
              {
                borderColor: filter?.disabled
                  ? colors.disabled
                  : colors.neutralTint3,
              },
              value === filter.value && {backgroundColor: colors.accent},
            ]}
            disabled={filter?.disabled}
            textStyle={[value === filter.value && {fontWeight: 'bold'}]}
            mode="outlined">
            {filter.label || ''}
          </Chip>
        );
      })}
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
    flexDirection: 'row',
  },
  itemContainer: {
    height: 35,
    marginRight: 10,
    backgroundColor: 'white',
  },
});

export default FiltersList;
