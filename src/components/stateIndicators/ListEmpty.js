import {StyleSheet, Text, View, Pressable} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';

const ListEmpty = props => {
  const {message = 'No data to display', actions = [], containerStyle} = props;
  const {colors} = useTheme();

  return (
    <View
      style={[
        {
          flex: 1,
          padding: 20,
          justifyContent: 'center',
          alignItems: 'center',
        },
        containerStyle,
      ]}>
      <Text style={{textAlign: 'center'}}>{message}</Text>
      {actions.map((action, index) => {
        return (
          <Pressable
            key={`${index} - ${action.label}`}
            onPress={action.handler}
            style={{marginVertical: 15}}>
            <Text
              style={{color: colors.primary, fontWeight: 'bold', fontSize: 16}}>
              {action.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
};

export default ListEmpty;

const styles = StyleSheet.create({});
