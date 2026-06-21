import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

const INFO_COLOR = '#1E88E5';
const DONE_COLOR = '#43A047';
const GRAY = '#BDBDBD';

/**
 * Vertical "what happens next" guide for the New Batch Transfer screen.
 *
 * Styled like the request status timeline (connected circles down the left
 * side), but this is NOT a progress indicator — it's a static overview of the
 * stages a request goes through, with a short description of each. The
 * descriptions change depending on whether the current branch is making an
 * OUT request (it is the source, sending items) or an IN request (it is the
 * destination, asking the source to send items). The status nodes are drawn
 * gray on purpose — none of those stages have happened yet, so nothing here is
 * colored as "done"; only the active first node carries color.
 *
 * The first node is the only interactive one: it reflects whether the user has
 * picked the counterparty branch yet (info icon → green check). Until a branch
 * is selected only that first node is shown; the status overview (Requested →
 * Received) is revealed once a branch has been chosen.
 */
const TransferRequestGuide = ({isOut, branchSelected}) => {
  const branchWord = isOut ? 'destination' : 'source';

  const statusSteps = [
    {
      key: 'requested',
      label: 'Requested',
      description: isOut
        ? 'You submit this request to send items out to the destination branch.'
        : 'You submit this request asking the source branch to send you items.',
    },
    {
      key: 'accepted',
      label: 'Accepted',
      description: isOut
        ? 'The destination branch reviews and accepts your request.'
        : 'The source branch reviews and accepts your request.',
    },
    {
      key: 'transferring',
      label: 'Transferring',
      description: isOut
        ? 'You dispatch the items and they head to the destination. No stock moves yet — it is logged only on receipt.'
        : 'The source branch dispatches the items. No stock moves yet — it is logged only on receipt.',
    },
    {
      key: 'received',
      label: 'Received',
      description: isOut
        ? 'The destination branch confirms receipt. Only now is stock logged — out of your branch and into theirs.'
        : 'You confirm receipt. Only now is stock logged — out of the source branch and into your stock.',
    },
  ];

  const actionColor = branchSelected ? DONE_COLOR : INFO_COLOR;
  const enterRow = {
    key: 'enter',
    isAction: true,
    color: actionColor,
    label: `Enter the ${branchWord} branch.`,
    description: branchSelected
      ? 'Branch selected — tap Next to choose items and quantities.'
      : `Pick the branch to ${
          isOut ? 'send items to' : 'request items from'
        } using the field above.`,
  };
  // Only reveal the status overview once a branch has been chosen.
  const rows = branchSelected ? [enterRow, ...statusSteps] : [enterRow];

  return (
    <View style={styles.container}>
      {rows.map((row, index) => {
        const isFirst = index === 0;
        const isLast = index === rows.length - 1;
        // Only the active first node is colored; status stages stay gray since
        // none of them have happened yet.
        const markColor = row.isAction ? row.color : GRAY;

        return (
          <View key={row.key} style={styles.row}>
            <View style={styles.gutter}>
              <View
                style={[styles.connector, isFirst && styles.connectorHidden]}
              />
              <View style={[styles.circle, {borderColor: markColor}]}>
                {row.isAction ? (
                  <MaterialCommunityIcons
                    name={branchSelected ? 'check' : 'information-variant'}
                    size={15}
                    color={markColor}
                  />
                ) : (
                  <View style={[styles.dot, {backgroundColor: markColor}]} />
                )}
              </View>
              <View
                style={[styles.connector, isLast && styles.connectorHidden]}
              />
            </View>

            <View style={styles.content}>
              <Text style={[styles.label, {color: markColor}]}>
                {row.label}
              </Text>
              <Text style={styles.description}>{row.description}</Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const CIRCLE = 26;

const styles = StyleSheet.create({
  container: {marginTop: 4},
  row: {flexDirection: 'row'},
  gutter: {width: CIRCLE, alignItems: 'center'},
  connector: {
    width: 2,
    flex: 1,
    minHeight: 8,
    backgroundColor: '#E0E0E0',
  },
  connectorHidden: {backgroundColor: 'transparent'},
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {width: 9, height: 9, borderRadius: 4.5},
  content: {flex: 1, paddingLeft: 10, paddingTop: 2, paddingBottom: 14},
  label: {fontSize: 13, fontWeight: '600'},
  description: {
    fontSize: 11,
    lineHeight: 16,
    color: '#757575',
    marginTop: 1,
  },
});

export default TransferRequestGuide;
