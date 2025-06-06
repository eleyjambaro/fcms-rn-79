import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
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
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';

import routes from '../../../constants/routes';

import {
  formatUOM,
  formatUOMAbbrev,
  formatUOMAsPackage,
} from '../../../utils/stringHelpers';

const FinishedProductDetails = props => {
  const {
    item,
    containerStyle,
    showActions = true,
    onPressItemOptions,
    showStockDetails = true,
    showCurrentStock = false,
    showItemOptionsButton = false,
  } = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const [showDetails, setShowDetails] = useState(showStockDetails);

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

  const renderUOMAbbrevPerPiece = () => {
    if (item?.uom_abbrev_per_piece) {
      return (
        <View style={styles.detailsListItem}>
          <View style={{flexDirection: 'row', alignItems: 'center'}}>
            <Text style={{fontWeight: 'bold'}}>Yield UOM Per Piece:</Text>

            <Text
              style={{
                marginLeft: 5,
                color: colors.dark,
                fontWeight: 'bold',
              }}>
              {`${formatUOM(item.uom_abbrev)} (${formatUOMAbbrev(
                item.uom_abbrev,
              )})`}
            </Text>
          </View>
        </View>
      );
    }
  };

  if (!item) return null;

  return (
    <View
      style={[
        styles.container,
        {backgroundColor: colors.surface, borderColor: colors.neutralTint1},
        containerStyle,
      ]}>
      <View style={[styles.header, {backgroundColor: colors.neutralTint2}]}>
        <MaterialIcons name="link" size={25} color={colors.neutralTint5} />
      </View>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          marginTop: 5,
          marginBottom: item.category_name ? 10 : 0,
        }}>
        <Text
          numberOfLines={3}
          style={{
            flex: 1,
            marginRight: 10,
            fontWeight: 'bold',
            fontSize: 20,
            color: colors.primary,
          }}
          onPress={() => {
            navigation.navigate(routes.itemView(), {item_id: item.id});
          }}>
          {item.name}
        </Text>
        <View
          style={{
            flexDirection: 'row',
            justifyContent: 'flex-start',
            height: '100%',
          }}>
          {showItemOptionsButton && (
            <Pressable style={{marginLeft: 5}} onPress={onPressItemOptions}>
              <MaterialIcons name="more-horiz" size={25} color={colors.dark} />
            </Pressable>
          )}
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
      </View>

      <Divider style={{marginTop: 15, marginBottom: 15}} />

      {showDetails && (
        <View style={[styles.detailsContainer, {marginTop: 0}]}>
          {showCurrentStock && (
            <View style={styles.detailsListItem}>
              <View>
                <Text style={{fontWeight: 'bold'}}>
                  Current Yield Stock Quantity:
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
          )}

          <View style={styles.detailsListItem}>
            <View>
              <Text style={{fontWeight: 'bold'}}>Yield UOM:</Text>
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
                  {`${formatUOMAsPackage(
                    item.uom_abbrev,
                    item.uom_abbrev_per_piece,
                    item.qty_per_piece,
                  )}`}
                </Text>
              </View>
            </View>
          </View>

          {/* {renderUOMAbbrevPerPiece()} */}
        </View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    borderWidth: 1,
    borderRadius: 15,
    padding: 15,
    paddingTop: 30,
  },
  header: {
    borderTopLeftRadius: 14,
    borderTopRightRadius: 14,
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    alignItems: 'center',
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

export default FinishedProductDetails;
