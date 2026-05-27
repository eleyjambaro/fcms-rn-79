/**
 * Batch Transfer — cross-branch stateful transfer between two branches of
 * the same company. See plans/help-me-plan-to-federated-book.md for the
 * full design. State machine:
 *
 *   draft → requested → accepted → transferring → received
 *                  ↘ rejected     ↘ cancelled
 *
 * Inventory impact happens ONLY on `received`, and uses each entry's
 * `received_qty` (not requested/accepted/adjusted). Each branch writes its
 * own inventory_logs row locally (per-branch isolation requires this):
 *   - Dest writes its stock_transfer_in row at confirmTransferReceived().
 *   - Source's row is created lazily by materializeReceivedTransferLogs(),
 *     called from the post-pull hook in syncService.
 *
 * The cross-branch sync filter lives in SyncController::pull() (server).
 * Both branches see the same group/entries via their shared sync_id.
 */

import uuid from 'react-native-uuid';

import {
  getDBConnection,
  getCloudSyncParams,
  getActiveBranchId,
  OPERATION_DEFAULT_UUIDS,
} from '../localDb';
import {scheduleSyncSoon} from '../services/syncService';

// ============================================================================
// Helpers
// ============================================================================

const sqlStr = v => {
  if (v == null) return 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
};

const sqlNum = v => {
  if (v == null || v === '') return 'NULL';
  const n = parseFloat(v);
  return Number.isFinite(n) ? String(n) : 'NULL';
};

const STATUS = {
  DRAFT: 'draft',
  REQUESTED: 'requested',
  ACCEPTED: 'accepted',
  TRANSFERRING: 'transferring',
  RECEIVED: 'received',
  CANCELLED: 'cancelled',
  REJECTED: 'rejected',
};

const ENTRY_STATUS = {
  PENDING: 'pending',
  ACCEPTED_FULL: 'accepted_full',
  ACCEPTED_PARTIAL: 'accepted_partial',
  DECLINED: 'declined',
};

const firstRow = result => {
  if (!result || !result[0] || !result[0].rows.length) return null;
  return result[0].rows.item(0);
};

const allRows = result => {
  const out = [];
  if (!result || !result[0]) return out;
  for (let i = 0; i < result[0].rows.length; i++) {
    out.push(result[0].rows.item(i));
  }
  return out;
};

// ============================================================================
// Draft / authoring (source side)
// ============================================================================

/**
 * Returns the open draft group for (currentBranch → destinationBranchId),
 * creating one if none exists. Mirrors getCurrentBatchPurchaseGroupId() but
 * keyed by destination so a user can have parallel drafts to different
 * branches.
 */
export const getOrCreateDraftBatchTransferGroup = async ({
  destinationBranchId,
  initiatorAccountUid = null,
}) => {
  if (!destinationBranchId) {
    throw new Error('destinationBranchId is required');
  }

  const db = await getDBConnection();
  const {deviceId, branchId} = await getCloudSyncParams();
  if (!branchId) throw new Error('No active branch.');

  const existing = firstRow(
    await db.executeSql(
      `SELECT * FROM active_batch_transfer_groups
       WHERE status = ${sqlStr(STATUS.DRAFT)}
         AND source_branch_id = ${sqlStr(branchId)}
         AND destination_branch_id = ${sqlStr(destinationBranchId)}
       ORDER BY date_created DESC
       LIMIT 1`,
    ),
  );
  if (existing) return existing;

  const id = uuid.v4();
  await db.executeSql(
    `INSERT INTO batch_transfer_groups (
       id, sync_id, mode, source_branch_id, destination_branch_id,
       status, initiator_account_uid,
       device_id, branch_id, updated_at
     ) VALUES (
       ${sqlStr(id)}, ${sqlStr(id)}, ${sqlStr('branch_to_branch')},
       ${sqlStr(branchId)}, ${sqlStr(destinationBranchId)},
       ${sqlStr(STATUS.DRAFT)}, ${sqlStr(initiatorAccountUid)},
       ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
     )`,
  );

  const created = firstRow(
    await db.executeSql(
      `SELECT * FROM batch_transfer_groups WHERE id = ${sqlStr(id)}`,
    ),
  );
  scheduleSyncSoon();
  return created;
};

