import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  HelperText,
  Divider,
} from 'react-native-paper';
import {Formik} from 'formik';
import * as Yup from 'yup';
import {Dropdown} from 'react-native-paper-dropdown';
import {useQuery} from '@tanstack/react-query';

import TextInputLabel from './TextInputLabel';
import FormRequiredFieldHelperText from './FormRequiredFieldsHelperText';
import AccessCheckboxList from './AccessCheckboxList';
import {getCloudRoles} from '../../serverDbQueries/v2/roles';
import {getBranches} from '../../serverDbQueries/v2/branches';
import {getCloudDevices} from '../../serverDbQueries/v2/devices';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';

const LocalUserAccountValidationSchema = Yup.object().shape({
  edit_mode: Yup.boolean(),
  first_name: Yup.string().required(),
  last_name: Yup.string().required(),
  email: Yup.string()
    .email('User email must be a valid email.')
    .required('User email field is required.'),
  password: Yup.string().when('edit_mode', {
    is: false,
    then: () => Yup.string().required(),
  }),
  role_id: Yup.string().required(),
});

const LocalUserAccountForm = props => {
  const {
    editMode = false,
    authUser,
    userAccountUID,
    currentBranchId = null,
    currentDeviceId = null,
    initialValues = {
      first_name: '',
      last_name: '',
      email: '',
      password: '',
      role_id: '',
    },
    onSubmit,
    onCancel,
    submitButtonTitle = 'Create',
  } = props;
  const {colors} = useTheme();
  const userRoleConfig = authUser?.role_config;
  const [showDropDown, setShowDropDown] = useState(false);
  const {status: getRolesStatus, data: getRolesData} = useQuery(
    ['cloudRoles'],
    getCloudRoles,
  );
  // Branch / device access is only granted while creating a user. In edit mode
  // it is managed through the dedicated Manage Branch/Device Access modals, so
  // skip these fetches entirely.
  const {status: getBranchesStatus, data: getBranchesData} = useQuery(
    ['cloudBranches'],
    getBranches,
    {enabled: !editMode},
  );
  const {status: getDevicesStatus, data: getDevicesData} = useQuery(
    ['cloudDevices'],
    getCloudDevices,
    {enabled: !editMode},
  );
  const [roleId, setRoleId] = useState(initialValues.role_id);

  const isDisabled = () => {
    if (!authUser) {
      return true;
    }

    if (authUser.is_root_account) {
      return false;
    }

    if (editMode) {
      return true;
    }
  };

  const renderPasswordField = formikProps => {
    const {handleChange, handleBlur, values, errors, touched} = formikProps;

    if (!editMode) {
      return (
        <TextInput
          label={
            <TextInputLabel
              label="Password"
              required
              error={errors.password && touched.password ? true : false}
            />
          }
          onChangeText={handleChange('password')}
          onBlur={handleBlur('password')}
          disabled={isDisabled()}
          autoCapitalize="none"
          value={values.password}
          error={errors.password && touched.password ? true : false}
        />
      );
    }
  };

  if (getRolesStatus === 'loading') {
    return <DefaultLoadingScreen />;
  }

  if (getRolesStatus === 'error') {
    return (
      <DefaultErrorScreen
        errorTitle="Oops!"
        errorMessage="Something went wrong"
      />
    );
  }

  const roles = getRolesData?.data ?? [];
  const roleSelectionList = roles?.map(role => {
    return {
      label: `${role.name}`,
      value: `${role.id}`,
    };
  });

  const branches = getBranchesData?.data ?? [];
  const devices = getDevicesData?.data ?? [];

  return (
    <Formik
      initialValues={{
        edit_mode: editMode,
        first_name: initialValues.first_name || '',
        last_name: initialValues.last_name || '',
        email: initialValues.email || '',
        password: initialValues.password || '',
        role_id: initialValues.role_id || '',
        // Default the new user's access to the branch and device currently in
        // use so creating a user "just works" on this device/branch.
        branch_ids:
          initialValues.branch_ids ||
          (currentBranchId ? [currentBranchId] : []),
        device_ids:
          initialValues.device_ids ||
          (currentDeviceId ? [currentDeviceId] : []),
      }}
      validationSchema={LocalUserAccountValidationSchema}
      onSubmit={onSubmit}>
      {props => {
        const {
          handleChange,
          handleBlur,
          handleSubmit,
          setFieldValue,
          values,
          errors,
          touched,
          dirty,
          isSubmitting,
          isValid,
        } = props;

        const toggleSelected = (field, id) => {
          const current = values[field] || [];
          setFieldValue(
            field,
            current.includes(id)
              ? current.filter(existingId => existingId !== id)
              : [...current, id],
          );
        };

        return (
          <>
            <FormRequiredFieldHelperText containerStyle={{marginBottom: 10}} />
            <TextInput
              label={
                <TextInputLabel
                  label="First Name"
                  required
                  error={errors.first_name && touched.first_name ? true : false}
                />
              }
              onChangeText={handleChange('first_name')}
              onBlur={handleBlur('first_name')}
              autoCapitalize="words"
              value={values.first_name}
              error={errors.first_name && touched.first_name ? true : false}
              disabled={isDisabled()}
            />
            <TextInput
              label={
                <TextInputLabel
                  label="Last Name"
                  required
                  error={errors.last_name && touched.last_name ? true : false}
                />
              }
              onChangeText={handleChange('last_name')}
              onBlur={handleBlur('last_name')}
              autoCapitalize="words"
              value={values.last_name}
              error={errors.last_name && touched.last_name ? true : false}
              disabled={isDisabled()}
            />
            <TextInput
              label={
                <TextInputLabel
                  label="Email"
                  required
                  error={errors.email && touched.email ? true : false}
                />
              }
              onChangeText={handleChange('email')}
              onBlur={handleBlur('email')}
              keyboardType="email-address"
              autoCapitalize="none"
              value={values.email}
              error={errors.email && touched.email ? true : false}
              disabled={isDisabled()}
            />
            <HelperText
              style={{
                color: colors.dark,
                marginVertical: 10,
                fontStyle: 'italic',
              }}>
              {`* Their email will be their username to login.`}
            </HelperText>
            {renderPasswordField(props)}
            <Dropdown
              label={'Role'}
              mode={'flat'}
              visible={showDropDown}
              showDropDown={() => setShowDropDown(true)}
              onDismiss={() => setShowDropDown(false)}
              value={roleId}
              hideMenuHeader
              onSelect={value => {
                if (isDisabled()) return;

                setRoleId(value);
                handleChange('role_id')(value);
              }}
              inputProps={{
                disabled: isDisabled(),
                label: (
                  <TextInputLabel
                    label="Role"
                    required
                    error={errors.role_id && touched.role_id ? true : false}
                  />
                ),
              }}
              options={roleSelectionList}
              activeColor={colors.accent}
              dropDownItemSelectedTextStyle={{fontWeight: 'bold'}}
              dropDownItemTextStyle={
                isDisabled() ? {color: colors.disabled} : {}
              }
            />
            {!editMode && (
              <>
                <Divider style={styles.sectionDivider} />
                <Text style={[styles.sectionTitle, {color: colors.dark}]}>
                  Manage Branch Access
                </Text>
                <HelperText style={styles.sectionHint}>
                  {
                    'Select the branches this user can access. The current branch is checked by default.'
                  }
                </HelperText>
                <AccessCheckboxList
                  items={branches}
                  isLoading={getBranchesStatus === 'loading'}
                  selectedIds={values.branch_ids}
                  onToggle={id => toggleSelected('branch_ids', id)}
                  currentId={currentBranchId}
                  currentLabel="Current branch"
                  emptyText="No branches found."
                />

                <Divider style={styles.sectionDivider} />
                <Text style={[styles.sectionTitle, {color: colors.dark}]}>
                  Manage Device Access
                </Text>
                <HelperText style={styles.sectionHint}>
                  {
                    'Select the devices this user can sign in on. The current device is checked by default.'
                  }
                </HelperText>
                <AccessCheckboxList
                  items={devices}
                  isLoading={getDevicesStatus === 'loading'}
                  selectedIds={values.device_ids}
                  onToggle={id => toggleSelected('device_ids', id)}
                  currentId={currentDeviceId}
                  currentLabel="This device"
                  emptyText="No registered devices found."
                />
              </>
            )}
            <Button
              mode="contained"
              onPress={handleSubmit}
              disabled={!dirty || !isValid || isSubmitting || isDisabled()}
              loading={isSubmitting}
              style={{marginTop: 20}}>
              {submitButtonTitle}
            </Button>
            <Button onPress={onCancel} style={{marginTop: 10}}>
              Cancel
            </Button>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  sectionDivider: {
    marginTop: 20,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: 'bold',
  },
  sectionHint: {
    fontStyle: 'italic',
    marginBottom: 4,
  },
});

export default LocalUserAccountForm;
