import React from 'react';
import {StyleSheet} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import HelperTextWithIcon from '../helpers/HelperTextWithIcon';

const LicenseValidationSchema = Yup.object().shape({
  license_key: Yup.string().uuid(
    'Invalid format of license key. Make sure you include all the dashes (-).',
  ),
});

const LicenseForm = props => {
  const {onSubmit, onCancel, autoFocus, submitButtonTitle = 'Activate'} = props;
  const {colors} = useTheme();

  const renderFormError = (touched, errors) => {
    if (errors.license_key && touched.license_key) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.license_key}
        </Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        license_key: '',
      }}
      validationSchema={LicenseValidationSchema}
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
          isValid,
          isSubmitting,
        } = props;

        return (
          <>
            <HelperTextWithIcon
              text="Make sure you include all the dashes (-) of the license key."
              containerStyle={{marginVertical: 10}}
            />
            <TextInput
              label="License Key"
              onChangeText={handleChange('license_key')}
              onBlur={handleBlur('license_key')}
              value={values.license_key}
              autoCapitalize="none"
              placeholder="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
              autoFocus={autoFocus}
              // error={errors.license_key && touched.license_key ? true : false}
            />
            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonTitle}
            </Button>
            <Button
              onPress={() => {
                onCancel && onCancel();
              }}
              style={{marginTop: 15}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({});

export default LicenseForm;
