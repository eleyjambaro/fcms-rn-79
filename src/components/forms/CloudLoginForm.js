import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const LoginValidationSchema = Yup.object().shape({
  email: Yup.string()
    .email('Invalid email.')
    .required('Email field is required.'),
  password: Yup.string().required('Password field is required.'),
});

const CloudLoginForm = props => {
  const {item, initialValues, onSubmit, onCancel} = props;
  const {colors} = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const renderFormError = (touched, errors) => {
    if (
      (errors.email && touched.email) ||
      (errors.password && touched.password)
    ) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.email || errors.password}
        </Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        email: initialValues?.email || '',
        password: '',
      }}
      validationSchema={LoginValidationSchema}
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
            <TextInput
              label="Email"
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              value={values.email}
              autoCapitalize="none"
              keyboardType="email-address"
              error={errors.email && touched.email ? true : false}
            />
            <View style={{flexDirection: 'row'}}>
              <TextInput
                label="Password"
                onChangeText={handleChange('password')}
                onBlur={handleBlur('password')}
                value={values.password}
                secureTextEntry={isPasswordVisible ? false : true}
                style={[styles.textInput, {flex: 1}]}
                autoCapitalize="none"
                error={errors.password && touched.password ? true : false}
              />
              <MaterialCommunityIcons
                name={isPasswordVisible ? 'eye-off-outline' : 'eye-outline'}
                size={25}
                color={colors.dark}
                onPress={() => setIsPasswordVisible(() => !isPasswordVisible)}
                style={{position: 'absolute', top: 18, right: 15}}
              />
            </View>
            {renderFormError(touched, errors)}

            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              Submit
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  textInput: {},
});

export default CloudLoginForm;
