import React, {useState} from 'react';
import {StyleSheet, Text, View, Pressable} from 'react-native';
import {
  useTheme,
  Headline,
  Chip,
  Button,
  Divider,
  Subheading,
  Portal,
  Dialog,
  Paragraph,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import commaNumber from 'comma-number';
import {useQuery} from '@tanstack/react-query';
import Ionicons from 'react-native-vector-icons/Ionicons';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../../constants/routes';
import {
  getCategoryCostPercentage,
  getItemAvgUnitCost,
  getItemCostPercentage,
  getItemCurrentStockQuantity,
} from '../../localDbQueries/inventoryLogs';
import DefaultLoadingScreen from '../../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../../components/stateIndicators/DefaultErrorScreen';

const CategoryDetails = props => {
  const {containerStyle, category, onPressCategoryOptions} = props;
  const navigation = useNavigation();
  const {colors} = useTheme();
  const {
    status: categoryCostPercentageStatus,
    data: categoryCostPercentageData,
  } = useQuery(
    ['categoryCostPercentage', {categoryId: category.id}],
    getCategoryCostPercentage,
  );

  const [infoDialogVisible, setInfoDialogVisible] = useState(false);

  const showInfoDialog = () => setInfoDialogVisible(true);
  const hideInfoDialog = () => setInfoDialogVisible(false);

  const renderRevenueGroupValueInfoIcon = () => {
    if (
      categoryCostPercentageData.isCategoryHasRevenueGroup === false ||
      (categoryCostPercentageData.isCategoryHasRevenueGroup === true &&
        !categoryCostPercentageData?.hasCurrentMonthRevenueGroupAmount)
    ) {
      return (
        <MaterialCommunityIcons
          onPress={showInfoDialog}
          name="information"
          size={18}
          color={colors.primary}
          style={{paddingRight: 30}}
        />
      );
    }
  };

  const renderRevenueGroupValue = () => {
    return (
      <>
        <Text
          onPress={() => {
            if (categoryCostPercentageData?.revenueGroup) {
              navigation.navigate(routes.revenuesAndExpenses(), {
                revenue_group_highlighted_item_id:
                  categoryCostPercentageData.revenueGroup.id,
              });
            } else {
              showInfoDialog();
            }
          }}
          style={{
            marginLeft: 7,
            paddingRight: 5,
            fontWeight: 'bold',
            color: categoryCostPercentageData?.revenueGroup?.name
              ? colors.primary
              : colors.dark,
          }}>
          {`${categoryCostPercentageData?.revenueGroup?.name || 'None'}`}
        </Text>
        {!categoryCostPercentageData?.revenueGroup &&
          renderRevenueGroupValueInfoIcon()}
      </>
    );
  };

  const renderCostPercentageValue = () => {
    if (
      categoryCostPercentageData.isCategoryHasRevenueGroup === false ||
      (categoryCostPercentageData.isCategoryHasRevenueGroup === true &&
        !categoryCostPercentageData?.hasCurrentMonthRevenueGroupAmount)
    ) {
      return (
        <MaterialCommunityIcons
          onPress={showInfoDialog}
          name="information"
          size={18}
          color={colors.primary}
          style={{paddingLeft: 7, paddingRight: 30}}
        />
      );
    }

    return (
      <>
        <Text
          style={{
            marginLeft: 7,
            fontWeight: 'bold',
            color: colors.dark,
          }}>
          {`${commaNumber(
            parseFloat(categoryCostPercentageData.result || 0).toFixed(2),
          )}`}
        </Text>
        <Text
          style={{
            marginLeft: 5,

            color: colors.dark,
          }}>
          {`%`}
        </Text>
      </>
    );
  };

  if (!category) return null;

  if (categoryCostPercentageStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (categoryCostPercentageStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const revenueGroupNameText = (
    <Paragraph style={{fontWeight: 'bold'}}>{`${
      categoryCostPercentageData?.revenueGroup?.name
        ? categoryCostPercentageData?.revenueGroup?.name + ' '
        : ''
    }`}</Paragraph>
  );

  const categoryNameText = (
    <Paragraph style={{fontWeight: 'bold'}}>{`${
      category.name + ' '
    }`}</Paragraph>
  );

  let categoryCostPercentageInfoText = null;
  let categoryCostPercentageActionButtonText = '';

  if (categoryCostPercentageData.isCategoryHasRevenueGroup === false) {
    categoryCostPercentageInfoText = (
      <>
        {`Create new or select an existing revenue group, and then add`}{' '}
        {categoryNameText}
        {`category to calculate cost percentage.`}
      </>
    );

    categoryCostPercentageActionButtonText = `Manage Revenue Groups`;
  } else if (!categoryCostPercentageData?.hasCurrentMonthRevenueGroupAmount) {
    categoryCostPercentageInfoText = (
      <>
        {`Update`} {revenueGroupNameText}
        {`revenue value of the current month to calculate cost percentage.`}
      </>
    );

    categoryCostPercentageActionButtonText = `Update ${
      categoryCostPercentageData?.revenueGroup?.name
        ? categoryCostPercentageData?.revenueGroup?.name + ' '
        : ''
    }revenue`;
  }

  return (
    <>
      <Portal>
        <Dialog visible={infoDialogVisible} onDismiss={hideInfoDialog}>
          <Dialog.Title>Category Cost Percentage</Dialog.Title>
          <Dialog.Content>
            <Paragraph>{categoryCostPercentageInfoText}</Paragraph>
          </Dialog.Content>
          <Dialog.Actions style={{justifyContent: 'space-around'}}>
            <Button
              onPress={() => {
                if (
                  categoryCostPercentageData.isCategoryHasRevenueGroup === false
                ) {
                  navigation.navigate(routes.manageRevenueGroups());
                } else if (
                  !categoryCostPercentageData?.hasCurrentMonthRevenueGroupAmount
                ) {
                  navigation.navigate(routes.revenuesAndExpenses(), {
                    revenue_group_highlighted_item_id:
                      categoryCostPercentageData.revenueGroup.id,
                  });
                }

                hideInfoDialog();
              }}
              color={colors.primary}>
              {categoryCostPercentageActionButtonText}
            </Button>
          </Dialog.Actions>
        </Dialog>
      </Portal>
      <View
        style={[
          styles.container,
          {backgroundColor: colors.surface},
          containerStyle,
        ]}>
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}>
          <Headline numberOfLines={3} style={{flex: 1, marginRight: 10}}>
            {category.name}
          </Headline>
          <View
            style={{
              flexDirection: 'row',
              justifyContent: 'flex-start',
              height: '100%',
            }}>
            {/* <Pressable style={{marginLeft: 5}} onPress={onPressCategoryOptions}>
              <MaterialIcons name="more-horiz" size={25} color={colors.dark} />
            </Pressable> */}
          </View>
        </View>
        <Divider style={{marginTop: 15}} />

        <View style={styles.detailsContainer}>
          <View style={[styles.detailsListItem]}>
            <Text style={{fontWeight: 'bold'}}>Revenue Group:</Text>
            {renderRevenueGroupValue()}
          </View>
          <View style={styles.detailsListItem}>
            <Text style={{fontWeight: 'bold'}}>Cost Percentage:</Text>
            {renderCostPercentageValue()}
          </View>
        </View>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    marginTop: 5,
    padding: 15,
  },
  detailsContainer: {
    marginTop: 10,
  },
  detailsListItem: {
    marginLeft: 15,
    marginVertical: 4,
    flexDirection: 'row',
    alignItems: 'center',
  },
  actionsContainer: {
    marginTop: 10,
  },
});

export default CategoryDetails;
