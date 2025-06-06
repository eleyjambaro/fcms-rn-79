import React, {useState, useRef, useMemo, useCallback, useEffect} from 'react';
import {Link, useNavigation, useRoute} from '@react-navigation/native';
import {
  StyleSheet,
  Text,
  View,
  ScrollView,
  FlatList,
  Dimensions,
  Pressable,
  RefreshControl,
  PermissionsAndroid,
  ToastAndroid,
  BackHandler,
  Linking,
  Platform,
} from 'react-native';
import {
  Button,
  useTheme,
  DataTable,
  Modal,
  Portal,
  Title,
  Dialog,
  Paragraph,
  Subheading,
  Headline,
} from 'react-native-paper';
import {
  BottomSheetModal,
  BottomSheetBackdrop,
  BottomSheetView,
} from '@gorhom/bottom-sheet';

import routes from '../../constants/routes';
import OptionsList from '../buttons/OptionsList';
import SalesRegisterHeaderRight from '../headers/SalesRegisterHeaderRight';
import useSalesCounterContext from '../../hooks/useSalesCounterContext';

const RecipeReportFileExport = props => {
  const {backAction} = props;
  const {colors} = useTheme();
  const route = useRoute();
  const navigation = useNavigation();

  const [_state, actions] = useSalesCounterContext();

  const [
    confirmClearSaleEntriesDialogVisible,
    setConfirmClearSaleEntriesDialogVisible,
  ] = useState(false);

  useEffect(() => {
    // Use `setOptions` to update the SalesRegisterHeaderRight component
    navigation.setOptions({
      headerRight: () => (
        <SalesRegisterHeaderRight onPressMenuButton={openOptionsBottomSheet} />
      ),
    });
  }, [navigation]);

  const options = [
    {
      label: 'Clear sale entries',
      icon: 'delete-forever',
      labelColor: colors.notification,
      iconColor: colors.notification,
      handler: () => {
        setConfirmClearSaleEntriesDialogVisible(() => true);
      },
    },
  ];

  useEffect(() => {
    const backHandler = BackHandler.addEventListener(
      'hardwareBackPress',
      () => {
        backAction && backAction();
        closeOptionsBottomSheet();
      },
    );

    return () => backHandler.remove();
  }, []);

  const optionsBottomSheetModalRef = useRef(null);
  const optionsBottomSheetSnapPoints = useMemo(
    () => [120, options.length * 100 + 35],
    [],
  );

  const openOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.present();
  };

  const closeOptionsBottomSheet = () => {
    optionsBottomSheetModalRef.current?.dismiss();
  };

  const handleBottomSheetChange = useCallback(_index => {
    // Do something on Bottom sheet index change
  }, []);

  const handleOnPressClearSaleEntries = () => {
    setConfirmClearSaleEntriesDialogVisible(() => false);
    actions?.resetSalesCounter();
    closeOptionsBottomSheet();
  };

  const renderBottomSheetBackdrop = useCallback(
    props => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={1}
      />
    ),
    [],
  );

  const renderOptions = () => {
    return (
      <BottomSheetView style={styles.bottomSheetContent}>
        <Text
          style={{
            marginBottom: 15,
            fontSize: 16,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {'Options'}
        </Text>
        <OptionsList options={options} />
      </BottomSheetView>
    );
  };

  return (
    <>
      <Portal>
        <Dialog
          visible={confirmClearSaleEntriesDialogVisible}
          onDismiss={() => {
            setConfirmClearSaleEntriesDialogVisible(() => false);
            closeOptionsBottomSheet();
          }}>
          <Dialog.Title>Clear sale entries</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{`Are you sure you want to clear all your current entries and begin again?`}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                handleOnPressClearSaleEntries();
              }}
              icon="delete-forever"
              color={colors.notification}>
              {'Clear'}
            </Button>
            <Button
              onPress={() => {
                setConfirmClearSaleEntriesDialogVisible(() => false);
                closeOptionsBottomSheet();
              }}
              color={colors.primary}>
              {'Cancel'}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>

      <BottomSheetModal
        ref={optionsBottomSheetModalRef}
        index={1}
        snapPoints={optionsBottomSheetSnapPoints}
        backdropComponent={renderBottomSheetBackdrop}
        onChange={handleBottomSheetChange}>
        {renderOptions()}
      </BottomSheetModal>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  appSuggestionsContainer: {
    marginTop: 5,
  },
  appSuggestionsItem: {
    flexDirection: 'row',
    paddingVertical: 10,
  },
  bottomSheetContent: {
    flex: 1,
    backgroundColor: 'white',
    paddingTop: 5,
    padding: 16,
    zIndex: 10,
  },
});

export default RecipeReportFileExport;
