import React, {useState} from 'react';
import {StyleSheet, Text, View, ScrollView, Pressable} from 'react-native';
import {
  useTheme,
  Headline,
  Chip,
  Icon,
  Button,
  Divider,
  Subheading,
  Portal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {categories, items} from '../../__dummyData';
import routes from '../../constants/routes';
import {
  getItemAvgUnitCost,
  getItemCostPercentage,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemStockSummary = props => {
  const {
    item,
    containerStyle,
    showActions = true,
    onPressItemOptions,
    showStockDetails = true,
    showItemOptionsButton = true,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {status: itemCostPercentageStatus, data: itemCostPercentageData} =
    useQuery(['itemCostPercentage', {itemId: item.id}], getItemCostPercentage);
  const [showDetails, setShowDetails] = useState(showStockDetails);

  const [infoDialogVisible, setInfoDialogVisible] = useState(false);

  const showInfoDialog = () => setInfoDialogVisible(true);
  const hideInfoDialog = () => setInfoDialogVisible(false);

  const renderCostPerPackage = () => {
    if (item.uom_abbrev_per_piece && item.qty_per_piece) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 20,
          }}>
          <Text
            style={{
              fontSize: 14,
              color: colors.dark,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
            numberOfLines={1}>
            {`${currencySymbol} ${commaNumber(
              (item?.avg_unit_cost_net || 0).toFixed(2),
            )}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,
              color: colors.dark,
              fontWeight: '500',
              fontStyle: 'italic',
            }}>
            {`per ${commaNumber(
              item.qty_per_piece?.toFixed(2),
            )} ${formatUOMAbbrev(item.uom_abbrev_per_piece)}`}
          </Text>
        </View>
      );
    }
  };

  const renderQtyPerPackage = () => {
    if (item.uom_abbrev_per_piece && item.qty_per_piece) {
      const qtyPerPackage = item.qty_per_piece * item.current_stock_qty;

      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginLeft: 20,
          }}>
          <Text
            style={{
              fontSize: 14,
              color: colors.dark,
              fontWeight: '500',
              fontStyle: 'italic',
            }}
            numberOfLines={1}>
            {`${commaNumber((qtyPerPackage || 0).toFixed(2))}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,
              color: colors.dark,
              fontWeight: '500',
              fontStyle: 'italic',
            }}>
            {`${formatUOMAbbrev(item.uom_abbrev_per_piece)}`}
          </Text>
        </View>
      );
    }
  };

  const renderCostPercentageValue = () => {
    if (
      itemCostPercentageData.isCategoryHasRevenueGroup === false ||
      (itemCostPercentageData.isCategoryHasRevenueGroup === true &&
        !itemCostPercentageData?.hasCurrentMonthRevenueGroupAmount)
    ) {
      return (
        <MaterialCommunityIcons
          onPress={showInfoDialog}
          name="information"
          size={18}
          color={colors.primary}
          style={{paddingLeft: 7, paddingRight: 30}}
        />
      );
    }

    return (
      <>
        <Text
          style={{
            marginLeft: 7,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {`${commaNumber(
            parseFloat(itemCostPercentageData.result || 0).toFixed(2),
          )}`}
        </Text>
        <Text
          style={{
            marginLeft: 5,

            color: colors.dark,
          }}>
          {`%`}
        </Text>
      </>
    );
  };

  const renderFinishedProductBadge = () => {
    if (item?.is_finished_product) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            borderRadius: 5,
            backgroundColor: colors.neutralTint2,
            paddingVertical: 10,
            paddingHorizontal: 10,
            paddingRight: 14,
            marginRight: 10,
          }}>
          <MaterialCommunityIcons
            name="package-variant-closed"
            size={15}
            color={colors.surface}
          />
          <Text
            style={{
              fontWeight: 'bold',
              color: colors.surface,
              fontSize: 12,
              marginLeft: 7,
            }}>
            Finished Product
          </Text>
        </View>
      );
    }
  };

  const renderAddNewYieldButton = () => {
    if (item?.is_finished_product) {
      return (
        <View
          style={[
            styles.actionsContainer,
            {flexDirection: 'row', marginBottom: 10},
          ]}>
          <Button
            style={{flex: 1}}
            mode="contained"
            icon="plus"
            onPress={() => {
              // use this instead of finished_product_origin_id (as of v1.1.111)
              if (item?.recipe_id) {
                navigation.navigate(routes.recipeView(), {
                  recipe_id: item.recipe_id,
                  finished_product_id: item.id,
                });
              } else if (item?.finished_product_origin_id) {
                /**
                 * Backward compatibility for version lower than 1.1.111.
                 * Soon to be deprecated in favor of recipe_id
                 */
                navigation.navigate(routes.recipeView(), {
                  recipe_id: item.finished_product_origin_id,
                  finished_product_id: item.id,
                });
              }
            }}>
            Add New Yield
          </Button>
        </View>
      );
    }
  };

  if (!item) return null;

  if (itemCostPercentageStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (itemCostPercentageStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const revenueGroupNameText = (
    <Paragraph style={{fontWeight: 'bold'}}>{`${
      itemCostPercentageData?.revenueGroup?.name
        ? itemCostPercentageData?.revenueGroup?.name + ' '
        : ''
    }`}</Paragraph>
  );

  const categoryNameText = (
    <Paragraph style={{fontWeight: 'bold'}}>{`${
      item.category_name + ' '
    }`}</Paragraph>
  );

  let itemCostPercentageInfoText = null;
  let itemCostPercentageActionButtonText = '';

  if (itemCostPercentageData.isCategoryHasRevenueGroup === false) {
    itemCostPercentageInfoText = (
      <>
        {`Create new or select an existing revenue group, and then add`}{' '}
        {categoryNameText}
        {`category to calculate cost percentage.`}
      </>
    );

    itemCostPercentageActionButtonText = `Manage Revenue Groups`;
  } else if (!itemCostPercentageData?.hasCurrentMonthRevenueGroupAmount) {
    itemCostPercentageInfoText = (
      <>
        {`Update`} {revenueGroupNameText}
        {`revenue value of the current month to calculate cost percentage.`}
      </>
    );

    itemCostPercentageActionButtonText = `Update ${
      itemCostPercentageData?.revenueGroup?.name
        ? itemCostPercentageData?.revenueGroup?.name + ' '
        : ''
    }revenue`;
  }

  return (
    <>
      <Portal>
        <Dialog visible={infoDialogVisible} onDismiss={hideInfoDialog}>
          <Dialog.Title>Item Cost Percentage</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{itemCostPercentageInfoText}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                if (
                  itemCostPercentageData.isCategoryHasRevenueGroup === false
                ) {
                  navigation.navigate(routes.manageRevenueGroups());
                } else if (
                  !itemCostPercentageData?.hasCurrentMonthRevenueGroupAmount
                ) {
                  navigation.navigate(routes.revenuesAndExpenses(), {
                    revenue_group_highlighted_item_id:
                      itemCostPercentageData.revenueGroup.id,
                  });
                }

                hideInfoDialog();
              }}
              color={colors.primary}>
              {itemCostPercentageActionButtonText}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
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
            marginBottom: item.category_name ? 10 : 0,
          }}>
          <Headline numberOfLines={3} style={{flex: 1, marginRight: 10}}>
            {item.name}
          </Headline>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              height: '100%',
            }}>
            {showItemOptionsButton && (
              <Pressable style={{marginLeft: 5}} onPress={onPressItemOptions}>
                <MaterialIcons
                  name="more-horiz"
                  size={25}
                  color={colors.dark}
                />
              </Pressable>
            )}
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            {renderFinishedProductBadge()}
            {item.category_name && (
              <View>
                <Chip
                  style={{marginRight: 'auto'}}
                  icon="clipboard-list-outline"
                  onPress={() => {
                    navigation.navigate(routes.categoryView(), {
                      category_id: item.category_id,
                    });
                  }}>
                  {item.category_name}
                </Chip>
              </View>
            )}
            {itemCostPercentageData.isCategoryHasRevenueGroup === true &&
              itemCostPercentageData.revenueGroup && (
                <View style={{marginLeft: 10}}>
                  <Chip
                    style={{marginRight: 'auto'}}
                    icon="cash-multiple"
                    onPress={() => {
                      navigation.navigate(routes.revenuesAndExpenses(), {
                        revenue_group_highlighted_item_id:
                          itemCostPercentageData.revenueGroup.id,
                      });
                    }}>
                    {itemCostPercentageData.revenueGroup.name}
                  </Chip>
                </View>
              )}
          </View>
        </ScrollView>

        <Divider style={{marginTop: 15, marginBottom: 15}} />

        {showDetails && (
          <View style={[styles.detailsContainer, {marginTop: 0}]}>
            <Pressable
              style={{position: 'absolute', top: -15, right: 0}}
              onPress={() => {
                navigation.navigate(routes.itemReportView(), {
                  item_id: item.id,
                });
              }}>
              <Text
                style={{
                  fontSize: 14,
                  fontWeight: 'bold',
                  marginVertical: 20,
                  marginLeft: 20,
                  marginRight: 5,
                  color: colors.primary,
                }}>
                {'View Report'}
              </Text>
            </Pressable>

            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 5,
              }}>
              <MaterialCommunityIcons
                name="chart-box-outline"
                size={25}
                color={colors.dark}
              />
              <Subheading style={{marginLeft: 8, fontWeight: 'bold'}}>
                Report Summary
              </Subheading>
            </View>
            {/* <View style={[styles.detailsListItem]}>
              <Text
                style={{
                  fontWeight: 'bold',
                }}>{`Last Unit Cost (With Tax):`}</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${currencySymbol} ${commaNumber(
                  parseFloat(item.unit_cost || 0).toFixed(2),
                )}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`/ ${formatUOMAbbrev(item.uom_abbrev)}`}
              </Text>
            </View> */}
            <View style={styles.detailsListItem}>
              <View>
                <Text style={{fontWeight: 'bold', marginBottom: 5}}>
                  Average Unit Cost:
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
                      color: colors.dark,
                      fontSize: 16,
                    }}>
                    {`${currencySymbol} ${commaNumber(
                      parseFloat(item?.avg_unit_cost_net || 0).toFixed(2),
                    )}`}
                  </Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: colors.dark,
                      fontSize: 16,
                    }}>
                    {`/ ${formatUOMAbbrev(item.uom_abbrev)}`}
                  </Text>
                </View>

                {renderCostPerPackage()}
              </View>
            </View>
            <View style={styles.detailsListItem}>
              <Text style={{fontWeight: 'bold'}}>
                Cost Percentage (COGS %):
              </Text>
              {renderCostPercentageValue()}
            </View>

            {/* <Divider style={{marginVertical: 8}} /> */}
            {/* <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginTop: 8,
                marginBottom: 5,
              }}>
              <MaterialCommunityIcons
                name="clipboard-list-outline"
                size={25}
                color={colors.dark}
              />
              <Subheading style={{marginLeft: 5}}>Inventory</Subheading>
            </View> */}
            <View style={styles.detailsListItem}>
              <View>
                <Text style={{fontWeight: 'bold'}}>
                  Current Stock Quantity:
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
                      color: colors.dark,
                      fontSize: 16,
                    }}>
                    {`${commaNumber(
                      parseFloat(item.current_stock_qty || 0).toFixed(2),
                    )}`}
                  </Text>
                  <Text
                    style={{
                      marginLeft: 5,
                      color: colors.dark,
                      fontWeight: 'bold',
                    }}>
                    {`${formatUOMAbbrev(item.uom_abbrev)}`}
                  </Text>
                </View>

                {renderQtyPerPackage()}
              </View>
            </View>
            {/* <View style={styles.detailsListItem}>
            <Text style={{fontWeight: 'bold'}}>Beginning Inventory:</Text>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
              }}>
              {`${commaNumber(item.initial_stock_qty)}`}
            </Text>
            <Text
              style={{
                marginLeft: 5,
                color: colors.dark,
              }}>
              {`${item.uom_abbrev === 'ea' ? 'pc' : item.uom_abbrev}`}
            </Text>
          </View> */}
          </View>
        )}

        {renderAddNewYieldButton()}
        <View style={[styles.actionsContainer, {flexDirection: 'row'}]}>
          {showActions && showDetails && (
            <Button
              style={{flex: 1}}
              mode={item?.is_finished_product ? 'outlined' : 'contained'}
              onPress={() => {
                navigation.navigate(routes.manageStock(), {item_id: item.id});
              }}>
              Manage Stock
            </Button>
          )}
          <Pressable
            style={{
              justifyContent: 'center',
              alignItems: 'center',
              backgroundColor: colors.neutralTint4,
              borderRadius: 25,
              width: 36,
              padding: 5,
              marginLeft: showActions && showDetails ? 10 : 'auto',
            }}
            onPress={() => setShowDetails(() => !showDetails)}>
            <MaterialCommunityIcons
              name={showDetails ? 'chevron-up' : 'chevron-down'}
              size={25}
              color={colors.dark}
            />
          </Pressable>
        </View>
      </View>
    </>
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
    marginTop: 10,
    marginBottom: 10,
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

export default ItemStockSummary;
