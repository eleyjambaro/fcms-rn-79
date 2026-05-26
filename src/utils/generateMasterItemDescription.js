import convert from 'convert-units';
import {PACKAGING_TYPE_OPTIONS} from '../constants/itemForm';

const escapeRegex = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const buildUomTokens = () => {
  const tokens = new Set();
  try {
    for (const abbr of convert().possibilities()) {
      tokens.add(abbr.toLowerCase());
      const d = convert().describe(abbr);
      if (d?.singular) tokens.add(d.singular.toLowerCase());
      if (d?.plural) tokens.add(d.plural.toLowerCase());
    }
  } catch (_) {
    // convert-units lookup failed — skip UOM stripping entirely.
  }
  ['ea', 'pc', 'pcs', 'piece', 'pieces'].forEach(t => tokens.add(t));
  return tokens;
};

/**
 * Build the canonical master_items.description from an item's variant fields.
 *
 * Strips redundant tokens from the user-typed name first (known packaging
 * values and `<number><uom>` patterns) so we don't end up with strings like
 * "Argentina Corned Beef Can 260G Can 260G" when the user already encoded
 * the variant identity into the name.
 *
 * Output shapes (all UPPERCASE):
 *   ea + per-piece + packaging_type →  "{NAME} {PACKAGING} {QTY}{UOM_PP}"
 *   ea + per-piece, no packaging    →  "{NAME} {QTY}{UOM_PP} EACH"
 *   anything else with uom_abbrev   →  "{NAME} PER {UOM_DESCRIBED}"
 */
export const generateMasterItemDescription = ({
  name,
  uom_abbrev,
  uom_abbrev_per_piece,
  qty_per_piece,
  packaging_type,
} = {}) => {
  const rawName = String(name ?? '').trim();
  if (!rawName && !uom_abbrev) return '';

  const packagingValues = PACKAGING_TYPE_OPTIONS.map(o => o.value).filter(
    Boolean,
  );
  const uomTokens = buildUomTokens();

  let cleaned = rawName;

  // "260G", "260 G", "260 Grams", "0.5L", etc. — strip number+UOM pairs so
  // we don't double-print the per-piece chunk we're about to append.
  if (uomTokens.size) {
    const uomAlt = [...uomTokens]
      .sort((a, b) => b.length - a.length) // longest first so "grams" beats "g"
      .map(escapeRegex)
      .join('|');
    const qtyUomPattern = new RegExp(
      `\\b\\d+(?:\\.\\d+)?\\s*(?:${uomAlt})\\b`,
      'gi',
    );
    cleaned = cleaned.replace(qtyUomPattern, '');
  }

  // Known packaging tokens — leaves unknown ones (e.g. "PET") in place so
  // user-specific vocabulary survives until we add it to the catalog.
  if (packagingValues.length) {
    const pkgAlt = packagingValues.map(escapeRegex).join('|');
    cleaned = cleaned.replace(new RegExp(`\\b(?:${pkgAlt})\\b`, 'gi'), '');
  }

  const baseName = cleaned.replace(/\s+/g, ' ').trim().toUpperCase();

  const qtyNum = Number(qty_per_piece);
  const hasPerPiece =
    uom_abbrev === 'ea' &&
    !!uom_abbrev_per_piece &&
    !isNaN(qtyNum) &&
    qtyNum > 0;

  if (hasPerPiece) {
    const qty = String(qtyNum); // 260.0000 → "260", 0.5 → "0.5"
    const uomPP = String(uom_abbrev_per_piece).toUpperCase();
    const pkg = packaging_type ? String(packaging_type).toUpperCase() : '';
    const composed = pkg
      ? `${baseName} ${pkg} ${qty}${uomPP}`
      : `${baseName} ${qty}${uomPP} EACH`;
    return composed.replace(/\s+/g, ' ').trim();
  }

  if (uom_abbrev) {
    let uomLabel;
    if (uom_abbrev === 'ea') {
      uomLabel = 'PIECE';
    } else {
      try {
        uomLabel =
          convert().describe(uom_abbrev)?.singular?.toUpperCase() ||
          String(uom_abbrev).toUpperCase();
      } catch (_) {
        uomLabel = String(uom_abbrev).toUpperCase();
      }
    }
    return `${baseName} PER ${uomLabel}`.replace(/\s+/g, ' ').trim();
  }

  return baseName;
};
