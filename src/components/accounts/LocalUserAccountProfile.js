import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  Button,
  Paragraph,
  Dialog,
  Modal,
  Portal,
  TextInput,
  Title,
  useTheme,
  Avatar,
  Card,
} from 'react-native-paper';

const LocalUserAccountProfile = props => {
  const {account, onPressItem, containerStyle} = props;
  const {colors} = useTheme();

  if (!account) return null;

  const userFullName = `${account.first_name} ${account.last_name}`;
  const userNameInitial = userFullName
    .split(' ')
    .map(function (str) {
      return str ? str[0].toUpperCase() : '';
    })
    .slice(0, 2)
    .join('');

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5},
        containerStyle,
      ]}
      onPress={onPressItem}>
      <Card style={styles.wrapper}>
        <Card.Content style={{flexDirection: 'row'}}>
          <Avatar.Text
            size={50}
            color={colors.surface}
            label={userNameInitial}
            style={{marginRight: 18, backgroundColor: colors.neutralTint3}}
            labelStyle={{fontWeight: 'bold'}}
          />
          <View style={{flex: 1}}>
            <Text
              style={{
                fontSize: 18,
                fontWeight: 'bold',
                color: colors.dark,
                flex: 1,
              }}
              numberOfLines={1}>
              {`${userFullName}`}
            </Text>
            <Text
              style={{
                fontSize: 16,
                color: colors.neutralTint2,
                marginRight: 10,
                flex: 1,
              }}
              numberOfLines={1}>
              {`${account.role_name}`}
            </Text>
          </View>
        </Card.Content>
      </Card>
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    margin: 15,
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 5,
    paddingHorizontal: 5,
  },
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 15,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  costFrame: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 4,
    marginRight: 5,
    paddingHorizontal: 10,
    height: 38,
    alignItems: 'center',
  },
  costText: {
    fontSize: 14,
    color: 'black',
  },
  col: {
    flex: 1,
  },
  colHeader: {
    flex: 1,
  },
  colHeading: {
    marginBottom: 3,
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

export default LocalUserAccountProfile;
