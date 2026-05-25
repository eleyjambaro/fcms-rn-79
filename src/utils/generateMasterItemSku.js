/**
 * Generate a Master Item SKU client-side.
 *
 * Format: `<PREFIX>-<SUFFIX>`
 *   - PREFIX: 3 letters derived from the item name (first three [A-Z] after
 *     stripping non-letters, uppercased). Padded with 'X' if shorter.
 *   - SUFFIX: 4-char draw from the unambiguous alphabet
 *     `ABCDEFGHJKMNPQRSTUVWXYZ23456789` (no 0/O/1/I/L).
 *
 * Uniqueness is enforced server-side; on collision the server regenerates the
 * suffix and echoes a `sku_updates` correction back to the client.
 *
 * Pure: deterministic prefix, random suffix. Safe to call client-side while
 * offline.
 */

const SUFFIX_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

const derivePrefix = name => {
  const letters = String(name ?? '')
    .toUpperCase()
    .replace(/[^A-Z]/g, '');
  const head = letters.slice(0, 3);
  return head.padEnd(3, 'X');
};

const generateSuffix = (len = 4) => {
  let out = '';
  for (let i = 0; i < len; i++) {
    const idx = Math.floor(Math.random() * SUFFIX_ALPHABET.length);
    out += SUFFIX_ALPHABET[idx];
  }
  return out;
};

export const generateMasterItemSku = name => {
  return `${derivePrefix(name)}-${generateSuffix()}`;
};

export const _internals = {derivePrefix, generateSuffix, SUFFIX_ALPHABET};

export default generateMasterItemSku;
