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
} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const RevenueGroupListItem = props => {
  const {
    item,
    onPress,
    onPressItemOptions,
    viewMode = 'list',
    highlighted,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [unitCostModalVisible, setUnitCostModalVisible] = useState(false);
  const [addStockModalVisible, setAddStockModalVisible] = useState(false);

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const modalContainerStyle = {backgroundColor: 'white', padding: 20};

  if (!item) return null;

  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
        highlighted ? {backgroundColor: colors.highlighted} : {},
      ]}>
      <View style={styles.wrapper}>
        <Text
          style={{
            fontSize: 14,
            color: colors.dark,
            marginRight: 10,
            flex: 1,
          }}
          numberOfLines={1}>
          {item.name}
        </Text>
        {viewMode === 'list' && (
          <View
            style={{
              marginLeft: 'auto',
              flexDirection: 'row',
            }}>
            <Text>{`${currencySymbol} ${commaNumber(
              item.amount?.toFixed(2) || 0,
            )}`}</Text>
          </View>
        )}
      </View>
      <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
      </Pressable>
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
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 15,
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

export default RevenueGroupListItem;
