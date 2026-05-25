import React, {useState} from 'react';
import {StyleSheet, ScrollView, View} from 'react-native';
import {
  Button,
  TextInput,
  HelperText,
  useTheme,
  Text,
} from 'react-native-paper';
import {useFormik} from 'formik';
import * as Yup from 'yup';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Dropdown} from 'react-native-paper-dropdown';

import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import ConfirmationCheckbox from '../components/forms/ConfirmationCheckbox';
import QuantityUOMText from '../components/forms/QuantityUOMText';
import useItemFormContext from '../hooks/useItemFormContext';
import {updateMasterItem} from '../serverDbQueries/v2/masterItems';
import {PACKAGING_TYPE_OPTIONS} from '../constants/itemForm';

const EditMasterItemSchema = Yup.object({
  sku: Yup.string()
    .trim()
    .required('Required')
    .max(64, 'Too long')
    .matches(/^[A-Z0-9-]+$/i, 'Letters, digits, and dashes only'),
  description: Yup.string().nullable().max(500, 'Too long'),
  barcode: Yup.string().nullable().max(255, 'Too long'),
  uom_abbrev: Yup.string().nullable().max(64),
  uom_abbrev_per_piece: Yup.string().nullable().max(64),
  qty_per_piece: Yup.string()
    .nullable()
    .test('numeric', 'Must be a number', v => v == null || v === '' || !isNaN(Number(v)))
    .test('non-negative', 'Cannot be negative', v => v == null || v === '' || Number(v) >= 0),
  packaging_type: Yup.string().nullable().max(64),
});

