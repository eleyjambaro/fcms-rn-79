import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme, Headline, Chip, Button} from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';

import {ingredients} from '../../__dummyData';
import {getRecipeTotalCost} from '../../localDbQueries/recipes';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import routes from '../../constants/routes';

const RecipeSummary = props => {
  const {recipe, containerStyle, onPressItemOptions} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const {status: recipeTotalCostStatus, data: recipeTotalCostData} = useQuery(
    ['recipeTotalCost', {recipeId: recipe.id}],
    getRecipeTotalCost,
  );
  const numOfServing = recipe.yield;
  const menuPrice = recipe.selling_price_with_vat;
  const VAT = 1.12;
  const sellingPriceWithoutVAT = menuPrice / VAT;

  const totalCostNet = recipeTotalCostData?.totalCostNet;
  const totalCostNetPerServing = totalCostNet / recipe.yield;
  const totalCost = recipeTotalCostData?.totalCost;
  const totalCostPerServing = totalCost / recipe.yield;

  const recipeCostPercentage = (totalCostNet / sellingPriceWithoutVAT) * 100;

  const renderRecipeDetails = () => {
    if (recipeTotalCostStatus === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (recipeTotalCostStatus === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    return (
      <View style={styles.detailsContainer}>
        <View style={styles.detailsListItem}>
          <Text style={{fontWeight: 'bold'}}>Recipe Yield:</Text>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${numOfServing} serving${numOfServing > 1 ? 's' : ''}`}
          </Text>
        </View>
        <View style={styles.detailsListItem}>
          <View>
            <Text style={{fontWeight: 'bold', marginBottom: 5}}>
              Cost Per Yield
            </Text>
            <View
              style={{
                flexDirection: 'row',
                marginLeft: 10,
                alignItems: 'center',
              }}>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                }}>
                Gross:
              </Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                  fontSize: 16,
                }}>
                {`${currencySymbol} ${commaNumber(
                  totalCostPerServing.toFixed(2),
                )}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`/ Serving`}
              </Text>
            </View>

            <View
              style={{
                flexDirection: 'row',
                marginLeft: 10,
                alignItems: 'center',
              }}>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                }}>
                Net:
              </Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                  fontSize: 16,
                }}>
                {`${currencySymbol} ${commaNumber(
                  totalCostNetPerServing.toFixed(2),
                )}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`/ Serving`}
              </Text>
            </View>
          </View>
        </View>

        {/* <View style={styles.detailsListItem}>
          <Text style={{fontWeight: 'bold'}}>Recipe Cost Percentage:</Text>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${commaNumber(recipeCostPercentage.toFixed(2))}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,
              color: colors.dark,
            }}>
            {`%`}
          </Text>
        </View> */}
        {/* <View style={styles.detailsListItem}>
          <Text
            style={{fontWeight: 'bold'}}>{`Selling Price (without VAT):`}</Text>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${sellingPriceWithoutVAT.toFixed(2)}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,

              color: colors.dark,
            }}>
            {`/ Serving`}
          </Text>
        </View> */}
        {/* <View style={styles.detailsListItem}>
          <Text
            style={{fontWeight: 'bold'}}>{`Selling Price (Menu Price):`}</Text>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}>
            {`${currencySymbol} ${commaNumber(menuPrice.toFixed(2))}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,

              color: colors.dark,
            }}>
            {`/ Serving`}
          </Text>
        </View> */}
      </View>
    );
  };

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface},
        containerStyle,
      ]}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
        }}>
        <Headline numberOfLines={3} style={{flex: 1, marginRight: 10}}>
          {recipe.name}
        </Headline>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            height: '100%',
          }}>
          <Pressable style={{marginLeft: 5}} onPress={onPressItemOptions}>
            <MaterialIcons name="more-horiz" size={25} color={colors.dark} />
          </Pressable>
        </View>
      </View>

      {renderRecipeDetails()}

      <View style={[styles.actionsContainer, {flexDirection: 'row'}]}>
        <Button
          style={{flex: 1}}
          mode="contained"
          onPress={() => {
            navigation.navigate(routes.produceFinishedProductStock(), {
              recipe_id: recipe.id,
            });
          }}>
          Yield Now
        </Button>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 5,
    marginBottom: 9,
    borderRadius: 5,
    padding: 15,
  },
  detailsContainer: {
    marginVertical: 10,
  },
  detailsListItem: {
    marginLeft: 0,
    marginVertical: 3,
    marginBottom: 5,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    padding: 10,
    borderRadius: 15,
  },
  actionsContainer: {},
});

export default RecipeSummary;
