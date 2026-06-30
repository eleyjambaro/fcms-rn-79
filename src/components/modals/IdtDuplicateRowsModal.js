import React from 'react';
import {StyleSheet, View, ScrollView} from 'react-native';
import {
  Portal,
  Modal,
  Title,
  Text,
  Button,
  useTheme,
} from 'react-native-paper';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';

import {IDT_COLUMNS} from '../../constants/inventoryDataTemplate';

const STATUS_WIDTH = 90;
const ROW_NUM_WIDTH = 64;
// Per-field column widths, reusing IDT_COLUMNS' own `width` (character units) as
// a rough basis so the table reads like the template file.
const colWidth = c => Math.max(80, Math.round((c.width || 12) * 8));

/**
 * Shows the within-file duplicate rows the IDT import skipped, laid out like the
 * uploaded template (one column per IDT field) so it reads like the file itself.
 * Each item name is grouped: the first row is the one that was imported, the rest
 * were skipped. Columns are driven off IDT_COLUMNS so this stays in lockstep with
 * the single source of truth. Mirrors the web's DuplicateRowsDialog.
 */
const IdtDuplicateRowsModal = props => {
  const {visible, onDismiss, groups = []} = props;
  const {colors} = useTheme();

  const skippedCount = groups.reduce((n, g) => n + g.skipped.length, 0);
  const groupCount = groups.length;

  // Flatten groups into display rows: kept first, then its skipped rows.
  const rows = [];
  groups.forEach((g, gi) => {
    rows.push({occ: g.kept, imported: true, firstInGroup: true, groupIndex: gi});
    g.skipped.forEach(occ =>
      rows.push({occ, imported: false, firstInGroup: false, groupIndex: gi}),
    );
  });

  const renderHeaderCell = (label, width, key) => (
    <View key={key} style={[styles.cell, styles.headerCell, {width}]}>
      <Text style={styles.headerText} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );

  const renderStatus = imported =>
    imported ? (
      <View style={styles.statusInner}>
        <MaterialCommunityIcons
          name="check-circle"
          size={14}
          color="#059669"
        />
        <Text style={[styles.statusText, {color: '#059669'}]}>Imported</Text>
      </View>
    ) : (
      <View style={styles.statusInner}>
        <MaterialCommunityIcons
          name="alert-circle"
          size={14}
          color="#d97706"
        />
        <Text style={[styles.statusText, {color: '#d97706'}]}>Skipped</Text>
      </View>
    );

  return (
    <Portal>
      <Modal
        visible={visible}
        onDismiss={onDismiss}
        contentContainerStyle={styles.modalContainer}>
        <Title style={{marginBottom: 4}}>Skipped duplicate item names</Title>
        <Text style={{color: colors.backdrop, marginBottom: 12}}>
          {`${skippedCount} row(s) across ${groupCount} item name(s) were skipped. For each name, only the first row in the file is imported; the rest are skipped. Check whether a skipped row carried stock or cost that the imported row is missing.`}
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator>
          <View>
            {/* Header row */}
            <View style={[styles.row, styles.headerRow]}>
              {renderHeaderCell('Status', STATUS_WIDTH, 'status')}
              {renderHeaderCell('Sheet row', ROW_NUM_WIDTH, 'sheetrow')}
              {IDT_COLUMNS.map(c =>
                renderHeaderCell(c.header, colWidth(c), c.field),
              )}
            </View>

            {/* Data rows */}
            <ScrollView style={styles.body} showsVerticalScrollIndicator>
              {rows.map((r, idx) => {
                const topBorder =
                  r.firstInGroup && r.groupIndex > 0
                    ? {borderTopWidth: 2, borderTopColor: '#cbd5e1'}
                    : null;
                const rowBg = r.imported ? null : {backgroundColor: '#fffbeb'};
                return (
                  <View
                    key={idx}
                    style={[styles.row, topBorder, rowBg]}>
                    <View style={[styles.cell, {width: STATUS_WIDTH}]}>
                      {renderStatus(r.imported)}
                    </View>
                    <View style={[styles.cell, {width: ROW_NUM_WIDTH}]}>
                      <Text style={styles.rowNumText}>{r.occ.sourceRow}</Text>
                    </View>
                    {IDT_COLUMNS.map(c => {
                      const value = String(r.occ.row?.[c.field] ?? '');
                      const isName = c.field === 'item_name';
                      return (
                        <View
                          key={c.field}
                          style={[styles.cell, {width: colWidth(c)}]}>
                          <Text
                            style={[
                              styles.cellText,
                              isName && styles.cellTextStrong,
                              !value && styles.cellTextMuted,
                            ]}
                            numberOfLines={2}>
                            {value || '—'}
                          </Text>
                        </View>
                      );
                    })}
                  </View>
                );
              })}
            </ScrollView>
          </View>
        </ScrollView>

        <View style={{marginTop: 12, alignItems: 'flex-end'}}>
          <Button onPress={onDismiss} color={colors.primary}>
            Close
          </Button>
        </View>
      </Modal>
    </Portal>
  );
};

const styles = StyleSheet.create({
  modalContainer: {
    backgroundColor: 'white',
    marginHorizontal: 12,
    marginVertical: 24,
    padding: 16,
    borderRadius: 8,
    flexShrink: 1,
  },
  body: {
    maxHeight: 380,
  },
  row: {
    flexDirection: 'row',
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#e2e8f0',
  },
  headerRow: {
    backgroundColor: '#f1f5f9',
    borderBottomWidth: 1,
    borderBottomColor: '#cbd5e1',
  },
  cell: {
    paddingHorizontal: 8,
    paddingVertical: 8,
    justifyContent: 'center',
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: '#e2e8f0',
  },
  headerCell: {
    justifyContent: 'center',
  },
  headerText: {
    fontWeight: 'bold',
    fontSize: 12,
  },
  cellText: {
    fontSize: 12,
  },
  cellTextStrong: {
    fontWeight: 'bold',
  },
  cellTextMuted: {
    color: '#94a3b8',
  },
  rowNumText: {
    fontSize: 12,
    color: '#64748b',
  },
  statusInner: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 12,
    fontWeight: 'bold',
    marginLeft: 4,
  },
});

export default IdtDuplicateRowsModal;
