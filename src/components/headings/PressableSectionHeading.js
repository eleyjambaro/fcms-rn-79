import React, {useState, useEffect} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {Text, Switch, useTheme} from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const PressableSectionHeading = props => {
  const {
    containerStyle,
    headingText = '',
    icon = 'chevron-right',
    iconSize = 35,
    iconVisible = true,
    disabled = false,
    onPress,
  } = props;
  const {colors} = useTheme();

  const renderIcon = () => {
    if (iconVisible) {
      return (
        <MaterialIcons
          name={icon}
          size={iconSize}
          disabled={disabled}
          style={{marginLeft: 'auto'}}
          color={colors.dark}
          {...props}
        />
      );
    }
  };

  return (
    <Pressable style={[styles.container, containerStyle]} onPress={onPress}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
        }}>
        {headingText}
      </Text>
      {renderIcon()}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',

    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: '#d4d4d4',
    borderStyle: 'dotted',
  },
});

export default PressableSectionHeading;
