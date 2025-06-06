import React, {useState, useEffect} from 'react';
import {StyleSheet, ScrollView} from 'react-native';
import {Chip, useTheme} from 'react-native-paper';

const FiltersList = props => {
  const {filters = [], containerStyle, value = '', onChange} = props;
  const {colors} = useTheme();
  const [currentValue, setCurrentValue] = useState(value);
  const [currentLabel, setCurrentLabel] = useState('');

  useEffect(() => {
    onChange && onChange(currentValue, currentLabel);
  }, [value, currentValue]);

  const handlePress = (value, label) => {
    setCurrentValue(() => setCurrentValue(value));
    setCurrentLabel(() => setCurrentLabel(label));
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
            // selected={value === filter.value ? true : false}
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
              currentValue === filter.value && {backgroundColor: colors.accent},
            ]}
            disabled={filter?.disabled}
            textStyle={[currentValue === filter.value && {fontWeight: 'bold'}]}
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
