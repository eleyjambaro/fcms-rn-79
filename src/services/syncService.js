/**
 * FCMS Delta Sync Service
 *
 * Orchestrates push-pull sync between the local SQLite database and the
 * FCMS Cloud API. Call runSync() on app foreground, after major mutations,
 * or on network reconnect.
 *
 * Protocol:
 *   1. Collect local records where synced_at IS NULL OR updated_at > synced_at
 *   2. Push the delta to the server
 *   3. Mark pushed records as synced (set synced_at = updated_at)
 *   4. Pull all Group A changes in a single batch call (MIN last_pulled_at as since)
 *   5. Apply pulled records to local SQLite (upsert by sync_id)
 *   6. Update sync_metadata watermarks per entity
 */

import {getDBConnection, getCloudSyncParams} from '../localDb/index';
import {pushDelta, pullDelta} from '../serverDbQueries/v2/sync';

// ---------------------------------------------------------------------------
// Entity configuration
// ---------------------------------------------------------------------------

/**
 * Group A — bidirectional (push + pull).
 * All entities are here because every device in a branch both writes to and
 * needs to receive changes from other devices. Unique device-generated sync_ids
 * mean cross-device inserts never conflict.
 */
const GROUP_A_ENTITIES = [
  // Catalog / master data
  {key: 'categories', table: 'categories'},
  {key: 'taxes', table: 'taxes'},
  {key: 'vendors', table: 'vendors'},
  {key: 'vendor_contact_persons', table: 'vendor_contact_persons'},
  {key: 'operations', table: 'operations'},
  {key: 'recipe_kinds', table: 'recipe_kinds'},
  {key: 'recipes', table: 'recipes'},
  {key: 'ingredients', table: 'ingredients'},
  {key: 'items', table: 'items'},
  {key: 'modifiers', table: 'modifiers'},
  {key: 'modifier_options', table: 'modifier_options'},
  {key: 'selling_menus', table: 'selling_menus'},
  {key: 'selling_menu_items', table: 'selling_menu_items'},
  // Transaction / operational data
  {key: 'batch_purchase_groups', table: 'batch_purchase_groups'},
  {key: 'batch_purchase_entries', table: 'batch_purchase_entries'},
  {key: 'batch_stock_usage_groups', table: 'batch_stock_usage_groups'},
  {key: 'batch_stock_usage_entries', table: 'batch_stock_usage_entries'},
  {key: 'revenue_groups', table: 'revenue_groups'},
  {key: 'revenues', table: 'revenues'},
  {key: 'expense_groups', table: 'expense_groups'},
  {key: 'expenses', table: 'expenses'},
  {key: 'revenue_deductions', table: 'revenue_deductions'},
  {key: 'revenue_categories', table: 'revenue_categories'},
  {key: 'spoilages', table: 'spoilages'},
  {key: 'sales_order_groups', table: 'sales_order_groups'},
  {key: 'invoices', table: 'invoices'},
  {key: 'sale_logs', table: 'sale_logs'},
  {key: 'sales_orders', table: 'sales_orders'},
  {key: 'refunds', table: 'refunds'},
  {key: 'payments', table: 'payments'},
  {key: 'inventory_logs', table: 'inventory_logs'},
];

/**
 * Group B — reserved for future use.
 */
const GROUP_B_ENTITIES = [];

const ALL_PUSH_ENTITIES = [...GROUP_A_ENTITIES, ...GROUP_B_ENTITIES];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Fetch all rows from a table where synced_at IS NULL OR updated_at > synced_at.
 * Returns plain JS objects (SQLite row maps).
 */
const collectUnsynced = async (db, tableName) => {
  const [result] = await db.executeSql(
    `SELECT * FROM ${tableName}
     WHERE sync_id IS NOT NULL
       AND (synced_at IS NULL OR updated_at > synced_at)`,
  );
  const rows = [];
  for (let i = 0; i < result.rows.length; i++) {
    rows.push(result.rows.item(i));
  }
  return rows;
};

