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
import {screenTransitionConfig} from '../utils/ScreenOptimization';

const Stack = createStackNavigator();

// Memoize components to prevent unnecessary re-renders
const MemoizedMainTab = React.memo(MainTab);
const MemoizedCloudAccountMainTab = React.memo(CloudAccountMainTab);
const MemoizedServingRecipes = React.memo(ServingRecipes);
const MemoizedActivateLicense = React.memo(ActivateLicense);
const MemoizedUpdateCompany = React.memo(UpdateCompany);
const MemoizedAccount = React.memo(Account);
const MemoizedLocalUserAccounts = React.memo(LocalUserAccounts);
const MemoizedDeleteMyAccount = React.memo(DeleteMyAccount);
const MemoizedCreateRecipe = React.memo(CreateRecipe);
const MemoizedEditRecipe = React.memo(EditRecipe);
const MemoizedRecipeView = React.memo(RecipeView);
const MemoizedRecipeKind = React.memo(RecipeKind);
const MemoizedCreateSubRecipe = React.memo(CreateSubRecipe);
const MemoizedSelectRecipeIngredient = React.memo(SelectRecipeIngredient);
const MemoizedProduceFinishedProductStock = React.memo(
  ProduceFinishedProductStock,
);
const MemoizedCurrencies = React.memo(Currencies);
const MemoizedVendors = React.memo(Vendors);
const MemoizedSpoilage = React.memo(Spoilage);
const MemoizedSelectSpoilageItem = React.memo(SelectSpoilageItem);
const MemoizedItemsTab = React.memo(ItemsTab);
const MemoizedAddItem = React.memo(AddItem);
const MemoizedEditItem = React.memo(EditItem);
const MemoizedItemCategory = React.memo(ItemCategory);
const MemoizedItemUOM = React.memo(ItemUOM);
const MemoizedItemTax = React.memo(ItemTax);
const MemoizedItemVendor = React.memo(ItemVendor);
const MemoizedAddItemUOM = React.memo(AddItemUOM);
const MemoizedItemView = React.memo(ItemView);
const MemoizedCategoryView = React.memo(CategoryView);
const MemoizedItemSizeOptions = React.memo(ItemSizeOptions);
const MemoizedPurchaseCategoryView = React.memo(PurchaseCategoryView);
const MemoizedConfirmPurchases = React.memo(ConfirmPurchases);
const MemoizedPurchaseEntryList = React.memo(PurchaseEntryList);
const MemoizedStockUsageEntryList = React.memo(StockUsageEntryList);
const MemoizedEndingInventory = React.memo(EndingInventory);
const MemoizedSalesCounterItemsTab = React.memo(SalesCounterItemsTab);
const MemoizedConfirmSales = React.memo(ConfirmSales);
const MemoizedPaymentMethod = React.memo(PaymentMethod);
const MemoizedSplitPayment = React.memo(SplitPayment);
const MemoizedSalesInvoices = React.memo(SalesInvoices);
const MemoizedSalesInvoiceView = React.memo(SalesInvoiceView);
const MemoizedSalesOrders = React.memo(SalesOrders);
const MemoizedSalesOrderGroupView = React.memo(SalesOrderGroupView);
const MemoizedPrinters = React.memo(Printers);
const MemoizedCreatePrinter = React.memo(CreatePrinter);
const MemoizedItemAddedStocks = React.memo(ItemAddedStocks);
const MemoizedPurchaseListHistory = React.memo(PurchaseListHistory);
const MemoizedPurchaseListHistoryView = React.memo(PurchaseListHistoryView);
const MemoizedConfirmStockUsage = React.memo(ConfirmStockUsage);
const MemoizedStockUsageHistory = React.memo(StockUsageHistory);
const MemoizedStockUsageHistoryView = React.memo(StockUsageHistoryView);
const MemoizedScanBarcode = React.memo(ScanBarcode);
const MemoizedManageStock = React.memo(ManageStock);
const MemoizedItemPurchaseEntries = React.memo(ItemPurchaseEntries);
const MemoizedRevenues = React.memo(Revenues);
const MemoizedLogs = React.memo(Logs);
const MemoizedLogView = React.memo(LogView);
const MemoizedUpdateInventoryLog = React.memo(UpdateInventoryLog);
const MemoizedExpenses = React.memo(Expenses);
const MemoizedExpenseView = React.memo(ExpenseView);
const MemoizedAddExpense = React.memo(AddExpense);
const MemoizedExpenseGroup = React.memo(ExpenseGroup);
const MemoizedReports = React.memo(Reports);
const MemoizedFoodCostAnalysis = React.memo(FoodCostAnalysis);
const MemoizedManageRevenueGroups = React.memo(ManageRevenueGroups);
const MemoizedManageExpenseGroups = React.memo(ManageExpenseGroups);
const MemoizedManageMonthlyExpenses = React.memo(ManageMonthlyExpenses);
const MemoizedCategories = React.memo(Categories);
const MemoizedMonthlyReportByItem = React.memo(MonthlyReportByItem);
const MemoizedMonthlyReportByCategory = React.memo(MonthlyReportByCategory);
const MemoizedCustomReportByItem = React.memo(CustomReportByItem);
const MemoizedCustomReportByCategory = React.memo(CustomReportByCategory);
const MemoizedItemReportView = React.memo(ItemReportView);
const MemoizedTaxes = React.memo(Taxes);
const MemoizedCounter = React.memo(Counter);

