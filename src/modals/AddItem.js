import React, {useState} from 'react';
import {StyleSheet, ScrollView, Alert} from 'react-native';
import {Button, useTheme, Paragraph, Dialog, Portal} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQueryClient, useMutation} from '@tanstack/react-query';

import ItemForm from '../components/forms/ItemForm';
import {registerItem} from '../localDbQueries/items';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import routes from '../constants/routes';

const AddItem = () => {
  const {colors} = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const queryClient = useQueryClient();
  const registerItemMutation = useMutation(registerItem, {
    onSuccess: () => {
      queryClient.invalidateQueries('items');
    },
  });
  const [limitReachedMessage, setLimitReachedMessage] = useState('');
  const [successDialogVisible, setSuccessDialogVisible] = useState(false);
  const [regiteredItemId, setRegiteredItemId] = useState(null);

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await registerItemMutation.mutateAsync({
        item: values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onSuccess: ({itemId}) => {
          setRegiteredItemId(() => itemId);
          setSuccessDialogVisible(() => true);
          actions.resetForm();
        },
      });
    } catch (error) {
      console.debug(error);
    }
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      <Portal>
        <Dialog
          visible={successDialogVisible}
          onDismiss={() => {
            setSuccessDialogVisible(() => false);
            navigation.goBack();
          }}>
          <Dialog.Title>Done!</Dialog.Title>
          <Dialog.Content>
            <Paragraph>
              Item successfully registered in the inventory.
            </Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                setSuccessDialogVisible(() => false);
              }}>
              Register more
            </Button>
            <Button
              onPress={() => {
                if (regiteredItemId) {
                  setSuccessDialogVisible(() => false);
                  navigation.pop();
                  navigation.navigate(routes.itemView(), {
                    item_id: regiteredItemId,
                  });
                }
              }}
              color={colors.dark}>
              View item
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <TestModeLimitModal
        title="Limit Reached"
        textContent={limitReachedMessage}
        visible={limitReachedMessage ? true : false}
        onDismiss={() => {
          setLimitReachedMessage(() => '');
        }}
      />
      <ItemForm
        onSubmit={handleSubmit}
        initialValues={
          route.params?.category_id && {
            category_id: route.params.category_id?.toString(),
          }
        }
      />
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'white',
    padding: 7,
  },
  surface: {
    padding: 8,
    height: 80,
    width: 80,
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
  },
});

export default AddItem;
