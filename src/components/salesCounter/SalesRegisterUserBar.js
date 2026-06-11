import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import useCurrentUser from '../../hooks/useCurrentUser';
import useCloudAuthContext from '../../hooks/useCloudAuthContext';
import {getDeviceShortCode} from '../../utils/stringHelpers';

/**
 * Thin info bar shown just above the Sales Register Grand Total:
 *   - left:  this device's short code (the OR-number prefix, e.g. 7K2A) so the
 *            cashier can tie a printed receipt back to the terminal that issued it
 *   - right: the signed-in user — first name, or "Owner" for the root account —
 *            with a circular avatar showing the name's initial
 */
const SalesRegisterUserBar = () => {
  const {colors} = useTheme();
  const [{authUser}] = useCurrentUser();
  const [cloudState] = useCloudAuthContext();

  const deviceCode = getDeviceShortCode(cloudState?.deviceId);

  const isRoot = !!authUser?.is_root_account;
  const displayName = isRoot
    ? 'Owner'
    : (authUser?.first_name || '').trim() || 'User';
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <View style={styles.deviceChip}>
        <MaterialCommunityIcons
          name="cellphone"
          size={14}
          color={colors.dark}
        />
        <Text style={[styles.deviceCodeText, {color: colors.dark}]}>
          {deviceCode}
        </Text>
      </View>

      <View style={styles.userContainer}>
        <View style={[styles.avatar, {backgroundColor: colors.primary}]}>
          <Text style={[styles.avatarText, {color: colors.surface}]}>
            {initial}
          </Text>
        </View>
        <Text
          style={[styles.userName, {color: colors.dark}]}
          numberOfLines={1}>
          {displayName}
        </Text>
      </View>
    </View>
  );
};

export default SalesRegisterUserBar;

const styles = StyleSheet.create({
  container: {
    // Match the Grand Total container's effective horizontal inset
    // (marginHorizontal 5 + paddingHorizontal 10 = 15) so the device code and
    // the "Grand Total" label below it line up on the same left/right edges.
    marginTop: 8,
    marginBottom: 2,
    marginHorizontal: 5,
    paddingHorizontal: 10,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  deviceChip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ECECEC',
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 14,
  },
  deviceCodeText: {
    marginLeft: 5,
    fontWeight: 'bold',
    fontSize: 12,
    letterSpacing: 1,
  },
  userContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
    marginLeft: 12,
  },
  avatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontWeight: 'bold',
    fontSize: 14,
  },
  userName: {
    marginLeft: 8,
    fontWeight: '500',
    fontSize: 13,
    flexShrink: 1,
  },
});
