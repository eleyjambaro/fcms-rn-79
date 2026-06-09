import React from 'react';
import {View, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import SelectionButtonList from '../buttons/SelectionButtonList';
import {
  IDT_COLUMNS,
  IDT_EXPORT_EXCLUDED_FIELDS,
  IDT_EXPORT_OPTIONAL_FIELDS,
} from '../../constants/inventoryDataTemplate';

const EmptyFileExportValidationSchema = Yup.object().shape({
  fileName: Yup.string().max(100, 'Too Long!').required('Required'),
});

const PopulatedFileExportValidationSchema = Yup.object().shape({
  fileName: Yup.string().max(100, 'Too Long!').required('Required'),
  columns: Yup.array().of(Yup.string()).min(1, 'Select at least one column'),
});

const InventoryDataTemplateFileExportForm = props => {
  const {
    editMode = false,
    mode = 'empty',
    initialValues,
    onSubmit,
    onCancel,
    submitButtonTitle = 'Proceed',
  } = props;
  const {colors} = useTheme();

  const exportableColumns = IDT_COLUMNS.filter(
    c => !IDT_EXPORT_EXCLUDED_FIELDS.includes(c.field),
  );
  // Every exportable column except the optional ones is locked-on for export.
  const lockedFields = exportableColumns
    .filter(c => !IDT_EXPORT_OPTIONAL_FIELDS.includes(c.field))
    .map(c => c.field);

  const resolvedInitialValues =
    mode === 'populated'
      ? {
          fileName: initialValues?.fileName ?? '',
          columns: initialValues?.columns ?? exportableColumns.map(c => c.field),
        }
      : {
          fileName: initialValues?.fileName ?? '',
          sheets: initialValues?.sheets ?? ['units'],
        };

  const validationSchema =
    mode === 'populated'
      ? PopulatedFileExportValidationSchema
      : EmptyFileExportValidationSchema;

  const handleSheetsSelectionChange = (value, actions) => {
    value && value.length > 0 && actions.setFieldTouched('sheets', true);
    actions.setFieldValue('sheets', value);
  };

  const handleColumnsSelectionChange = (value, actions) => {
    actions.setFieldTouched('columns', true);
    actions.setFieldValue('columns', value);
  };

  const renderSheetsSelection = ({
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
  }) => {
    const sheets = [{name: `Valid UOM's guide list`, value: 'units'}];

    const sheetSelections = sheets.map(sheet => {
      return {
        label: sheet.name,
        value: sheet.value,
      };
    });

    const selectionDefaultValue = [];

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {
            'Select an additional guide worksheet to include in a file (optional):'
          }
        </Subheading>
        <SelectionButtonList
          selections={sheetSelections}
          selectMany
          defaultValue={selectionDefaultValue}
          onChange={value => {
            handleSheetsSelectionChange(value, {
              setFieldValue,
              setFieldTouched,
            });
          }}
        />
        {errors.sheets && touched.sheets && (
          <Text style={{color: colors.error, marginTop: 10}}>
            {errors.sheets}
          </Text>
        )}
      </>
    );
  };

  const renderColumnsSelection = ({
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
    values,
  }) => {
    const columnSelections = exportableColumns.map(column => ({
      label: column.header,
      value: column.field,
    }));

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {
            'All columns are exported with values. You may deselect Total Stock Qty, Unit Cost, Total Cost, Stock Vendor, or Barcode to leave them blank:'
          }
        </Subheading>
        <SelectionButtonList
          selections={columnSelections}
          selectMany
          defaultValue={values.columns}
          disabledValues={lockedFields}
          onChange={value => {
            handleColumnsSelectionChange(value, {
              setFieldValue,
              setFieldTouched,
            });
          }}
        />
        {errors.columns && touched.columns && (
          <Text style={{color: colors.error, marginTop: 10}}>
            {errors.columns}
          </Text>
        )}
      </>
    );
  };

  return (
    <Formik
      initialValues={resolvedInitialValues}
      validationSchema={validationSchema}
      onSubmit={onSubmit}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          dirty,
          isSubmitting,
          isValid,
          setFieldValue,
          setFieldTouched,
        } = props;

        return (
          <>
            <View style={{flexDirection: 'row'}}>
              <TextInput
                style={{flex: 1}}
                label="File Name"
                onChangeText={handleChange('fileName')}
                onBlur={handleBlur('fileName')}
                value={values.fileName}
                error={errors.fileName && touched.fileName ? true : false}
              />
              {dirty && (
                <MaterialCommunityIcons
                  onPress={() =>
                    setFieldValue('fileName', resolvedInitialValues.fileName)
                  }
                  name="refresh"
                  size={25}
                  color={colors.dark}
                  style={{position: 'absolute', top: 18, right: 15}}
                />
              )}
            </View>
            {mode === 'populated'
              ? renderColumnsSelection({
                  errors,
                  touched,
                  setFieldValue,
                  setFieldTouched,
                  values,
                })
              : renderSheetsSelection({
                  errors,
                  touched,
                  setFieldValue,
                  setFieldTouched,
                })}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={
                (!editMode && mode !== 'populated' && !dirty) ||
                !isValid ||
                isSubmitting
              }
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonTitle}
            </Button>
            <Button onPress={onCancel} style={{marginTop: 10}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({});

export default InventoryDataTemplateFileExportForm;
