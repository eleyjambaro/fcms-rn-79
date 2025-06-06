import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  Button,
  useTheme,
  TextInput,
  Text,
  Subheading,
  Modal,
  Title,
  Paragraph,
  Dialog,
  Portal,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import {getRevenueCategoryIds} from '../../localDbQueries/revenues';
import SelectionButtonList from '../buttons/SelectionButtonList';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import ListEmpty from '../stateIndicators/ListEmpty';
import TestModeLimitModal from '../modals/TestModeLimitModal';
import {createCategory, getCategories} from '../../localDbQueries/categories';
import CategoryForm from './CategoryForm';
import * as RootNavigation from '../../../RootNavigation';
import routes from '../../constants/routes';
import ErrorMessageModal from '../modals/ErrorMessageModal';
import {ScrollView} from 'react-native-gesture-handler';

const RevenueGroupValidationSchema = Yup.object().shape({
  name: Yup.string().required('Required'),
  category_ids: Yup.array().min(1, 'Must have at least one selected category'),
});

const RevenueGroupForm = props => {
  const {
    editMode = false,
    revenueGroup,
    initialValues = {category_ids: [], name: ''},
    onSubmit,
    onCancel,
    autoFocus = false,
    submitButtonTitle = 'Create',
    onDismiss,
  } = props;
  const {colors} = useTheme();
  const {status: categoriesStatus, data: categoriesData} = useQuery(
    ['categories', {limit: 100}],
    getCategories,
  );
  const queryClient = useQueryClient();
  const createCategoryMutation = useMutation(createCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
  const {status: revenueCategoryIdsStatus, data: revenueCategoryIdsData} =
    useQuery(
      ['revenueCategoryIds', {id: revenueGroup?.id}],
      getRevenueCategoryIds,
      {enabled: editMode && revenueGroup ? true : false},
    );
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const [createCategoryModalVisible, setCreateCategoryModalVisible] =
    useState(false);

  const [isUpdateConfirmed, setIsUpdateConfirmed] = useState(false);

  const [updateRevenueGroupDialogVisible, setUpdateRevenueGroupDialogVisible] =
    useState(false);

  const showUpdateRevenueGroupDialog = () =>
    setUpdateRevenueGroupDialogVisible(true);
  const hideUpdateRevenueGroupDialog = () =>
    setUpdateRevenueGroupDialogVisible(false);

  const showCreateCategoryModal = () => setCreateCategoryModalVisible(true);
  const hideCreateCategoryModal = () => setCreateCategoryModalVisible(false);

  const handleCategoryIdsChange = (value, actions) => {
    value && value.length > 0 && actions.setFieldTouched('category_ids', true);
    actions.setFieldValue('category_ids', value);
  };

  const handleCancelCreateCategoryForm = () => {
    hideCreateCategoryModal();
  };

  const handleSubmitCreateCategoryForm = async (values, actions) => {
    console.log(values);
    try {
      await createCategoryMutation.mutateAsync({
        category: values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onFormValidationError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }

    hideCreateCategoryModal();
  };

  const handleFormSubmit = (values, actions) => {
    if (editMode && !isUpdateConfirmed) {
      actions.setSubmitting(false);
      showUpdateRevenueGroupDialog();
    } else {
      onSubmit(values, actions);
    }
  };

  const renderRevenueGroupsSelection = ({
    values,
    errors,
    touched,
    setFieldTouched,
    setFieldValue,
  }) => {
    if (
      categoriesStatus === 'loading' ||
      (editMode && revenueCategoryIdsStatus === 'loading')
    ) {
      return <DefaultLoadingScreen />;
    }

    if (
      categoriesStatus === 'error' ||
      (editMode && revenueCategoryIdsStatus === 'error')
    ) {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    const categories = categoriesData?.result;

    if (!categories?.length > 0) {
      return (
        <ListEmpty
          containerStyle={{flex: 0, paddingBottom: 10}}
          message="In order to create revenue group, there must be at least one category from inventory."
          actions={[
            {
              label: 'Create category',
              handler: () => {
                showCreateCategoryModal();
              },
            },
          ]}
        />
      );
    }

    const categorySelections = categories.map(category => {
      return {
        label: category.name,
        value: category.id,
      };
    });

    const selectionDefaultValue = editMode
      ? revenueCategoryIdsData?.result
      : null;

    return (
      <>
        <Subheading style={{marginTop: 20, marginBottom: 15}}>
          {
            'Select one or more categories from inventory that is/are included to this revenue to calculate '
          }
          {
            <Subheading style={{fontWeight: 'bold'}}>
              cost percentage
            </Subheading>
          }
          {':'}
        </Subheading>
        <ScrollView>
          <SelectionButtonList
            selections={categorySelections}
            value={values}
            selectMany
            defaultValue={selectionDefaultValue}
            onChange={value => {
              handleCategoryIdsChange(value, {
                setFieldValue,
                setFieldTouched,
              });
            }}
          />
        </ScrollView>
        {errors.category_ids && touched.category_ids && (
          <Text style={{color: colors.error, marginTop: 10}}>
            {errors.category_ids}
          </Text>
        )}
      </>
    );
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createCategoryModalVisible}
          onDismiss={hideCreateCategoryModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Category
          </Title>
          <CategoryForm
            onSubmit={handleSubmitCreateCategoryForm}
            onCancel={handleCancelCreateCategoryForm}
          />
        </Modal>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <Formik
        initialValues={{
          category_ids: initialValues.category_ids || [],
          name: initialValues.name || '',
        }}
        validationSchema={RevenueGroupValidationSchema}
        onSubmit={handleFormSubmit}>
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
            setFieldTouched,
            setFieldValue,
          } = props;

          return (
            <>
              <Portal>
                <Dialog
                  visible={updateRevenueGroupDialogVisible}
                  onDismiss={hideUpdateRevenueGroupDialog}>
                  <Dialog.Title>Update revenue group?</Dialog.Title>
                  <Dialog.Content>
                    <Paragraph>
                      {`You are about to update ${
                        revenueGroup?.name + ' '
                      }revenue group.`}
                    </Paragraph>
                  </Dialog.Content>
                  <Dialog.Actions style={{justifyContent: 'space-around'}}>
                    <Button onPress={hideUpdateRevenueGroupDialog}>
                      Cancel
                    </Button>
                    <Button
                      loading={isSubmitting}
                      disabled={isSubmitting}
                      icon={'check-outline'}
                      onPress={() => {
                        setIsUpdateConfirmed(() => true);
                        hideUpdateRevenueGroupDialog();
                        handleSubmit();
                      }}
                      color={colors.accent}>
                      Confirm
                    </Button>
                  </Dialog.Actions>
                </Dialog>
              </Portal>
              <TestModeLimitModal
                title="Limit Reached"
                textContent={limitReachedMessage}
                visible={limitReachedMessage ? true : false}
                onDismiss={() => {
                  setLimitReachedMessage(() => '');
                }}
              />
              <TextInput
                label="Name (e.g. Food)"
                onChangeText={handleChange('name')}
                onBlur={handleBlur('name')}
                value={values.name}
                error={errors.name && touched.name ? true : false}
                autoFocus={autoFocus}
              />
              {renderRevenueGroupsSelection({
                values,
                errors,
                touched,
                setFieldValue,
                setFieldTouched,
              })}
              <View style={{marginBottom: 25}}>
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
              </View>
            </>
          );
        }}
      </Formik>
    </>
  );
};

const styles = StyleSheet.create({});

export default RevenueGroupForm;
