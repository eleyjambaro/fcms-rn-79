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

const UnitListItem = props => {
  const {item} = props;
  const {colors} = useTheme();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);
  const [unitCostModalVisible, setUnitCostModalVisible] = useState(false);
  const [addStockModalVisible, setAddStockModalVisible] = useState(false);

  const hideDialog = () => setDetailsDialogVisible(false);

  const showDialog = () => setDetailsDialogVisible(true);

  const modalContainerStyle = {backgroundColor: 'white', padding: 20};

  if (!item) return null;

  const totalCost = parseInt(item.add_stock_qty) * item.unit_cost;

  return (
    <View
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}>
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

      <View style={{marginLeft: 'auto'}}>
        <Text>{item.abbrev}</Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    paddingVertical: 20,
    paddingHorizontal: 15,
    width: '100%',
    elevation: 100,
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

export default UnitListItem;
