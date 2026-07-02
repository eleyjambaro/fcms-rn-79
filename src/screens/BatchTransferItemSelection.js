import React, {useEffect, useMemo, useState} from 'react';
import {
  View,
  StyleSheet,
  FlatList,
  Pressable,
  ToastAndroid,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import {
  Text,
  Searchbar,
  Button,
  Dialog,
  Portal,
  TextInput,
  HelperText,
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {Dropdown} from 'react-native-paper-dropdown';
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import {getItems, setItemNetWeightPerPiece} from '../localDbQueries/items';
import {
  getBatchTransferEntries,
  createBatchTransferEntry,
} from '../localDbQueries/batchTransfer';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {formatTransferUOMAbbrev} from '../utils/stringHelpers';
import {
  PIECE_UNIT,
  isNonEaItem,
  nonEaStockUnitOptions,
  pieceNeedsNetWeight,
  toBaseQty,
} from '../utils/stockMeasurement';

const ItemRow = ({item, currentQty, onPress}) => {
  const {colors} = useTheme();
  const hasQty = currentQty && parseFloat(currentQty) > 0;
  return (
    <Pressable
      onPress={() => onPress(item)}
      style={({pressed}) => [
        styles.row,
        pressed && {backgroundColor: colors.surface},
        hasQty && {backgroundColor: '#E3F2FD'},
      ]}>
      <View style={{flex: 1}}>
        <Text style={styles.itemName} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={styles.itemMeta} numberOfLines={1}>
          {item.sku ? `SKU ${item.sku} • ` : ''}
          Stock: {Number(item.current_stock_qty || 0).toFixed(2)}{' '}
          {formatTransferUOMAbbrev(item.uom_abbrev)}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {hasQty ? (
          <Text style={styles.qtyBadge}>
            {parseFloat(currentQty)} {formatTransferUOMAbbrev(item.uom_abbrev)}
          </Text>
        ) : (
          <MaterialCommunityIcons
            name="plus-circle-outline"
            size={26}
            color={colors.primary}
          />
        )}
      </View>
    </Pressable>
  );
};

const BatchTransferItemSelection = ({navigation, route}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const {keyword, setKeyword} = useSearchbarContext();
  const groupId = route.params?.groupId;
  // 'out' (default): current branch is source, picks its own items into
  // source_item_id. 'in': current branch is dest, picks its own items into
  // dest_item_id (source_item_id stays NULL until source resolves via
  // master_item_id when reviewing).
  const direction = route.params?.direction === 'in' ? 'in' : 'out';

  const [editing, setEditing] = useState(null);
  const [qtyText, setQtyText] = useState('');
  const [remarksText, setRemarksText] = useState('');
  // Transfer qty entry by unit / by the piece (non-'ea' items). `qtyText` is the
  // entered value in `unit`; it is converted to the item's base UOM on save (the
  // number `requested_qty` stores).
  const [unit, setUnit] = useState('');
  const [netWeight, setNetWeight] = useState('');
  const [showUnitDropDown, setShowUnitDropDown] = useState(false);
  const [debouncedKeyword, setDebouncedKeyword] = useState(keyword);

  useEffect(() => {
    return () => setKeyword('');
  }, [setKeyword]);

  // Debounce the keyword by 350ms so the query/filter only changes when the
  // user pauses typing. Driving the filter off every keystroke re-renders the
  // list mid-type, which steals focus and dismisses the keyboard. The Searchbar
  // value stays bound to `keyword` so input remains responsive.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedKeyword(keyword), 350);
    return () => clearTimeout(t);
  }, [keyword]);

  const filter = useMemo(
    () => ({
      'items.is_finished_product': 0,
      '%LIKE': {key: 'items.name', value: `'%${debouncedKeyword}%'`},
    }),
    [debouncedKeyword],
  );

  const {
    data,
    isFetching,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    status,
  } = useInfiniteQuery(['items', {filter}], getItems, {
    getNextPageParam: lastPage => {
      const pages = Math.ceil((lastPage?.totalCount || 0) / 10);
      return lastPage?.page < pages ? lastPage.page + 1 : undefined;
    },
  });

  const {data: entries = []} = useQuery(
    ['batchTransferEntries', {groupId}],
    getBatchTransferEntries,
    {enabled: !!groupId},
  );

  const entryByItemId = useMemo(() => {
    const map = {};
    // The current branch's picked items live in source_item_id for Out-mode
    // and dest_item_id for In-mode. We always look up by whichever side the
    // current branch owns so the "+ qty already added" badge renders.
    const idCol = direction === 'in' ? 'dest_item_id' : 'source_item_id';
    for (const e of entries) {
      if (e[idCol]) map[e[idCol]] = e;
    }
    return map;
  }, [entries, direction]);

  const items = useMemo(() => {
    const pages = data?.pages ?? [];
    return pages.flatMap(p => p.result || []);
  }, [data]);

  const saveEntryMutation = useMutation(createBatchTransferEntry, {
    onSuccess: () => {
      queryClient.invalidateQueries(['batchTransferEntries']);
      setEditing(null);
      setQtyText('');
      setRemarksText('');
      setUnit('');
      setNetWeight('');
    },
    onError: err =>
      ToastAndroid.show(err?.message || 'Failed to save.', ToastAndroid.LONG),
  });

  const openEditor = item => {
    setEditing(item);
    const existing = entryByItemId[item.id];
    setQtyText(existing ? String(parseFloat(existing.requested_qty)) : '');
    setUnit('');
    setNetWeight('');
    // Initiator's remark lives in source_remarks for Out, dest_remarks for In.
    const remarksCol = direction === 'in' ? 'dest_remarks' : 'source_remarks';
    setRemarksText(existing?.[remarksCol] || '');
  };

  // Unit picker state derived from the item currently being edited.
  const editIsNonEa = editing ? isNonEaItem(editing) : false;
  const showUnitPicker = editIsNonEa;
  const effectiveUnit = unit || editing?.uom_abbrev;
  const unitOptions = showUnitPicker ? nonEaStockUnitOptions(editing) : [];
  const needsNetWeight =
    showUnitPicker && pieceNeedsNetWeight(editing, effectiveUnit);
  const isPieceEntry = effectiveUnit === PIECE_UNIT;
  const previewBaseQty = showUnitPicker
    ? toBaseQty(
        editing,
        qtyText,
        effectiveUnit,
        needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
      )
    : NaN;
  const showBasePreview =
    showUnitPicker &&
    effectiveUnit !== editing?.uom_abbrev &&
    !needsNetWeight &&
    Number.isFinite(previewBaseQty) &&
    previewBaseQty > 0;

  const saveEntry = async () => {
    if (!editing) return;
    // Convert to the item's base UOM (what requested_qty stores). Persist the net
    // weight per piece first for a non-'ea' Piece entry the item hasn't got yet.
    let qtyToSave = qtyText;
    if (showUnitPicker) {
      if (needsNetWeight) {
        const nw = parseFloat(netWeight);
        if (!(nw > 0)) {
          ToastAndroid.show(
            'Enter the net weight per piece.',
            ToastAndroid.LONG,
          );
          return;
        }
        try {
          await setItemNetWeightPerPiece({itemId: editing.id, qtyPerPiece: nw});
        } catch (error) {
          ToastAndroid.show(
            error?.message || 'Could not save the net weight per piece.',
            ToastAndroid.LONG,
          );
          return;
        }
      }
      const baseQty = toBaseQty(
        editing,
        qtyText,
        effectiveUnit,
        needsNetWeight ? parseFloat(netWeight) || 0 : undefined,
      );
      if (!Number.isFinite(baseQty) || baseQty <= 0) {
        ToastAndroid.show('Enter a valid quantity.', ToastAndroid.LONG);
        return;
      }
      qtyToSave = String(baseQty);
    }
    saveEntryMutation.mutate({
      values: {
        groupId,
        direction,
        item: editing,
        qty: qtyToSave,
        remarks: remarksText || null,
      },
    });
  };

  const removeEntry = () => {
    if (!editing) return;
    saveEntryMutation.mutate({
      values: {
        groupId,
        direction,
        item: editing,
        qty: 0,
        remarks: null,
      },
    });
  };

  if (status === 'loading') {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
      </View>
    );
  }

  const entryCount = entries.length;

  return (
    <KeyboardAvoidingView
      style={{flex: 1}}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <View style={styles.searchRow}>
        <Searchbar
          placeholder="Search items"
          value={keyword}
          onChangeText={setKeyword}
          style={{flex: 1}}
        />
      </View>

      <FlatList
        data={items}
        keyExtractor={i => i.id}
        keyboardShouldPersistTaps="handled"
        renderItem={({item}) => (
          <ItemRow
            item={item}
            currentQty={entryByItemId[item.id]?.requested_qty}
            onPress={openEditor}
          />
        )}
        onEndReached={() => hasNextPage && fetchNextPage()}
        onEndReachedThreshold={0.5}
        refreshing={isFetching && !isFetchingNextPage}
        onRefresh={refetch}
        ListFooterComponent={
          isFetchingNextPage ? <ActivityIndicator style={{margin: 16}} /> : null
        }
      />

      <View style={[styles.footerBar, {backgroundColor: colors.surface}]}>
        <Text style={styles.footerCount}>
          {entryCount} item{entryCount === 1 ? '' : 's'} in batch
        </Text>
        <Button
          mode="contained"
          disabled={entryCount === 0}
          onPress={() =>
            navigation.navigate(routes.batchTransferRequestDetail(), {groupId})
          }>
          Review →
        </Button>
      </View>

      <Portal>
        <Dialog
          visible={!!editing}
          onDismiss={() => setEditing(null)}
          style={styles.dialog}>
          <Dialog.Title numberOfLines={1} style={styles.dialogTitle}>
            {editing?.name}
          </Dialog.Title>
          <Dialog.Content>
            <Text style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
              Current stock:{' '}
              {Number(editing?.current_stock_qty || 0).toFixed(2)}{' '}
              {formatTransferUOMAbbrev(editing?.uom_abbrev)}
            </Text>
            <TextInput
              mode="outlined"
              label={
                showUnitPicker
                  ? 'Transfer qty'
                  : `Transfer qty (${formatTransferUOMAbbrev(
                      editing?.uom_abbrev,
                    )})`
              }
              value={qtyText}
              onChangeText={setQtyText}
              keyboardType="decimal-pad"
              autoFocus
              style={styles.dialogInput}
            />
            {showUnitPicker ? (
              <Dropdown
                label={'Unit'}
                mode={'outlined'}
                visible={showUnitDropDown}
                showDropDown={() => setShowUnitDropDown(true)}
                onDismiss={() => setShowUnitDropDown(false)}
                value={effectiveUnit}
                hideMenuHeader
                onSelect={value => setUnit(value)}
                options={unitOptions}
              />
            ) : null}
            {needsNetWeight ? (
              <View style={styles.dialogInput}>
                <TextInput
                  mode="outlined"
                  label={`Item net weight — ${formatTransferUOMAbbrev(
                    editing?.uom_abbrev,
                  )} per piece`}
                  value={netWeight}
                  onChangeText={setNetWeight}
                  keyboardType="decimal-pad"
                  placeholder="e.g. 155"
                />
                <HelperText type="info" visible={true}>
                  Saved on the item so you can measure it by the piece from now
                  on.
                </HelperText>
              </View>
            ) : showBasePreview ? (
              <Text
                style={[styles.dialogHelper, {color: colors.neutralTint1}]}>
                {`= ${previewBaseQty} ${formatTransferUOMAbbrev(
                  editing?.uom_abbrev,
                )}`}
              </Text>
            ) : null}
            <TextInput
              mode="outlined"
              label="Remarks (optional)"
              value={remarksText}
              onChangeText={setRemarksText}
              multiline
              style={styles.dialogInput}
            />
          </Dialog.Content>
          <Dialog.Actions style={styles.dialogActions}>
            <Button
              onPress={removeEntry}
              color={colors.error}
              disabled={
                !entryByItemId[editing?.id] ||
                saveEntryMutation.isLoading
              }>
              Remove
            </Button>
            <View style={styles.dialogActionsRight}>
              <Button onPress={() => setEditing(null)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={saveEntry}
                loading={saveEntryMutation.isLoading}
                disabled={
                  !parseFloat(qtyText) ||
                  (needsNetWeight && !(parseFloat(netWeight) > 0)) ||
                  saveEntryMutation.isLoading
                }>
                Save
              </Button>
            </View>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  searchRow: {flexDirection: 'row', padding: 8},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#eee',
  },
  itemName: {fontSize: 15, fontWeight: '500'},
  itemMeta: {fontSize: 12, opacity: 0.65, marginTop: 2},
  rowRight: {marginLeft: 12},
  qtyBadge: {
    backgroundColor: '#1E88E5',
    color: 'white',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    fontSize: 12,
    overflow: 'hidden',
  },
  center: {flex: 1, alignItems: 'center', justifyContent: 'center'},
  footerBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#e0e0e0',
  },
  footerCount: {fontSize: 14, fontWeight: '500'},
  dialog: {borderRadius: 12, backgroundColor: 'white'},
  dialogTitle: {fontSize: 18},
  dialogHelper: {marginBottom: 14, fontSize: 13, lineHeight: 18},
  dialogInput: {marginBottom: 10, backgroundColor: 'white'},
  dialogActions: {
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingBottom: 8,
  },
  dialogActionsRight: {flexDirection: 'row'},
});

export default BatchTransferItemSelection;
