import React from 'react';
import {View, ScrollView, Pressable, StyleSheet, Modal} from 'react-native';
import {TextInput, Button, Text, useTheme, Divider} from 'react-native-paper';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
import SplitPaymentTotals from './components/SplitPaymentTotals';
import routes from '../../constants/routes';
import SplitPaymentList from './components/SplitPaymentList';

const SplitPaymentValidationSchema = Yup.object().shape({
  payments: Yup.object().required(),
});

const SplitPaymentForm = props => {
  const {
    initialValues = {
      total_amount_due: '',
      payments: {},
    },
    onSubmit,
    onCancel,
    cancelButtonLabel = 'Go Back',
  } = props;
  const {colors} = useTheme();

  const formik = useFormik({
    initialValues: {
      is_split_payment: true,
      total_amount_due: initialValues.total_amount_due?.toString() || '0',
      payments: initialValues.payments || {
        1: {
          payment_method: 'cash',
          payment_amount: '',
        },
        2: {
          payment_method: 'card',
          payment_amount: '',
        },
      },
    },
    validationSchema: SplitPaymentValidationSchema,
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

  const getSplitPaymentsAndTotals = () => {
    let paymentsArray = [];
    let paymentsTotalAmount = 0;
    let remainingAmount = 0;
    let changeAmount = 0;
    let totalAmountDue = parseFloat(values.total_amount_due);

    for (let key of Object.keys(values.payments)) {
      let payment = values.payments[key];
      paymentsArray.push({id: key, ...payment});

      paymentsTotalAmount = paymentsTotalAmount + payment.payment_amount;
    }

    if (paymentsTotalAmount < totalAmountDue) {
      remainingAmount = totalAmountDue - paymentsTotalAmount;
    }

    if (paymentsTotalAmount > totalAmountDue) {
      changeAmount = paymentsTotalAmount - totalAmountDue;
    }

    return {
      paymentsTotalAmount,
      remainingAmount,
      paymentsArray,
      changeAmount,
    };
  };

  const handleOnPressDeleteListItem = listItem => {
    const payments = values.payments;
    delete payments[listItem?.id];

    setValues({
      ...values,
      payments,
    });
  };

  const handleChangeListItemValue = (updatedListItem, paymentsAndTotals) => {
    const payments = values.payments;
    const {maxAmountToInput} = paymentsAndTotals;

    delete payments[updatedListItem?.id];
    payments[updatedListItem?.id] = updatedListItem;

    setValues({
      ...values,
      payments,
    });
  };

  const splitPaymentsAndTotals = getSplitPaymentsAndTotals();

  return (
    <View>
      <SplitPaymentTotals
        displayTotalAmountDue
        displayChangeAmount
        totalAmountDue={values?.total_amount_due}
        remainingAmount={splitPaymentsAndTotals?.remainingAmount}
        changeAmount={splitPaymentsAndTotals?.changeAmount}
        containerStyle={{marginTop: 30, marginBottom: 30}}
      />
      <ScrollView>
        <SplitPaymentList
          containerStyle={{marginTop: 5}}
          listItemKey="id"
          listItems={splitPaymentsAndTotals?.paymentsArray}
          onPressDeleteListItem={handleOnPressDeleteListItem}
          handleChangeListItemValue={updatedListItem => {
            handleChangeListItemValue(updatedListItem, splitPaymentsAndTotals);
          }}
        />
        <View style={{marginTop: 30, marginBottom: 300}}>
          <Button
            disabled={
              !isValid ||
              isSubmitting ||
              splitPaymentsAndTotals?.paymentsTotalAmount <= 0 ||
              splitPaymentsAndTotals?.remainingAmount > 0
            }
            loading={isSubmitting}
            mode="contained"
            style={{marginBottom: 15}}
            onPress={handleSubmit}>
            Proceed
          </Button>
          <Button
            onPress={() => {
              onCancel && onCancel();
            }}>
            Cancel
          </Button>
        </View>
      </ScrollView>
    </View>
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

export default SplitPaymentForm;
