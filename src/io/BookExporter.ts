import { MinecraftBook } from '../engine/types';

/**
 * Escapes strings for inclusion in single-quoted SNBT strings.
 */
function escapeSnbtSingleQuoted(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/**
 * Exports book to BookCopy JSON format.
 */
export function exportToBookCopyJson(book: MinecraftBook): string {
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
export function exportToScribbleJson(book: MinecraftBook): string {
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
export function exportToCmiText(book: MinecraftBook): string {
  let output = `# Title: ${book.title}\n# Author: ${book.author}\n<AutoPage>\n`;
  output += book.pages.join('\n<NextPage>\n');
  return output;
}

/**
 * Exports book to Stendhal format (.stendhal)
 */
export function exportToStendhal(book: MinecraftBook): string {
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

/**
 * Exports book to modern Minecraft 1.20.5+ /give command.
 */
export function exportToGiveCommandModern(book: MinecraftBook): string {
  const pagesSnbt = book.pages.map(page => {
    // Each page in 1.20.5+ is a component string: raw:'{"text":"..."}' or '{"text":"..."}'
    const jsonStr = JSON.stringify({ text: page });
    return `'${escapeSnbtSingleQuoted(jsonStr)}'`;
  }).join(',');

  const escapedTitle = escapeSnbtSingleQuoted(book.title);
  const escapedAuthor = escapeSnbtSingleQuoted(book.author);

  return `/give @p written_book[written_book_content={title:'${escapedTitle}',author:'${escapedAuthor}',pages:[${pagesSnbt}]}] 1`;
}

/**
 * Exports book to legacy Minecraft (1.13 - 1.20.4) /give command.
 */
export function exportToGiveCommandLegacy(book: MinecraftBook): string {
  const pagesSnbt = book.pages.map(page => {
    const jsonStr = JSON.stringify({ text: page });
    return `'${escapeSnbtSingleQuoted(jsonStr)}'`;
  }).join(',');

  const escapedTitle = escapeSnbtSingleQuoted(book.title);
  const escapedAuthor = escapeSnbtSingleQuoted(book.author);

  return `/give @p written_book{title:'${escapedTitle}',author:'${escapedAuthor}',pages:[${pagesSnbt}]} 1`;
}

/**
 * Encodes book into a shareable URL hash string.
 */
export function exportToUrlHash(book: MinecraftBook): string {
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
export function importFromUrlHash(hash: string): MinecraftBook | null {
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
