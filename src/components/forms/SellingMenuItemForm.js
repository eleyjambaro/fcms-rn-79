import React, {useState, useCallback} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  HelperText,
  useTheme,
} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
import {setItemNetWeightPerPiece} from '../../localDbQueries/items';
import {
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../../utils/stockMeasurement';
import ItemSizeOptionList from '../salesCounter/ItemSizeOptionList';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';

// size_option_id is intentionally optional here: items without any selling
// size option are sold at the item's base unit_selling_price. The "a size
// option must be picked when options exist" rule is enforced via canSubmit
// below, not the schema.
const SellingMenuItemValidationSchema = Yup.object().shape({
  item_id: Yup.string().required('Required'),
  size_option_id: Yup.string().nullable(),
  in_menu_qty: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const SellingMenuItemForm = props => {
  const {
    item,
    initialValues = {
      size_option_id: '',
      in_option_qty: '',
      in_menu_qty: '',
    },
    onSubmit,
    onCancel,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  // null = size options not loaded yet, 0 = item has no selling size option
  const [sizeOptionsCount, setSizeOptionsCount] = useState(null);
  const [showUnitDropDown, setShowUnitDropDown] = useState(false);
  const [netWeight, setNetWeight] = useState('');
  const handleSizeOptionsLoaded = useCallback(count => {
    setSizeOptionsCount(count);
  }, []);

  const formik = useFormik({
    initialValues: {
      item_id: item?.id,
      size_option_id: initialValues.size_option_id?.toString() || '',
      in_option_qty: initialValues.in_option_qty?.toString() || '',
      in_menu_qty: initialValues.in_menu_qty?.toString() || '1',
      // Base UOM by default; the Unit picker (non-'ea' items with no size options)
      // lets the user enter by another unit or by the piece, converted on save.
      in_menu_uom_abbrev: item?.uom_abbrev || '',
      use_measurement_per_piece: false,
    },
    validationSchema: SellingMenuItemValidationSchema,
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

  const hasSizeOptions = sizeOptionsCount > 0;
  // Enable Enter once options are known to be loaded. When the item has size
  // options the user must pick one (and change the form); when it has none we
  // submit with a null size option and rely on the item's base selling price.
  const canSubmit =
    sizeOptionsCount !== null &&
    isValid &&
    !isSubmitting &&
    (hasSizeOptions ? dirty && !!values.size_option_id : true);

  if (!item) return null;

  const isNonEa = isNonEaItem(item);
  // Show the Quantity + Unit (+ Piece) picker only for a weight/volume item with
  // no size options — matching web, where a size-priced qty stays a plain count.
  const showUnitPicker = sizeOptionsCount === 0 && isNonEa;
  const effectiveUnit = values.in_menu_uom_abbrev || item.uom_abbrev;
  const needsNetWeight =
    showUnitPicker && pieceNeedsNetWeight(item, effectiveUnit);
  const unitOptions = showUnitPicker ? nonEaStockUnitOptions(item) : [];
  const previewBaseQty = toBaseQty(
    item,
    values.in_menu_qty,
    effectiveUnit,
    needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
  );
  const showPreview =
    showUnitPicker &&
    effectiveUnit !== item.uom_abbrev &&
    !needsNetWeight &&
    Number.isFinite(previewBaseQty) &&
    previewBaseQty > 0;

  const basePriceCard = (
    <View
      style={[
        styles.basePriceCard,
        {
          borderColor: colors.primary,
          backgroundColor: colors.highlighted,
        },
      ]}>
      <View style={{flex: 1}}>
        <Text
          style={{
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
            marginRight: 10,
          }}
          numberOfLines={1}>
          {'Selling Price'}
        </Text>
        <Text style={{color: colors.neutralTint1, marginTop: 2}}>
          {'No size options'}
        </Text>
      </View>
      <View>
        <Text style={{fontWeight: '500', fontSize: 16, color: colors.dark}}>
          {`${currencySymbol ? `${currencySymbol} ` : ''}${commaNumber(
            parseFloat(item?.unit_selling_price || 0).toFixed(2),
          )}`}
        </Text>
      </View>
    </View>
  );

  return (
    <>
      <View style={{marginTop: 15, marginBottom: 15, marginHorizontal: 10}}>
        <Text style={{fontSize: 18, fontWeight: 'bold', color: colors.dark}}>
          {item.name}
        </Text>
      </View>
      <ItemSizeOptionList
        itemId={item?.item_id || item?.id}
        item={item}
        onChange={handleSizeOptionChange}
        onOptionsLoaded={handleSizeOptionsLoaded}
        emptyComponent={basePriceCard}
        listContentContainerStyle={{marginBottom: 20}}
      />
      {showUnitPicker ? (
        <View style={{marginTop: 20}}>
          <TextInput
            label="Quantity"
            mode="outlined"
            keyboardType="numeric"
            style={{backgroundColor: colors.surface}}
            value={values.in_menu_qty}
            onChangeText={value => {
              formik.setValues({...values, in_menu_qty: value});
            }}
          />
          <Dropdown
            label={'Unit'}
            mode={'flat'}
            visible={showUnitDropDown}
            showDropDown={() => setShowUnitDropDown(true)}
            onDismiss={() => setShowUnitDropDown(false)}
            value={effectiveUnit}
            hideMenuHeader
            onSelect={value => {
              formik.setValues({...values, in_menu_uom_abbrev: value});
            }}
            options={unitOptions}
            activeColor={colors.accent}
            dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
          />
          {needsNetWeight ? (
            <View style={{marginTop: 10}}>
              <TextInput
                label={`Item net weight — ${formatUOMAbbrev(
                  item.uom_abbrev,
                )} per piece`}
                mode="outlined"
                keyboardType="numeric"
                value={netWeight}
                onChangeText={setNetWeight}
                placeholder="e.g. 155"
                style={{backgroundColor: colors.surface}}
              />
              <HelperText type="info" visible={true}>
                Saved on the item so you can measure it by the piece from now on.
              </HelperText>
            </View>
          ) : showPreview ? (
            <Text style={{marginTop: 8, color: colors.neutralTint1}}>
              {`= ${previewBaseQty} ${formatUOMAbbrev(item.uom_abbrev)}`}
            </Text>
          ) : null}
        </View>
      ) : (
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
              const extractedValue = extractNumber(values.in_menu_qty);
              const inMenuQty = extractedValue ? parseFloat(extractedValue) : '';

              formik.setValues({
                ...values,
                in_menu_qty: (inMenuQty - 1).toString(),
              });
            }}>
            <MaterialCommunityIcons
              name="minus"
              size={37}
              color={colors.dark}
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
            value={commaNumber(values.in_menu_qty)?.toString() || ''}
            onChangeText={value => {
              const extractedValue = extractNumber(value);
              const inMenuQty = extractedValue ? parseFloat(extractedValue) : '';

              formik.setValues({
                ...values,
                in_menu_qty: inMenuQty.toString(),
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
              const extractedValue = extractNumber(values.in_menu_qty);
              const inMenuQty = extractedValue ? parseFloat(extractedValue) : '';

              formik.setValues({
                ...values,
                in_menu_qty: (inMenuQty + 1).toString(),
              });
            }}>
            <MaterialCommunityIcons name="plus" size={37} color={colors.dark} />
          </Pressable>
        </View>
      )}
      {needsNetWeight && !(parseFloat(netWeight) > 0) ? (
        <HelperText type="error" visible={true} style={{marginTop: 5}}>
          Enter the net weight per piece to continue.
        </HelperText>
      ) : null}
      <View style={{marginTop: 30, marginBottom: 15}}>
        <Button
          mode="contained"
          onPress={async () => {
            // Persist the net weight per piece (non-'ea' Piece entry, first time)
            // before saving so createSellingMenuItem re-reads it for conversion.
            if (needsNetWeight) {
              const nw = parseFloat(netWeight);
              if (!(nw > 0)) return;
              try {
                await setItemNetWeightPerPiece({
                  itemId: item.id,
                  qtyPerPiece: nw,
                });
              } catch (error) {
                setFieldError('in_menu_qty', error?.message);
                return;
              }
            }

            // inject some data to the values before submitting
            formik.setValues({
              ...formik.values,
              item_id: item.item_id || item.id,
            });

            handleSubmit();
          }}
          disabled={!canSubmit || (needsNetWeight && !(parseFloat(netWeight) > 0))}
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
  basePriceCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 20,
    borderWidth: 2,
    borderRadius: 25,
    marginTop: 10,
  },
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

export default SellingMenuItemForm;
