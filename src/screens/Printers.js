import React, {useState, useEffect} from 'react';
import {View, Text} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
  Card,
  ActivityIndicator,
} from 'react-native-paper';
import {useQuery, useQueryClient, useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import PrinterList from '../components/printers/PrinterList';
import PrinterForm from '../components/forms/PrinterForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import useSearchbarContext from '../hooks/useSearchbarContext';
import useDefaultPrinterContext from '../hooks/useDefaultPrinterContext';
import {createPrinter, getDefaultPrinter} from '../localDbQueries/printers';
import {ScrollView} from 'react-native-gesture-handler';

function Printers(props) {
  const {navigation, viewMode} = props;
  const {
    status: getDefaultPrinterStatus,
    data: getDefaultPrinterData,
    isRefetching,
    isLoading,
  } = useQuery(['defaultPrinter'], getDefaultPrinter);
  const {
    isLoading: isLoadingDefaultPrinter,
    bluetoothState,
    printerState,
    initializeAndConnectToPrinter,
    printTest,
    enableBluetoothDirectly,
  } = useDefaultPrinterContext();
  const [createPrinterModalVisible, setCreatePrinterModalVisible] =
    useState(false);
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const createPrinterMutation = useMutation(createPrinter, {
    onSuccess: () => {
      queryClient.invalidateQueries('printers');
    },
  });
  const {keyword, setKeyword} = useSearchbarContext();
  const {config} = useAppConfigContext();
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const onChangeSearch = keyword => setKeyword(keyword);

  useEffect(() => {
    return () => {
      setKeyword('');
    };
  }, []);

  const handleCancel = () => {
    setCreatePrinterModalVisible(() => false);
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createPrinterMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      setCreatePrinterModalVisible(() => false);
    }
  };

  const renderDefaultPrinter = () => {
    if (getDefaultPrinterStatus === 'loading') {
      return null;
    }

    if (getDefaultPrinterStatus === 'error') {
      return null;
    }

    const defaultPrinter = getDefaultPrinterData?.result;

    if (!defaultPrinter) {
      return null;
    }

    let primaryActionButton = null;

    if (bluetoothState === 'PoweredOff') {
      primaryActionButton = (
        <Button
          mode="outlined"
          loading={isLoadingDefaultPrinter}
          disabled={isLoadingDefaultPrinter}
          onPress={() => {
            enableBluetoothDirectly();
          }}>
          Enable Bluetooth
        </Button>
      );
    } else if (bluetoothState === 'PoweredOn' && printerState !== 'connected') {
      primaryActionButton = (
        <Button
          mode="outlined"
          loading={isLoadingDefaultPrinter}
          disabled={isLoadingDefaultPrinter}
          onPress={() => {
            initializeAndConnectToPrinter();
          }}>
          Connect
        </Button>
      );
    } else if (bluetoothState === 'PoweredOn' && printerState === 'connected') {
      primaryActionButton = (
        <Button
          mode="outlined"
          loading={isLoadingDefaultPrinter}
          disabled={isLoadingDefaultPrinter}
          onPress={() => {
            printTest();
          }}>
          Print test
        </Button>
      );
    }

    return (
      <Card style={{marginTop: 5, marginHorizontal: 5}}>
        <Card.Content>
          <View style={{flexDirection: 'row'}}>
            <View>
              <Text style={{fontWeight: 'bold'}}>Default Printer</Text>
              <Text
                style={{
                  fontWeight: 'bold',
                  color: colors.dark,
                  marginTop: 10,
                }}>
                {`${defaultPrinter?.display_name} (${defaultPrinter.device_name})`}
              </Text>
            </View>
            {isRefetching && (
              <ActivityIndicator size={'small'} style={{marginLeft: 'auto'}} />
            )}
          </View>

          <View style={{marginTop: 20}}>{primaryActionButton}</View>
        </Card.Content>
      </Card>
    );
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createPrinterModalVisible}
          onDismiss={() => setCreatePrinterModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Printer
          </Title>
          <ScrollView showsVerticalScrollIndicator={false}>
            <PrinterForm onSubmit={handleSubmit} onCancel={handleCancel} />
          </ScrollView>
        </Modal>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <View style={{flex: 1}}>
        {renderDefaultPrinter()}

        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search printer"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <PrinterList
            defaultPrinter={getDefaultPrinterData?.result}
            viewMode={viewMode}
            filter={{
              '%LIKE': {key: 'display_name', value: `'%${keyword}%'`},
            }}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button
            mode="contained"
            icon="plus"
            onPress={() => {
              // setCreatePrinterModalVisible(() => true);
              navigation.navigate(routes.createPrinter());
            }}>
            Create Printer
          </Button>
        </View>
      </View>
    </>
  );
}

export default Printers;
