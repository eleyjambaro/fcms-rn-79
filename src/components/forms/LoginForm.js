import React, {useState} from 'react';
import {StyleSheet, View} from 'react-native';
import {TextInput, Button, Text, useTheme} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const LoginValidationSchema = Yup.object().shape({
  username: Yup.string().required('Username field is required.'),
  password: Yup.string().required('Password field is required.'),
});

const LoginForm = props => {
  const {item, onSubmit, onCancel} = props;
  const {colors} = useTheme();
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);

  const renderFormError = (touched, errors) => {
    if (
      (errors.username && touched.username) ||
      (errors.password && touched.password)
    ) {
      return (
        <Text style={{color: colors.error, marginTop: 10}}>
          {errors.username || errors.password}
        </Text>
      );
    }
  };

  return (
    <Formik
      initialValues={{
        username: '',
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
            <View style={{marginBottom: 40, paddingHorizontal: 25}}>
              <Text
                style={{
                  fontWeight: 'bold',
                  fontSize: 16,
                  marginBottom: 10,
                  textAlign: 'center',
                }}>
                Log in to your local account
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: colors.neutralTint2,
                  textAlign: 'center',
                }}>
                {`Log in as a root user, admin, encoder, or any other local user on this device.`}
              </Text>
            </View>

            <TextInput
              label="Email / Username"
              onChangeText={handleChange('username')}
              onBlur={handleBlur('username')}
              value={values.username}
              autoCapitalize="none"
              error={errors.username && touched.username ? true : false}
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
              Login
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

export default LoginForm;
