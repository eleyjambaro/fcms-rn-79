# Sync Trigger Points Implementation Plan

**Date:** 2026-04-07  
**Scope:** Wire `runSync()` to the three trigger points specified in the delta sync plan:
1. App foreground (background → active transition)
2. Network reconnect (offline → online transition)
3. After major mutations (sales, purchases, expenses)

---

## Design Decisions

### Single-flight guard in the service (not in callers)

Rather than tracking a deduplication ref in each call site (foreground hook, reconnect listener, mutation callback), we add a module-level `syncInProgress` flag to `syncService.js` itself. This ensures that no matter how many triggers fire simultaneously (e.g., foreground + reconnect at the same time), only one sync cycle runs. Callers are unaware of each other and don't need to coordinate.

```js
// syncService.js — added at module level
let syncInProgress = false;

export const runSync = async () => {
  if (syncInProgress) return {pushed: {}, pulled: {}, errors: ['Sync already in progress']};
  syncInProgress = true;
  try {
    // ... existing body
  } finally {
    syncInProgress = false;
  }
};
```

### No new hook file needed

Trigger points are fire-and-forget: `runSync().catch(console.warn)`. No loading state is surfaced to the user for background syncs. A new `useSync` hook would add abstraction with no benefit for this use case.

### All trigger points are fire-and-forget

Sync runs in the background. Failures are logged to console. The app does not block the user or show error UI for background sync failures — the next trigger will retry.

---

## Files to Change

### 1. `src/services/syncService.js` — add single-flight guard

**Change:** Wrap the `runSync` export body with a `syncInProgress` module-level flag.

**Before (current):**
```js
export const runSync = async () => {
  const result = {pushed: {}, pulled: {}, errors: []};
  ...
```

**After:**
```js
let syncInProgress = false;

export const runSync = async () => {
  if (syncInProgress) {
    return {pushed: {}, pulled: {}, errors: ['Sync already in progress — skipped.']};
  }
  syncInProgress = true;
  const result = {pushed: {}, pulled: {}, errors: []};
  try {
    ...
  } finally {
    syncInProgress = false;
  }
};
```

---

### 2. `src/hooks/useAppLifecycle.js` — foreground + network reconnect triggers

**Change:** Import `runSync` and `NetInfo`. Add a foreground sync inside the existing AppState handler. Add a NetInfo subscription that fires sync when connectivity transitions from offline → online.

**Current file does:**
- Listens to `AppState` changes
- On foreground or background: invalidates `authTokenStatus` and `licenseKeyStatus` queries

**New behavior:**
- On foreground (`inactive|background` → `active`): also call `runSync().catch(console.warn)`
- On NetInfo: track `wasConnected` with a ref; when `isConnected && isInternetReachable` flips from false → true, call `runSync().catch(console.warn)`

**Note:** NetInfo `isInternetReachable` can be `null` on startup (unknown). Initialize `wasConnected.current` to `null` so the first event (even if it reports connected) does not fire a spurious sync — only genuine false→true transitions trigger it.

**Full replacement of useAppLifecycle.js:**
```js
import {useEffect, useRef} from 'react';
import {AppState} from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import {useQueryClient} from '@tanstack/react-query';
import {runSync} from '../services/syncService';

export default function useAppLifecycle() {
  const appState = useRef(AppState.currentState);
  const wasConnected = useRef(null); // null = unknown (startup)
  const queryClient = useQueryClient();

  useEffect(() => {
    // --- AppState: foreground detection ---
    const appStateSubscription = AppState.addEventListener('change', nextAppState => {
      const isForeground =
        appState.current.match(/inactive|background/) &&
        nextAppState === 'active';

      if (isForeground || nextAppState === 'background') {
        queryClient.invalidateQueries(['authTokenStatus']);
        queryClient.invalidateQueries(['licenseKeyStatus']);
      }

      if (isForeground) {
        runSync().catch(console.warn);
      }

      appState.current = nextAppState;
    });

    // --- NetInfo: reconnect detection ---
    const netInfoUnsubscribe = NetInfo.addEventListener(state => {
      const isNowConnected = !!(state.isConnected && state.isInternetReachable);

      if (wasConnected.current === false && isNowConnected) {
        runSync().catch(console.warn);
      }

      wasConnected.current = isNowConnected;
    });

    return () => {
      appStateSubscription.remove();
      netInfoUnsubscribe();
    };
  }, [queryClient]);
}
```

---

### 3. `src/screens/PaymentMethod.js` — post-mutation trigger

**Why PaymentMethod.js:** This screen handles all three major sale flows:
- `handleConfirmSaleEntries` — completes a sale invoice + payments
- `handleAddSaleEntriesToSalesOrders` — creates a sales order
- `handleConfirmFulfillingSalesOrders` — fulfills an existing order

**Change:** Import `runSync` and call it fire-and-forget inside each `onSuccess` callback, **after** navigation.

In each `onSuccess`:
```js
onSuccess: () => {
  actions?.resetSalesCounter();
  navigation.navigate({ ... });
  runSync().catch(console.warn); // ← add this line
},
```

Apply to all three `onSuccess` blocks:
- `handleConfirmSaleEntries` → `onSuccess` (around line 150)
- `handleAddSaleEntriesToSalesOrders` → `onSuccess` (around line 183)
- `handleConfirmFulfillingSalesOrders` → `onSuccess` (around line 220)

---

## Out of Scope (Future Work)

The following screens also perform major mutations and could receive `runSync()` calls, but are lower priority because foreground sync on next app open will cover them:

- Batch purchase entry screens (writes to `batch_purchase_groups`, `batch_purchase_entries`)
- Expense entry screens (writes to `expense_groups`, `expenses`)
- Stock usage screens (writes to `batch_stock_usage_groups`, `batch_stock_usage_entries`)
- Recipe/item/category edit screens (Group A — bidirectional, highest value to sync quickly)

These can be added incrementally by importing `runSync` and calling it fire-and-forget in their `onSuccess` or `onSubmit` handlers.

---

## Execution Order

1. Edit `syncService.js` — add single-flight guard
2. Replace `useAppLifecycle.js` — foreground + reconnect triggers
3. Edit `PaymentMethod.js` — three `onSuccess` call sites

No new files. No new packages (NetInfo is already installed at `^11.4.1`).
