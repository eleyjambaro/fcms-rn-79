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
 * Returns the open draft group for the current branch and counterparty in the
 * given direction, creating one if none exists. Mirrors the Batch Purchase
 * pattern but keyed by (initiator_branch_id, source, destination) so the same
 * user can have an Out draft and an In draft to the same counterparty in
 * parallel.
 *
 * `direction`:
 *   - 'out' (default): current branch is the source — sending items out to
 *     counterparty. initiator = source = current.
 *   - 'in':            current branch is the destination — asking counterparty
 *     to send items. initiator = destination = current.
 *
 * `destinationBranchId` is accepted as a deprecated alias for
 * `counterpartyBranchId` to avoid breaking callers that haven't been updated.
 */
export const getOrCreateDraftBatchTransferGroup = async ({
  direction = 'out',
  counterpartyBranchId,
  destinationBranchId, // deprecated alias
  initiatorAccountUid = null,
}) => {
  const counterparty = counterpartyBranchId ?? destinationBranchId;
  if (!counterparty) {
    throw new Error('counterpartyBranchId is required');
  }
  if (direction !== 'out' && direction !== 'in') {
    throw new Error(`Invalid direction "${direction}". Expected "out" or "in".`);
  }

  const db = await getDBConnection();
  const {deviceId, branchId} = await getCloudSyncParams();
  if (!branchId) throw new Error('No active branch.');

  const sourceBranchId = direction === 'out' ? branchId : counterparty;
  const destBranchId = direction === 'out' ? counterparty : branchId;

  const existing = firstRow(
    await db.executeSql(
      `SELECT * FROM active_batch_transfer_groups
       WHERE status = ${sqlStr(STATUS.DRAFT)}
         AND initiator_branch_id = ${sqlStr(branchId)}
         AND source_branch_id = ${sqlStr(sourceBranchId)}
         AND destination_branch_id = ${sqlStr(destBranchId)}
       ORDER BY date_created DESC
       LIMIT 1`,
    ),
  );
  if (existing) return existing;

  const id = uuid.v4();
  await db.executeSql(
    `INSERT INTO batch_transfer_groups (
       id, sync_id, mode,
       source_branch_id, destination_branch_id, initiator_branch_id,
       status, initiator_account_uid,
       device_id, branch_id, updated_at
     ) VALUES (
       ${sqlStr(id)}, ${sqlStr(id)}, ${sqlStr('branch_to_branch')},
       ${sqlStr(sourceBranchId)}, ${sqlStr(destBranchId)}, ${sqlStr(branchId)},
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
 * Denormalizes item display fields and unit cost so the counterparty can
 * render the entry even if the underlying item doesn't exist in its branch.
 *
 * `values`: { groupId, item, qty, remarks?, direction? }
 * - `item` is the full row from active_items (must include id,
 *   master_item_sync_id, name, sku, uom_abbrev, unit_cost). Note: the items
 *   table uses `master_item_sync_id` for the cross-branch master link, even
 *   though we store it as `master_item_id` on batch_transfer_entries.
 * - `direction`:
 *     'out' (default): the picked item is the source's local item — written
 *                      to source_item_id; remark stored in source_remarks.
 *     'in':            the picked item is the dest's local item — written
 *                      to dest_item_id; remark stored in dest_remarks.
 *                      source_item_id is left NULL and resolved later by the
 *                      source counterparty via master_item_id.
 *
 * Legacy callers may pass `sourceItem` / `sourceRemarks`; we honor those as
 * aliases for `item` / `remarks` when `direction` is 'out' (or omitted).
 */
export const createBatchTransferEntry = async ({values}) => {
  const {
    groupId,
    direction = 'out',
    item: itemArg,
    sourceItem,
    qty,
    remarks: remarksArg,
    sourceRemarks,
  } = values;
  const item = itemArg ?? sourceItem;
  const remarks = remarksArg ?? sourceRemarks ?? null;
  if (!groupId || !item) {
    throw new Error('groupId and item are required');
  }
  if (direction !== 'out' && direction !== 'in') {
    throw new Error(`Invalid direction "${direction}". Expected "out" or "in".`);
  }

  const db = await getDBConnection();
  const {deviceId, branchId} = await getCloudSyncParams();
  const masterItemId = item.master_item_sync_id ?? null;
  // For In-mode, the picked item is the dest's local item — match on
  // dest_item_id if master is unknown. For Out-mode, match on source_item_id.
  const localItemCol = direction === 'in' ? 'dest_item_id' : 'source_item_id';
  const matchOn = masterItemId
    ? `master_item_id = ${sqlStr(masterItemId)}`
    : `${localItemCol} = ${sqlStr(item.id)}`;

  const existing = firstRow(
    await db.executeSql(
      `SELECT * FROM batch_transfer_entries
       WHERE batch_transfer_group_id = ${sqlStr(groupId)}
         AND ${matchOn}
         AND IFNULL(is_deleted, 0) != 1
       LIMIT 1`,
    ),
  );

  // Denormalize category name so the counterparty can resolve (or create) a
  // matching category when auto-creating a local item at receive time.
  // Without this, the auto-created item has NULL category_id and its
  // inventory_logs rows are hidden by the INNER JOIN on active_categories.
  let categoryName = item.category_name ?? null;
  if (!categoryName && item.category_id) {
    const cat = firstRow(
      await db.executeSql(
        `SELECT name FROM active_categories
         WHERE id = ${sqlStr(item.category_id)} LIMIT 1`,
      ),
    );
    categoryName = cat?.name ?? null;
  }

  const parsedQty = parseFloat(qty);
  const hasQty = Number.isFinite(parsedQty) && parsedQty > 0;

  // For In-mode the initiator's remark belongs in dest_remarks (initiator is
  // the dest); for Out-mode the initiator's remark belongs in source_remarks
  // (initiator is the source). The other column stays NULL until the
  // counterparty reviews.
  const remarksCol = direction === 'in' ? 'dest_remarks' : 'source_remarks';
  const sourceItemValue = direction === 'in' ? null : item.id;
  const destItemValue = direction === 'in' ? item.id : null;

  if (!existing) {
    if (!hasQty) return null;
    const entryId = uuid.v4();
    await db.executeSql(
      `INSERT INTO batch_transfer_entries (
         id, sync_id, batch_transfer_group_id,
         master_item_id, source_item_id, dest_item_id,
         item_display_name, item_display_sku, item_uom_abbrev,
         item_category_name,
         unit_cost_snapshot,
         requested_qty, entry_status, ${remarksCol},
         device_id, branch_id, updated_at
       ) VALUES (
         ${sqlStr(entryId)}, ${sqlStr(entryId)}, ${sqlStr(groupId)},
         ${sqlStr(masterItemId)}, ${sqlStr(sourceItemValue)}, ${sqlStr(destItemValue)},
         ${sqlStr(item.name)}, ${sqlStr(item.sku)},
         ${sqlStr(item.uom_abbrev)},
         ${sqlStr(categoryName)},
         ${sqlNum(item.unit_cost)},
         ${parsedQty}, ${sqlStr(ENTRY_STATUS.PENDING)}, ${sqlStr(remarks)},
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
           ${remarksCol} = ${sqlStr(remarks)},
           item_display_name = ${sqlStr(item.name)},
           item_display_sku = ${sqlStr(item.sku)},
           item_uom_abbrev = ${sqlStr(item.uom_abbrev)},
           item_category_name = ${sqlStr(categoryName)},
           unit_cost_snapshot = ${sqlNum(item.unit_cost)},
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

  // Initiator is whoever is on this device — for Out the initiator is the
  // source, for In the initiator is the destination. Stamp the viewed column
  // accordingly so the badge clears on the initiator's side after submit.
  const viewedCol = (await getActorViewedColumn(db, groupId)) ?? 'last_viewed_by_source_at';
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.REQUESTED)},
           date_requested = CURRENT_TIMESTAMP,
           ${viewedCol} = CURRENT_TIMESTAMP,
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

/**
 * Counterparty's review of a requested entry: sets accepted_qty and writes
 * the actor's remarks. For Out-mode the counterparty is the dest, so the
 * remark goes to dest_remarks (legacy behavior); for In-mode the counterparty
 * is the source, so the remark goes to source_remarks. accepted_qty and
 * entry_status are inventory-flow values, not actor-perspective — they're
 * always written the same way.
 *
 * `actorRole`: 'dest' (default, backward-compatible) | 'source'.
 * `destRemarks` is accepted for backward compat; new callers should pass
 * `remarks` plus an explicit `actorRole`.
 */
export const updateEntryDestReview = async ({
  entryId,
  acceptedQty,
  destRemarks,
  remarks,
  actorRole = 'dest',
}) => {
  if (actorRole !== 'source' && actorRole !== 'dest') {
    throw new Error(`Invalid actorRole "${actorRole}". Expected "source" or "dest".`);
  }
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

  const remarksCol = actorRole === 'source' ? 'source_remarks' : 'dest_remarks';
  const remarksValue = remarks ?? destRemarks ?? null;

  await db.executeSql(
    `UPDATE batch_transfer_entries
       SET accepted_qty = ${accepted},
           ${remarksCol} = ${sqlStr(remarksValue)},
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

  // Counterparty (dest for Out-mode, source for In-mode) is performing the
  // accept — stamp their viewed column, not the initiator's.
  const viewedCol = (await getActorViewedColumn(db, groupId)) ?? 'last_viewed_by_dest_at';
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.ACCEPTED)},
           date_accepted = CURRENT_TIMESTAMP,
           ${viewedCol} = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = ${sqlStr(groupId)}`,
  );
  scheduleSyncSoon();
};

export const rejectBatchTransferRequest = async ({groupId, reason = null}) => {
  const db = await getDBConnection();
  await assertGroupStatus(db, groupId, [STATUS.REQUESTED]);
  // Counterparty rejects — for Out-mode that's the dest (writes dest_remarks);
  // for In-mode that's the source (writes source_remarks). Stamp the actor's
  // viewed column the same way.
  const viewedCol = (await getActorViewedColumn(db, groupId)) ?? 'last_viewed_by_dest_at';
  const remarksCol = viewedCol === 'last_viewed_by_source_at' ? 'source_remarks' : 'dest_remarks';
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.REJECTED)},
           date_rejected = CURRENT_TIMESTAMP,
           ${remarksCol} = ${sqlStr(reason)},
           ${viewedCol} = CURRENT_TIMESTAMP,
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
  // Cancel can be invoked by the initiator (any direction) or by the source
  // after acceptance. Write the remark into the actor's column and stamp the
  // actor's viewed column so the badge clears on their side.
  const viewedCol = (await getActorViewedColumn(db, groupId)) ?? 'last_viewed_by_source_at';
  const remarksCol = viewedCol === 'last_viewed_by_source_at' ? 'source_remarks' : 'dest_remarks';
  await db.executeSql(
    `UPDATE batch_transfer_groups
       SET status = ${sqlStr(STATUS.CANCELLED)},
           date_cancelled = CURRENT_TIMESTAMP,
           ${remarksCol} = ${sqlStr(reason)},
           ${viewedCol} = CURRENT_TIMESTAMP,
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
  // Resolve a category_id on the destination side. Without one, the new
  // item's inventory_logs rows are filtered out by the INNER JOIN on
  // active_categories in getInventoryLogs / getInventoryLog (transfer-in
  // logs would silently disappear from the destination's history).
  const categoryId = await resolveDestCategoryId({
    db,
    categoryName: entry.item_category_name,
    deviceId,
    branchId,
  });

  const newItemId = uuid.v4();
  await db.executeSql(
    `INSERT INTO items (
       id, sync_id,
       master_item_sync_id, category_id, sku, name, uom_abbrev,
       unit_cost, current_stock_qty, initial_stock_qty,
       is_archived, is_finished_product,
       device_id, branch_id, updated_at
     ) VALUES (
       ${sqlStr(newItemId)}, ${sqlStr(newItemId)},
       ${sqlStr(entry.master_item_id)},
       ${sqlStr(categoryId)},
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

/**
 * Find (or create) a category on the destination branch matching the
 * denormalized source category name. Falls back to the first active category
 * on the branch when no name is available, and returns null only when the
 * branch has no categories at all — in which case the caller leaves the
 * item's category_id NULL and the LEFT JOIN in inventory-log views keeps
 * its rows visible regardless.
 */
const resolveDestCategoryId = async ({db, categoryName, deviceId, branchId}) => {
  const name = (categoryName ?? '').trim();
  if (name) {
    const existing = firstRow(
      await db.executeSql(
        `SELECT id FROM active_categories
         WHERE LOWER(name) = LOWER(${sqlStr(name)}) LIMIT 1`,
      ),
    );
    if (existing?.id) return existing.id;
    const newCategoryId = uuid.v4();
    await db.executeSql(
      `INSERT INTO categories (
         id, sync_id, name, is_active,
         device_id, branch_id, updated_at
       ) VALUES (
         ${sqlStr(newCategoryId)}, ${sqlStr(newCategoryId)}, ${sqlStr(name)}, 1,
         ${sqlStr(deviceId)}, ${sqlStr(branchId)}, CURRENT_TIMESTAMP
       )`,
    );
    return newCategoryId;
  }
  // No source category name to match — use the destination's first active
  // category as a non-NULL fallback (keeps the item visible in
  // category-scoped views).
  const fallback = firstRow(
    await db.executeSql(
      `SELECT id FROM active_categories ORDER BY name ASC LIMIT 1`,
    ),
  );
  return fallback?.id ?? null;
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
// Source-side item resolution (In flow)
// ============================================================================

/**
 * For an In-mode request the destination (initiator) creates entries with
 * `source_item_id = NULL` because it has no view of the source's items table.
 * When the source's device pulls and opens the request, this helper walks the
 * entries and tries to resolve each `source_item_id` via the cross-branch
 * `master_item_id` bridge. Matches go into source_item_id so the existing
 * source-adjust + materializeReceivedTransferLogs paths can write the
 * stock_transfer_out log later.
 *
 * Entries with no `master_item_id` (the initiator picked a local-only item)
 * or no matching row in active_items stay NULL — the editor UI locks the qty
 * input to 0 in that case so the source can't fulfill an unknown line.
 *
 * Idempotent. Returns the number of entries that got a resolved id.
 */
export const resolveMissingSourceItemIdsForGroup = async ({groupId}) => {
  if (!groupId) return 0;
  const db = await getDBConnection();
  const candidates = allRows(
    await db.executeSql(
      `SELECT e.id AS entry_id, i.id AS resolved_id
       FROM active_batch_transfer_entries e
       JOIN active_items i ON i.master_item_sync_id = e.master_item_id
       WHERE e.batch_transfer_group_id = ${sqlStr(groupId)}
         AND e.source_item_id IS NULL
         AND e.master_item_id IS NOT NULL`,
    ),
  );
  let count = 0;
  for (const row of candidates) {
    await db.executeSql(
      `UPDATE batch_transfer_entries
         SET source_item_id = ${sqlStr(row.resolved_id)},
             updated_at = CURRENT_TIMESTAMP
         WHERE id = ${sqlStr(row.entry_id)}`,
    );
    count++;
  }
  if (count > 0) scheduleSyncSoon();
  return count;
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
             AND IFNULL(received_qty, 0) > 0`,
        ),
      );

      for (const entry of entries) {
        let sourceItemId = entry.source_item_id;

        // In-mode entries arrive with source_item_id = NULL because the
        // destination/initiator could not see the source's items. The
        // resolveMissingSourceItemIdsForGroup pass at request-open time may
        // also have failed to find a match (items were created independently
        // on each branch so master_item_sync_id doesn't line up). Retry the
        // master lookup here, then fall back to auto-creating a local item
        // on the source branch so the stock_transfer_out log can still be
        // written. Without this fallback the source's inventory_logs are
        // silently missed.
        if (!sourceItemId && entry.master_item_id) {
          const localItem = firstRow(
            await db.executeSql(
              `SELECT id FROM active_items
               WHERE master_item_sync_id = ${sqlStr(entry.master_item_id)}
               LIMIT 1`,
            ),
          );
          sourceItemId = localItem?.id ?? null;
        }
        if (!sourceItemId) {
          sourceItemId = await autoCreateLocalItemForTransfer({
            db,
            entry,
            deviceId,
            branchId,
          });
        }

        if (entry.source_item_id !== sourceItemId) {
          await db.executeSql(
            `UPDATE batch_transfer_entries
               SET source_item_id = ${sqlStr(sourceItemId)},
                   updated_at = CURRENT_TIMESTAMP
               WHERE id = ${sqlStr(entry.id)}`,
          );
        }

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
             ${sqlStr(sourceItemId)},
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
    // Drafts belong to whoever created them — Out-mode drafts have
    // initiator_branch_id = source = current; In-mode drafts have
    // initiator_branch_id = destination = current. COALESCE protects rows
    // back-filled before the alterTables backfill ran.
    where = `g.status = ${sqlStr(STATUS.DRAFT)} AND COALESCE(g.initiator_branch_id, g.source_branch_id) = ${sqlStr(branchId)}`;
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

/**
 * Returns the `last_viewed_by_*_at` column corresponding to the current
 * branch's role in the given group: 'last_viewed_by_source_at' if current
 * branch is the source, 'last_viewed_by_dest_at' if it's the destination,
 * null otherwise. Used to stamp the viewed column for whichever side is
 * performing a mutation, instead of hardcoding the Out-mode assumption that
 * source = initiator.
 */
const getActorViewedColumn = async (db, groupId) => {
  const branchId = getActiveBranchId();
  if (!branchId || !groupId) return null;
  const row = firstRow(
    await db.executeSql(
      `SELECT source_branch_id, destination_branch_id FROM batch_transfer_groups
       WHERE id = ${sqlStr(groupId)}`,
    ),
  );
  if (!row) return null;
  if (row.source_branch_id === branchId) return 'last_viewed_by_source_at';
  if (row.destination_branch_id === branchId) return 'last_viewed_by_dest_at';
  return null;
};

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
