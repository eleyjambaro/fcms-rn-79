import React, {useState, useEffect} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  ActivityIndicator,
  Checkbox,
  Switch,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {Formik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import * as Yup from 'yup';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';

import MoreSelectionButton from '../buttons/MoreSelectionButton';
import {categories, units} from '../../__dummyData';
import useItemFormContext from '../../hooks/useItemFormContext';
import {getCategory} from '../../localDbQueries/categories';
import {getTax} from '../../localDbQueries/taxes';
import routes from '../../constants/routes';
import TaxCalculation from '../taxes/TaxCalculation';
import {getVendor} from '../../localDbQueries/vendors';
import SectionHeading from '../headings/SectionHeading';

const ItemInitStockValidationSchema = Yup.object().shape({
  category_id: Yup.string().required('Required'),
  name: Yup.string()
    .min(2, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  uom_abbrev: Yup.string().required('Required'),
  unit_cost: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  initial_stock_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  low_stock_level: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const ItemInitialStockForm = props => {
  const {
    item,
    initialValues = {
      tax_id: '',
      vendor_id: '',
      unit_cost: '',
      initial_stock_qty: '',
      low_stock_level: '',
      beginning_inventory_date: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useItemFormContext();
  const [taxId, setTaxId] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const {status: getTaxStatus, data: getTaxData} = useQuery(
    ['tax', {id: taxId}],
    getTax,
    {
      enabled: taxId ? true : false,
    },
  );
  const {status: getVendorStatus, data: getVendorData} = useQuery(
    ['vendor', {id: vendorId}],
    getVendor,
    {
      enabled: vendorId ? true : false,
    },
  );

  const defaultDate = item?.beginning_inventory_date
    ? new Date(item.beginning_inventory_date?.split(' ')?.[0])
    : new Date();

  const [date, setDate] = useState(defaultDate);
  const month = ('0' + (date.getMonth() + 1)).slice(-2);
  const day = ('0' + date.getDate()).slice(-2);
  const year = date.getFullYear();
  const hours = ('0' + date.getHours()).slice(-2);
  const minutes = ('0' + date.getMinutes()).slice(-2);
  const seconds = ('0' + date.getSeconds()).slice(-2);
  const datetimeStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;
  const [datetimeString, setDatetimeString] = useState(datetimeStringFormat);
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);

  useEffect(() => {
    setDatetimeString(currentDatetimeString => {
      const updatedDatetimeString = datetimeStringFormat;
      if (updatedDatetimeString !== currentDatetimeString) {
        return updatedDatetimeString;
      } else {
        return currentDatetimeString;
      }
    });
  }, [date]);

  const showMode = currentMode => {
    setShowCalendar(true);
    setDateTimePickerMode(currentMode);
  };

  const showDatepicker = () => {
    showMode('date');
  };

  const showTimepicker = () => {
    showMode('time');
  };

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleVendorChange = vendorId => {
    setVendorId(() => vendorId);
  };

  const handleTaxChange = taxId => {
    setInitStockAppliedTaxId(() => taxId);
  };

  const renderQuantityInput = props => {
    // if (editMode) {
    //   return (
    //     <Pressable onPress={handlePressQuantityInput}>
    //       <TextInput
    //         label="Initial Stock Quantity"
    //         editable={false}
    //         value={props.values.initial_stock_qty}
    //       />
    //     </Pressable>
    //   );
    // }

    return (
      <TextInput
        style={[styles.textInput]}
        label="Initial Stock Quantity"
        onChangeText={props.handleChange('initial_stock_qty')}
        onBlur={props.handleBlur('initial_stock_qty')}
        value={props.values.initial_stock_qty}
        keyboardType="numeric"
        error={
          props.errors.initial_stock_qty && props.touched.initial_stock_qty
            ? true
            : false
        }
      />
    );
  };

  const renderTaxValue = (status, data, props) => {
    if (status === 'loading') {
      return (
        <ActivityIndicator
          animating={true}
          color={colors.primary}
          style={{marginRight: 5}}
          size="small"
        />
      );
    }

    if (status === 'error') {
      return <Subheading style={props.style}>Something went wrong</Subheading>;
    }

    if (!data || !data.result) return null;

    return (
      <Subheading {...props}>
        {props?.trimTextLength(
          `${data.result?.name} (${data.result?.rate_percentage}%)`,
        )}
      </Subheading>
    );
  };

  const renderVendorValue = (status, data, props) => {
    if (status === 'loading') {
      return (
        <ActivityIndicator
          animating={true}
          color={colors.primary}
          style={{marginRight: 5}}
          size="small"
        />
      );
    }

    if (status === 'error') {
      return <Subheading style={props.style}>Something went wrong</Subheading>;
    }

    if (!data || !data.result) return null;

    return (
      <Subheading {...props}>
        {props?.trimTextLength(`${data.result?.vendor_display_name}`)}
      </Subheading>
    );
  };

  const renderTaxCalculation = values => {
    const tax = getTaxData?.result;

    return (
      <TaxCalculation
        item={values}
        tax={tax}
        containerStyle={{marginTop: -1}}
      />
    );
  };

  return (
    <Formik
      initialValues={{
        tax_id: initialValues.tax_id?.toString() || '',
        vendor_id: initialValues.vendor_id?.toString() || '',
        unit_cost: initialValues.unit_cost?.toString() || '',
        initial_stock_qty: initialValues.initial_stock_qty?.toString() || '',
        low_stock_level: initialValues.low_stock_level?.toString() || '',
        beginning_inventory_date: datetimeString,
      }}
      validationSchema={ItemInitStockValidationSchema}
      onSubmit={onSubmit}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          setFieldValue,
          values,
          errors,
          touched,
          isValid,
          dirty,
          isSubmitting,
          setFieldTouched,
          setFieldError,
        } = props;

        let headingText = editMode
          ? 'Update Initial Stock & Cost'
          : 'Initial Stock Cost & Tax';

        return (
          <>
            {showCalendar && (
              <DateTimePicker
                testID="dateTimePicker"
                value={date}
                mode={dateTimePickerMode}
                is24Hour={true}
                onChange={(_event, selectedDate) => {
                  handleDateTimePickerChange(_event, selectedDate);

                  const month = ('0' + (selectedDate.getMonth() + 1)).slice(-2);
                  const day = ('0' + selectedDate.getDate()).slice(-2);
                  const year = selectedDate.getFullYear();
                  const hours = ('0' + selectedDate.getHours()).slice(-2);
                  const minutes = ('0' + selectedDate.getMinutes()).slice(-2);
                  const seconds = ('0' + selectedDate.getSeconds()).slice(-2);
                  const selectedDateStringFormat = `${year}-${month}-${day} ${hours}:${minutes}:${seconds}`;

                  handleChange('beginning_inventory_date')(
                    selectedDateStringFormat,
                  );
                }}
              />
            )}

            <SectionHeading
              headingText={headingText}
              containerStyle={{marginTop: 20}}
            />

            <MoreSelectionButton
              label="Initial Stock Date"
              value={moment(datetimeString.split(' ')[0]).format(
                'MMM DD, YYYY',
              )}
              // containerStyle={{marginTop: -1}}
              onPress={() => {
                showDatepicker();
              }}
              renderIcon={({iconSize, iconColor}) => {
                return (
                  <MaterialCommunityIcons
                    name="chevron-down"
                    size={iconSize}
                    color={iconColor}
                  />
                );
              }}
            />
            {renderQuantityInput(props)}
            <TextInput
              style={styles.textInput}
              label="Unit Cost (Including tax if item is taxable)"
              onChangeText={handleChange('unit_cost')}
              onBlur={handleBlur('unit_cost')}
              value={values.unit_cost}
              keyboardType="numeric"
              error={errors.unit_cost && touched.unit_cost ? true : false}
            />

            <TextInput
              style={[styles.textInput]}
              label="Low Stock Level"
              onChangeText={handleChange('low_stock_level')}
              onBlur={handleBlur('low_stock_level')}
              value={values.low_stock_level}
              keyboardType="numeric"
              error={
                errors.low_stock_level && touched.low_stock_level ? true : false
              }
            />
            <MoreSelectionButton
              containerStyle={{marginTop: -1}}
              placeholder="Select Tax"
              label="Tax"
              renderValueCurrentValue={values.tax_id}
              renderValue={(_value, renderingValueProps) => {
                if (!taxId) return null;
                return renderTaxValue(
                  getTaxStatus,
                  getTaxData,
                  renderingValueProps,
                );
              }}
              onChangeValue={currentValue => {
                handleTaxChange(currentValue);
                handleChange('tax_id')(currentValue);
              }}
              onPress={() => {
                setFormikActions(() => ({
                  setFieldValue,
                  setFieldTouched,
                  setFieldError,
                }));

                navigation.navigate(routes.itemTax(), {
                  tax_id: values.tax_id,
                  tax_id_field_key: 'tax_id',
                });
              }}
              error={errors.tax_id && touched.tax_id ? true : false}
            />
            {renderTaxCalculation(values)}
            <MoreSelectionButton
              containerStyle={{marginTop: -1}}
              placeholder="Select Vendor"
              label="Vendor"
              renderValueCurrentValue={values.vendor_id}
              renderValue={(_value, renderingValueProps) => {
                if (!vendorId) return null;
                return renderVendorValue(
                  getVendorStatus,
                  getVendorData,
                  renderingValueProps,
                );
              }}
              onChangeValue={currentValue => {
                handleVendorChange(currentValue);
                handleChange('vendor_id')(currentValue);
              }}
              onPress={() => {
                setFormikActions(() => ({
                  setFieldValue,
                  setFieldTouched,
                  setFieldError,
                }));

                navigation.navigate(routes.itemVendor(), {
                  vendor_id: values.vendor_id,
                  vendor_id_field_key: 'vendor_id',
                });
              }}
              error={errors.vendor_id && touched.vendor_id ? true : false}
            />

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={(!editMode && !dirty) || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginVertical: 20}}>
              Save
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  textInput: {},
});

export default ItemInitialStockForm;
