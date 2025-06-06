import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {Button, useTheme} from 'react-native-paper';
import useWindowProperties from '../../../hooks/useWindowProperties';

const CashShortcutButtons = props => {
  const {buttons, containerStyle, highlightedButton} = props;
  const {colors} = useTheme();
  const {isLandscapeMode, width} = useWindowProperties();

  if (!buttons?.length > 0) return null;

  const groupPadding = 8;
  const buttonPerRow = 3;

  /**
   * Determine the number of rows based on the buttons array
   */
  let numberOfRows = 0;

  let buttonsToSplice = [...buttons];

  for (let index = 0; index < buttonsToSplice.length; index + buttonPerRow) {
    buttonsToSplice.splice(0, buttonPerRow);
    numberOfRows++;
  }

  // recopy spliced buttons
  buttonsToSplice = [...buttons];

  /**
   * Distibute buttons inside the row container
   */

  let jsxButtonsInsideRowContainers = [];

  for (let index = 0; index < numberOfRows; index++) {
    const buttonsInARow = buttonsToSplice
      .splice(0, buttonPerRow)
      .map(button => {
        return (
          <Button
            key={button.label}
            mode="outlined"
            icon={button.icon}
            style={[
              {
                flex: 1,
                margin: 8,
                borderWidth: 1.5,
                borderColor: button.color,
              },
              button.label === highlightedButton && {
                borderColor: colors.accent,
                backgroundColor: colors.highlighted,
              },
            ]}
            onPress={() => {
              button.handler && button.handler(button);
            }}
            color={button.color}>
            <Text
              style={[
                {fontWeight: 'bold', color: button.labelColor},
                button.label === highlightedButton && {color: colors.accent},
              ]}>
              {button.label}
            </Text>
          </Button>
        );
      });

    const rowContainer = (
      <View key={index} style={[styles.row, {}]}>
        {buttonsInARow}
      </View>
    );

    jsxButtonsInsideRowContainers.push(rowContainer);
  }

  return (
    <View
      style={[
        {
          borderWidth: 1,
          borderColor: colors.neutralTint1,
          borderRadius: 5,
          padding: groupPadding,
        },
        containerStyle,
      ]}>
      {jsxButtonsInsideRowContainers}
    </View>
  );
};

export default CashShortcutButtons;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  wrapper: {
    flex: 1,
  },
  group: {
    flex: 1,
    marginBottom: 10,
    justifyContent: 'space-between',
    elevation: 2,
  },
  groupHeader: {
    height: 30,
    marginBottom: 10,
    // justifyContent: 'center',
    alignItems: 'center',
  },
  row: {
    flexDirection: 'row',
  },
  button: {
    borderWidth: 1,
    borderRadius: 30,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderButton: {},
});
