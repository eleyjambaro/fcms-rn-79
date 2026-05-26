/**
 * Build the deterministic dedup key for a master_items row.
 *
 * The whole point of this string is: the same logical product imported from
 * any branch produces the same key. That property is what lets cross-branch
 * IDT imports merge into a single canonical master instead of creating
 * duplicates.
 *
 * The server ships a parity implementation at App\Support\MasterItemDedupKey
 * (fcms-api). ANY normalization tweak here must be mirrored there, otherwise
 * branches drift and dedup silently stops working.
 *
 * Shape:
 *   {name}|{uom_abbrev}|{uom_abbrev_per_piece}|{qty_per_piece}|{packaging_type}|{barcode}
 *
 * Strings: trimmed, lowercased, null/missing → ''.
 * qty_per_piece: up to 4 decimals (DECIMAL(18,4)) with trailing zeros
 * stripped, so 260.0000 and 260 both render '260'.
 */
const normString = v => {
  if (v === null || v === undefined) return '';
  return String(v).trim().toLowerCase();
};

const normQty = v => {
  if (v === null || v === undefined || v === '') return '';
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  let s = n.toFixed(4);
  s = s.replace(/\.?0+$/, '');
  if (s === '' || s === '-') return '0';
  return s;
};

export const generateMasterItemDedupKey = ({
  name,
  uom_abbrev,
  uom_abbrev_per_piece,
  qty_per_piece,
  packaging_type,
  barcode,
} = {}) => {
  return [
    normString(name),
    normString(uom_abbrev),
    normString(uom_abbrev_per_piece),
    normQty(qty_per_piece),
    normString(packaging_type),
    normString(barcode),
  ].join('|');
};

export default generateMasterItemDedupKey;
