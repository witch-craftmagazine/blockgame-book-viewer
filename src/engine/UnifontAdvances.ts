import { UNIFONT_ADVANCES_B64 } from './unifontAdvancesData';

/** Largest code point in the table (the Unihex hex files stop at U+FFFFF). */
const TABLE_SIZE = 0x100000;

/**
 * Bold offset for Unihex glyphs. Bitmap and space glyphs use 1.0; Unifont glyphs are drawn at
 * half scale, so they only widen by 0.5.
 */
export const UNIFONT_BOLD_OFFSET = 0.5;

let table: Uint8Array | null = null;

function readVarint(bytes: Uint8Array, pos: { i: number }): number {
  let result = 0;
  let shift = 0;
  for (;;) {
    const b = bytes[pos.i++];
    result += (b & 0x7f) * 2 ** shift;
    if ((b & 0x80) === 0) return result;
    shift += 7;
  }
}

/** Decodes the run-length table once: one byte per code point holding advance * 2 (0 = no glyph). */
function getTable(): Uint8Array {
  if (table) return table;
  const binary = atob(UNIFONT_ADVANCES_B64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

  const out = new Uint8Array(TABLE_SIZE);
  const pos = { i: 0 };
  let cp = 0;
  while (pos.i < bytes.length) {
    cp += readVarint(bytes, pos);
    const length = readVarint(bytes, pos);
    const value = bytes[pos.i++];
    out.fill(value, cp, cp + length);
    cp += length;
  }
  table = out;
  return out;
}

/**
 * Vanilla Unifont advance for a code point (a whole number of pixels), or undefined when the
 * Unifont providers have no glyph for it. Covers Unifont only: the space provider and the
 * bitmap sheets take priority over it and are handled by GlyphAtlas.
 *
 * The stored table holds `width / 2 + 1` in half pixels, which is exact for glyphs with an even
 * ink width and a half pixel too wide for odd ones. Layout uses integer division
 * (`floor(width / 2) + 1`), so odd widths are rounded down here. Evidence: in the Witchcraft
 * issues 1 and 17, 22 hand-typeset lines that overflow 114px by 1 to 9px under the half-pixel
 * rule fit exactly under this one (the 14-flower line is 14 * 8 + 2 = 114). Unverified against
 * the vanilla source: check `UnihexProvider`'s advance arithmetic before relying on it.
 */
export function getUnifontAdvance(codePoint: number): number | undefined {
  if (codePoint < 0 || codePoint >= TABLE_SIZE) return undefined;
  const halves = getTable()[codePoint];
  return halves === 0 ? undefined : Math.floor(halves / 2);
}
