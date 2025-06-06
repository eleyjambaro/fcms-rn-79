import React from 'react';
import {View, Pressable, StyleSheet, Modal} from 'react-native';
import {TextInput, Button, Text, useTheme, Divider} from 'react-native-paper';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import * as RootNavigation from '../../../RootNavigation';
import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
import CashPaymentTotals from './components/CashPaymentTotals';
import routes from '../../constants/routes';
import {useRoute} from '@react-navigation/native';
import CashShortcutButtons from './components/CashShortcutButtons';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

const PaymentValidationSchema = Yup.object().shape({
  payment_amount: Yup.string().max(50, 'Too Long!').required('Required'),
});

const CashPaymentForm = props => {
  const {
    initialValues = {
      total_amount_due: '',
      payment_amount: '',
    },
    onSubmit,
    onCancel,
    cancelButtonLabel = 'Go Back',
    handleCardPayment,
  } = props;
  const {colors} = useTheme();
  const route = useRoute();
  const currencySymbol = useCurrencySymbol();

  const formik = useFormik({
    initialValues: {
      total_amount_due: initialValues.total_amount_due?.toString() || '',
      payment_amount: initialValues.payment_amount?.toString() || '',
    },
    validationSchema: PaymentValidationSchema,
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

  const handlePressCashButton = ({value}) => {
    setValues({
      ...values,
      payment_amount: (
        parseFloat(values.payment_amount || 0) + value
      )?.toString(),
    });
  };

  const handlePressExactAmount = () => {
    setValues({
      ...values,
      payment_amount: initialValues.total_amount_due?.toString() || '',
    });
  };

  const cashButtons = [
    {
      value: 10,
      label: `${currencySymbol} 10`,
      color: 'brown',
      labelColor: 'brown',
      handler: handlePressCashButton,
    },
    {
      value: 20,
      label: `${currencySymbol} 20`,
      color: 'orange',
      labelColor: 'orange',
      handler: handlePressCashButton,
    },
    {
      value: 50,
      label: `${currencySymbol} 50`,
      color: 'red',
      labelColor: 'red',
      handler: handlePressCashButton,
    },
    {
      value: 100,
      label: `${currencySymbol} 100`,
      color: 'violet',
      labelColor: 'violet',
      handler: handlePressCashButton,
    },
    {
      value: 200,
      label: `${currencySymbol} 200`,
      color: 'green',
      labelColor: 'green',
      handler: handlePressCashButton,
    },
    {
      value: 500,
      label: `${currencySymbol} 500`,
      color: 'gold',
      labelColor: 'gold',
      handler: handlePressCashButton,
    },
    {
      value: 1000,
      label: `${currencySymbol} 1,000`,
      color: 'blue',
      labelColor: 'blue',
      handler: handlePressCashButton,
    },
    {
      value: '',
      label: `Exact`,
      color: colors.primary,
      labelColor: colors.primary,
      handler: handlePressExactAmount,
    },
    {
      value: '',
      label: `Clear`,
      icon: 'delete-forever',
      color: colors.dark,
      labelColor: colors.dark,
      handler: () => {
        setValues({
          ...values,
          payment_amount: '',
        });
      },
    },
  ];

  let changeAmount = 0;

  if (
    parseFloat(values.payment_amount || 0) >
    parseFloat(values.total_amount_due || 0)
  ) {
    changeAmount =
      parseFloat(values.payment_amount) - parseFloat(values.total_amount_due);
  }

  return (
    <View>
      <CashPaymentTotals
        totalAmountDue={values?.total_amount_due}
        changeAmount={changeAmount}
        containerStyle={{marginTop: 30}}
      />
      <View
        style={{
          marginTop: 30,
        }}>
        {/* <Text
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>{`Cash received:`}</Text> */}
        <TextInput
          label="Received Cash Amount"
          mode="outlined"
          keyboardType="numeric"
          style={{
            marginTop: 15,
            fontWeight: 'bold',
            fontSize: 20,
          }}
          value={commaNumber(values.payment_amount)?.toString() || ''}
          onChangeText={value => {
            const extractedValue = extractNumber(value);
            const saleQty = extractedValue ? parseFloat(extractedValue) : '';

            formik.setValues({
              ...values,
              payment_amount: saleQty.toString(),
            });
          }}
        />
      </View>

      <CashShortcutButtons
        buttons={cashButtons}
        containerStyle={{marginTop: 15}}
        highlightedButton={
          parseFloat(values.payment_amount) ==
          parseFloat(values.total_amount_due)
            ? 'Exact'
            : ''
        }
      />

      <View style={{marginTop: 30, marginBottom: 15}}>
        <Button
          icon="cash-multiple"
          mode="contained"
          onPress={() => {
            // inject some data to the values before submitting
            formik.setValues({
              ...formik.values,
              payment_method: 'cash',
            });

            handleSubmit();
          }}
          disabled={
            !isValid ||
            isSubmitting ||
            !parseFloat(values.payment_amount) > 0 ||
            !parseFloat(values.total_amount_due) > 0 ||
            parseFloat(values.payment_amount) <
              parseFloat(values.total_amount_due)
          }
          loading={isSubmitting}>
          {'Cash'}
        </Button>

        <View
          style={{
            marginVertical: 20,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{flex: 1, height: 1, backgroundColor: colors.disabled}}
          />
          <Text
            style={{
              color: colors.dark,
              backgroundColor: colors.surface,
              padding: 10,
              fontWeight: 'bold',
            }}>
            OR
          </Text>
          <View
            style={{flex: 1, height: 1, backgroundColor: colors.disabled}}
          />
        </View>

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Button
            icon="credit-card"
            mode="outlined"
            color={colors.dark}
            style={{flex: 1, marginRight: 5}}
            onPress={() => {
              handleCardPayment &&
                handleCardPayment(
                  {
                    total_amount_due: values.total_amount_due,
                    payment_method: 'card',
                    payment_amount: values.total_amount_due,
                    change_amount: changeAmount,
                  },
                  formik,
                );
            }}
            disabled={!parseFloat(values.total_amount_due) > 0}>
            {'Card'}
          </Button>
          <Button
            icon="call-split"
            mode="outlined"
            color={colors.accent}
            style={{flex: 1, marginLeft: 5}}
            onPress={() => {
              RootNavigation.navigate(routes.splitPayment(), {
                ...route?.params,
              });
            }}
            disabled={!parseFloat(values.total_amount_due) > 0}>
            {'Split Payment'}
          </Button>
        </View>
        <Button
          onPress={() => {
            onCancel && onCancel();
          }}
          style={{marginTop: 30}}>
          {cancelButtonLabel}
        </Button>
      </View>
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

export default CashPaymentForm;
