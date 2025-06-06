import {StyleSheet, Text, View, Pressable} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const TextWithIconButton = props => {
  const {label = 'Add Stock', icon = 'plus', onPress, containerStyle} = props;
  const {colors} = useTheme();

  const handlePress = () => {
    onPress && onPress();
  };

  return (
    <View
      style={[
        {
          flexDirection: 'row',
          justifyContent: 'center',
          paddingTop: 10,
          paddingBottom: 10,
          paddingHorizontal: 10,
          backgroundColor: colors.surface,
        },
        containerStyle,
      ]}>
      <Pressable onPress={handlePress} style={styles.buttonTextContainer}>
        <View style={styles.buttonIconContainer}>
          <MaterialCommunityIcons name={icon} size={20} color={colors.dark} />
        </View>
        <Text style={{color: colors.primary, fontWeight: 'bold', fontSize: 16}}>
          {label}
        </Text>
      </Pressable>
    </View>
  );
};

export default TextWithIconButton;

const styles = StyleSheet.create({
  buttonTextContainer: {
    flexDirection: 'row',
  },
  buttonIconContainer: {
    marginRight: 5,
  },
});