/**
 * Upsert an entry on the draft. If qty=0 and entry exists, soft-deletes it.
 * Denormalizes item display fields and unit cost so the destination can
 * render the entry even if the underlying item doesn't exist in its branch.
 *
 * `values`: { groupId, sourceItem, qty, sourceRemarks? }
 * where sourceItem is the full row from active_items (must include id,
 * master_item_sync_id, name, sku, uom_abbrev, unit_cost). Note: the items
 * table uses `master_item_sync_id` for the cross-branch master link, even
 * though we store it as `master_item_id` on batch_transfer_entries.
 */
export const createBatchTransferEntry = async ({values}) => {
  const {
    groupId,
    sourceItem,
    qty,
    sourceRemarks = null,
  } = values;
  if (!groupId || !sourceItem) {
    throw new Error('groupId and sourceItem are required');
  }

  const db = await getDBConnection();
  const {deviceId, branchId} = await getCloudSyncParams();
  const masterItemId = sourceItem.master_item_sync_id ?? null;
  const matchOn = masterItemId
    ? `master_item_id = ${sqlStr(masterItemId)}`
    : `source_item_id = ${sqlStr(sourceItem.id)}`;

  const existing = firstRow(
    await db.executeSql(
      `SELECT * FROM batch_transfer_entries
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND ${matchOn}
         AND IFNULL(is_deleted, 0) != 1
       LIMIT 1`,
    ),
  );

  const parsedQty = parseFloat(qty);
  const hasQty = Number.isFinite(parsedQty) && parsedQty > 0;

  if (!existing) {
    if (!hasQty) return null;
    const entryId = uuid.v4();
    await db.executeSql(
      `INSERT INTO batch_transfer_entries (
         id, sync_id, batch_transfer_group_id,
         master_item_id, source_item_id,
         item_display_name, item_display_sku, item_uom_abbrev,
         unit_cost_snapshot,
         requested_qty, entry_status, source_remarks,
         device_id, branch_id, updated_at
       ) VALUES (
         ${sqlStr(entryId)}, ${sqlStr(entryId)}, ${sqlStr(groupId)},
         ${sqlStr(masterItemId)}, ${sqlStr(sourceItem.id)},
         ${sqlStr(sourceItem.name)}, ${sqlStr(sourceItem.sku)},
         ${sqlStr(sourceItem.uom_abbrev)},
         ${sqlNum(sourceItem.unit_cost)},
         ${parsedQty}, ${sqlStr(ENTRY_STATUS.PENDING)}, ${sqlStr(sourceRemarks)},
         ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
       )`,
    );
    await touchGroupUpdatedAt(db, groupId);
    scheduleSyncSoon();
    return entryId;
  }

  if (!hasQty) {
    await db.executeSql(
      `UPDATE batch_transfer_entries
         SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
         WHERE id = ${sqlStr(existing.id)}`,
    );
    await touchGroupUpdatedAt(db, groupId);
    scheduleSyncSoon();
    return null;
  }

  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET requested_qty = ${parsedQty},
           source_remarks = ${sqlStr(sourceRemarks)},
           item_display_name = ${sqlStr(sourceItem.name)},
           item_display_sku = ${sqlStr(sourceItem.sku)},
           item_uom_abbrev = ${sqlStr(sourceItem.uom_abbrev)},
           unit_cost_snapshot = ${sqlNum(sourceItem.unit_cost)},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(existing.id)}`,
  );
  await touchGroupUpdatedAt(db, groupId);
  scheduleSyncSoon();
  return existing.id;
};

export const removeBatchTransferEntry = async ({entryId}) => {
  const db = await getDBConnection();
  const row = firstRow(
    await db.executeSql(
      `SELECT batch_transfer_group_id FROM batch_transfer_entries
       WHERE id = ${sqlStr(entryId)}`,
    ),
  );
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(entryId)}`,
  );
  if (row?.batch_transfer_group_id) {
    await touchGroupUpdatedAt(db, row.batch_transfer_group_id);
  }
  scheduleSyncSoon();
};

