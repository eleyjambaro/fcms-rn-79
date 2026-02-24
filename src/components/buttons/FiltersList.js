import React from 'react';
import {StyleSheet, FlatList} from 'react-native';
import {Chip, useTheme} from 'react-native-paper';
import {NativeViewGestureHandler} from 'react-native-gesture-handler';

const FiltersList = props => {
  const {filters = [], containerStyle, value = '', onChange} = props;
  const {colors} = useTheme();

  const handlePress = (value, label) => {
    onChange && onChange(value, label);
  };

  const renderItem = ({item: filter}) => {
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
  };

  return (
    <NativeViewGestureHandler disallowInterruption={true}>
      <FlatList
        data={filters}
        renderItem={renderItem}
        keyExtractor={item => item.label}
        horizontal
        showsHorizontalScrollIndicator={false}
        style={[styles.container, containerStyle]}
        contentContainerStyle={styles.contentContainer}
        disableIntervalMomentum
        bounces={false}
      />
    </NativeViewGestureHandler>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: 10,
  },
  contentContainer: {
    alignItems: 'center',
    gap: 10,
  },
  itemContainer: {
    height: 35,
    backgroundColor: 'white',
  },
});

export default FiltersList;
