import React from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

const TextValidationSchema = Yup.object().shape({
  text_to_retype: Yup.string().default('delete_account_permanently'),
  text: Yup.string()
    .required('Please retype the text to confirm.')
    .oneOf([Yup.ref('text_to_retype'), null], 'Text must match.'),
});

const RetypeTextToConfirmForm = props => {
  const {
    initialValues = {
      text_to_retype: 'delete_account_permanently',
    },
    onSubmit,
    onCancel,
    autoFocus,
  } = props;
  const {colors} = useTheme();

  const renderFormError = (touched, errors) => {
    if (errors.text && touched.text) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>{errors.text}</Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        text_to_retype:
          initialValues.text_to_retype || 'delete_account_permanently',
        text: '',
      }}
      validationSchema={TextValidationSchema}
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
            <View style={{marginBottom: 15}}>
              <Text>
                {'Type '}
                <Text
                  style={{
                    fontWeight: 'bold',
                    fontStyle: 'italic',
                    backgroundColor: colors.highlighted,
                  }}>
                  {' delete_account_permanently '}
                </Text>
                {' to proceed with account deletion.'}
              </Text>
            </View>
            <TextInput
              onChangeText={handleChange('text')}
              onBlur={handleBlur('text')}
              value={values.text}
              autoCapitalize="none"
              placeholder={values.text_to_retype || ''}
              autoFocus={autoFocus}
              // error={errors.text && touched.text ? true : false}
            />
            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              icon={'delete-outline'}
              color={colors.notification}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              Proceed
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

export default RetypeTextToConfirmForm;
