import React, {useState} from 'react';
import {StyleSheet, Text, View, ScrollView, Pressable} from 'react-native';
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
import moment from 'moment';
import convert from 'convert-units';

import routes from '../../constants/routes';
import ListEmpty from '../stateIndicators/ListEmpty';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import {getVendor} from '../../localDbQueries/vendors';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import DashedDivider from '../dividers/DashedDivider';
import appDefaults from '../../constants/appDefaults';

const ItemLogDetails = props => {
  const {log, containerStyle, onPressItemOptions, onPressEditRemarks} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

  const {status: getVendorStatus, data: getVendorData} = useQuery(
    ['vendor', {id: log?.ref_vendor_id}],
    getVendor,
    {
      enabled: log?.ref_vendor_id ? true : false,
    },
  );

  const renderRemarks = () => {
    if (log.remarks) {
      return (
        <Text
          style={{
            marginHorizontal: 15,
            marginVertical: 10,
            color: colors.dark,
          }}>
          {log.remarks}
        </Text>
      );
    }

    return (
      <ListEmpty
        message="Add remarks up to 120 characters"
        containerStyle={{flex: 0}}
      />
    );
  };

  const renderVendor = (status, data) => {
    if (log.operation_type === 'remove_stock') return null;

    if (log.ref_vendor_id && status === 'loading') {
      return <DefaultLoadingScreen />;
    }

    if (log.ref_vendor_id && status === 'error') {
      return (
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      );
    }

    let vendorDisplayName = 'None';
    let isVendorDeleted = false;
    let textColor = colors.dark;
    let onPress = () => {};

    const vendor = data?.result;

    if (vendor) {
      vendorDisplayName = vendor.vendor_display_name;
      textColor = colors.primary;
      onPress = () => {
        // TODO: Navigate to vendor view
      };
    } else if (!vendor && log.vendor_display_name) {
      isVendorDeleted = true;
      vendorDisplayName = log.vendor_display_name;
    }

    return (
      <View style={[styles.detailsListItem]}>
        <Text style={{fontWeight: 'bold'}}>Vendor:</Text>
        <Pressable style={{flexDirection: 'row'}} onPress={onPress}>
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: textColor,
            }}>
            {vendorDisplayName}
          </Text>
          {isVendorDeleted && (
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.neutralTint3,
                fontStyle: 'italic',
              }}>
              {`(Deleted)`}
            </Text>
          )}
        </Pressable>
      </View>
    );
  };

  const renderDate = () => {
    let date = moment(log.adjustment_date?.split(' ')[0]).format(
      'MMM DD, YYYY',
    );
    if (log.operation_id === 1) {
      date = moment(log.beginning_inventory_date?.split(' ')[0]).format(
        'MMM YYYY',
      );
    }

    if (log.operation_id === 1) {
      return (
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MaterialCommunityIcons
            style={{marginLeft: 8}}
            name="flag-variant-outline"
            size={18}
          />
          <Text
            style={{
              marginLeft: 7,
              fontWeight: 'bold',
              color: colors.dark,
            }}
            numberOfLines={1}>
            {date}
          </Text>
        </View>
      );
    }

    return (
      <Text
        style={{
          marginLeft: 7,
          fontWeight: 'bold',
          color: colors.dark,
        }}
        numberOfLines={1}>
        {date}
      </Text>
    );
  };

  const renderYieldDetails = () => {
    if (!log.yield_ref_id) return null;

    return (
      <>
        <Divider style={{marginTop: 15}} />

        <View style={styles.detailsContainer}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 10,
            }}>
            <MaterialCommunityIcons
              name="package-variant"
              size={25}
              color={log.voided === 1 ? colors.notification : colors.dark}
            />
            <Subheading
              style={[
                {marginLeft: 5, fontWeight: 'bold'},
                log.voided === 1 && {color: colors.notification},
              ]}>
              {'Yield Details'}
            </Subheading>
          </View>
          <View style={[styles.detailsListItem]}>
            <Text
              style={{
                fontWeight: 'bold',
              }}>{`Yield Ref ID:`}</Text>
            <Text
              numberOfLines={1}
              style={{
                flex: 1,
                marginLeft: 7,
                fontWeight: 'bold',
                fontSize: 11,
                color: colors.dark,
              }}>
              {log.yield_ref_id}
            </Text>
          </View>
        </View>
      </>
    );
  };

  const renderRemovedStockQtySubtext = () => {
    if (
      log.operation_type === 'remove_stock' &&
      log.yield_ref_id &&
      log.recipe_id
    ) {
      return (
        <Text
          style={{
            fontStyle: 'italic',
            marginLeft: 6,
            borderWidth: 1,
            fontSize: 14,
          }}>{` (used in recipe yield)`}</Text>
      );
    }
  };

  if (!log) return null;

  const plusOrMinusSign = log.operation_type === 'add_stock' ? '+' : '-';

  let unit = '';

  if (log.item_uom_abbrev === 'ea') {
    if (log.adjustment_qty > 1) {
      // plural
      unit = 'Pieces';
    } else {
      unit = 'Piece';
    }
  } else {
    if (log.adjustment_qty > 1) {
      // plural
      unit = convert().describe(log.item_uom_abbrev)?.plural;
    } else {
      unit = convert().describe(log.item_uom_abbrev)?.singular;
    }
  }

  let transactionDetailsHeadingText = `Transaction Details`;

  if (parseInt(log.voided) === 1) {
    transactionDetailsHeadingText = `Voided Transaction Details`;
  }

  const unitCost = parseFloat(log.adjustment_unit_cost || 0);
  const adjustmentQty = parseFloat(log.adjustment_qty || 0);
  let taxRatePercentage = parseFloat(log.adjustment_tax_rate_percentage || 0);

  let unitCostNet = unitCost / (taxRatePercentage / 100 + 1);
  let unitCostTax = unitCost - unitCostNet;

  let grossPrice = unitCost * adjustmentQty;
  let netPrice = grossPrice / (taxRatePercentage / 100 + 1);
  let taxAmount = grossPrice - netPrice;
  let appliedTax = log.adjustment_tax_name
    ? `${log.adjustment_tax_name} (${log.adjustment_tax_rate_percentage}%)`
    : 'None';

  if (log.operation_type === 'add_stock' && log.yield_ref_id) {
    unitCostNet = parseFloat(log.adjustment_unit_cost_net || 0);
    unitCostTax = parseFloat(log.adjustment_unit_cost_tax || 0);
    netPrice = unitCostNet * adjustmentQty;
    taxAmount = unitCostTax * adjustmentQty;
    appliedTax = 'Ingredients Taxable Amount';
    taxRatePercentage = 0;
  }

  if (log.operation_type === 'remove_stock') {
    unitCostNet = parseFloat(log.adjustment_unit_cost_net || 0);
    unitCostTax = parseFloat(log.adjustment_unit_cost_tax || 0);
    netPrice = unitCostNet * adjustmentQty;
    taxAmount = unitCostTax * adjustmentQty;
    appliedTax = taxAmount ? 'Tax per avg. unit cost' : 'None';
    taxRatePercentage = 0;
  }

  return (
    <ScrollView>
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
            marginBottom: log.item_category_name ? 10 : 0,
          }}>
          <View style={{flex: 1}}>
            <Headline numberOfLines={3} style={{marginRight: 10}}>
              {log.operation_id === 1
                ? `Pre-${appDefaults.appDisplayName} Stock`
                : log.operation_name}
            </Headline>
            <Subheading
              onPress={() =>
                navigation.navigate(routes.itemView(), {item_id: log.item_id})
              }
              numberOfLines={3}
              style={{
                fontWeight: 'bold',
                fontSize: 18,
                color: colors.primary,
              }}>
              {`${log.item_name}`}
            </Subheading>
            <Subheading
              numberOfLines={3}
              style={{
                color:
                  log.operation_type === 'remove_stock'
                    ? colors.notification
                    : colors.dark,
                fontWeight: 'bold',
              }}>
              {`${commaNumber(log.adjustment_qty?.toFixed(2))} ${unit}`}
              {renderRemovedStockQtySubtext()}
            </Subheading>
          </View>

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

        <View style={{flexDirection: 'row'}}>
          {log.item_category_name && (
            <View>
              <Chip
                style={{marginRight: 'auto'}}
                icon="clipboard-list-outline"
                onPress={() => {
                  navigation.navigate(routes.categoryView(), {
                    category_id: log.item_category_id,
                  });
                }}>
                {log.item_category_name}
              </Chip>
            </View>
          )}
        </View>

        <Divider style={{marginTop: 15}} />

        <View style={styles.detailsContainer}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              marginTop: 4,
              marginBottom: 10,
            }}>
            <MaterialCommunityIcons
              name="clipboard-arrow-right-outline"
              size={25}
              color={log.voided === 1 ? colors.notification : colors.dark}
            />
            <Subheading
              style={[
                {marginLeft: 5, fontWeight: 'bold'},
                log.voided === 1 && {color: colors.notification},
              ]}>
              {transactionDetailsHeadingText}
            </Subheading>
          </View>

          <View style={[styles.detailsListItem]}>
            <Text
              style={{
                fontWeight: 'bold',
              }}>{`Total Amount (Tax Inclusive):`}</Text>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
              }}>
              {`${currencySymbol} ${commaNumber(grossPrice.toFixed(2))}`}
            </Text>
          </View>
          <View style={[styles.detailsListItem]}>
            <Text style={{fontWeight: 'bold'}}>{`Total Amount (Net):`}</Text>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
              }}>
              {`${currencySymbol} ${commaNumber(netPrice.toFixed(2))}`}
            </Text>
          </View>

          {log.operation_type === 'add_stock' && (
            <>
              <DashedDivider containerStyle={{marginHorizontal: 15}} />

              <View style={[styles.detailsListItem]}>
                <Text style={{fontWeight: 'bold'}}>Tax:</Text>
                <Text
                  style={[
                    {
                      marginLeft: 7,
                      fontWeight: 'bold',
                      color: colors.dark,
                    },
                    ((log.operation_type === 'add_stock' && log.yield_ref_id) ||
                      log.operation_type === 'remove_stock') && {
                      fontStyle: 'italic',
                    },
                  ]}>
                  {appliedTax}
                </Text>
              </View>

              <View style={[styles.detailsListItem]}>
                <Text style={{fontWeight: 'bold'}}>Tax Total Amount:</Text>
                <Text
                  style={{
                    marginLeft: 7,
                    fontWeight: 'bold',
                    color: colors.dark,
                  }}>
                  {`${currencySymbol} ${commaNumber(taxAmount.toFixed(2))}`}
                </Text>
              </View>
            </>
          )}

          <DashedDivider containerStyle={{marginHorizontal: 15}} />

          <View style={[styles.detailsListItem]}>
            <Text
              style={{fontWeight: 'bold'}}>{`Unit Cost (Tax Inclusive):`}</Text>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
              }}>
              {`${currencySymbol} ${commaNumber(unitCost.toFixed(2))}`}
            </Text>
            <Text
              style={{
                marginLeft: 5,
                color: colors.dark,
              }}>
              {`/ ${formatUOMAbbrev(log.item_uom_abbrev)}`}
            </Text>
          </View>
          <View style={[styles.detailsListItem]}>
            <Text style={{fontWeight: 'bold'}}>{`Unit Cost (Net):`}</Text>
            <Text
              style={{
                marginLeft: 7,
                fontWeight: 'bold',
                color: colors.dark,
              }}>
              {`${currencySymbol} ${commaNumber(unitCostNet.toFixed(2))}`}
            </Text>
            <Text
              style={{
                marginLeft: 5,
                color: colors.dark,
              }}>
              {`/ ${formatUOMAbbrev(log.item_uom_abbrev)}`}
            </Text>
          </View>

          <DashedDivider containerStyle={{marginHorizontal: 15}} />

          <View style={[styles.detailsListItem]}>
            <Text style={{fontWeight: 'bold'}}>
              {log.operation_id === 1 ? 'Beginning Inventory Date:' : 'Date:'}
            </Text>
            {renderDate()}
          </View>
          {log.operation_type === 'add_stock' && (
            <View style={[styles.detailsListItem]}>
              <Text style={{fontWeight: 'bold'}}>Official Receipt #:</Text>
              <Text
                style={{
                  marginLeft: 7,
                  fontWeight: 'bold',
                  color: colors.dark,
                }}>
                {log.official_receipt_number || 'None'}
              </Text>
            </View>
          )}
          {renderVendor(getVendorStatus, getVendorData)}
        </View>

        {renderYieldDetails()}
      </View>

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
          <View style={{flex: 1}}>
            <Subheading
              numberOfLines={3}
              style={{
                fontWeight: 'bold',
              }}>
              {'Remarks:'}
            </Subheading>
          </View>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              height: '100%',
            }}>
            <Pressable style={{marginLeft: 5}} onPress={onPressEditRemarks}>
              <MaterialCommunityIcons
                name="pencil-outline"
                size={25}
                color={colors.dark}
              />
            </Pressable>
          </View>
        </View>

        <Divider style={{marginVertical: 8}} />

        {renderRemarks()}
      </View>
    </ScrollView>
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
    marginTop: 12,
    marginBottom: 10,
  },
  detailsListItem: {
    marginLeft: 15,
    marginVertical: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },
  detailsListItemGroup: {
    borderRadius: 1,
    borderWidth: 2,
    borderStyle: 'dotted',
    borderColor: 'transparent',
    borderBottomColor: 'red',
  },
  actionsContainer: {
    marginTop: 10,
  },
});

export default ItemLogDetails;
