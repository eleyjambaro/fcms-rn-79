import React, {useState} from 'react';
import {useRoute} from '@react-navigation/native';
import {StyleSheet, View, ScrollView} from 'react-native';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {Portal, Dialog, Paragraph, Button, useTheme} from 'react-native-paper';

import ItemStockSummary from '../components/items/ItemStockSummary';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getItem} from '../localDbQueries/items';
import {deleteAllItemSellingSizeOptions} from '../localDbQueries/modifiers';
import ItemSizeOptionList from '../components/sizeOptions/ItemSizeOptionList';
import ItemSellingPriceTaxEditor from '../components/items/ItemSellingPriceTaxEditor';
import SellingPriceModeSelector from '../components/forms/SellingPriceModeSelector';
import SectionHeading from '../components/headings/SectionHeading';

const deriveMode = item =>
  item?.item_modifier_options_count > 0 ? 'size_options' : 'unit_price';

const ItemSizeOptions = _props => {
  const {colors} = useTheme();
  const route = useRoute();
  const itemId = route.params?.item_id;
  const queryClient = useQueryClient();
  const {status, data} = useQuery(['item', {id: itemId}], getItem);
  const item = data?.result;

  // null => follow the item's current state (count > 0 ? size_options :
  // unit_price); set explicitly once the user picks a mode.
  const [mode, setMode] = useState(null);
  const [confirmSwitchVisible, setConfirmSwitchVisible] = useState(false);

  const deleteAllMutation = useMutation(deleteAllItemSellingSizeOptions, {
    onSuccess: () => {
      queryClient.invalidateQueries(['item', {id: itemId}]);
      queryClient.invalidateQueries(['items']);
      queryClient.invalidateQueries(['itemSellingSizeModifierOptions']);
    },
  });

  if (!itemId) return null;

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  if (!item) return null;

  const effectiveMode = mode ?? deriveMode(item);
  const activeOptionsCount = item.item_modifier_options_count || 0;

  const handleModeChange = newMode => {
    // Switching to a single unit price while size options still exist requires
    // removing them (the POS uses size options whenever count > 0). Confirm
    // first; the soft-delete runs only on confirm.
    if (newMode === 'unit_price' && activeOptionsCount > 0) {
      setConfirmSwitchVisible(true);
      return;
    }
    setMode(newMode);
  };

  const handleConfirmSwitch = async () => {
    try {
      await deleteAllMutation.mutateAsync({itemId});
      setMode('unit_price');
    } catch (error) {
      console.debug(error);
    } finally {
      setConfirmSwitchVisible(false);
    }
  };

  return (
    <View style={styles.container}>
      <Portal>
        <Dialog
          visible={confirmSwitchVisible}
          onDismiss={() => setConfirmSwitchVisible(false)}>
          <Dialog.Title>Switch to a single unit price?</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`This will remove ${activeOptionsCount} selling size option${
                activeOptionsCount === 1 ? '' : 's'
              } for this item so it sells at one unit selling price. You cannot undo this action.`}
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button onPress={() => setConfirmSwitchVisible(false)}>
              Cancel
            </Button>
            <Button
              icon="delete-outline"
              color={colors.notification}
              loading={deleteAllMutation.isLoading}
              disabled={deleteAllMutation.isLoading}
              onPress={handleConfirmSwitch}>
              Remove & Switch
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <ItemStockSummary
        item={item}
        containerStyle={{marginBottom: 9}}
        showItemOptionsButton={false}
        hideReportSummary={true}
      />

      <SellingPriceModeSelector
        value={effectiveMode}
        onChange={handleModeChange}
        containerStyle={{marginHorizontal: 12}}
      />

      {effectiveMode === 'unit_price' ? (
        <ScrollView
          style={styles.unitPriceScroll}
          keyboardShouldPersistTaps="handled">
          <ItemSellingPriceTaxEditor item={item} showUnitSellingPrice />
        </ScrollView>
      ) : (
        <ItemSizeOptionList
          itemId={itemId}
          item={item}
          ListHeaderComponent={
            <>
              <ItemSellingPriceTaxEditor item={item} />
              <SectionHeading headingText="Selling Size" />
            </>
          }
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  unitPriceScroll: {
    flex: 1,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default ItemSizeOptions;
