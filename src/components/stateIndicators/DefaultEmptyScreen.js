import React from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {useTheme} from 'react-native-paper';

const DefaultEmptyScreen = props => {
  const {colors} = useTheme();
  const {containerStyle, heading, textContent, headingStyle, textContentStyle} =
    props;

  const renderHeading = () => {
    if (heading) {
      return <Text style={[styles.heading, headingStyle]}>{heading}</Text>;
    }
  };

  const renderTextContent = () => {
    if (textContent) {
      return (
        <Text style={[styles.textContent, textContentStyle]}>
          {textContent}
        </Text>
      );
    }
  };

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.neutralLighten4},
        containerStyle,
      ]}>
      {renderHeading()}
      {renderTextContent()}
    </View>
  );
};

export default DefaultEmptyScreen;

const styles = StyleSheet.create({
  container: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  heading: {
    fontSize: 16,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  textContent: {
    textAlign: 'center',
  },
});
