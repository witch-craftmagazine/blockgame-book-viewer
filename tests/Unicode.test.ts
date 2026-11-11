import { describe, it, expect } from 'vitest';
import { GlyphAtlas, defaultGlyphAtlas } from '../src/engine/GlyphAtlas';
import { splitTextToLines, BOOK_TEXT_WIDTH } from '../src/engine/StringSplitter';

describe('Unicode & Unifont Support', () => {
  it('provides valid advances for extended Unicode symbols', () => {
    const symbols = ['♩', '♪', '♫', '♬', '⚔', '🛡', '★', '⚡', '✓', '①', '②'];
    for (const sym of symbols) {
      const adv = defaultGlyphAtlas.getAdvance(sym);
      expect(adv).toBeGreaterThan(0);
      expect(adv).toBeLessThanOrEqual(10);
    }
  });

  it('provides exact accurate advances for Minecraft box drawing and magazine symbols', () => {
    // Box drawing and borders mapped by vanilla's ascii.png bitmap provider (width + 1; bitmap wins over Unifont)
    expect(defaultGlyphAtlas.getAdvance('╔')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('═')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('╗')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('║')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('─')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('━')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('│')).toBe(6);
    expect(defaultGlyphAtlas.getAdvance('╚')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('╝')).toBe(8);

    // Blocks and shades in ascii.png (8px glyph width + 1px padding = 9px advance)
    expect(defaultGlyphAtlas.getAdvance('█')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('▄')).toBe(9);
    // U+2581-U+2583 and U+2585-U+2587 are not in a bitmap sheet, so they use Unifont: 8 columns = 4 + 1 = 5
    expect(defaultGlyphAtlas.getAdvance('▃')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('▅')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('▆')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('▇')).toBe(5);
    expect(defaultGlyphAtlas.getAdvance('▓')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('▒')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('░')).toBe(8);

    // Magazine decorative symbols
    expect(defaultGlyphAtlas.getAdvance('™')).toBe(9);
    expect(defaultGlyphAtlas.getAdvance('☠')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('★')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('⛏')).toBe(9);

    // Media player bar line: fits on single line
    const playerBar = ' 0:00 ━❍───── 9:05';
    const lines = splitTextToLines(playerBar, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines).toHaveLength(1);
    expect(lines[0].width).toBe(109.5);
    expect(lines[0].width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);

    // Title skull line: fits on single line
    const skullLine = '☠☠☠☠☠☠ ™ ☠☠☠☠☠☠';
    const skullLines = splitTextToLines(skullLine, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(skullLines).toHaveLength(1);
    expect(skullLines[0].width).toBe(113);
    expect(skullLines[0].width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);

    // Subscripts used in magazine lore (Unifont: 5 columns wide = 2.5 + 1)
    expect(defaultGlyphAtlas.getAdvance('ᵢ')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('ₑ')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('ₐ')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('ᵤ')).toBe(3.5);

    // Combining marks are ordinary Unifont glyphs in vanilla: they advance by their bitmap width
    expect(defaultGlyphAtlas.getAdvance('҉')).toBe(8);
    expect(defaultGlyphAtlas.getAdvance('͍')).toBe(4.5);
    expect(defaultGlyphAtlas.getAdvance('̤')).toBe(4);

    // Heavy box drawing corners
    expect(defaultGlyphAtlas.getAdvance('┏')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('┓')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('┗')).toBe(3.5);
    expect(defaultGlyphAtlas.getAdvance('┛')).toBe(3.5);
  });

  it('measures CJK multilingual characters properly', () => {
    const cjk = ['日', '本', '語', '你', '好', '한', '글'];
    for (const char of cjk) {
      const adv = defaultGlyphAtlas.getAdvance(char);
      expect(adv).toBeGreaterThanOrEqual(6);
      expect(adv).toBeLessThanOrEqual(10);
    }
  });

  it('handles 4-byte surrogate pair symbols without breaking', () => {
    const emojiSymbol = '🎵'; // U+1F3B5
    const adv = defaultGlyphAtlas.getAdvance(emojiSymbol);
    expect(adv).toBeGreaterThan(0);

    const text = 'Music: 🎵 🎶 🎼 🔔';
    const lines = splitTextToLines(text, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.length).toBeGreaterThan(0);
  });

  it('wraps mixed symbol and text strings within 114px', () => {
    const lineWithSymbols = '⚔ Sword 🛡 Shield ★ Star ⚡ Zap ♩ Melody ♫ Harmony';
    const lines = splitTextToLines(lineWithSymbols, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    }
  });

  it('loads custom resource pack bitmap providers and calculates exact Minecraft dimensions', async () => {
    const mockProviders = [
      {
        type: 'bitmap',
        file: 'font/logo/text.png',
        ascent: 10,
        height: 48,
        chars: ['\uE109'],
      },
      {
        type: 'bitmap',
        file: 'font/emoji/stpattys/stpattys_money_jar.png',
        ascent: 11,
        height: 14,
        chars: ['\uE155'],
      },
    ];

    // Mock image resolver with known dimensions
    const mockResolver = async (file: string) => {
      if (file.includes('logo')) {
        return { naturalWidth: 250, naturalHeight: 105 } as unknown as HTMLImageElement;
      }
      return { naturalWidth: 16, naturalHeight: 16 } as unknown as HTMLImageElement;
    };

    await defaultGlyphAtlas.loadBitmapProviders(mockProviders, mockResolver);

    // Verify money jar (\uE155): height 14, ascent 11
    const jarAdv = defaultGlyphAtlas.getAdvance('\uE155');
    expect(jarAdv).toBe(15); // Math.floor(0.5 + 16 * (14/16)) + 1 = 15

    const jarDraw = defaultGlyphAtlas.getGlyphDrawInfo('\uE155', '#ffffff', false);
    expect(jarDraw).not.toBeNull();
    expect(jarDraw?.dHeight).toBe(14);
    expect(jarDraw?.yOffset).toBe(7 - 11); // -4

    // Verify logo (\uE109): height 48, ascent 10
    const logoAdv = defaultGlyphAtlas.getAdvance('\uE109');
    expect(logoAdv).toBe(115); // Math.floor(0.5 + 250 * (48/105)) + 1 = 115

    const logoDraw = defaultGlyphAtlas.getGlyphDrawInfo('\uE109', '#ffffff', false);
    expect(logoDraw).not.toBeNull();
    expect(logoDraw?.dHeight).toBe(48);
    expect(logoDraw?.yOffset).toBe(7 - 10); // -3
  });

  it('ignores hijacked unicode characters in bitmap providers (such as ✯ noxium weapon)', async () => {
    const atlas = new GlyphAtlas();
    const providers = [
      {
        type: 'bitmap',
        file: 'font/noxium/nox_05.png',
        height: 24,
        ascent: 12,
        chars: ['✯'],
      },
    ];

    const mockResolver = async () => ({ naturalWidth: 32, naturalHeight: 32 } as unknown as HTMLImageElement);
    await atlas.loadBitmapProviders(providers, mockResolver);

    // ✯ should NOT be registered as a custom bitmap glyph
    expect(atlas.getAdvance('✯')).toBe(8.5); // default Unifont star width, not the 24/32px weapon
  });

  it('aligns all rows of Enderman pixel art on Issue 2 Page 42 with 5 leading spaces', () => {
    const rawLine = '     ████████           §0█§5██§0██§5██§0█';
    const lines = splitTextToLines(rawLine, 114, defaultGlyphAtlas);
    expect(lines.length).toBe(2);
    // Line 1: 5 spaces + 8 blocks (9px each) + 5 spaces = 20 + 72 + 20 = 112px <= 114px
    expect(lines[0].width).toBe(112);
    expect(lines[0].spans.map(s => s.text).join('')).toBe('     ████████     ');
    // Line 2: wrapped after 6th space, remaining 5 spaces + 8 blocks = 5 leading spaces!
    const line2Text = lines[1].spans.map(s => s.text).join('');
    expect(line2Text.startsWith('     ')).toBe(true);
    expect(line2Text).toBe('     ████████');
    expect(lines[1].width).toBe(92);
  });

  it('fits Issue 1 Page 5 volume meter within 114px without line wrapping', () => {
    const volumeLine = '§8Volume: §c▃▄▅▆▇ 100%';
    const lines = splitTextToLines(volumeLine, 114, defaultGlyphAtlas);
    expect(lines.length).toBe(1);
    // ▄ is a 9px bitmap glyph; ▃▅▆▇ are 5px Unifont glyphs
    expect(lines[0].width).toBe(96);
  });
});
