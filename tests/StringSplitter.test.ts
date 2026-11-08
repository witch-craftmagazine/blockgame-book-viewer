import { describe, it, expect } from 'vitest';
import {
  splitTextToLines,
  paginateLines,
  measureSpanWidth,
  BOOK_TEXT_WIDTH,
  LINES_PER_PAGE,
} from '../src/engine/StringSplitter';
import { defaultGlyphAtlas } from '../src/engine/GlyphAtlas';

describe('StringSplitter and Pagination', () => {
  it('measures character advances accurately', () => {
    // Space advance is 4
    expect(defaultGlyphAtlas.getAdvance(' ')).toBe(4);
    // Exclamation mark width is 1, advance is 2
    expect(defaultGlyphAtlas.getAdvance('!')).toBe(2);
    // Bold adds 1
    expect(defaultGlyphAtlas.getAdvance('!', true)).toBe(3);
  });

  it('wraps long lines so no line exceeds 114px', () => {
    const longText = 'This is a rather long sentence that definitely exceeds the 114 pixel limit of a Minecraft book page.';
    const lines = splitTextToLines(longText, BOOK_TEXT_WIDTH, defaultGlyphAtlas);

    expect(lines.length).toBeGreaterThan(1);
    for (const line of lines) {
      const lineWidth = line.spans.reduce((sum, s) => sum + measureSpanWidth(s, defaultGlyphAtlas), 0);
      expect(lineWidth).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    }
  });

  it('paginates lines into sets of at most 14 lines', () => {
    const lines = Array.from({ length: 30 }, (_, i) => ({
      spans: [{
        text: `Line ${i + 1}`,
        color: '#000000',
        bold: false,
        italic: false,
        underlined: false,
        strikethrough: false,
        obfuscated: false,
      }],
      width: 40,
    }));

    const pages = paginateLines(lines, LINES_PER_PAGE);

    expect(pages).toHaveLength(3); // 14 + 14 + 2 = 30
    expect(pages[0]).toHaveLength(14);
    expect(pages[1]).toHaveLength(14);
    expect(pages[2]).toHaveLength(2);
  });

  it('preserves formatting across line wraps', () => {
    const text = '§4Red bold text that goes on for quite some time to force a line break§r';
    const lines = splitTextToLines(text, BOOK_TEXT_WIDTH, defaultGlyphAtlas);

    expect(lines.length).toBeGreaterThan(1);
    expect(lines[0].spans[0].color).toBe('#AA0000');
    expect(lines[1].spans[0].color).toBe('#AA0000');
  });

  it('preserves leading spaces on explicit lines and ASCII art', () => {
    const artText = '      **{Title}**\n              __/)\n           .-(__(=:';
    const lines = splitTextToLines(artText, BOOK_TEXT_WIDTH, defaultGlyphAtlas);

    expect(lines).toHaveLength(3);
    expect(lines[0].spans.map(s => s.text).join('')).toBe('      **{Title}**');
    expect(lines[1].spans.map(s => s.text).join('')).toBe('              __/)');
    expect(lines[2].spans.map(s => s.text).join('')).toBe('           .-(__(=:');
  });

  it('preserves multiple spaces within lines', () => {
    const text = 'Item 1:     10 Gold';
    const lines = splitTextToLines(text, BOOK_TEXT_WIDTH, defaultGlyphAtlas);

    expect(lines[0].spans.map(s => s.text).join('')).toBe('Item 1:     10 Gold');
  });

  it('does not wrap on line 14 into a phantom 15th line, allowing natural canvas right margin clipping', () => {
    // 13 lines of filler, followed by a 14th line that exceeds 114px and contains a space
    const thirteenLines = Array.from({ length: 13 }, (_, i) => `Filler line ${i + 1}`).join('\n');
    const fourteenthLine = '      ( ◉o◉)⊃--§6☆ﾟ.*･｡ﾟﾟ.*･｡ﾟﾟ.*';
    const pageText = `${thirteenLines}\n${fourteenthLine}`;

    const lines = splitTextToLines(pageText, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines).toHaveLength(14);
    const lastLineText = lines[13].spans.map((s) => s.text).join('');
    expect(lastLineText).toContain('( ◉o◉)⊃--');
  });
});
