import { BookEngine, LineLayout } from './types';
import { GlyphAtlas, defaultGlyphAtlas } from './GlyphAtlas';
import { LINES_PER_PAGE, getTextWidthForEngine, splitTextToLines } from './StringSplitter';

export interface LosslessSplitOptions {
  /** Maximum pixel width per line (defaults to 114 for Java, 122 for Bedrock) */
  maxWidth?: number;
  /** Maximum lines per page (defaults to 14) */
  maxLinesPerPage?: number;
  /** GlyphAtlas instance for advance metrics */
  atlas?: GlyphAtlas;
  /** Target engine ('java' or 'bedrock') */
  engine?: BookEngine;
  /** Maximum percentage of candidate page length to roll back for soft breaks (default 0.38) */
  maxRollbackFraction?: number;
}

/**
 * Validates whether an index within text is safe for a clean boundary cut:
 * - Does not split between a UTF-16 surrogate pair (0xD800-0xDBFF and 0xDC00-0xDFFF).
 * - Does not cut immediately following a section sign '§'.
 * - Does not cut in the middle of a 14-character hex color code (§x§r§r§g§g§b§b).
 */
export function isSafeSplitBoundary(text: string, index: number): boolean {
  if (index <= 0 || index >= text.length) return true;

  // 1. Surrogate pair check
  const prevCode = text.charCodeAt(index - 1);
  const currCode = text.charCodeAt(index);
  if (prevCode >= 0xd800 && prevCode <= 0xdbff && currCode >= 0xdc00 && currCode <= 0xdfff) {
    return false;
  }

  // 2. Section sign check (do not cut between § and formatting token)
  if (text.charAt(index - 1) === '§') {
    return false;
  }

  // 3. Hex color sequence check (§x§r§r§g§g§b§b)
  const lookback = Math.max(0, index - 14);
  const windowStr = text.slice(lookback, index + 14);
  const hexIdx = windowStr.lastIndexOf('§x');
  if (hexIdx !== -1) {
    const absHexIdx = lookback + hexIdx;
    if (index > absHexIdx && index < absHexIdx + 14) {
      return false;
    }
  }

  return true;
}

/**
 * Backtracks from index until reaching a safe split boundary.
 */
export function getSafeSplitBoundary(text: string, index: number): number {
  let idx = index;
  while (idx > 0 && !isSafeSplitBoundary(text, idx)) {
    idx--;
  }
  return idx;
}

/**
 * Splits continuous raw text into pages using bounded soft-rollback heuristics while strictly
 * maintaining the lossless invariant: `String.join("", pages) === rawText`.
 *
 * Soft rollback scoring:
 * 1. Double newline (`\n\n` - paragraph boundary)
 * 2. Single newline (`\n` - line break)
 * 3. Whitespace (` ` - word boundary)
 * 4. Fallback: Hard cut at character limit when words or lines exceed page capacity.
 */
export function splitTextLossless(rawText: string, options: LosslessSplitOptions = {}): string[] {
  if (!rawText || rawText.length === 0) {
    return [''];
  }

  const engine = options.engine || 'java';
  const maxWidth = options.maxWidth ?? getTextWidthForEngine(engine);
  const maxLinesPerPage = options.maxLinesPerPage ?? LINES_PER_PAGE;
  const atlas = options.atlas ?? defaultGlyphAtlas;
  const rollbackFraction = options.maxRollbackFraction ?? 0.38;

  // Fast path: if the entire text already fits on a single page, return immediately
  if (splitTextToLines(rawText, maxWidth, atlas).length <= maxLinesPerPage) {
    return [rawText];
  }

  const pages: string[] = [];
  let pageStart = 0;

  while (pageStart < rawText.length) {
    const remaining = rawText.slice(pageStart);

    // If remaining text fits on the final page, finish
    if (splitTextToLines(remaining, maxWidth, atlas).length <= maxLinesPerPage) {
      pages.push(remaining);
      break;
    }

    // Binary search for maximum character count that fits within maxLinesPerPage
    let low = pageStart + 1;
    let high = rawText.length;
    let hardCut = pageStart + 1;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      const candidate = rawText.slice(pageStart, mid);
      if (splitTextToLines(candidate, maxWidth, atlas).length <= maxLinesPerPage) {
        hardCut = mid;
        low = mid + 1;
      } else {
        high = mid - 1;
      }
    }

    hardCut = getSafeSplitBoundary(rawText, hardCut);

    if (hardCut >= rawText.length) {
      pages.push(rawText.slice(pageStart));
      break;
    }

    // Determine soft-rollback boundary to prevent page starvation
    const candidateLength = hardCut - pageStart;
    const minCut = Math.max(pageStart + 1, hardCut - Math.floor(candidateLength * rollbackFraction));
    let chosenCut = hardCut;
    const window = rawText.slice(pageStart, hardCut);

    // Heuristic 1: Double newline (paragraph break)
    const doubleNl = window.lastIndexOf('\n\n');
    if (doubleNl !== -1 && pageStart + doubleNl + 2 >= minCut) {
      chosenCut = pageStart + doubleNl + 2;
    } else {
      // Heuristic 2: Single newline
      const singleNl = window.lastIndexOf('\n');
      if (singleNl !== -1 && pageStart + singleNl + 1 >= minCut) {
        chosenCut = pageStart + singleNl + 1;
      } else {
        // Heuristic 3: Word boundary (space)
        const lastSpace = window.lastIndexOf(' ');
        if (lastSpace !== -1 && pageStart + lastSpace + 1 >= minCut) {
          chosenCut = pageStart + lastSpace + 1;
        }
      }
    }

    // Ensure safe boundary
    chosenCut = getSafeSplitBoundary(rawText, chosenCut);
    if (chosenCut <= pageStart) {
      chosenCut = hardCut;
    }

    // Verify candidate lines under layout engine
    while (
      chosenCut > pageStart &&
      splitTextToLines(rawText.slice(pageStart, chosenCut), maxWidth, atlas).length > maxLinesPerPage
    ) {
      chosenCut = getSafeSplitBoundary(rawText, chosenCut - 1);
    }

    // Ensure forward progress
    if (chosenCut <= pageStart) {
      let next = pageStart + 1;
      while (next < rawText.length && !isSafeSplitBoundary(rawText, next)) {
        next++;
      }
      chosenCut = next;
    }

    pages.push(rawText.slice(pageStart, chosenCut));
    pageStart = chosenCut;
  }

  return pages;
}

/**
 * Splits raw continuous text into pre-paginated LineLayout arrays using LosslessSplit.
 */
export function paginateTextLossless(
  rawText: string,
  options: LosslessSplitOptions = {}
): LineLayout[][] {
  const pages = splitTextLossless(rawText, options);
  const engine = options.engine || 'java';
  const maxWidth = options.maxWidth ?? getTextWidthForEngine(engine);
  const atlas = options.atlas ?? defaultGlyphAtlas;

  return pages.map((pageText) => splitTextToLines(pageText, maxWidth, atlas));
}
