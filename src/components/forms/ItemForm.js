import React, {useState, useEffect, useMemo} from 'react';
import {View, StyleSheet, Modal, Pressable, Alert} from 'react-native';
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
import useCurrentUser from '../../hooks/useCurrentUser';
import {getCategory} from '../../localDbQueries/categories';
import {getTax, getTaxes} from '../../localDbQueries/taxes';
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
import UnitOrTotalCostRadioButtonWrapper from './UnitOrTotalCostRadioButtonWrapper';
import {PACKAGING_TYPE_OPTIONS} from '../../constants/itemForm';
import {getMasterItems} from '../../serverDbQueries/v2/masterItems';
import commaNumber from 'comma-number';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {
  computeMarkupAmount,
  computeMarkupPercentage,
  computeSrpFromAmount,
} from '../../utils/markupHelpers';

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
  markup_percentage: Yup.string().notRequired(),
  markup_amount: Yup.string().notRequired(),
  packaging_type: Yup.string().notRequired(),
  sku: Yup.string()
    .trim()
    .max(64, 'Too long')
    .matches(/^[A-Z0-9-]*$/i, 'Letters, digits, and dashes only')
    .nullable(),
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
  markup_percentage: '',
  markup_amount: '',
  sales_tax_id: '',
  selling_size_options: [],
  adjustment_qty: '',
  remarks: '',
  packaging_type: '',
  sku: '',
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

