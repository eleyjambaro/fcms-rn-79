import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Checkbox,
  Divider,
  Button,
  Modal,
  Portal,
  TextInput,
  Title,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQueryClient, useMutation, useQuery} from '@tanstack/react-query';

import routes from '../constants/routes';
import useItemFormContext from '../hooks/useItemFormContext';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import ManageListButton from '../components//buttons/ManageListButton';
import CategoryForm from '../components/forms/CategoryForm';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {createCategory, getCategories} from '../localDbQueries/categories';
import useAppConfigContext from '../hooks/useAppConfigContext';
import {ScrollView} from 'react-native-gesture-handler';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';

const ItemCategory = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useItemFormContext();
  const {category_id: defaultSelectedCategoryId} = route.params;
  const [createCategoryModalVisible, setCreateCategoryModalVisible] =
    useState(false);
  const [selectedCategory, setSelectedCategory] = useState(
    defaultSelectedCategoryId,
  );
  const queryClient = useQueryClient();
  const createCategoryMutation = useMutation(createCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
  const {status, data} = useQuery(['categories', {limit: 100}], getCategories);
  const {config} = useAppConfigContext();
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  useEffect(() => {
    return () => {
      formikActions.setFieldTouched('category_id');

      !selectedCategory
        ? formikActions.setFieldError('category_id', 'Required')
        : formikActions.setFieldError('category_id', '');
    };
  }, []);

  const showCreateCategoryModal = () => setCreateCategoryModalVisible(true);
  const hideCreateCategoryModal = () => setCreateCategoryModalVisible(false);

  const handleCategoryChange = selectedOption => {
    setSelectedCategory(() => selectedOption);
  };

  const handleCancel = () => {
    hideCreateCategoryModal();
  };

  const handleSubmit = async (values, actions) => {
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

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const categories = data.result;

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
          <CategoryForm onSubmit={handleSubmit} onCancel={handleCancel} />
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
      <View style={styles.container}>
        <Button
          mode="outlined"
          icon="plus"
          onPress={showCreateCategoryModal}
          style={{marginVertical: 20}}>
          Create Category
        </Button>
        <Divider />
        <ScrollView>
          <CheckboxSelection
            value={selectedCategory}
            options={categories}
            optionLabelKey="name"
            optionValueKey="id"
            onChange={handleCategoryChange}
          />
        </ScrollView>
        {categories?.length > 0 && (
          <ManageListButton
            containerStyle={{paddingBottom: 10}}
            label="Manage categories"
            onPress={() => navigation.navigate(routes.manageCategories())}
          />
        )}
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldValue('category_id', selectedCategory);
            navigation.goBack();
          }}
          style={{marginVertical: 20}}>
          Done
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 7,
    backgroundColor: 'white',
  },
});

export default React.memo(ItemCategory);
