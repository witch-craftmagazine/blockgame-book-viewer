import { describe, it, expect } from 'vitest';
import { parseBook, parseStendhalBook } from '../src/io/BookParser';
import { parseFormattedText, stripFormatting } from '../src/engine/Formatting';
import { defaultGlyphAtlas } from '../src/engine/GlyphAtlas';
import { splitTextToLines, BOOK_TEXT_WIDTH } from '../src/engine/StringSplitter';

describe('Pagination Fidelity and Section Symbol Handling', () => {
  it('never emits § as printable text or with positive width', () => {
    // Lone trailing section symbol
    const spans1 = parseFormattedText('Hello World§');
    expect(spans1.map(s => s.text).join('')).toBe('Hello World');

    // Lone section symbol on an empty line
    const spans2 = parseFormattedText('§');
    expect(spans2.length).toBe(0);

    // Multiple trailing and invalid section symbols
    const spans3 = parseFormattedText('§d§v§d§d§');
    expect(spans3.length).toBe(0);

    // Section symbol advance in GlyphAtlas must be 0
    expect(defaultGlyphAtlas.getAdvance('§')).toBe(0);
    expect(defaultGlyphAtlas.getAdvance('\n')).toBe(0);
  });

  it('strips all formatting codes and lone section symbols cleanly', () => {
    expect(stripFormatting('§d§v§d§d§')).toBe('');
    expect(stripFormatting('Test§')).toBe('Test');
    expect(stripFormatting('§7§sStarSweetpea x ')).toBe('StarSweetpea x ');
  });

  it('preserves 1-to-1 page fidelity without spawning extra subpages', () => {
    const rawStendhal = `title: testIssue
author: EE33
pages:
#- Page 1 Line 1
Line 2
Line 3
#- Page 2 Line 1
Line 2
#- Page 3 Line 1
Line 2
`;
    const book = parseStendhalBook(rawStendhal);
    expect(book).not.toBeNull();
    if (!book) return;

    expect(book.pages.length).toBe(3);

    // Verify 1-to-1 conversion
    const layouts = book.pages.map(rawPage => splitTextToLines(rawPage, BOOK_TEXT_WIDTH, defaultGlyphAtlas));
    expect(layouts.length).toBe(3);
  });

  it('fits horoscope border lines within 114px without wrapping', () => {
    const border = '✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧';
    const lines = splitTextToLines(border, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.length).toBe(1);
    expect(lines[0].width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    expect(lines[0].width).toBe(102);
  });

  it('formats Page 52 horoscopes into exactly 14 lines', () => {
    const p52Text = `§5♈ Aries
§d✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧
§8Help me... i'm poor!
§7-------------------
§5♉ Taurus
§d✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧
§8Your power is fading...
§7-------------------
§5♊ Gemini
§d✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧
§8I can read your mind!
§7-------------------
§5♋ Cancer §d✧⋄⋆⋅⋆⋄✧⋄⋆⋅⋆⋄✧
§8Wait a day or two...`;

    const lines = splitTextToLines(p52Text, BOOK_TEXT_WIDTH, defaultGlyphAtlas);
    expect(lines.length).toBe(14);

    for (const line of lines) {
      expect(line.width).toBeLessThanOrEqual(BOOK_TEXT_WIDTH);
    }
  });

  it('trims trailing empty lines from page ends while preserving intermediate empty lines', () => {
    const textWithTrailingNewlines = 'Line 1\n\nLine 2\n\n\n';
    const lines = splitTextToLines(textWithTrailingNewlines, BOOK_TEXT_WIDTH, defaultGlyphAtlas);

    // Should have: Line 1, empty line, Line 2 (total 3 lines, trailing 2 empty lines dropped)
    expect(lines.length).toBe(3);
    expect(lines[0].spans.map(s => s.text).join('')).toBe('Line 1');
    expect(lines[1].spans.length).toBe(0); // preserved intermediate paragraph break
    expect(lines[2].spans.map(s => s.text).join('')).toBe('Line 2');
  });

  it('correctly handles multi-page delimited books', () => {
    const delimited = 'Page 1\n---\nPage 2\n---\nPage 3';
    const book = parseBook(delimited);
    expect(book.pages.length).toBe(3);
  });
});
