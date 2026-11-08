import { describe, it, expect } from 'vitest';
import {
  parseFormattedText,
  stripFormatting,
  normalizeFormattingCodes,
  MINECRAFT_COLORS,
  createDefaultStyle,
} from '../src/engine/Formatting';

describe('Formatting parser', () => {
  it('parses standard color codes correctly', () => {
    const text = '§4Red text §9Blue text';
    const spans = parseFormattedText(text);

    expect(spans).toHaveLength(2);
    expect(spans[0].text).toBe('Red text ');
    expect(spans[0].color).toBe(MINECRAFT_COLORS['4']);
    expect(spans[1].text).toBe('Blue text');
    expect(spans[1].color).toBe(MINECRAFT_COLORS['9']);
  });

  it('handles bold and resets properly', () => {
    const text = '§lBold §rNormal';
    const spans = parseFormattedText(text);

    expect(spans).toHaveLength(2);
    expect(spans[0].bold).toBe(true);
    expect(spans[1].bold).toBe(false);
  });

  it('resets formatting flags when a color is applied (vanilla behavior)', () => {
    const text = '§lBold §cRed (not bold)';
    const spans = parseFormattedText(text);

    expect(spans).toHaveLength(2);
    expect(spans[0].bold).toBe(true);
    expect(spans[1].bold).toBe(false);
    expect(spans[1].color).toBe(MINECRAFT_COLORS['c']);
  });

  it('normalizes ampersand color codes &0-&f', () => {
    const text = '&aGreen &bAqua';
    const normalized = normalizeFormattingCodes(text);
    expect(normalized).toBe('§aGreen §bAqua');
  });

  it('supports Bedrock Edition and material palette color codes (§s, §t, §u, §g, §p, §q)', () => {
    const text = '§sDiamond §tLapis §uAmethyst §gMinecoin Gold §pMaterial Gold §qEmerald';
    const spans = parseFormattedText(text);

    expect(spans).toHaveLength(6);
    expect(spans[0].text).toBe('Diamond ');
    expect(spans[0].color).toBe('#2CBAA8'); // Diamond
    expect(spans[1].text).toBe('Lapis ');
    expect(spans[1].color).toBe('#21497B'); // Lapis
    expect(spans[2].text).toBe('Amethyst ');
    expect(spans[2].color).toBe('#9A5CC6'); // Amethyst
    expect(spans[3].text).toBe('Minecoin Gold ');
    expect(spans[3].color).toBe('#DDD605'); // Minecoin Gold
    expect(spans[4].text).toBe('Material Gold ');
    expect(spans[4].color).toBe('#DEB12D'); // Material Gold
    expect(spans[5].text).toBe('Emerald');
    expect(spans[5].color).toBe('#47A036'); // Emerald
  });

  it('strips formatting codes cleanly', () => {
    const text = '§6Gold §lBold §kObf §rPlain';
    expect(stripFormatting(text)).toBe('Gold Bold Obf Plain');
  });

  it('mutates active style in-place and persists across lines with only formatting codes', () => {
    const activeStyle = createDefaultStyle();
    
    // Line 1: Set dark purple and bold (§l must follow §5 in vanilla)
    const line1Spans = parseFormattedText('§5§lBold Purple', activeStyle);
    expect(line1Spans[0].bold).toBe(true);
    expect(line1Spans[0].color).toBe('#AA00AA');
    expect(activeStyle.bold).toBe(true);
    expect(activeStyle.color).toBe('#AA00AA');

    // Line 2: Only formatting codes (§d resets bold and sets light purple)
    const line2Spans = parseFormattedText('§d§v§d§d§', activeStyle);
    expect(line2Spans).toHaveLength(0);
    expect(activeStyle.bold).toBe(false);
    expect(activeStyle.color).toBe('#FF55FF');

    // Line 3: Text inheriting the non-bold light purple style
    const line3Spans = parseFormattedText('Witch ASCII Art', activeStyle);
    expect(line3Spans[0].bold).toBe(false);
    expect(line3Spans[0].color).toBe('#FF55FF');
  });

  it('parses italic (§o) formatting accurately', () => {
    const text = '§6Normal §oItalic §rReset';
    const spans = parseFormattedText(text);
    expect(spans).toHaveLength(3);
    expect(spans[0].text).toBe('Normal ');
    expect(spans[0].italic).toBe(false);
    expect(spans[1].text).toBe('Italic ');
    expect(spans[1].italic).toBe(true);
    expect(spans[2].text).toBe('Reset');
    expect(spans[2].italic).toBe(false);
  });
});
