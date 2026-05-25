import React, {useMemo, useState} from 'react';
import {StyleSheet, View, FlatList, RefreshControl} from 'react-native';
import {
  List,
  Text,
  Searchbar,
  ActivityIndicator,
  Divider,
  IconButton,
  Button,
  Dialog,
  Portal,
  Paragraph,
  HelperText,
  useTheme,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {
  getMasterItems,
  deleteMasterItem,
} from '../serverDbQueries/v2/masterItems';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useCurrentUser from '../hooks/useCurrentUser';
import routes from '../constants/routes';

const formatVariantSummary = mi => {
  if (!mi) return '';
  const parts = [];
  if (mi.uom_abbrev) parts.push(mi.uom_abbrev);
  if (mi.qty_per_piece != null && mi.qty_per_piece !== '' && mi.uom_abbrev_per_piece) {
    parts.push(`${mi.qty_per_piece} ${mi.uom_abbrev_per_piece}`);
  }
  if (mi.packaging_type) parts.push(mi.packaging_type);
  return parts.join(' · ');
};

const MasterItemList = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const [{authUser}] = useCurrentUser();
  const isRoot = !!authUser?.is_root_account;

  const [searchInput, setSearchInput] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce the search input by 300ms so we don't issue a request on every
  // keystroke. The local input state stays responsive while the React Query
  // key only flips when the user pauses typing.
  React.useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(searchInput.trim()), 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  const [deleting, setDeleting] = useState(null);
  const [actionError, setActionError] = useState('');

  const {
    data,
    isLoading,
    isError,
    refetch,
    isRefetching,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    error,
  } = useInfiniteQuery(
    ['masterItems', {q: debouncedQuery, perPage: 20}],
    getMasterItems,
    {
      getNextPageParam: lastPage => {
        const {current_page, total_pages} = lastPage?.pagination ?? {};
        if (!current_page || !total_pages) return undefined;
        return current_page < total_pages ? current_page + 1 : undefined;
      },
    },
  );

  const deleteMutation = useMutation(deleteMasterItem, {
    onSuccess: () => {
      queryClient.invalidateQueries(['masterItems']);
      setDeleting(null);
    },
    onError: err => {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ??
        (status === 409
          ? 'Branch items still reference this master entry.'
          : 'Failed to delete master item.');
      setActionError(message);
    },
  });

  const items = useMemo(() => {
    if (!data?.pages) return [];
    return data.pages.flatMap(p => p?.data ?? []);
  }, [data]);

  if (isError) {
    return <DefaultErrorScreen errorMessage={error?.message} />;
  }

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <Searchbar
        placeholder="Search SKU or description"
        value={searchInput}
        onChangeText={setSearchInput}
        style={styles.searchbar}
      />

      {isLoading ? (
        <View style={styles.loadingState}>
          <ActivityIndicator animating color={colors.primary} />
        </View>
      ) : items.length === 0 ? (
        <View style={styles.emptyState}>
          <Text variant="titleMedium" style={{color: colors.neutralTint3}}>
            {debouncedQuery
              ? 'No master items match your search.'
              : 'No master items yet. Register a new item to populate this list.'}
          </Text>
        </View>
      ) : (
        <FlatList
          data={items}
          keyExtractor={mi => mi.sync_id ?? mi.id}
          renderItem={({item: mi}) => (
            <MasterItemAccordion
              masterItem={mi}
              isRoot={isRoot}
              onEdit={() => {
                setActionError('');
                navigation.navigate(routes.editMasterItem(), {master: mi});
              }}
              onDelete={() => {
                setActionError('');
                setDeleting(mi);
              }}
            />
          )}
          ItemSeparatorComponent={Divider}
          onEndReached={() => {
            if (hasNextPage && !isFetchingNextPage) fetchNextPage();
          }}
          onEndReachedThreshold={0.4}
          refreshControl={
            <RefreshControl
              refreshing={isRefetching && !isFetchingNextPage}
              onRefresh={refetch}
              colors={[colors.primary]}
            />
          }
          ListFooterComponent={
            isFetchingNextPage ? (
              <View style={{padding: 16}}>
                <ActivityIndicator animating color={colors.primary} />
              </View>
            ) : null
          }
        />
      )}

      <Portal>
        <Dialog visible={!!deleting} onDismiss={() => setDeleting(null)}>
          <Dialog.Title>Delete Master Item</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              {`Delete master item ${deleting?.sku ?? ''}? This is a soft-delete and the entry will disappear from this list. Branch items that reference this SKU must be removed or reassigned first.`}
            </Paragraph>
            {actionError ? (
              <HelperText type="error" visible>
                {actionError}
              </HelperText>
            ) : null}
          </Dialog.Content>
          <Dialog.Actions>
            <Button onPress={() => setDeleting(null)}>Cancel</Button>
            <Button
              loading={deleteMutation.isLoading}
              onPress={() => deleteMutation.mutate(deleting.id)}
              textColor={colors.error}>
              Delete
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
    </View>
  );
};

const MasterItemAccordion = ({masterItem, isRoot, onEdit, onDelete}) => {
  const {colors} = useTheme();
  const branchItems = masterItem?.branch_items ?? [];
  const variantSummary = formatVariantSummary(masterItem);

  return (
    <List.Accordion
      title={
        <View>
          <Text style={styles.skuText}>{`SKU: ${masterItem.sku ?? ''}`}</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>
            {masterItem.description ?? ''}
          </Text>
          {variantSummary ? (
            <Text style={styles.variantText} numberOfLines={1}>
              {variantSummary}
            </Text>
          ) : null}
        </View>
      }
      titleStyle={{color: colors.dark}}
      style={{backgroundColor: colors.surface}}>
      {isRoot ? (
        <View style={styles.rootActions}>
          <IconButton
            icon="pencil-outline"
            size={20}
            onPress={onEdit}
            accessibilityLabel="Edit master item"
          />
          <IconButton
            icon="trash-can-outline"
            size={20}
            iconColor={colors.error}
            onPress={onDelete}
            accessibilityLabel="Delete master item"
          />
        </View>
      ) : null}
      {branchItems.length === 0 ? (
        <List.Item
          title={<Text style={{fontStyle: 'italic'}}>No branch items</Text>}
        />
      ) : (
        branchItems.map(bi => (
          <List.Item
            key={bi.sync_id}
            title={bi.name}
            description={bi.branch_display_name || bi.branch_name || ''}
            left={() => <List.Icon icon="source-branch" />}
          />
        ))
      )}
    </List.Accordion>
  );
};

export default MasterItemList;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  searchbar: {
    margin: 12,
    elevation: 0,
  },
  loadingState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  skuText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  descriptionText: {
    fontSize: 13,
    marginTop: 2,
  },
  variantText: {
    fontSize: 12,
    marginTop: 2,
    fontStyle: 'italic',
    opacity: 0.7,
  },
  rootActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
});
