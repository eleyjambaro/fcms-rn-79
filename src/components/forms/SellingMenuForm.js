import React, {useState, useEffect, useRef} from 'react';
import {View} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  Subheading,
  ActivityIndicator,
} from 'react-native-paper';
import {useNavigation} from '@react-navigation/native';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {useQuery, useMutation} from '@tanstack/react-query';

import routes from '../../constants/routes';
import useSellingMenuFormContext from '../../hooks/useSellingMenuFormContext';
import useAddedSellingMenuItemsContext from '../../hooks/useAddedSellingMenuItemsContext';
import AddedSellingMenuItemList from '../sellingMenus/AddedSellingMenuItemList';
import {
  isSellingMenuHasSellingMenuItems,
  updateSellingMenu,
} from '../../localDbQueries/sellingMenus';

const SellingMenuValidationSchema = Yup.object().shape({
  name: Yup.string().required('Required'),
});

const SellingMenuForm = props => {
  const {
    item,
    isUnsavedSellingMenu,
    sellingMenuId,
    initialValues = {
      name: '',
    },
    onSubmit,
    editMode = false,
  } = props;
  const {colors} = useTheme();
  const navigation = useNavigation();
  const {setFormikActions} = useSellingMenuFormContext();
  const {addedSellingMenuItems} = useAddedSellingMenuItemsContext();

  const {
    status: isSellingMenuHasSellingMenuItemStatus,
    data: isSellingMenuHasSellingMenuItemData,
  } = useQuery(
    ['isSellingMenuHasSellingMenuItems', {sellingMenuId}],
    isSellingMenuHasSellingMenuItems,
  );
  const updateUnsavedSellingMenuMutation = useMutation(updateSellingMenu, {
    onSuccess: () => {
      // Do something on success
    },
  });

  const formRef = useRef(null);

  /**
   * TODO: Update unsaved selling menu
   */
  useEffect(() => {
    return () => {
      const updateUnsavedSellingMenu = async () => {
        // TODO: access Formik's values here to update unsaved selling menu with changes
        // try {
        //   await updateUnsavedSellingMenuMutation.mutateAsync({
        //     values
        //   });
        // } catch (error) {
        //   console.debug(error);
        // } finally {
        //   actions.resetForm();
        // }
      };
      if (isUnsavedSellingMenu) {
        // TODO: access Formik's dirty here to avoid saving unsaved menu without any changes
        // updateUnsavedSellingMenu()
      }
    };
  }, [formRef, formRef?.current, isUnsavedSellingMenu]);

  return (
    <Formik
      initialValues={{
        name: initialValues.name || '',
      }}
      onSubmit={onSubmit}
      validationSchema={SellingMenuValidationSchema}
      innerRef={formRef}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          values,
          errors,
          touched,
          dirty,
          isValid,
          isSubmitting,
          setFieldValue,
        } = props;

        return (
          <View style={{flex: 1, backgroundColor: colors.surface}}>
            <View>
              <Text
                style={{
                  marginTop: 15,
                  marginBottom: 15,
                  fontSize: 16,
                  fontWeight: 'bold',
                }}>
                {'Menu Details'}
              </Text>
              <TextInput
                label="Menu Name"
                onChangeText={handleChange('name')}
                onBlur={handleBlur('name')}
                value={values.name}
                error={errors.name && touched.name ? true : false}
              />
            </View>

            <View style={{flex: 1}}>
              {!editMode && (
                <>
                  <Text
                    style={{
                      marginTop: 25,
                      marginBottom: 15,
                      fontSize: 16,
                      fontWeight: 'bold',
                    }}>
                    {'Menu Items'}
                  </Text>

                  <AddedSellingMenuItemList sellingMenuId={sellingMenuId} />
                </>
              )}

              <View style={{marginTop: 15, marginBottom: 10}}>
                {!editMode && (
                  <Button
                    mode="outlined"
                    icon="plus"
                    onPress={() => {
                      navigation.navigate(routes.selectSellingMenuItems(), {
                        selling_menu_id: sellingMenuId,
                      });
                    }}
                    style={{marginVertical: 5}}>
                    Add Menu Item
                  </Button>
                )}
                <Button
                  mode="contained"
                  onPress={handleSubmit}
                  disabled={
                    isSellingMenuHasSellingMenuItemStatus === 'loading' ||
                    !isSellingMenuHasSellingMenuItemData ||
                    (editMode && !dirty) ||
                    !isValid ||
                    isSubmitting
                  }
                  loading={
                    isSellingMenuHasSellingMenuItemStatus === 'loading' ||
                    isSubmitting
                  }
                  style={{marginVertical: 5}}>
                  Save
                </Button>
              </View>
            </View>
          </View>
        );
      }}
    </Formik>
  );
};

export default SellingMenuForm;
