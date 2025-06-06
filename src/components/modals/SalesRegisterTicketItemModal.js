import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {
  Button,
  Paragraph,
  Dialog,
  Portal,
  useTheme,
  Modal,
  Title,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import * as RootNavigation from '../../../RootNavigation';
import routes from '../../constants/routes';
import appDefaults from '../../constants/appDefaults';
import SalesRegisterUpdateItemForm from '../forms/SalesRegisterUpdateItemForm';

const SalesRegisterTicketItemModal = props => {
  const {
    visible,
    onSubmit,
    onDismiss,
    item,
    handleRemoveItemFromSalesRegisterTicket,
  } = props;
  const {colors} = useTheme();

  if (!item) return null;

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={() => onDismiss && onDismiss()}
        contentContainerStyle={{backgroundColor: 'white', padding: 15}}>
        <View>
          <MaterialCommunityIcons
            name="close"
            size={27}
            color={colors.dark}
            style={{marginLeft: 'auto'}}
            onPress={() => onDismiss && onDismiss()}
          />
        </View>
        <View>
          <SalesRegisterUpdateItemForm
            item={item}
            initialValues={{sale_qty: item?.saleQty}}
            onSubmit={onSubmit}
            onCancel={onDismiss}
            handleRemoveItemFromSalesRegisterTicket={
              handleRemoveItemFromSalesRegisterTicket
            }
          />
        </View>
      </Modal>
    </Portal>
  );
};

export default SalesRegisterTicketItemModal;

const styles = StyleSheet.create({});