const EditMasterItem = ({navigation, route}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {setFormikActions} = useItemFormContext();
  const master = route.params?.master ?? null;
  const [actionError, setActionError] = useState('');
  const [showPackagingDropDown, setShowPackagingDropDown] = useState(false);

  const updateMutation = useMutation(updateMasterItem, {
    onSuccess: () => {
      queryClient.invalidateQueries(['masterItems']);
      // The mirror on the server stamps every linked items row in the
      // company; local item list / item view queries need a refetch so the
      // renamed/reshaped branch items show through.
      queryClient.invalidateQueries(['items']);
      navigation.goBack();
    },
    onError: err => {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ??
        (status === 409
          ? 'That SKU is already used by another master item.'
          : 'Failed to update master item.');
      setActionError(message);
    },
  });

  const formik = useFormik({
    initialValues: {
      sku: master?.sku ?? '',
      description: master?.description ?? '',
      barcode: master?.barcode ?? '',
      uom_abbrev: master?.uom_abbrev ?? '',
      uom_abbrev_per_piece: master?.uom_abbrev_per_piece ?? '',
      qty_per_piece:
        master?.qty_per_piece != null && master?.qty_per_piece !== ''
          ? String(master.qty_per_piece)
          : '',
      packaging_type: master?.packaging_type ?? '',
      // Pre-toggle the per-piece block on if the master already has it set.
      add_measurement_per_piece: !!master?.uom_abbrev_per_piece,
    },
    validationSchema: EditMasterItemSchema,
    onSubmit: values => {
      setActionError('');
      updateMutation.mutate({
        id: master.id,
        sku: values.sku.trim().toUpperCase(),
        description: values.description ?? '',
        barcode: values.barcode || null,
        uom_abbrev: values.uom_abbrev || null,
        uom_abbrev_per_piece: values.add_measurement_per_piece
          ? values.uom_abbrev_per_piece || null
          : null,
        qty_per_piece:
          values.add_measurement_per_piece && values.qty_per_piece
            ? Number(values.qty_per_piece)
            : null,
        packaging_type: values.add_measurement_per_piece
          ? values.packaging_type || null
          : null,
      });
    },
  });

  if (!master) {
    return (
      <View style={[styles.container, {backgroundColor: colors.surface}]}>
        <Text style={styles.errorText}>Master item not provided.</Text>
        <Button onPress={() => navigation.goBack()}>Back</Button>
      </View>
    );
  }

  const navigateToUOM = uomFieldKey => {
    setFormikActions(() => ({
      setFieldValue: formik.setFieldValue,
      setFieldTouched: formik.setFieldTouched,
      setFieldError: formik.setFieldError,
    }));
    navigation.navigate('ItemUOM', {
      uom_abbrev: formik.values[uomFieldKey],
      uom_abbrev_field_key: uomFieldKey,
    });
  };

  const handleTogglePerPiece = () => {
    if (formik.values.add_measurement_per_piece) {
      formik.setFieldValue('uom_abbrev_per_piece', '');
      formik.setFieldValue('qty_per_piece', '');
      formik.setFieldValue('packaging_type', '');
      formik.setFieldValue('add_measurement_per_piece', false);
    } else {
      formik.setFieldValue('add_measurement_per_piece', true);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <TextInput
          label="SKU"
          value={formik.values.sku}
          onChangeText={formik.handleChange('sku')}
          onBlur={formik.handleBlur('sku')}
          autoCapitalize="characters"
          error={!!(formik.touched.sku && formik.errors.sku)}
          style={styles.input}
        />
        <HelperText
          type={formik.touched.sku && formik.errors.sku ? 'error' : 'info'}
          visible>
          {formik.touched.sku && formik.errors.sku
            ? formik.errors.sku
            : 'Unique within this company.'}
        </HelperText>

        <TextInput
          label="Description"
          value={formik.values.description}
          onChangeText={formik.handleChange('description')}
          onBlur={formik.handleBlur('description')}
          multiline
          error={!!(formik.touched.description && formik.errors.description)}
          style={styles.input}
        />
        <HelperText
          type={formik.touched.description && formik.errors.description ? 'error' : 'info'}
          visible>
          {formik.touched.description && formik.errors.description
            ? formik.errors.description
            : 'Canonical product name. Mirrors to every linked branch item on save.'}
        </HelperText>

        <TextInput
          label="Barcode (Optional)"
          value={formik.values.barcode}
          onChangeText={formik.handleChange('barcode')}
          onBlur={formik.handleBlur('barcode')}
          error={!!(formik.touched.barcode && formik.errors.barcode)}
          style={styles.input}
        />
        {formik.touched.barcode && formik.errors.barcode ? (
          <HelperText type="error" visible>
            {formik.errors.barcode}
          </HelperText>
        ) : null}

        <MoreSelectionButton
          containerStyle={{marginTop: 4}}
          placeholder="Select Unit"
          label="Unit of Measurement"
          renderValueCurrentValue={formik.values.uom_abbrev}
          renderValue={(_v, p) => (
            <Text variant="titleMedium" {...p}>
              {p?.trimTextLength(formik.values.uom_abbrev)}
            </Text>
          )}
          onPress={() => navigateToUOM('uom_abbrev')}
        />

        <View style={styles.perPieceToggle}>
          <ConfirmationCheckbox
            status={formik.values.add_measurement_per_piece}
            text="Set a UOM Per Piece / Item Net Wt."
            containerStyle={{paddingTop: 5, paddingBottom: 5}}
            onPress={handleTogglePerPiece}
          />
        </View>

        {formik.values.add_measurement_per_piece ? (
          <>
            <MoreSelectionButton
              containerStyle={{marginTop: -1}}
              placeholder="Select Unit"
              label="UOM Per Piece (Per Package)"
              renderValueCurrentValue={formik.values.uom_abbrev_per_piece}
              renderValue={(_v, p) => (
                <Text variant="titleMedium" {...p}>
                  {p?.trimTextLength(formik.values.uom_abbrev_per_piece)}
                </Text>
              )}
              onPress={() => navigateToUOM('uom_abbrev_per_piece')}
            />

            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Qty. Per Piece / Item Net Wt."
                value={formik.values.qty_per_piece}
                onChangeText={formik.handleChange('qty_per_piece')}
                onBlur={formik.handleBlur('qty_per_piece')}
                keyboardType="numeric"
                error={!!(formik.touched.qty_per_piece && formik.errors.qty_per_piece)}
                style={[styles.input, {flex: 1}]}
              />
              <QuantityUOMText
                uomAbbrev={formik.values.uom_abbrev_per_piece}
                quantity={formik.values.qty_per_piece}
                concatText={' each'}
              />
            </View>
            {formik.touched.qty_per_piece && formik.errors.qty_per_piece ? (
              <HelperText type="error" visible>
                {formik.errors.qty_per_piece}
              </HelperText>
            ) : null}

            <Dropdown
              label="Packaging Type (Optional)"
              mode="flat"
              visible={showPackagingDropDown}
              showDropDown={() => setShowPackagingDropDown(true)}
              onDismiss={() => setShowPackagingDropDown(false)}
              value={formik.values.packaging_type}
              hideMenuHeader
              onSelect={value =>
                formik.setFieldValue('packaging_type', value ?? '')
              }
              options={PACKAGING_TYPE_OPTIONS}
              activeColor={colors.accent}
              dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
            />
          </>
        ) : null}

        {actionError ? (
          <HelperText type="error" visible>
            {actionError}
          </HelperText>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <Button onPress={() => navigation.goBack()} style={styles.footerButton}>
          Cancel
        </Button>
        <Button
          mode="contained"
          loading={updateMutation.isLoading}
          disabled={updateMutation.isLoading}
          onPress={formik.handleSubmit}
          style={styles.footerButton}>
          Save
        </Button>
      </View>
    </View>
  );
};

export default EditMasterItem;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  input: {
    marginBottom: 4,
  },
  perPieceToggle: {
    marginVertical: 10,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    padding: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  footerButton: {
    marginLeft: 8,
  },
  errorText: {
    padding: 16,
  },
});
