import React from 'react';
import {View, Pressable, StyleSheet, Modal} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemValidationSchema = Yup.object().shape({
  item_id: Yup.string().required('Required'),
  sale_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const SalesOrderFulfillmentForm = props => {
  const {
    item,
    initialValues = {
      sale_qty: '',
    },
    onSubmit,
    onCancel,
  } = props;
  const {colors} = useTheme();

  const formik = useFormik({
    initialValues: {
      item_id: item?.id,
      sale_qty: initialValues.sale_qty?.toString() || '1',
    },
    validationSchema: ItemValidationSchema,
    onSubmit,
  });

  const {
    handleChange,
    handleBlur,
    handleSubmit,
    setFieldValue,
    setValues,
    values,
    errors,
    touched,
    isValid,
    dirty,
    isSubmitting,
    setFieldTouched,
    setFieldError,
  } = formik;

  const renderOrderSizeAndQuantity = (renderQty = false) => {
    let textValue = `${commaNumber(
      parseFloat(item.order_qty || 0).toFixed(item.order_qty % 1 ? 2 : 0),
    )} ${formatUOMAbbrev(item.uom_abbrev)}`;

    if (item.order_size_name) {
      textValue = `x ${commaNumber(
        parseFloat(item.order_qty || 0).toFixed(item.order_qty % 1 ? 2 : 0),
      )}`;
    }

    return (
      <View
        style={{
          marginTop: 5,
          marginRight: 'auto',
          flexDirection: 'row',
        }}>
        <Text style={{fontSize: 16, fontWeight: '500', marginRight: 5}}>
          {`${item.order_size_name}`}
        </Text>
        {renderQty && (
          <Text
            style={{fontSize: 16, fontWeight: '500'}}>{`: ${textValue}`}</Text>
        )}
      </View>
    );
  };

  const buttonWidth = 57;
  const buttonHeight = 57;
  let isMaxOrderQty =
    parseFloat(values?.sale_qty) >=
    parseFloat(item?.order_qty || 0) -
      parseFloat(item?.fulfilled_order_qty || 0);
  let isQtyLessThanOrEqualToOne = parseFloat(values?.sale_qty) <= 1;

  if (!item) return null;

  return (
    <>
      <View style={{marginTop: 15, marginBottom: 15, marginHorizontal: 10}}>
        <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.dark}}>
          {item.name}
        </Text>

        {renderOrderSizeAndQuantity()}
      </View>

      <Text
        style={{
          marginLeft: 5,
          marginTop: 20,
          fontSize: 16,
          fontWeight: 'bold',
          color: colors.primary,
        }}>{`Enter new fulfilled order quantity:`}</Text>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 30,
        }}>
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: colors.neutralTint3,
              height: buttonHeight,
              width: buttonWidth,
            },
          ]}
          disabled={isQtyLessThanOrEqualToOne}
          onPress={() => {
            const extractedValue = extractNumber(values.sale_qty);
            const saleQty = extractedValue ? parseFloat(extractedValue) : '';
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(saleQty || 0);

            formik.setValues({
              ...values,
              sale_qty: (saleQty - 1).toString(),
            });
          }}>
          <MaterialCommunityIcons
            name="minus"
            size={37}
            color={isQtyLessThanOrEqualToOne ? colors.disabled : colors.dark}
          />
        </Pressable>
        <TextInput
          label="Quantity"
          mode="outlined"
          keyboardType="numeric"
          style={{
            flex: 1,
            backgroundColor: colors.surface,
            marginHorizontal: 15,
            fontWeight: 'bold',
            fontSize: 20,
          }}
          value={commaNumber(values.sale_qty)?.toString() || ''}
          onChangeText={value => {
            const extractedValue = extractNumber(value);
            const saleQty = extractedValue ? parseFloat(extractedValue) : '';
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(saleQty || 0);

            formik.setValues({
              ...values,
              sale_qty: saleQty.toString(),
            });
          }}
        />
        <Pressable
          style={[
            styles.button,
            {
              backgroundColor: colors.surface,
              borderColor: isMaxOrderQty
                ? colors.disabled
                : colors.neutralTint3,
              height: buttonHeight,
              width: buttonWidth,
            },
          ]}
          disabled={isMaxOrderQty}
          onPress={() => {
            const extractedValue = extractNumber(values.sale_qty);
            const saleQty = extractedValue ? parseFloat(extractedValue) : '';
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(saleQty || 0);

            formik.setValues({
              ...values,
              sale_qty: (saleQty + 1).toString(),
            });
          }}>
          <MaterialCommunityIcons
            name="plus"
            size={37}
            color={isMaxOrderQty ? colors.disabled : colors.dark}
          />
        </Pressable>
      </View>
      <View style={{marginTop: 30, marginBottom: 15}}>
        <Button
          mode="contained"
          onPress={(...args) => {
            // inject some data to the values before submitting
            formik.setValues({
              ...formik.values,
              ...item,
            });

            handleSubmit(...args);
          }}
          disabled={!isValid || isSubmitting}
          loading={isSubmitting}>
          {'Enter'}
        </Button>
        <Button
          onPress={() => {
            onCancel && onCancel();
          }}
          style={{marginTop: 10}}>
          Cancel
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  textInput: {},
  button: {
    borderWidth: 1,
    borderRadius: 20,
    padding: 5,
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContentContainer: {
    flexDirection: 'column',
    justifyContent: 'center',
    height: '100%',
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalContent: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginVertical: 70,
  },
  modalConfirmButton: {
    marginTop: 25,
    margin: 10,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default SalesOrderFulfillmentForm;
