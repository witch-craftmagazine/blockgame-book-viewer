import { BOOK_TEXT_WIDTH, measureLineWidth } from './StringSplitter';
import { parseFormattedText, type StyleState } from './Formatting';

/** Canonical Minecraft Java Edition book line & page constraints */
export const MINECRAFT_LINES_PER_PAGE = 14;
export const MINECRAFT_PAGE_MAX_CHARS = 1024; // Minecraft WritableBookContent PAGE_EDIT_LENGTH limit
export const MINECRAFT_MAX_PAGES = 100; // Minecraft WritableBookContent MAX_PAGES limit

// Aliases for cross-platform clarity
export const JAVA_MAX_CHARS_PER_PAGE = MINECRAFT_PAGE_MAX_CHARS;
export const BEDROCK_MAX_CHARS_PER_PAGE = MINECRAFT_PAGE_MAX_CHARS;

/**
 * Checks if a string contains Unicode characters above U+FFFF (Supplementary Multilingual Plane, SMP).
 * In vanilla Minecraft Java Edition, bitmap/unifont providers only render 16-bit BMP characters (U+0000 to U+FFFF).
 * Characters above U+FFFF (modern emoji like 😀, 🍎, 🔥, 💀, etc.) render as missing glyph boxes ([]).
 */
export function detectUnsupportedMinecraftChars(text: string): { count: number; chars: string[] } {
  const chars: string[] = [];
  for (const ch of text) {
    const code = ch.codePointAt(0);
    if (code && code > 0xFFFF) {
      if (!chars.includes(ch)) chars.push(ch);
    }
  }
  return { count: chars.length, chars };
}

/**
 * Solves for the optimal combination of regular spaces (4px) and bold spaces (§l §r, 5px)
 * to fill a specified pixel margin.
 */
export function solveBoldSpaces(marginPx: number): { regular: number; bold: number; achievedPx: number } {
  if (marginPx <= 0) return { regular: 0, bold: 0, achievedPx: 0 };
  let bestR = 0;
  let bestB = 0;
  let bestDiff = Infinity;
  let bestAchieved = 0;

  const maxR = Math.ceil(marginPx / 4) + 1;
  const maxB = Math.ceil(marginPx / 5) + 1;

  for (let r = 0; r <= maxR; r++) {
    for (let b = 0; b <= maxB; b++) {
      const px = r * 4 + b * 5;
      const diff = Math.abs(px - marginPx);
      if (diff < bestDiff || (diff === bestDiff && (r + b) < (bestR + bestB))) {
        bestDiff = diff;
        bestR = r;
        bestB = b;
        bestAchieved = px;
        if (diff === 0) break;
      }
    }
    if (bestDiff === 0) break;
  }
  return { regular: bestR, bold: bestB, achievedPx: bestAchieved };
}

/**
 * Centers text on a Minecraft book line by prepending regular (4px) and bold (5px) spaces.
 * Intrinsic content is measured without leading spaces, and optimal spacing is calculated
 * to balance left and right margins to within 1-2 pixels of exact line center.
 */
export function centerLineText(
  rawLine: string,
  targetWidth: number = BOOK_TEXT_WIDTH,
  carriedStyle?: StyleState
): string {
  // Strip leading spaces (both raw and immediately following initial format codes, including §l §r sequences)
  let trimmed = rawLine.replace(/^[ \t]+/, '');
  // Strip §l <spaces> §r and raw spaces
  trimmed = trimmed.replace(/^(?:§l[ \t]*§r|[ \t])+/gi, '');
  trimmed = trimmed.replace(/^((?:§[0-9a-fk-or])+)[ \t]+/gi, '$1');

  if (!trimmed.trim()) return '';

  const spans = parseFormattedText(trimmed, carriedStyle);
  const contentWidth = Math.round(measureLineWidth(spans));

  if (contentWidth >= targetWidth) {
    return rawLine;
  }

  const remaining = Math.floor(targetWidth - contentWidth);
  const leftMargin = Math.floor(remaining / 2);

  const { regular, bold } = solveBoldSpaces(leftMargin);

  let prefix = '';
  if (regular > 0) {
    prefix += ' '.repeat(regular);
  }
  if (bold > 0) {
    prefix += `§l${' '.repeat(bold)}§r`;
  }

  return prefix + trimmed;
}
