import React, {useState, useEffect} from 'react';
import {StyleSheet, Text, View} from 'react-native';
import {
  Checkbox,
  Divider,
  Button,
  Modal,
  Portal,
  TextInput,
  Title,
} from 'react-native-paper';
import {useNavigation, useRoute} from '@react-navigation/native';
import {useQuery} from '@tanstack/react-query';

import {units} from '../__dummyData';
import routes from '../constants/routes';
import useItemFormContext from '../hooks/useItemFormContext';
import CheckboxSelection from '../components/forms/CheckboxSelection';
import UnitOfMeasurementForm from '../components/forms/UnitOfMeasurementForm';
import DefaultLoadingScreen from '../components/stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../components/stateIndicators/DefaultErrorScreen';
import {getDefaultUnits} from '../localData/units';

const ItemUOM = () => {
  const navigation = useNavigation();
  const route = useRoute();
  const {formikActions} = useItemFormContext();
  const {
    uom_abbrev: defaultSelectedUnit,
    uom_abbrev_field_key: uomAbbrevFieldKey,
    is_uom_abbrev_required: isUOMAbbrevRequired,
  } = route.params;
  const [createUnitModalVisible, setCreateUnitModalVisible] = useState(false);
  const [selectedUnit, setSelectedUnit] = useState(defaultSelectedUnit);
  const {status, data} = useQuery(['units'], getDefaultUnits);

  useEffect(() => {
    return () => {
      formikActions.setFieldTouched(uomAbbrevFieldKey);

      !selectedUnit && isUOMAbbrevRequired
        ? formikActions.setFieldError(uomAbbrevFieldKey, 'Required')
        : formikActions.setFieldError(uomAbbrevFieldKey, '');
    };
  }, []);

  const showCreateUnitModal = () => setCreateUnitModalVisible(true);
  const hideCreateUnitModal = () => setCreateUnitModalVisible(false);

  const handleUnitChange = selectedOption => {
    setSelectedUnit(() => selectedOption);
  };

  const handleCancel = () => {
    hideCreateUnitModal();
  };

  const handleSubmit = (values, actions) => {
    console.log(values);
    actions.resetForm();
    hideCreateUnitModal();
  };

  const containerStyle = {backgroundColor: 'white', padding: 20};

  if (status === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (status === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  return (
    <>
      <Portal>
        <Modal
          visible={createUnitModalVisible}
          onDismiss={hideCreateUnitModal}
          contentContainerStyle={containerStyle}>
          <Title style={{marginBottom: 15, textAlign: 'center'}}>
            Create New Unit of Measurement
          </Title>
          <UnitOfMeasurementForm
            onSubmit={handleSubmit}
            onCancel={handleCancel}
          />
        </Modal>
      </Portal>
      <View style={styles.container}>
        <Button
          mode="outlined"
          icon="plus"
          onPress={() => navigation.navigate(routes.addItemUOM())}
          style={{marginVertical: 20}}>
          Add Unit
        </Button>
        <Divider />
        <CheckboxSelection
          value={selectedUnit}
          options={data.map(unit => {
            const unitName = unit.singular === 'Each' ? 'Piece' : unit.singular;
            const unitAbbrev = unit.abbr === 'ea' ? 'pc' : unit.abbr;

            return {
              label: `${unitName} (${unitAbbrev})`,
              value: unit.abbr,
            };
          })}
          onChange={handleUnitChange}
        />
        <Button
          mode="contained"
          onPress={() => {
            formikActions.setFieldTouched(uomAbbrevFieldKey);
            formikActions.setFieldValue(uomAbbrevFieldKey, selectedUnit);

            !selectedUnit
              ? formikActions.setFieldError(uomAbbrevFieldKey, 'Required')
              : formikActions.setFieldError(uomAbbrevFieldKey, '');

            if (uomAbbrevFieldKey === 'uom_abbrev' && selectedUnit !== 'ea') {
              // Reset measurement per piece values
              formikActions.setFieldValue('uom_abbrev_per_piece', '');
              formikActions.setFieldTouched('uom_abbrev_per_piece', false);
              formikActions.setFieldError('uom_abbrev_per_piece', null);

              formikActions.setFieldValue('qty_per_piece', '');
              formikActions.setFieldTouched('qty_per_piece', false);
              formikActions.setFieldError('qty_per_piece', null);

              formikActions.setFieldTouched('add_measurement_per_piece', true);
              formikActions.setFieldValue('add_measurement_per_piece', false);

              formikActions.setFieldTouched('set_uom_to_uom_per_piece', true);
              formikActions.setFieldValue('set_uom_to_uom_per_piece', false);
            }

            navigation.goBack();
          }}
          style={{marginVertical: 20}}>
          Done
        </Button>
      </View>
    </>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: 7,
    backgroundColor: 'white',
  },
});

export default React.memo(ItemUOM);
