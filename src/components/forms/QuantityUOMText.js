import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import convert from 'convert-units';
import {useTheme} from 'react-native-paper';

const QuantityUOMText = props => {
  const {
    uomAbbrev,
    quantity = 0,
    operationType,
    prefixText = '',
    concatText = '',
    textStyle,
    disabled = false,
  } = props;
  if (!uomAbbrev) return null;
  const {colors} = useTheme();

  let unitText = '';
  let addOrMinus = '';

  if (parseInt(quantity) > 1) {
    unitText =
      uomAbbrev === 'ea' ? 'Pieces' : convert().describe(uomAbbrev)?.plural;
  } else {
    unitText =
      uomAbbrev === 'ea' ? 'Piece' : convert().describe(uomAbbrev)?.singular;
  }

  if (operationType === 'add') {
    addOrMinus = '(+) ';
  } else if (operationType === 'remove') {
    addOrMinus = '(-) ';
  }

  if (!unitText) return null;

  return (
    <View style={{position: 'absolute', top: 23, right: 15}}>
      <Text
        style={[
          {
            fontStyle: 'italic',
            fontSize: 16,
            fontWeight: 'bold',
            color: disabled ? colors.disabled : colors.neutralTint1,
          },
          textStyle,
        ]}>
        {`${addOrMinus}${prefixText}${unitText}` + `${concatText}`}
      </Text>
    </View>
  );
};

export default QuantityUOMText;

const styles = StyleSheet.create({});
