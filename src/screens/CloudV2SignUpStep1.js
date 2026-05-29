import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {
  Button,
  Text,
  TextInput,
  useTheme,
  HelperText,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

import routes from '../constants/routes';
import appDefaults from '../constants/appDefaults';
import CloudAppIcon from '../components/icons/CloudAppIcon';

const schema = Yup.object({
  company_name: Yup.string().required('Company name is required'),
  company_address: Yup.string(),
  company_email: Yup.string()
    .email('Enter a valid email')
    .required('Company email is required'),
});

const CloudV2SignUpStep1 = ({navigation}) => {
  const {colors} = useTheme();

  const handleNext = values => {
    navigation.navigate(routes.cloudV2SignUpStep2(), {
      companyName: values.company_name,
      companyAddress: values.company_address,
      companyEmail: values.company_email,
    });
  };

  return (
    <ScrollView
      contentContainerStyle={[
        styles.container,
        {backgroundColor: colors.surface},
      ]}
      keyboardShouldPersistTaps="handled">
      <CloudAppIcon
        mainText={`${appDefaults.appDisplayName}`}
        subText=""
        containerStyle={{marginBottom: 0}}
      />

      <View style={styles.stepHeader}>
        <Text style={[styles.stepLabel, {color: colors.primary}]}>
          Step 1 of 2
        </Text>
        <Text style={styles.stepTitle}>Company Details</Text>
        <Text style={styles.stepSubtitle}>Tell us about your business.</Text>
      </View>

      <Formik
        initialValues={{
          company_name: '',
          company_address: '',
          company_email: '',
        }}
        validationSchema={schema}
        onSubmit={handleNext}>
        {({
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
        }) => (
          <View style={styles.form}>
            <TextInput
              label="Company Name *"
              value={values.company_name}
              onChangeText={handleChange('company_name')}
              onBlur={handleBlur('company_name')}
              mode="outlined"
              error={touched.company_name && !!errors.company_name}
              style={styles.input}
            />
            {touched.company_name && errors.company_name ? (
              <HelperText type="error">{errors.company_name}</HelperText>
            ) : null}

            <TextInput
              label="Company Address"
              value={values.company_address}
              onChangeText={handleChange('company_address')}
              onBlur={handleBlur('company_address')}
              mode="outlined"
              style={styles.input}
            />

            <TextInput
              label="Company Email *"
              value={values.company_email}
              onChangeText={handleChange('company_email')}
              onBlur={handleBlur('company_email')}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              mode="outlined"
              error={touched.company_email && !!errors.company_email}
              style={styles.input}
            />
            {touched.company_email && errors.company_email ? (
              <HelperText type="error">{errors.company_email}</HelperText>
            ) : null}

            <View style={styles.actions}>
              <Button
                mode="outlined"
                onPress={() => navigation.goBack()}
                style={styles.backButton}>
                Back
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={styles.nextButton}
                contentStyle={styles.buttonContent}>
                Next
              </Button>
            </View>
          </View>
        )}
      </Formik>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 24,
    justifyContent: 'center',
  },
  stepHeader: {
    marginBottom: 24,
  },
  stepLabel: {
    fontSize: 13,
    fontWeight: '600',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  stepTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    marginBottom: 6,
  },
  stepSubtitle: {
    fontSize: 14,
    opacity: 0.65,
  },
  form: {
    gap: 4,
  },
  input: {
    marginBottom: 2,
  },
  actions: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 20,
  },
  backButton: {
    flex: 1,
    borderRadius: 8,
  },
  nextButton: {
    flex: 2,
    borderRadius: 8,
  },
  buttonContent: {
    paddingVertical: 6,
  },
});

export default CloudV2SignUpStep1;
