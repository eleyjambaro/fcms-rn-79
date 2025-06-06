import {StyleSheet, Text, View, Pressable} from 'react-native';
import {Button, useTheme} from 'react-native-paper';
import React from 'react';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCloudAuthContext from '../hooks/useCloudAuthContext';
import DefaultBranch from '../components/cloudAccount/DefaultBranch';
import UploadHistoryList from '../components/cloudAccount/UploadHistoryList';
import appDefaults from '../constants/appDefaults';

const CloudAccount = () => {
  const [_authState, {signIn, signUp, signOut}] = useCloudAuthContext();
  const {colors} = useTheme();
  return (
    <View style={[styles.container]}>
      <View
        style={{
          paddingTop: 10,
          paddingBottom: 5,
        }}>
        <Pressable
          onPress={() => signOut()}
          style={{
            backgroundColor: colors.surface,
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 'auto',
            padding: 10,
            paddingHorizontal: 15,
            borderTopLeftRadius: 25,
            borderBottomLeftRadius: 25,
          }}>
          <MaterialCommunityIcons name="logout" size={20} color={colors.dark} />

          <Text style={{fontWeight: '500', marginLeft: 5}}>
            {`Logout ${appDefaults.appDisplayName} Cloud`}
          </Text>
        </Pressable>
      </View>

      <DefaultBranch />

      <View style={{flex: 1, backgroundColor: colors.surface}}>
        <View
          style={{
            borderBottomWidth: 2,
            borderBottomColor: colors.neutralTint5,
          }}>
          <Text
            style={{
              margin: 15,
              marginHorizontal: 20,
              fontSize: 16,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {'Upload History'}
          </Text>
        </View>
        <UploadHistoryList />
      </View>
    </View>
  );
};

export default CloudAccount;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