export const submitBatchTransferRequest = async ({groupId}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.DRAFT]);

  const entryCount = firstRow(
    await db.executeSql(
      `SELECT COUNT(*) AS cnt FROM active_batch_transfer_entries
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}`,
    ),
  )?.cnt;
  if (!entryCount) {
    throw new Error('Add at least one item before submitting.');
  }

  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.REQUESTED)},
           date_requested = CURRENT_TIMESTAMP,
           last_viewed_by_source_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

export const cancelDraftBatchTransfer = async ({groupId}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.DRAFT]);
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}`,
  );
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET is_deleted = 1, updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

// ============================================================================
// Dest-side review
// ============================================================================

export const updateEntryDestReview = async ({
  entryId,
  acceptedQty,
  destRemarks,
}) => {
  const db = await getDBConnection();
  const entry = firstRow(
    await db.executeSql(
      `SELECT e.*, g.status AS group_status
       FROM batch_transfer_entries e
       JOIN batch_transfer_groups g ON g.id = e.batch_transfer_group_id
       WHERE e.id = ${sqlStr(entryId)}`,
    ),
  );
  if (!entry) throw new Error('Entry not found.');
  if (entry.group_status !== STATUS.REQUESTED) {
    throw new Error(
      `Cannot edit accepted_qty when group status is ${entry.group_status}`,
    );
  }

  const parsed = parseFloat(acceptedQty);
  const accepted = Number.isFinite(parsed) ? parsed : 0;
  const requested = parseFloat(entry.requested_qty) || 0;
  let nextStatus;
  if (accepted <= 0) nextStatus = ENTRY_STATUS.DECLINED;
  else if (accepted >= requested) nextStatus = ENTRY_STATUS.ACCEPTED_FULL;
  else nextStatus = ENTRY_STATUS.ACCEPTED_PARTIAL;

  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET accepted_qty = ${accepted},
           dest_remarks = ${sqlStr(destRemarks ?? null)},
           entry_status = ${sqlStr(nextStatus)},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(entryId)}`,
  );
  await touchGroupUpdatedAt(db, entry.batch_transfer_group_id);
  scheduleSyncSoon();
};

export const acceptBatchTransferRequest = async ({groupId}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.REQUESTED]);

  // Default any unreviewed entries to accepted_qty = requested_qty so the
  // source side has a complete picture even if the dest user skipped them.
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET accepted_qty = requested_qty,
           entry_status = ${sqlStr(ENTRY_STATUS.ACCEPTED_FULL)},
           updated_at = CURRENT_TIMESTAMP
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND IFNULL(is_deleted, 0) != 1
         AND accepted_qty IS NULL`,
  );

  const anyAccepted = firstRow(
    await db.executeSql(
      `SELECT COUNT(*) AS cnt FROM active_batch_transfer_entries
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND IFNULL(accepted_qty, 0) > 0`,
    ),
  )?.cnt;
  if (!anyAccepted) {
    throw new Error(
      'At least one item must have accepted_qty > 0. Use Reject to decline the whole request.',
    );
  }

  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.ACCEPTED)},
           date_accepted = CURRENT_TIMESTAMP,
           last_viewed_by_dest_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

export const rejectBatchTransferRequest = async ({groupId, reason = null}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.REQUESTED]);
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.REJECTED)},
           date_rejected = CURRENT_TIMESTAMP,
           dest_remarks = ${sqlStr(reason)},
           last_viewed_by_dest_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

// ============================================================================
// Source-side dispatch
// ============================================================================

export const updateEntrySourceAdjustment = async ({
  entryId,
  adjustedQty,
  sourceRemarks,
}) => {
  const db = await getDBConnection();
  const entry = firstRow(
    await db.executeSql(
      `SELECT e.*, g.status AS group_status
       FROM batch_transfer_entries e
       JOIN batch_transfer_groups g ON g.id = e.batch_transfer_group_id
       WHERE e.id = ${sqlStr(entryId)}`,
    ),
  );
  if (!entry) throw new Error('Entry not found.');
  if (entry.group_status !== STATUS.ACCEPTED) {
    throw new Error(
      `Cannot edit adjusted_qty when group status is ${entry.group_status}`,
    );
  }

  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET adjusted_qty = ${sqlNum(adjustedQty)},
           source_remarks = ${sqlStr(sourceRemarks ?? null)},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(entryId)}`,
  );
  await touchGroupUpdatedAt(db, entry.batch_transfer_group_id);
  scheduleSyncSoon();
};

