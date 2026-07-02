import React, {useState} from 'react';
import {View, StyleSheet} from 'react-native';
import {ScrollView} from 'react-native-gesture-handler';
import {
  TextInput,
  Button,
  Text,
  useTheme,
  HelperText,
  Divider,
  Switch,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
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
  // Executives are co-owners with full implicit access to all branches/devices,
  // so they carry no role and need no branch/device assignment. Those fields are
  // required only for regular team members.
  is_executive_account: Yup.boolean(),
  role_id: Yup.string().when('is_executive_account', {
    is: true,
    then: () => Yup.string().nullable(),
    otherwise: () => Yup.string().required(),
  }),
  branch_ids: Yup.array().when('is_executive_account', {
    is: true,
    then: () => Yup.array(),
    otherwise: () => Yup.array().min(1, 'Assign at least one branch.'),
  }),
  device_ids: Yup.array().when('is_executive_account', {
    is: true,
    then: () => Yup.array(),
    otherwise: () => Yup.array().min(1, 'Assign at least one device.'),
  }),
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
  // An executive can only manage members who share one of their branches, so a
  // member they create with no branch access would fall permanently outside
  // their scope. `branch_ids: min(1)` already blocks that below; this flag just
  // lets the branch hint explain WHY at least one branch is required for them.
  const viewerIsExecutive =
    !!authUser?.is_executive_account && !authUser?.is_root_account;
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
  const {status: branchAssignmentsStatus, data: branchAssignmentsData} =
    useQuery(
      ['cloudBranchAccountAssignments', {account_id: userAccountId}],
      () => getCloudBranchAccountAssignments({account_id: userAccountId}),
      {enabled: editMode && !!userAccountId},
    );
  const {status: deviceAssignmentsStatus, data: deviceAssignmentsData} =
    useQuery(
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
    return (
      <View style={styles.stateScreen}>
        <DefaultLoadingScreen />
      </View>
    );
  }

  if (getRolesStatus === 'error') {
    return (
      <View style={styles.stateScreen}>
        <DefaultErrorScreen
          errorTitle="Oops!"
          errorMessage="Something went wrong"
        />
      </View>
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
        is_executive_account: !!initialValues.is_executive_account,
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
            {/* Scrollable content */}
            <ScrollView
              style={styles.formScroll}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled">
              <FormRequiredFieldHelperText
                containerStyle={{marginBottom: 10}}
              />
              <TextInput
                label={
                  <TextInputLabel
                    label="First Name"
                    required
                    error={
                      errors.first_name && touched.first_name ? true : false
                    }
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
              {/* Executive (co-owner) toggle — root-only. An executive can set up
                branches/devices on the owner's behalf and has full access, so
                it carries no role and needs no branch/device assignment. */}
              {authUser?.is_root_account ? (
                <View style={styles.executiveRow}>
                  <View style={styles.executiveRowText}>
                    <View style={styles.executiveTitleRow}>
                      <MaterialCommunityIcons
                        name="star"
                        size={18}
                        color={colors.accent}
                      />
                      <Text
                        style={[styles.executiveTitle, {color: colors.dark}]}>
                        Executive account
                      </Text>
                    </View>
                    <HelperText style={styles.executiveHint}>
                      A trusted account who can set up branches and devices and
                      has full access. Only you (the owner) can manage
                      executives.
                    </HelperText>
                  </View>
                  <Switch
                    value={values.is_executive_account}
                    color={colors.accent}
                    onValueChange={next => {
                      setFieldValue('is_executive_account', next);
                      if (next) {
                        // An executive carries no role and self-bootstraps devices,
                        // so clear those — but KEEP branch_ids: root limits which
                        // branches an executive may access via the checklist below.
                        setRoleId('');
                        setFieldValue('role_id', '');
                        setFieldValue('device_ids', []);
                      }
                    }}
                  />
                </View>
              ) : null}
              {values.is_executive_account ? null : (
                <>
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
                          error={
                            errors.role_id && touched.role_id ? true : false
                          }
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
                </>
              )}
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
              {/* Branch access — shown for both regular members and executives.
                For an executive this is the root-only restriction: an executive
                can access ONLY the branches checked here (none = no branch
                access; branches they create are added automatically). */}
              <Divider style={styles.sectionDivider} />
              <Text style={[styles.sectionTitle, {color: colors.dark}]}>
                Manage Branch Access
              </Text>
              <HelperText style={styles.sectionHint}>
                {values.is_executive_account
                  ? "Select the branches this executive can access. They'll have no branch access until you assign at least one (branches they create are added automatically)."
                  : viewerIsExecutive
                  ? "Select the branches this member can access. Assign at least one — a member with no branch access falls outside your branches and you won't be able to manage them afterward."
                  : editMode
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

              {/* Device access — executives self-bootstrap their own devices on the
                Owner / Executive screen, so no device assignment is needed. */}
              {values.is_executive_account ? null : (
                <>
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
                </>
              )}
            </ScrollView>

            {/* Fixed footer — kept outside the ScrollView so a tap right after
                scrolling isn't eaten by the scroll gesture. */}
            <View style={styles.formFooter}>
              <Button
                mode="contained"
                onPress={handleSubmit}
                disabled={!dirty || !isValid || isSubmitting || isDisabled()}
                loading={isSubmitting}>
                {submitButtonTitle}
              </Button>
              <Button onPress={onCancel} style={styles.cancelButton}>
                Cancel
              </Button>
            </View>
          </>
        );
      }}
    </Formik>
  );
};

const styles = StyleSheet.create({
  formScroll: {
    // Shrink to fit between the title and the fixed footer; only this area
    // scrolls. (RN default flexShrink is 0, so it must be set explicitly.)
    flexShrink: 1,
  },
  formFooter: {
    paddingTop: 12,
  },
  cancelButton: {
    marginTop: 10,
  },
  stateScreen: {
    minHeight: 220,
    justifyContent: 'center',
  },
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
  executiveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 14,
  },
  executiveRowText: {
    flex: 1,
    paddingRight: 10,
  },
  executiveTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  executiveTitle: {
    fontSize: 15,
    fontWeight: 'bold',
    marginLeft: 6,
  },
  executiveHint: {
    fontStyle: 'italic',
    paddingHorizontal: 0,
  },
});

export default LocalUserAccountForm;
