import React, {useState, useEffect, useRef} from 'react';
import {View, Pressable} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  ActivityIndicator,
  HelperText,
} from 'react-native-paper';
import commaNumber from 'comma-number';
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
import useRecipeFormContext from '../../hooks/useRecipeFormContext';
import useAddedIngredientsContext from '../../hooks/useAddedIngredientsContext';
import IngredientList from '../recipes/IngredientList';
import AddedIngredientList from '../recipes/AddedIngredientList';
import {
  isRecipeHasIngredient,
  updateRecipe,
  getRecipeTotalCost,
} from '../../localDbQueries/recipes';
import {getRecipeKind} from '../../localDbQueries/recipeKinds';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {
  computeMarkupAmount,
  computeMarkupPercentage,
  computeSrpFromAmount,
} from '../../utils/markupHelpers';

const RecipeValidationSchema = Yup.object().shape({
  name: Yup.string().required('Required'),
  yield: Yup.string().required('Required'),
});

const RecipeForm = props => {
  const {
    item,
    isUnsavedRecipe,
    recipeId,
    initialValues = {
      recipe_kind_id: '',
      group_name: '',
      name: '',
      yield: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const {setFormikActions} = useRecipeFormContext();
  const {addedIngredients} = useAddedIngredientsContext();
  const [recipeKindId, setRecipeKindId] = useState(null);
  const {data: recipeTotalCostData} = useQuery(
    ['recipeTotalCost', {recipeId}],
    getRecipeTotalCost,
    {enabled: !!recipeId},
  );
  const {status, data} = useQuery(
    ['recipeKind', {id: recipeKindId}],
    getRecipeKind,
    {
      enabled: recipeKindId ? true : false,
    },
  );
  const {status: isRecipeHasIngredientStatus, data: isRecipeHasIngredientData} =
    useQuery(['isRecipeHasIngredient', {recipeId}], isRecipeHasIngredient);
  const updateUnsavedRecipeMutation = useMutation(updateRecipe, {
    onSuccess: () => {
      // Do something on success
    },
  });

  const formRef = useRef(null);

  /**
   * TODO: Update unsaved recipe
   */
  useEffect(() => {
    return () => {
      const updateUnsavedRecipe = async () => {
        // TODO: access Formik's values here to update unsaved recipe with changes
        // try {
        //   await updateUnsavedRecipeMutation.mutateAsync({
        //     values
        //   });
        // } catch (error) {
        //   console.debug(error);
        // } finally {
        //   actions.resetForm();
        // }
      };
      if (isUnsavedRecipe) {
        // TODO: access Formik's dirty here to avoid saving unsaved recipe without any changes
        // updateUnsavedRecipe()
      }
    };
  }, [formRef, formRef?.current, isUnsavedRecipe]);

  const handleRecipeKindChange = recipeKindId => {
    setRecipeKindId(() => recipeKindId);
  };

  const renderRecipeKindValue = (status, data) => {
    if (!recipeKindId) return null;

    if (status === 'loading') {
      return (
        <ActivityIndicator
          animating={true}
          color={colors.primary}
          style={{marginRight: 5}}
          size="small"
        />
      );
    }

    if (status === 'error') {
      return (
        <Subheading style={{color: colors.primary, marginRight: 5}}>
          Something went wrong
        </Subheading>
      );
    }

    if (!data || !data.result) return null;

    return (
      <Subheading style={{color: colors.primary, marginRight: 5}}>
        {data.result?.name}
      </Subheading>
    );
  };

  const renderUOMValue = uomId => {
    if (!uomId) return null;

    return (
      <Subheading style={{color: colors.primary, marginRight: 5}}>
        {'Per ' + units.filter(unit => unit.id === uomId)[0].name}
      </Subheading>
    );
  };

  return (
    <Formik
      initialValues={{
        recipe_kind_id: initialValues.recipe_kind_id || '',
        group_name: initialValues.group_name || '',
        name: initialValues.name || '',
        yield: initialValues.yield?.toString() || '1',
        markup_percentage: initialValues.markup_percentage?.toString() || '0',
        markup_amount: initialValues.markup_amount?.toString() || '0',
      }}
      onSubmit={onSubmit}
      validationSchema={RecipeValidationSchema}
      innerRef={formRef}>
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
          setFieldValue,
        } = props;

        return (
          <View style={{flex: 1, backgroundColor: colors.surface}}>
            <View>
              <Text
                style={{
                  marginTop: 15,
                  marginBottom: 15,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}>
                {'Recipe Details'}
              </Text>
              {/* <MoreSelectionButton
                placeholder="Select Recipe Kind"
                label="Kind"
                renderValueCurrentValue={values.recipe_kind_id}
                renderValue={() => renderRecipeKindValue(status, data)}
                onChangeValue={currentValue => {
                  handleRecipeKindChange(currentValue);
                  handleChange('recipe_kind_id')(currentValue);
                }}
                onPress={() => {
                  setFormikActions(() => ({setFieldValue}));

                  navigation.navigate(routes.recipeKind(), {
                    recipe_kind_id: values.recipe_kind_id,
                  });
                }}
              />
              <TextInput
                label="Group Name (Optional, e.g. Dessert)"
                onChangeText={handleChange('group_name')}
                onBlur={handleBlur('group_name')}
                value={values.group_name}
                error={errors.group_name && touched.group_name ? true : false}
              /> */}
              <TextInput
                label="Recipe Name"
                onChangeText={handleChange('name')}
                onBlur={handleBlur('name')}
                value={values.name}
                error={errors.name && touched.name ? true : false}
              />
              <TextInput
                label="Recipe Yield"
                onChangeText={handleChange('yield')}
                onBlur={handleBlur('yield')}
                value={values.yield}
                error={errors.yield && touched.yield ? true : false}
                keyboardType="numeric"
              />

              {(() => {
                const totalCostNet = parseFloat(
                  recipeTotalCostData?.totalCostNet || 0,
                );
                const yieldQty = parseFloat(values.yield || 1) || 1;
                const netCostPerServing = totalCostNet / yieldQty;
                const srp = computeSrpFromAmount(
                  netCostPerServing,
                  values.markup_amount,
                );

                return (
                  <View style={{marginTop: 5}}>
                    <Text
                      style={{
                        marginTop: 15,
                        marginBottom: 5,
                        fontSize: 16,
                        fontWeight: 'bold',
                      }}>
                      {'Markup / Suggested Retail Price'}
                    </Text>
                    <HelperText type="info">
                      {`Net Cost / Serving: ${currencySymbol} ${commaNumber(
                        netCostPerServing.toFixed(2),
                      )} (SRP = net cost + markup, no VAT)`}
                    </HelperText>
                    <View style={{flexDirection: 'row'}}>
                      <TextInput
                        style={{flex: 1}}
                        label="Markup %"
                        value={values.markup_percentage}
                        keyboardType="numeric"
                        right={<TextInput.Affix text="%" />}
                        onChangeText={value => {
                          setFieldValue('markup_percentage', value);
                          setFieldValue(
                            'markup_amount',
                            computeMarkupAmount(
                              netCostPerServing,
                              value,
                            ).toFixed(2),
                          );
                        }}
                      />
                      <TextInput
                        style={{flex: 1, marginLeft: 10}}
                        label="Markup Amount"
                        value={values.markup_amount}
                        keyboardType="numeric"
                        left={<TextInput.Affix text={currencySymbol} />}
                        onChangeText={value => {
                          setFieldValue('markup_amount', value);
                          setFieldValue(
                            'markup_percentage',
                            computeMarkupPercentage(
                              netCostPerServing,
                              value,
                            ).toFixed(2),
                          );
                        }}
                      />
                    </View>
                    <HelperText type="info" style={{fontWeight: 'bold'}}>
                      {`SRP / Serving: ${currencySymbol} ${commaNumber(
                        srp.toFixed(2),
                      )}`}
                    </HelperText>
                  </View>
                );
              })()}
            </View>

            <View style={{flex: 1}}>
              {!editMode && (
                <>
                  <Text
                    style={{
                      marginTop: 25,
                      marginBottom: 15,
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}>
                    {'Ingredients'}
                  </Text>

                  <AddedIngredientList recipeId={recipeId} />
                </>
              )}

              <View style={{marginTop: 15, marginBottom: 10}}>
                {!editMode && (
                  <Button
                    mode="outlined"
                    icon="plus"
                    onPress={() => {
                      navigation.navigate(routes.selectRecipeIngredient(), {
                        recipe_id: recipeId,
                      });
                    }}
                    style={{marginVertical: 5}}>
                    Add Ingredient
                  </Button>
                )}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  disabled={
                    isRecipeHasIngredientStatus === 'loading' ||
                    !isRecipeHasIngredientData ||
                    (editMode && !dirty) ||
                    !isValid ||
                    isSubmitting
                  }
                  loading={
                    isRecipeHasIngredientStatus === 'loading' || isSubmitting
                  }
                  style={{marginVertical: 5}}>
                  Save
                </Button>
              </View>
            </View>
          </View>
        );
      }}
    </Formik>
  );
};

export default RecipeForm;
