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
  Portal,
  Title,
  Modal as RNPaperModal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {useQuery} from '@tanstack/react-query';
import convert from 'convert-units';
import * as Yup from 'yup';
import DateTimePicker from '@react-native-community/datetimepicker';
import moment from 'moment';
import MonthPicker from 'react-native-month-picker';
import uuid from 'react-native-uuid';

import MoreSelectionButton from '../buttons/MoreSelectionButton';
import {categories, units} from '../../__dummyData';
import useItemFormContext from '../../hooks/useItemFormContext';
import {getCategory} from '../../localDbQueries/categories';
import {getTax} from '../../localDbQueries/taxes';
import routes from '../../constants/routes';
import TaxCalculation from '../taxes/TaxCalculation';
import {getVendor} from '../../localDbQueries/vendors';
import SectionHeading from '../headings/SectionHeading';
import {getItemInitialStockLog} from '../../localDbQueries/inventoryLogs';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import TextInputLabel from './TextInputLabel';
import FormRequiredFieldsHelperText from './FormRequiredFieldsHelperText';
import QuantityUOMText from './QuantityUOMText';
import ConfirmationCheckbox from './ConfirmationCheckbox';
import PreventGoBack from '../utils/PreventGoBack';
import appDefaults from '../../constants/appDefaults';
import ModifierOptionForm from './ModifierOptionForm';
import ItemSellingSizeOptions from './components/ItemSellingSizeOptions';
import {getItemSellingSizeModifierOptions} from '../../localDbQueries/modifiers';
import PressableSectionHeading from '../headings/PressableSectionHeading';

