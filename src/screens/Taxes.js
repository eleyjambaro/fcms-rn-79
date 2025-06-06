import React, {useState, useEffect} from 'react';
import {View} from 'react-native';
import {
  Button,
  Modal,
  Title,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import routes from '../constants/routes';
import TaxList from '../components/taxes/TaxList';
import TaxForm from '../components/forms/TaxForm';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import useAppConfigContext from '../hooks/useAppConfigContext';
import useSearchbarContext from '../hooks/useSearchbarContext';
import {createTax} from '../localDbQueries/taxes';

function Taxes(props) {
  const {navigation, viewMode} = props;
  const [createTaxModalVisible, setCreateTaxModalVisible] = useState(false);
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const createTaxMutation = useMutation(createTax, {
    onSuccess: () => {
      queryClient.invalidateQueries('taxes');
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

  const showCreateTaxModal = () => setCreateTaxModalVisible(true);
  const hideCreateTaxModal = () => setCreateTaxModalVisible(false);

  const handleCancel = () => {
    hideCreateTaxModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createTaxMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateTaxModal();
    }
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createTaxModalVisible}
          onDismiss={() => setCreateTaxModalVisible(() => false)}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Tax
          </Title>
          <TaxForm onSubmit={handleSubmit} onCancel={handleCancel} />
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
        <View style={{flexDirection: 'row', padding: 5}}>
          <Searchbar
            placeholder="Search tax"
            onChangeText={onChangeSearch}
            value={keyword}
            style={{flex: 1}}
          />
        </View>

        <View style={{flex: 1}}>
          <TaxList
            viewMode={viewMode}
            filter={{'%LIKE': {key: 'name', value: `'%${keyword}%'`}}}
          />
        </View>

        <View
          style={{
            backgroundColor: 'white',
            padding: 10,
          }}>
          <Button mode="contained" icon="plus" onPress={showCreateTaxModal}>
            Create Tax
          </Button>
        </View>
      </View>
    </>
  );
}

export default Taxes;