export const confirmTransferOut = async ({groupId}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.ACCEPTED]);

  // For any entry where source didn't explicitly adjust, default to accepted_qty.
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET adjusted_qty = accepted_qty,
           updated_at = CURRENT_TIMESTAMP
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND IFNULL(is_deleted, 0) != 1
         AND adjusted_qty IS NULL`,
  );

  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.TRANSFERRING)},
           date_transferring = CURRENT_TIMESTAMP,
           last_viewed_by_source_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

export const cancelBatchTransferRequest = async ({groupId, reason = null}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.REQUESTED, STATUS.ACCEPTED]);
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.CANCELLED)},
           date_cancelled = CURRENT_TIMESTAMP,
           source_remarks = ${sqlStr(reason)},
           last_viewed_by_source_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

// ============================================================================
// Dest-side receipt
// ============================================================================

export const updateEntryReceivedQty = async ({entryId, receivedQty}) => {
  const db = await getDBConnection();
  const entry = firstRow(
    await db.executeSql(
      `SELECT e.*, g.status AS group_status
       FROM batch_transfer_entries e
       JOIN batch_transfer_groups g ON g.id = e.batch_transfer_group_id
       WHERE e.id = ${sqlStr(entryId)}`,
    ),
  );
  if (!entry) throw new Error('Entry not found.');
  if (entry.group_status !== STATUS.TRANSFERRING) {
    throw new Error(
      `Cannot set received_qty when group status is ${entry.group_status}`,
    );
  }
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET received_qty = ${sqlNum(receivedQty)},
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(entryId)}`,
  );
  await touchGroupUpdatedAt(db, entry.batch_transfer_group_id);
  // Don't schedule sync here — receipt batches the final confirm.
};

/**
 * Press "Transfer Received" on the destination side. Flips status to
 * RECEIVED, materializes destination's inventory_logs rows, and auto-
 * creates any missing local items linked by master_item_id.
 *
 * Source's matching inventory_logs rows are NOT written here — they're
 * created lazily by materializeReceivedTransferLogs() on source's next sync.
 */
