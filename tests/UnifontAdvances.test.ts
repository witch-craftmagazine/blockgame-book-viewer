import { describe, it, expect } from 'vitest';
import { getUnifontAdvance, UNIFONT_BOLD_OFFSET } from '../src/engine/UnifontAdvances';
import { defaultGlyphAtlas, MISSING_GLYPH_ADVANCE } from '../src/engine/GlyphAtlas';
import { splitTextToLines, BOOK_TEXT_WIDTH } from '../src/engine/StringSplitter';

describe('Unifont advance table (integer width / 2 + 1)', () => {
  it('returns bounding-box based advances in whole pixels (odd widths round down)', () => {
    expect(getUnifontAdvance(0x2727)).toBe(8); // ✧ 15 columns wide: floor(15 / 2) + 1
    expect(getUnifontAdvance(0x2091)).toBe(3); // ₑ 5 columns wide
    expect(getUnifontAdvance(0x22c4)).toBe(3); // ⋄
    expect(getUnifontAdvance(0x2589)).toBe(4); // ▉ 7 columns wide
    expect(getUnifontAdvance(0x2588)).toBe(5); // █ 8 columns wide (Unifont only; vanilla's ascii.png bitmap wins)
  });

  it('never returns a fractional advance', () => {
    for (const cp of [0x41, 0xa0, 0x2003, 0x2727, 0x22c4, 0x4e00, 0x1f954, 0x1d5d4, 0xff9f]) {
      const adv = getUnifontAdvance(cp);
      if (adv !== undefined) expect(Number.isInteger(adv)).toBe(true);
    }
  });

  it('treats blank glyphs as bitWidth + 1 columns wide', () => {
    expect(getUnifontAdvance(0x00a0)).toBe(5);
    expect(getUnifontAdvance(0x2003)).toBe(5);
  });

  it('applies size_overrides before measuring set bits', () => {
    expect(getUnifontAdvance(0x4e00)).toBe(9); // CJK forced to left 0, right 15
    expect(getUnifontAdvance(0x3042)).toBe(9); // Hiragana
  });

  it('reaches the supplementary planes', () => {
    expect(getUnifontAdvance(0x1f954)).toBe(7); // 🥔
    expect(getUnifontAdvance(0x1d5d4)).toBe(4); // 𝗔
  });

  it('returns undefined where no Unifont provider has a glyph', () => {
    expect(getUnifontAdvance(0xe000)).toBeUndefined(); // private use area is not in the Unifont providers
    expect(getUnifontAdvance(0x110000)).toBeUndefined();
    expect(getUnifontAdvance(-1)).toBeUndefined();
  });

  it('uses a 0.5 bold offset for Unihex glyphs', () => {
    expect(UNIFONT_BOLD_OFFSET).toBe(0.5);
  });
});

describe('GlyphAtlas resolves advances in vanilla provider order', () => {
  it('uses the space provider for space and ZWNJ', () => {
    expect(defaultGlyphAtlas.getAdvance(' ')).toBe(4);
    expect(defaultGlyphAtlas.getAdvance(' ', true)).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('\u200c')).toBe(0); // Unifont says 9, the space provider wins
  });

  it('lets bitmap sheets win over Unifont', () => {
    expect(getUnifontAdvance(0x2588)).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('█')).toBe(9); // ascii.png glyph, 8 + 1
    expect(defaultGlyphAtlas.getAdvance('A')).toBe(6);
  });

  it('falls through to the exact Unifont table, including supplementary planes', () => {
    expect(defaultGlyphAtlas.getAdvance('✧')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('ₑ')).toBe(3);
    expect(defaultGlyphAtlas.getAdvance('\u00a0')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('🥔')).toBe(7);
    expect(defaultGlyphAtlas.getAdvance('日')).toBe(9);
  });

  it('uses the missing glyph advance (6) for code points no provider covers', () => {
    expect(defaultGlyphAtlas.getAdvance('\ue000')).toBe(MISSING_GLYPH_ADVANCE);
    expect(MISSING_GLYPH_ADVANCE).toBe(6);
  });

  it('bolds Unifont glyphs by 0.5 and every other glyph by 1', () => {
    expect(defaultGlyphAtlas.getAdvance('✧', true)).toBe(8.5); // 8 + 0.5
    expect(defaultGlyphAtlas.getAdvance('A', true)).toBe(7); // bitmap: 6 + 1
    expect(defaultGlyphAtlas.getAdvance(' ', true)).toBe(5); // space provider: 4 + 1
    expect(defaultGlyphAtlas.getAdvance('\ue000', true)).toBe(7); // missing glyph (assumed +1, unverified)
  });

  it('no longer zeroes combining marks, which are ordinary Unifont glyphs', () => {
    expect(defaultGlyphAtlas.getAdvance('\u0300')).toBe(3);
    expect(defaultGlyphAtlas.getAdvance('\u0324')).toBe(4);
  });

  it('fills a line exactly to 114px and wraps the next glyph', () => {
    // 38 x 3 = 114 fits (the limit is inclusive), the 39th does not
    const lines = splitTextToLines('ₑ'.repeat(39), BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.map((l) => l.width)).toEqual([114, 3]);
  });

  it('keeps fractional advances for bold Unifont glyphs (0.5 bold offset)', () => {
    // 8.5 per bold flower: 13 fit (110.5), the 14th (119) does not
    const lines = splitTextToLines('§l' + '✿'.repeat(14), BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.map((l) => l.width)).toEqual([110.5, 8.5]);
  });
});
