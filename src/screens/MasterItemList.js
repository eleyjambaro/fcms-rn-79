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
  TextInput,
  HelperText,
  useTheme,
} from 'react-native-paper';
import {useInfiniteQuery, useMutation, useQueryClient} from '@tanstack/react-query';
import {useFormik} from 'formik';
import * as Yup from 'yup';

import {
  getMasterItems,
  updateMasterItem,
  deleteMasterItem,
} from '../serverDbQueries/v2/masterItems';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import useCurrentUser from '../hooks/useCurrentUser';

const EditSchema = Yup.object({
  sku: Yup.string()
    .trim()
    .required('Required')
    .max(64, 'Too long')
    .matches(/^[A-Z0-9-]+$/i, 'Letters, digits, and dashes only'),
  description: Yup.string().nullable().max(500, 'Too long'),
});

const MasterItemList = () => {
  const {colors} = useTheme();
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

  const [editing, setEditing] = useState(null);
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

  const updateMutation = useMutation(updateMasterItem, {
    onSuccess: () => {
      queryClient.invalidateQueries(['masterItems']);
      setEditing(null);
    },
    onError: err => {
      const status = err?.response?.status;
      const message =
        err?.response?.data?.message ??
        (status === 409
          ? 'That SKU is already used by another master item.'
          : 'Failed to update master item.');
      setActionError(message);
    },
  });

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
                setEditing(mi);
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
        <Dialog visible={!!editing} onDismiss={() => setEditing(null)}>
          <Dialog.Title>Edit Master Item</Dialog.Title>
          {editing && (
            <EditMasterItemDialogContent
              key={editing.id}
              masterItem={editing}
              isSubmitting={updateMutation.isLoading}
              actionError={actionError}
              onCancel={() => setEditing(null)}
              onSubmit={values => {
                setActionError('');
                updateMutation.mutate({
                  id: editing.id,
                  sku: values.sku.trim().toUpperCase(),
                  description: values.description ?? '',
                });
              }}
            />
          )}
        </Dialog>
      </Portal>

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

const EditMasterItemDialogContent = ({
  masterItem,
  isSubmitting,
  actionError,
  onCancel,
  onSubmit,
}) => {
  const formik = useFormik({
    initialValues: {
      sku: masterItem?.sku ?? '',
      description: masterItem?.description ?? '',
    },
    validationSchema: EditSchema,
    onSubmit,
  });

  return (
    <>
      <Dialog.Content>
        <TextInput
          label="SKU"
          value={formik.values.sku}
          onChangeText={formik.handleChange('sku')}
          onBlur={formik.handleBlur('sku')}
          autoCapitalize="characters"
          error={!!(formik.touched.sku && formik.errors.sku)}
          style={styles.input}
        />
        <HelperText
          type={formik.touched.sku && formik.errors.sku ? 'error' : 'info'}
          visible>
          {formik.touched.sku && formik.errors.sku
            ? formik.errors.sku
            : 'Unique within this company.'}
        </HelperText>
        <TextInput
          label="Description"
          value={formik.values.description}
          onChangeText={formik.handleChange('description')}
          onBlur={formik.handleBlur('description')}
          multiline
          error={!!(formik.touched.description && formik.errors.description)}
          style={styles.input}
        />
        {actionError ? (
          <HelperText type="error" visible>
            {actionError}
          </HelperText>
        ) : null}
      </Dialog.Content>
      <Dialog.Actions>
        <Button onPress={onCancel}>Cancel</Button>
        <Button
          loading={isSubmitting}
          onPress={formik.handleSubmit}
          disabled={isSubmitting}>
          Save
        </Button>
      </Dialog.Actions>
    </>
  );
};

const MasterItemAccordion = ({masterItem, isRoot, onEdit, onDelete}) => {
  const {colors} = useTheme();
  const branchItems = masterItem?.branch_items ?? [];

  return (
    <List.Accordion
      title={
        <View>
          <Text style={styles.skuText}>{`SKU: ${masterItem.sku ?? ''}`}</Text>
          <Text style={styles.descriptionText} numberOfLines={2}>
            {masterItem.description ?? ''}
          </Text>
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
  rootActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    paddingHorizontal: 8,
  },
  input: {
    marginBottom: 4,
  },
});
