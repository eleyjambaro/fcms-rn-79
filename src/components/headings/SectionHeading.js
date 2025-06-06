import React, {useState, useEffect} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {Text, Switch, useTheme} from 'react-native-paper';

const SectionHeading = props => {
  const {
    containerStyle,
    headingText = '',
    switchVisible = false,
    switchValue = false,
    switchDisabled = false,
    onSwitchValueChange,
  } = props;
  const {colors} = useTheme();

  const renderSwitch = () => {
    if (switchVisible) {
      return (
        <Switch
          disabled={switchDisabled}
          color={colors.primary}
          value={switchValue}
          style={{marginLeft: 'auto'}}
          onValueChange={() => {
            onSwitchValueChange && onSwitchValueChange();
          }}
        />
      );
    }
  };

  return (
    <View style={[styles.container, containerStyle]}>
      <Text
        style={{
          fontSize: 16,
          fontWeight: 'bold',
        }}>
        {headingText}
      </Text>
      {renderSwitch()}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    paddingTop: 15,
    paddingBottom: 15,
    paddingHorizontal: 11,
    flexDirection: 'row',
    alignItems: 'center',
  },
});

export default SectionHeading;
