import React from 'react';
import {Pressable, ToastAndroid, View} from 'react-native';
import {useTheme} from 'react-native-paper';
import {createStackNavigator} from '@react-navigation/stack';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';
import MainTab from '../tabs/MainTab';
import Items from '../screens/Items';
import AddItem from '../modals/AddItem';
import ItemCategory from '../modals/ItemCategory';
import CategoryView from '../modals/CategoryView';
import ItemUOM from '../modals/ItemUOM';
import AddItemUOM from '../modals/AddItemUOM';
import ConfirmPurchases from '../modals/ConfirmPurchases';
import EditItem from '../modals/EditItem';
import ItemView from '../modals/ItemView';
import ItemSizeOptions from '../modals/ItemSizeOptions';
import ScanBarcode from '../modals/ScanBarcode';
import ManageStock from '../modals/ManageStock';
import PurchaseListHistory from '../modals/PurchaseListHistory';
import PurchaseListHistoryView from '../modals/PurchaseListHistoryView';
import PurchaseEntryList from '../screens/PurchaseEntryList';
import StockUsageEntryList from '../screens/StockUsageEntryList';
import ConfirmStockUsage from '../modals/ConfirmStockUsage';
import StockUsageHistory from '../modals/StockUsageHistory';
import StockUsageHistoryView from '../modals/StockUsageHistoryView';
import ItemPurchaseEntries from '../modals/ItemPurchaseEntries';

import Recipes, {ServingRecipes} from '../screens/Recipes';
import RecipeView from '../modals/RecipeView';
import CreateRecipe from '../modals/CreateRecipe';
import RecipeKind from '../modals/RecipeKind';
import CreateSubRecipe from '../modals/CreateSubRecipe';
import SelectRecipeIngredient from '../modals/SelectRecipeIngredient';

import Purchases from '../screens/Purchases';
import PurchaseCategoryView from '../modals/PurchaseCategoryView';
import Revenues from '../screens/Revenues';
import Reports from '../screens/Reports';
import FoodMenuMix from '../screens/FoodMenuMix';
import FoodCostAnalysis from '../screens/FoodCostAnalysis';
import ProfitAndLoss from '../screens/ProfitAndLoss';
import FoodVariance from '../screens/FoodVariance';
import BeverageVariance from '../screens/BeverageVariance';
import Account from '../screens/Account';
import DeleteMyAccount from '../screens/DeleteMyAccount';
import {useNavigation} from '@react-navigation/native';
import Logs from '../screens/Logs';
import LogView from '../screens/LogView';
import UpdateInventoryLog from '../modals/UpdateInventoryLog';
import Expenses from '../screens/Expenses';
import ExpenseView from '../screens/ExpenseView';
import AddExpense from '../screens/AddExpense';
import ExpenseGroup from '../screens/ExpenseGroup';
import ItemsTab from '../tabs/ItemsTab';
import EditRecipe from '../modals/EditRecipe';
import ManageRevenueGroups from '../screens/ManageRevenueGroups';
import ManageExpenseGroups from '../screens/ManageExpenseGroups';
import ManageMonthlyExpenses from '../screens/ManageMonthlyExpenses';
import Categories from '../screens/Categories';
import MonthlyReportByItem from '../screens/MonthlyReportByItem';
import MonthlyReportByCategory from '../screens/MonthlyReportByCategory';
import MonthlyReportHeaderRight from '../components/headers/MonthlyReportHeaderRight';
import CustomReportByItem from '../screens/CustomReportByItem';
import CustomReportByCategory from '../screens/CustomReportByCategory';
import ItemReportView from '../screens/ItemReportView';
import Taxes from '../screens/Taxes';
import ItemTax from '../modals/ItemTax';
import ItemVendor from '../modals/ItemVendor';
import EndingInventory from '../screens/EndingInventory';
import ItemAddedStocks from '../screens/ItemAddedStocks';
import Vendors from '../screens/Vendors';
import UpdateCompany from '../screens/UpdateCompany';
import Currencies from '../screens/Currencies';
import ActivateLicense from '../screens/ActivateLicense';
import Spoilage from '../screens/Spoilage';
import SelectSpoilageItem from '../modals/SelectSpoilageItem';
import LocalUserAccounts from '../screens/LocalUserAccounts';
import UnauthorizedAccount from '../screens/UnauthorizedAccount';
import ProduceFinishedProductStock from '../modals/ProduceFinishedProductStock';
import Counter from '../screens/Counter';
import SalesCounterItemsTab from '../tabs/SalesCounterItemsTab';
import ConfirmSales from '../modals/ConfirmSales';
import SalesInvoices from '../screens/SalesInvoices';
import SalesInvoiceView from '../modals/SalesInvoiceView';
import SalesOrders from '../screens/SalesOrders';
import SalesOrderGroupView from '../modals/SalesOrderGroupView';
import CloudAccountMainTab from '../tabs/CloudAccountMainTab';
import PaymentMethod from '../screens/PaymentMethod';
import SplitPayment from '../screens/SplitPayment';
import Printers from '../screens/Printers';
import CreatePrinter from '../screens/CreatePrinter';

