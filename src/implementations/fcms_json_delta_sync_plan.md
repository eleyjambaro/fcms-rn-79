# FCMS JSON Delta Sync Plan

**Version:** Draft v1
**Date:** 2026-04-07

---

## Current State Summary

- **39 SQLite tables**, all tagged with `device_id` + `branch_id` on every INSERT
- **No sync fields**: no `updated_at`, `synced_at`, `is_deleted`, `sync_id`
- **No change tracking**: impossible to know what changed since last sync
- **Server only has**: auth, devices, branches — no data endpoints
- **Soft-delete via `voided`** on transactional tables, hard-delete elsewhere

---

## Core Protocol: Push-Pull with Watermark

Each sync cycle has two phases:

1. **PUSH** — device sends all local records modified since `last_pushed_at`
2. **PULL** — device fetches all cloud records modified since `last_pulled_at` by other devices/branches

The "delta" is determined by an `updated_at` watermark. Records where `updated_at > last_synced_at OR synced_at IS NULL` are included in the delta.

---

## Phase 1: Schema Changes (Mobile SQLite)

### Add to every syncable table:

| Column | Type | Purpose |
|---|---|---|
| `sync_id` | VARCHAR(36) | UUID generated on INSERT — cloud's canonical ID |
| `updated_at` | DATETIME | Updated on every INSERT/UPDATE — delta detection |
| `synced_at` | DATETIME DEFAULT NULL | Set on successful sync — skip if `updated_at ≤ synced_at` |
| `is_deleted` | INTEGER DEFAULT 0 | Soft-delete flag for records that need tombstoning |

### New table: `sync_metadata`

```sql
CREATE TABLE sync_metadata (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  entity_type VARCHAR(100) UNIQUE,
  last_pushed_at DATETIME DEFAULT NULL,
  last_pulled_at DATETIME DEFAULT NULL
)
```

This is an `ALTER TABLE` migration on app version bump.

---

## Phase 2: Entity Classification

### Group A — Master Data (bidirectional sync, shared across all devices in a branch)

| Entity | Notes |
|---|---|
| `categories` | Shared catalog |
| `taxes` | Shared |
| `items` | Core entity — high conflict risk |
| `modifiers` / `modifier_options` | Linked to items |
| `vendors` / `vendor_contact_persons` | Shared |
| `recipe_kinds` / `recipes` / `ingredients` | Shared |
| `selling_menus` / `selling_menu_items` | Shared |
| `operations` | App-defined, rarely changes |

### Group B — Transactional Data (push-only from device, no pull overwrite)

| Entity | Notes |
|---|---|
| `inventory_logs` | Device-originated, immutable on server |
| `batch_purchase_groups` + `entries` | Same |
| `batch_stock_usage_groups` + `entries` | Same |
| `invoices` / `sale_logs` / `sales_orders` / `sales_order_groups` | POS transactions |
| `payments` / `refunds` | Financial records |
| `spoilages` | Waste logs |
| `revenues` / `revenue_groups` | Financial |
| `expenses` / `expense_groups` | Financial |
| `revenue_deductions` / `revenue_categories` | Relational |

### Group C — Device-Local Only (never synced)

| Entity | Notes |
|---|---|
| `saved_printers` | Hardware-specific |
| `app_versions` | Local versioning |
| `settings` | Device-local preferences |

---

## Phase 3: Conflict Resolution Strategy

| Scenario | Resolution |
|---|---|
| Master data updated on two devices simultaneously | **Server timestamp wins** — last-write-wins at the API layer |
| Transactional records (invoices, logs) | **No conflict possible** — each record is owned by the device that created it (via `device_id`) |
| Voided record pulled from server | **Apply void** — `voided = 1` propagates down |
| Record deleted locally (`is_deleted = 1`) | Push tombstone; server soft-deletes; pull propagates to other devices |
| Pull conflicts with local unsaved edit | **Local wins, re-push on next cycle** |

Key insight: transactional records have natural partitioning by `device_id`, so true conflicts only occur on Group A master data.

---

## Phase 4: API Endpoints Needed (Cloud — Laravel)

### Sync Core

```
POST /api/v2/sync/push          Upload delta (all entity types in one payload)
GET  /api/v2/sync/pull          Download delta (?since=ISO8601&branch_id=uuid)
GET  /api/v2/sync/status        Check server-side last sync timestamps per entity
```

### Master Data CRUD (for individual entity management from web dashboard + selective pull)

```
GET  /api/v2/items              Paginated, filterable
POST /api/v2/items
PUT  /api/v2/items/{sync_id}

GET  /api/v2/categories
POST /api/v2/categories
PUT  /api/v2/categories/{sync_id}

GET  /api/v2/taxes
POST /api/v2/taxes
PUT  /api/v2/taxes/{sync_id}

GET  /api/v2/vendors
POST /api/v2/vendors
PUT  /api/v2/vendors/{sync_id}

GET  /api/v2/recipes
POST /api/v2/recipes
PUT  /api/v2/recipes/{sync_id}

GET  /api/v2/selling-menus
POST /api/v2/selling-menus
PUT  /api/v2/selling-menus/{sync_id}
```

