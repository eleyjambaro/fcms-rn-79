import React, {useState, useEffect} from 'react';
import {View, StyleSheet, Modal} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  ActivityIndicator,
  RadioButton,
  HelperText,
  Portal,
  Modal as RNPaperModal,
  Dialog,
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
import appDefaults from '../../constants/appDefaults';
import ModifierOptionForm from './ModifierOptionForm';
import ItemSellingSizeOptions from './components/ItemSellingSizeOptions';
import {getItemSellingSizeModifierOptions} from '../../localDbQueries/modifiers';
import PressableSectionHeading from '../headings/PressableSectionHeading';
import {Dropdown} from 'react-native-paper-dropdown';
import PreventGoBack from '../utils/PreventGoBack';

// ---------------------------------------------------------------------------
// Validation schema
// ---------------------------------------------------------------------------

const ItemValidationSchema = Yup.object({
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
    then: () => Yup.string().required(),
    otherwise: () => Yup.string().notRequired(),
  }),
  set_uom_to_uom_per_piece: Yup.boolean(),
  // Note: uom_abbrev_per_piece is intentionally declared twice (mirrors original)
  uom_abbrev_per_piece: Yup.string().when('set_uom_to_uom_per_piece', {
    is: true,
    then: () => Yup.string().required(),
    otherwise: () => Yup.string().notRequired(),
  }),
  qty_per_piece: Yup.string().when('uom_abbrev_per_piece', {
    is: uomAbbrevPerPiece => uomAbbrevPerPiece?.length > 0,
    then: () => Yup.string().required(),
    otherwise: () => Yup.string().notRequired(),
  }),
  selling_size_options: Yup.array(),
  packaging_type: Yup.string().notRequired(),
});

// ---------------------------------------------------------------------------
// Default initial values factory
// ---------------------------------------------------------------------------