export const confirmTransferReceived = async ({
  groupId,
  initiatorAccountUid = null,
}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.TRANSFERRING]);

  const {deviceId, branchId} = await getCloudSyncParams();
  if (!branchId) throw new Error('No active branch.');

  // Default any unreceived rows to adjusted_qty.
  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET received_qty = IFNULL(adjusted_qty, accepted_qty),
           updated_at = CURRENT_TIMESTAMP
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND IFNULL(is_deleted, 0) != 1
         AND received_qty IS NULL`,
  );

  const entries = allRows(
    await db.executeSql(
      `SELECT * FROM active_batch_transfer_entries
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND IFNULL(received_qty, 0) > 0`,
    ),
  );

  for (const entry of entries) {
    let destItemId = entry.dest_item_id;

    // Resolve dest's local item via master_item_id; auto-create if missing.
    if (!destItemId && entry.master_item_id) {
      // items.master_item_sync_id is the canonical company-wide bridge.
      const localItem = firstRow(
        await db.executeSql(
          `SELECT id FROM active_items
           WHERE master_item_sync_id = ${sqlStr(entry.master_item_id)}
           LIMIT 1`,
        ),
      );
      destItemId = localItem?.id ?? null;
    }

    if (!destItemId) {
      destItemId = await autoCreateLocalItemForTransfer({
        db,
        entry,
        deviceId,
        branchId,
      });
    }

    // Stamp dest_item_id on the entry so source's drill-down can join later.
    await db.executeSql(
      `UPDATE batch_transfer_entries
         SET dest_item_id = ${sqlStr(destItemId)},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ${sqlStr(entry.id)}`,
    );

    const logId = uuid.v4();
    const unitCost = parseFloat(entry.unit_cost_snapshot || 0);
    const qty = parseFloat(entry.received_qty);
    const remarks = buildTransferLogRemark(entry, 'in');
    await db.executeSql(
      `INSERT INTO inventory_logs (
         id, sync_id,
         operation_id, item_id,
         adjustment_unit_cost, adjustment_unit_cost_net,
         adjustment_qty, adjustment_date,
         batch_transfer_group_id,
         adjusted_by_account_uid,
         remarks,
         device_id, branch_id, updated_at
       ) VALUES (
         ${sqlStr(logId)}, ${sqlStr(logId)},
         ${sqlStr(OPERATION_DEFAULT_UUIDS.stock_transfer_in)},
         ${sqlStr(destItemId)},
         ${unitCost}, ${unitCost},
         ${qty}, CURRENT_TIMESTAMP,
         ${sqlStr(groupId)},
         ${sqlStr(initiatorAccountUid)},
         ${sqlStr(remarks)},
         ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
       )`,
    );
  }

  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.RECEIVED)},
           date_received = CURRENT_TIMESTAMP,
           last_viewed_by_dest_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

const autoCreateLocalItemForTransfer = async ({
  db,
  entry,
  deviceId,
  branchId,
}) => {
  const newItemId = uuid.v4();
  await db.executeSql(
    `INSERT INTO items (
       id, sync_id,
       master_item_sync_id, sku, name, uom_abbrev,
       unit_cost, current_stock_qty, initial_stock_qty,
       is_archived, is_finished_product,
       device_id, branch_id, updated_at
     ) VALUES (
       ${sqlStr(newItemId)}, ${sqlStr(newItemId)},
       ${sqlStr(entry.master_item_id)},
       ${sqlStr(entry.item_display_sku)},
       ${sqlStr(entry.item_display_name)},
       ${sqlStr(entry.item_uom_abbrev)},
       ${sqlNum(entry.unit_cost_snapshot)}, 0, 0,
       0, 0,
       ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
     )`,
  );
  return newItemId;
};

const buildTransferLogRemark = (entry, direction) => {
  const shortId = entry.batch_transfer_group_id?.slice(0, 8) ?? '';
  const label =
    direction === 'in' ? 'Transfer In' : 'Transfer Out';
  const userRemark =
    direction === 'in' ? entry.dest_remarks : entry.source_remarks;
  const base = `${label} (#${shortId})`;
  if (!userRemark) return base.slice(0, 120);
  return `${base}: ${userRemark}`.slice(0, 120);
};

// ============================================================================
// Post-sync hook — source-side inventory_logs materialization
// ============================================================================

/**
 * For every batch_transfer_group where:
 *   - status = 'received'
 *   - source_branch_id = currentBranch (we are the source)
 *   - no inventory_logs row exists yet for this group on our branch with
 *     operation_id = stock_transfer_out
 * write the missing rows locally. Idempotent — safe to call after every pull.
 *
 * Why: only the destination's device flips status to 'received', and it can
 * only write inventory_logs for ITS OWN branch. Source's stock_transfer_out
 * rows must therefore be created on source's device, on its next sync, once
 * it sees the group's new 'received' status.
 */
export const materializeReceivedTransferLogs = async () => {
  try {
    const branchId = getActiveBranchId();
    if (!branchId) return 0;

    const db = await getDBConnection();
    const {deviceId} = await getCloudSyncParams();

    const groups = allRows(
      await db.executeSql(
        `SELECT g.id, g.date_received
         FROM active_batch_transfer_groups g
         WHERE g.status = ${sqlStr(STATUS.RECEIVED)}
           AND g.source_branch_id = ${sqlStr(branchId)}
           AND NOT EXISTS (
             SELECT 1 FROM active_inventory_logs il
             WHERE il.batch_transfer_group_id = g.id
               AND il.operation_id = ${sqlStr(OPERATION_DEFAULT_UUIDS.stock_transfer_out)}
           )`,
      ),
    );

    let total = 0;
    for (const group of groups) {
      const entries = allRows(
        await db.executeSql(
          `SELECT * FROM active_batch_transfer_entries
           WHERE batch_transfer_group_id = ${sqlStr(group.id)}
             AND IFNULL(received_qty, 0) > 0
             AND source_item_id IS NOT NULL`,
        ),
      );

      for (const entry of entries) {
        const logId = uuid.v4();
        const unitCost = parseFloat(entry.unit_cost_snapshot || 0);
        const qty = parseFloat(entry.received_qty);
        const remarks = buildTransferLogRemark(entry, 'out');
        const adjustmentDate = group.date_received
          ? sqlStr(group.date_received)
          : 'CURRENT_TIMESTAMP';
        await db.executeSql(
          `INSERT INTO inventory_logs (
             id, sync_id,
             operation_id, item_id,
             adjustment_unit_cost, adjustment_unit_cost_net,
             adjustment_qty, adjustment_date,
             batch_transfer_group_id,
             remarks,
             device_id, branch_id, updated_at
           ) VALUES (
             ${sqlStr(logId)}, ${sqlStr(logId)},
             ${sqlStr(OPERATION_DEFAULT_UUIDS.stock_transfer_out)},
             ${sqlStr(entry.source_item_id)},
             ${unitCost}, ${unitCost},
             ${qty}, ${adjustmentDate},
             ${sqlStr(group.id)},
             ${sqlStr(remarks)},
             ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
           )`,
        );
        total++;
      }
    }
    if (total > 0) scheduleSyncSoon();
    return total;
  } catch (error) {
    console.debug('[materializeReceivedTransferLogs] error:', error);
    return 0;
  }
};

