import convert from 'convert-units';

/**
 * Shared logic for entering a stock quantity in a chosen unit and converting it
 * to the item's base UOM (the number the local DB / sync stores). Mirrors the
 * web reference `lib/stock-measurement.ts`. Used by every stock-quantity entry —
 * Add/Remove stock, Batch Purchase/Usage/Transfer, Ending Inventory, Spoilage,
 * Recipe ingredient, Selling Menu item.
 *
 * Two symmetric cases (see the item's "measure by the item's UOM per piece"):
 *  - 'ea' item: stored quantities are pieces. A weight unit converts weight→pieces
 *    by dividing by `qty_per_piece` (the existing per-piece checkbox / inverse).
 *  - non-'ea' item (base is a weight/volume, e.g. 'g'): stored quantities are in
 *    the base unit. The synthetic Piece option converts pieces→base by multiplying
 *    by `qty_per_piece` ("net weight per piece"). If unset, the caller prompts for
 *    and persists it first (see `pieceNeedsNetWeight`).
 *
 * `qty_per_piece` means "the weight contained in one physical piece" in both
 * cases; only the base differs, so the multiply/divide directions are inverses.
 */

/**
 * Sentinel unit value meaning "by the piece" for a non-'ea' item. Converted to
 * the base UOM via `qty_per_piece`, NOT via convert-units (pieces aren't a
 * convert-units unit), so it must never be passed to `convert().from(...)`. It is
 * stored on the row as 'ea' (see `storedUomAbbrev`) for sync parity with web.
 */
export const PIECE_UNIT = '__pc__';

const baseOf = item => (item?.uom_abbrev ?? '').trim();
const ppUomOf = item => (item?.uom_abbrev_per_piece ?? '').trim();
const ppQtyOf = item => Number(item?.qty_per_piece) || 0;

/** True for an item whose base UOM is a weight/volume (not 'ea'/pieces). */
export const isNonEaItem = item => {
  const b = baseOf(item);
  return !!b && b !== 'ea';
};

/** Default entry unit for an item — its own base UOM ('ea' for piece items). */
export const defaultStockUnit = item => baseOf(item) || 'ea';

/** Describe a convert-units unit the way the RN forms label them. */
const describeUnit = u => {
  const desc = convert().describe(u);
  const label = desc.singular === 'Each' ? 'Piece' : desc.singular;
  const shown = u === 'ea' ? 'pc' : u;
  return {label: `${label} (${shown})`, value: u};
};

/** The synthetic "Piece (pc)" dropdown option for a non-'ea' item. */
export const pieceUnitOption = () => ({label: 'Piece (pc)', value: PIECE_UNIT});

/**
 * Dropdown options for entering a quantity of a NON-'ea' item: a synthetic Piece
 * option FIRST (the primary reason this picker exists), then the base measure
 * family (anchored on the base UOM so selecting Piece never collapses the list).
 * 'ea' items keep their existing per-piece checkbox flow, so this returns only the
 * base family for them (no Piece).
 */
export function nonEaStockUnitOptions(item) {
  const b = baseOf(item);
  if (!b) {return [];}

  const familyOptions = convert()
    .from(b)
    .possibilities()
    .filter(u => u !== 'dz')
    .map(describeUnit);

  if (b === 'ea') {return familyOptions;}

  return [pieceUnitOption(), ...familyOptions];
}

/**
 * True when the user chose Piece on a non-'ea' item that has no saved net weight
 * per piece yet — the UI must collect and persist it before converting.
 */
export function pieceNeedsNetWeight(item, unit) {
  return isNonEaItem(item) && unit === PIECE_UNIT && ppQtyOf(item) <= 0;
}

/**
 * Convert an entered (qty, unit) into the item's base-UOM quantity — the number
 * the DB stores. Used for live UI previews. `ppQtyOverride` supplies a
 * not-yet-saved net weight for a non-'ea' Piece entry. Returns a non-finite value
 * when a Piece entry has no usable net weight — callers gate on
 * `pieceNeedsNetWeight` / a finite result.
 */
export function toBaseQty(item, qty, unit, ppQtyOverride) {
  const b = baseOf(item);
  const u = (unit || '').trim();
  const q = parseFloat(qty);
  if (!b || !Number.isFinite(q)) {return NaN;}

  if (b === 'ea') {
    const ppUom = ppUomOf(item);
    const ppQty = ppQtyOf(item);
    if (!u || u === 'ea' || !ppUom || ppQty <= 0) {return q;}
    return convert(q).from(u).to(ppUom) / ppQty; // weight → pieces
  }

  // Non-'ea' Piece entry (sentinel or the stored 'ea' marker): pieces → base.
  if (u === PIECE_UNIT || u === 'ea') {
    const ppQty = ppQtyOverride && ppQtyOverride > 0 ? ppQtyOverride : ppQtyOf(item);
    return ppQty > 0 ? q * ppQty : NaN;
  }
  return convert(q).from(u || b).to(b); // weight/volume → base
}

/**
 * The uom_abbrev string to persist for an entered unit (sync parity with web):
 * the synthetic Piece sentinel is stored as 'ea' (renders as "ea (pc)").
 */
export function storedUomAbbrev(item, unit) {
  const u = (unit || '').trim();
  if (u === PIECE_UNIT) {return 'ea';}
  return u || baseOf(item);
}

/**
 * Centralised base-UOM conversion for the localDbQuery layer. `values` carries
 * the stored uom (already 'ea' for a non-'ea' Piece entry, or the sentinel) and
 * the existing `use_measurement_per_piece` flag for the 'ea' inverse. Replaces
 * the per-query inline if/else and adds the non-'ea' Piece branch everywhere.
 */
export function convertQtyToBaseItemUom(item, {qty, uom, use_measurement_per_piece}) {
  const b = baseOf(item);
  const u = (uom || '').trim();
  const q = parseFloat(qty);
  if (!b || !Number.isFinite(q)) {return NaN;}

  // Non-'ea' item recorded "by the piece" (uom stored as 'ea' / sentinel): the
  // entered qty is a piece count → multiply by the net weight per piece.
  if (b !== 'ea' && (u === 'ea' || u === PIECE_UNIT)) {
    const ppQty = ppQtyOf(item);
    return ppQty > 0 ? q * ppQty : q;
  }

  // 'ea' item measured by a weight unit (existing inverse: weight → pieces).
  if (use_measurement_per_piece) {
    return convert(q).from(u).to(ppUomOf(item)) / ppQtyOf(item);
  }

  return convert(q).from(u || b).to(b);
}
