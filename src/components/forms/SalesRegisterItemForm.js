import React, {useState, useEffect} from 'react';
import {View, Pressable, StyleSheet, Modal} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  ActivityIndicator,
  Checkbox,
  RadioButton,
  Switch,
  HelperText,
} from 'react-native-paper';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import * as Yup from 'yup';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import commaNumber from 'comma-number';
import MonthPicker from 'react-native-month-picker';

import MoreSelectionButton from '../buttons/MoreSelectionButton';
import useItemFormContext from '../../hooks/useItemFormContext';
import {getCategory} from '../../localDbQueries/categories';
import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
import routes from '../../constants/routes';
import SectionHeading from '../headings/SectionHeading';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import TextInputLabel from './TextInputLabel';
import FormRequiredFieldsHelperText from './FormRequiredFieldsHelperText';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import useIngredientsValidator from './hooks/useIngredientsValidator';
import YieldCostCalculation from './components/YieldCostCalculation';
import FinishedProductDetails from './components/FinishedProductDetails';
import RecipeRequiredIngredientsModal from './modals/RecipeRequiredIngredientsModal';
import ItemSizeOptionList from '../salesCounter/ItemSizeOptionList';

const ItemValidationSchema = Yup.object().shape({
  item_id: Yup.string().required('Required'),
  size_option_id: Yup.string().required('Required'),
  sale_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const SalesRegisterItemForm = props => {
  const {
    item,
    initialValues = {
      size_option_id: '',
      in_option_qty: '',
      sale_qty: '',
    },
    onSubmit,
    onCancel,
  } = props;
  const {colors} = useTheme();

  const formik = useFormik({
    initialValues: {
      item_id: item?.id,
      size_option_id: initialValues.size_option_id?.toString() || '',
      in_option_qty: initialValues.in_option_qty?.toString() || '',
      sale_qty: initialValues.sale_qty?.toString() || '1',
    },
    validationSchema: ItemValidationSchema,
    onSubmit,
  });

  const handleSizeOptionChange = sizeOption => {
    setValues({
      ...values,
      ...sizeOption,
      size_option_id: sizeOption.option_id, // alias for option_id
    });
  };

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

  const buttonWidth = 57;
  const buttonHeight = 57;

  if (!item) return null;

  return (
    <>
      <View style={{marginTop: 15, marginBottom: 15, marginHorizontal: 10}}>
        <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.dark}}>
          {item.name}
        </Text>
      </View>
      <ItemSizeOptionList
        itemId={item?.id}
        item={item}
        onChange={handleSizeOptionChange}
        listContentContainerStyle={{marginBottom: 20}}
      />
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
          <MaterialCommunityIcons name="minus" size={37} color={colors.dark} />
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
              borderColor: colors.neutralTint3,
              height: buttonHeight,
              width: buttonWidth,
            },
          ]}
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
          <MaterialCommunityIcons name="plus" size={37} color={colors.dark} />
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
          disabled={!dirty || (dirty && !isValid) || isSubmitting}
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

export default SalesRegisterItemForm;
