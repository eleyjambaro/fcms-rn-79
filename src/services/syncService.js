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

import {
  getDBConnection,
  getCloudSyncParams,
  getActiveCompanyId,
  getActiveBranchId,
} from '../localDb/index';
import {pushDelta, pullDelta} from '../serverDbQueries/v2/sync';
import {queryClient} from '../queryClient';
import uuid from 'react-native-uuid';
import {materializeReceivedTransferLogs} from '../localDbQueries/batchTransfer';

// ---------------------------------------------------------------------------
// Entity configuration
// ---------------------------------------------------------------------------

/**
 * Group A — bidirectional (push + pull).
 * All entities are here because every device in a branch both writes to and
 * needs to receive changes from other devices. Unique device-generated sync_ids
 * mean cross-device inserts never conflict.
 *
 * `pushFieldMap` — maps local SQLite column names to the server-side field names
 * for FK columns. Local tables use `*_id` suffix; server expects `*_sync_id`.
 * Only FK columns that reference other sync-able entities need to be listed here.
 */
const GROUP_A_ENTITIES = [
  // Catalog / master data
  {key: 'categories', table: 'categories'},
  // Company-wide Master Item List (shared across all branches in the company).
  // Server scopes pull by company_id (not branch_id) for this entity.
  {key: 'master_items', table: 'master_items'},
  // Audit trail for IDT (Import Inventory Data Template) events. Branch-scoped.
  // No FK remapping needed — imported_by_account_id is a raw account id, not a sync_id.
  {
    key: 'inventory_data_template_imports',
    table: 'inventory_data_template_imports',
  },
  {key: 'vendors', table: 'vendors'},
  {
    key: 'vendor_contact_persons',
    table: 'vendor_contact_persons',
    pushFieldMap: {vendor_id: 'vendor_sync_id'},
  },
  // Note: `taxes` and `operations` are excluded from delta sync (no sync_id column)
  {key: 'recipe_kinds', table: 'recipe_kinds'},
  {
    key: 'recipes',
    table: 'recipes',
    pushFieldMap: {recipe_kind_id: 'recipe_kind_sync_id'},
  },
  {
    key: 'ingredients',
    table: 'ingredients',
    pushFieldMap: {recipe_id: 'recipe_sync_id', item_id: 'item_sync_id'},
  },
  {
    key: 'items',
    table: 'items',
    pushFieldMap: {
      category_id: 'category_sync_id',
      recipe_id: 'recipe_sync_id',
      sub_recipe_id: 'sub_recipe_sync_id',
      tax_id: 'tax_sync_id',
      preferred_vendor_id: 'preferred_vendor_sync_id',
    },
  },
  {
    key: 'modifiers',
    table: 'modifiers',
    pushFieldMap: {item_id: 'item_sync_id'},
  },
  {
    key: 'modifier_options',
    table: 'modifier_options',
    pushFieldMap: {modifier_id: 'modifier_sync_id'},
  },
  {key: 'selling_menus', table: 'selling_menus'},
  {
    key: 'selling_menu_items',
    table: 'selling_menu_items',
    pushFieldMap: {
      selling_menu_id: 'selling_menu_sync_id',
      item_id: 'item_sync_id',
      modifier_option_id: 'modifier_option_sync_id',
    },
  },
  // Transaction / operational data
  {key: 'batch_purchase_groups', table: 'batch_purchase_groups'},
  {
    key: 'batch_purchase_entries',
    table: 'batch_purchase_entries',
    pushFieldMap: {
      batch_purchase_group_id: 'batch_purchase_group_sync_id',
      item_id: 'item_sync_id',
      tax_id: 'tax_sync_id',
      vendor_id: 'vendor_sync_id',
    },
  },
  {key: 'batch_stock_usage_groups', table: 'batch_stock_usage_groups'},
  {
    key: 'batch_stock_usage_entries',
    table: 'batch_stock_usage_entries',
    pushFieldMap: {
      batch_stock_usage_group_id: 'batch_stock_usage_group_sync_id',
      item_id: 'item_sync_id',
    },
  },
  // Cross-branch Batch Transfer. The server's pull() carve-out makes these
  // entities visible to BOTH source and destination branches; the FK columns
  // here (source_branch_id, destination_branch_id, initiator_branch_id)
  // reference branches.id directly (branches don't carry a sync_id) so no
  // remap is needed for them.
  {key: 'batch_transfer_groups', table: 'batch_transfer_groups'},
  {
    key: 'batch_transfer_entries',
    table: 'batch_transfer_entries',
    pushFieldMap: {
      batch_transfer_group_id: 'batch_transfer_group_sync_id',
      master_item_id: 'master_item_sync_id',
      source_item_id: 'source_item_sync_id',
      dest_item_id: 'dest_item_sync_id',
    },
  },
  {key: 'revenue_groups', table: 'revenue_groups'},
  // Reusable external POS / revenue sources. No FK remap (only `name`).
  {key: 'revenue_sources', table: 'revenue_sources'},
  {
    key: 'revenues',
    table: 'revenues',
    pushFieldMap: {
      revenue_group_id: 'revenue_group_sync_id',
      revenue_source_id: 'revenue_source_sync_id',
    },
  },
  {key: 'expense_groups', table: 'expense_groups'},
  {
    key: 'expenses',
    table: 'expenses',
    pushFieldMap: {expense_group_id: 'expense_group_sync_id'},
  },
  {
    key: 'revenue_deductions',
    table: 'revenue_deductions',
    pushFieldMap: {
      revenue_group_id: 'revenue_group_sync_id',
      expense_id: 'expense_sync_id',
    },
  },
  {
    key: 'revenue_categories',
    table: 'revenue_categories',
    pushFieldMap: {
      revenue_group_id: 'revenue_group_sync_id',
      category_id: 'category_sync_id',
    },
  },
  {
    key: 'spoilages',
    table: 'spoilages',
    pushFieldMap: {item_id: 'item_sync_id'},
  },
  {key: 'sales_order_groups', table: 'sales_order_groups'},
  {
    key: 'invoices',
    table: 'invoices',
    pushFieldMap: {sales_order_group_id: 'sales_order_group_sync_id'},
  },
  {
    key: 'sale_logs',
    table: 'sale_logs',
    pushFieldMap: {
      invoice_id: 'invoice_sync_id',
      item_id: 'item_sync_id',
      refund_id: 'refund_sync_id',
    },
  },
  {
    key: 'sales_orders',
    table: 'sales_orders',
    pushFieldMap: {
      invoice_id: 'invoice_sync_id',
      sales_order_group_id: 'sales_order_group_sync_id',
      item_id: 'item_sync_id',
    },
  },
  {
    key: 'refunds',
    table: 'refunds',
    pushFieldMap: {sale_log_id: 'sale_log_sync_id'},
  },
  {
    key: 'payments',
    table: 'payments',
    pushFieldMap: {invoice_id: 'invoice_sync_id'},
  },
  {
    key: 'inventory_logs',
    table: 'inventory_logs',
    pushFieldMap: {
      operation_id: 'operation_sync_id',
      item_id: 'item_sync_id',
      recipe_id: 'recipe_sync_id',
      batch_purchase_group_id: 'batch_purchase_group_sync_id',
      batch_transfer_group_id: 'batch_transfer_group_sync_id',
      invoice_id: 'invoice_sync_id',
      idt_import_id: 'idt_import_sync_id',
    },
  },
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
      `INSERT INTO sync_metadata (id, entity_type, last_pushed_at, last_pulled_at)
       VALUES (?, ?, ?, ?)`,
      [uuid.v4(), entityType, lastPushedAt ?? null, lastPulledAt ?? null],
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
// Cache of {tableName: Set<columnName>} so we only run PRAGMA once per table.
// Reset whenever the active DB changes — we tie this to runSync() which calls
// resetTableColumnCache() at the top.
let _tableColumnCache = {};
const resetTableColumnCache = () => {
  _tableColumnCache = {};
};

const getTableColumns = async (db, tableName) => {
  if (_tableColumnCache[tableName]) return _tableColumnCache[tableName];
  const cols = new Set();
  const result = await db.executeSql(`PRAGMA table_info(${tableName})`);
  for (let i = 0; i < result[0].rows.length; i++) {
    cols.add(result[0].rows.item(i).name);
  }
  _tableColumnCache[tableName] = cols;
  return cols;
};

const applyPulledRecord = async (db, tableName, record) => {
  // Strip sync_id (added back below as id+sync_id explicitly), created_at
  // (not a column on any local table), and id (would collide with the
  // explicit id=sync_id we INSERT — Eloquent occasionally serializes the
  // primary key even when not selected, which would produce a "duplicate
  // column name: id" error and INSERT OR IGNORE used to swallow it).
  // eslint-disable-next-line no-unused-vars
  const {sync_id, created_at, id: _serverId, ...rawFields} = record;
  if (!sync_id) return;

  // Remap server-side *_sync_id FK columns to local *_id column names.
  // Server uses _sync_id suffix (e.g. category_sync_id); local SQLite tables
  // use the older _id suffix (e.g. category_id). Values are interchangeable
  // because local id === sync_id (same client-generated UUID).
  const remapped = {};
  for (const [key, value] of Object.entries(rawFields)) {
    remapped[key.replace(/_sync_id$/, '_id')] = value;
  }

  // Older server rows may have is_deleted = NULL. The local active_<table>
  // views use IFNULL but the base table receives the raw value, so coerce
  // here as well so downstream code never has to second-guess this column.
  if (remapped.is_deleted === null || remapped.is_deleted === undefined) {
    remapped.is_deleted = 0;
  }

  // Drop any column the server sends that the local table does not have.
  // Without this, a single unknown column (e.g. a server-only meta field, or a
  // column not yet added by an alterTables migration) makes INSERT OR IGNORE
  // silently drop the entire row — which is exactly the "items pulled but
  // invisible" symptom that survived the earlier fixes.
  const tableCols = await getTableColumns(db, tableName);
  const fields = {};
  const droppedKeys = [];
  for (const [k, v] of Object.entries(remapped)) {
    if (tableCols.has(k)) {
      fields[k] = v;
    } else {
      droppedKeys.push(k);
    }
  }
  if (droppedKeys.length) {
    console.debug(
      `[sync] ${tableName} dropping unknown columns from server payload:`,
      droppedKeys,
    );
  }

  const [existing] = await db.executeSql(
    `SELECT id, updated_at FROM ${tableName} WHERE sync_id = ?`,
    [sync_id],
  );

  if (existing.rows.length === 0) {
    // Insert new record from server. Plain INSERT (not INSERT OR IGNORE) so
    // schema errors actually surface in logs instead of silently dropping
    // every pulled row. The existence check above already protects against
    // sync_id duplicates.
    const columns = ['id', 'sync_id', 'synced_at', ...Object.keys(fields)].join(
      ', ',
    );
    const placeholders = Array(Object.keys(fields).length + 3)
      .fill('?')
      .join(', ');
    try {
      await db.executeSql(
        `INSERT INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        [sync_id, sync_id, fields.updated_at ?? null, ...Object.values(fields)],
      );
    } catch (insertErr) {
      console.warn(
        `[sync] INSERT failed for ${tableName} sync_id=${sync_id}:`,
        insertErr?.message ?? insertErr,
        '| columns:',
        columns,
        '| values:',
        JSON.stringify(Object.values(fields)),
      );
      throw insertErr;
    }
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

/**
 * Rebuild the local `items.master_item_sync_id` cache from `sku`.
 *
 * `master_item_sync_id` is the join key every Master Item List / Batch Transfer
 * query keys off (e.g. the SelectMasterItem "available for branch" filter and
 * resolveMissingSourceItemIdsForGroup), but it is a CLIENT-ONLY column — the
 * server's `items` table has no such field and instead carries the branch
 * item → master link via `sku` (server migration ..._000018: "without a
 * separate FK column"). So `sku` survives a push/pull round-trip while
 * `master_item_sync_id` does not: after a reinstall, items pull back with their
 * sku intact but `master_item_sync_id = NULL`, which silently breaks both the
 * "Add from Company Master Item List" dedup filter (every master looks
 * unattached) and Batch Transfer fulfillment (every line reads "not in your
 * catalog").
 *
 * This re-derives the cache by matching the synced `sku` against the synced
 * master_items.sku — the canonical company-wide link. It runs after every pull,
 * is idempotent (touches only NULL/empty rows), and deliberately does NOT bump
 * `updated_at`: this is a local reconciliation, the server has no column to
 * receive it, and a bump would re-push every item on the next sync.
 *
 * Order-independent: matches on sku, so it self-heals whether the master_items
 * row arrived before, with, or after the items row across one or many pulls.
 *
 * Returns the number of items rows relinked, so the caller can invalidate React
 * Query caches even on a pull that returned no new records (the case for users
 * who reinstalled before this fix shipped — their items are already local with
 * a NULL link and only need the relink, not a fresh pull).
 */
const backfillItemMasterLinks = async db => {
  const [res] = await db.executeSql(
    `UPDATE items
     SET master_item_sync_id = (
       SELECT mi.sync_id
       FROM master_items mi
       WHERE mi.sku = items.sku
       ORDER BY IFNULL(mi.is_deleted, 0) ASC, mi.id ASC
       LIMIT 1
     )
     WHERE (master_item_sync_id IS NULL OR master_item_sync_id = '')
       AND sku IS NOT NULL
       AND sku != ''
       AND EXISTS (
         SELECT 1 FROM master_items mi WHERE mi.sku = items.sku
       )`,
  );
  return res?.rowsAffected ?? 0;
};

// ---------------------------------------------------------------------------
// Main sync entry point
// ---------------------------------------------------------------------------

let syncInProgress = false;
// Promise tracking the currently-running runSync(). Concurrent callers
// (notably flushPendingSync at branch switch) await this instead of getting
// back the no-op "skipped" result.
let _inFlightSync = null;

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

/**
 * Cancel any pending debounced sync and await a fresh push-pull cycle. Used
 * at branch switch so the current branch's unsynced rows are pushed BEFORE
 * the active DB pointer moves to the next branch — without this, a debounce
 * timer or 15s interval that fires after the switch runs against the new
 * DB and the previous branch's pending rows sit in its SQLite file forever
 * (and are lost on a reinstall).
 *
 * If a sync is already running, awaits it before starting another so any
 * mutation that landed between scheduleSyncSoon() and now still gets pushed.
 */
export const flushPendingSync = async () => {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  if (_inFlightSync) {
    try {
      await _inFlightSync;
    } catch (_) {
      // swallow — caller still wants the flush attempt to run
    }
  }
  return runSync();
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
    // Return the in-flight promise (if any) so callers like flushPendingSync
    // actually wait for the running sync to finish, instead of getting back
    // a no-op result while the real sync is still pushing.
    return (
      _inFlightSync ?? {
        pushed: {},
        pulled: {},
        errors: ['Sync already in progress — skipped.'],
      }
    );
  }
  syncInProgress = true;
  _inFlightSync = (async () => {
  const result = {pushed: {}, pulled: {}, errors: []};

  try {
    const {deviceId, branchId} = await getCloudSyncParams();

    if (!deviceId || !branchId) {
      result.errors.push('No cloud device/branch configured — skipping sync.');
      return result;
    }

    // The 15-second interval started by useAppLifecycle can fire before
    // CloudAuthContextProvider.restore() finishes calling setActiveCompanyDb.
    // In that window getDBConnection would open the unauth FCMS.db fallback
    // and the pulled rows would land in the wrong file — making it look like
    // data disappeared on the next branch switch. Skip if the active DB does
    // not match the credentials we are about to sync.
    const activeBranchId = getActiveBranchId();
    const activeCompanyId = getActiveCompanyId();
    if (!activeCompanyId || activeBranchId !== branchId) {
      result.errors.push(
        `Active DB (company=${activeCompanyId}, branch=${activeBranchId}) does not match sync credentials (branch=${branchId}) — skipping sync.`,
      );
      return result;
    }

    let db;
    try {
      db = await getDBConnection();
    } catch (err) {
      result.errors.push(`DB connection failed: ${err.message}`);
      return result;
    }

    // FKs default to OFF in SQLite, but the UUID migration explicitly enables
    // them at the end. With FKs on, child INSERTs whose parent hasn't arrived
    // yet error out. Disable for the duration of this sync — entities arrive
    // out of dependency order and we still want every row visible.
    try {
      await db.executeSql('PRAGMA foreign_keys=OFF;');
    } catch (e) {
      // non-fatal; continue with whatever the connection had
    }

    // The PRAGMA table_info cache is keyed by table name only, so it must be
    // cleared whenever we may have switched DB files (different branches have
    // separate files and conceivably different alter-state). Cheap to rebuild.
    resetTableColumnCache();

    const pushedAt = new Date().toISOString();

    // ---- Phase 1: Collect delta ----
    const delta = {};
    for (const {key, table, pushFieldMap} of ALL_PUSH_ENTITIES) {
      try {
        const rows = await collectUnsynced(db, table);
        if (rows.length > 0) {
          // Remap local *_id FK column names to the server-expected *_sync_id names
          // so the server's array_intersect_key picks them up correctly.
          delta[key] = pushFieldMap
            ? rows.map(row => {
                const remapped = {...row};
                for (const [localField, serverField] of Object.entries(
                  pushFieldMap,
                )) {
                  if (
                    Object.prototype.hasOwnProperty.call(remapped, localField)
                  ) {
                    remapped[serverField] = remapped[localField];
                    delete remapped[localField];
                  }
                }
                return remapped;
              })
            : rows;
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

        const {
          accepted = {},
          sku_updates: skuUpdates = [],
          sync_id_remaps: syncIdRemaps = [],
          synced_at,
        } = pushResponse?.data ?? {};
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

        // Apply server-corrected master item SKUs. Happens when two branches
        // register colliding SKUs offline; the server regenerates the 4-char
        // suffix and echoes the corrected SKU back here. We patch the local
        // master_items row and any items rows that join via master_item_sync_id
        // — no updated_at bump, since this is a sync ack rather than a user
        // mutation, and we don't want to retrigger a push.
        if (Array.isArray(skuUpdates) && skuUpdates.length > 0) {
          for (const {sync_id, sku} of skuUpdates) {
            if (!sync_id || !sku) continue;
            try {
              await db.executeSql(
                `UPDATE master_items SET sku = ? WHERE sync_id = ?`,
                [sku, sync_id],
              );
              await db.executeSql(
                `UPDATE items SET sku = ? WHERE master_item_sync_id = ?`,
                [sku, sync_id],
              );
            } catch (err) {
              result.errors.push(
                `Apply sku_update failed for ${sync_id}: ${err.message}`,
              );
            }
          }
        }

        // Apply server-side cross-branch master_items dedup remaps. Fired
        // when the same logical product was pushed from a second branch
        // (typical case: the same IDT file imported on Branch A then B);
        // the server detects the dedup_key collision, keeps the canonical
        // row, and tells us to repoint our local items onto it. The local
        // orphan master row is hard-deleted — it was never accepted by the
        // server, so no other device knows about it; soft-deleting would
        // incorrectly re-push the row on the next sync.
        if (Array.isArray(syncIdRemaps) && syncIdRemaps.length > 0) {
          for (const {from, to, sku} of syncIdRemaps) {
            if (!from || !to) continue;
            try {
              await db.executeSql(
                `UPDATE items SET master_item_sync_id = ?, sku = ? WHERE master_item_sync_id = ?`,
                [to, sku ?? '', from],
              );
              await db.executeSql(
                `DELETE FROM master_items WHERE sync_id = ? AND (synced_at IS NULL)`,
                [from],
              );
            } catch (err) {
              result.errors.push(
                `Apply sync_id_remap failed for ${from}→${to}: ${err.message}`,
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

      // Log what the server returned so we can diagnose missing entities.
      const pulledCounts = Object.fromEntries(
        Object.entries(pulledDelta).map(([k, v]) => [
          k,
          Array.isArray(v) ? v.length : v,
        ]),
      );
      console.debug(
        '[sync] pull response entities:',
        JSON.stringify(pulledCounts),
        '| since:',
        since,
        '| isInitialPull:',
        isInitialPull,
      );

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
          try {
            await updateSyncMetadata(db, key, {lastPulledAt: pulled_at});
          } catch (err) {
            result.errors.push(
              `Update watermark failed for ${key}: ${err.message}`,
            );
          }
        }
      }

      // Rebuild the client-only items.master_item_sync_id cache from the synced
      // sku. Must run AFTER the pull loop (items + master_items are now local)
      // and BEFORE materializeReceivedTransferLogs() below, which joins
      // active_items on master_item_sync_id. Without this, reinstalled items
      // come back with a NULL link and every Master Item List / Batch Transfer
      // join misses. See backfillItemMasterLinks() for the full rationale.
      let relinkedCount = 0;
      try {
        relinkedCount = await backfillItemMasterLinks(db);
      } catch (err) {
        result.errors.push(`backfillItemMasterLinks failed: ${err.message}`);
      }

      // Materialize source-side stock_transfer_out inventory_logs for any
      // batch_transfer_group we are the source of that just flipped to
      // 'received' on the destination side. Idempotent; safe on every pull.
      // Runs BEFORE the React Query invalidation so the new logs are visible
      // immediately on the item drill-down.
      try {
        await materializeReceivedTransferLogs();
      } catch (err) {
        result.errors.push(
          `materializeReceivedTransferLogs failed: ${err.message}`,
        );
      }

      // If any records were pulled into SQLite, invalidate all React Query caches
      // so that currently-rendered screens refetch their data and show the new
      // records. Also invalidate when the master-link backfill relinked rows on
      // an otherwise-empty pull, so an already-open Master Item List / Batch
      // Transfer screen reflects the repaired links without a manual refresh.
      if (Object.keys(result.pulled).length > 0 || relinkedCount > 0) {
        queryClient.invalidateQueries();
      }
    } catch (err) {
      result.errors.push(`Pull failed: ${err.message}`);
    }
  } finally {
    syncInProgress = false;
  }

  console.debug(
    '[sync] runSync complete. pushed:',
    JSON.stringify(result.pushed),
    '| pulled:',
    JSON.stringify(result.pulled),
    '| errors:',
    JSON.stringify(result.errors),
  );
  return result;
  })();
  try {
    return await _inFlightSync;
  } finally {
    _inFlightSync = null;
  }
};
