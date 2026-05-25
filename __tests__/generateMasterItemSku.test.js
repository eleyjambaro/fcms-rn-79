import {
  generateMasterItemSku,
  _internals,
} from '../src/utils/generateMasterItemSku';

const {derivePrefix, SUFFIX_ALPHABET} = _internals;

describe('derivePrefix', () => {
  test('takes the first three letters of a normal name', () => {
    expect(derivePrefix('Alaska Evap Milk 500g Can')).toBe('ALA');
  });

  test('strips digits and punctuation before slicing', () => {
    expect(derivePrefix('#42 Coke Zero')).toBe('COK');
  });

  test('pads with X when the name has fewer than 3 letters', () => {
    expect(derivePrefix('A')).toBe('AXX');
    expect(derivePrefix('Ab')).toBe('ABX');
  });

  test('returns XXX for empty / whitespace / null', () => {
    expect(derivePrefix('')).toBe('XXX');
    expect(derivePrefix('   ')).toBe('XXX');
    expect(derivePrefix(null)).toBe('XXX');
    expect(derivePrefix(undefined)).toBe('XXX');
  });
});

describe('generateMasterItemSku', () => {
  test('matches the <PREFIX>-<SUFFIX> shape', () => {
    const sku = generateMasterItemSku('Alaska Evap Milk');
    expect(sku).toMatch(/^[A-Z]{3}-[A-Z2-9]{4}$/);
    expect(sku.startsWith('ALA-')).toBe(true);
  });

  test('suffix only uses the unambiguous alphabet', () => {
    for (let i = 0; i < 200; i++) {
      const sku = generateMasterItemSku('Test Item');
      const suffix = sku.split('-')[1];
      for (const ch of suffix) {
        expect(SUFFIX_ALPHABET).toContain(ch);
      }
    }
  });
});
