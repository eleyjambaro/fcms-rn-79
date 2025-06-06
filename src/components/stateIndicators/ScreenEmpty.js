import {StyleSheet, Text, View, Pressable} from 'react-native';
import React from 'react';
import {useTheme, Avatar} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const ScreenEmpty = props => {
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
          backgroundColor: colors.surface,
        },
        containerStyle,
      ]}>
      <View
        style={{
          width: '100%',
          justifyContent: 'center',
          alignItems: 'center',
          marginBottom: 30,
        }}>
        <Avatar.Icon
          icon="magnify-remove-outline"
          size={100}
          color={colors.surface}
          style={{backgroundColor: colors.neutralTint2}}
        />
      </View>
      <Text style={{textAlign: 'center', fontSize: 20, fontWeight: 'bold'}}>
        {message}
      </Text>
      <View style={styles.actionsContainer}>
        {actions.map((action, index) => {
          return (
            <Pressable
              key={`${index} - ${action.label}`}
              onPress={action.handler}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginVertical: 15,
              }}>
              {action.icon && (
                <MaterialCommunityIcons
                  name={action.icon}
                  size={action.iconSize || 15}
                  color={colors.dark}
                  style={{marginRight: 5}}
                />
              )}
              <Text
                style={{
                  color: colors.primary,
                  fontWeight: 'bold',
                  fontSize: 16,
                  textAlign: 'center',
                }}>
                {action.label}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
};

export default ScreenEmpty;

const styles = StyleSheet.create({
  actionsContainer: {
    marginTop: 10,
    marginHorizontal: 30,
  },
});
