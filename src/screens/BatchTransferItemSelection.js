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
  ActivityIndicator,
  useTheme,
} from 'react-native-paper';
import {useInfiniteQuery, useMutation, useQuery, useQueryClient} from '@tanstack/react-query';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import {getItems} from '../localDbQueries/items';
import {
  getBatchTransferEntries,
  createBatchTransferEntry,
} from '../localDbQueries/batchTransfer';
import useSearchbarContext from '../hooks/useSearchbarContext';

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
          {item.uom_abbrev || ''}
        </Text>
      </View>
      <View style={styles.rowRight}>
        {hasQty ? (
          <Text style={styles.qtyBadge}>
            {parseFloat(currentQty)} {item.uom_abbrev || ''}
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

  const [editing, setEditing] = useState(null);
  const [qtyText, setQtyText] = useState('');
  const [remarksText, setRemarksText] = useState('');

  useEffect(() => {
    return () => setKeyword('');
  }, [setKeyword]);

  const filter = useMemo(
    () => ({
      'items.is_finished_product': 0,
      '%LIKE': {key: 'items.name', value: `'%${keyword}%'`},
    }),
    [keyword],
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
    for (const e of entries) {
      if (e.source_item_id) map[e.source_item_id] = e;
    }
    return map;
  }, [entries]);

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
    },
    onError: err =>
      ToastAndroid.show(err?.message || 'Failed to save.', ToastAndroid.LONG),
  });

  const openEditor = item => {
    setEditing(item);
    const existing = entryByItemId[item.id];
    setQtyText(existing ? String(parseFloat(existing.requested_qty)) : '');
    setRemarksText(existing?.source_remarks || '');
  };

  const saveEntry = () => {
    if (!editing) return;
    saveEntryMutation.mutate({
      values: {
        groupId,
        sourceItem: editing,
        qty: qtyText,
        sourceRemarks: remarksText || null,
      },
    });
  };

  const removeEntry = () => {
    if (!editing) return;
    saveEntryMutation.mutate({
      values: {
        groupId,
        sourceItem: editing,
        qty: 0,
        sourceRemarks: null,
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
          onDismiss={() => setEditing(null)}>
          <Dialog.Title numberOfLines={1}>{editing?.name}</Dialog.Title>
          <Dialog.Content>
            <Text style={{marginBottom: 8, opacity: 0.7}}>
              Current stock:{' '}
              {Number(editing?.current_stock_qty || 0).toFixed(2)}{' '}
              {editing?.uom_abbrev || ''}
            </Text>
            <TextInput
              label={`Transfer qty (${editing?.uom_abbrev || ''})`}
              value={qtyText}
              onChangeText={setQtyText}
              keyboardType="decimal-pad"
              dense
              autoFocus
              style={{marginBottom: 8}}
            />
            <TextInput
              label="Remarks (optional)"
              value={remarksText}
              onChangeText={setRemarksText}
              dense
              multiline
            />
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-between'}}>
            <Button
              onPress={removeEntry}
              color={colors.error}
              disabled={
                !entryByItemId[editing?.id] ||
                saveEntryMutation.isLoading
              }>
              Remove
            </Button>
            <View style={{flexDirection: 'row'}}>
              <Button onPress={() => setEditing(null)}>Cancel</Button>
              <Button
                mode="contained"
                onPress={saveEntry}
                loading={saveEntryMutation.isLoading}
                disabled={!parseFloat(qtyText) || saveEntryMutation.isLoading}>
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
});

export default BatchTransferItemSelection;
