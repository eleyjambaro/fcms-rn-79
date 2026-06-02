import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  useTheme,
  List,
  Divider,
  IconButton,
  ActivityIndicator,
} from 'react-native-paper';
import {useQuery} from '@tanstack/react-query';
import commaNumber from 'comma-number';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import useCurrencySymbol from '../../hooks/useCurrencySymbol';
import {getRevenueEntries} from '../../localDbQueries/revenues';

const RevenueGroupListItem = props => {
  const {
    item,
    onPress,
    onPressItemOptions,
    viewMode = 'list',
    highlighted,
    dateFilter,
    onAddExternalRevenue,
    onEditEntry,
    onDeleteEntry,
  } = props;
  const {colors} = useTheme();
  const currencySymbol = useCurrencySymbol();
  const [expanded, setExpanded] = useState(false);

  const {data: entriesData, status: entriesStatus} = useQuery(
    ['revenueEntries', {revenueGroupId: item?.id, dateFilter}],
    getRevenueEntries,
    {enabled: expanded && item?.id ? true : false},
  );

  if (!item) return null;

  const formatAmount = value =>
    `${currencySymbol} ${commaNumber((Number(value) || 0).toFixed(2))}`;

  // Manage-list mode keeps the simple row (tap to update the group).
  if (viewMode === 'manage-list') {
    return (
      <Pressable
        onPress={onPress}
        style={[
          styles.container,
          {borderColor: colors.neutralTint5, backgroundColor: colors.surface},
          highlighted ? {backgroundColor: colors.highlighted} : {},
        ]}>
        <View style={styles.wrapper}>
          <Text
            style={{fontSize: 14, color: colors.dark, marginRight: 10, flex: 1}}
            numberOfLines={1}>
            {item.name}
          </Text>
        </View>
        <Pressable
          style={styles.optionButtonContainer}
          onPress={onPressItemOptions}>
          <MaterialIcons name="more-horiz" size={20} color={colors.dark} />
        </Pressable>
      </Pressable>
    );
  }

  const entries = entriesData?.result || [];

  const renderBreakdown = () => {
    return (
      <View style={{backgroundColor: colors.surface, paddingBottom: 10}}>
        {/* Internal POS sales */}
        <View style={styles.breakdownRow}>
          <Text style={[styles.breakdownLabel, {color: colors.dark}]}>
            Total revenue (Sales)
          </Text>
          <Text style={[styles.breakdownAmount, {color: colors.dark}]}>
            {formatAmount(item.sales_total)}
          </Text>
        </View>

        {/* External per-source amounts */}
        {entriesStatus === 'loading' && (
          <View style={[styles.breakdownRow, {justifyContent: 'center'}]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        )}
        {entriesStatus !== 'loading' &&
          entries.map(entry => (
            <View key={entry.id} style={styles.breakdownRow}>
              <Text
                style={[styles.breakdownLabel, {color: colors.dark, flex: 1}]}
                numberOfLines={1}>
                {`+ ${entry.revenue_source_name || 'External revenue'}`}
              </Text>
              <Text style={[styles.breakdownAmount, {color: colors.dark}]}>
                {formatAmount(entry.amount)}
              </Text>
              <IconButton
                icon="pencil-outline"
                size={18}
                onPress={() => onEditEntry && onEditEntry(item, entry)}
              />
              <IconButton
                icon="delete-outline"
                size={18}
                color={colors.notification}
                onPress={() => onDeleteEntry && onDeleteEntry(item, entry)}
              />
            </View>
          ))}

        <View style={{paddingHorizontal: 10, paddingTop: 5}}>
          <Text
            style={{color: colors.primary, fontWeight: 'bold'}}
            onPress={() => onAddExternalRevenue && onAddExternalRevenue(item)}>
            {'+ Add external revenue'}
          </Text>
        </View>

        <Divider style={{marginVertical: 8}} />
        <View style={styles.breakdownRow}>
          <Text
            style={[
              styles.breakdownLabel,
              {color: colors.dark, fontWeight: 'bold'},
            ]}>
            Total
          </Text>
          <Text
            style={[
              styles.breakdownAmount,
              {color: colors.dark, fontWeight: 'bold'},
            ]}>
            {formatAmount(item.total_amount)}
          </Text>
        </View>
      </View>
    );
  };

  return (
    <List.Accordion
      title={item.name}
      titleStyle={{color: colors.dark, fontSize: 14}}
      description={formatAmount(item.total_amount)}
      descriptionStyle={{color: colors.dark, fontWeight: 'bold'}}
      expanded={expanded}
      onPress={() => setExpanded(prev => !prev)}
      style={[
        styles.accordion,
        {
          backgroundColor: highlighted ? colors.highlighted : colors.surface,
          borderColor: colors.neutralTint5,
        },
      ]}>
      {renderBreakdown()}
    </List.Accordion>
  );
};

const styles = StyleSheet.create({
  accordion: {
    borderBottomWidth: 1,
    width: '100%',
  },
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
  breakdownRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
    paddingVertical: 5,
  },
  breakdownLabel: {
    fontSize: 14,
    flex: 1,
    marginRight: 10,
  },
  breakdownAmount: {
    fontSize: 14,
  },
});

export default RevenueGroupListItem;
