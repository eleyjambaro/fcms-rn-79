import React from 'react';
import {View} from 'react-native';
import {Text, Checkbox, useTheme} from 'react-native-paper';

const ConfirmationCheckbox = props => {
  const {colors} = useTheme();
  const {containerStyle, status, onPress, heading = '', text = ''} = props;

  const renderText = () => {
    if (!text) return null;

    return (
      <View style={{flex: 1}}>
        <Text style={{fontSize: 16, marginLeft: 3, flexWrap: 'wrap'}}>
          {text}
        </Text>
      </View>
    );
  };
  return (
    <View
      style={[
        {
          paddingTop: 20,
          paddingHorizontal: 15,
          paddingBottom: 20,
        },
        containerStyle,
      ]}>
      {heading && (
        <View
          style={{
            marginBottom: 10,
            marginLeft: 10,
          }}>
          <Text
            style={{
              fontSize: 16,
              fontWeight: 'bold',
              color: colors.neutralTint1,
            }}>
            {heading}
          </Text>
        </View>
      )}
      <View
        style={[
          {
            flexDirection: 'row',
            alignItems: 'center',
          },
        ]}>
        <Checkbox
          status={status ? 'checked' : 'unchecked'}
          onPress={() => {
            onPress && onPress(status);
          }}
        />
        {renderText()}
      </View>
    </View>
  );
};

export default ConfirmationCheckbox;
