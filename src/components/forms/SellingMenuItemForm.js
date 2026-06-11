import React, {useState, useCallback} from 'react';
import {View, Pressable, StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {useFormik} from 'formik';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import * as Yup from 'yup';
import commaNumber from 'comma-number';

import {extractNumber, formatUOMAbbrev} from '../../utils/stringHelpers';
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
  const handleSizeOptionsLoaded = useCallback(count => {
    setSizeOptionsCount(count);
  }, []);

  const formik = useFormik({
    initialValues: {
      item_id: item?.id,
      size_option_id: initialValues.size_option_id?.toString() || '',
      in_option_qty: initialValues.in_option_qty?.toString() || '',
      in_menu_qty: initialValues.in_menu_qty?.toString() || '1',
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
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(inMenuQty || 0);

            formik.setValues({
              ...values,
              in_menu_qty: (inMenuQty - 1).toString(),
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
          value={commaNumber(values.in_menu_qty)?.toString() || ''}
          onChangeText={value => {
            const extractedValue = extractNumber(value);
            const inMenuQty = extractedValue ? parseFloat(extractedValue) : '';
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(inMenuQty || 0);

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
            const saleSubtotal =
              parseFloat(item?.unit_selling_price || 0) *
              parseFloat(inMenuQty || 0);

            formik.setValues({
              ...values,
              in_menu_qty: (inMenuQty + 1).toString(),
            });
          }}>
          <MaterialCommunityIcons name="plus" size={37} color={colors.dark} />
        </Pressable>
      </View>
      <View style={{marginTop: 30, marginBottom: 15}}>
        <Button
          mode="contained"
          onPress={() => {
            // inject some data to the values before submitting
            formik.setValues({
              ...formik.values,
              item_id: item.item_id || item.id,
            });

            handleSubmit();
          }}
          disabled={!canSubmit}
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
