import { describe, it, expect } from 'vitest';
import { GlyphAtlas } from '../src/engine/GlyphAtlas';
import { ResourcePackManager } from '../src/engine/ResourcePackManager';
import { createLithosPack, createCraftadiaPack } from '../src/presets/example-packs';
import { splitTextToLines } from '../src/engine/StringSplitter';

describe('Spacing and font packs', () => {
  it('keeps space advance at 4px, and 5px when bolded like every other glyph', () => {
    const atlas = new GlyphAtlas();
    expect(atlas.getAdvance(' ', false)).toBe(4);
    expect(atlas.getAdvance(' ', true)).toBe(5);
    // NBSP is not in the space provider, so it resolves through Unifont (blank 8-bit glyph: 5.5)
    expect(atlas.getAdvance('\u00a0', false)).toBe(5.5);
    expect(atlas.getAdvance('\u00a0', true)).toBe(6); // Unifont glyphs bold by 0.5
    // ZWNJ is in the space provider with a 0 advance
    expect(atlas.getAdvance('\u200c', false)).toBe(0);

    // Regular characters still expand by 1px when bolded
    expect(atlas.getAdvance('A', false)).toBe(6);
    expect(atlas.getAdvance('A', true)).toBe(7);
  });

  it('wraps a bold title whose spaces widen it past 114px (matches 26.3)', () => {
    const atlas = new GlyphAtlas();
    const lines = splitTextToLines('§1§lII. The Ink of Souls', 114, atlas);
    expect(lines.map(l => l.spans.map(s => s.text).join(''))).toEqual(['II. The Ink of', 'Souls']);
  });

  it('preserves leading spaces and centers Line 3 in issue1 when wrapping from Line 2', () => {
    const atlas = new GlyphAtlas();
    const issue1Page0 =
      '§7      **{Issue 1}**\n§d☠☠☠☠☠☠ ™ ☠☠☠☠☠☠§l§5§l     WITCH-CRAFT \n    ★MAGAZINE★\n§d§v§d§d§';

    const page0Lines = splitTextToLines(issue1Page0, 114, atlas);
    expect(page0Lines.length).toBeGreaterThanOrEqual(4);

    // Line 1: Issue 1 header
    const l1 = page0Lines[0].spans.map(s => s.text).join('');
    expect(l1).toBe('      **{Issue 1}**');

    // Line 2: Skulls
    const l2 = page0Lines[1].spans.map(s => s.text).join('');
    expect(l2).toBe('☠☠☠☠☠☠ ™ ☠☠☠☠☠☠');

    // Line 3: WITCH-CRAFT must retain all 5 leading spaces to center it
    const l3 = page0Lines[2].spans.map(s => s.text).join('');
    expect(l3).toBe('     WITCH-CRAFT ');
    expect(l3.startsWith('     ')).toBe(true);
    // Visual centering: this line is bold, so each space is 5px: 5 leading spaces = 25px
    // left margin, plus the trailing space. Line width fits within 114px.
    expect(page0Lines[2].width).toBeLessThanOrEqual(114);
    expect(page0Lines[2].width).toBe(105);

    // Line 4: MAGAZINE
    const l4 = page0Lines[3].spans.map(s => s.text).join('');
    expect(l4).toBe('    ★MAGAZINE★');
  });

  it('configures Lithos and Craftadia packs with Lithos font textures when registered', () => {
    const manager = new ResourcePackManager('./assets');
    expect(manager.getAvailablePacks()).toHaveLength(1);
    expect(manager.getPack('vanilla')).toBeDefined();

    manager.registerPack(createLithosPack('./assets'));
    manager.registerPack(createCraftadiaPack('./assets'));

    const lithos = manager.getPack('lithos');
    const craftadia = manager.getPack('craftadia');
    const vanilla = manager.getPack('vanilla');

    expect(lithos).toBeDefined();
    expect(lithos?.fontTextures).toBeDefined();
    expect(lithos?.fontTextures?.ascii).toContain('packs/lithos/textures/font/ascii.png');
    expect(lithos?.fontTextures?.accented).toContain('packs/lithos/textures/font/accented.png');
    expect(lithos?.fontTextures?.nonlatin).toContain('packs/lithos/textures/font/nonlatin_european.png');

    expect(craftadia).toBeDefined();
    expect(craftadia?.fontTextures).toBeDefined();
    expect(craftadia?.fontTextures?.ascii).toContain('packs/lithos/textures/font/ascii.png');

    expect(vanilla).toBeDefined();
    expect(vanilla?.fontTextures?.ascii).toContain('textures/font/ascii.png');
  });

  it('guarantees glyphs from HD font sheets scale to 8x8 destination size', () => {
    const atlas = new GlyphAtlas();
    // Simulate loading an HD sheet
    const mockHDSheet = {
      width: 512,
      height: 512,
      naturalWidth: 512,
      naturalHeight: 512,
    } as unknown as HTMLImageElement;

    (atlas as any).sheets['ascii'] = mockHDSheet;
    (atlas as any).glyphMap.set('A', {
      sheet: 'ascii',
      col: 1,
      row: 4,
      colsInSheet: 16,
      rowsInSheet: 16,
      cellWidth: 8,
      cellHeight: 8,
      rawWidth: 5,
      advance: 6,
    });

    const mockCanvas = {
      width: 512,
      height: 512,
      getContext: () => ({
        drawImage: () => {},
        fillRect: () => {},
      }),
    };
    (atlas as any).tintedSheets.set('ascii_#000000', mockCanvas);

    const drawInfo = atlas.getGlyphDrawInfo('A', '#000000', false);
    expect(drawInfo).not.toBeNull();
    // Source width on a 512x512 sheet is 32x32
    expect(drawInfo?.sWidth).toBe(32);
    expect(drawInfo?.sHeight).toBe(32);
    // Destination width MUST be scaled to 8x8 font grid
    expect(drawInfo?.dWidth).toBe(8);
    expect(drawInfo?.dHeight).toBe(8);
  });
});
