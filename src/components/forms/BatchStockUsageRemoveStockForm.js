import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, Divider, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import {useQuery} from '@tanstack/react-query';
import * as Yup from 'yup';

import routes from '../../constants/routes';
import CheckboxSelection from './CheckboxSelection';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import QuantityUOMText from './QuantityUOMText';
import {getInventoryOperations} from '../../localDbQueries/operations';

const RemoveStockValidationSchema = Yup.object().shape({
  remove_stock_unit_cost: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  remove_stock_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const BatchStockUsageRemoveStockForm = props => {
  const {item, onSubmit, onCancel} = props;
  const {colors} = useTheme();
  const {status, data} = useQuery(
    ['operations', {filter: {type: 'remove_stock'}}],
    getInventoryOperations,
  );
  const defaultOperationId = '1';

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <Formik
      initialValues={{
        // operation_id: defaultOperationId,
        item_id: item?.id?.toString() || '',
        remove_stock_unit_cost:
          item?.remove_stock_unit_cost?.toString() ||
          item?.unit_cost?.toString() ||
          '',
        remove_stock_qty: item?.remove_stock_qty?.toString() || '',
      }}
      onSubmit={onSubmit}
      validationSchema={RemoveStockValidationSchema}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          dirty,
          isValid,
          isSubmitting,
        } = props;

        return (
          <>
            {/* <Text
              style={{
                marginTop: 10,
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Select a Reason'}
            </Text>
            <CheckboxSelection
              value={values.operation_id}
              options={data.result}
              optionLabelKey="name"
              optionValueKey="id"
              onChange={handleChange('operation_id')}
            />
            <Divider style={{marginTop: 10, marginBottom: 25}} /> */}
            <Text
              style={{
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Remove Stock'}
            </Text>
            <TextInput
              label="Unit Cost"
              onChangeText={handleChange('remove_stock_unit_cost')}
              onBlur={handleBlur('remove_stock_unit_cost')}
              value={values.remove_stock_unit_cost}
              keyboardType="numeric"
              error={
                errors.remove_stock_unit_cost && touched.remove_stock_unit_cost
                  ? true
                  : false
              }
            />
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Quantity"
                onChangeText={handleChange('remove_stock_qty')}
                onBlur={handleBlur('remove_stock_qty')}
                value={values.remove_stock_qty}
                style={[styles.textInput, {flex: 1}]}
                keyboardType="numeric"
                error={
                  errors.remove_stock_qty && touched.remove_stock_qty
                    ? true
                    : false
                }
              />
              <QuantityUOMText
                uomAbbrev={item?.uom_abbrev}
                quantity={values.remove_stock_qty}
                operationType="remove"
              />
            </View>
            {errors.remove_stock_qty && touched.remove_stock_qty && (
              <Text style={{color: colors.error, marginTop: 10}}>
                {errors.remove_stock_qty}
              </Text>
            )}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              Save
            </Button>
            <Button onPress={onCancel} style={{marginTop: 10}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({});

export default BatchStockUsageRemoveStockForm;
