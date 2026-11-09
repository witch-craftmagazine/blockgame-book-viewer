import { describe, it, expect } from 'vitest';
import { splitTextLossless, paginateTextLossless, isSafeSplitBoundary, getSafeSplitBoundary } from '../src/engine/LosslessSplit';
import { splitTextToLines } from '../src/engine/StringSplitter';

describe('LosslessSplit Engine', () => {
  it('guarantees lossless invariant String.join("", pages) === rawText for empty or single page text', () => {
    expect(splitTextLossless('')).toEqual(['']);
    expect(splitTextLossless('Hello, Minecraft!').join('')).toBe('Hello, Minecraft!');
  });

  it('guarantees lossless invariant for multi-page continuous stories', () => {
    const story = [
      'Chapter 1: The Dark Forest',
      'The wind howled through the spruce canopy as night fell over the mountain range.',
      'Steve carried a weathered iron sword and three loaves of bread in his satchel.',
      'In the distance, the eerie clicking sound of skeleton bones echoed from a cave entrance.',
      'He reached into his pack for a torch, striking flint to ignite the embers.',
      'The light revealed ancient cobblestone ruins half-buried beneath coarse dirt and vines.',
      'Could this be the forgotten library mentioned in the village elder\'s journal?',
      'Chapter 2: The Sunken Vault',
      'Stepping cautiously across mossy stone bricks, Steve discovered an iron door with a rusted lever.',
      'Beyond the doorway lay rows of carved chiseled bookshelves filled with leather-bound volumes.',
      'He carefully withdrew a tome bound in purple dragon hide and began to read.',
    ].join('\n\n');

    const pages = splitTextLossless(story);
    expect(pages.length).toBeGreaterThan(1);
    expect(pages.join('')).toBe(story);

    // Each page must strictly fit within 14 lines
    for (let i = 0; i < pages.length; i++) {
      const lines = splitTextToLines(pages[i]);
      expect(lines.length).toBeLessThanOrEqual(14);
    }
  });

  it('never splits surrogate pairs (Unicode emojis and multi-byte characters)', () => {
    for (let offset = 240; offset <= 260; offset++) {
      const text = 'a'.repeat(offset) + '💎😀🧙‍♀️' + 'b'.repeat(250);
      const pages = splitTextLossless(text);

      expect(pages.join('')).toBe(text);

      for (const page of pages) {
        for (let i = 0; i < page.length; i++) {
          const code = page.charCodeAt(i);
          if (code >= 0xd800 && code <= 0xdbff) {
            const nextCode = page.charCodeAt(i + 1);
            expect(nextCode).toBeGreaterThanOrEqual(0xdc00);
            expect(nextCode).toBeLessThanOrEqual(0xdfff);
          }
        }
      }
    }
  });

  it('safely handles formatting tokens and never cuts immediately after §', () => {
    const formatted = '§6Gold Title§r\n\n' + '§aGreen paragraph §lwith bold§r words and details.\n\n'.repeat(8);
    const pages = splitTextLossless(formatted);

    expect(pages.join('')).toBe(formatted);
    for (const page of pages) {
      expect(page.endsWith('§')).toBe(false);
      const lines = splitTextToLines(page);
      expect(lines.length).toBeLessThanOrEqual(14);
    }
  });

  it('handles continuous long words without spaces or newlines', () => {
    const unbrokenWord = 'x'.repeat(750);
    const pages = splitTextLossless(unbrokenWord);

    expect(pages.length).toBeGreaterThan(2);
    expect(pages.join('')).toBe(unbrokenWord);

    for (const page of pages) {
      const lines = splitTextToLines(page);
      expect(lines.length).toBeLessThanOrEqual(14);
    }
  });

  it('prefers soft-breaks at paragraph boundaries and spaces over arbitrary word cuts', () => {
    // 12 lines of text + clear paragraph break
    const partA = Array(12).fill('Regular line of text.').join('\n');
    const partB = '\n\nNew paragraph that starts cleanly on the next page.';
    const text = partA + partB;

    const pages = splitTextLossless(text);
    expect(pages.length).toBe(2);
    expect(pages.join('')).toBe(text);
    // Page 1 should end right after the paragraph break
    expect(pages[0].endsWith('\n\n')).toBe(true);
    expect(pages[1].startsWith('New paragraph')).toBe(true);
  });

  it('supports Bedrock engine 122px text boundary', () => {
    const text = 'This is a long sentence formatted specifically with the Bedrock width metrics in mind.\n'.repeat(20);
    const javaPages = splitTextLossless(text, { engine: 'java' });
    const bedrockPages = splitTextLossless(text, { engine: 'bedrock' });

    expect(javaPages.join('')).toBe(text);
    expect(bedrockPages.join('')).toBe(text);
    // Bedrock 122px fits more characters per line, so it should produce equal or fewer pages
    expect(bedrockPages.length).toBeLessThanOrEqual(javaPages.length);
  });

  it('provides paginateTextLossless returning pre-formatted LineLayout pages', () => {
    const text = 'Line 1\nLine 2\nLine 3\n\nLine 5';
    const paginated = paginateTextLossless(text);

    expect(Array.isArray(paginated)).toBe(true);
    expect(paginated.length).toBe(1);
    expect(paginated[0].length).toBe(5);
  });

  it('validates isSafeSplitBoundary and getSafeSplitBoundary', () => {
    const text = 'Hello 💎 §aworld';
    expect(isSafeSplitBoundary(text, 0)).toBe(true);
    expect(isSafeSplitBoundary(text, text.length)).toBe(true);

    // Emoji 💎 starts at index 6, surrogate pair is index 6 and 7. Index 7 is mid-surrogate:
    expect(isSafeSplitBoundary(text, 7)).toBe(false);
    expect(getSafeSplitBoundary(text, 7)).toBe(6);

    // Section sign § starts at index 9. Index 10 is right after §:
    expect(isSafeSplitBoundary(text, 10)).toBe(false);
    expect(getSafeSplitBoundary(text, 10)).toBe(9);
  });
});