/**
 * Mark a set of sync_ids in a table as synced (set synced_at = updated_at).
 */
const markAsSynced = async (db, tableName, syncIds) => {
  if (!syncIds.length) return;
  const placeholders = syncIds.map(() => '?').join(', ');
  await db.executeSql(
    `UPDATE ${tableName}
     SET synced_at = updated_at
     WHERE sync_id IN (${placeholders})`,
    syncIds,
  );
};

/**
 * Upsert sync_metadata watermarks.
 */
const updateSyncMetadata = async (
  db,
  entityType,
  {lastPushedAt, lastPulledAt},
) => {
  const existing = await db.executeSql(
    `SELECT id FROM sync_metadata WHERE entity_type = ?`,
    [entityType],
  );

  if (existing[0].rows.length === 0) {
    await db.executeSql(
      `INSERT INTO sync_metadata (entity_type, last_pushed_at, last_pulled_at)
       VALUES (?, ?, ?)`,
      [entityType, lastPushedAt ?? null, lastPulledAt ?? null],
    );
  } else {
    const updates = [];
    const params = [];
    if (lastPushedAt !== undefined) {
      updates.push('last_pushed_at = ?');
      params.push(lastPushedAt);
    }
    if (lastPulledAt !== undefined) {
      updates.push('last_pulled_at = ?');
      params.push(lastPulledAt);
    }
    if (updates.length) {
      params.push(entityType);
      await db.executeSql(
        `UPDATE sync_metadata SET ${updates.join(', ')} WHERE entity_type = ?`,
        params,
      );
    }
  }
};

/**
 * Apply a single pulled record to the local table.
 * Uses sync_id as the upsert key. Only updates fields present in the record.
 * If is_deleted = 1, sets a tombstone marker (soft-delete handled per-table).
 */
