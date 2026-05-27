import React from 'react';
import {StyleSheet} from 'react-native';
import {Badge} from 'react-native-paper';

const STATUS_COLORS = {
  draft: '#9E9E9E',
  requested: '#FB8C00',
  accepted: '#1E88E5',
  transferring: '#8E24AA',
  received: '#43A047',
  cancelled: '#757575',
  rejected: '#E53935',
};

const STATUS_LABELS = {
  draft: 'Draft',
  requested: 'Transfer Requested',
  accepted: 'Request Accepted',
  transferring: 'Item(s) Transferring',
  received: 'Item(s) Received',
  cancelled: 'Cancelled',
  rejected: 'Rejected',
};

const TransferStatusBadge = ({status, style}) => {
  const color = STATUS_COLORS[status] || '#9E9E9E';
  const label = STATUS_LABELS[status] || status || 'Unknown';
  return (
    <Badge style={[styles.badge, {backgroundColor: color}, style]}>
      {label}
    </Badge>
  );
};

const styles = StyleSheet.create({
  badge: {
    paddingHorizontal: 10,
    fontSize: 11,
    alignSelf: 'flex-start',
  },
});

export default TransferStatusBadge;
