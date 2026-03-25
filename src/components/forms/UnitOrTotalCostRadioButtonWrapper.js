import {StyleSheet, View} from 'react-native';
import React from 'react';
import InputHeading from './InputHeading';
import {useTheme} from 'react-native-paper';

const UnitOrTotalCostRadioButtonWrapper = props => {
  const {
    children,
    inputHeadingText = 'Enter either Unit Cost or Total Cost',
    containerStyle,
  } = props;
  const {colors} = useTheme();

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
        {inputHeadingText}
      </InputHeading>
      {children}
    </View>
  );
};

export default UnitOrTotalCostRadioButtonWrapper;

const styles = StyleSheet.create({});