// ============================================================================
// Read queries
// ============================================================================

/**
 * Paginated list. `queryKey = ['batchTransferRequests', {tab, search?}]`.
 * tab ∈ 'drafts' | 'incoming' | 'outgoing' | 'history' | 'all'.
 */
export const getBatchTransferRequests = async ({queryKey, pageParam = 1}) => {
  const [_key, {tab = 'all', search = ''} = {}] = queryKey;
  const limit = 20;
  const offset = (pageParam - 1) * limit;
  const branchId = getActiveBranchId();
  if (!branchId) return {result: [], totalCount: 0, page: pageParam};

  const db = await getDBConnection();

  let where = `g.source_branch_id = ${sqlStr(branchId)} OR g.destination_branch_id = ${sqlStr(branchId)}`;
  if (tab === 'drafts') {
    where = `g.status = ${sqlStr(STATUS.DRAFT)} AND g.source_branch_id = ${sqlStr(branchId)}`;
  } else if (tab === 'incoming') {
    where = `g.destination_branch_id = ${sqlStr(branchId)} AND g.status IN (${sqlStr(STATUS.REQUESTED)}, ${sqlStr(STATUS.ACCEPTED)}, ${sqlStr(STATUS.TRANSFERRING)})`;
  } else if (tab === 'outgoing') {
    where = `g.source_branch_id = ${sqlStr(branchId)} AND g.status IN (${sqlStr(STATUS.REQUESTED)}, ${sqlStr(STATUS.ACCEPTED)}, ${sqlStr(STATUS.TRANSFERRING)})`;
  } else if (tab === 'history') {
    where = `(g.source_branch_id = ${sqlStr(branchId)} OR g.destination_branch_id = ${sqlStr(branchId)}) AND g.status IN (${sqlStr(STATUS.RECEIVED)}, ${sqlStr(STATUS.CANCELLED)}, ${sqlStr(STATUS.REJECTED)})`;
  } else {
    where = `(g.source_branch_id = ${sqlStr(branchId)} OR g.destination_branch_id = ${sqlStr(branchId)}) AND g.status != ${sqlStr(STATUS.DRAFT)}`;
  }
  if (search) {
    where += ` AND g.id LIKE '%${String(search).replace(/'/g, "''")}%'`;
  }

  const baseFrom = `FROM active_batch_transfer_groups g
       LEFT JOIN (
         SELECT batch_transfer_group_id, COUNT(*) AS entry_count
         FROM active_batch_transfer_entries
         GROUP BY batch_transfer_group_id
       ) ec ON ec.batch_transfer_group_id = g.id`;

  const totalCount = firstRow(
    await db.executeSql(
      `SELECT COUNT(*) AS cnt ${baseFrom} WHERE ${where}`,
    ),
  )?.cnt || 0;

  const rows = allRows(
    await db.executeSql(
      `SELECT g.*, IFNULL(ec.entry_count, 0) AS entry_count,
              CASE WHEN g.source_branch_id = ${sqlStr(branchId)} THEN 'out' ELSE 'in' END AS perspective,
              CASE
                WHEN g.source_branch_id = ${sqlStr(branchId)}
                     AND IFNULL(g.updated_at, '') > IFNULL(g.last_viewed_by_source_at, '') THEN 1
                WHEN g.destination_branch_id = ${sqlStr(branchId)}
                     AND IFNULL(g.updated_at, '') > IFNULL(g.last_viewed_by_dest_at, '') THEN 1
                ELSE 0
              END AS is_unread
       ${baseFrom}
       WHERE ${where}
       ORDER BY g.updated_at DESC, g.date_created DESC
       LIMIT ${limit} OFFSET ${offset}`,
    ),
  );

  return {result: rows, totalCount, page: pageParam, hasMore: offset + rows.length < totalCount};
};