const Stack = createStackNavigator();

const RootStack = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();

  return (
    <Stack.Navigator screenOptions={{headerShown: false}}>
      <Stack.Group>
        <Stack.Screen name={routes.mainTab()} component={MainTab} />
      </Stack.Group>
      <Stack.Group>
        <Stack.Screen
          name={routes.cloudMainTab()}
          component={CloudAccountMainTab}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{headerShown: true}}>
        <Stack.Screen
          name={routes.recipes()}
          component={ServingRecipes}
          options={{headerTitle: 'Recipes'}}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{presentation: 'modal', headerShown: true}}>
        <Stack.Screen
          name={routes.activateLicense()}
          component={ActivateLicense}
          options={{headerTitle: 'Activate License'}}
        />
        <Stack.Screen
          name={routes.updateCompany()}
          component={UpdateCompany}
          options={{headerTitle: 'Update Company'}}
        />
        <Stack.Screen
          name={routes.account()}
          component={Account}
          options={{headerTitle: 'Account'}}
        />
        <Stack.Screen
          name={routes.localUserAccounts()}
          options={{headerTitle: 'Manage Users'}}>
          {props => {
            return <LocalUserAccounts {...props} viewMode="manage-users" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.deleteMyAccount()}
          component={DeleteMyAccount}
          options={{headerTitle: 'Delete Account'}}></Stack.Screen>
        <Stack.Screen
          name={routes.createRecipe()}
          component={CreateRecipe}
          options={{headerTitle: 'Create Recipe'}}
        />
        <Stack.Screen
          name={routes.editRecipe()}
          component={EditRecipe}
          options={{headerTitle: 'Edit Recipe'}}
        />
        <Stack.Screen
          name={routes.recipeView()}
          component={RecipeView}
          options={{headerTitle: 'Recipe'}}
        />
        <Stack.Screen
          name={routes.recipeKind()}
          component={RecipeKind}
          options={{headerTitle: 'Recipe Kind'}}
        />
        <Stack.Screen
          name={routes.createSubRecipe()}
          component={CreateSubRecipe}
          options={{headerTitle: 'Create Sub Recipe'}}
        />
        <Stack.Screen
          name={routes.selectRecipeIngredient()}
          component={SelectRecipeIngredient}
          options={{headerTitle: 'Select Recipe Ingredient'}}
        />
        <Stack.Screen
          name={routes.produceFinishedProductStock()}
          component={ProduceFinishedProductStock}
          options={{headerTitle: 'Add Finished Product Yield'}}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{presentation: 'modal', headerShown: true}}>
        <Stack.Screen
          name={routes.currencies()}
          component={Currencies}
          options={{headerTitle: 'Select Currency'}}
        />
        <Stack.Screen
          name={routes.vendors()}
          options={{headerTitle: 'Vendors'}}>
          {props => {
            return <Vendors {...props} viewMode="list" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.spoilage()}
          component={Spoilage}
          options={{headerTitle: 'Spoilage / Wastage'}}
        />
        <Stack.Screen
          name={routes.selectSpoilageItem()}
          component={SelectSpoilageItem}
          options={{headerTitle: 'Select Spoilage Item'}}
        />

        <Stack.Screen
          name={routes.items()}
          options={{headerTitle: 'Inventory'}}>
          {props => (
            <ItemsTab {...props} listItemDisplayMode="display-quantity" />
          )}
        </Stack.Screen>

        <Stack.Screen
          name={routes.addItem()}
          component={AddItem}
          options={{headerTitle: 'Register Item'}}
        />
        <Stack.Screen
          name={routes.editItem()}
          component={EditItem}
          options={{headerTitle: 'Edit Item'}}
        />
        <Stack.Screen
          name={routes.itemCategory()}
          component={ItemCategory}
          options={{headerTitle: 'Item Category'}}
        />
        <Stack.Screen
          name={routes.itemUOM()}
          component={ItemUOM}
          options={{headerTitle: 'Unit of Measurement'}}
        />
        <Stack.Screen
          name={routes.itemTax()}
          component={ItemTax}
          options={{headerTitle: 'Item Tax'}}
        />
        <Stack.Screen
          name={routes.itemVendor()}
          component={ItemVendor}
          options={{headerTitle: 'Item Vendor'}}
        />
        <Stack.Screen
          name={routes.addItemUOM()}
          component={AddItemUOM}
          options={{headerTitle: 'Add Unit of Measurement'}}
        />
        <Stack.Screen
          name={routes.itemView()}
          component={ItemView}
          options={{headerTitle: 'Item'}}
        />
        <Stack.Screen
          name={routes.categoryView()}
          component={CategoryView}
          options={{headerTitle: 'Category'}}
        />
        <Stack.Screen
          name={routes.itemSizeOptions()}
          component={ItemSizeOptions}
          options={{headerTitle: 'Size Options'}}
        />
        <Stack.Screen
          name={routes.purchases()}
          options={{headerTitle: 'Purchases'}}>
          {props => (
            <ItemsTab
              {...props}
              viewMode="purchases"
              listItemDisplayMode="display-cost"
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={routes.purchaseCategoryView()}
          component={PurchaseCategoryView}
          options={{headerTitle: 'Purchase Category'}}
        />
        <Stack.Screen
          name={routes.confirmPurchases()}
          component={ConfirmPurchases}
          options={{headerTitle: 'Confirm Purchases'}}
        />
        <Stack.Screen
          name={routes.purchaseEntryList()}
          component={PurchaseEntryList}
          options={{
            headerTitle: 'Batch Purchase Entry',
            headerRight: () => {
              return (
                <View style={{flexDirection: 'row'}}>
                  <Pressable
                    style={{marginRight: 15}}
                    onPress={() => navigation.navigate(routes.logs())}>
                    <MaterialCommunityIcons
                      name="format-list-bulleted-type"
                      size={27}
                      color={colors.dark}
                    />
                  </Pressable>
                  <Pressable
                    style={{marginRight: 15}}
                    onPress={() =>
                      navigation.navigate(routes.purchaseListHistory())
                    }>
                    <MaterialCommunityIcons
                      name="history"
                      size={27}
                      color={colors.dark}
                    />
                  </Pressable>
                </View>
              );
            },
          }}
        />
        <Stack.Screen
          name={routes.stockUsageEntryList()}
          component={StockUsageEntryList}
          options={{
            headerTitle: 'Batch Stock Usage Entry',
            headerRight: () => {
              return (
                <View style={{flexDirection: 'row'}}>
                  <Pressable
                    style={{marginRight: 15}}
                    onPress={() => navigation.navigate(routes.logs())}>
                    <MaterialCommunityIcons
                      name="format-list-bulleted-type"
                      size={27}
                      color={colors.dark}
                    />
                  </Pressable>
                  <Pressable
                    style={{marginRight: 15}}
                    onPress={() =>
                      navigation.navigate(routes.stockUsageHistory())
                    }>
                    <MaterialCommunityIcons
                      name="history"
                      size={27}
                      color={colors.dark}
                    />
                  </Pressable>
                </View>
              );
            },
          }}
        />
        <Stack.Screen
          name={routes.endingInventory()}
          component={EndingInventory}
          options={{
            headerTitle: 'Ending Inventory',
            headerRight: () => {
              return null;

              return (
                <View style={{flexDirection: 'row'}}>
                  <Pressable
                    style={{marginRight: 15}}
                    onPress={() => navigation.navigate(routes.logs())}>
                    <MaterialCommunityIcons
                      name="format-list-bulleted-type"
                      size={27}
                      color={colors.dark}
                    />
                  </Pressable>
                </View>
              );
            },
          }}
        />
        <Stack.Screen
          name={routes.counter()}
          options={{
            headerTitle: 'Sales Register',
          }}>
          {props => (
            <SalesCounterItemsTab
              {...props}
              listItemDisplayMode="display-sale-qty"
              counterMode="sales-register"
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={routes.salesOrderRegister()}
          options={{
            headerTitle: 'Sales Order Register',
          }}>
          {props => (
            <SalesCounterItemsTab
              {...props}
              listItemDisplayMode="display-sale-qty"
              counterMode="sales-order-register"
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={routes.confirmSales()}
          component={ConfirmSales}
          options={{headerTitle: 'Review Sales'}}
        />
        <Stack.Screen
          name={routes.paymentMethod()}
          component={PaymentMethod}
          options={{headerTitle: 'Payment Method'}}
        />
        <Stack.Screen
          name={routes.splitPayment()}
          component={SplitPayment}
          options={{headerTitle: 'Split Payment'}}
        />
        <Stack.Screen
          name={routes.salesInvoices()}
          component={SalesInvoices}
          options={{headerTitle: 'Sales Invoices'}}
        />
        <Stack.Screen
          name={routes.salesInvoiceView()}
          component={SalesInvoiceView}
          options={{headerTitle: 'Sales Invoice'}}
        />
        <Stack.Screen
          name={routes.salesOrderGroups()}
          component={SalesOrders}
          options={{headerTitle: 'Sales Orders'}}
        />
        <Stack.Screen
          name={routes.salesOrderGroupView()}
          component={SalesOrderGroupView}
          options={{headerTitle: 'Sales Order'}}
        />
        <Stack.Screen
          name={routes.printers()}
          options={{headerTitle: 'Printers'}}>
          {props => {
            return <Printers {...props} viewMode="manage-printers" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.createPrinter()}
          component={CreatePrinter}
          options={{headerTitle: 'Create Printer'}}
        />
        <Stack.Screen
          name={routes.itemAddedStocks()}
          component={ItemAddedStocks}
          options={{headerTitle: 'Item Added Stocks'}}
        />
        <Stack.Screen
          name={routes.purchaseListHistory()}
          component={PurchaseListHistory}
          options={{headerTitle: 'Batch Purchase History'}}
        />
        <Stack.Screen
          name={routes.purchaseListHistoryView()}
          component={PurchaseListHistoryView}
          options={{headerTitle: 'Purchased Items'}}
        />
        <Stack.Screen
          name={routes.confirmStockUsage()}
          component={ConfirmStockUsage}
          options={{headerTitle: 'Confirm Stock Usage'}}
        />
        <Stack.Screen
          name={routes.stockUsageHistory()}
          component={StockUsageHistory}
          options={{headerTitle: 'Stock Usage History'}}
        />
        <Stack.Screen
          name={routes.stockUsageHistoryView()}
          component={StockUsageHistoryView}
          options={{headerTitle: 'Used Items'}}
        />
        <Stack.Screen
          name={routes.scanBarcode()}
          component={ScanBarcode}
          options={{headerTitle: 'Scan Barcode'}}
        />
        <Stack.Screen
          name={routes.manageStock()}
          component={ManageStock}
          options={{headerTitle: 'Manage Stock'}}
        />
        <Stack.Screen
          name={routes.itemPurchaseEntries()}
          component={ItemPurchaseEntries}
          options={{headerTitle: 'Item Purchase Entries'}}
        />
        <Stack.Screen
          name={routes.revenues()}
          component={Revenues}
          options={{headerTitle: 'Revenues'}}
        />
        <Stack.Screen
          name={routes.logs()}
          component={Logs}
          options={{headerTitle: 'Inventory Operation Logs'}}
        />
        <Stack.Screen
          name={routes.logView()}
          component={LogView}
          options={{headerTitle: 'Log Details'}}
        />
        <Stack.Screen
          name={routes.updateInventoryLog()}
          component={UpdateInventoryLog}
          options={{headerTitle: 'Update Inventory Log'}}
        />
        <Stack.Screen
          name={routes.expenses()}
          component={Expenses}
          options={{headerTitle: 'Expenses'}}
        />
        <Stack.Screen
          name={routes.expenseView()}
          component={ExpenseView}
          options={{headerTitle: 'Expenses'}}
        />
        <Stack.Screen
          name={routes.addExpense()}
          component={AddExpense}
          options={{headerTitle: 'Add Expense'}}
        />
        <Stack.Screen
          name={routes.expenseGroups()}
          component={ExpenseGroup}
          options={{headerTitle: 'Expense Group'}}
        />
        {/* Report Screens */}
        <Stack.Screen
          name={routes.reports()}
          component={Reports}
          options={{headerTitle: 'Reports'}}
        />
        <Stack.Screen
          name={routes.foodCostAnalysis()}
          component={FoodCostAnalysis}
          options={{headerTitle: 'Revenue and Expense Groups'}}
        />
        <Stack.Screen
          name={routes.manageRevenueGroups()}
          component={ManageRevenueGroups}
          options={{headerTitle: 'Manage Revenue Groups'}}
        />
        <Stack.Screen
          name={routes.manageExpenseGroups()}
          component={ManageExpenseGroups}
          options={{headerTitle: 'Manage Expense Groups'}}
        />
        <Stack.Screen
          name={routes.manageMonthlyExpenses()}
          component={ManageMonthlyExpenses}
          options={{headerTitle: 'Manage Monthly Expenses'}}
        />
        <Stack.Screen
          name={routes.manageCategories()}
          options={{headerTitle: 'Manage Categories'}}>
          {props => {
            return <Categories {...props} viewMode="manage-categories" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.manageTaxes()}
          options={{headerTitle: 'Manage Taxes'}}>
          {props => {
            return <Taxes {...props} viewMode="manage-taxes" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.manageVendors()}
          options={{headerTitle: 'Manage Vendors'}}>
          {props => {
            return <Vendors {...props} viewMode="manage-vendors" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.profitAndLoss()}
          component={ProfitAndLoss}
          options={{headerTitle: 'Profit And Loss'}}
        />
        <Stack.Screen
          name={routes.foodVariance()}
          component={FoodVariance}
          options={{headerTitle: 'Food Variance'}}
        />
        <Stack.Screen
          name={routes.beverageVariance()}
          component={BeverageVariance}
          options={{headerTitle: 'Beverage Variance'}}
        />
        <Stack.Screen
          name={routes.foodMenuMix()}
          component={FoodMenuMix}
          options={{headerTitle: 'Food Menu Mix'}}
        />
        <Stack.Screen
          name={routes.monthlyReportByItem()}
          component={MonthlyReportByItem}
          options={{
            headerTitle: 'Monthly Report | Item',
            headerRight: () => {
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.monthlyReportByCategory()}
          component={MonthlyReportByCategory}
          options={{
            headerTitle: 'Monthly Report | Category',
            headerRight: () => {
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.customReportByItem()}
          component={CustomReportByItem}
          options={{
            headerTitle: 'Date Filtered Report | Item',
            headerRight: () => {
              return null;
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.customReportByCategory()}
          component={CustomReportByCategory}
          options={{
            headerTitle: 'Date Filtered Report | Category',
            headerRight: () => {
              return null;
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.itemReportView()}
          component={ItemReportView}
          options={{headerTitle: 'Item Report'}}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
};

export default RootStack;
