import {StyleSheet, Text, View} from 'react-native';
import React from 'react';
import {Drawer, useTheme} from 'react-native-paper';
import useAuthContext from '../hooks/useAuthContext';
import {useNavigation} from '@react-navigation/native';
import routes from '../constants/routes';

const Settings = () => {
  const [active, setActive] = React.useState('');
  const {colors} = useTheme();
  const [_authState, {signOut}] = useAuthContext();
  const navigation = useNavigation();

  return (
    <View style={[styles.container, {backgroundColor: colors.surface}]}>
      <Drawer.Section title="General">
        <Drawer.Item
          style={styles.itemStyle}
          label="Account"
          onPress={() => {
            navigation.navigate(routes.account());
          }}
        />
        <Drawer.Item
          style={styles.itemStyle}
          label="Company Profile"
          onPress={() => {
            navigation.navigate(routes.updateCompany());
          }}
        />
        <Drawer.Item
          style={[styles.itemStyle]}
          label="Currency"
          onPress={() => {
            navigation.navigate(routes.currencies());
          }}
        />
      </Drawer.Section>
      <Drawer.Section title="Devices">
        <Drawer.Item
          style={styles.itemStyle}
          label="Printers"
          onPress={() => {
            navigation.navigate(routes.printers());
          }}
        />
      </Drawer.Section>
      <Drawer.Section title="Activation">
        <Drawer.Item
          style={styles.itemStyle}
          label="Activate License"
          onPress={() => {
            navigation.navigate(routes.activateLicense());
          }}
        />
      </Drawer.Section>
      {/* <Drawer.Section title="Food Costing">
        <Drawer.Item
          style={styles.itemStyle}
          label="Ideal Food Cost"
          onPress={() => {}}
        />
      </Drawer.Section>
      <Drawer.Section title="Privacy & Security">
        <Drawer.Item
          style={styles.itemStyle}
          label="Terms of Service"
          onPress={() => {}}
        />
        <Drawer.Item
          style={styles.itemStyle}
          label="Privacy Policy"
          onPress={() => {}}
        />
      </Drawer.Section> */}
    </View>
  );
};

export default Settings;

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  itemStyle: {
    paddingLeft: 10,
  },
});
