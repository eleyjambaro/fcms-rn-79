import React, {useState, useEffect} from 'react';
import {View} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import CategoryList from '../components/categories/CategoryList';
import CategoryForm from '../components/forms/CategoryForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {createCategory} from '../localDbQueries/categories';
import useAppConfigContext from '../hooks/useAppConfigContext';
import useSearchbarContext from '../hooks/useSearchbarContext';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';

function Categories(props) {
  const {navigation, viewMode} = props;
  const [createCategoryModalVisible, setCreateCategoryModalVisible] =
    useState(false);
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const createCategoryMutation = useMutation(createCategory, {
    onSuccess: () => {
      queryClient.invalidateQueries('categories');
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
  const {config} = useAppConfigContext();
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const showCreateCategoryModal = () => setCreateCategoryModalVisible(true);
  const hideCreateCategoryModal = () => setCreateCategoryModalVisible(false);

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

  return (
    <>
      <Portal>
        <Modal
          visible={createCategoryModalVisible}
          onDismiss={() => setCreateCategoryModalVisible(() => false)}
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
      <View style={{flex: 1}}>
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search category"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <CategoryList
            viewMode={viewMode}
            filter={{'%LIKE': {key: 'name', value: `'%${keyword}%'`}}}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            icon="plus"
            onPress={showCreateCategoryModal}>
            Create Category
          </Button>
        </View>
      </View>
    </>
  );
}

export default Categories;
