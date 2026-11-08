import { FormattedSpan, LineLayout } from './types';
import { GlyphAtlas, defaultGlyphAtlas } from './GlyphAtlas';
import { parseFormattedText } from './Formatting';

export const BOOK_TEXT_WIDTH = 114;
export const LINES_PER_PAGE = 14;
export const LINE_HEIGHT = 9;

/**
 * Calculates the visual pixel width of a formatted span.
 */
export function measureSpanWidth(span: FormattedSpan, atlas: GlyphAtlas = defaultGlyphAtlas): number {
  let width = 0;
  for (const char of span.text) {
    width += atlas.getAdvance(char, span.bold);
  }
  return width;
}

/**
 * Calculates total pixel width of an array of spans.
 */
export function measureLineWidth(spans: FormattedSpan[], atlas: GlyphAtlas = defaultGlyphAtlas): number {
  return spans.reduce((sum, s) => sum + measureSpanWidth(s, atlas), 0);
}

/**
 * Splits a formatted text string (with § codes and \n) into wrapped lines
 * fitting within maxWidth (default 114px).
 * Styles are seamlessly carried over across wrapped lines.
 */
interface StyledChar {
  char: string;
  style: FormattedSpan;
  width: number;
}

function coalesceCharsToLine(chars: StyledChar[]): LineLayout {
  if (chars.length === 0) return { spans: [], width: 0 };
  const spans: FormattedSpan[] = [];
  let currentSpan: FormattedSpan | null = null;
  let width = 0;

  for (const c of chars) {
    width += c.width;
    if (
      currentSpan &&
      currentSpan.color === c.style.color &&
      currentSpan.bold === c.style.bold &&
      currentSpan.italic === c.style.italic &&
      currentSpan.underlined === c.style.underlined &&
      currentSpan.strikethrough === c.style.strikethrough &&
      currentSpan.obfuscated === c.style.obfuscated
    ) {
      currentSpan.text += c.char;
    } else {
      currentSpan = {
        text: c.char,
        color: c.style.color,
        bold: c.style.bold,
        italic: c.style.italic,
        underlined: c.style.underlined,
        strikethrough: c.style.strikethrough,
        obfuscated: c.style.obfuscated,
      };
      spans.push(currentSpan);
    }
  }
  return { spans, width };
}

/**
 * Splits text into lines matching Minecraft Java Edition's StringSplitter and LineBreakFinder.
 * Operates on the formatted character stream to locate optimal line breaks at whitespace or character boundaries.
 * Preserves multi-space indentation and styles seamlessly across wrapped lines.
 */
export function splitTextToLines(
  rawText: string,
  maxWidth = BOOK_TEXT_WIDTH,
  atlas: GlyphAtlas = defaultGlyphAtlas
): LineLayout[] {
  // Normalize newlines
  const text = rawText.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const paragraphs = text.split('\n');
  const resultLines: LineLayout[] = [];

  // In Minecraft written books, each page is a continuous formatted text component.
  // Styles carry over across explicit newlines (\n) within a page until cleared by §r or a new color code.
  let carriedStyle = {
    color: '#000000',
    bold: false,
    italic: false,
    underlined: false,
    strikethrough: false,
    obfuscated: false,
  };

  for (let pIdx = 0; pIdx < paragraphs.length; pIdx++) {
    const paragraph = paragraphs[pIdx];
    if (paragraph.length === 0) {
      // Empty line / paragraph gap
      resultLines.push({ spans: [], width: 0 });
      continue;
    }

    const spans = parseFormattedText(paragraph, carriedStyle);
    if (spans.length === 0) {
      resultLines.push({ spans: [], width: 0 });
      continue;
    }

    // Flatten into styled character stream (matching StringDecomposer.iterateFormatted)
    const chars: StyledChar[] = [];
    for (const span of spans) {
      carriedStyle = {
        color: span.color,
        bold: span.bold,
        italic: span.italic,
        underlined: span.underlined,
        strikethrough: span.strikethrough,
        obfuscated: span.obfuscated,
      };
      for (const ch of span.text) {
        chars.push({
          char: ch,
          style: { ...span },
          width: atlas.getAdvance(ch, span.bold),
        });
      }
    }

    // Minecraft LineBreakFinder word-wrapping algorithm
    let lineStart = 0;
    let i = 0;
    let currentWidth = 0;
    let lastSpace = -1;

    while (i < chars.length) {
      const item = chars[i];
      if (item.char === ' ') {
        lastSpace = i;
      }

      if (currentWidth + item.width > maxWidth) {
        // If we have already reached the 14th line (the page's hard line limit),
        // do not wrap into a non-existent 15th line that gets clipped by page height.
        // Instead, let the 14th line continue and naturally clip at the right margin (vanilla book authoring behavior).
        if (resultLines.length >= LINES_PER_PAGE - 1) {
          currentWidth += item.width;
          i++;
          continue;
        }

        if (lastSpace !== -1 && lastSpace >= lineStart) {
          // If the break occurs at the start of a multi-space indentation block,
          // preserve all indentation spaces on the new line.
          // Otherwise (single inter-word space), discard the single wrapping space.
          // If the break occurs at the very start of a multi-space indentation block
          // (i.e. the character right before the spaces was a non-space that filled the line),
          // preserve all indentation spaces on the new line.
          // In the middle of an inter-word or margin-padding whitespace run, consume the wrapping space.
          const isIndentationStart =
            lastSpace === i &&
            i + 1 < chars.length &&
            chars[i + 1].char === ' ' &&
            i > lineStart &&
            chars[i - 1].char !== ' ';
          const nextStart = isIndentationStart ? lastSpace : lastSpace + 1;

          const lineChars = chars.slice(lineStart, lastSpace);
          resultLines.push(coalesceCharsToLine(lineChars));
          lineStart = nextStart;
          i = lineStart;
          currentWidth = 0;
          lastSpace = -1;
          continue;
        } else {
          // No space on current line, break right before current character
          const lineChars = chars.slice(lineStart, i);
          resultLines.push(coalesceCharsToLine(lineChars));
          lineStart = i;
          currentWidth = 0;
          lastSpace = -1;
          continue;
        }
      }

      currentWidth += item.width;
      i++;
    }

    if (lineStart < chars.length) {
      resultLines.push(coalesceCharsToLine(chars.slice(lineStart)));
    }
  }

  // Trim trailing empty lines at the very end of the page (e.g. from trailing \n before #- delimiters)
  while (resultLines.length > 0 && resultLines[resultLines.length - 1].spans.length === 0) {
    resultLines.pop();
  }
  if (resultLines.length === 0) {
    resultLines.push({ spans: [], width: 0 });
  }

  return resultLines;
}

/**
 * Splits an array of wrapped lines into pages of up to 14 lines each.
 */
export function paginateLines(lines: LineLayout[], linesPerPage = LINES_PER_PAGE): LineLayout[][] {
  if (lines.length === 0) {
    return [[{ spans: [], width: 0 }]];
  }

  const pages: LineLayout[][] = [];
  for (let i = 0; i < lines.length; i += linesPerPage) {
    pages.push(lines.slice(i, i + linesPerPage));
  }
  return pages;
}

/**
 * Takes raw continuous text and formats it into pages of up to 14 lines.
 */
export function paginateRawText(
  text: string,
  maxWidth = BOOK_TEXT_WIDTH,
  linesPerPage = LINES_PER_PAGE,
  atlas: GlyphAtlas = defaultGlyphAtlas
): LineLayout[][] {
  const lines = splitTextToLines(text, maxWidth, atlas);
  return paginateLines(lines, linesPerPage);
}