// Custom Dropdown input that bolds the selected value, matching the bold
// Master Item value pattern used on the Edit Master Item screen. Dropdown
// forwards only a fixed set of TextInputProps to its inner input and offers no
// style passthrough, so a custom input is the only way to style the value.
const BoldDropdownInput = ({
  placeholder,
  label,
  rightIcon,
  selectedLabel,
  mode,
  disabled,
  error,
}) => (
  <TextInput
    placeholder={placeholder}
    label={label}
    value={selectedLabel}
    right={rightIcon}
    mode={mode}
    editable={false}
    disabled={disabled}
    error={error}
    contentStyle={styles.masterValueText}
  />
);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ItemForm = props => {
  const {
    item,
    initialValues: rawInitialValues,
    onSubmit,
    editMode = false,
    resetSectionedFieldsOnToggle = true,
    masterItem = null,
  } = props;

  // When the form is opened from the master-item picker (add mode) or for an
  // existing branch item that is already linked to a master (edit mode), the
  // name + SKU are locked to the master's values. Variant identity lives on
  // the master; only the Master Item List edit screen (root-only) can change
  // it.
  //
  // In edit mode we check BOTH master_item_sync_id and sku. master_item_sync_id
  // is the canonical join key, but sku alone is also a reliable signal: every
  // items row registered since Part 1 has had a SKU (auto-generated or
  // user-supplied) tied to a master_items entry. Falling back to sku covers
  // any edge case where master_item_sync_id wasn't set (e.g. legacy rows from
  // a partial-migration window where the column was added late).
  const isMasterLocked =
    !!masterItem ||
    (editMode && (!!item?.master_item_sync_id || !!item?.sku));

  // Company-wide master description, shown read-only on the branch Edit Item
  // screen. From the picked master in add-from-master mode, otherwise from the
  // master_item_description the getItem query resolves for the linked item.
  const masterItemDescription = masterItem
    ? masterItem.description ?? ''
    : item?.master_item_description ?? '';

  // Merge master overrides on top of whatever initialValues the caller passed
  // (or the form-wide defaults if none). Falsy `initialValues` means the
  // caller relies on defaults — keep that path unchanged.
  const initialValues = useMemo(() => {
    const fromCaller = rawInitialValues || getDefaultInitialValues(item);
    if (!masterItem) return fromCaller;
    return {
      ...fromCaller,
      name: masterItem.description,
      sku: masterItem.sku,
      barcode: masterItem.barcode ?? '',
      uom_abbrev: masterItem.uom_abbrev ?? '',
      uom_abbrev_per_piece: masterItem.uom_abbrev_per_piece ?? '',
      qty_per_piece:
        masterItem.qty_per_piece != null && masterItem.qty_per_piece !== ''
          ? String(masterItem.qty_per_piece)
          : '',
      packaging_type: masterItem.packaging_type ?? '',
      // Pre-enable the per-piece section so its fields render with the
      // pre-filled (and locked) values when the master defines them.
      // Check all three per-piece fields, not just uom_abbrev_per_piece, so
      // a partially-populated master (e.g. has qty + packaging but null
      // uom_per_piece) still opens the block instead of silently hiding the
      // values from the user.
      add_measurement_per_piece: !!(
        masterItem.uom_abbrev_per_piece ||
        (masterItem.qty_per_piece != null && masterItem.qty_per_piece !== '') ||
        masterItem.packaging_type
      ),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rawInitialValues, masterItem, item]);

  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useItemFormContext();
  const currencySymbol = useCurrencySymbol();
  const [{authUser}] = useCurrentUser();
  // Only the root account may edit master items (the server returns 403 for
  // sub-accounts), so the tappable "edit on the Master Item List screen"
  // shortcut is gated to root — mirroring how MasterItemList suppresses its
  // edit affordance for sub-accounts.
  const isRoot = !!authUser?.is_root_account;
  const [isCancelPreventGoBack, setIsCancelPreventGoBack] = useState(false);

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
  const [noInitStockDialogVisible, setNoInitStockDialogVisible] =
    useState(false);

  // ---- master item edit shortcut ----
  const [isOpeningMasterItem, setIsOpeningMasterItem] = useState(false);

  // Opens the Master Item List edit screen for the master this branch item is
  // linked to. The update endpoint is keyed by the server-side master id, which
  // the local mirror does NOT carry (locally master_items.id === sync_id, while
  // the server assigns its own separate id). So we look the master up on the
  // server by SKU — the same source MasterItemList uses — to obtain a record
  // with the correct id before navigating.
  const handleOpenMasterItemEdit = async () => {
    if (isOpeningMasterItem) return;

    const sku = String(item?.sku ?? '').trim();
    if (!sku) {
      Alert.alert(
        'Master item unavailable',
        'This item has no SKU, so its Master Item List entry could not be located.',
      );
      return;
    }

    setIsOpeningMasterItem(true);
    try {
      const res = await getMasterItems({
        queryKey: ['masterItems', {q: sku, perPage: 100}],
      });
      // q matches SKU or description with a LIKE, so narrow to the exact SKU
      // (unique per company in master_items).
      const master = (res?.data ?? []).find(
        m => String(m?.sku ?? '').toUpperCase() === sku.toUpperCase(),
      );
      if (!master) {
        Alert.alert(
          'Master item not found',
          'Could not find the linked Master Item List entry for this item.',
        );
        return;
      }
      navigation.navigate(routes.editMasterItem(), {master});
    } catch (err) {
      console.debug('[ItemForm] handleOpenMasterItemEdit error:', err);
      Alert.alert(
        'Unable to open',
        'Failed to load the master item. Please check your connection and try again.',
      );
    } finally {
      setIsOpeningMasterItem(false);
    }
  };

  // Note shown under fields that are locked because the item is linked to a
  // company-wide master. Root accounts get a tappable shortcut into the Master
  // Item List edit screen; sub-accounts (who can't edit masters) keep the
  // original read-only note. `leadIn` is the context sentence without the
  // trailing call-to-action.
  const renderMasterItemNote = leadIn => {
    if (!isRoot) {
      return (
        <HelperText type="info">
          {`${leadIn} — edit on the Master Item List screen.`}
        </HelperText>
      );
    }

    return (
      <>
        <HelperText type="info" style={{paddingBottom: 0}}>
          {`${leadIn}.`}
        </HelperText>
        <Pressable
          onPress={handleOpenMasterItemEdit}
          disabled={isOpeningMasterItem}
          hitSlop={8}
          style={({pressed}) => [
            styles.masterItemLinkRow,
            {opacity: pressed || isOpeningMasterItem ? 0.6 : 1},
          ]}>
          <MaterialCommunityIcons
            name="open-in-new"
            size={16}
            color={colors.primary}
            style={{marginRight: 6}}
          />
          <Text style={[styles.masterItemLinkText, {color: colors.primary}]}>
            {isOpeningMasterItem
              ? 'Opening…'
              : 'Edit on the Master Item List screen'}
          </Text>
        </Pressable>
      </>
    );
  };

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
      ['itemInitialStockLog', {itemId: item?.id}],
      getItemInitialStockLog,
      {enabled: editMode && !!item?.id && !item?.is_finished_product},
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

  // App default tax (VAT) — used to default the per-item Sales Tax on new items.
  const {data: getDefaultSalesTaxData} = useQuery(
    ['taxes', {filter: {is_app_default: 1}}],
    getTaxes,
    {enabled: !editMode},
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
      unitAbbrev === 'ea'
        ? 'Each (Piece)'
        : convert().describe(unitAbbrev).singular;
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

    // Master-locked add mode: the master decides per-piece via its own
    // uom_abbrev_per_piece + qty_per_piece. Show the per-piece block whenever
    // the master defines both — regardless of uom_abbrev.
    if (
      !editMode &&
      masterItem &&
      masterItem.uom_abbrev_per_piece &&
      masterItem.qty_per_piece
    )
      return true;

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
        disabled={readOnly || isMasterLocked}
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
        masterItem &&
        masterItem.uom_abbrev_per_piece &&
        masterItem.qty_per_piece) ||
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

    const disabled = editMode || isMasterLocked;
    // Disable the packaging dropdown when master-locked. The Dropdown
    // component swallows showDropDown calls when its `visible` prop never
    // flips, so no-op the trigger.
    const packagingShowDropDown = isMasterLocked
      ? () => {}
      : () => setShowPackagingDropDown(true);

    return (
      <>
        {showQtyPerPiece && (
          <>
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
                contentStyle={
                  isMasterLocked ? styles.masterValueText : undefined
                }
              />
              <QuantityUOMText
                textStyle={disabled ? {color: colors.disabled} : {}}
                uomAbbrev={values.uom_abbrev_per_piece}
                quantity={values.qty_per_piece}
                concatText={' each'}
              />
            </View>
            <Dropdown
              label="Packaging Type (Optional)"
              mode="flat"
              visible={showPackagingDropDown}
              showDropDown={packagingShowDropDown}
              onDismiss={() => setShowPackagingDropDown(false)}
              value={values.packaging_type}
              hideMenuHeader
              onSelect={value => setFieldValue('packaging_type', value ?? '')}
              options={PACKAGING_TYPE_OPTIONS}
              activeColor={colors.accent}
              dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
              disabled={isMasterLocked}
              CustomDropdownInput={
                isMasterLocked ? BoldDropdownInput : undefined
              }
            />
            {isMasterLocked
              ? renderMasterItemNote('Variant fields locked to Master Item List')
              : null}
          </>
        )}
      </>
    );
  };

  const renderAddMeasurementPerPieceCheckbox = formikProps => {
    const {setFieldValue, values, setFieldTouched, setFieldError} = formikProps;

    // When master-locked, the master owns the per-piece decision — hide the
    // toggle so the user can't disable a master-defined per-piece variant.
    if (isMasterLocked) return null;

    const show =
      (editMode &&
        item.uom_abbrev === 'ea' &&
        !item.uom_abbrev_per_piece &&
        !item.qty_per_piece) ||
      (!editMode && values.uom_abbrev === 'ea');

    if (!show) return null;

    const handleToggle = () => {
      if (values.add_measurement_per_piece) {
        // Toggling OFF: clear all three per-piece fields together so the
        // user's "no per-piece variant" intent is fully reflected. Leaving
        // packaging_type populated here is what produced the offline-only
        // "checkbox unchecked but packaging set" state in the master row.
        setFieldValue('uom_abbrev_per_piece', '');
        setFieldTouched('uom_abbrev_per_piece', false);
        setFieldError('uom_abbrev_per_piece', null);
        setFieldValue('qty_per_piece', '');
        setFieldTouched('qty_per_piece', false);
        setFieldError('qty_per_piece', null);
        setFieldValue('packaging_type', '');
        setFieldTouched('packaging_type', false);
        setFieldError('packaging_type', null);
        setFieldTouched('add_measurement_per_piece', true);
        setFieldValue('add_measurement_per_piece', false);
      } else {
        setFieldValue('uom_abbrev_per_piece', '');
        setFieldValue('qty_per_piece', '');
        setFieldValue('packaging_type', '');
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
        setFieldValue('packaging_type', '');
        setFieldTouched('packaging_type', false);
        setFieldError('packaging_type', null);
        setFieldTouched('set_uom_to_uom_per_piece', true);
        setFieldValue('set_uom_to_uom_per_piece', false);
      } else {
        setFieldValue('uom_abbrev', 'ea');
        setFieldValue('uom_abbrev_per_piece', item.uom_abbrev);
        setFieldValue('qty_per_piece', '');
        setFieldValue('packaging_type', '');
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

  // Per-item Sales Tax (selling side). Mirrors the Pre-FCMS Stock Applied Tax
  // picker. Visible in both add & edit; new items default to the app default
  // tax (VAT) and "None" falls back to the item's cost tax at sale time.
  const renderSalesTaxButton = formikProps => {
    const {
      handleChange,
      setFieldValue,
      values,
      errors,
      touched,
      setFieldTouched,
      setFieldError,
    } = formikProps;

    return (
      <MoreSelectionButton
        containerStyle={{marginTop: -1}}
        placeholder="Select Tax"
        label="Sales Tax"
        renderValueCurrentValue={values.sales_tax_id}
        renderValue={(_value, renderingValueProps) => {
          if (!salesTaxId) return null;
          return renderTaxValue(
            getSalesTaxStatus,
            getSalesTaxData,
            renderingValueProps,
          );
        }}
        onChangeValue={currentValue => {
          handleSalesTaxChange(currentValue);
          handleChange('sales_tax_id')(currentValue);
        }}
        onPress={() =>
          navigateWithFormikActions(
            {setFieldValue, setFieldTouched, setFieldError},
            routes.itemTax(),
            {tax_id: values.sales_tax_id, tax_id_field_key: 'sales_tax_id'},
          )
        }
        error={!!(errors.sales_tax_id && touched.sales_tax_id)}
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
      initStockAppliedTaxId !== '0' &&
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
      initStockVendorId !== '0' &&
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
    // NOTE: Don't return null if itemInitStockLog is missing
    // Items created via IDT with purchase date won't have an initial stock log (operation_id = 1)
    // We'll use zero values as defaults

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

        <UnitOrTotalCostRadioButtonWrapper>
          <RadioButton.Group
            onValueChange={newValue => {
              if (newValue === 'total_cost')
                setFieldTouched('unit_cost', false);
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
              <View style={{paddingHorizontal: 5}}>
                <RadioButton value="unit_cost" color={colors.primary} />
              </View>
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
              <View style={{paddingHorizontal: 5}}>
                <RadioButton value="total_cost" color={colors.primary} />
              </View>
            </View>
          </RadioButton.Group>
        </UnitOrTotalCostRadioButtonWrapper>

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
    const {values} = formikProps;

    // Add mode: the whole section (size options + markup/SRP + sales tax) is
    // gated behind the toggle. Edit mode has no toggle — the heading navigates
    // to the selling size options screen instead — but the markup/SRP + sales
    // tax are still edited inline here, so they must always render.
    if (!editMode && !isSellingDetailsFieldsVisible) return null;

    return (
      <>
        {!editMode && (
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
        )}

        {renderMarkupFields(formikProps)}
        {renderSalesTaxButton(formikProps)}
      </>
    );
  };

  /**
   * Markup / Suggested Retail Price section. The user enters either a markup %
   * or an exact markup amount and the other derives from the current net cost
   * (`avg_unit_cost_net` in edit mode, else the net of the entered unit cost).
   * SRP = net cost + markup (no VAT). markup_percentage is the canonical driver.
   */
  const renderMarkupFields = formikProps => {
    const {setFieldValue, handleBlur, values} = formikProps;

    const avgNet = parseFloat(item?.avg_unit_cost_net);
    const grossUnitCost = parseFloat(values.unit_cost || 0);
    const initRate = parseFloat(
      getInitStockAppliedTaxData?.result?.rate_percentage || 0,
    );
    const derivedNet =
      initRate > 0 ? grossUnitCost / (1 + initRate / 100) : grossUnitCost;
    const netCostBase =
      Number.isFinite(avgNet) && avgNet > 0 ? avgNet : derivedNet;

    const srp = computeSrpFromAmount(netCostBase, values.markup_amount);

    return (
      <View style={{marginTop: 5}}>
        <HelperText type="info">
          {`Net Unit Cost: ${currencySymbol} ${commaNumber(
            netCostBase.toFixed(2),
          )} (SRP = net cost + markup, no VAT)`}
        </HelperText>
        <View style={{flexDirection: 'row'}}>
          <TextInput
            style={[styles.textInput, {flex: 1}]}
            label={<TextInputLabel label="Markup %" />}
            value={values.markup_percentage}
            keyboardType="numeric"
            right={<TextInput.Affix text="%" />}
            onChangeText={value => {
              setFieldValue('markup_percentage', value);
              setFieldValue(
                'markup_amount',
                computeMarkupAmount(netCostBase, value).toFixed(2),
              );
            }}
            onBlur={handleBlur('markup_percentage')}
          />
          <TextInput
            style={[styles.textInput, {flex: 1, marginLeft: 10}]}
            label={<TextInputLabel label="Markup Amount" />}
            value={values.markup_amount}
            keyboardType="numeric"
            left={<TextInput.Affix text={currencySymbol} />}
            onChangeText={value => {
              setFieldValue('markup_amount', value);
              setFieldValue(
                'markup_percentage',
                computeMarkupPercentage(netCostBase, value).toFixed(2),
              );
            }}
            onBlur={handleBlur('markup_amount')}
          />
        </View>
        <HelperText type="info" style={{fontWeight: 'bold'}}>
          {`Suggested Retail Price (SRP): ${currencySymbol} ${commaNumber(
            srp.toFixed(2),
          )}`}
        </HelperText>
      </View>
    );
  };

  // -------------------------------------------------------------------------
  // Derive initial formik values from props + query data
  // -------------------------------------------------------------------------

  const itemInitStockLog = getItemInitStockLogData?.result;

  // If no initial stock log exists (e.g., item created via IDT with purchase date),
  // use zero values as defaults
  const initialStockQty = (
    editMode && itemInitStockLog
      ? itemInitStockLog.adjustment_qty
      : editMode && !itemInitStockLog
      ? 0 // No initial stock log = zero pre-app stock
      : initialValues.initial_stock_qty ?? 0
  ).toString();

  const initialStockUnitCost = (
    editMode && itemInitStockLog
      ? itemInitStockLog.adjustment_unit_cost?.toFixed(2)
      : editMode && !itemInitStockLog
      ? 0 // No initial stock log = zero cost
      : initialValues.unit_cost ?? 0
  ).toString();

  const totalCost = itemInitStockLog
    ? (
        parseFloat(itemInitStockLog.adjustment_unit_cost) *
        parseFloat(itemInitStockLog.adjustment_qty)
      ).toString()
    : '';

  const initialStockAppliedTaxId = (
    editMode && itemInitStockLog ? itemInitStockLog.ref_tax_id ?? '' : ''
  ) // No initial stock log = no tax
    .toString();

  const initialStockVendorId = (
    editMode && itemInitStockLog ? itemInitStockLog.ref_vendor_id ?? '' : ''
  ) // No initial stock log = no vendor
    .toString();

  const initialStockOfficialReceiptNumber =
    editMode && itemInitStockLog
      ? itemInitStockLog.official_receipt_number
      : ''; // No initial stock log = no OR number

  const initialStockRemarks =
    editMode && itemInitStockLog ? itemInitStockLog.remarks : ''; // No initial stock log = no remarks

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
      sku: initialValues.sku || '',
      uom_id: initialValues.uom_id?.toString() || '',
      uom_abbrev: initialValues.uom_abbrev || '',
      unit_cost: initialStockUnitCost,
      total_cost: totalCost,
      cost_input_mode: initialValues.cost_input_mode || 'unit_cost',
      add_measurement_per_piece: false,
      set_uom_to_uom_per_piece: false,
      uom_abbrev_per_piece: initialValues.uom_abbrev_per_piece || '',
      qty_per_piece: initialValues.qty_per_piece?.toString() || '',
      packaging_type: initialValues.packaging_type || '',
      initial_stock_unit_cost: initialStockUnitCost,
      initial_stock_qty: initialStockQty,
      low_stock_level: initialValues.low_stock_level?.toString() || '0',
      beginning_inventory_date: datetimeString,
      initial_stock_applied_tax_id: initialStockAppliedTaxId,
      initial_stock_vendor_id: initialStockVendorId,
      official_receipt_number: initialStockOfficialReceiptNumber,
      unit_selling_price: initialValues.unit_selling_price?.toString() || '0',
      markup_percentage: initialValues.markup_percentage?.toString() || '0',
      markup_amount: initialValues.markup_amount?.toString() || '0',
      sales_tax_id: initialValues.sales_tax_id?.toString() || '',
      selling_size_options: sellingSizeOptions,
      remarks: initialStockRemarks,
    },
    validationSchema: ItemValidationSchema,
    onSubmit: (...props) => {
      onSubmit(...props, {setIsCancelPreventGoBack});
    },
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

  // Default the Sales Tax to the app default tax (VAT) on NEW items only, once
  // it loads and only if the user has not already picked one. Edit mode keeps
  // the item's saved value (NULL => falls back to the cost tax at sale time).
  useEffect(() => {
    if (editMode) return;
    if (values.sales_tax_id) return;

    const defaultSalesTax = getDefaultSalesTaxData?.result?.[0];
    if (defaultSalesTax?.id) {
      setFieldValue('sales_tax_id', defaultSalesTax.id.toString());
    }
  }, [editMode, values.sales_tax_id, getDefaultSalesTaxData, setFieldValue]);

  // -------------------------------------------------------------------------
  // Section heading texts
  // -------------------------------------------------------------------------

  const initStockSectionHeadingText = editMode
    ? `Update Pre-${appDefaults.appDisplayName} Stock Cost & Tax`
    : `Input Pre-${appDefaults.appDisplayName} Stock Cost & Tax`;

  const sellingDetailsHeadingText = editMode
    ? 'Update Selling Price & Tax'
    : 'Input Selling Price & Tax';

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
          visible={noInitStockDialogVisible}
          onDismiss={() => setNoInitStockDialogVisible(false)}>
          <Dialog.Title>No Initial Stock Found</Dialog.Title>
          <Dialog.Content>
            <Text variant="bodyMedium">
              This item has no pre-app initial stock record to update.
            </Text>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setNoInitStockDialogVisible(false)}>
              Okay
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
      <PreventGoBack
        navigation={navigation}
        hasUnsavedChanges={dirty}
        cancelPrevention={isCancelPreventGoBack}
      />
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
      {isMasterLocked ? (
        <>
          <TextInput
            style={[styles.textInput, {marginTop: 6}]}
            label="Master Item Description"
            value={masterItemDescription}
            editable={false}
            multiline
            contentStyle={styles.masterValueText}
          />
          {renderMasterItemNote('From Master Item List')}
        </>
      ) : null}
      <View style={{flexDirection: 'row'}}>
        <TextInput
          label="Item Barcode (Optional)"
          onChangeText={handleChange('barcode')}
          onBlur={handleBlur('barcode')}
          value={values.barcode}
          style={[styles.textInput, {flex: 1}]}
          editable={!isMasterLocked}
        />
        <Pressable
          onPress={() => {
            if (isMasterLocked) return;
            navigation.navigate(routes.scanBarcode(), {
              onBarCodeRead: value => setFieldValue('barcode', value ?? ''),
            });
          }}
          disabled={isMasterLocked}
          hitSlop={10}
          style={{
            position: 'absolute',
            top: 18,
            right: 15,
            opacity: isMasterLocked ? 0.4 : 1,
          }}>
          <MaterialCommunityIcons
            name="barcode-scan"
            size={25}
            color={colors.dark}
          />
        </Pressable>
      </View>
      {(!editMode || isMasterLocked) && (
        <>
          <TextInput
            label={
              isMasterLocked ? 'Master Item SKU' : 'Master Item SKU (Optional)'
            }
            onChangeText={handleChange('sku')}
            onBlur={handleBlur('sku')}
            value={values.sku}
            autoCapitalize="characters"
            style={styles.textInput}
            error={!!(errors.sku && touched.sku)}
            editable={!isMasterLocked}
            contentStyle={isMasterLocked ? styles.masterValueText : undefined}
          />
          {errors.sku && touched.sku ? (
            <HelperText type="error">{errors.sku}</HelperText>
          ) : isMasterLocked ? (
            renderMasterItemNote('From Master Item List')
          ) : (
            <HelperText type="info">
              Leave blank to auto-generate (e.g. AKA-7K2P).
            </HelperText>
          )}
        </>
      )}
      <MoreSelectionButton
        containerStyle={{marginTop: -2}}
        placeholder="Select Unit"
        label="Unit of Measurement"
        disabled={editMode || isMasterLocked}
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
        <>
          {editMode ? (
            <PressableSectionHeading
              headingText={initStockSectionHeadingText}
              containerStyle={{marginTop: 20}}
              onPress={() => {
                const initStockLog = getItemInitStockLogData?.result;
                if (initStockLog) {
                  navigation.navigate(routes.updateInventoryLog(), {
                    item_id: item?.id,
                    log_id: initStockLog.id,
                  });
                } else {
                  setNoInitStockDialogVisible(true);
                }
              }}
            />
          ) : (
            <>
              <SectionHeading
                headingText={initStockSectionHeadingText}
                containerStyle={{marginTop: 20}}
                switchVisible
                switchValue={isInitStockFieldsVisible}
                onSwitchValueChange={() => {
                  if (resetSectionedFieldsOnToggle) {
                    // reset first the default values of init stock fields on toggle
                    setValues(prevValues => ({
                      ...prevValues,
                      initial_stock_unit_cost: initialStockUnitCost,
                      initial_stock_qty: initialStockQty,
                      low_stock_level:
                        initialValues.low_stock_level?.toString() || '0',
                      beginning_inventory_date: datetimeString,
                      initial_stock_applied_tax_id: initialStockAppliedTaxId,
                      initial_stock_vendor_id: initialStockVendorId,
                      official_receipt_number:
                        initialStockOfficialReceiptNumber,
                      remarks: initialStockRemarks,
                    }));
                  }

                  // toggle init stock fields
                  setIsInitStockFieldsVisible(v => !v);
                }}
              />
              {renderInitStockFields(
                getItemInitStockLogStatus,
                getItemInitStockLogData,
                formik,
              )}
            </>
          )}
        </>
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
  masterValueText: {
    fontWeight: 'bold',
  },
  masterItemLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingTop: 2,
    paddingBottom: 6,
  },
  masterItemLinkText: {
    fontSize: 12,
    fontWeight: '600',
    textDecorationLine: 'underline',
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

export default ItemForm;