### Transactional (receive-only on server, no server-side mutation)

```
POST /api/v2/sync/push          Handled by the bulk push endpoint above
GET  /api/v2/reports/sales      Aggregated server-side reporting (bonus, future)
```

---

## Phase 5: Sync Payload Format

### Push Request

```
POST /api/v2/sync/push
Authorization: Bearer {token}
X-Device-Token: {device_token}
```

```json
{
  "device_id": "uuid",
  "branch_id": "uuid",
  "pushed_at": "2026-04-07T10:00:00Z",
  "delta": {
    "categories": [
      { "sync_id": "uuid", "name": "Beverages", "updated_at": "2026-04-07T09:55:00Z", "is_deleted": 0 }
    ],
    "items": [
      { "sync_id": "uuid", "name": "Latte", "unit_cost": 45.00, "updated_at": "...", "is_deleted": 0 }
    ],
    "inventory_logs": [
      { "sync_id": "uuid", "item_id": "local-int", "adjustment_qty": -2, "updated_at": "...", "is_deleted": 0 }
    ],
    "invoices": [ ],
    "sale_logs": [ ]
  }
}
```

### Push Response

```json
{
  "status": "success",
  "data": {
    "accepted": { "categories": 3, "items": 12, "inventory_logs": 5 },
    "conflicts": [
      {
        "entity": "items",
        "sync_id": "uuid",
        "resolution": "server_wins",
        "server_record": { "sync_id": "uuid", "name": "Latte", "unit_cost": 50.00, "updated_at": "..." }
      }
    ],
    "synced_at": "2026-04-07T10:00:01Z"
  }
}
```

### Pull Request

```
GET /api/v2/sync/pull?since=2026-04-07T09:00:00Z&branch_id=uuid
Authorization: Bearer {token}
X-Device-Token: {device_token}
```

### Pull Response

```json
{
  "status": "success",
  "data": {
    "pulled_at": "2026-04-07T10:00:02Z",
    "delta": {
      "categories": [
        { "sync_id": "uuid", "name": "Beverages", "updated_at": "...", "is_deleted": 0 }
      ],
      "items": [
        { "sync_id": "uuid", "name": "Latte", "unit_cost": 50.00, "updated_at": "...", "is_deleted": 0 }
      ]
    }
  }
}
```

---

## Phase 6: Implementation Order

1. **Mobile schema migration** — Add `sync_id`, `updated_at`, `synced_at`, `is_deleted` to all Group A/B tables via `alterTables`. Add `sync_metadata` table.
2. **Auto-populate `sync_id` and `updated_at`** — Update all existing `localDbQueries` INSERT/UPDATE functions to generate and set these fields.
3. **Sync service** (`/src/services/syncService.js`) — collect delta, call push, apply pull, update watermarks.
4. **Cloud: push endpoint** — upsert with conflict detection for Group A; insert-only for Group B.
5. **Cloud: pull endpoint** — return Group A records modified by other devices since `since`.
6. **Trigger points** — sync on app foreground, after major mutations, on network reconnect.
7. **Cloud CRUD endpoints** — for web dashboard and full entity management.

---

## Key Design Decisions

### 1. UUID strategy
Generate `sync_id` on the device at INSERT time (v4 UUID via `react-native-uuid`) rather than delegating to the server. This allows offline-first insert without waiting for a server round-trip.

### 2. Sync granularity
One bulk `POST /sync/push` per cycle (not per entity) — reduces round-trips for offline catch-up. Pull is also one request per cycle.

### 3. Branch scoping
The pull endpoint only returns records for the device's assigned branch. Cross-branch reporting is a server-side concern only.

### 4. No real-time sync
Push/pull is triggered manually or on app lifecycle events — no WebSocket/SSE needed for v1.

### 5. `voided` vs `is_deleted`
`voided` remains the business-level void flag (a POS concept meaning the transaction was cancelled). `is_deleted` is the sync tombstone flag for records the user permanently removes from the catalog.

### 6. `inventory_logs` foreign key handling
`inventory_logs` references local INTEGER `item_id`. On push, include `item_sync_id` as a resolved reference alongside the local `item_id` so the server can link records correctly.

---

## Notes

- All sync requests must include both `Authorization: Bearer {auth_token}` and `X-Device-Token: {device_token}` headers.
- The server must validate that `device_id` matches the authenticated device token before accepting a push.
- Records in Group B (transactional) are never overwritten by a pull — they are append-only on both device and server.
- Foreign key references between tables (e.g., `sale_logs.invoice_id`) must be resolved to `sync_id` values before push.
