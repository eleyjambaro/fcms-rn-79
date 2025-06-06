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
  Surface,
  Avatar,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

const LocalUserAccountListItem = props => {
  const {
    item,
    showOptionButton = false,
    onPressItem,
    onPressItemOptions,
  } = props;
  const {colors} = useTheme();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const modalContainerStyle = {backgroundColor: 'white', padding: 20};

  if (!item) return null;

  const userFullName = `${item.first_name} ${item.last_name}`;
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
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}
      onPress={onPressItem}>
      <View style={styles.wrapper}>
        <Avatar.Text
          size={45}
          color={colors.surface}
          label={userNameInitial}
          style={{marginRight: 10, backgroundColor: colors.neutralTint3}}
          labelStyle={{fontWeight: 'bold'}}
        />
        <View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: colors.dark,
              marginRight: 10,
              flex: 1,
            }}
            numberOfLines={1}>
            {`${userFullName}`}
          </Text>
          <Text
            style={{
              fontSize: 14,
              color: colors.neutralTint2,
              marginRight: 10,
              flex: 1,
            }}
            numberOfLines={1}>
            {`${item.role_name}`}
          </Text>
        </View>
      </View>

      {showOptionButton && (
        <Pressable
          style={styles.optionButtonContainer}
          onPress={onPressItemOptions}>
          <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
        </Pressable>
      )}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    width: '100%',
    elevation: 100,
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
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

export default LocalUserAccountListItem;
