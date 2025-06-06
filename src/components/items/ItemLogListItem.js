import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  Button,
  Paragraph,
  Dialog,
  Modal,
  Portal,
  TextInput,
  Title,
  useTheme,
  Surface,
} from 'react-native-paper';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import moment from 'moment';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';
import appDefaults from '../../constants/appDefaults';

const ItemLogListItem = props => {
  const {item, onPressItem, onPressItemOptions} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [detailsDialogVisible, setDetailsDialogVisible] = useState(false);

  if (!item) return null;

  const plusOrMinusSign = item.operation_type === 'add_stock' ? '+' : '-';

  const renderListItemIcon = (iconSize = 25) => {
    if (item.operation_type === 'add_stock') {
      return (
        <MaterialCommunityIcons
          name="plus-box-outline"
          size={iconSize}
          color={colors.accent}
        />
      );
    }

    return (
      <MaterialCommunityIcons
        name="minus-box-outline"
        size={iconSize}
        color={colors.notification}
      />
    );
  };

  const renderRemarksIcon = () => {
    if (item.remarks?.length > 0) {
      return (
        <MaterialCommunityIcons
          style={{marginLeft: 8}}
          name="comment-alert-outline"
          size={18}
          color={colors.primary}
        />
      );
    }
  };

  const renderVoidedIcon = () => {
    if (item.voided === 1) {
      return (
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MaterialCommunityIcons
            style={{marginLeft: 8}}
            name="delete-alert-outline"
            size={18}
            color={colors.notification}
          />
          <Text
            style={{
              color: colors.notification,
              marginLeft: 3,
              fontWeight: 'bold',
            }}>
            Voided
          </Text>
        </View>
      );
    }
  };

  const renderDate = () => {
    let date = moment(item.adjustment_date?.split(' ')[0]).format(
      'MMM DD, YYYY',
    );
    if (item.operation_id === 1) {
      date = moment(item.beginning_inventory_date?.split(' ')[0]).format(
        'MMMM YYYY',
      );
    }

    if (item.operation_id === 1) {
      return (
        <View style={{flexDirection: 'row', alignItems: 'center'}}>
          <MaterialCommunityIcons
            style={{marginLeft: 8}}
            name="flag-variant-outline"
            color={colors.neutralTint2}
            size={18}
          />
          <Text
            style={{
              marginLeft: 3,
              fontSize: 16,
              color: colors.neutralTint2,
              fontWeight: 'bold',
            }}>
            {date}
          </Text>
        </View>
      );
    }

    return (
      <Text
        style={{
          fontSize: 16,
          color: colors.neutralTint2,
          fontWeight: '500',
          // marginRight: 10,
          // flex: 1,
        }}
        numberOfLines={1}>
        {date}
      </Text>
    );
  };

  const renderAdjustmentQtyBasedOnUOMPerPiece = () => {
    if (item.item_uom_abbrev_per_piece && item.item_qty_per_piece) {
      const adjustmentQtyBasedOnUOMPerPiece =
        item.item_qty_per_piece * item.adjustment_qty;

      return (
        <Text
          style={{
            color:
              item.operation_type === 'remove_stock'
                ? colors.neutralTint2
                : item.voided
                ? colors.neutralTint3
                : colors.neutralTint2,
            marginLeft: 'auto',
            fontWeight: '500',
          }}>
          {`(${plusOrMinusSign} ${commaNumber(
            adjustmentQtyBasedOnUOMPerPiece?.toFixed(2),
          )} ${formatUOMAbbrev(item.item_uom_abbrev_per_piece)})`}
        </Text>
      );
    }
  };

  /**
   * TODO: Fix the formula of cost per package
   */
  const renderCostPerPackage = () => {
    if (item.item_uom_abbrev_per_piece && item.item_qty_per_piece) {
      return (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Text
            style={{
              fontSize: 14,
              color: colors.neutralTint2,
              fontStyle: 'italic',
            }}
            numberOfLines={1}>
            {`${currencySymbol} ${commaNumber(
              (item.adjustment_unit_cost_net || 0).toFixed(2),
            )}`}
          </Text>
          <Text
            style={{
              marginLeft: 5,
              color: colors.neutralTint2,
              fontStyle: 'italic',
            }}>
            {`per ${commaNumber(
              item.item_qty_per_piece?.toFixed(2),
            )} ${formatUOMAbbrev(item.item_uom_abbrev_per_piece)}`}
          </Text>
        </View>
      );
    }
  };

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}
      onPress={onPressItem}>
      {/* <View style={styles.listItemIconContainer}>{renderListItemIcon()}</View> */}
      <View style={styles.wrapper}>
        <View
          style={{
            marginRight: 10,
            flex: 1,
          }}>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 16,
                fontWeight: '500',
                color: colors.neutralTint2,
                // marginRight: 10,
                // flex: 1,
              }}
              numberOfLines={1}>
              {item.operation_id === 1
                ? `Pre-${appDefaults.appDisplayName} Stock`
                : item.operation_name}
            </Text>
            {renderRemarksIcon()}
            {renderVoidedIcon()}
          </View>
          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: colors.dark,
              // marginRight: 10,
              // flex: 1,
            }}
            numberOfLines={1}>
            {item.item_name}
          </Text>
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
            }}>
            <Text
              style={{
                fontSize: 14,
                color: item.voided ? colors.neutralTint3 : colors.dark,
              }}
              numberOfLines={1}>
              {`${currencySymbol} ${commaNumber(
                (item.adjustment_unit_cost_net || 0).toFixed(2),
              )}`}
            </Text>
            <Text
              style={{
                marginLeft: 5,
                color: item.voided ? colors.neutralTint3 : colors.dark,
              }}>
              {`/ ${formatUOMAbbrev(item.item_uom_abbrev)}`}
            </Text>
          </View>
          {renderCostPerPackage()}
        </View>

        <View
          style={{
            marginLeft: 'auto',
          }}>
          {renderDate()}
          <Text
            style={{
              color: item.voided
                ? colors.neutralTint3
                : item.operation_type === 'remove_stock'
                ? colors.notification
                : colors.dark,
              marginLeft: 'auto',
              fontWeight: 'bold',
            }}>
            {`${plusOrMinusSign} ${commaNumber(
              item.adjustment_qty?.toFixed(2),
            )} ${formatUOMAbbrev(item.item_uom_abbrev)}`}
          </Text>
          {renderAdjustmentQtyBasedOnUOMPerPiece()}
          <Text
            style={{
              color: item.voided ? colors.neutralTint3 : colors.accent,
              fontWeight: 'bold',
              marginLeft: 'auto',
            }}>
            {`${currencySymbol} ${commaNumber(item.total_cost_net.toFixed(2))}`}
          </Text>
        </View>
      </View>

      {/* <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.dark}
        />
      </Pressable> */}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    width: '100%',
    elevation: 100,
  },
  wrapper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 20,
    paddingHorizontal: 15,
  },
  optionButtonContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 15,
  },
  listItemIconContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingLeft: 15,
  },
  header: {
    flexDirection: 'row',
    marginBottom: 10,
    alignItems: 'center',
  },
  qtyContainer: {
    flexDirection: 'row',
    marginLeft: 'auto',
    flex: 1,
  },
  body: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
  },
  costFrame: {
    flexDirection: 'row',
    borderWidth: 1,
    borderRadius: 4,
    marginRight: 5,
    paddingHorizontal: 10,
    height: 38,
    alignItems: 'center',
  },
  costText: {
    fontSize: 14,
    color: 'black',
  },
  col: {
    flex: 1,
  },
  colHeader: {
    flex: 1,
  },
  colHeading: {
    marginBottom: 3,
    textAlign: 'center',
    fontSize: 14,
  },
  footer: {
    flexDirection: 'row',
    marginTop: 10,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
});

export default ItemLogListItem;