const ItemValidationSchema = Yup.object().shape({
  edit_mode: Yup.boolean(),
  category_id: Yup.string().required('Required'),
  name: Yup.string()
    .min(2, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  uom_abbrev: Yup.string().required('Required'),
  unit_cost: Yup.string().required('Required'),
  total_cost: Yup.string().required('Required'),
  initial_stock_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  low_stock_level: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  add_measurement_per_piece: Yup.boolean(),
  uom_abbrev_per_piece: Yup.string().when('add_measurement_per_piece', {
    is: true,
    then: Yup.string().required(),
    otherwise: Yup.string().notRequired(),
  }),
  set_uom_to_uom_per_piece: Yup.boolean(),
  uom_abbrev_per_piece: Yup.string().when('set_uom_to_uom_per_piece', {
    is: true,
    then: Yup.string().required(),
    otherwise: Yup.string().notRequired(),
  }),
  qty_per_piece: Yup.string().when('uom_abbrev_per_piece', {
    is: uomAbbrevPerPiece => uomAbbrevPerPiece?.length > 0,
    then: Yup.string().required(),
    otherwise: Yup.string().notRequired(),
  }),
  selling_size_options: Yup.array(),
});

const ItemForm = props => {
  const {
    item,
    initialValues = {
      category_id: '',
      tax_id: '',
      vendor_id: '',
      name: '',
      barcode: '',
      uom_id: 2,
      uom_abbrev: '',
      unit_cost: '',
      total_cost: '',
      cost_input_mode: item?.uom_abbrev_per_piece ? 'total_cost' : 'unit_cost', // 'total_cost' or 'unit_cost'
      add_measurement_per_piece: false,
      set_uom_to_uom_per_piece: false,
      uom_abbrev_per_piece: '',
      qty_per_piece: '',
      initial_stock_qty: '',
      low_stock_level: '',
      beginning_inventory_date: '',
      initial_stock_applied_tax_id: '',
      initial_stock_vendor_id: '',
      official_receipt_number: '',
      // sales
      unit_selling_price: '',
      sales_tax_id: '',
      // selling size/qty option
      selling_size_options: [],
      adjustment_qty: '',
      remarks: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useItemFormContext();
  const [
    unitOfMeasurementRequiredDialogVisible,
    setUnitOfMeasurementRequiredDialogVisible,
  ] = useState(false);
  const [
    confirmDeleteSellingSizeOptionDialogVisible,
    setConfirmDeleteSellingSizeOptionDialogVisible,
  ] = useState(false);
  const [updateUOMWarningDialogVisible, setUpdateUOMWarningDialogVisible] =
    useState(false);
  const [
    confirmClearAllSellingSizeOptions,
    setConfirmClearAllSellingSizeOptions,
  ] = useState(false);
  const [addOptionModalVisible, setAddOptionModalVisible] = useState(false);
  const [isInitStockFieldsVisible, setIsInitStockFieldsVisible] = useState(
    // editMode ? false : true,
    false,
  );
  const [isSellingDetailsFieldsVisible, setIsSellingDetailsFieldsVisible] =
    useState(
      // editMode ? false : true,
      false,
    );
  const [categoryId, setCategoryId] = useState(null);
  const [taxId, setTaxId] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const [initStockAppliedTaxId, setInitStockAppliedTaxId] = useState(null);
  const [initStockVendorId, setInitStockVendorId] = useState(null);
  const [salesTaxId, setSalesTaxId] = useState(null);
  const {status: getCategoryStatus, data: getCategoryData} = useQuery(
    ['category', {id: categoryId}],
    getCategory,
    {
      enabled: categoryId ? true : false,
    },
  );
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

  const {status: getItemInitStockLogStatus, data: getItemInitStockLogData} =
    useQuery(
      ['itemInitialStockLog', {itemId: item?.item_id}],
      getItemInitialStockLog,
      {
        enabled:
          editMode && item?.item_id && !item?.is_finished_product
            ? true
            : false,
      },
    );

  const {
    status: getInitStockAppliedTaxStatus,
    data: getInitStockAppliedTaxData,
    isFetching: getInitStockAppliedTaxIsFetching,
  } = useQuery(['initStockAppliedTax', {id: initStockAppliedTaxId}], getTax, {
    enabled: initStockAppliedTaxId ? true : false,
  });

  const {
    status: getInitStockVendorStatus,
    data: getInitStockVendorData,
    isFetching: getInitStockVendorIsFetching,
  } = useQuery(['initStockVendor', {id: initStockVendorId}], getVendor, {
    enabled: initStockVendorId ? true : false,
  });

  const {
    status: getSalesTaxStatus,
    data: getSalesTaxData,
    isFetching: getSalesTaxIsFetching,
  } = useQuery(['salesTax', {id: salesTaxId}], getTax, {
    enabled: salesTaxId ? true : false,
  });

  const {
    status: getItemSellingSizeModifierOptionsStatus,
    data: getItemSellingSizeModifierOptionsData,
  } = useQuery(
    ['itemSellingSizeModifierOptions', {itemId: item?.item_id}],
    getItemSellingSizeModifierOptions,
    {
      enabled: editMode && item?.item_id ? true : false,
    },
  );

  const defaultDate = initialValues.beginning_inventory_date
    ? new Date(initialValues.beginning_inventory_date?.split(' ')?.[0])
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
  const [showMonthPicker, setShowMonthPicker] = useState(false);

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

  useEffect(() => {
    const itemInitStockLog = getItemInitStockLogData?.result;
    if (itemInitStockLog) {
      setDate(
        () =>
          new Date(itemInitStockLog.beginning_inventory_date?.split(' ')?.[0]),
      );
    }
  }, [getItemInitStockLogData]);

  const [focusedSellingSizeOption, setFocusedSellingSizeOption] =
    useState(null);

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

  const handleMonthChange = selectedDate => {
    setDate(() => new Date(selectedDate));
  };

  const handlePressQuantityInput = () => {
    navigation.navigate('ManageStock', {item});
  };

  const handleCategoryChange = categoryId => {
    setCategoryId(() => categoryId);
  };

  const handleTaxChange = taxId => {
    setTaxId(() => taxId);
  };

  const handleVendorChange = vendorId => {
    setVendorId(() => vendorId);
  };

  const handleInitStockAppliedTaxChange = taxId => {
    setInitStockAppliedTaxId(() => taxId);
  };

  const handleInitStockVendorChange = vendorId => {
    setInitStockVendorId(() => vendorId);
  };

  const handleSalesTaxChange = taxId => {
    setSalesTaxId(() => taxId);
  };

  const renderMeasurementPerPieceButton = formikProps => {
    const {
      setFieldValue,
      values,
      errors,
      touched,
      setFieldTouched,
      setFieldError,
    } = formikProps;

    if (
      (!editMode &&
        values.uom_abbrev === 'ea' &&
        values.add_measurement_per_piece) ||
      (editMode &&
        item.uom_abbrev === 'ea' &&
        !item.uom_abbrev_per_piece &&
        !item.qty_per_piece &&
        values.add_measurement_per_piece) ||
      (editMode &&
        item.uom_abbrev !== 'ea' &&
        values.set_uom_to_uom_per_piece === true) || // readonly
      (editMode &&
        item.uom_abbrev === 'ea' &&
        item.uom_abbrev_per_piece &&
        item.qty_per_piece) // readonly mode
    ) {
      const isReadOnly =
        (editMode &&
          (item.uom_abbrev === 'ea' &&
          item.uom_abbrev_per_piece &&
          item.qty_per_piece
            ? true
            : false)) ||
        (editMode &&
        item.uom_abbrev !== 'ea' &&
        values.set_uom_to_uom_per_piece === true
          ? true
          : false);

      return (
        <MoreSelectionButton
          containerStyle={{marginTop: -1}}
          placeholder="Select Unit"
          label="UOM Per Piece (Per Package)"
          required
          disabled={isReadOnly}
          renderValueCurrentValue={values.uom_abbrev_per_piece}
          renderValue={(_value, renderingValueProps) =>
            renderUOMValue(values.uom_abbrev_per_piece, renderingValueProps)
          }
          onPress={() => {
            setFormikActions(() => ({
              setFieldValue,
              setFieldTouched,
              setFieldError,
            }));

            navigation.navigate('ItemUOM', {
              uom_abbrev: values.uom_abbrev_per_piece,
              uom_abbrev_field_key: 'uom_abbrev_per_piece',
            });
          }}
          error={
            errors.uom_abbrev_per_piece && touched.uom_abbrev_per_piece
              ? true
              : false
          }
        />
      );
    }
  };

  const renderQuantityPerPieceInput = formikProps => {
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
    } = formikProps;

    if (
      (!editMode &&
        values.uom_abbrev === 'ea' &&
        values.add_measurement_per_piece) ||
      (editMode &&
        item.uom_abbrev === 'ea' &&
        !item.uom_abbrev_per_piece &&
        !item.qty_per_piece &&
        values.add_measurement_per_piece) ||
      (editMode &&
        item.uom_abbrev !== 'ea' &&
        values.set_uom_to_uom_per_piece === true) ||
      (editMode && item.uom_abbrev === 'ea' && item.uom_abbrev_per_piece)
    ) {
      const isReadOnly = false;

      return (
        <View style={{flexDirection: 'row'}}>
          <TextInput
            label={
              <TextInputLabel
                label="Qty. Per Piece / Item Net Wt."
                required
                disabled={isReadOnly || editMode}
                error={
                  errors.qty_per_piece && touched.qty_per_piece ? true : false
                }
              />
            }
            disabled={isReadOnly || editMode}
            onChangeText={handleChange('qty_per_piece')}
            onBlur={handleBlur('qty_per_piece')}
            value={values.qty_per_piece}
            style={[styles.textInput, {flex: 1}]}
            keyboardType="numeric"
            error={errors.qty_per_piece && touched.qty_per_piece ? true : false}
          />
          <QuantityUOMText
            textStyle={isReadOnly || editMode ? {color: colors.disabled} : {}}
            uomAbbrev={values.uom_abbrev_per_piece}
            quantity={values.qty_per_piece}
            concatText={' each'}
          />
        </View>
      );
    }
  };

  const renderAddMeasurementPerPieceCheckbox = formikProps => {
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
      setErrors,
    } = formikProps;

    if (
      (editMode &&
        item.uom_abbrev === 'ea' &&
        !item.uom_abbrev_per_piece &&
        !item.qty_per_piece) ||
      (!editMode && values.uom_abbrev === 'ea')
    ) {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.add_measurement_per_piece}
            text="Set a UOM Per Piece / Item Net Wt."
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
              if (values.add_measurement_per_piece === true) {
                /**
                 * Reset measurement per piece field values
                 */
                setFieldValue('uom_abbrev_per_piece', '');
                setFieldTouched('uom_abbrev_per_piece', false);
                setFieldError('uom_abbrev_per_piece', null);

                setFieldValue('qty_per_piece', '');
                setFieldTouched('qty_per_piece', false);
                setFieldError('qty_per_piece', null);

                setFieldTouched('add_measurement_per_piece', true);
                setFieldValue('add_measurement_per_piece', false);
              } else {
                setFieldValue('uom_abbrev_per_piece', '');
                setFieldValue('qty_per_piece', '');

                setFieldTouched('add_measurement_per_piece', true);
                setFieldValue('add_measurement_per_piece', true);

                // set cost input mode to total_cost
                setFieldValue('cost_input_mode', 'total_cost');
              }
            }}
          />
          <HelperText
            visible={true}
            style={{
              color: colors.dark,
              fontStyle: 'italic',
              marginVertical: 5,
            }}>
            {
              <Text style={{fontStyle: 'italic'}}>
                {`* You can set a UOM (unit of measurement) per piece if this item has another unit in each package. e.g., You have 12 PC of 1.5 KG Cheese. Tick the checkbox, and then below, you can set "KG" as item UOM per Piece, and 1.5 as its Quantity per Piece (or Item Net Wt.).`}
              </Text>
            }
          </HelperText>
        </View>
      );
    }
  };

  const renderSetUOMToUOMPerPieceCheckbox = formikProps => {
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
      setErrors,
    } = formikProps;

    if (editMode && item.uom_abbrev !== 'ea') {
      return (
        <View style={{marginVertical: 10}}>
          <ConfirmationCheckbox
            status={values.set_uom_to_uom_per_piece}
            text="Convert current UOM to UOM Per Piece"
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={() => {
              if (values.set_uom_to_uom_per_piece === true) {
                /**
                 * Reset measurement per piece field values
                 */
                setFieldValue('uom_abbrev_per_piece', '');
                setFieldTouched('uom_abbrev_per_piece', false);
                setFieldError('uom_abbrev_per_piece', null);

                setFieldValue('qty_per_piece', '');
                setFieldTouched('qty_per_piece', false);
                setFieldError('qty_per_piece', null);

                setFieldTouched('set_uom_to_uom_per_piece', true);
                setFieldValue('set_uom_to_uom_per_piece', false);
              } else {
                setFieldValue('uom_abbrev', 'ea');

                setFieldValue('uom_abbrev_per_piece', item.uom_abbrev);

                setFieldValue('qty_per_piece', '');

                setFieldTouched('set_uom_to_uom_per_piece', true);
                setFieldValue('set_uom_to_uom_per_piece', true);
              }
            }}
          />
          <HelperText
            visible={true}
            style={{
              color: colors.dark,
              fontStyle: 'italic',
              marginVertical: 5,
            }}>
            {
              <Text style={{fontStyle: 'italic'}}>
                {`* You can convert this item's current UOM (unit of measurement) to UOM Per Piece if this item's current UOM is based on the unit of each package. e.g., This item is an existing 18 KG of Cheese and you want it to convert to 12 PC of 1.5 KG Cheese. Tick the checkbox, and then below, the "KG" will be set as item UOM Per Piece, and you can set the 1.5 as its Quantity per Piece (or Item Net Wt.).`}
              </Text>
            }
          </HelperText>
        </View>
      );
    }
  };

  const renderQuantityInput = formikProps => {
    const {
      handleChange,
      handleBlur,
      setFieldValue,
      values,
      errors,
      touched,
      setFieldTouched,
      setFieldError,
    } = formikProps;

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
      <View style={{flexDirection: 'row'}}>
        <TextInput
          style={[styles.textInput, {flex: 1}]}
          label={
            <TextInputLabel
              label={`Pre-${appDefaults.appDisplayName} Total Stock Quantity`}
              required
              error={
                errors.initial_stock_qty && touched.initial_stock_qty
                  ? true
                  : false
              }
            />
          }
          onChangeText={value => {
            const initialStockQty = parseFloat(value || 0);

            if (values.cost_input_mode === 'total_cost') {
              const totalCost = parseFloat(values?.total_cost || 0);
              const calculatedUnitCost =
                totalCost && initialStockQty ? totalCost / initialStockQty : 0;

              setFieldValue('unit_cost', calculatedUnitCost?.toString());
            }

            if (values.cost_input_mode === 'unit_cost') {
              const unitCost = parseFloat(values.unit_cost || 0);
              const calculatedTotalCost = unitCost * initialStockQty;

              setFieldValue('total_cost', calculatedTotalCost?.toString());
            }

            handleChange('initial_stock_qty')(value);
          }}
          onBlur={handleBlur('initial_stock_qty')}
          value={values.initial_stock_qty}
          keyboardType="numeric"
          error={
            errors.initial_stock_qty && touched.initial_stock_qty ? true : false
          }
        />
        <QuantityUOMText
          uomAbbrev={values.uom_abbrev}
          quantity={values.initial_stock_qty}
        />
      </View>
    );
  };

  const renderItemDefaultTaxButton = formikProps => {
    const {
      handleChange,
      setFieldValue,
      values,
      errors,
      touched,
      setFieldTouched,
      setFieldError,
    } = formikProps;

    if (editMode) {
      return (
        <MoreSelectionButton
          containerStyle={{marginTop: -1}}
          placeholder="Select Tax"
          label="Item Default Tax"
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
      );
    }
  };

  const renderCategoryValue = (status, data, props) => {
    if (!categoryId) return null;

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
        {props?.trimTextLength(data.result?.name)}
      </Subheading>
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

  const renderUOMValue = (unitAbbrev, props) => {
    if (!unitAbbrev) return null;

    const UOM =
      unitAbbrev === 'ea' ? 'Piece' : convert().describe(unitAbbrev).singular;

    return (
      <Subheading {...props}>{props?.trimTextLength(`${UOM}`)}</Subheading>
    );
  };

  const renderTaxCalculation = values => {
    const tax = getInitStockAppliedTaxData?.result;

    return (
      <TaxCalculation
        item={values}
        tax={tax}
        taxAmountLabel={`Pre-${appDefaults.appDisplayName} Tax Amount`}
        containerStyle={{marginTop: -1}}
      />
    );
  };

  const renderDeletedInitStockAppliedTax = () => {
    let deletedInitialStockAppliedTax = null;

    if (!editMode) return null;

    if (
      getItemInitStockLogStatus === 'loading' ||
      getInitStockAppliedTaxStatus === 'loading'
    ) {
      return null;
    }

    if (
      getItemInitStockLogStatus === 'error' ||
      getInitStockAppliedTaxStatus === 'error'
    ) {
      return null;
    }

    const itemInitStockLog = getItemInitStockLogData?.result;
    const initStockAppliedTax = getInitStockAppliedTaxData?.result;

    if (!itemInitStockLog) return null;

    if (
      itemInitStockLog.ref_tax_id &&
      parseInt(initStockAppliedTaxId) !== 0 &&
      !initStockAppliedTax
    ) {
      deletedInitialStockAppliedTax = {
        name: itemInitStockLog.adjustment_tax_name,
        rate_percentage: itemInitStockLog.adjustment_tax_rate_percentage,
      };
    }

    if (!deletedInitialStockAppliedTax) return null;

    return (
      <HelperText
        visible={true}
        style={{
          color: colors.dark,
          fontStyle: 'italic',
          marginVertical: 5,
        }}>
        {
          <Text style={{fontStyle: 'italic'}}>
            {`* This item's Pre-${appDefaults.appDisplayName} stock has`}{' '}
          </Text>
        }
        {
          <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
            {`${deletedInitialStockAppliedTax?.name} (${deletedInitialStockAppliedTax?.rate_percentage}%)`}
          </Text>
        }{' '}
        tax applied on it. You can select a new tax to update if only needed.
      </HelperText>
    );
  };

  const renderDeletedInitStockVendor = () => {
    let deletedInitialStockVendor = null;

    if (!editMode) return null;

    if (
      getItemInitStockLogStatus === 'loading' ||
      getInitStockVendorStatus === 'loading'
    ) {
      return null;
    }

    if (
      getItemInitStockLogStatus === 'error' ||
      getInitStockVendorStatus === 'error'
    ) {
      return null;
    }

    const itemInitStockLog = getItemInitStockLogData?.result;
    const initStockVendor = getInitStockVendorData?.result;

    if (!itemInitStockLog) return null;

    if (
      itemInitStockLog.ref_vendor_id &&
      parseInt(initStockVendorId) !== 0 &&
      !initStockVendor
    ) {
      deletedInitialStockVendor = {
        vendor_display_name: itemInitStockLog.vendor_display_name,
      };
    }

    if (!deletedInitialStockVendor) return null;

    return (
      <HelperText
        visible={true}
        style={{
          color: colors.dark,
          fontStyle: 'italic',
          marginVertical: 5,
        }}>
        {<Text style={{fontStyle: 'italic'}}>{`* `}</Text>}
        {
          <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
            {`${deletedInitialStockVendor?.vendor_display_name}`}
          </Text>
        }{' '}
        {`vendor of this item's Pre-${appDefaults.appDisplayName} stock was deleted. You can select a new vendor to update if only needed.`}
      </HelperText>
    );
  };

  const renderInitStockFields = (status, data, formikProps) => {
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
    } = formikProps;

    if (!isInitStockFieldsVisible) return null;

    if (editMode && status === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (editMode && status === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const itemInitStockLog = data?.result;
    if (editMode && !itemInitStockLog) return null;

    let deletedInitialStockAppliedTax = null;
    let deletedInitialStockVendor = null;

    if (getInitStockAppliedTaxStatus === 'success') {
      const initStockAppliedTax = getInitStockAppliedTaxData?.result;

      if (
        itemInitStockLog &&
        itemInitStockLog.ref_tax_id &&
        !initStockAppliedTax
      ) {
        deletedInitialStockAppliedTax = {
          name: itemInitStockLog.adjustment_tax_name,
          rate_percentage: itemInitStockLog.adjustment_tax_rate_percentage,
        };
      }
    }

    if (getInitStockVendorStatus === 'success') {
      const initStockVendor = getInitStockVendorData?.result;

      if (
        itemInitStockLog &&
        itemInitStockLog.ref_vendor_id &&
        !initStockVendor
      ) {
        deletedInitialStockVendor = {
          vendor_display_name: itemInitStockLog.vendor_display_name,
        };
      }
    }

    return (
      <>
        <MoreSelectionButton
          label="Beginning Inventory"
          value={moment(datetimeString.split(' ')[0]).format('MMM YYYY')}
          required
          // containerStyle={{marginTop: -1}}
          onPress={() => {
            setShowMonthPicker(() => true);
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
        {renderQuantityInput(formikProps)}

        <RadioButton.Group
          onValueChange={newValue => {
            if (newValue === 'total_cost') {
              setFieldTouched('unit_cost', false);
            } else if (newValue === 'unit_cost') {
              setFieldTouched('total_cost', false);
            }

            setFieldValue('cost_input_mode', newValue);
          }}
          value={values.cost_input_mode}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={{flexDirection: 'row', flex: 1}}>
              <TextInput
                style={[styles.textInput, {flex: 1}]}
                label={
                  <TextInputLabel
                    label="Unit Cost (Including tax)"
                    required
                    error={errors.unit_cost && touched.unit_cost ? true : false}
                  />
                }
                disabled={
                  values.cost_input_mode === 'total_cost' ? true : false
                }
                onChangeText={value => {
                  const unitCost = parseFloat(value || 0);
                  const initialStockQty = parseFloat(
                    values.initial_stock_qty || 0,
                  );
                  const calculatedTotalCost = unitCost * initialStockQty;

                  setFieldValue('total_cost', calculatedTotalCost?.toString());
                  handleChange('unit_cost')(value);
                }}
                onBlur={handleBlur('unit_cost')}
                value={values.unit_cost}
                keyboardType="numeric"
                error={errors.unit_cost && touched.unit_cost ? true : false}
              />
              <QuantityUOMText
                uomAbbrev={values.uom_abbrev}
                prefixText={'Per '}
                disabled={
                  values.cost_input_mode === 'total_cost' ? true : false
                }
              />
            </View>
            <RadioButton value="unit_cost" color={colors.primary} />
          </View>

          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={{flexDirection: 'row', flex: 1}}>
              <TextInput
                style={[styles.textInput, {flex: 1}]}
                label={
                  <TextInputLabel
                    label="Total Cost (Including tax)"
                    required
                    error={
                      errors.total_cost && touched.total_cost ? true : false
                    }
                  />
                }
                disabled={values.cost_input_mode === 'unit_cost' ? true : false}
                onChangeText={value => {
                  const totalCost = parseFloat(value || 0);
                  const initialStockQty = parseFloat(
                    values.initial_stock_qty || 0,
                  );
                  const calculatedUnitCost =
                    totalCost && initialStockQty
                      ? totalCost / initialStockQty
                      : 0;

                  setFieldValue('unit_cost', calculatedUnitCost?.toString());
                  handleChange('total_cost')(value);
                }}
                onBlur={handleBlur('total_cost')}
                value={values.total_cost}
                keyboardType="numeric"
                error={errors.total_cost && touched.total_cost ? true : false}
              />
              <QuantityUOMText
                quantity={values.initial_stock_qty}
                uomAbbrev={values.uom_abbrev}
                prefixText={'Total '}
                concatText={' Cost'}
                disabled={values.cost_input_mode === 'unit_cost' ? true : false}
              />
            </View>
            <RadioButton value="total_cost" color={colors.primary} />
          </View>
        </RadioButton.Group>

        <MoreSelectionButton
          containerStyle={{marginTop: -2}}
          placeholder="Select Tax"
          label={`Pre-${appDefaults.appDisplayName} Stock Applied Tax`}
          renderValueCurrentValue={values.initial_stock_applied_tax_id}
          renderValue={(_value, renderingValueProps) => {
            if (!initStockAppliedTaxId) return null;
            return renderTaxValue(
              getInitStockAppliedTaxStatus,
              getInitStockAppliedTaxData,
              renderingValueProps,
            );
          }}
          onChangeValue={currentValue => {
            handleInitStockAppliedTaxChange(currentValue);
            handleChange('initial_stock_applied_tax_id')(currentValue);

            // update sales tax as well
            if (currentValue && currentValue !== '0') {
              handleChange('sales_tax_id')(currentValue);
            }
          }}
          onPress={() => {
            setFormikActions(() => ({
              setFieldValue,
              setFieldTouched,
              setFieldError,
            }));

            navigation.navigate(routes.itemTax(), {
              tax_id: values.initial_stock_applied_tax_id,
              tax_id_field_key: 'initial_stock_applied_tax_id',
            });
          }}
          error={
            errors.initial_stock_applied_tax_id &&
            touched.initial_stock_applied_tax_id
              ? true
              : false
          }
        />
        {renderDeletedInitStockAppliedTax()}
        {!deletedInitialStockAppliedTax && renderTaxCalculation(values)}

        <MoreSelectionButton
          containerStyle={{marginTop: -1}}
          placeholder="Select Vendor"
          label={`Pre-${appDefaults.appDisplayName} Vendor`}
          renderValueCurrentValue={values.initial_stock_vendor_id}
          renderValue={(_value, renderingValueProps) => {
            if (!initStockVendorId) return null;
            return renderVendorValue(
              getInitStockVendorStatus,
              getInitStockVendorData,
              renderingValueProps,
            );
          }}
          onChangeValue={currentValue => {
            handleInitStockVendorChange(currentValue);
            handleChange('initial_stock_vendor_id')(currentValue);
          }}
          onPress={() => {
            setFormikActions(() => ({
              setFieldValue,
              setFieldTouched,
              setFieldError,
            }));

            navigation.navigate(routes.itemVendor(), {
              vendor_id: values.initial_stock_vendor_id,
              vendor_id_field_key: 'initial_stock_vendor_id',
            });
          }}
          error={
            errors.initial_stock_vendor_id && touched.initial_stock_vendor_id
              ? true
              : false
          }
        />
        {renderDeletedInitStockVendor()}
        <TextInput
          label={`Pre-${appDefaults.appDisplayName} Stock Official Receipt # (Optional)`}
          onChangeText={handleChange('official_receipt_number')}
          onBlur={handleBlur('official_receipt_number')}
          value={values.official_receipt_number}
          error={
            errors.official_receipt_number && touched.official_receipt_number
              ? true
              : false
          }
        />
        <TextInput
          style={[styles.textInput]}
          label={
            <TextInputLabel
              label="Low Stock Level"
              required
              error={
                errors.low_stock_level && touched.low_stock_level ? true : false
              }
            />
          }
          onChangeText={handleChange('low_stock_level')}
          onBlur={handleBlur('low_stock_level')}
          value={values.low_stock_level}
          keyboardType="numeric"
          error={
            errors.low_stock_level && touched.low_stock_level ? true : false
          }
        />
        <TextInput
          multiline
          label={`Pre-${appDefaults.appDisplayName} Stock Remarks (Optional)`}
          onChangeText={handleChange('remarks')}
          onBlur={handleBlur('remarks')}
          value={values.remarks}
          error={errors.remarks && touched.remarks ? true : false}
        />
      </>
    );
  };

  const renderSellingDetailsFields = formikProps => {
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
    } = formikProps;

    if (!isSellingDetailsFieldsVisible) return null;

    return (
      <>
        {/* <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <View style={{flexDirection: 'row', flex: 1}}>
            <TextInput
              style={[styles.textInput, {flex: 1}]}
              label={
                <TextInputLabel
                  label="Unit Selling Price"
                  required
                  error={
                    errors.unit_selling_price && touched.unit_selling_price
                      ? true
                      : false
                  }
                />
              }
              onChangeText={handleChange('unit_selling_price')}
              onBlur={handleBlur('unit_selling_price')}
              value={values.unit_selling_price}
              keyboardType="numeric"
              error={
                errors.unit_selling_price && touched.unit_selling_price
                  ? true
                  : false
              }
            />
            <QuantityUOMText
              uomAbbrev={values.uom_abbrev}
              prefixText={'Per '}
            />
          </View>
        </View> */}

        <ItemSellingSizeOptions
          listItems={values.selling_size_options}
          listItemKey="option_id"
          containerStyle={{marginTop: 10}}
          onPressItem={() => {}}
          onPressDeleteListItem={(listItem, _index) => {
            setFocusedSellingSizeOption(() => listItem);
            setConfirmDeleteSellingSizeOptionDialogVisible(() => true);
          }}
        />

        <Button
          icon="plus"
          mode="outlined"
          style={{marginTop: 10}}
          onPress={() => {
            if (!values.uom_abbrev) {
              setUnitOfMeasurementRequiredDialogVisible(() => true);
              return;
            }

            setAddOptionModalVisible(() => true);
          }}>
          Add Selling Size Option
        </Button>
      </>
    );
  };

  if (
    editMode &&
    !item?.is_finished_product &&
    getItemInitStockLogStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    editMode &&
    !item?.is_finished_product &&
    getItemInitStockLogStatus === 'error'
  ) {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const itemInitStockLog = getItemInitStockLogData?.result;

  let initialStockQty = initialValues.initial_stock_qty?.toString() || '0';
  let unitCost = initialValues.unit_cost?.toString() || '0';
  let totalCost = '0';
  let initialStockUnitCost =
    editMode && itemInitStockLog
      ? itemInitStockLog.adjustment_unit_cost?.toFixed(2).toString()
      : unitCost;
  let initialStockAppliedTaxId =
    initialValues.initial_stock_applied_tax_id?.toString() || '';
  let initialStockVendorId =
    initialValues.initial_stock_vendor_id?.toString() || '';

  let initialStockOfficialReceiptNumber = initialValues.official_receipt_number;
  let initialStockRemarks = initialValues.remarks || '';

  if (editMode && itemInitStockLog) {
    initialStockQty = itemInitStockLog.adjustment_qty.toString();
    // initial stock unit cost should be the gross cost and not the net unit cost
    initialStockUnitCost = itemInitStockLog.adjustment_unit_cost
      ?.toFixed(2)
      .toString();

    initialStockAppliedTaxId = itemInitStockLog.ref_tax_id?.toString() || '';
    initialStockVendorId = itemInitStockLog.ref_vendor_id?.toString() || '';
    initialStockOfficialReceiptNumber =
      itemInitStockLog.official_receipt_number;
    initialStockRemarks = itemInitStockLog.remarks;
  }

  if (itemInitStockLog) {
    totalCost =
      (
        parseFloat(itemInitStockLog.adjustment_unit_cost) *
        parseFloat(itemInitStockLog.adjustment_qty)
      ).toString() || '0';
  }

  let sellingSizeOptions =
    editMode && getItemSellingSizeModifierOptionsData?.result?.length
      ? getItemSellingSizeModifierOptionsData.result
      : initialValues.selling_size_options || [];

  const formik = useFormik({
    initialValues: {
      edit_mode: editMode,
      category_id: initialValues.category_id?.toString() || '',
      tax_id: initialValues.tax_id?.toString() || '',
      vendor_id: initialValues.vendor_id?.toString() || '',
      name: initialValues.name || '',
      barcode: initialValues.barcode || '',
      uom_id: initialValues.uom_id?.toString() || '',
      uom_abbrev: initialValues.uom_abbrev || '',
      unit_cost: initialStockUnitCost,
      total_cost: totalCost,
      cost_input_mode: initialValues.cost_input_mode || 'unit_cost', // 'total_cost' or 'unit_cost'
      add_measurement_per_piece: false,
      set_uom_to_uom_per_piece: false,
      uom_abbrev_per_piece: initialValues.uom_abbrev_per_piece || '',
      qty_per_piece: initialValues.qty_per_piece?.toString() || '',
      initial_stock_unit_cost: initialStockUnitCost,
      initial_stock_qty: initialStockQty,
      low_stock_level: initialValues.low_stock_level?.toString() || '0',
      beginning_inventory_date: datetimeString,
      initial_stock_applied_tax_id: initialStockAppliedTaxId,
      initial_stock_vendor_id: initialStockVendorId,
      official_receipt_number: initialStockOfficialReceiptNumber,
      // sales
      unit_selling_price: initialValues.unit_selling_price?.toString() || '0',
      sales_tax_id: initialValues.sales_tax_id?.toString() || '',
      selling_size_options: sellingSizeOptions,
      remarks: initialStockRemarks,
    },
    validationSchema: ItemValidationSchema,
    onSubmit,
  });

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
    setValues,
  } = formik;

  let itemDetailsHeadingText = editMode
    ? 'Update Item Details'
    : 'Item Details';

  let itemBasicSettingsHeadingText = editMode
    ? 'Update Item Basic Settings'
    : 'Item Basic Settings';

  let initStockSectionHeadingText = editMode
    ? `Update Pre-${appDefaults.appDisplayName} Stock & Cost`
    : `Input Pre-${appDefaults.appDisplayName} Stock Cost & Tax`;

  let sellingDetailsHeadingText = editMode
    ? 'Update Selling Price'
    : 'Input Selling Price';

  return (
    <>
      {/* Old version uses DateTimePicker */}
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

            handleChange('beginning_inventory_date')(selectedDateStringFormat);
          }}
        />
      )}

      {showMonthPicker && (
        <Modal
          transparent
          animationType="fade"
          visible={showMonthPicker}
          onRequestClose={() => {
            setShowMonthPicker(() => false);
          }}>
          <View style={styles.modalContentContainer}>
            <View style={styles.modalContent}>
              <MonthPicker
                selectedDate={date}
                onMonthChange={selectedValue => {
                  const selectedDate = new Date(selectedValue);

                  handleMonthChange(selectedDate);

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
                currentMonthTextStyle={{
                  color: colors.accent,
                  fontWeight: 'bold',
                }}
                selectedBackgroundColor={colors.accent}
                yearTextStyle={{
                  fontWeight: 'bold',
                  fontSize: 20,
                  color: colors.dark,
                }}
              />
              <Button
                onPress={() => setShowMonthPicker(() => false)}
                style={styles.modalConfirmButton}>
                OK
              </Button>
            </View>
          </View>
        </Modal>
      )}

      <Portal>
        <Dialog
          visible={unitOfMeasurementRequiredDialogVisible}
          onDismiss={() =>
            setUnitOfMeasurementRequiredDialogVisible(() => false)
          }>
          <Dialog.Title>Item UOM is required!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Set the Unit of Measurement of the item above first before adding
              a selling size option.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() =>
                setUnitOfMeasurementRequiredDialogVisible(() => false)
              }>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={updateUOMWarningDialogVisible}
          onDismiss={() => {
            setUpdateUOMWarningDialogVisible(() => false);
            setConfirmClearAllSellingSizeOptions(() => false);
          }}>
          <Dialog.Title>Attention!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Please note that changing the item's unit of measurement will
              delete the selling size options you added below. This prevents
              conflicts between the item's unit of measurement and its
              associated selling size options. You can re-create selling size
              options for this item from scratch as needed.
            </Paragraph>
            <ConfirmationCheckbox
              status={confirmClearAllSellingSizeOptions}
              text="Clear size options listed below"
              onPress={() => {
                setConfirmClearAllSellingSizeOptions(
                  !confirmClearAllSellingSizeOptions,
                );
              }}
            />
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              color={
                confirmClearAllSellingSizeOptions
                  ? colors.notification
                  : colors.disabled
              }
              disabled={confirmClearAllSellingSizeOptions ? false : true}
              onPress={() => {
                if (!confirmClearAllSellingSizeOptions) return;

                // delete selling size options
                setValues({
                  ...values,
                  selling_size_options: [],
                });

                setFormikActions(() => ({
                  setFieldValue,
                  setFieldTouched,
                  setFieldError,
                }));

                navigation.navigate('ItemUOM', {
                  uom_abbrev: values.uom_abbrev,
                  uom_abbrev_field_key: 'uom_abbrev',
                  is_uom_abbrev_required: true,
                });

                setUpdateUOMWarningDialogVisible(() => false);
              }}>
              Edit now
            </Button>
            <Button
              onPress={() => {
                setUpdateUOMWarningDialogVisible(() => false);
                setConfirmClearAllSellingSizeOptions(() => false);
              }}>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={confirmDeleteSellingSizeOptionDialogVisible}
          onDismiss={() =>
            setConfirmDeleteSellingSizeOptionDialogVisible(() => false)
          }>
          <Dialog.Title>Delete selling size option?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Are you sure you want to delete ${
                focusedSellingSizeOption?.option_name
                  ? `"${focusedSellingSizeOption?.option_name}" `
                  : ''
              }selling size option?`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              icon="delete"
              color={colors.notification}
              onPress={() => {
                if (!focusedSellingSizeOption) return;

                let sellingSizeOptions = values.selling_size_options || [];

                let filteredSellingSizeOptions = sellingSizeOptions.filter(
                  option =>
                    option.option_id != focusedSellingSizeOption.option_id,
                );

                setFieldValue(
                  'selling_size_options',
                  filteredSellingSizeOptions,
                );

                setFocusedSellingSizeOption(() => null);

                setConfirmDeleteSellingSizeOptionDialogVisible(() => false);
              }}>
              Delete
            </Button>
            <Button
              onPress={() =>
                setConfirmDeleteSellingSizeOptionDialogVisible(() => false)
              }>
              Cancel
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <RNPaperModal
          visible={addOptionModalVisible}
          onDismiss={() => setAddOptionModalVisible(false)}
          contentContainerStyle={{
            backgroundColor: colors.surface,
            padding: 10,
            paddingVertical: 20,
          }}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Size/Quantity Option
          </Title>

          <ModifierOptionForm
            itemId={item?.id}
            initialValues={{
              in_option_qty_uom_abbrev: values.uom_abbrev,
              uom_abbrev_per_piece: values.uom_abbrev_per_piece,
              qty_per_piece: values.qty_per_piece,
            }}
            onSubmit={(formValues, formActions) => {
              console.log(formValues);

              if (!formValues.option_id) {
                formValues.option_id = `temp_id_${uuid.v4()}`;
              }

              let sellingSizeOptions = values.selling_size_options || [];
              sellingSizeOptions.push(formValues);

              setFieldValue('selling_size_options', sellingSizeOptions);
              setAddOptionModalVisible(() => false);
              formActions.resetForm();
            }}
            onCancel={() => setAddOptionModalVisible(false)}
          />
        </RNPaperModal>
      </Portal>

      <FormRequiredFieldsHelperText />

      <PreventGoBack navigation={navigation} hasUnsavedChanges={dirty} />

      <SectionHeading
        headingText={itemDetailsHeadingText}
        containerStyle={{marginTop: 15}}
      />
      <MoreSelectionButton
        placeholder="Select Category"
        label="Category"
        required
        renderValueCurrentValue={values.category_id}
        renderValue={(_value, renderingValueProps) =>
          renderCategoryValue(
            getCategoryStatus,
            getCategoryData,
            renderingValueProps,
          )
        }
        onChangeValue={currentValue => {
          handleCategoryChange(currentValue);
          handleChange('category_id')(currentValue);
        }}
        onPress={() => {
          setFormikActions(() => ({
            setFieldValue,
            setFieldTouched,
            setFieldError,
          }));

          navigation.navigate(routes.itemCategory(), {
            category_id: values.category_id,
          });
        }}
        error={errors.category_id && touched.category_id ? true : false}
      />
      <TextInput
        style={styles.textInput}
        label={
          <TextInputLabel
            label="Item Name"
            required
            error={errors.name && touched.name ? true : false}
          />
        }
        onChangeText={handleChange('name')}
        onBlur={handleBlur('name')}
        value={values.name}
        error={errors.name && touched.name ? true : false}
        autoCapitalize="words"
      />

      <View style={{flexDirection: 'row'}}>
        <TextInput
          label="Item Barcode (Optional)"
          onChangeText={handleChange('barcode')}
          onBlur={handleBlur('barcode')}
          value={values.barcode}
          style={[styles.textInput, {flex: 1}]}
        />
        <MaterialCommunityIcons
          name="barcode-scan"
          size={25}
          color={colors.dark}
          style={{position: 'absolute', top: 18, right: 15}}
        />
      </View>
      <MoreSelectionButton
        containerStyle={{marginTop: -2}}
        placeholder="Select Unit"
        label="Unit of Measurement"
        disabled={editMode ? true : false}
        required
        renderValueCurrentValue={values.uom_abbrev}
        renderValue={(_value, renderingValueProps) =>
          renderUOMValue(values.uom_abbrev, renderingValueProps)
        }
        onPress={() => {
          // show update UOM warning
          if (values.selling_size_options?.length > 0) {
            setUpdateUOMWarningDialogVisible(() => true);
            return;
          }

          setFormikActions(() => ({
            setFieldValue,
            setFieldTouched,
            setFieldError,
          }));

          navigation.navigate('ItemUOM', {
            uom_abbrev: values.uom_abbrev,
            uom_abbrev_field_key: 'uom_abbrev',
            is_uom_abbrev_required: true,
          });
        }}
        error={errors.uom_abbrev && touched.uom_abbrev ? true : false}
      />
      {renderAddMeasurementPerPieceCheckbox(formik)}
      {renderSetUOMToUOMPerPieceCheckbox(formik)}
      {renderMeasurementPerPieceButton(formik)}
      {renderQuantityPerPieceInput(formik)}

      {!item?.is_finished_product && (
        <SectionHeading
          headingText={initStockSectionHeadingText}
          containerStyle={{marginTop: 20}}
          switchVisible={true}
          switchValue={isInitStockFieldsVisible}
          onSwitchValueChange={() => {
            setIsInitStockFieldsVisible(() => !isInitStockFieldsVisible);
          }}
        />
      )}

      {!item?.is_finished_product &&
        renderInitStockFields(
          getItemInitStockLogStatus,
          getItemInitStockLogData,
          formik,
        )}

      {editMode ? (
        <PressableSectionHeading
          headingText={sellingDetailsHeadingText}
          containerStyle={{marginTop: 20}}
          onPress={() => {
            navigation.navigate(routes.itemSizeOptions(), {
              item_id: item?.id,
            });
          }}
        />
      ) : (
        <SectionHeading
          headingText={sellingDetailsHeadingText}
          containerStyle={{marginTop: 20}}
          switchVisible={true}
          switchValue={isSellingDetailsFieldsVisible}
          onSwitchValueChange={() => {
            setIsSellingDetailsFieldsVisible(
              () => !isSellingDetailsFieldsVisible,
            );
          }}
        />
      )}

      {renderSellingDetailsFields(formik)}

      <Button
        mode="contained"
        onPress={handleSubmit}
        disabled={!dirty || !isValid || isSubmitting}
        loading={isSubmitting}
        style={{marginTop: 40}}>
        {editMode ? 'Save Changes' : 'Save'}
      </Button>
      <Button
        onPress={() => {
          navigation.goBack();
        }}
        style={{marginTop: 10, marginBottom: 25}}>
        Cancel
      </Button>
    </>
  );
};

const styles = StyleSheet.create({
  textInput: {},
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

export default ItemForm;
