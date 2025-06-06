import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import SelectionButtonList from '../buttons/SelectionButtonList';

const FileExportValidationSchema = Yup.object().shape({
  fileName: Yup.string().max(100, 'Too Long!').required('Required'),
  // sheets: Yup.array().min(1, 'Must have at least one selected sheets data'), // items, categories
});

const WastageReportFileExportForm = props => {
  const {
    selectedDateFilter,
    editMode = false,
    initialValues = {fileName: '', sheets: ['items', 'cost-analysis']},
    onSubmit,
    onCancel,
    submitButtonTitle = 'Proceed',
  } = props;
  const {colors} = useTheme();

  const handleSheetsSelectionChange = (value, actions) => {
    value && value.length > 0 && actions.setFieldTouched('sheets', true);
    actions.setFieldValue('sheets', value);
  };

  const renderSheetsSelection = ({
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
  }) => {
    const sheets = [
      {name: 'Cost Analysis', value: 'cost-analysis'},
      {name: 'Item List', value: 'items'},
    ];

    const sheetSelections = sheets.map(sheet => {
      return {
        label: sheet.name,
        value: sheet.value,
      };
    });

    const selectionDefaultValue = ['items', 'cost-analysis'];

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {'Select report data to include in a file:'}
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

  const renderHelperText = () => {
    if (selectedDateFilter?.value === 'exact-date') {
      return (
        <HelperText
          style={{
            color: colors.dark,
            marginVertical: 10,
            fontStyle: 'italic',
          }}>
          {`* You are about to export a list of spoilages / wastages within your selected date only. If you want to change the scope of your exporting data, you can change the date filter and then export again.`}
        </HelperText>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        fileName: initialValues.fileName,
        sheets: initialValues.sheets || [],
      }}
      validationSchema={FileExportValidationSchema}
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
                // autoFocus={editMode ? true : false}
              />
              {dirty && (
                <MaterialCommunityIcons
                  onPress={() =>
                    setFieldValue('fileName', initialValues.fileName)
                  }
                  name="refresh"
                  size={25}
                  color={colors.dark}
                  style={{position: 'absolute', top: 18, right: 15}}
                />
              )}
            </View>
            {/* {renderSheetsSelection({
              errors,
              touched,
              setFieldValue,
              setFieldTouched,
            })} */}
            {renderHelperText()}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={(!editMode && !dirty) || !isValid || isSubmitting}
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

export default WastageReportFileExportForm;
