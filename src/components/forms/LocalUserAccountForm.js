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
import {getCloudBranchAccountAssignments} from '../../serverDbQueries/v2/branchAccountAssignments';
import {getCloudDeviceAccountAssignments} from '../../serverDbQueries/v2/deviceAccountAssignments';
import DefaultLoadingScreen from '../stateIndicators/DefaultLoadingScreen';
import DefaultErrorScreen from '../stateIndicators/DefaultErrorScreen';
import CreateRoleModal from '../modals/CreateRoleModal';
import useRoleAccess from '../../hooks/useRoleAccess';

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
  branch_ids: Yup.array().min(1, 'Assign at least one branch.'),
  device_ids: Yup.array().min(1, 'Assign at least one device.'),
});

const LocalUserAccountForm = props => {
  const {
    editMode = false,
    authUser,
    userAccountUID,
    userAccountId,
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
  const {can} = useRoleAccess();
  const userRoleConfig = authUser?.role_config;
  const [showDropDown, setShowDropDown] = useState(false);
  const [createRoleModalVisible, setCreateRoleModalVisible] = useState(false);
  const {status: getRolesStatus, data: getRolesData} = useQuery(
    ['cloudRoles'],
    getCloudRoles,
  );
  const {status: getBranchesStatus, data: getBranchesData} = useQuery(
    ['cloudBranches'],
    getBranches,
  );
  const {status: getDevicesStatus, data: getDevicesData} = useQuery(
    ['cloudDevices'],
    getCloudDevices,
  );
  // In edit mode, pre-check the branches/devices the account is already
  // assigned to. (Disabled queries report status 'loading' in RQ v4, so the
  // loading gate below guards these with `editMode && userAccountId`.)
  const {
    status: branchAssignmentsStatus,
    data: branchAssignmentsData,
  } = useQuery(
    ['cloudBranchAccountAssignments', {account_id: userAccountId}],
    () => getCloudBranchAccountAssignments({account_id: userAccountId}),
    {enabled: editMode && !!userAccountId},
  );
  const {
    status: deviceAssignmentsStatus,
    data: deviceAssignmentsData,
  } = useQuery(
    ['cloudDeviceAccountAssignments', {account_id: userAccountId}],
    () => getCloudDeviceAccountAssignments({account_id: userAccountId}),
    {enabled: editMode && !!userAccountId},
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

  const isInitialDataLoading =
    getRolesStatus === 'loading' ||
    getBranchesStatus === 'loading' ||
    getDevicesStatus === 'loading' ||
    (editMode &&
      !!userAccountId &&
      (branchAssignmentsStatus === 'loading' ||
        deviceAssignmentsStatus === 'loading'));

  if (isInitialDataLoading) {
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

  // Pre-check: in edit mode use the account's current assignments; in create
  // mode default to the branch/device currently in use so it "just works".
  const branchAssignments = branchAssignmentsData?.data ?? [];
  const deviceAssignments = deviceAssignmentsData?.data ?? [];
  const initialBranchIds = editMode
    ? branchAssignments.map(a => a.branch_id)
    : initialValues.branch_ids || (currentBranchId ? [currentBranchId] : []);
  const initialDeviceIds = editMode
    ? deviceAssignments.map(a => a.device_id)
    : initialValues.device_ids || (currentDeviceId ? [currentDeviceId] : []);

  return (
    <Formik
      initialValues={{
        edit_mode: editMode,
        first_name: initialValues.first_name || '',
        last_name: initialValues.last_name || '',
        email: initialValues.email || '',
        password: initialValues.password || '',
        role_id: initialValues.role_id || '',
        branch_ids: initialBranchIds,
        device_ids: initialDeviceIds,
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
            {!isDisabled() && can('userManagement.manageRoles') ? (
              <Button
                icon="plus"
                compact
                onPress={() => setCreateRoleModalVisible(true)}
                style={styles.newRoleButton}
                contentStyle={styles.newRoleButtonContent}>
                New role
              </Button>
            ) : null}
            <CreateRoleModal
              visible={createRoleModalVisible}
              onDismiss={() => setCreateRoleModalVisible(false)}
              onCreated={role => {
                if (!role?.id) return;
                const newRoleId = `${role.id}`;
                setRoleId(newRoleId);
                handleChange('role_id')(newRoleId);
              }}
            />
            <Divider style={styles.sectionDivider} />
            <Text style={[styles.sectionTitle, {color: colors.dark}]}>
              Manage Branch Access
            </Text>
            <HelperText style={styles.sectionHint}>
              {editMode
                ? 'Select the branches this user can access.'
                : 'Select the branches this user can access. The current branch is checked by default.'}
            </HelperText>
            <AccessCheckboxList
              items={branches}
              isLoading={getBranchesStatus === 'loading'}
              selectedIds={values.branch_ids}
              onToggle={id => toggleSelected('branch_ids', id)}
              currentId={currentBranchId}
              currentLabel="Current branch"
              emptyText="No branches found."
              disabled={isDisabled()}
            />
            {errors.branch_ids ? (
              <HelperText type="error" visible={true}>
                {errors.branch_ids}
              </HelperText>
            ) : null}

            <Divider style={styles.sectionDivider} />
            <Text style={[styles.sectionTitle, {color: colors.dark}]}>
              Manage Device Access
            </Text>
            <HelperText style={styles.sectionHint}>
              {editMode
                ? 'Select the devices this user can sign in on.'
                : 'Select the devices this user can sign in on. The current device is checked by default.'}
            </HelperText>
            <AccessCheckboxList
              items={devices}
              isLoading={getDevicesStatus === 'loading'}
              selectedIds={values.device_ids}
              onToggle={id => toggleSelected('device_ids', id)}
              currentId={currentDeviceId}
              currentLabel="This device"
              emptyText="No registered devices found."
              disabled={isDisabled()}
            />
            {errors.device_ids ? (
              <HelperText type="error" visible={true}>
                {errors.device_ids}
              </HelperText>
            ) : null}
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
  newRoleButton: {
    alignSelf: 'flex-start',
    marginTop: 4,
  },
  newRoleButtonContent: {
    paddingHorizontal: 0,
  },
  sectionHint: {
    fontStyle: 'italic',
    marginBottom: 4,
  },
});

export default LocalUserAccountForm;
