import {generateMasterItemDescription} from '../src/utils/generateMasterItemDescription';

describe('generateMasterItemDescription', () => {
  test('ea + per-piece + packaging — strips redundant tokens and recomposes', () => {
    expect(
      generateMasterItemDescription({
        name: 'Argentina Corned Beef Can 260G',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: 260,
        packaging_type: 'can',
      }),
    ).toBe('ARGENTINA CORNED BEEF CAN 260G');
  });

  test('ea + per-piece, no packaging — appends EACH', () => {
    expect(
      generateMasterItemDescription({
        name: 'Argentina Corned Beef 260G',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: 260,
        packaging_type: '',
      }),
    ).toBe('ARGENTINA CORNED BEEF 260G EACH');
  });

  test('non-ea uom — falls back to PER {UOM_DESCRIBED}', () => {
    expect(
      generateMasterItemDescription({
        name: 'Raw Chicken Wings',
        uom_abbrev: 'kg',
      }),
    ).toBe('RAW CHICKEN WINGS PER KILOGRAM');
  });

  test('ea + no per-piece — falls back to PER PIECE', () => {
    expect(
      generateMasterItemDescription({
        name: 'Eggs',
        uom_abbrev: 'ea',
      }),
    ).toBe('EGGS PER PIECE');
  });

  test('strips "260 G" with a space between qty and uom', () => {
    expect(
      generateMasterItemDescription({
        name: 'Argentina Corned Beef 260 G',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: 260,
      }),
    ).toBe('ARGENTINA CORNED BEEF 260G EACH');
  });

  test('strips "200 Grams" (full unit name)', () => {
    expect(
      generateMasterItemDescription({
        name: 'Some Item 200 Grams',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: 200,
      }),
    ).toBe('SOME ITEM 200G EACH');
  });

  test('strips decimal qty patterns like "1.5L"', () => {
    expect(
      generateMasterItemDescription({
        name: 'Coke 1.5L',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'l',
        qty_per_piece: 1.5,
        packaging_type: 'bottle',
      }),
    ).toBe('COKE BOTTLE 1.5L');
  });

  test('preserves packaging words NOT in the catalog (e.g. PET)', () => {
    expect(
      generateMasterItemDescription({
        name: 'Brand PET 500ml',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'ml',
        qty_per_piece: 500,
      }),
    ).toBe('BRAND PET 500ML EACH');
  });

  test('strips the packaging token even when the user typed it', () => {
    expect(
      generateMasterItemDescription({
        name: 'Coke Bottle',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'ml',
        qty_per_piece: 330,
        packaging_type: 'bottle',
      }),
    ).toBe('COKE BOTTLE 330ML');
  });

  test('returns empty string for empty name + empty uom', () => {
    expect(generateMasterItemDescription({name: ''})).toBe('');
    expect(generateMasterItemDescription({})).toBe('');
  });

  test('handles qty_per_piece as a string', () => {
    expect(
      generateMasterItemDescription({
        name: 'Sample',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: '260',
      }),
    ).toBe('SAMPLE 260G EACH');
  });

  test('qty_per_piece = 0 falls back to PER-UOM shape', () => {
    expect(
      generateMasterItemDescription({
        name: 'Sample',
        uom_abbrev: 'ea',
        uom_abbrev_per_piece: 'g',
        qty_per_piece: 0,
      }),
    ).toBe('SAMPLE PER PIECE');
  });

  test('does not strip "box" inside another word ("Cottonbox")', () => {
    expect(
      generateMasterItemDescription({
        name: 'Cottonbox Tissues',
        uom_abbrev: 'ea',
      }),
    ).toBe('COTTONBOX TISSUES PER PIECE');
  });
});
