import React from 'react';
import {StyleSheet} from 'react-native';
import {TextInput, Button} from 'react-native-paper';
import {Formik} from 'formik';

const UnitOfMeasurementForm = props => {
  const {initialValues = {name: '', abbrev: ''}, onSubmit, onCancel} = props;

  return (
    <Formik
      initialValues={{
        name: initialValues.name,
        abbrev: initialValues.abbrev,
      }}
      onSubmit={onSubmit}>
      {props => {
        const {handleChange, handleBlur, handleSubmit, values} = props;

        return (
          <>
            <TextInput
              label="Name of Measurement (e.g. Kilogram)"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
            />
            <TextInput
              label="Measurement abbreviation (e.g. kg)"
              onChangeText={handleChange('abbrev')}
              onBlur={handleBlur('abbrev')}
              value={values.abbrev}
              autoCapitalize="none"
            />
            <Button
              mode="contained"
              onPress={handleSubmit}
              style={{marginTop: 20}}>
              Create
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

export default UnitOfMeasurementForm;
