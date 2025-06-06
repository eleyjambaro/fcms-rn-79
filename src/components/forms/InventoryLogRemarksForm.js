import React, {useState, useEffect} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, Divider, useTheme} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {Formik} from 'formik';
import * as Yup from 'yup';

const InventoryLogRemarksValidationSchema = Yup.object().shape({
  remarks: Yup.string().max(
    120,
    'Remarks should not be more than 120 characters',
  ),
});

const InventoryLogRemarksForm = props => {
  const {
    initialValues = {remarks: ''},
    onSubmit,
    onCancel,
    onFocus,
    autoFocus,
    submitButtonTitle = 'Save',
  } = props;
  const {colors} = useTheme();

  return (
    <Formik
      initialValues={{
        remarks: initialValues?.remarks || '',
      }}
      onSubmit={onSubmit}
      validationSchema={InventoryLogRemarksValidationSchema}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          dirty,
          isValid,
          isSubmitting,
        } = props;

        return (
          <>
            <TextInput
              multiline
              autoFocus={autoFocus}
              label="Remarks (Optional)"
              onChangeText={handleChange('remarks')}
              onBlur={handleBlur('remarks')}
              value={values.remarks}
              onFocus={() => {
                onFocus && onFocus();
              }}
              error={errors.remarks && touched.remarks ? true : false}
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {`${submitButtonTitle}`}
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

export default InventoryLogRemarksForm;
