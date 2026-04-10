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
import {queryClient} from '../queryClient';
import uuid from 'react-native-uuid';

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
  {key: 'revenue_groups', table: 'revenue_groups'},
  {
    key: 'revenues',
    table: 'revenues',
    pushFieldMap: {revenue_group_id: 'revenue_group_sync_id'},
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
      invoice_id: 'invoice_sync_id',
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
const applyPulledRecord = async (db, tableName, record) => {
  // created_at is returned by the server but is not a column in any local SQLite
  // table — strip it before building INSERT/UPDATE to prevent "no such column" errors.
  // eslint-disable-next-line no-unused-vars
  const {sync_id, created_at, ...rawFields} = record;
  if (!sync_id) return;

  // Remap server-side *_sync_id FK columns to local *_id column names.
  // Server uses _sync_id suffix (e.g. category_sync_id); local SQLite tables
  // use the older _id suffix (e.g. category_id). Values are interchangeable
  // because local id === sync_id (same client-generated UUID).
  const fields = {};
  for (const [key, value] of Object.entries(rawFields)) {
    fields[key.replace(/_sync_id$/, '_id')] = value;
  }

  const [existing] = await db.executeSql(
    `SELECT id, updated_at FROM ${tableName} WHERE sync_id = ?`,
    [sync_id],
  );

  if (existing.rows.length === 0) {
    // Insert new record from server.
    // Local tables use `id TEXT PRIMARY KEY NOT NULL` where id === sync_id
    // (both are the same client-generated UUID). We must supply `id` explicitly
    // or SQLite silently drops the row (INSERT OR IGNORE absorbs NOT NULL failures).
    const columns = ['id', 'sync_id', 'synced_at', ...Object.keys(fields)].join(
      ', ',
    );
    const placeholders = Array(Object.keys(fields).length + 3)
      .fill('?')
      .join(', ');
    console.debug(
      `[sync] INSERT ${tableName} sync_id=${sync_id} cols=[${columns}]`,
    );
    try {
      await db.executeSql(
        `INSERT OR IGNORE INTO ${tableName} (${columns}) VALUES (${placeholders})`,
        [sync_id, sync_id, fields.updated_at ?? null, ...Object.values(fields)],
      );
    } catch (insertErr) {
      console.warn(
        `[sync] INSERT failed for ${tableName} sync_id=${sync_id}:`,
        insertErr?.message ?? insertErr,
        '| columns:',
        columns,
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

      // If any records were pulled into SQLite, invalidate all React Query caches
      // so that currently-rendered screens refetch their data and show the new records.
      if (Object.keys(result.pulled).length > 0) {
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
};
