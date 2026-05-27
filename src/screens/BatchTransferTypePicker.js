import React from 'react';
import {View, StyleSheet, ScrollView} from 'react-native';
import {Text, Card, Badge, useTheme} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import routes from '../constants/routes';

const BatchTransferTypePicker = ({navigation}) => {
  const {colors} = useTheme();

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.heading}>What type of transfer?</Text>

      <Card
        style={styles.card}
        onPress={() => navigation.navigate(routes.batchTransferRequestList())}>
        <Card.Content style={styles.cardContent}>
          <MaterialCommunityIcons
            name="swap-horizontal-bold"
            size={48}
            color={colors.primary}
            style={styles.icon}
          />
          <View style={{flex: 1}}>
            <Text style={styles.cardTitle}>
              Branch to Branch Batch Transfer
            </Text>
            <Text style={styles.cardSubtitle}>
              Send items from your branch to another branch with a stateful
              review-and-receive handshake.
            </Text>
          </View>
        </Card.Content>
      </Card>

      <Card style={[styles.card, styles.disabledCard]}>
        <Card.Content style={styles.cardContent}>
          <MaterialCommunityIcons
            name="clipboard-edit-outline"
            size={48}
            color={colors.disabled}
            style={styles.icon}
          />
          <View style={{flex: 1}}>
            <View style={styles.headerRow}>
              <Text style={[styles.cardTitle, {color: colors.disabled}]}>
                Log Batch Transfer
              </Text>
              <Badge style={styles.comingSoonBadge}>Coming Soon</Badge>
            </View>
            <Text style={[styles.cardSubtitle, {color: colors.disabled}]}>
              Quickly log items as transferred out or in (e.g. to another
              company) without a destination branch.
            </Text>
          </View>
        </Card.Content>
      </Card>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    padding: 16,
  },
  heading: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 16,
  },
  card: {
    marginBottom: 14,
  },
  disabledCard: {
    opacity: 0.7,
  },
  cardContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    marginRight: 14,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 18,
    opacity: 0.75,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  comingSoonBadge: {
    marginLeft: 8,
    backgroundColor: '#FF9800',
  },
});

export default BatchTransferTypePicker;