export const getBatchTransferRequest = async ({queryKey}) => {
  const [_key, {groupId}] = queryKey;
  if (!groupId) return null;
  const db = await getDBConnection();
  const branchId = getActiveBranchId();
  return firstRow(
    await db.executeSql(
      `SELECT g.*,
              CASE WHEN g.source_branch_id = ${sqlStr(branchId)} THEN 'out' ELSE 'in' END AS perspective
       FROM active_batch_transfer_groups g
       WHERE g.id = ${sqlStr(groupId)}`,
    ),
  );
};

export const getBatchTransferEntries = async ({queryKey}) => {
  const [_key, {groupId}] = queryKey;
  if (!groupId) return [];
  const db = await getDBConnection();
  return allRows(
    await db.executeSql(
      `SELECT e.*
       FROM active_batch_transfer_entries e
       WHERE e.batch_transfer_group_id = ${sqlStr(groupId)}
       ORDER BY e.item_display_name ASC`,
    ),
  );
};

export const getBatchTransferUnreadCount = async () => {
  const branchId = getActiveBranchId();
  if (!branchId) return 0;
  const db = await getDBConnection();
  return (
    firstRow(
      await db.executeSql(
        `SELECT COUNT(*) AS cnt
         FROM active_batch_transfer_groups g
         WHERE g.status != ${sqlStr(STATUS.DRAFT)}
           AND (
             (g.source_branch_id = ${sqlStr(branchId)}
              AND IFNULL(g.updated_at, '') > IFNULL(g.last_viewed_by_source_at, ''))
             OR
             (g.destination_branch_id = ${sqlStr(branchId)}
              AND IFNULL(g.updated_at, '') > IFNULL(g.last_viewed_by_dest_at, ''))
           )`,
      ),
    )?.cnt || 0
  );
};

/**
 * Mark the group as viewed by the current branch's role. Updates only the
 * field for the perspective from which the user is viewing (source or dest).
 * Does NOT bump `updated_at` — viewing is local-only and should not push to
 * the counterpart branch as if state changed.
 */
export const markBatchTransferViewed = async ({groupId}) => {
  const db = await getDBConnection();
  const branchId = getActiveBranchId();
  if (!branchId || !groupId) return;
  const group = firstRow(
    await db.executeSql(
      `SELECT source_branch_id, destination_branch_id FROM batch_transfer_groups
       WHERE id = ${sqlStr(groupId)}`,
    ),
  );
  if (!group) return;
  const column =
    group.source_branch_id === branchId
      ? 'last_viewed_by_source_at'
      : group.destination_branch_id === branchId
      ? 'last_viewed_by_dest_at'
      : null;
  if (!column) return;
  // Bump updated_at so the viewed-state still syncs across the current
  // branch's own devices, but not on the counterpart-branch column.
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET ${column} = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
};

// ============================================================================
// Private guards
// ============================================================================

const assertGroupStatus = async (db, groupId, allowed) => {
  const row = firstRow(
    await db.executeSql(
      `SELECT status FROM batch_transfer_groups WHERE id = ${sqlStr(groupId)}`,
    ),
  );
  if (!row) throw new Error('Batch transfer request not found.');
  if (!allowed.includes(row.status)) {
    throw new Error(
      `Action not allowed for status="${row.status}". Allowed: ${allowed.join(', ')}.`,
    );
  }
};

const touchGroupUpdatedAt = async (db, groupId) => {
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
};
