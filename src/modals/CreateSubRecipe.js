import React from 'react';
import {StyleSheet, ScrollView} from 'react-native';
import {useTheme} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';

import SubRecipeForm from '../components/forms/SubRecipeForm';

const CreateSubRecipe = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();

  const handleSubmit = (values, actions) => {
    console.log(values);
    actions.resetForm();
    navigation.goBack();
  };

  return (
    <ScrollView style={styles.container}>
      <SubRecipeForm
        onSubmit={handleSubmit}
        initialValues={
          route.params?.category_id && {
            category_id: route.params.category_id?.toString(),
          }
        }
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  surface: {
    padding: 8,
    height: 80,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

export default CreateSubRecipe;
