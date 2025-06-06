import React from 'react';
import {View, Pressable} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {Formik} from 'formik';
import * as Yup from 'yup';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {
  useInfiniteQuery,
  useQuery,
  useQueryClient,
  useMutation,
} from '@tanstack/react-query';

import routes from '../../constants/routes';
import {recipeKinds} from '../../__dummyData';
import MoreSelectionButton from '../buttons/MoreSelectionButton';
import {categories, units} from '../../__dummyData';
import useRecipeFormContext from '../../hooks/useRecipeFormContext';
import useItemFormContext from '../../hooks/useItemFormContext';
import useAddedIngredientsContext from '../../hooks/useAddedIngredientsContext';
import IngredientList from '../recipes/IngredientList';
import AddedIngredientList from '../recipes/AddedIngredientList';

const RecipeValidationSchema = Yup.object().shape({
  name: Yup.string()
    .min(2, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
  yield: Yup.string().required('Required'),
  uom_abbrev: Yup.string().required('Required'),
  unit_cost: Yup.string()
    .min(1, 'Too Short!')
    .max(50, 'Too Long!')
    .required('Required'),
});

const SubRecipeForm = props => {
  const {
    item,
    initialValues = {
      kind: 'food',
      group_name: '',
      name: '',
      yield: '',
      /** Inventory */
      category_id: '',
      barcode: '',
      uom_abbrev: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions: setRecipeFormFormikActions} = useRecipeFormContext();
  const {setFormikActions: setItemFormFormikActions} = useItemFormContext();
  const {addedIngredients} = useAddedIngredientsContext();

  const handlePressQuantityInput = () => {
    navigation.navigate('ManageStock', {item});
  };

  const renderQuantityInput = props => {
    const label = 'Stock Quantity';

    if (editMode) {
      return (
        <Pressable onPress={handlePressQuantityInput}>
          <TextInput
            label={label}
            editable={false}
            value={props.values.quantity}
          />
        </Pressable>
      );
    }

    return (
      <TextInput
        label={label}
        onChangeText={props.handleChange('quantity')}
        onBlur={props.handleBlur('quantity')}
        value={props.values.quantity}
        keyboardType="numeric"
      />
    );
  };

  const renderRecipeKindValue = (kindValue, props) => {
    if (!kindValue) return null;

    return (
      <Subheading {...props}>
        {props?.trimTextLength(
          recipeKinds.filter(kind => kind.value === kindValue)[0].label,
        )}
      </Subheading>
    );
  };

  const renderCategoryValue = categoryId => {
    if (!categoryId) return null;

    return (
      <Subheading style={{color: colors.primary, marginRight: 5}}>
        {
          categories.filter(category => category.id === parseInt(categoryId))[0]
            .name
        }
      </Subheading>
    );
  };

  const renderUOMValue = (uomId, props) => {
    if (!uomId) return null;

    return (
      <Subheading {...props}>
        {props?.trimTextLength(
          'Per ' + units.filter(unit => unit.id === parseInt(uomId))[0].name,
        )}
      </Subheading>
    );
  };

  return (
    <Formik
      initialValues={{
        kind: initialValues.kind || 'Food',
        groupName: initialValues.groupName || '',
        name: initialValues.name || '',
        yield: initialValues.yield?.toString() || '1',
      }}
      onSubmit={onSubmit}>
      {props => {
        const {handleChange, handleBlur, handleSubmit, setFieldValue, values} =
          props;

        return (
          <>
            <Text
              style={{
                marginTop: 15,
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Sub Recipe Details'}
            </Text>
            <MoreSelectionButton
              label="Kind"
              renderValue={(_value, renderingValueProps) =>
                renderRecipeKindValue(values.kind, renderingValueProps)
              }
              onPress={() => {
                setRecipeFormFormikActions(() => ({setFieldValue}));

                navigation.navigate(routes.recipeKind(), {
                  kind: values.kind,
                });
              }}
            />
            <TextInput
              label="Group Name (Optional, e.g. Dessert)"
              onChangeText={handleChange('groupName')}
              onBlur={handleBlur('groupName')}
              value={values.groupName}
            />
            <TextInput
              label="Recipe Name"
              onChangeText={handleChange('name')}
              onBlur={handleBlur('name')}
              value={values.name}
            />
            <TextInput
              label="Recipe Yield"
              onChangeText={handleChange('yield')}
              onBlur={handleBlur('yield')}
              value={values.yield}
            />

            <Text
              style={{
                marginTop: 25,
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Cost & Inventory'}
            </Text>
            {/* <MoreSelectionButton
              label="Category"
              renderValue={() => renderCategoryValue(values.category_id)}
              onPress={() => {
                setItemFormFormikActions(() => ({setFieldValue}));

                navigation.navigate('ItemCategory', {
                  category_id: values.category_id,
                });
              }}
            /> */}
            <MoreSelectionButton
              label="Unit of Measurement"
              renderValue={(_value, renderingValueProps) =>
                renderUOMValue(values.uom_id, renderingValueProps)
              }
              onPress={() => {
                setItemFormFormikActions(() => ({setFieldValue}));

                navigation.navigate('ItemUOM', {
                  uom_id: values.uom_id,
                });
              }}
              containerStyle={{marginTop: -1}}
            />
            {/* <TextInput
              label="Unit cost (Per Yield)"
              onChangeText={handleChange('unit_cost')}
              onBlur={handleBlur('unit_cost')}
              value={values.unit_cost}
              keyboardType="numeric"
            /> */}
            {renderQuantityInput(props)}
            <TextInput
              label="Low Stock Level"
              onChangeText={handleChange('low_stock_level')}
              onBlur={handleBlur('low_stock_level')}
              value={values.low_stock_level}
              keyboardType="numeric"
            />

            <Text
              style={{
                marginTop: 25,
                marginBottom: 15,
                fontSize: 16,
                fontWeight: 'bold',
              }}>
              {'Ingredients'}
            </Text>

            <AddedIngredientList ingredients={addedIngredients} />

            <View style={{marginTop: 15, marginBottom: 10}}>
              <Button
                mode="outlined"
                icon="plus"
                onPress={() => {
                  navigation.navigate(routes.selectRecipeIngredient());
                }}
                style={{marginVertical: 5}}>
                Add Ingredient
              </Button>
              <Button
                mode="contained"
                onPress={handleSubmit}
                style={{marginVertical: 5}}>
                Save
              </Button>
            </View>
          </>
        );
      }}
    </Formik>
  );
};

export default SubRecipeForm;
