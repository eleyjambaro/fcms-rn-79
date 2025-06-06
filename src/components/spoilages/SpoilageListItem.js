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
import moment from 'moment';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../../utils/stringHelpers';

const SpoilageListItem = props => {
  const {item, onPressItem, onPressItemOptions} = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();

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

  if (!item) return null;

  return (
    <Pressable
      style={[
        styles.container,
        {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
      ]}
      onPress={onPressItem}>
      <View style={styles.wrapper}>
        <View>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text
              style={{
                fontSize: 16,
                color: colors.neutralTint2,
                marginBottom: 2,
                fontWeight: 'bold',
                // marginRight: 10,
                // flex: 1,
              }}
              numberOfLines={1}>
              {moment(item.in_spoilage_date?.split(' ')[0]).format('MMM DD')}
            </Text>
            {renderRemarksIcon()}
          </View>

          <Text
            style={{
              fontSize: 14,
              fontWeight: 'bold',
              color: colors.dark,
              marginRight: 10,
              flex: 1,
            }}
            numberOfLines={1}>
            {item.name}
          </Text>
          <Text style={{color: colors.dark}}>{`${commaNumber(
            (parseFloat(item.in_spoilage_qty) || 0).toFixed(2),
          )} ${formatUOMAbbrev(item.in_spoilage_uom_abbrev)}`}</Text>
        </View>

        <View
          style={{
            marginLeft: 'auto',
            flexDirection: 'row',
          }}>
          <Text
            style={{
              color: colors.dark,
            }}>{`${currencySymbol} ${commaNumber(
            (item.total_cost_net || 0)?.toFixed(2),
          )}`}</Text>
        </View>
      </View>

      <Pressable
        style={styles.optionButtonContainer}
        onPress={onPressItemOptions}>
        <MaterialCommunityIcons
          name="chevron-down"
          size={20}
          color={colors.dark}
        />
      </Pressable>
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

export default SpoilageListItem;
