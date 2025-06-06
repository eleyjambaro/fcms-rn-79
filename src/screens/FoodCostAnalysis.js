import React, {useState} from 'react';
import {StyleSheet, Text, Pressable, View} from 'react-native';
import {
  FAB,
  Button,
  Modal,
  Title,
  TextInput,
  Portal,
  Searchbar,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import {createMaterialTopTabNavigator} from '@react-navigation/material-top-tabs';
import {useQueryClient, useMutation} from '@tanstack/react-query';
import {Tabs, TabScreen} from 'react-native-paper-tabs';

import routes from '../constants/routes';
import RevenueGroupList from '../components/foodCostAnalysis/RevenueGroupList';
import ExpenseGroupList from '../components/foodCostAnalysis/ExpenseGroupList';
import RevenueGroupForm from '../components/forms/RevenueGroupForm';
import ExpenseGroupForm from '../components/forms/ExpenseGroupForm';
import MonthPickerModal from '../components/modals/MonthPickerModal';
import TestModeLimitModal from '../components/modals/TestModeLimitModal';
import {createRevenue, createRevenueGroup} from '../localDbQueries/revenues';
import {createExpenseGroup} from '../localDbQueries/expenses';
import CurrentMonthYearHeading from '../components/foodCostAnalysis/CurrentMonthYearHeading';
import {useNavigation} from '@react-navigation/native';
import ErrorMessageModal from '../components/modals/ErrorMessageModal';

const TopTab = createMaterialTopTabNavigator();

function RevenueGroups(props) {
  const {dateFilter, highlightedItemId} = props;
  const [createRevenueGroupModalVisible, setCreateRevenueGroupModalVisible] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const {colors} = useTheme();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const createRevenueGroupMutation = useMutation(createRevenueGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('revenueGroups');
    },
  });
  const [formErrorMessage, setFormErrorMessage] = useState('');
  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const onChangeSearch = query => setSearchQuery(query);

  const showCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(true);
  const hideCreateRevenueGroupModal = () =>
    setCreateRevenueGroupModalVisible(false);

  const handleCancel = () => {
    hideCreateRevenueGroupModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createRevenueGroupMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
        onFormValidationError: ({errorMessage}) => {
          setFormErrorMessage(() => errorMessage);
        },
      });
    } catch (error) {
      console.debug(error);
      return;
    } finally {
      actions.resetForm();
    }

    hideCreateRevenueGroupModal();
  };

  const handlePressCreate = () => {
    showCreateRevenueGroupModal();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createRevenueGroupModalVisible}
          onDismiss={hideCreateRevenueGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Revenue Group
          </Title>
          <RevenueGroupForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
            onDismiss={hideCreateRevenueGroupModal}
          />
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
      <ErrorMessageModal
        textContent={`${formErrorMessage}`}
        visible={formErrorMessage}
        onDismiss={() => {
          setFormErrorMessage(() => '');
        }}
      />
      <View style={{flex: 1}}>
        <View style={{flex: 1}}>
          <RevenueGroupList
            dateFilter={dateFilter}
            highlightedItemId={highlightedItemId}
          />
        </View>
      </View>
    </>
  );
}

function ExpenseGroups(props) {
  const {navigation, dateFilter} = props;
  const [createExpenseGroupModalVisible, setCreateExpenseGroupModalVisible] =
    useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const createExpenseGroupMutation = useMutation(createExpenseGroup, {
    onSuccess: () => {
      queryClient.invalidateQueries('expenseGroups');
    },
  });

  const [limitReachedMessage, setLimitReachedMessage] = useState('');

  const onChangeSearch = query => setSearchQuery(query);

  const showCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(true);
  const hideCreateExpenseGroupModal = () =>
    setCreateExpenseGroupModalVisible(false);

  const handleCancel = () => {
    hideCreateExpenseGroupModal();
  };

  const handleSubmit = async (values, actions) => {
    console.log(values);
    try {
      await createExpenseGroupMutation.mutateAsync({
        values,
        onInsertLimitReached: ({message}) => {
          setLimitReachedMessage(() => message);
        },
      });
    } catch (error) {
      console.debug(error);
    } finally {
      actions.resetForm();
      hideCreateExpenseGroupModal();
    }
  };

  const handlePressCreate = () => {
    showCreateExpenseGroupModal();
  };

  return (
    <>
      <Portal>
        <Modal
          visible={createExpenseGroupModalVisible}
          onDismiss={hideCreateExpenseGroupModal}
          contentContainerStyle={{backgroundColor: 'white', padding: 20}}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create Expense Group
          </Title>
          <ExpenseGroupForm onSubmit={handleSubmit} onCancel={handleCancel} />
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
        <View style={{flex: 1}}>
          <ExpenseGroupList dateFilter={dateFilter} />
        </View>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    margin: 16,
    right: 0,
    bottom: 0,
  },
});

const FoodCostAnalysisTabs = props => {
  const {route} = props;
  const {colors} = useTheme();
  const [dateString, setDateString] = useState('');
  const [date, setDate] = useState(new Date());

  const revenueGroupHighlightedItemId =
    route?.params?.revenue_group_highlighted_item_id;
  const expenseGroupHighlightedItemId =
    route?.params?.expense_group_highlighted_item_id;

  const handleDateChange = (datetimeString, date) => {
    setDateString(() => datetimeString);
    setDate(() => date);
  };

  return (
    <>
      <MonthPickerModal value={dateString} onChange={handleDateChange} />
      <CurrentMonthYearHeading date={date} />
      <Tabs
        // defaultIndex={0} // default = 0
        uppercase={false} // true/false | default=true | labels are uppercase
        // showTextLabel={false} // true/false | default=false (KEEP PROVIDING LABEL WE USE IT AS KEY INTERNALLY + SCREEN READERS)
        // iconPosition // leading, top | default=leading
        style={{
          backgroundColor: colors.surface,
          borderBottomWidth: 2,
          borderBottomColor: colors.neutralTint5,
        }} // works the same as AppBar in react-native-paper
        // dark={false} // works the same as AppBar in react-native-paper
        // theme={} // works the same as AppBar in react-native-paper
        // mode="scrollable" // fixed, scrollable | default=fixed
        // onChangeIndex={(newIndex) => {}} // react on index change
        // showLeadingSpace={true} //  (default=true) show leading space in scrollable tabs inside the header
        // disableSwipe={false} // (default=false) disable swipe to left/right gestures
      >
        <TabScreen label="Revenue Groups">
          <RevenueGroups
            dateFilter={dateString}
            highlightedItemId={revenueGroupHighlightedItemId}
          />
        </TabScreen>
        <TabScreen label="Expense Groups">
          <ExpenseGroups
            dateFilter={dateString}
            highlightedItemId={expenseGroupHighlightedItemId}
          />
        </TabScreen>
      </Tabs>
    </>
  );
};

export default FoodCostAnalysisTabs;
