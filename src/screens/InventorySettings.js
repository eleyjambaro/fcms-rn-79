import React, {useState, useEffect} from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {Switch, Text, Divider, useTheme} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {getSettings, updateSettings} from '../localDbQueries/settings';
import BannerAdComponent from '../components/ads/BannerAdComponent';
import {adUnitIds} from '../constants/adUnitIds';

const SETTING_NAME = 'auto_deduct_spoilages';

const InventorySettings = () => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();

  const {data, isLoading} = useQuery(
    ['settings', {settingNames: [SETTING_NAME]}],
    getSettings,
  );

  const updateSettingsMutation = useMutation(updateSettings, {
    onSuccess: () => {
      queryClient.invalidateQueries('settings');
    },
  });

  const [enabled, setEnabled] = useState(false);

  useEffect(() => {
    const value = data?.resultMap?.[SETTING_NAME];
    if (value !== undefined) {
      setEnabled(value === '1');
    }
  }, [data?.resultMap]);

  const handleToggle = async next => {
    setEnabled(next); // optimistic
    try {
      await updateSettingsMutation.mutateAsync({
        values: [{name: SETTING_NAME, value: next ? '1' : '0'}],
      });
    } catch (error) {
      console.debug(error);
      setEnabled(!next); // revert on failure
    }
  };

  return (
    <>
      <ScrollView
        style={[styles.container, {backgroundColor: colors.surface}]}
        contentContainerStyle={styles.content}>
        <View style={styles.row}>
          <View style={styles.rowText}>
            <Text style={styles.title}>Auto-deduct spoilages from stock</Text>
            <Text style={[styles.description, {color: colors.dark}]}>
              When on, recording a spoilage also logs it as Stock Usage and
              reduces the item&apos;s current stock. Leave off if your team books
              the loss through Ending Inventory instead — otherwise the same loss
              is counted twice.
            </Text>
          </View>
          <Switch
            value={enabled}
            onValueChange={handleToggle}
            disabled={isLoading || updateSettingsMutation.isLoading}
            color={colors.primary}
          />
        </View>
        <Divider />
      </ScrollView>
      <View>
        <BannerAdComponent unitId={adUnitIds.settingsScreenBanner} />
      </View>
    </>
  );
};

export default InventorySettings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    paddingVertical: 6,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
  },
  rowText: {
    flex: 1,
    paddingRight: 16,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    marginBottom: 4,
  },
  description: {
    fontSize: 13,
    lineHeight: 18,
  },
});
