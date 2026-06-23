import React from 'react';
import {StyleSheet, View, ScrollView, Pressable} from 'react-native';
import {
  Subheading,
  Divider,
  ActivityIndicator,
  Text,
  useTheme,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';
import commaNumber from 'comma-number';
import moment from 'moment';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import {getSpoilage} from '../localDbQueries/spoilages';
import useCurrencySymbol from '../hooks/useCurrencySymbol';
import {formatUOMAbbrev} from '../utils/stringHelpers';

const DetailRow = ({label, children}) => {
  const {colors} = useTheme();
  return (
    <View style={styles.detailRow}>
      <Text style={{color: colors.neutralTint2}}>{label}</Text>
      <View style={styles.detailValue}>{children}</View>
    </View>
  );
};

const SpoilageView = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const spoilageId = route.params?.spoilage_id;
  const currencySymbol = useCurrencySymbol();

  const {status, data} = useQuery(
    ['spoilage', {id: spoilageId}],
    getSpoilage,
    {enabled: !!spoilageId},
  );

  const spoilage = data?.result;

  if (status === 'loading') {
    return (
      <View style={[styles.centered, {backgroundColor: colors.surface}]}>
        <ActivityIndicator size="small" color={colors.primary} />
      </View>
    );
  }

  if (!spoilage) {
    return (
      <View style={[styles.centered, {backgroundColor: colors.surface}]}>
        <Text style={{color: colors.neutralTint2}}>Spoilage not found.</Text>
      </View>
    );
  }

  const uom = spoilage.item_uom_abbrev;
  const deducted = !!spoilage.deducted;

  return (
    <ScrollView style={[styles.container, {backgroundColor: colors.surface}]}>
      {/* Summary: item + spoiled qty */}
      <View style={styles.section}>
        <Pressable
          onPress={() =>
            navigation.navigate(routes.itemView(), {item_id: spoilage.item_id})
          }>
          <Text
            style={[styles.itemName, {color: colors.primary}]}
            numberOfLines={2}>
            {spoilage.item_name}
          </Text>
        </Pressable>
        <Text style={[styles.qty, {color: colors.notification}]}>
          {`- ${commaNumber(
            parseFloat(spoilage.in_spoilage_qty?.toFixed?.(2) ?? spoilage.in_spoilage_qty),
          )} ${formatUOMAbbrev(spoilage.in_spoilage_uom_abbrev)}`}
        </Text>
        {spoilage.item_category_name ? (
          <Text style={{color: colors.neutralTint2}}>
            {spoilage.item_category_name}
          </Text>
        ) : null}
        {deducted ? (
          <View style={styles.badgeRow}>
            <MaterialCommunityIcons
              name="package-down"
              size={16}
              color={colors.neutralTint1}
            />
            <Text style={[styles.badgeText, {color: colors.neutralTint1}]}>
              {'Deducted from stock'}
            </Text>
          </View>
        ) : null}
      </View>

      <Divider />

      {/* Loss details */}
      <View style={styles.section}>
        <Subheading style={styles.heading}>{'Loss Details'}</Subheading>
        <DetailRow label="Total amount (net)">
          <Text style={styles.value}>{`${currencySymbol} ${commaNumber(
            (spoilage.total_cost_net || 0).toFixed(2),
          )}`}</Text>
        </DetailRow>
        <DetailRow label="Avg. unit cost (net)">
          <Text style={styles.value}>
            {`${currencySymbol} ${commaNumber(
              (spoilage.avg_unit_cost_net || 0).toFixed(2),
            )}`}
            {uom ? (
              <Text style={{color: colors.neutralTint2}}>
                {` / ${formatUOMAbbrev(uom)}`}
              </Text>
            ) : null}
          </Text>
        </DetailRow>
        <DetailRow label="Date">
          <Text style={styles.value}>
            {spoilage.in_spoilage_date
              ? moment(spoilage.in_spoilage_date).format('MMM DD, YYYY hh:mm A')
              : '—'}
          </Text>
        </DetailRow>
      </View>

      {/* Stock deduction (auto-deduct) */}
      {deducted && spoilage.inventory_log_id ? (
        <>
          <Divider />
          <View style={styles.section}>
            <Subheading style={styles.heading}>{'Stock Deduction'}</Subheading>
            <Pressable
              style={[styles.linkRow, {borderColor: colors.neutralTint5}]}
              onPress={() =>
                navigation.navigate(routes.logView(), {
                  log_id: spoilage.inventory_log_id,
                  item_id: spoilage.item_id,
                })
              }>
              <Text style={[styles.value, {color: colors.primary, flex: 1}]}>
                {'View Stock Usage log'}
              </Text>
              <MaterialCommunityIcons
                name="chevron-right"
                size={22}
                color={colors.neutralTint2}
              />
            </Pressable>
            <Text style={[styles.italic, {color: colors.neutralTint2}]}>
              {
                'This spoilage was auto-deducted from stock as a Stock Usage inventory log.'
              }
            </Text>
          </View>
        </>
      ) : null}

      <Divider />

      {/* Remarks */}
      <View style={styles.section}>
        <Subheading style={styles.heading}>{'Remarks'}</Subheading>
        {spoilage.remarks?.length > 0 ? (
          <Text>{spoilage.remarks}</Text>
        ) : (
          <Text style={[styles.italic, {color: colors.neutralTint2}]}>
            {'No remarks.'}
          </Text>
        )}
      </View>
    </ScrollView>
  );
};

export default SpoilageView;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  section: {
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  itemName: {
    fontSize: 17,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  qty: {
    fontSize: 20,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  badgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
  },
  badgeText: {
    marginLeft: 4,
    fontSize: 13,
    fontWeight: '500',
  },
  heading: {
    fontWeight: 'bold',
    marginBottom: 8,
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    paddingVertical: 5,
  },
  detailValue: {
    marginLeft: 16,
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  value: {
    fontWeight: '500',
    textAlign: 'right',
  },
  linkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 6,
    paddingHorizontal: 12,
    paddingVertical: 12,
    marginBottom: 6,
  },
  italic: {
    fontStyle: 'italic',
    fontSize: 13,
    marginTop: 2,
  },
});