const RootStack = () => {
  const navigation = useNavigation();
  const {colors} = useTheme();

  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        ...screenTransitionConfig,
      }}>
      <Stack.Group>
        <Stack.Screen name={routes.mainTab()} component={MemoizedMainTab} />
      </Stack.Group>
      <Stack.Group>
        <Stack.Screen
          name={routes.cloudMainTab()}
          component={MemoizedCloudAccountMainTab}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{headerShown: true}}>
        <Stack.Screen
          name={routes.recipes()}
          component={MemoizedServingRecipes}
          options={{headerTitle: 'Recipes'}}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{presentation: 'modal', headerShown: true}}>
        <Stack.Screen
          name={routes.activateLicense()}
          component={MemoizedActivateLicense}
          options={{headerTitle: 'Activate License'}}
        />
        <Stack.Screen
          name={routes.updateCompany()}
          component={MemoizedUpdateCompany}
          options={{headerTitle: 'Update Company'}}
        />
        <Stack.Screen
          name={routes.account()}
          component={MemoizedAccount}
          options={{headerTitle: 'Account'}}
        />
        <Stack.Screen
          name={routes.localUserAccounts()}
          options={{headerTitle: 'Manage Users'}}>
          {props => {
            return (
              <MemoizedLocalUserAccounts {...props} viewMode="manage-users" />
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.deleteMyAccount()}
          component={MemoizedDeleteMyAccount}
          options={{headerTitle: 'Delete Account'}}></Stack.Screen>
        <Stack.Screen
          name={routes.createRecipe()}
          component={MemoizedCreateRecipe}
          options={{headerTitle: 'Create Recipe'}}
        />
        <Stack.Screen
          name={routes.editRecipe()}
          component={MemoizedEditRecipe}
          options={{headerTitle: 'Edit Recipe'}}
        />
        <Stack.Screen
          name={routes.recipeView()}
          component={MemoizedRecipeView}
          options={{headerTitle: 'Recipe'}}
        />
        <Stack.Screen
          name={routes.recipeKind()}
          component={MemoizedRecipeKind}
          options={{headerTitle: 'Recipe Kind'}}
        />
        <Stack.Screen
          name={routes.createSubRecipe()}
          component={MemoizedCreateSubRecipe}
          options={{headerTitle: 'Create Sub Recipe'}}
        />
        <Stack.Screen
          name={routes.selectRecipeIngredient()}
          component={MemoizedSelectRecipeIngredient}
          options={{headerTitle: 'Select Recipe Ingredient'}}
        />
        <Stack.Screen
          name={routes.produceFinishedProductStock()}
          component={MemoizedProduceFinishedProductStock}
          options={{headerTitle: 'Add Finished Product Yield'}}
        />
      </Stack.Group>
      <Stack.Group screenOptions={{presentation: 'modal', headerShown: true}}>
        <Stack.Screen
          name={routes.currencies()}
          component={MemoizedCurrencies}
          options={{headerTitle: 'Select Currency'}}
        />
        <Stack.Screen
          name={routes.vendors()}
          options={{headerTitle: 'Vendors'}}>
          {props => {
            return <MemoizedVendors {...props} viewMode="list" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.spoilage()}
          component={MemoizedSpoilage}
          options={{headerTitle: 'Spoilage / Wastage'}}
        />
        <Stack.Screen
          name={routes.selectSpoilageItem()}
          component={MemoizedSelectSpoilageItem}
          options={{headerTitle: 'Select Spoilage Item'}}
        />

        <Stack.Screen
          name={routes.items()}
          options={{headerTitle: 'Inventory'}}>
          {props => (
            <MemoizedItemsTab
              {...props}
              listItemDisplayMode="display-quantity"
            />
          )}
        </Stack.Screen>

        <Stack.Screen
          name={routes.addItem()}
          component={MemoizedAddItem}
          options={{headerTitle: 'Register Item'}}
        />
        <Stack.Screen
          name={routes.editItem()}
          component={MemoizedEditItem}
          options={{headerTitle: 'Edit Item'}}
        />
        <Stack.Screen
          name={routes.itemCategory()}
          component={MemoizedItemCategory}
          options={{headerTitle: 'Item Category'}}
        />
        <Stack.Screen
          name={routes.itemUOM()}
          component={MemoizedItemUOM}
          options={{headerTitle: 'Unit of Measurement'}}
        />
        <Stack.Screen
          name={routes.itemTax()}
          component={MemoizedItemTax}
          options={{headerTitle: 'Item Tax'}}
        />
        <Stack.Screen
          name={routes.itemVendor()}
          component={MemoizedItemVendor}
          options={{headerTitle: 'Item Vendor'}}
        />
        <Stack.Screen
          name={routes.addItemUOM()}
          component={MemoizedAddItemUOM}
          options={{headerTitle: 'Add Unit of Measurement'}}
        />
        <Stack.Screen
          name={routes.itemView()}
          component={MemoizedItemView}
          options={{headerTitle: 'Item'}}
        />
        <Stack.Screen
          name={routes.categoryView()}
          component={MemoizedCategoryView}
          options={{headerTitle: 'Category'}}
        />
        <Stack.Screen
          name={routes.itemSizeOptions()}
          component={MemoizedItemSizeOptions}
          options={{headerTitle: 'Size Options'}}
        />
        <Stack.Screen
          name={routes.purchases()}
          options={{headerTitle: 'Purchases'}}>
          {props => (
            <MemoizedItemsTab
              {...props}
              viewMode="purchases"
              listItemDisplayMode="display-cost"
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={routes.purchaseCategoryView()}
          component={MemoizedPurchaseCategoryView}
          options={{headerTitle: 'Purchase Category'}}
        />
        <Stack.Screen
          name={routes.confirmPurchases()}
          component={MemoizedConfirmPurchases}
          options={{headerTitle: 'Confirm Purchases'}}
        />
        <Stack.Screen
          name={routes.purchaseEntryList()}
          component={MemoizedPurchaseEntryList}
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
          component={MemoizedStockUsageEntryList}
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
          component={MemoizedEndingInventory}
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
            <MemoizedSalesCounterItemsTab
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
            <MemoizedSalesCounterItemsTab
              {...props}
              listItemDisplayMode="display-sale-qty"
              counterMode="sales-order-register"
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name={routes.confirmSales()}
          component={MemoizedConfirmSales}
          options={{headerTitle: 'Review Sales'}}
        />
        <Stack.Screen
          name={routes.paymentMethod()}
          component={MemoizedPaymentMethod}
          options={{headerTitle: 'Payment Method'}}
        />
        <Stack.Screen
          name={routes.splitPayment()}
          component={MemoizedSplitPayment}
          options={{headerTitle: 'Split Payment'}}
        />
        <Stack.Screen
          name={routes.salesInvoices()}
          component={MemoizedSalesInvoices}
          options={{headerTitle: 'Sales Invoices'}}
        />
        <Stack.Screen
          name={routes.salesInvoiceView()}
          component={MemoizedSalesInvoiceView}
          options={{headerTitle: 'Sales Invoice'}}
        />
        <Stack.Screen
          name={routes.salesOrderGroups()}
          component={MemoizedSalesOrders}
          options={{headerTitle: 'Sales Orders'}}
        />
        <Stack.Screen
          name={routes.salesOrderGroupView()}
          component={MemoizedSalesOrderGroupView}
          options={{headerTitle: 'Sales Order'}}
        />
        <Stack.Screen
          name={routes.printers()}
          options={{headerTitle: 'Printers'}}>
          {props => {
            return <MemoizedPrinters {...props} viewMode="manage-printers" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.createPrinter()}
          component={MemoizedCreatePrinter}
          options={{headerTitle: 'Create Printer'}}
        />
        <Stack.Screen
          name={routes.itemAddedStocks()}
          component={MemoizedItemAddedStocks}
          options={{headerTitle: 'Item Added Stocks'}}
        />
        <Stack.Screen
          name={routes.purchaseListHistory()}
          component={MemoizedPurchaseListHistory}
          options={{headerTitle: 'Batch Purchase History'}}
        />
        <Stack.Screen
          name={routes.purchaseListHistoryView()}
          component={MemoizedPurchaseListHistoryView}
          options={{headerTitle: 'Purchased Items'}}
        />
        <Stack.Screen
          name={routes.confirmStockUsage()}
          component={MemoizedConfirmStockUsage}
          options={{headerTitle: 'Confirm Stock Usage'}}
        />
        <Stack.Screen
          name={routes.stockUsageHistory()}
          component={MemoizedStockUsageHistory}
          options={{headerTitle: 'Stock Usage History'}}
        />
        <Stack.Screen
          name={routes.stockUsageHistoryView()}
          component={MemoizedStockUsageHistoryView}
          options={{headerTitle: 'Used Items'}}
        />
        <Stack.Screen
          name={routes.scanBarcode()}
          component={MemoizedScanBarcode}
          options={{headerTitle: 'Scan Barcode'}}
        />
        <Stack.Screen
          name={routes.manageStock()}
          component={MemoizedManageStock}
          options={{headerTitle: 'Manage Stock'}}
        />
        <Stack.Screen
          name={routes.itemPurchaseEntries()}
          component={MemoizedItemPurchaseEntries}
          options={{headerTitle: 'Item Purchase Entries'}}
        />
        <Stack.Screen
          name={routes.revenues()}
          component={MemoizedRevenues}
          options={{headerTitle: 'Revenues'}}
        />
        <Stack.Screen
          name={routes.logs()}
          component={MemoizedLogs}
          options={{headerTitle: 'Inventory Operation Logs'}}
        />
        <Stack.Screen
          name={routes.logView()}
          component={MemoizedLogView}
          options={{headerTitle: 'Log Details'}}
        />
        <Stack.Screen
          name={routes.updateInventoryLog()}
          component={MemoizedUpdateInventoryLog}
          options={{headerTitle: 'Update Inventory Log'}}
        />
        <Stack.Screen
          name={routes.expenses()}
          component={MemoizedExpenses}
          options={{headerTitle: 'Expenses'}}
        />
        <Stack.Screen
          name={routes.expenseView()}
          component={MemoizedExpenseView}
          options={{headerTitle: 'Expenses'}}
        />
        <Stack.Screen
          name={routes.addExpense()}
          component={MemoizedAddExpense}
          options={{headerTitle: 'Add Expense'}}
        />
        <Stack.Screen
          name={routes.expenseGroups()}
          component={MemoizedExpenseGroup}
          options={{headerTitle: 'Expense Group'}}
        />
        {/* Report Screens */}
        <Stack.Screen
          name={routes.reports()}
          component={MemoizedReports}
          options={{headerTitle: 'Reports'}}
        />
        <Stack.Screen
          name={routes.foodCostAnalysis()}
          component={MemoizedFoodCostAnalysis}
          options={{headerTitle: 'Revenue and Expense Groups'}}
        />
        <Stack.Screen
          name={routes.manageRevenueGroups()}
          component={MemoizedManageRevenueGroups}
          options={{headerTitle: 'Manage Revenue Groups'}}
        />
        <Stack.Screen
          name={routes.manageExpenseGroups()}
          component={MemoizedManageExpenseGroups}
          options={{headerTitle: 'Manage Expense Groups'}}
        />
        <Stack.Screen
          name={routes.manageMonthlyExpenses()}
          component={MemoizedManageMonthlyExpenses}
          options={{headerTitle: 'Manage Monthly Expenses'}}
        />
        <Stack.Screen
          name={routes.manageCategories()}
          options={{headerTitle: 'Manage Categories'}}>
          {props => {
            return (
              <MemoizedCategories {...props} viewMode="manage-categories" />
            );
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.manageTaxes()}
          options={{headerTitle: 'Manage Taxes'}}>
          {props => {
            return <MemoizedTaxes {...props} viewMode="manage-taxes" />;
          }}
        </Stack.Screen>
        <Stack.Screen
          name={routes.manageVendors()}
          options={{headerTitle: 'Manage Vendors'}}>
          {props => {
            return <MemoizedVendors {...props} viewMode="manage-vendors" />;
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
          component={MemoizedMonthlyReportByItem}
          options={{
            headerTitle: 'Monthly Report | Item',
            headerRight: () => {
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.monthlyReportByCategory()}
          component={MemoizedMonthlyReportByCategory}
          options={{
            headerTitle: 'Monthly Report | Category',
            headerRight: () => {
              return <MonthlyReportHeaderRight />;
            },
          }}
        />
        <Stack.Screen
          name={routes.customReportByItem()}
          component={MemoizedCustomReportByItem}
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
          component={MemoizedCustomReportByCategory}
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
          component={MemoizedItemReportView}
          options={{headerTitle: 'Item Report'}}
        />
      </Stack.Group>
    </Stack.Navigator>
  );
};

export default RootStack;
