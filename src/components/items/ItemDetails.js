import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  useTheme,
  Headline,
  Chip,
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
import {getVendor} from '../../localDbQueries/vendors';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const ItemDetails = props => {
  const {
    item,
    containerStyle,
    showActions = true,
    onPressItemOptions,
    showStockDetails = true,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const {status: itemAvgUnitCostStatus, data: itemAvgUnitCostData} = useQuery(
    ['itemAvgUnitCost', {id: item.id}],
    getItemAvgUnitCost,
  );
  const {status: itemCostPercentageStatus, data: itemCostPercentageData} =
    useQuery(['itemCostPercentage', {itemId: item.id}], getItemCostPercentage);
  const {status: getVendorStatus, data: getVendorData} = useQuery(
    ['vendor', {id: item.preferred_vendor_id}],
    getVendor,
    {
      enabled: item?.preferred_vendor_id ? true : false,
    },
  );
  const [showDetails, setShowDetails] = useState(showStockDetails);

  const [infoDialogVisible, setInfoDialogVisible] = useState(false);

  const showInfoDialog = () => setInfoDialogVisible(true);
  const hideInfoDialog = () => setInfoDialogVisible(false);

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

  const renderPreferredVendor = () => {
    if (item.preferred_vendor_id && getVendorStatus === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (item.preferred_vendor_id && getVendorStatus === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    let vendorDisplayName = 'None';
    let textColor = colors.dark;
    let onPress = () => {};

    const vendor = getVendorData?.result;

    if (vendor) {
      vendorDisplayName = vendor.vendor_display_name;
      textColor = colors.primary;
      onPress = () => {
        // TODO: Navigate to vendor view
      };
    }

    return (
      <>
        <Divider style={{marginVertical: 15}} />
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            marginBottom: 5,
          }}>
          <Subheading style={{marginLeft: 5}}>Vendor</Subheading>
        </View>

        <View style={[styles.detailsListItem]}>
          <Text style={{fontWeight: 'bold'}}>Preferred vendor:</Text>
          <Pressable style={{flexDirection: 'row'}} onPress={onPress}>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: textColor,
              }}>
              {vendorDisplayName}
            </Text>
          </Pressable>
        </View>
      </>
    );
  };

  if (!item) return null;

  if (
    itemAvgUnitCostStatus === 'loading' ||
    itemCostPercentageStatus === 'loading'
  ) {
    return <DefaultLoadingScreen />;
  }

  if (
    itemAvgUnitCostStatus === 'error' ||
    itemCostPercentageStatus === 'error'
  ) {
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

  const selectedMonthGrandTotalCost = item.selected_month_grand_total_cost || 0;
  const selectedMonthGrandTotalCostNet =
    item.selected_month_grand_total_cost_net || 0;
  const selectedMonthGrandTotalCostTax =
    item.selected_month_grand_total_cost_tax || 0;
  const selectedMonthTotalRemovedStockCost =
    item.selected_month_total_removed_stock_cost || 0;
  const selectedMonthTotalRemovedStockCostNet =
    item.selected_month_total_removed_stock_cost_net || 0;
  const selectedMonthRevenueGroupTotalAmount =
    item.selected_month_revenue_group_total_amount || 0;

  const itemCostPercentage = selectedMonthRevenueGroupTotalAmount
    ? (selectedMonthTotalRemovedStockCostNet /
        selectedMonthRevenueGroupTotalAmount) *
      100
    : 0;
  const avgUnitCost = selectedMonthGrandTotalCost
    ? selectedMonthGrandTotalCost / (item.selected_month_grand_total_qty || 0)
    : 0;
  const avgUnitCostNet = selectedMonthGrandTotalCost
    ? selectedMonthGrandTotalCostNet /
      (item.selected_month_grand_total_qty || 0)
    : 0;

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
            {item.name || item.item_name}
          </Headline>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              height: '100%',
            }}>
            {/* <Pressable style={{marginLeft: 5}} onPress={onPressItemOptions}>
              <MaterialIcons name="more-horiz" size={25} color={colors.dark} />
            </Pressable> */}
          </View>
        </View>
        <View style={{flexDirection: 'row'}}>
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

        <Divider style={{marginTop: 15}} />

        {showDetails && (
          <View style={styles.detailsContainer}>
            <View style={styles.detailsHeadingContainer}>
              <Subheading style={{marginLeft: 5}}>Stock</Subheading>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Previous Month Total:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${item.previous_month_grand_total_qty || 0}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`${formatUOMAbbrev(item.item_uom_abbrev)}`}
              </Text>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Added:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${item?.selected_month_total_added_stock_qty || 0}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`${formatUOMAbbrev(item.item_uom_abbrev)}`}
              </Text>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Removed:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.notification,
                }}>
                {`${item?.selected_month_total_removed_stock_qty || 0}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.notification,
                }}>
                {`${formatUOMAbbrev(item.item_uom_abbrev)}`}
              </Text>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Current Month Total:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${item?.selected_month_grand_total_qty || 0}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`${formatUOMAbbrev(item.item_uom_abbrev)}`}
              </Text>
            </View>

            <Divider style={{marginVertical: 15}} />
            <View style={styles.detailsHeadingContainer}>
              <Subheading style={{marginLeft: 5}}>Cost</Subheading>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text
                style={{
                  fontWeight: 'bold',
                }}>{`Total Stock Cost (Gross):`}</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${currencySymbol} ${commaNumber(
                  selectedMonthGrandTotalCost.toFixed(2),
                )}`}
              </Text>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text
                style={{fontWeight: 'bold'}}>{`Total Stock Cost (Net):`}</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: 'green',
                }}>
                {`${currencySymbol} ${commaNumber(
                  selectedMonthGrandTotalCostNet.toFixed(2),
                )}`}
              </Text>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text
                style={{fontWeight: 'bold'}}>{`Total Stock Tax Amount:`}</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${currencySymbol} ${commaNumber(
                  selectedMonthGrandTotalCostTax.toFixed(2),
                )}`}
              </Text>
            </View>

            <View style={styles.detailsListItem}>
              <Text style={{fontWeight: 'bold'}}>Average Unit Cost:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${currencySymbol} ${commaNumber(avgUnitCostNet.toFixed(2))}`}
              </Text>
              <Text
                style={{
                  marginLeft: 5,
                  color: colors.dark,
                }}>
                {`/ ${formatUOMAbbrev(item.item_uom_abbrev)}`}
              </Text>
            </View>

            <Divider style={{marginVertical: 15}} />
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                marginBottom: 5,
              }}>
              <Subheading style={{marginLeft: 5}}>Revenue</Subheading>
            </View>

            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Revenue Group:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {item?.revenue_group_name || 'None'}
              </Text>
            </View>

            <View style={styles.detailsListItem}>
              <Text style={{fontWeight: 'bold'}}>Revenue Group Amount:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {`${currencySymbol} ${commaNumber(
                  parseFloat(
                    item?.selected_month_revenue_group_total_amount || 0,
                  ).toFixed(2),
                )}`}
              </Text>
            </View>

            <View style={styles.detailsListItem}>
              <Text style={{fontWeight: 'bold'}}>Cost Percentage:</Text>
              {renderCostPercentageValue()}
            </View>

            {renderPreferredVendor()}
          </View>
        )}
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
  detailsHeadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 5,
  },
  detailsListItem: {
    marginLeft: 15,
    marginVertical: 6,
    marginBottom: 10,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsContainer: {
    marginTop: 10,
  },
});

export default ItemDetails;
