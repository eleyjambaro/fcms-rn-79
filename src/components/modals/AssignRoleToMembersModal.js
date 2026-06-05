import React, {useState, useEffect} from 'react';
import {View, ScrollView, StyleSheet} from 'react-native';
import {
  Modal,
  Portal,
  Title,
  Text,
  Button,
  Checkbox,
  Divider,
  TouchableRipple,
  HelperText,
  useTheme,
  ActivityIndicator,
} from 'react-native-paper';
import {useQuery, useMutation, useQueryClient} from '@tanstack/react-query';

import {
  getCloudSubAccounts,
  updateCloudSubAccount,
} from '../../serverDbQueries/v2/accounts';

const AssignRoleToMembersModal = ({visible, onDismiss, role}) => {
  const {colors} = useTheme();
  const queryClient = useQueryClient();
  const roleId = role?.id;

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [serverError, setServerError] = useState('');

  const {data, status} = useQuery(['cloudSubAccounts'], getCloudSubAccounts, {
    enabled: visible,
  });

  const updateMutation = useMutation(updateCloudSubAccount);

  // Reset selection and errors each time the modal is opened.
  useEffect(() => {
    if (visible) {
      setSelectedIds(new Set());
      setServerError('');
    }
  }, [visible]);

  const members = data?.data ?? [];

  const toggle = memberId => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(memberId)) {
        next.delete(memberId);
      } else {
        next.add(memberId);
      }
      return next;
    });
  };

  const handleAssign = async () => {
    if (!roleId || selectedIds.size === 0) return;
    setServerError('');
    try {
      await Promise.all(
        [...selectedIds].map(id =>
          updateMutation.mutateAsync({id, role_id: roleId}),
        ),
      );
      queryClient.invalidateQueries(['cloudSubAccounts']);
      onDismiss();
    } catch (error) {
      setServerError(
        error?.response?.data?.message || 'Failed to assign role.',
      );
    }
  };

  const isLoading = status === 'loading';

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={[
          styles.container,
          {backgroundColor: colors.surface},
        ]}>
        <Title style={styles.title}>Assign Role to Team Members</Title>
        {role ? (
          <Text style={styles.subtitle}>{role.name}</Text>
        ) : null}
        <Divider style={styles.divider} />
        <Text style={styles.hint}>
          Only team members without a role can be assigned. Members who already
          have a role are shown disabled.
        </Text>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} />
        ) : members.length === 0 ? (
          <Text style={styles.empty}>No team members found.</Text>
        ) : (
          <ScrollView style={styles.list} showsVerticalScrollIndicator={false}>
            {members.map(member => {
              // A member whose role was deleted keeps a stale role_id but has a
              // null role_name, so key "has a role" off the resolved role name.
              const hasRole = !!member.role_name;
              const isChecked = selectedIds.has(member.id);
              const fullName =
                `${member.first_name ?? ''} ${member.last_name ?? ''}`.trim();
              return (
                <TouchableRipple
                  key={member.id}
                  disabled={hasRole}
                  onPress={() => toggle(member.id)}>
                  <View style={[styles.row, hasRole && styles.rowDisabled]}>
                    <Checkbox.Android
                      status={isChecked ? 'checked' : 'unchecked'}
                      disabled={hasRole}
                      onPress={() => toggle(member.id)}
                      color={colors.primary}
                    />
                    <View style={styles.memberInfo}>
                      <Text
                        style={[
                          styles.memberName,
                          hasRole && {color: colors.neutralTint3},
                        ]}>
                        {fullName || member.email}
                      </Text>
                      <Text
                        style={[
                          styles.memberRole,
                          {
                            color: hasRole
                              ? colors.neutralTint2
                              : colors.notification,
                          },
                        ]}>
                        {hasRole
                          ? member.role_name
                          : 'No role assigned'}
                      </Text>
                    </View>
                  </View>
                </TouchableRipple>
              );
            })}
          </ScrollView>
        )}
        {serverError ? (
          <HelperText type="error">{serverError}</HelperText>
        ) : null}
        <Button
          mode="contained"
          onPress={handleAssign}
          disabled={selectedIds.size === 0 || updateMutation.isLoading}
          loading={updateMutation.isLoading}
          style={styles.assignButton}>
          {selectedIds.size > 0
            ? `Assign Role (${selectedIds.size})`
            : 'Assign Role'}
        </Button>
        <Button
          mode="outlined"
          onPress={onDismiss}
          style={styles.closeButton}>
          Cancel
        </Button>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  container: {
    margin: 20,
    padding: 20,
    borderRadius: 8,
  },
  title: {
    textAlign: 'center',
    marginBottom: 4,
  },
  subtitle: {
    textAlign: 'center',
    opacity: 0.7,
    marginBottom: 8,
    fontWeight: '600',
  },
  divider: {
    marginVertical: 10,
  },
  hint: {
    fontSize: 12,
    opacity: 0.6,
    marginBottom: 8,
  },
  loader: {
    marginVertical: 20,
  },
  empty: {
    textAlign: 'center',
    opacity: 0.5,
    marginVertical: 16,
  },
  list: {
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 4,
  },
  rowDisabled: {
    opacity: 0.6,
  },
  memberInfo: {
    flex: 1,
    marginLeft: 8,
  },
  memberName: {
    fontSize: 15,
    fontWeight: '600',
  },
  memberRole: {
    fontSize: 12,
    marginTop: 1,
  },
  assignButton: {
    marginTop: 16,
    borderRadius: 8,
  },
  closeButton: {
    marginTop: 8,
  },
});

export default AssignRoleToMembersModal;
