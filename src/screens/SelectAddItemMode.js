import React, {useEffect, useState} from 'react';
import {StyleSheet, View, Pressable, ScrollView} from 'react-native';
import {
  Button,
  RadioButton,
  Text,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';

import routes from '../constants/routes';
import {countLocalMastersAvailableForBranch} from '../localDbQueries/masterItems';

const MODE_FROM_MASTER = 'from_master';
const MODE_REGISTER_NEW = 'register_new';

const SelectAddItemMode = ({navigation, route}) => {
  const {colors} = useTheme();
  const [mode, setMode] = useState(null);
  const [defaultsLoading, setDefaultsLoading] = useState(true);

  // Default radio selection depends on whether there are any masters
  // available to pick from in this branch. New companies / new devices
  // (empty master_items table) get option 2 pre-selected.
  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const count = await countLocalMastersAvailableForBranch();
        if (!mounted) return;
        setMode(count > 0 ? MODE_FROM_MASTER : MODE_REGISTER_NEW);
      } catch {
        if (!mounted) return;
        setMode(MODE_REGISTER_NEW);
      } finally {
        if (mounted) setDefaultsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  const handleContinue = () => {
    const forwardParams = route.params ?? {};
    if (mode === MODE_FROM_MASTER) {
      navigation.replace(routes.selectMasterItem(), forwardParams);
    } else {
      navigation.replace(routes.addItem(), forwardParams);
    }
  };

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <ScrollView contentContainerStyle={styles.scroll}>
        <Text variant="titleMedium" style={styles.heading}>
          How do you want to add this item?
        </Text>

        <OptionCard
          selected={mode === MODE_FROM_MASTER}
          onPress={() => setMode(MODE_FROM_MASTER)}
          title="Add from Company Master Item List"
          subtitle="Recommended if the product already exists in your company catalog. The branch entry will share the same SKU and description as the master."
        />

        <OptionCard
          selected={mode === MODE_REGISTER_NEW}
          onPress={() => setMode(MODE_REGISTER_NEW)}
          title="Register new item to Company Master Item List"
          subtitle="Use this for products not yet in the catalog. A new master entry will be created for the whole company."
        />
      </ScrollView>

      <View style={styles.footer}>
        {defaultsLoading ? (
          <ActivityIndicator animating color={colors.primary} />
        ) : (
          <Button
            mode="contained"
            disabled={!mode}
            onPress={handleContinue}>
            Continue
          </Button>
        )}
      </View>
    </View>
  );
};

const OptionCard = ({selected, onPress, title, subtitle}) => {
  const {colors} = useTheme();
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.card,
        {
          borderColor: selected ? colors.primary : colors.neutralTint5 ?? '#ccc',
          backgroundColor: selected ? colors.primaryTint5 ?? '#f4f8ff' : 'transparent',
        },
      ]}>
      <RadioButton
        value={title}
        status={selected ? 'checked' : 'unchecked'}
        onPress={onPress}
      />
      <View style={styles.cardBody}>
        <Text variant="titleSmall" style={styles.cardTitle}>
          {title}
        </Text>
        <Text variant="bodySmall" style={{color: colors.neutralTint3 ?? '#666'}}>
          {subtitle}
        </Text>
      </View>
    </Pressable>
  );
};

export default SelectAddItemMode;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scroll: {
    padding: 16,
  },
  heading: {
    marginBottom: 12,
  },
  card: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 12,
    borderWidth: 1,
    borderRadius: 8,
    marginBottom: 12,
  },
  cardBody: {
    flex: 1,
    marginLeft: 8,
  },
  cardTitle: {
    marginBottom: 4,
    fontWeight: '600',
  },
  footer: {
    padding: 16,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
});
