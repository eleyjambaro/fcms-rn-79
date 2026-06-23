import React, {useState} from 'react';
import {StyleSheet, ScrollView, View, Pressable} from 'react-native';
import {
  Button,
  TextInput,
  HelperText,
  useTheme,
  Text,
} from 'react-native-paper';
import {useFormik} from 'formik';
import * as Yup from 'yup';
import convert from 'convert-units';
import {useMutation, useQueryClient} from '@tanstack/react-query';
import {Dropdown} from 'react-native-paper-dropdown';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import MoreSelectionButton from '../components/buttons/MoreSelectionButton';
import QuantityUOMText from '../components/forms/QuantityUOMText';
import {updateMasterItem} from '../serverDbQueries/v2/masterItems';
import {PACKAGING_TYPE_OPTIONS} from '../constants/itemForm';
import {generateMasterItemDescription} from '../utils/generateMasterItemDescription';

// Render a UOM abbreviation as its full measurement name (e.g. "kg" -> "Kilogram")
// via convert-units. "ea" (Each) is shown as "Each (Piece)" because most users
// recognize "Piece" more readily than "Each".
const formatUOMName = uomAbbrev => {
  if (!uomAbbrev) return '';
  if (uomAbbrev === 'ea') return 'Each (Piece)';
  try {
    return convert().describe(uomAbbrev).singular;
  } catch (e) {
    return uomAbbrev;
  }
};

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
    .test(
      'numeric',
      'Must be a number',
      v => v == null || v === '' || !isNaN(Number(v)),
    )
    .test(
      'non-negative',
      'Cannot be negative',
      v => v == null || v === '' || Number(v) >= 0,
    ),
  packaging_type: Yup.string().nullable().max(64),
});

// Dropdown forwards only a fixed set of TextInputProps to its inner input and
// no style passthrough, so we supply a custom input to bold the selected value
// — matching the bold value text on the TextInput fields.
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
    contentStyle={styles.valueText}
  />
);

const EditMasterItem = ({navigation, route}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
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
      // Pre-toggle the per-piece block on if ANY of the per-piece fields are
      // already set on the master — not just uom_abbrev_per_piece. An offline
      // registration that lands a partial master row (e.g. qty_per_piece +
      // packaging_type but uom_abbrev_per_piece NULL) would otherwise render
      // with the checkbox unchecked and the block hidden, and saving in that
      // state would null out the existing qty / packaging values.
      add_measurement_per_piece: !!(
        master?.uom_abbrev_per_piece ||
        (master?.qty_per_piece != null && master?.qty_per_piece !== '') ||
        master?.packaging_type
      ),
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
          contentStyle={styles.valueText}
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
          contentStyle={styles.valueText}
        />
        <HelperText
          type={
            formik.touched.description && formik.errors.description
              ? 'error'
              : 'info'
          }
          visible>
          {formik.touched.description && formik.errors.description
            ? formik.errors.description
            : 'Canonical product name. Mirrors to every linked branch item on save.'}
        </HelperText>
        <View style={styles.regenerateRow}>
          <Button
            icon="autorenew"
            mode="text"
            compact
            onPress={() => {
              // Feed the current description back in as the "name" — the
              // generator strips redundant tokens (packaging words, "260G"
              // patterns) and recomposes from the current variant fields, so
              // the user can hand-edit the description and re-trigger.
              // If the user cleared the input, fall back to the master's
              // original description so Regenerate doesn't emit a name-less
              // " PACK 50G" string.
              const sourceName =
                (formik.values.description?.trim()
                  ? formik.values.description
                  : master?.description) ?? '';
              const next = generateMasterItemDescription({
                name: sourceName,
                uom_abbrev: formik.values.uom_abbrev,
                uom_abbrev_per_piece: formik.values.add_measurement_per_piece
                  ? formik.values.uom_abbrev_per_piece
                  : '',
                qty_per_piece: formik.values.add_measurement_per_piece
                  ? formik.values.qty_per_piece
                  : '',
                packaging_type: formik.values.add_measurement_per_piece
                  ? formik.values.packaging_type
                  : '',
              });
              formik.setFieldValue('description', next);
              formik.setFieldTouched('description', true);
            }}>
            Regenerate Description
          </Button>
        </View>

        <View style={{flexDirection: 'row'}}>
          <TextInput
            label="Barcode (Optional)"
            value={formik.values.barcode}
            onChangeText={formik.handleChange('barcode')}
            onBlur={formik.handleBlur('barcode')}
            error={!!(formik.touched.barcode && formik.errors.barcode)}
            style={[styles.input, {flex: 1}]}
            contentStyle={styles.valueText}
          />
          <Pressable
            onPress={() => {
              navigation.navigate('ScanBarcode', {
                onBarCodeRead: value =>
                  formik.setFieldValue('barcode', value ?? ''),
              });
            }}
            hitSlop={10}
            style={{position: 'absolute', top: 18, right: 15}}>
            <MaterialCommunityIcons
              name="barcode-scan"
              size={25}
              color={colors.dark}
            />
          </Pressable>
        </View>
        {formik.touched.barcode && formik.errors.barcode ? (
          <HelperText type="error" visible>
            {formik.errors.barcode}
          </HelperText>
        ) : null}

        <MoreSelectionButton
          containerStyle={{marginTop: 4}}
          placeholder="Select Unit"
          label="Unit of Measurement"
          disabled
          renderValueCurrentValue={formik.values.uom_abbrev}
          renderValue={(_v, p) => (
            <Text variant="titleMedium" {...p}>
              {p?.trimTextLength(formatUOMName(formik.values.uom_abbrev))}
            </Text>
          )}
          onPress={() => {}}
        />
        <HelperText type="info" visible>
          Unit of measurement and per-piece quantity can't be changed once an
          item exists — transactions may already be recorded against them. To
          use a different unit, register a new master item for that variant.
        </HelperText>

        {/* Per-piece variant fields are write-once (insert-only on sync), so the
            toggle is omitted here and any existing per-piece values are shown
            read-only. A genuine UOM/per-piece change means a new master. */}
        {formik.values.add_measurement_per_piece ? (
          <>
            <MoreSelectionButton
              containerStyle={{marginTop: -1}}
              placeholder="Select Unit"
              label="UOM Per Piece (Per Package)"
              disabled
              renderValueCurrentValue={formik.values.uom_abbrev_per_piece}
              renderValue={(_v, p) => (
                <Text variant="titleMedium" {...p}>
                  {p?.trimTextLength(
                    formatUOMName(formik.values.uom_abbrev_per_piece),
                  )}
                </Text>
              )}
              onPress={() => {}}
            />

            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Qty. Per Piece / Item Net Wt."
                value={formik.values.qty_per_piece}
                disabled
                keyboardType="numeric"
                style={[styles.input, {flex: 1}]}
                contentStyle={styles.valueText}
              />
              <QuantityUOMText
                uomAbbrev={formik.values.uom_abbrev_per_piece}
                quantity={formik.values.qty_per_piece}
                concatText={' each'}
              />
            </View>

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
              CustomDropdownInput={BoldDropdownInput}
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
  valueText: {
    fontWeight: 'bold',
  },
  regenerateRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    marginTop: -8,
    marginBottom: 4,
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