const getDefaultInitialValues = item => ({
  category_id: '',
  tax_id: '',
  vendor_id: '',
  name: '',
  barcode: '',
  uom_id: 2,
  uom_abbrev: '',
  unit_cost: '',
  total_cost: '',
  cost_input_mode: item?.uom_abbrev_per_piece ? 'total_cost' : 'unit_cost',
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
  unit_selling_price: '',
  sales_tax_id: '',
  selling_size_options: [],
  adjustment_qty: '',
  remarks: '',
  packaging_type: '',
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Formats a Date object into "YYYY-MM-DD HH:mm:ss".
 */
const formatDatetimeString = date => {
  const pad = n => ('0' + n).slice(-2);
  return (
    `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
      date.getDate(),
    )} ` +
    `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(
      date.getSeconds(),
    )}`
  );
};

// ---------------------------------------------------------------------------
// Small pure render helpers (no formik coupling)
// ---------------------------------------------------------------------------

const renderLoadingOrError = (status, errorText) => {
  if (status === 'loading') {
    return null; // callers decide what to show while loading
  }
  if (status === 'error') {
    return <Text variant="titleMedium">{errorText}</Text>;
  }
  return null;
};

const ActivityLoader = ({colors}) => (
  <ActivityIndicator
    animating
    color={colors.primary}
    style={{marginRight: 5}}
    size="small"
  />
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PACKAGING_TYPE_OPTIONS = [
  {label: 'None', value: ''},
  {label: 'Bag', value: 'bag'},
  {label: 'Bottle', value: 'bottle'},
  {label: 'Box', value: 'box'},
  {label: 'Bundle', value: 'bundle'},
  {label: 'Can', value: 'can'},
  {label: 'Carton', value: 'carton'},
  {label: 'Crate', value: 'crate'},
  {label: 'Drum', value: 'drum'},
  {label: 'Jar', value: 'jar'},
  {label: 'Pack', value: 'pack'},
  {label: 'Pail', value: 'pail'},
  {label: 'Pouch', value: 'pouch'},
  {label: 'Sack', value: 'sack'},
  {label: 'Tray', value: 'tray'},
  {label: 'Tube', value: 'tube'},
];

const ItemForm = props => {
  const {
    item,
    initialValues = getDefaultInitialValues(item),
    onSubmit,
    editMode = false,
  } = props;

  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useItemFormContext();

  // ---- dialog / modal visibility state ----
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

  // ---- section visibility state ----
  const [isInitStockFieldsVisible, setIsInitStockFieldsVisible] =
    useState(false);
  const [isSellingDetailsFieldsVisible, setIsSellingDetailsFieldsVisible] =
    useState(false);

  // ---- selection ID state (drives react-query) ----
  const [categoryId, setCategoryId] = useState(null);
  const [taxId, setTaxId] = useState(null);
  const [vendorId, setVendorId] = useState(null);
  const [initStockAppliedTaxId, setInitStockAppliedTaxId] = useState(null);
  const [initStockVendorId, setInitStockVendorId] = useState(null);
  const [salesTaxId, setSalesTaxId] = useState(null);

  // ---- date / picker state ----
  const defaultDate = initialValues.beginning_inventory_date
    ? new Date(initialValues.beginning_inventory_date?.split(' ')?.[0])
    : new Date();

  const [date, setDate] = useState(defaultDate);
  const [datetimeString, setDatetimeString] = useState(() =>
    formatDatetimeString(defaultDate),
  );
  const [dateTimePickerMode, setDateTimePickerMode] = useState('date');
  const [showCalendar, setShowCalendar] = useState(false);
  const [showMonthPicker, setShowMonthPicker] = useState(false);

  // ---- selling size option focus ----
  const [focusedSellingSizeOption, setFocusedSellingSizeOption] =
    useState(null);

  // ---- packaging type dropdown ----
  const [showPackagingDropDown, setShowPackagingDropDown] = useState(false);

  // -------------------------------------------------------------------------
  // Queries
  // -------------------------------------------------------------------------

  const {status: getCategoryStatus, data: getCategoryData} = useQuery(
    ['category', {id: categoryId}],
    getCategory,
    {enabled: !!categoryId},
  );

  const {status: getTaxStatus, data: getTaxData} = useQuery(
    ['tax', {id: taxId}],
    getTax,
    {enabled: !!taxId},
  );

  const {status: getVendorStatus, data: getVendorData} = useQuery(
    ['vendor', {id: vendorId}],
    getVendor,
    {enabled: !!vendorId},
  );

  const {status: getItemInitStockLogStatus, data: getItemInitStockLogData} =
    useQuery(
      ['itemInitialStockLog', {itemId: item?.item_id}],
      getItemInitialStockLog,
      {enabled: editMode && !!item?.item_id && !item?.is_finished_product},
    );

  const {
    status: getInitStockAppliedTaxStatus,
    data: getInitStockAppliedTaxData,
  } = useQuery(['initStockAppliedTax', {id: initStockAppliedTaxId}], getTax, {
    enabled: !!initStockAppliedTaxId,
  });

  const {status: getInitStockVendorStatus, data: getInitStockVendorData} =
    useQuery(['initStockVendor', {id: initStockVendorId}], getVendor, {
      enabled: !!initStockVendorId,
    });

  const {status: getSalesTaxStatus, data: getSalesTaxData} = useQuery(
    ['salesTax', {id: salesTaxId}],
    getTax,
    {enabled: !!salesTaxId},
  );

  const {
    status: getItemSellingSizeModifierOptionsStatus,
    data: getItemSellingSizeModifierOptionsData,
  } = useQuery(
    ['itemSellingSizeModifierOptions', {itemId: item?.item_id}],
    getItemSellingSizeModifierOptions,
    {enabled: editMode && !!item?.item_id},
  );

  // -------------------------------------------------------------------------
  // Effects
  // -------------------------------------------------------------------------

  useEffect(() => {
    const formatted = formatDatetimeString(date);
    setDatetimeString(current => (formatted !== current ? formatted : current));
  }, [date]);

  useEffect(() => {
    const itemInitStockLog = getItemInitStockLogData?.result;
    if (itemInitStockLog) {
      setDate(
        new Date(itemInitStockLog.beginning_inventory_date?.split(' ')?.[0]),
      );
    }
  }, [getItemInitStockLogData]);

  // -------------------------------------------------------------------------
  // Event handlers
  // -------------------------------------------------------------------------

  const showMode = mode => {
    setShowCalendar(true);
    setDateTimePickerMode(mode);
  };

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleMonthChange = selectedDate => setDate(new Date(selectedDate));

  const handleCategoryChange = id => setCategoryId(id);
  const handleTaxChange = id => setTaxId(id);
  const handleVendorChange = id => setVendorId(id);
  const handleInitStockAppliedTaxChange = id => setInitStockAppliedTaxId(id);
  const handleInitStockVendorChange = id => setInitStockVendorId(id);
  const handleSalesTaxChange = id => setSalesTaxId(id);

  /** Shared helper: navigate to a selection screen after storing formik actions. */
  const navigateWithFormikActions = (formikActions, routeName, params) => {
    setFormikActions(() => formikActions);
    navigation.navigate(routeName, params);
  };

  // -------------------------------------------------------------------------
  // Value renderers (status → UI node)
  // -------------------------------------------------------------------------

  const renderCategoryValue = (status, data, props) => {
    if (!categoryId) return null;
    if (status === 'loading') return <ActivityLoader colors={colors} />;
    if (status === 'error')
      return (
        <Text variant="titleMedium" style={props.style}>
          Something went wrong
        </Text>
      );
    if (!data?.result) return null;
    return (
      <Text variant="titleMedium" {...props}>
        {props?.trimTextLength(data.result.name)}
      </Text>
    );
  };

  const renderTaxValue = (status, data, props) => {
    if (status === 'loading') return <ActivityLoader colors={colors} />;
    if (status === 'error')
      return (
        <Text variant="titleMedium" style={props.style}>
          Something went wrong
        </Text>
      );
    if (!data?.result) return null;
    return (
      <Text variant="titleMedium" {...props}>
        {props?.trimTextLength(
          `${data.result.name} (${data.result.rate_percentage}%)`,
        )}
      </Text>
    );
  };

  const renderVendorValue = (status, data, props) => {
    if (status === 'loading') return <ActivityLoader colors={colors} />;
    if (status === 'error')
      return (
        <Text variant="titleMedium" style={props.style}>
          Something went wrong
        </Text>
      );
    if (!data?.result) return null;
    return (
      <Text variant="titleMedium" {...props}>
        {props?.trimTextLength(data.result.vendor_display_name)}
      </Text>
    );
  };

  const renderUOMValue = (unitAbbrev, props) => {
    if (!unitAbbrev) return null;
    const UOM =
      unitAbbrev === 'ea' ? 'Piece' : convert().describe(unitAbbrev).singular;
    return (
      <Text variant="titleMedium" {...props}>
        {props?.trimTextLength(UOM)}
      </Text>
    );
  };

  // -------------------------------------------------------------------------
  // Per-piece measurement visibility helpers
  // -------------------------------------------------------------------------

  const shouldShowPerPieceFields = values => {
    const {add_measurement_per_piece, set_uom_to_uom_per_piece, uom_abbrev} =
      values;

    if (!editMode && uom_abbrev === 'ea' && add_measurement_per_piece)
      return true;
    if (
      editMode &&
      item.uom_abbrev === 'ea' &&
      !item.uom_abbrev_per_piece &&
      !item.qty_per_piece &&
      add_measurement_per_piece
    )
      return true;
    if (editMode && item.uom_abbrev !== 'ea' && set_uom_to_uom_per_piece)
      return true;
    if (
      editMode &&
      item.uom_abbrev === 'ea' &&
      item.uom_abbrev_per_piece &&
      item.qty_per_piece
    )
      return true;
    return false;
  };

  const isPerPieceReadOnly = values => {
    if (
      editMode &&
      item.uom_abbrev === 'ea' &&
      item.uom_abbrev_per_piece &&
      item.qty_per_piece
    )
      return true;
    if (editMode && item.uom_abbrev !== 'ea' && values.set_uom_to_uom_per_piece)
      return true;
    return false;
  };

  // -------------------------------------------------------------------------
  // Section renderers
  // -------------------------------------------------------------------------

  const renderMeasurementPerPieceButton = formikProps => {
    const {
      setFieldValue,
      values,
      errors,
      touched,
      setFieldTouched,
      setFieldError,
    } = formikProps;
    if (!shouldShowPerPieceFields(values)) return null;

    const readOnly = isPerPieceReadOnly(values);

    return (
      <MoreSelectionButton
        containerStyle={{marginTop: -1}}
        placeholder="Select Unit"
        label="UOM Per Piece (Per Package)"
        required
        disabled={readOnly}
        renderValueCurrentValue={values.uom_abbrev_per_piece}
        renderValue={(_value, renderingValueProps) =>
          renderUOMValue(values.uom_abbrev_per_piece, renderingValueProps)
        }
        onPress={() =>
          navigateWithFormikActions(
            {setFieldValue, setFieldTouched, setFieldError},
            'ItemUOM',
            {
              uom_abbrev: values.uom_abbrev_per_piece,
              uom_abbrev_field_key: 'uom_abbrev_per_piece',
            },
          )
        }
        error={!!(errors.uom_abbrev_per_piece && touched.uom_abbrev_per_piece)}
      />
    );
  };

  const renderPerPieceFields = formikProps => {
    const {handleChange, handleBlur, setFieldValue, values, errors, touched} =
      formikProps;

    const showQtyPerPiece =
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
        values.set_uom_to_uom_per_piece) ||
      (editMode && item.uom_abbrev === 'ea' && item.uom_abbrev_per_piece);

    const disabled = editMode; // isReadOnly is always false per original

    return (
      <>
        {showQtyPerPiece && (
          <View style={{flexDirection: 'row'}}>
            <TextInput
              label={
                <TextInputLabel
                  label="Qty. Per Piece / Item Net Wt."
                  required
                  disabled={disabled}
                  error={!!(errors.qty_per_piece && touched.qty_per_piece)}
                />
              }
              disabled={disabled}
              onChangeText={handleChange('qty_per_piece')}
              onBlur={handleBlur('qty_per_piece')}
              value={values.qty_per_piece}
              style={[styles.textInput, {flex: 1}]}
              keyboardType="numeric"
              error={!!(errors.qty_per_piece && touched.qty_per_piece)}
            />
            <QuantityUOMText
              textStyle={disabled ? {color: colors.disabled} : {}}
              uomAbbrev={values.uom_abbrev_per_piece}
              quantity={values.qty_per_piece}
              concatText={' each'}
            />
          </View>
        )}

        <Dropdown
          label="Packaging Type (Optional)"
          mode="flat"
          visible={showPackagingDropDown}
          showDropDown={() => setShowPackagingDropDown(true)}
          onDismiss={() => setShowPackagingDropDown(false)}
          value={values.packaging_type}
          hideMenuHeader
          onSelect={value => setFieldValue('packaging_type', value ?? '')}
          options={PACKAGING_TYPE_OPTIONS}
          activeColor={colors.accent}
          dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
        />
      </>
    );
  };

  const renderAddMeasurementPerPieceCheckbox = formikProps => {
    const {setFieldValue, values, setFieldTouched, setFieldError} = formikProps;

    const show =
      (editMode &&
        item.uom_abbrev === 'ea' &&
        !item.uom_abbrev_per_piece &&
        !item.qty_per_piece) ||
      (!editMode && values.uom_abbrev === 'ea');

    if (!show) return null;

    const handleToggle = () => {
      if (values.add_measurement_per_piece) {
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
        setFieldValue('cost_input_mode', 'total_cost');
      }
    };

    return (
      <View style={{marginVertical: 10}}>
        <ConfirmationCheckbox
          status={values.add_measurement_per_piece}
          text="Set a UOM Per Piece / Item Net Wt."
          containerStyle={{paddingTop: 5, paddingBottom: 5}}
          onPress={handleToggle}
        />
        <HelperText
          visible
          style={{color: colors.dark, fontStyle: 'italic', marginVertical: 5}}>
          <Text style={{fontStyle: 'italic'}}>
            {`* You can set a UOM (unit of measurement) per piece if this item has another unit in each package. e.g., You have 12 PC of 1.5 KG Cheese. Tick the checkbox, and then below, you can set "KG" as item UOM per Piece, and 1.5 as its Quantity per Piece (or Item Net Wt.).`}
          </Text>
        </HelperText>
      </View>
    );
  };

  const renderSetUOMToUOMPerPieceCheckbox = formikProps => {
    const {setFieldValue, values, setFieldTouched, setFieldError} = formikProps;

    if (!editMode || item.uom_abbrev === 'ea') return null;

    const handleToggle = () => {
      if (values.set_uom_to_uom_per_piece) {
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
    };

    return (
      <View style={{marginVertical: 10}}>
        <ConfirmationCheckbox
          status={values.set_uom_to_uom_per_piece}
          text="Convert current UOM to UOM Per Piece"
          containerStyle={{paddingTop: 5, paddingBottom: 5}}
          onPress={handleToggle}
        />
        <HelperText
          visible
          style={{color: colors.dark, fontStyle: 'italic', marginVertical: 5}}>
          <Text style={{fontStyle: 'italic'}}>
            {`* You can convert this item's current UOM (unit of measurement) to UOM Per Piece if this item's current UOM is based on the unit of each package. e.g., This item is an existing 18 KG of Cheese and you want it to convert to 12 PC of 1.5 KG Cheese. Tick the checkbox, and then below, the "KG" will be set as item UOM Per Piece, and you can set the 1.5 as its Quantity per Piece (or Item Net Wt.).`}
          </Text>
        </HelperText>
      </View>
    );
  };

  const renderQuantityInput = formikProps => {
    const {handleChange, handleBlur, setFieldValue, values, errors, touched} =
      formikProps;

    return (
      <View style={{flexDirection: 'row'}}>
        <TextInput
          style={[styles.textInput, {flex: 1}]}
          label={
            <TextInputLabel
              label={`Pre-${appDefaults.appDisplayName} Total Stock Quantity`}
              required
              error={!!(errors.initial_stock_qty && touched.initial_stock_qty)}
            />
          }
          onChangeText={value => {
            const initialStockQty = parseFloat(value || 0);

            if (values.cost_input_mode === 'total_cost') {
              const totalCost = parseFloat(values.total_cost || 0);
              const calculatedUnitCost =
                totalCost && initialStockQty ? totalCost / initialStockQty : 0;
              setFieldValue('unit_cost', calculatedUnitCost.toString());
            }

            if (values.cost_input_mode === 'unit_cost') {
              const unitCost = parseFloat(values.unit_cost || 0);
              setFieldValue(
                'total_cost',
                (unitCost * initialStockQty).toString(),
              );
            }

            handleChange('initial_stock_qty')(value);
          }}
          onBlur={handleBlur('initial_stock_qty')}
          value={values.initial_stock_qty}
          keyboardType="numeric"
          error={!!(errors.initial_stock_qty && touched.initial_stock_qty)}
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

    if (!editMode) return null;

    return (
      <MoreSelectionButton
        containerStyle={{marginTop: -1}}
        placeholder="Select Tax"
        label="Item Default Tax"
        renderValueCurrentValue={values.tax_id}
        renderValue={(_value, renderingValueProps) => {
          if (!taxId) return null;
          return renderTaxValue(getTaxStatus, getTaxData, renderingValueProps);
        }}
        onChangeValue={currentValue => {
          handleTaxChange(currentValue);
          handleChange('tax_id')(currentValue);
        }}
        onPress={() =>
          navigateWithFormikActions(
            {setFieldValue, setFieldTouched, setFieldError},
            routes.itemTax(),
            {tax_id: values.tax_id, tax_id_field_key: 'tax_id'},
          )
        }
        error={!!(errors.tax_id && touched.tax_id)}
      />
    );
  };

  const renderTaxCalculation = values => (
    <TaxCalculation
      item={values}
      tax={getInitStockAppliedTaxData?.result}
      taxAmountLabel={`Pre-${appDefaults.appDisplayName} Tax Amount`}
      containerStyle={{marginTop: -1}}
    />
  );

  const renderDeletedInitStockAppliedTax = () => {
    if (!editMode) return null;
    if (
      getItemInitStockLogStatus === 'loading' ||
      getInitStockAppliedTaxStatus === 'loading'
    )
      return null;
    if (
      getItemInitStockLogStatus === 'error' ||
      getInitStockAppliedTaxStatus === 'error'
    )
      return null;

    const itemInitStockLog = getItemInitStockLogData?.result;
    if (!itemInitStockLog) return null;

    const initStockAppliedTax = getInitStockAppliedTaxData?.result;
    const isDeleted =
      itemInitStockLog.ref_tax_id &&
      parseInt(initStockAppliedTaxId) !== 0 &&
      !initStockAppliedTax;

    if (!isDeleted) return null;

    return (
      <HelperText
        visible
        style={{color: colors.dark, fontStyle: 'italic', marginVertical: 5}}>
        <Text style={{fontStyle: 'italic'}}>
          {`* This item's Pre-${appDefaults.appDisplayName} stock has`}{' '}
        </Text>
        <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
          {`${itemInitStockLog.adjustment_tax_name} (${itemInitStockLog.adjustment_tax_rate_percentage}%)`}
        </Text>{' '}
        tax applied on it. You can select a new tax to update if only needed.
      </HelperText>
    );
  };

  const renderDeletedInitStockVendor = () => {
    if (!editMode) return null;
    if (
      getItemInitStockLogStatus === 'loading' ||
      getInitStockVendorStatus === 'loading'
    )
      return null;
    if (
      getItemInitStockLogStatus === 'error' ||
      getInitStockVendorStatus === 'error'
    )
      return null;

    const itemInitStockLog = getItemInitStockLogData?.result;
    if (!itemInitStockLog) return null;

    const initStockVendor = getInitStockVendorData?.result;
    const isDeleted =
      itemInitStockLog.ref_vendor_id &&
      parseInt(initStockVendorId) !== 0 &&
      !initStockVendor;

    if (!isDeleted) return null;

    return (
      <HelperText
        visible
        style={{color: colors.dark, fontStyle: 'italic', marginVertical: 5}}>
        <Text style={{fontStyle: 'italic'}}>{`* `}</Text>
        <Text style={{fontWeight: 'bold', fontStyle: 'italic'}}>
          {itemInitStockLog.vendor_display_name}
        </Text>
        {` vendor of this item's Pre-${appDefaults.appDisplayName} stock was deleted. You can select a new vendor to update if only needed.`}
      </HelperText>
    );
  };

  const renderInitStockFields = (status, data, formikProps) => {
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

    if (!isInitStockFieldsVisible) return null;

    if (editMode && status === 'loading') return <DefaultLoadingScreen />;
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

    // Determine deleted tax / vendor for display
    let deletedInitialStockAppliedTax = null;
    if (
      getInitStockAppliedTaxStatus === 'success' &&
      itemInitStockLog?.ref_tax_id &&
      !getInitStockAppliedTaxData?.result
    ) {
      deletedInitialStockAppliedTax = {
        name: itemInitStockLog.adjustment_tax_name,
        rate_percentage: itemInitStockLog.adjustment_tax_rate_percentage,
      };
    }

    let deletedInitialStockVendor = null;
    if (
      getInitStockVendorStatus === 'success' &&
      itemInitStockLog?.ref_vendor_id &&
      !getInitStockVendorData?.result
    ) {
      deletedInitialStockVendor = {
        vendor_display_name: itemInitStockLog.vendor_display_name,
      };
    }

    const makeFormikNav = routeName => params =>
      navigateWithFormikActions(
        {setFieldValue, setFieldTouched, setFieldError},
        routeName,
        params,
      );

    return (
      <>
        <MoreSelectionButton
          label="Beginning Inventory"
          value={moment(datetimeString.split(' ')[0]).format('MMM YYYY')}
          required
          onPress={() => setShowMonthPicker(true)}
          renderIcon={({iconSize, iconColor}) => (
            <MaterialCommunityIcons
              name="chevron-down"
              size={iconSize}
              color={iconColor}
            />
          )}
        />

        {renderQuantityInput(formikProps)}

        <RadioButton.Group
          onValueChange={newValue => {
            if (newValue === 'total_cost') setFieldTouched('unit_cost', false);
            else if (newValue === 'unit_cost')
              setFieldTouched('total_cost', false);
            setFieldValue('cost_input_mode', newValue);
          }}
          value={values.cost_input_mode}>
          {/* Unit Cost row */}
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={{flexDirection: 'row', flex: 1}}>
              <TextInput
                style={[styles.textInput, {flex: 1}]}
                label={
                  <TextInputLabel
                    label="Unit Cost (Including tax)"
                    required
                    error={!!(errors.unit_cost && touched.unit_cost)}
                  />
                }
                disabled={values.cost_input_mode === 'total_cost'}
                onChangeText={value => {
                  const unitCost = parseFloat(value || 0);
                  const qty = parseFloat(values.initial_stock_qty || 0);
                  setFieldValue('total_cost', (unitCost * qty).toString());
                  handleChange('unit_cost')(value);
                }}
                onBlur={handleBlur('unit_cost')}
                value={values.unit_cost}
                keyboardType="numeric"
                error={!!(errors.unit_cost && touched.unit_cost)}
              />
              <QuantityUOMText
                uomAbbrev={values.uom_abbrev}
                prefixText="Per "
                disabled={values.cost_input_mode === 'total_cost'}
              />
            </View>
            <RadioButton value="unit_cost" color={colors.primary} />
          </View>

          {/* Total Cost row */}
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <View style={{flexDirection: 'row', flex: 1}}>
              <TextInput
                style={[styles.textInput, {flex: 1}]}
                label={
                  <TextInputLabel
                    label="Total Cost (Including tax)"
                    required
                    error={!!(errors.total_cost && touched.total_cost)}
                  />
                }
                disabled={values.cost_input_mode === 'unit_cost'}
                onChangeText={value => {
                  const totalCost = parseFloat(value || 0);
                  const qty = parseFloat(values.initial_stock_qty || 0);
                  const calculatedUnitCost =
                    totalCost && qty ? totalCost / qty : 0;
                  setFieldValue('unit_cost', calculatedUnitCost.toString());
                  handleChange('total_cost')(value);
                }}
                onBlur={handleBlur('total_cost')}
                value={values.total_cost}
                keyboardType="numeric"
                error={!!(errors.total_cost && touched.total_cost)}
              />
              <QuantityUOMText
                quantity={values.initial_stock_qty}
                uomAbbrev={values.uom_abbrev}
                prefixText="Total "
                concatText=" Cost"
                disabled={values.cost_input_mode === 'unit_cost'}
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
            if (currentValue && currentValue !== '0') {
              handleChange('sales_tax_id')(currentValue);
            }
          }}
          onPress={() =>
            makeFormikNav(routes.itemTax())({
              tax_id: values.initial_stock_applied_tax_id,
              tax_id_field_key: 'initial_stock_applied_tax_id',
            })
          }
          error={
            !!(
              errors.initial_stock_applied_tax_id &&
              touched.initial_stock_applied_tax_id
            )
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
          onPress={() =>
            makeFormikNav(routes.itemVendor())({
              vendor_id: values.initial_stock_vendor_id,
              vendor_id_field_key: 'initial_stock_vendor_id',
            })
          }
          error={
            !!(
              errors.initial_stock_vendor_id && touched.initial_stock_vendor_id
            )
          }
        />
        {renderDeletedInitStockVendor()}

        <TextInput
          label={`Pre-${appDefaults.appDisplayName} Stock Official Receipt # (Optional)`}
          onChangeText={handleChange('official_receipt_number')}
          onBlur={handleBlur('official_receipt_number')}
          value={values.official_receipt_number}
          error={
            !!(
              errors.official_receipt_number && touched.official_receipt_number
            )
          }
        />

        <TextInput
          style={styles.textInput}
          label={
            <TextInputLabel
              label="Low Stock Level"
              required
              error={!!(errors.low_stock_level && touched.low_stock_level)}
            />
          }
          onChangeText={handleChange('low_stock_level')}
          onBlur={handleBlur('low_stock_level')}
          value={values.low_stock_level}
          keyboardType="numeric"
          error={!!(errors.low_stock_level && touched.low_stock_level)}
        />

        <TextInput
          multiline
          label={`Pre-${appDefaults.appDisplayName} Stock Remarks (Optional)`}
          onChangeText={handleChange('remarks')}
          onBlur={handleBlur('remarks')}
          value={values.remarks}
          error={!!(errors.remarks && touched.remarks)}
        />
      </>
    );
  };

  const renderSellingDetailsFields = formikProps => {
    const {setFieldValue, values} = formikProps;

    if (!isSellingDetailsFieldsVisible) return null;

    return (
      <>
        <ItemSellingSizeOptions
          listItems={values.selling_size_options}
          listItemKey="option_id"
          containerStyle={{marginTop: 10}}
          onPressItem={() => {}}
          onPressDeleteListItem={listItem => {
            setFocusedSellingSizeOption(listItem);
            setConfirmDeleteSellingSizeOptionDialogVisible(true);
          }}
        />

        <Button
          icon="plus"
          mode="outlined"
          style={{marginTop: 10}}
          onPress={() => {
            if (!values.uom_abbrev) {
              setUnitOfMeasurementRequiredDialogVisible(true);
              return;
            }
            setAddOptionModalVisible(true);
          }}>
          Add Selling Size Option
        </Button>
      </>
    );
  };

  // -------------------------------------------------------------------------
  // Derive initial formik values from props + query data
  // -------------------------------------------------------------------------

  const itemInitStockLog = getItemInitStockLogData?.result;

  const initialStockQty = (
    editMode && itemInitStockLog
      ? itemInitStockLog.adjustment_qty
      : initialValues.initial_stock_qty ?? 0
  ).toString();

  const initialStockUnitCost = (
    editMode && itemInitStockLog
      ? itemInitStockLog.adjustment_unit_cost?.toFixed(2)
      : initialValues.unit_cost ?? 0
  ).toString();

  const totalCost = itemInitStockLog
    ? (
        parseFloat(itemInitStockLog.adjustment_unit_cost) *
        parseFloat(itemInitStockLog.adjustment_qty)
      ).toString()
    : '0';

  const initialStockAppliedTaxId = (
    editMode && itemInitStockLog
      ? itemInitStockLog.ref_tax_id ?? ''
      : initialValues.initial_stock_applied_tax_id ?? ''
  ).toString();

  const initialStockVendorId = (
    editMode && itemInitStockLog
      ? itemInitStockLog.ref_vendor_id ?? ''
      : initialValues.initial_stock_vendor_id ?? ''
  ).toString();

  const initialStockOfficialReceiptNumber =
    editMode && itemInitStockLog
      ? itemInitStockLog.official_receipt_number
      : initialValues.official_receipt_number;

  const initialStockRemarks =
    editMode && itemInitStockLog
      ? itemInitStockLog.remarks
      : initialValues.remarks || '';

  const sellingSizeOptions =
    editMode && getItemSellingSizeModifierOptionsData?.result?.length
      ? getItemSellingSizeModifierOptionsData.result
      : initialValues.selling_size_options || [];

  // -------------------------------------------------------------------------
  // Formik
  // -------------------------------------------------------------------------

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
      cost_input_mode: initialValues.cost_input_mode || 'unit_cost',
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
      unit_selling_price: initialValues.unit_selling_price?.toString() || '0',
      sales_tax_id: initialValues.sales_tax_id?.toString() || '',
      selling_size_options: sellingSizeOptions,
      remarks: initialStockRemarks,
      packaging_type: initialValues.packaging_type || '',
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

  // -------------------------------------------------------------------------
  // Section heading texts
  // -------------------------------------------------------------------------

  const initStockSectionHeadingText = editMode
    ? `Update Pre-${appDefaults.appDisplayName} Stock & Cost`
    : `Input Pre-${appDefaults.appDisplayName} Stock Cost & Tax`;

  const sellingDetailsHeadingText = editMode
    ? 'Update Selling Price'
    : 'Input Selling Price';

  // -------------------------------------------------------------------------
  // Early returns for loading / error states
  // -------------------------------------------------------------------------

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

  // -------------------------------------------------------------------------
  // Shared date-string updater used in both pickers
  // -------------------------------------------------------------------------

  const applySelectedDate = (selectedDate, formikHandleChange) => {
    const formatted = formatDatetimeString(selectedDate);
    formikHandleChange('beginning_inventory_date')(formatted);
  };

  // -------------------------------------------------------------------------
  // Render
  // -------------------------------------------------------------------------

  return (
    <>
      {/* ── Date / Month Pickers ── */}
      {showCalendar && (
        <DateTimePicker
          testID="dateTimePicker"
          value={date}
          mode={dateTimePickerMode}
          is24Hour
          onChange={(_event, selectedDate) => {
            handleDateTimePickerChange(_event, selectedDate);
            applySelectedDate(selectedDate, handleChange);
          }}
        />
      )}

      {showMonthPicker && (
        <Modal
          transparent
          animationType="fade"
          visible={showMonthPicker}
          onRequestClose={() => setShowMonthPicker(false)}>
          <View style={styles.modalContentContainer}>
            <View style={styles.modalContent}>
              <MonthPicker
                selectedDate={date}
                onMonthChange={selectedValue => {
                  const selectedDate = new Date(selectedValue);
                  handleMonthChange(selectedDate);
                  applySelectedDate(selectedDate, handleChange);
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
                onPress={() => setShowMonthPicker(false)}
                style={styles.modalConfirmButton}>
                OK
              </Button>
            </View>
          </View>
        </Modal>
      )}

      {/* ── Dialogs ── */}
      <Portal>
        <Dialog
          visible={unitOfMeasurementRequiredDialogVisible}
          onDismiss={() => setUnitOfMeasurementRequiredDialogVisible(false)}>
          <Dialog.Title>Item UOM is required!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Set the Unit of Measurement of the item above first before adding
              a selling size option.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => setUnitOfMeasurementRequiredDialogVisible(false)}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <Portal>
        <Dialog
          visible={updateUOMWarningDialogVisible}
          onDismiss={() => {
            setUpdateUOMWarningDialogVisible(false);
            setConfirmClearAllSellingSizeOptions(false);
          }}>
          <Dialog.Title>Attention!</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              Please note that changing the item's unit of measurement will
              delete the selling size options you added below. This prevents
              conflicts between the item's unit of measurement and its
              associated selling size options. You can re-create selling size
              options for this item from scratch as needed.
            </Text>
            <ConfirmationCheckbox
              status={confirmClearAllSellingSizeOptions}
              text="Clear size options listed below"
              onPress={() =>
                setConfirmClearAllSellingSizeOptions(
                  !confirmClearAllSellingSizeOptions,
                )
              }
            />
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              color={
                confirmClearAllSellingSizeOptions
                  ? colors.notification
                  : colors.disabled
              }
              disabled={!confirmClearAllSellingSizeOptions}
              onPress={() => {
                if (!confirmClearAllSellingSizeOptions) return;
                setValues({...values, selling_size_options: []});
                navigateWithFormikActions(
                  {setFieldValue, setFieldTouched, setFieldError},
                  'ItemUOM',
                  {
                    uom_abbrev: values.uom_abbrev,
                    uom_abbrev_field_key: 'uom_abbrev',
                    is_uom_abbrev_required: true,
                  },
                );
                setUpdateUOMWarningDialogVisible(false);
              }}>
              Edit now
            </Button>
            <Button
              onPress={() => {
                setUpdateUOMWarningDialogVisible(false);
                setConfirmClearAllSellingSizeOptions(false);
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
            setConfirmDeleteSellingSizeOptionDialogVisible(false)
          }>
          <Dialog.Title>Delete selling size option?</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              {`Are you sure you want to delete ${
                focusedSellingSizeOption?.option_name
                  ? `"${focusedSellingSizeOption.option_name}" `
                  : ''
              }selling size option?`}
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              icon="delete"
              color={colors.notification}
              onPress={() => {
                if (!focusedSellingSizeOption) return;
                const filtered = (values.selling_size_options || []).filter(
                  opt => opt.option_id != focusedSellingSizeOption.option_id,
                );
                setFieldValue('selling_size_options', filtered);
                setFocusedSellingSizeOption(null);
                setConfirmDeleteSellingSizeOptionDialogVisible(false);
              }}>
              Delete
            </Button>
            <Button
              onPress={() =>
                setConfirmDeleteSellingSizeOptionDialogVisible(false)
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
          <Text
            variant="titleLarge"
            style={{marginBottom: 15, textAlign: 'center'}}>
            Size/Quantity Option
          </Text>
          <ModifierOptionForm
            itemId={item?.id}
            initialValues={{
              in_option_qty_uom_abbrev: values.uom_abbrev,
              uom_abbrev_per_piece: values.uom_abbrev_per_piece,
              qty_per_piece: values.qty_per_piece,
            }}
            onSubmit={(formValues, formActions) => {
              if (!formValues.option_id) {
                formValues.option_id = `temp_id_${uuid.v4()}`;
              }
              const updated = [
                ...(values.selling_size_options || []),
                formValues,
              ];
              setFieldValue('selling_size_options', updated);
              setAddOptionModalVisible(false);
              formActions.resetForm();
            }}
            onCancel={() => setAddOptionModalVisible(false)}
          />
        </RNPaperModal>
      </Portal>

      {/* ── Form body ── */}
      <FormRequiredFieldsHelperText />
      <PreventGoBack navigation={navigation} hasUnsavedChanges={dirty} />

      <SectionHeading
        headingText={editMode ? 'Update Item Details' : 'Item Details'}
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
        onPress={() =>
          navigateWithFormikActions(
            {setFieldValue, setFieldTouched, setFieldError},
            routes.itemCategory(),
            {category_id: values.category_id},
          )
        }
        error={!!(errors.category_id && touched.category_id)}
      />

      <TextInput
        style={styles.textInput}
        label={
          <TextInputLabel
            label="Item Name"
            required
            error={!!(errors.name && touched.name)}
          />
        }
        onChangeText={handleChange('name')}
        onBlur={handleBlur('name')}
        value={values.name}
        error={!!(errors.name && touched.name)}
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
        disabled={editMode}
        required
        renderValueCurrentValue={values.uom_abbrev}
        renderValue={(_value, renderingValueProps) =>
          renderUOMValue(values.uom_abbrev, renderingValueProps)
        }
        onPress={() => {
          if (values.selling_size_options?.length > 0) {
            setUpdateUOMWarningDialogVisible(true);
            return;
          }
          navigateWithFormikActions(
            {setFieldValue, setFieldTouched, setFieldError},
            'ItemUOM',
            {
              uom_abbrev: values.uom_abbrev,
              uom_abbrev_field_key: 'uom_abbrev',
              is_uom_abbrev_required: true,
            },
          );
        }}
        error={!!(errors.uom_abbrev && touched.uom_abbrev)}
      />

      {renderAddMeasurementPerPieceCheckbox(formik)}
      {renderSetUOMToUOMPerPieceCheckbox(formik)}
      {renderMeasurementPerPieceButton(formik)}
      {renderPerPieceFields(formik)}

      {!item?.is_finished_product && (
        <SectionHeading
          headingText={initStockSectionHeadingText}
          containerStyle={{marginTop: 20}}
          switchVisible
          switchValue={isInitStockFieldsVisible}
          onSwitchValueChange={() => setIsInitStockFieldsVisible(v => !v)}
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
          onPress={() =>
            navigation.navigate(routes.itemSizeOptions(), {item_id: item?.id})
          }
        />
      ) : (
        <SectionHeading
          headingText={sellingDetailsHeadingText}
          containerStyle={{marginTop: 20}}
          switchVisible
          switchValue={isSellingDetailsFieldsVisible}
          onSwitchValueChange={() => setIsSellingDetailsFieldsVisible(v => !v)}
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
        onPress={() => navigation.goBack()}
        style={{marginTop: 10, marginBottom: 25}}>
        Cancel
      </Button>
    </>
  );
};

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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
