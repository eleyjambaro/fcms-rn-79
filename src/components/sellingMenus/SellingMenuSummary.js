import React from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {useTheme, Headline, Chip, Button} from 'react-native-paper';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';
import {useNavigation} from '@react-navigation/native';

import {getSellingMenuTotalSellingPrice} from '../../localDbQueries/sellingMenus';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import routes from '../../constants/routes';

const SellingMenuSummary = props => {
  const {sellingMenu, containerStyle, onPressItemOptions} = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const currencySymbol = useCurrencySymbol();
  const {status: recipeTotalCostStatus, data: recipeTotalCostData} = useQuery(
    ['sellingMenuTotalSellingPrice', {sellingMenuId: sellingMenu.id}],
    getSellingMenuTotalSellingPrice,
  );
  const numOfServing = sellingMenu.yield;
  const menuPrice = sellingMenu.selling_price_with_vat;
  const VAT = 1.12;
  const sellingPriceWithoutVAT = menuPrice / VAT;

  const totalCostNet = recipeTotalCostData?.totalCostNet;
  const totalCostNetPerServing = totalCostNet / sellingMenu.yield;
  const totalCost = recipeTotalCostData?.totalCost;
  const totalCostPerServing = totalCost / sellingMenu.yield;

  const renderSellingMenuDetails = () => {
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

    /**
     * TODO: Display selling menu details
     */
    return null;
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
          {sellingMenu.name}
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

      {renderSellingMenuDetails()}

      {/* <View style={[styles.actionsContainer, {flexDirection: 'row'}]}>
        <Button
          style={{flex: 1}}
          mode="contained"
          onPress={() => {
            navigation.navigate(routes.produceFinishedProductStock(), {
              recipe_id: sellingMenu.id,
            });
          }}>
          Yield Now
        </Button>
      </View> */}
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

export default SellingMenuSummary;
