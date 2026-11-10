import { BlockgameBook } from '../engine/types';
import { DEFAULT_BOOK_TEXT_COLOR, parseFormattedText, stripFormatting } from '../engine/Formatting';
import { snbtString } from './Snbt';

/**
 * Escapes strings for inclusion in single-quoted SNBT strings.
 */
function escapeSnbtSingleQuoted(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Exports book to Bedrock Book JSON (WritableBookContent) format.
 * Compatible with Bedrock Dedicated Server and client writable books.
 */
export function exportToBedrockJson(book: BlockgameBook): string {
  return JSON.stringify(
    {
      title: book.title || 'Bedrock Book',
      author: book.author || 'Player',
      pages: book.pages.map(text => ({ text })),
    },
    null,
    2
  );
}

/**
 * Exports book to Spigot cocoapebbles-book web plugin JSON format.
 */
export function exportToCocoapebblesJson(book: BlockgameBook, id?: string): string {
  return JSON.stringify(
    {
      id: id || book.id || 'book-1',
      title: book.title || 'Spigot Book',
      author: book.author || 'Player',
      pages: book.pages,
    },
    null,
    2
  );
}

/**
 * Exports book to BookCopy JSON format.
 */
export function exportToBookCopyJson(book: BlockgameBook): string {
  return JSON.stringify(
    {
      title: book.title,
      author: book.author,
      generation: book.generation ?? 0,
      pages: book.pages,
    },
    null,
    2
  );
}

/**
 * Exports book to Scribble mod JSON format.
 * In Scribble (1.6+), books are stored as JSON files with author and formatted pages.
 */
export function exportToScribbleJson(book: BlockgameBook): string {
  return JSON.stringify(
    {
      author: book.author || 'Player',
      pages: book.pages,
    },
    null,
    2
  );
}

/**
 * Exports book to CMI CustomText / BookExport format.
 */
export function exportToCmiText(book: BlockgameBook): string {
  let output = `# Title: ${book.title}\n# Author: ${book.author}\n<AutoPage>\n`;
  output += book.pages.join('\n<NextPage>\n');
  return output;
}

/**
 * Exports book to Stendhal format (.stendhal)
 */
export function exportToStendhal(book: BlockgameBook): string {
  let out = `title: ${book.title}\nauthor: ${book.author}\npages:\n`;
  for (const page of book.pages) {
    const lines = page.split(/\r?\n/);
    if (lines.length === 0 || (lines.length === 1 && lines[0] === '')) {
      out += '#- \n';
    } else {
      out += `#- ${lines[0]}\n`;
      for (let i = 1; i < lines.length; i++) {
        out += `${lines[i]}\n`;
      }
    }
  }
  return out;
}

const NAMED_COLORS: Record<string, string> = {
  '#000000': 'black', '#0000aa': 'dark_blue', '#00aa00': 'dark_green', '#00aaaa': 'dark_aqua',
  '#aa0000': 'dark_red', '#aa00aa': 'dark_purple', '#ffaa00': 'gold', '#aaaaaa': 'gray',
  '#555555': 'dark_gray', '#5555ff': 'blue', '#55ff55': 'green', '#55ffff': 'aqua',
  '#ff5555': 'red', '#ff55ff': 'light_purple', '#ffff55': 'yellow', '#ffffff': 'white',
};

/** One styled run of text, ready to be serialised as a text component. */
interface ComponentRun {
  text: string;
  color?: string;
  bold?: boolean;
  italic?: boolean;
  underlined?: boolean;
  strikethrough?: boolean;
  obfuscated?: boolean;
}

/**
 * Converts a page containing § / & formatting codes into explicit, flat text
 * component runs. The chat box cannot type `§`, so codes must never reach the
 * command; every style is spelled out as a component property instead.
 * Sibling components do not inherit from each other, so each run is
 * self-contained.
 */
function pageToRuns(page: string): ComponentRun[] {
  return parseFormattedText(page).map(span => {
    const run: ComponentRun = { text: span.text };
    const color = span.color.toLowerCase();
    // Default book ink is black, so omit it to keep commands short.
    if (color !== DEFAULT_BOOK_TEXT_COLOR) run.color = NAMED_COLORS[color] ?? color;
    if (span.bold) run.bold = true;
    if (span.italic) run.italic = true;
    if (span.underlined) run.underlined = true;
    if (span.strikethrough) run.strikethrough = true;
    if (span.obfuscated) run.obfuscated = true;
    return run;
  });
}

function runToSnbt(run: ComponentRun): string {
  const parts = [`text:${snbtString(run.text)}`];
  if (run.color) parts.push(`color:${run.color.startsWith('#') ? snbtString(run.color) : run.color}`);
  for (const flag of ['bold', 'italic', 'underlined', 'strikethrough', 'obfuscated'] as const) {
    if (run[flag]) parts.push(`${flag}:true`);
  }
  return `{${parts.join(',')}}`;
}

/**
 * A page as an SNBT text component (Minecraft 1.21.5+).
 *
 * Styled runs are children (`extra`) of an unstyled empty parent. This matters:
 * children inherit the parent's style, and in a bare list `[a,b,c]` the first
 * element IS the parent, so a bold first run would turn the whole page bold.
 */
function pageToSnbt(page: string): string {
  const runs = pageToRuns(page);
  if (runs.length === 0) return '""';
  if (runs.length === 1 && Object.keys(runs[0]).length === 1) return snbtString(runs[0].text);
  return `{text:"",extra:[${runs.map(runToSnbt).join(',')}]}`;
}

/** A page as a JSON text component string (Minecraft 1.13 - 1.21.4). */
function pageToJson(page: string): string {
  const runs = pageToRuns(page);
  // The leading "" stops later runs inheriting style from earlier siblings.
  return JSON.stringify(runs.length === 0 ? '' : ['', ...runs]);
}

/** Strips formatting codes and truncates to the 32 character title limit. */
function bookTitle(book: BlockgameBook): string {
  return Array.from(stripFormatting(book.title)).slice(0, 32).join('');
}

/**
 * Exports book to a /give command for Minecraft 1.21.5+ (including 26.x).
 *
 * Since 1.21.5 text components are stored as NBT, so each page is an SNBT
 * component, not a JSON string:
 *   pages:[[{text:"Hello",color:"dark_green",bold:true}]]
 * Colours and styles are emitted as properties because `§` cannot be typed
 * into the chat box.
 */
export function exportToGiveCommandModern(book: BlockgameBook): string {
  const pages = book.pages.map(pageToSnbt).join(',');
  const generation = book.generation ? `,generation:${book.generation}` : '';
  return `/give @p written_book[written_book_content={title:${snbtString(bookTitle(book))},author:${snbtString(stripFormatting(book.author))}${generation},pages:[${pages}]}] 1`;
}

/**
 * Exports book to a /give command for Minecraft 1.20.5 - 1.21.4, where item
 * components exist but pages are still JSON text wrapped in strings.
 */
export function exportToGiveCommandJsonPages(book: BlockgameBook): string {
  const pages = book.pages.map(page => `'${escapeSnbtSingleQuoted(pageToJson(page))}'`).join(',');
  const generation = book.generation ? `,generation:${book.generation}` : '';
  return `/give @p written_book[written_book_content={title:'${escapeSnbtSingleQuoted(bookTitle(book))}',author:'${escapeSnbtSingleQuoted(stripFormatting(book.author))}'${generation},pages:[${pages}]}] 1`;
}

/**
 * Exports book to legacy Minecraft (1.13 - 1.20.4) /give command.
 */
export function exportToGiveCommandLegacy(book: BlockgameBook): string {
  const pages = book.pages.map(page => `'${escapeSnbtSingleQuoted(pageToJson(page))}'`).join(',');
  const generation = book.generation ? `,generation:${book.generation}` : '';
  return `/give @p written_book{title:'${escapeSnbtSingleQuoted(bookTitle(book))}',author:'${escapeSnbtSingleQuoted(stripFormatting(book.author))}'${generation},pages:[${pages}]} 1`;
}

/**
 * Encodes book into a shareable URL hash string.
 */
export function exportToUrlHash(book: BlockgameBook): string {
  const jsonStr = JSON.stringify(book);
  const bytes = new TextEncoder().encode(jsonStr);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  const base64 = btoa(binary);
  return encodeURIComponent(base64);
}

/**
 * Decodes book from a URL hash string.
 */
export function importFromUrlHash(hash: string): BlockgameBook | null {
  try {
    const base64 = decodeURIComponent(hash);
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      bytes[i] = binary.charCodeAt(i);
    }
    const jsonStr = new TextDecoder().decode(bytes);
    return JSON.parse(jsonStr);
  } catch {
    return null;
  }
}
