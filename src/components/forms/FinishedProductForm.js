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
import {useNavigation} from '@react-navigation/native';
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
import {formatUOMAbbrev} from '../../utils/stringHelpers';
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
});

const FinishedProductForm = props => {
  const {
    item,
    recipeRegisteredFinishedProduct,
    initialValues = {
      category_id: '',
      tax_id: '',
      vendor_id: '',
      name: '',
      barcode: '',
      uom_abbrev: '',
      unit_cost: '',
      /** NOTE: Unit cost net and unit cost tax values are only needed in producing finished product yield.
       * Non-yield items (items that are not produced by recipes) net and tax should be calculated based on
       * the given unit cost gross and tax rate percentage before saving to the database **/
      unit_cost_net: '',
      unit_cost_tax: '',
      total_cost: '',
      // cost_input_mode: item?.uom_abbrev_per_piece ? 'total_cost' : 'unit_cost', // 'total_cost' or 'unit_cost'
      add_measurement_per_piece: false,
      set_uom_to_uom_per_piece: false,
      uom_abbrev_per_piece: '',
      qty_per_piece: '',
      initial_stock_qty: '',
      low_stock_level: '',
      yield_date: '',
      initial_stock_applied_tax_id: '',
      initial_stock_vendor_id: '',
      official_receipt_number: '',
      remarks: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useItemFormContext();
  const [isInitStockFieldsVisible, setIsInitStockFieldsVisible] =
    useState(true);
  const [categoryId, setCategoryId] = useState(null);
  const {status: getCategoryStatus, data: getCategoryData} = useQuery(
    ['category', {id: categoryId}],
    getCategory,
    {
      enabled: categoryId ? true : false,
    },
  );
  const [requiredIngredientsModalVisible, setRequiredIngredientsModalVisible] =
    useState(false);
  const defaultDate = initialValues.yield_date
    ? new Date(initialValues.yield_date?.split(' ')?.[0])
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
      unit_cost: initialValues.unit_cost?.toString() || '0',
      unit_cost_tax: initialValues.unit_cost_tax?.toString() || '0',
      unit_cost_net: initialValues.unit_cost_net?.toString() || '0',
      total_cost: initialValues.total_cost?.toString() || '0',
      cost_input_mode: initialValues.cost_input_mode || 'unit_cost', // 'total_cost' or 'unit_cost'
      add_measurement_per_piece: false,
      set_uom_to_uom_per_piece: false,
      uom_abbrev_per_piece: initialValues.uom_abbrev_per_piece || '',
      qty_per_piece: initialValues.qty_per_piece?.toString() || '',
      initial_stock_unit_cost: initialValues.unit_cost?.toString() || '0',
      initial_stock_qty: initialValues.initial_stock_qty?.toString() || '0',
      low_stock_level: initialValues.low_stock_level?.toString() || '0',
      yield_date: datetimeString,
      initial_stock_applied_tax_id:
        initialValues.initial_stock_applied_tax_id?.toString() || '',
      initial_stock_vendor_id:
        initialValues.initial_stock_vendor_id?.toString() || '',
      official_receipt_number: initialValues.official_receipt_number,
      remarks: initialValues.remarks || '',
    },
    validationSchema: ItemValidationSchema,
    onSubmit,
  });

  const ingredientsValidator = useIngredientsValidator({
    recipeId: item.id,
    updatedYield: formik.values.initial_stock_qty,
    enabled: true,
  });
  const {hasError, requiredIngredients} = ingredientsValidator;

  const handleDateTimePickerChange = (_event, selectedDate) => {
    const currentDate = selectedDate || date;
    setShowCalendar(Platform.OS === 'ios');
    setDate(currentDate);
  };

  const handleMonthChange = selectedDate => {
    setDate(() => new Date(selectedDate));
  };

  const handleCategoryChange = categoryId => {
    setCategoryId(() => categoryId);
  };

  const renderRecipeRegisteredFinishedProductDetails = () => {
    /**
     * TODO: Render recipe registered finished product
     */
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
                label="Qty. Per Piece / Yield Net Wt."
                required
                disabled={isReadOnly}
                error={
                  errors.qty_per_piece && touched.qty_per_piece ? true : false
                }
              />
            }
            disabled={isReadOnly}
            onChangeText={handleChange('qty_per_piece')}
            onBlur={handleBlur('qty_per_piece')}
            value={values.qty_per_piece}
            style={[styles.textInput, {flex: 1}]}
            keyboardType="numeric"
            error={errors.qty_per_piece && touched.qty_per_piece ? true : false}
          />
          <QuantityUOMText
            textStyle={isReadOnly ? {color: colors.disabled} : {}}
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
                // setFieldValue('cost_input_mode', 'total_cost');
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
                {`* You can set a UOM (unit of measurement) per piece if the yield has another unit in each produced package. e.g., You have produced 12 PC of 1.5 KG Cheese. Tick the checkbox, and then below, you can set "KG" as item UOM per Piece, and 1.5 as its Quantity per Piece (or Yield Net Wt.).`}
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
      <>
        <View style={{flexDirection: 'row'}}>
          <TextInput
            style={[styles.textInput, {flex: 1}]}
            label={
              <TextInputLabel
                label="Total Yield to Produce (Quantity)"
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
                  totalCost && initialStockQty
                    ? totalCost / initialStockQty
                    : 0;

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
              errors.initial_stock_qty && touched.initial_stock_qty
                ? true
                : false
            }
          />
          <QuantityUOMText
            uomAbbrev={values.uom_abbrev}
            quantity={values.initial_stock_qty}
          />
        </View>
        <HelperText
          visible={true}
          style={{
            color: colors.dark,
            fontStyle: 'italic',
            marginVertical: 5,
          }}>
          {
            <Text
              style={{
                fontStyle: 'italic',
              }}>{`* Increasing total yield here increases the total cost and required ingredient quantities based on your recipe requirements. To adjust yield without affecting total cost and required ingredient quantities, edit the recipe first.`}</Text>
          }
        </HelperText>
      </>
    );
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

  const renderUOMValue = (unitAbbrev, props) => {
    if (!unitAbbrev) return null;

    const UOM =
      unitAbbrev === 'ea' ? 'Piece' : convert().describe(unitAbbrev).singular;

    return (
      <Subheading {...props}>{props?.trimTextLength(`${UOM}`)}</Subheading>
    );
  };

  const renderRequiredIngredientsSummaryErrorMessage = () => {
    return (
      <Pressable style={{marginTop: 10}}>
        <Text style={{color: colors.error}}>
          Some of your ingredients have insufficient stock based on the total
          yield you want to produce.
        </Text>
      </Pressable>
    );
  };

  const renderRequiredIngredientsSummaryViewAllButton = () => {
    return (
      <Pressable
        style={{marginTop: 10}}
        onPress={() => setRequiredIngredientsModalVisible(() => true)}>
        <Text style={{fontWeight: 'bold', color: colors.primary, fontSize: 16}}>
          View All
        </Text>
      </Pressable>
    );
  };

  const renderRequiredIngredientsSummary = () => {
    if (!requiredIngredients?.length) return null;

    const limit = 5;

    const requiredIngredientsList = requiredIngredients
      .slice(0, limit)
      .map(ingredient => {
        return (
          <View
            key={ingredient.item_id}
            style={{flexDirection: 'row', marginVertical: 2}}>
            <Text
              style={{flex: 1, fontWeight: 'bold', color: colors.neutralTint2}}
              numberOfLines={1}>
              {ingredient.name}
            </Text>
            <View style={{flexDirection: 'row', marginLeft: 'auto'}}>
              <Text
                style={{
                  marginLeft: 5,
                  fontWeight: 'bold',
                  fontStyle: 'italic',
                  color: ingredient.isInsufficientStock
                    ? colors.error
                    : colors.dark,
                }}>
                {`${commaNumber(
                  ingredient.ingredientQtyBasedOnUpdatedYield?.toFixed(2),
                )} ${formatUOMAbbrev(ingredient.in_recipe_uom_abbrev)}`}
              </Text>
            </View>
          </View>
        );
      });

    return (
      <View style={{marginHorizontal: 10}}>
        {requiredIngredientsList}
        {requiredIngredients.length > limit &&
          renderRequiredIngredientsSummaryViewAllButton()}
        {hasError && renderRequiredIngredientsSummaryErrorMessage()}
      </View>
    );
  };

  const renderInitStockFields = formikProps => {
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

    return (
      <>
        <MoreSelectionButton
          label="Yield Date"
          value={moment(datetimeString.split(' ')[0]).format('MMM DD, YYYY')}
          required
          // containerStyle={{marginTop: -1}}
          onPress={() => {
            setShowCalendar(() => true);
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

        <YieldCostCalculation values={values} containerStyle={{marginTop: 0}} />

        <SectionHeading
          headingText={`Required Ingredients${
            requiredIngredients?.length &&
            ` (${requiredIngredients.length} item${
              requiredIngredients.length > 1 ? 's' : ''
            })`
          }`}
          containerStyle={{marginTop: 15}}
        />

        {renderRequiredIngredientsSummary()}

        <SectionHeading
          headingText={'Other Details'}
          containerStyle={{marginTop: 20}}
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
          label="Remarks (Optional)"
          onChangeText={handleChange('remarks')}
          onBlur={handleBlur('remarks')}
          value={values.remarks}
          error={errors.remarks && touched.remarks ? true : false}
        />
      </>
    );
  };

  const renderFinishedProductOrFinishedProductFields = formik => {
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
    } = formik;

    if (recipeRegisteredFinishedProduct) {
      return <FinishedProductDetails item={recipeRegisteredFinishedProduct} />;
    }

    return (
      <>
        <MoreSelectionButton
          placeholder="Select Category"
          label="Category"
          required
          disabled={recipeRegisteredFinishedProduct ? true : false}
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
              label="Finished Product Name / Yield Name"
              required
              error={errors.name && touched.name ? true : false}
            />
          }
          disabled={recipeRegisteredFinishedProduct ? true : false}
          onChangeText={handleChange('name')}
          onBlur={handleBlur('name')}
          value={values.name}
          error={errors.name && touched.name ? true : false}
          autoCapitalize="words"
        />

        <MoreSelectionButton
          containerStyle={{marginTop: -2}}
          placeholder="Select Unit"
          label="Yield Unit of Measurement"
          disabled={editMode || recipeRegisteredFinishedProduct ? true : false}
          required
          renderValueCurrentValue={values.uom_abbrev}
          renderValue={(_value, renderingValueProps) =>
            renderUOMValue(values.uom_abbrev, renderingValueProps)
          }
          onPress={() => {
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
      </>
    );
  };

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
  } = formik;

  let itemDetailsHeadingText = editMode
    ? 'Finished Product Details'
    : recipeRegisteredFinishedProduct
    ? 'Linked Finished Product Details'
    : 'Finished Product Details';

  let initStockSectionHeadingText = editMode
    ? 'Finished Product Yield'
    : 'Finished Product Yield';

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

            handleChange('yield_date')(selectedDateStringFormat);
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

                  handleChange('yield_date')(selectedDateStringFormat);
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

      <RecipeRequiredIngredientsModal
        ingredientsValidator={ingredientsValidator}
        visible={requiredIngredientsModalVisible}
        onDismiss={() => setRequiredIngredientsModalVisible(() => false)}
      />
      <FormRequiredFieldsHelperText />

      <SectionHeading
        headingText={itemDetailsHeadingText}
        containerStyle={{marginTop: 15}}
      />

      {renderFinishedProductOrFinishedProductFields(formik)}

      <SectionHeading
        headingText={initStockSectionHeadingText}
        containerStyle={{marginTop: 20}}
        switchVisible={false}
        switchValue={isInitStockFieldsVisible}
        onSwitchValueChange={() => {
          setIsInitStockFieldsVisible(() => !isInitStockFieldsVisible);
        }}
      />

      {renderInitStockFields(formik)}

      <Button
        mode="contained"
        onPress={(...args) => {
          // inject requiredIngredients to the values before submitting
          formik.setValues({
            ...formik.values,
            required_ingredients: requiredIngredients,
          });

          handleSubmit(...args);
        }}
        disabled={!isValid || isSubmitting || hasError}
        loading={isSubmitting}
        style={{marginTop: 20}}>
        {editMode ? 'Save Changes' : 'Proceed'}
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

export default FinishedProductForm;
