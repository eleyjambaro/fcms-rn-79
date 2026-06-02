import React, {useState} from 'react';
import {StyleSheet} from 'react-native';
import {
  Button,
  useTheme,
  TextInput,
  Paragraph,
  Dialog,
  Portal,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';

const RevenueSourceValidationSchema = Yup.object().shape({
  name: Yup.string().required('Required'),
});

/**
 * Create / rename an external revenue (POS) source. Name only.
 */
const RevenueSourceForm = props => {
  const {
    editMode = false,
    revenueSource,
    initialValues = {name: ''},
    onSubmit,
    onCancel,
    autoFocus = false,
    submitButtonTitle = 'Create',
  } = props;
  const {colors} = useTheme();
  const [isUpdateConfirmed, setIsUpdateConfirmed] = useState(false);
  const [updateDialogVisible, setUpdateDialogVisible] = useState(false);

  const handleFormSubmit = (values, actions) => {
    if (editMode && !isUpdateConfirmed) {
      actions.setSubmitting(false);
      setUpdateDialogVisible(true);
    } else {
      onSubmit(values, actions);
    }
  };

  return (
    <Formik
      initialValues={{name: initialValues.name || ''}}
      validationSchema={RevenueSourceValidationSchema}
      onSubmit={handleFormSubmit}>
      {formikProps => {
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
        } = formikProps;

        return (
          <>
            <Portal>
              <Dialog
                visible={updateDialogVisible}
                onDismiss={() => setUpdateDialogVisible(false)}>
                <Dialog.Title>Update revenue source?</Dialog.Title>
                <Dialog.Content>
                  <Paragraph>
                    {`You are about to update ${
                      revenueSource?.name ? revenueSource.name + ' ' : ''
                    }revenue source.`}
                  </Paragraph>
                </Dialog.Content>
                <Dialog.Actions style={{justifyContent: 'space-around'}}>
                  <Button onPress={() => setUpdateDialogVisible(false)}>
                    Cancel
                  </Button>
                  <Button
                    loading={isSubmitting}
                    disabled={isSubmitting}
                    icon={'check-outline'}
                    onPress={() => {
                      setIsUpdateConfirmed(() => true);
                      setUpdateDialogVisible(false);
                      handleSubmit();
                    }}
                    color={colors.accent}>
                    Confirm
                  </Button>
                </Dialog.Actions>
              </Dialog>
            </Portal>
            <TextInput
              label="Name (e.g. External POS1)"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
              error={errors.name && touched.name ? true : false}
              autoFocus={autoFocus}
            />
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

export default RevenueSourceForm;
