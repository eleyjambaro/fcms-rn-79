import React, {useState} from 'react';
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
import {recipeKinds} from '../__dummyData';
import useRecipeFormContext from '../hooks/useRecipeFormContext';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import RecipeKindForm from '../components/forms/RecipeKindForm';
import ListLoadingFooter from '../components/stateIndicators/ListLoadingFooter';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {createRecipeKind, getRecipeKinds} from '../localDbQueries/recipeKinds';

const RecipeKind = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useRecipeFormContext();
  const {recipe_kind_id: defaultSelectedKindId} = route.params;
  const [createRecipeKindModalVisible, setCreateRecipeKindModalVisible] =
    useState(false);
  const [selectedKind, setSelectedKind] = useState(defaultSelectedKindId);
  const queryClient = useQueryClient();
  const createRecipeKindMutation = useMutation(createRecipeKind, {
    onSuccess: () => {
      queryClient.invalidateQueries('recipeKinds');
    },
  });
  const {status, data} = useQuery(['recipeKinds', {}], getRecipeKinds);

  const showCreateRecipeKindModal = () => setCreateRecipeKindModalVisible(true);
  const hideCreateRecipeKindModal = () =>
    setCreateRecipeKindModalVisible(false);

  const handleKindChange = selectedOption => {
    setSelectedKind(() => selectedOption);
  };

  const handleCancel = () => {
    hideCreateRecipeKindModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createRecipeKindMutation.mutateAsync({
        values,
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateRecipeKindModal();
    }
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

  const recipeKinds = data.result;

  return (
    <>
      <Portal>
        <Modal
          visible={createRecipeKindModalVisible}
          onDismiss={hideCreateRecipeKindModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Recipe Kind
          </Title>
          <RecipeKindForm onSubmit={handleSubmit} onCancel={handleCancel} />
        </Modal>
      </Portal>
      <View style={styles.container}>
        <Button
          mode="outlined"
          onPress={showCreateRecipeKindModal}
          style={{marginVertical: 20}}>
          Create Recipe Kind
        </Button>
        <Divider />
        <CheckboxSelection
          value={selectedKind}
          options={recipeKinds}
          optionLabelKey="name"
          optionValueKey="id"
          onChange={handleKindChange}
        />
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldValue('recipe_kind_id', selectedKind);
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

export default React.memo(RecipeKind);