const applyPulledRecord = async (db, tableName, record) => {
  // created_at is returned by the server but is not a column in any local SQLite
  // table — strip it before building INSERT/UPDATE to prevent "no such column" errors.
  // eslint-disable-next-line no-unused-vars
  const {sync_id, created_at, ...fields} = record;
  if (!sync_id) return;

  const [existing] = await db.executeSql(
    `SELECT id, updated_at FROM ${tableName} WHERE sync_id = ?`,
    [sync_id],
  );

  if (existing.rows.length === 0) {
    // Insert new record from server
    const columns = ['sync_id', 'synced_at', ...Object.keys(fields)].join(', ');
    const placeholders = Array(Object.keys(fields).length + 2)
      .fill('?')
      .join(', ');
    await db.executeSql(
      `INSERT OR IGNORE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
      [sync_id, fields.updated_at ?? null, ...Object.values(fields)],
    );
  } else {
    const localRow = existing.rows.item(0);
    // Only overwrite if server record is newer
    if (
      fields.updated_at &&
      localRow.updated_at &&
      fields.updated_at <= localRow.updated_at
    ) {
      return;
    }

    const setClauses = [...Object.keys(fields), 'synced_at']
      .map(k => `${k} = ?`)
      .join(', ');
    await db.executeSql(
      `UPDATE ${tableName} SET ${setClauses} WHERE sync_id = ?`,
      [...Object.values(fields), fields.updated_at ?? null, sync_id],
    );
  }
};

// ---------------------------------------------------------------------------
// Main sync entry point
// ---------------------------------------------------------------------------

let syncInProgress = false;

// ---------------------------------------------------------------------------
// Debounced push
// ---------------------------------------------------------------------------

/**
 * Schedule a sync 2 seconds after the last call. Rapid successive mutations
 * collapse into a single sync attempt. Safe to call fire-and-forget from any
 * localDbQuery mutation function.
 */
let debounceTimer = null;
export const scheduleSyncSoon = (delayMs = 2000) => {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    runSync().catch(console.warn);
  }, delayMs);
};

// ---------------------------------------------------------------------------
// Main sync entry point
// ---------------------------------------------------------------------------

/**
 * Run a full push-pull sync cycle.
 *
 * @returns {Promise<{pushed: Object, pulled: Object, errors: string[]}>}
 */
export const runSync = async () => {
  if (syncInProgress) {
    return {
      pushed: {},
      pulled: {},
      errors: ['Sync already in progress — skipped.'],
    };
  }
  syncInProgress = true;
  const result = {pushed: {}, pulled: {}, errors: []};

  try {
    const {deviceId, branchId} = await getCloudSyncParams();

    if (!deviceId || !branchId) {
      result.errors.push('No cloud device/branch configured — skipping sync.');
      return result;
    }

    let db;
    try {
      db = await getDBConnection();
    } catch (err) {
      result.errors.push(`DB connection failed: ${err.message}`);
      return result;
    }

    const pushedAt = new Date().toISOString();

    // ---- Phase 1: Collect delta ----
    const delta = {};
    for (const {key, table} of ALL_PUSH_ENTITIES) {
      try {
        const rows = await collectUnsynced(db, table);
        if (rows.length > 0) {
          delta[key] = rows;
        }
      } catch (err) {
        result.errors.push(`Collect failed for ${table}: ${err.message}`);
      }
    }

    // ---- Phase 2: Push ----
    if (Object.keys(delta).length > 0) {
      try {
        const pushResponse = await pushDelta({
          device_id: deviceId,
          branch_id: branchId,
          pushed_at: pushedAt,
          delta,
        });

        const {accepted = {}, synced_at} = pushResponse?.data ?? {};
        result.pushed = accepted;

        // Mark pushed records as synced
        for (const {key, table} of ALL_PUSH_ENTITIES) {
          if (delta[key]?.length) {
            const syncIds = delta[key].map(r => r.sync_id).filter(Boolean);
            try {
              await markAsSynced(db, table, syncIds);
              await updateSyncMetadata(db, key, {
                lastPushedAt: synced_at ?? pushedAt,
              });
            } catch (err) {
              result.errors.push(
                `Mark synced failed for ${table}: ${err.message}`,
              );
            }
          }
        }
      } catch (err) {
        result.errors.push(`Push failed: ${err.message}`);
      }
    }

    // ---- Phase 3: Pull (Group A — single batch call) ----
    try {
      const [metaResult] = await db.executeSql(
        `SELECT MIN(last_pulled_at) AS since FROM sync_metadata`,
      );
      const since = metaResult.rows.item(0)?.since ?? '1970-01-01T00:00:00Z';

      // On a fresh install sync_metadata is empty, so `since` falls back to
      // epoch. In that case we omit X-Device-Id so the server does NOT apply
      // echo-suppression — without this, all historical records originally
      // pushed from this device would be filtered out and never returned,
      // leaving the reinstalled app with no data.
      const isInitialPull = since === '1970-01-01T00:00:00Z';

      const pullResponse = await pullDelta({
        since,
        branch_id: branchId,
        device_id: isInitialPull ? null : deviceId,
      });

      const {pulled_at, delta: pulledDelta = {}} = pullResponse?.data ?? {};

      for (const {key, table} of GROUP_A_ENTITIES) {
        const records = pulledDelta[key] ?? [];
        for (const record of records) {
          try {
            await applyPulledRecord(db, table, record);
          } catch (err) {
            result.errors.push(
              `Apply pull record failed for ${table}: ${err.message}`,
            );
          }
        }
        if (records.length > 0) {
          result.pulled[key] = records.length;
        }
        if (pulled_at) {
          await updateSyncMetadata(db, key, {lastPulledAt: pulled_at});
        }
      }
    } catch (err) {
      result.errors.push(`Pull failed: ${err.message}`);
    }
  } finally {
    syncInProgress = false;
  }

  return result;
};
