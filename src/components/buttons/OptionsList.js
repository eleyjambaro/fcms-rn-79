import React from 'react';
import {StyleSheet} from 'react-native';
import {List, useTheme} from 'react-native-paper';

const OptionsList = props => {
  const {options = [], optionOnPressHandlerProps = {}} = props;
  const {colors} = useTheme();

  if (!options?.length) return null;

  return (
    <>
      {options.map(option => {
        return (
          <List.Item
            disabled={option.disabled}
            key={option.label}
            title={option.label}
            titleStyle={{
              color: option.disabled ? colors.disabled : option.labelColor,
            }}
            onPress={() =>
              option.handler && option.handler(optionOnPressHandlerProps)
            }
            left={props => (
              <List.Icon
                {...props}
                color={option.iconColor}
                icon={option.icon}
              />
            )}
          />
        );
      })}
    </>
  );
};

const styles = StyleSheet.create({
  container: {},
});

export default OptionsList;
