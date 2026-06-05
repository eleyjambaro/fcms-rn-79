# Add a SKU QR Code to items (3 display locations)

## Context

Each inventory item already has a human-readable `sku` (e.g. `COK-A3FG`), auto-generated on registration and guaranteed present for new items (`registerItem` in [items.js](src/localDbQueries/items.js)). There is currently no way to surface that SKU as a scannable code. We want to render a **QR code whose value is the item's `sku`** in three places so staff can scan an item instead of searching by name:

1. **Item screen** (`ItemView`) — to the **left** of the Item name + Finished Product badge / Category / Revenue Group block.
2. **Item Report screen** (`ItemReportView`) — same position/location as the Item screen.
3. **Master Item List** — inside an expanded accordion, **above** the Branch item list.

The app has no QR capability yet, but `react-native-svg@15.12.0` is already installed and linked, which is the peer dependency for the standard QR renderer.

### Decisions (confirmed with user)
- **Tap-to-enlarge**: the inline QR is tappable and opens a large, easily-scannable QR in a dialog.
- **SKU caption**: show a small `SKU: <value>` label with the QR on the Item screen and Item Report screen. The Master Item List already shows the SKU in its accordion title, so the QR there renders **without** a caption.
- When an item has no `sku` (legacy/NULL), render **nothing** — the layout falls back to the current single-column header.

## Where things live (verified)

| Location | Screen file | Header component to edit | `sku` source |
|---|---|---|---|
| Item screen | [src/modals/ItemView.js](src/modals/ItemView.js) | [src/components/items/ItemStockSummary.js](src/components/items/ItemStockSummary.js) (header block ~L462–523) | `getItem` already selects `items.sku AS sku` ([items.js:1034](src/localDbQueries/items.js#L1034)) ✓ |
| Item Report screen | [src/screens/ItemReportView.js](src/screens/ItemReportView.js) | [src/components/items/ItemDetails.js](src/components/items/ItemDetails.js) (header block L287–338) | `getItemReport` → `buildItemReportSql` does **NOT** select sku — needs patch ✗ |
| Master Item List | [src/screens/MasterItemList.js](src/screens/MasterItemList.js) | `MasterItemAccordion` (expanded content L259–294) | `masterItem.sku` already present (used at L246) ✓ |

> Note: `ItemView` lives under `/src/modals/` (legacy dir — CLAUDE.md says don't add *new* screens there). We're only editing an existing file, which is fine.

## Plan

### 1. Add the QR dependency
```bash
npm install react-native-qrcode-svg
```
Pure-JS; renders via the already-linked `react-native-svg`. **No pod install / native rebuild needed** — just restart Metro. (`check-dependencies` may need a run if it gates the dep manifest.)

### 2. New reusable component: `src/components/items/ItemQRCode.js`
A single component reused by all three sites so sizing/behavior never drifts.

Props: `value` (the sku string), `size` (default ~84), `showCaption` (default `true`), `style`.

Behavior:
- Trim `value`; if empty → `return null`.
- Render an inline `<QRCode value={sku} size={size} />` from `react-native-qrcode-svg`, wrapped in a `Pressable`.
- When `showCaption`, render a small `SKU: <sku>` `Text` below the inline QR.
- On press, open a `react-native-paper` `Portal` + `Dialog` containing a large QR (~240px) centered, the SKU text, and a Close button. Manage `visible` with local `useState`. (Multiple Portals/Dialogs already coexist in these screens, so this is safe.)

### 3. Item screen — `ItemStockSummary.js`
Wrap the existing header (name row L462–487 **and** the horizontal badges `ScrollView` L489–523) in a `flex: 1` right column, and place the QR to its left:
```jsx
<View style={{flexDirection: 'row', alignItems: 'flex-start'}}>
  {item.sku ? <ItemQRCode value={item.sku} style={{marginRight: 12}} /> : null}
  <View style={{flex: 1}}>
    {/* existing name row + badges ScrollView, unchanged */}
  </View>
</View>
```
This yields the requested layout: QR | (name on top, Finished Product / Category / Revenue Group below).

### 4. Item Report screen — `ItemDetails.js` + SQL patch
- **SQL**: add `items.sku AS sku,` to the `selectAllQuery` in `buildItemReportSql` ([reportsSqlBuilders.js](src/localDbQueries/reportsSqlBuilders.js#L806), near the other `items.*` selects ~L808–815) so `item.sku` reaches `ItemDetails`.
- **Layout**: same wrap as site 3 — put the name row (L287–306) and the category/revenue row (L307–338) into a `flex: 1` right column with `{item.sku ? <ItemQRCode value={item.sku} .../> : null}` on the left.

### 5. Master Item List — `MasterItemAccordion`
Insert the QR in the expanded content **above** the branch list — after the `rootActions` block (L259–280) and before the `branchItems.length === 0 ? …` block (L281). No caption (SKU is already in the title):
```jsx
{masterItem.sku ? (
  <View style={styles.qrContainer}>
    <ItemQRCode value={masterItem.sku} showCaption={false} />
  </View>
) : null}
```
Add a small `qrContainer` style (centered, padded) to the `StyleSheet` at the bottom of the file.

## Edge cases
- Items/master items with NULL/empty `sku` → component returns `null`; header collapses to the current single-column look (right column keeps `flex: 1`).
- Horizontal badges `ScrollView` in `ItemStockSummary` stays bounded inside the `flex: 1` column and continues to scroll.

## Verification (manual — no automated UI tests here)
1. `npm install react-native-qrcode-svg`, restart Metro, run `npm run android` (or iOS).
2. **Item screen**: Items list → tap an item. QR shows left of name/badges; caption shows `SKU: …`; tap → large QR dialog opens and closes.
3. **Item Report screen**: from the Item screen tap **View Report** (navigates to `ItemReportView`). QR shows in the same left position with caption.
4. **Master Item List**: open it, expand an accordion → QR appears above the branch item list (no caption, since title already shows SKU).
5. Scan the inline/enlarged QR with a phone camera and confirm it decodes to the exact SKU (e.g. `COK-A3FG`).
6. Sanity-check an item with no SKU (if any legacy rows exist) → no QR, header looks normal.
