import React from 'react';
import {View, StyleSheet} from 'react-native';
import {Text} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {STATUS_COLORS} from './TransferStatusBadge';

const GRAY = '#BDBDBD';

/**
 * Vertical progress timeline for a Batch Transfer request.
 *
 * Each step shows a circle on the left connected vertically to the next step.
 * A step that has been reached (its timestamp exists) is filled with the
 * status' color code; steps not yet reached stay gray. The connector line into
 * a step is colored only when that step is reached, so the colored portion of
 * the line visually tracks how far the request has progressed.
 *
 * A step can also be *skipped* — e.g. "Transfer Now" moves a request straight
 * to Transferring without an Accepted step. A skipped step has no timestamp of
 * its own but a later step does; it renders "Skipped" (with a dash marker)
 * instead of "Pending" so the gap reads as intentional rather than waiting.
 */
const TransferStatusTimeline = ({steps, formatDate}) => {
  const lastReachedIndex = steps.reduce(
    (acc, step, i) => (step.date ? i : acc),
    -1,
  );

  return (
    <View style={styles.container}>
      {steps.map((step, index) => {
        const reached = Boolean(step.date);
        const skipped = !reached && index < lastReachedIndex;
        const color = reached ? step.color : GRAY;
        const isFirst = index === 0;
        const isLast = index === steps.length - 1;

        return (
          <View key={step.key} style={styles.row}>
            <View style={styles.gutter}>
              <View
                style={[
                  styles.connector,
                  {backgroundColor: isFirst ? 'transparent' : color},
                ]}
              />
              <View style={[styles.circle, {borderColor: color}]}>
                {reached ? (
                  <MaterialCommunityIcons
                    name="check"
                    size={12}
                    color="#fff"
                    style={[styles.check, {backgroundColor: color}]}
                  />
                ) : skipped ? (
                  <MaterialCommunityIcons
                    name="minus"
                    size={14}
                    color={GRAY}
                  />
                ) : (
                  <View style={[styles.dot, {backgroundColor: GRAY}]} />
                )}
              </View>
              <View
                style={[
                  styles.connector,
                  {
                    backgroundColor: isLast
                      ? 'transparent'
                      : steps[index + 1].date
                      ? steps[index + 1].color
                      : GRAY,
                  },
                ]}
              />
            </View>

            <View style={styles.content}>
              <Text
                style={[
                  styles.label,
                  {color: reached ? '#212121' : GRAY},
                  reached && styles.labelReached,
                ]}>
                {step.label}
              </Text>
              <Text style={[styles.date, {color: reached ? '#616161' : GRAY}]}>
                {reached
                  ? formatDate(step.date)
                  : skipped
                  ? 'Skipped'
                  : 'Pending'}
              </Text>
            </View>
          </View>
        );
      })}
    </View>
  );
};

const CIRCLE = 22;

const styles = StyleSheet.create({
  container: {marginTop: 10},
  row: {flexDirection: 'row'},
  gutter: {width: CIRCLE, alignItems: 'center'},
  connector: {width: 2, flex: 1, minHeight: 10},
  circle: {
    width: CIRCLE,
    height: CIRCLE,
    borderRadius: CIRCLE / 2,
    borderWidth: 2,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    width: CIRCLE - 6,
    height: CIRCLE - 6,
    borderRadius: (CIRCLE - 6) / 2,
    textAlign: 'center',
    textAlignVertical: 'center',
    lineHeight: CIRCLE - 6,
    overflow: 'hidden',
  },
  dot: {width: 8, height: 8, borderRadius: 4},
  content: {flex: 1, paddingLeft: 10, paddingVertical: 4, justifyContent: 'center'},
  label: {fontSize: 13},
  labelReached: {fontWeight: '600'},
  date: {fontSize: 11, marginTop: 1},
});

export {STATUS_COLORS};
export default TransferStatusTimeline;
