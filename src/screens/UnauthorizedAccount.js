import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme, Avatar, Button, Subheading} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';

const UnauthorizedAccount = props => {
  const {containerStyle} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <View style={{alignItems: 'center', marginBottom: 30}}>
        <Avatar.Icon
          icon="account-cancel-outline"
          size={100}
          color={colors.surface}
        />
      </View>
      <Subheading
        style={{fontWeight: 'bold', textAlign: 'center', color: colors.dark}}>
        Unauthorized account
      </Subheading>
      <Text style={[styles.text, {marginBottom: 15}]}>
        Your account has no access to this page. The root account or an account
        with access to user management must login and edit your account role to
        give you privilege to access this page.
      </Text>

      <View style={{marginTop: 30}}>
        <Button
          mode="contained"
          onPress={() => {
            navigation.goBack();
          }}>
          Go Back
        </Button>
      </View>
    </View>
  );
};

export default UnauthorizedAccount;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 10,
    justifyContent: 'center',
  },
  text: {
    textAlign: 'center',
  },
});
