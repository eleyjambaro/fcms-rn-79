import React from 'react';
import {View} from 'react-native';
import {Text, Checkbox} from 'react-native-paper';

const ConfirmationCheckbox = props => {
  const {containerStyle, status, onPress, text = ''} = props;

  const renderText = () => {
    if (!text) return null;

    return <Text style={{fontSize: 16, marginLeft: 3}}>{text}</Text>;
  };
  return (
    <View
      style={[
        {
          paddingTop: 15,
          paddingHorizontal: 15,
          paddingBottom: 15,
          flexDirection: 'row',
          alignItems: 'center',
        },
        containerStyle,
      ]}>
      <Checkbox
        status={status ? 'checked' : 'unchecked'}
        onPress={() => {
          onPress && onPress(status);
        }}
      />
      {renderText()}
    </View>
  );
};

export default ConfirmationCheckbox;
