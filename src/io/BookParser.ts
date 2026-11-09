import { MinecraftBook, BookEngine } from '../engine/types';
import { MINECRAFT_COLORS } from '../engine/Formatting';
import { splitTextLossless } from '../engine/LosslessSplit';

/**
 * Converts a Minecraft JSON Text Component (or string) into a § formatted string.
 */
export function componentToFormattedString(component: any): string {
  if (typeof component === 'string') {
    // If it's a JSON string, try to parse it
    if ((component.startsWith('{') && component.endsWith('}')) || (component.startsWith('[') && component.endsWith(']'))) {
      try {
        const parsed = JSON.parse(component);
        return componentToFormattedString(parsed);
      } catch {
        return component;
      }
    }
    return component;
  }

  if (Array.isArray(component)) {
    return component.map(c => componentToFormattedString(c)).join('');
  }

  if (typeof component === 'object' && component !== null) {
    let result = '';

    // Apply color
    if (component.color) {
      const colorLower = String(component.color).toLowerCase();
      let matchedCode = '';
      for (const [code, hex] of Object.entries(MINECRAFT_COLORS)) {
        if (colorLower === hex.toLowerCase()) {
          matchedCode = code;
          break;
        }
      }
      if (matchedCode) {
        result += `§${matchedCode}`;
      } else if (colorLower.startsWith('#') && colorLower.length === 7) {
        // Hex color
        const hex = colorLower.substring(1);
        result += '§x' + hex.split('').map(c => '§' + c).join('');
      } else {
        // Named color mapping (e.g. "dark_red", "gold")
        const namedColors: Record<string, string> = {
          black: '0', dark_blue: '1', dark_green: '2', dark_aqua: '3',
          dark_red: '4', dark_purple: '5', gold: '6', gray: '7',
          dark_gray: '8', blue: '9', green: 'a', aqua: 'b',
          red: 'c', light_purple: 'd', yellow: 'e', white: 'f',
        };
        if (colorLower in namedColors) {
          result += `§${namedColors[colorLower]}`;
        }
      }
    }

    if (component.bold) result += '§l';
    if (component.italic) result += '§o';
    if (component.underlined) result += '§n';
    if (component.strikethrough) result += '§m';
    if (component.obfuscated) result += '§k';

    if (component.text) {
      result += String(component.text);
    }

    if (component.extra && Array.isArray(component.extra)) {
      result += component.extra.map((e: any) => componentToFormattedString(e)).join('');
    }

    return result;
  }

  return String(component ?? '');
}

/**
 * Extracts pages and metadata from a Minecraft /give command or SNBT string.
 */
function parseGiveCommand(cmd: string): MinecraftBook | null {
  try {
    // Check for title
    let title = 'Untitled Book';
    const titleMatch = cmd.match(/title\s*:\s*(?:'([^']*)'|"([^"]*)")/);
    if (titleMatch) {
      title = titleMatch[1] || titleMatch[2] || title;
    }

    // Check for author
    let author = 'Unknown';
    const authorMatch = cmd.match(/author\s*:\s*(?:'([^']*)'|"([^"]*)")/);
    if (authorMatch) {
      author = authorMatch[1] || authorMatch[2] || author;
    }

    // Check for pages array: pages:[ ... ]
    const pagesIndex = cmd.indexOf('pages:');
    if (pagesIndex === -1) return null;

    const startBracket = cmd.indexOf('[', pagesIndex);
    if (startBracket === -1) return null;

    // Find matching closing bracket
    let depth = 0;
    let endBracket = -1;
    let inQuote: string | null = null;
    let isEscaped = false;

    for (let i = startBracket; i < cmd.length; i++) {
      const ch = cmd[i];
      if (isEscaped) {
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        isEscaped = true;
        continue;
      }
      if (inQuote) {
        if (ch === inQuote) inQuote = null;
      } else {
        if (ch === '"' || ch === "'") {
          inQuote = ch;
        } else if (ch === '[') {
          depth++;
        } else if (ch === ']') {
          depth--;
          if (depth === 0) {
            endBracket = i;
            break;
          }
        }
      }
    }

    if (endBracket === -1) return null;

    const pagesSub = cmd.slice(startBracket + 1, endBracket).trim();
    // Parse individual page elements
    const rawPages: string[] = [];
    let currentElement = '';
    depth = 0;
    inQuote = null;
    isEscaped = false;

    for (let i = 0; i < pagesSub.length; i++) {
      const ch = pagesSub[i];
      if (isEscaped) {
        currentElement += ch;
        isEscaped = false;
        continue;
      }
      if (ch === '\\') {
        currentElement += ch;
        isEscaped = true;
        continue;
      }
      if (inQuote) {
        currentElement += ch;
        if (ch === inQuote) inQuote = null;
      } else {
        if (ch === '"' || ch === "'") {
          inQuote = ch;
          currentElement += ch;
        } else if (ch === '{' || ch === '[') {
          depth++;
          currentElement += ch;
        } else if (ch === '}' || ch === ']') {
          depth--;
          currentElement += ch;
        } else if (ch === ',' && depth === 0) {
          if (currentElement.trim()) rawPages.push(currentElement.trim());
          currentElement = '';
        } else {
          currentElement += ch;
        }
      }
    }
    if (currentElement.trim()) rawPages.push(currentElement.trim());

    // Clean up and decode each page element
    const pages = rawPages.map(p => {
      let trimmed = p.trim();
      // Remove outer quotes if present
      if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
        trimmed = trimmed.substring(1, trimmed.length - 1);
        // Unescape internal escaped quotes
        trimmed = trimmed.replace(/\\'/g, "'").replace(/\\"/g, '"').replace(/\\\\/g, '\\');
      }

      // Check if it's JSON component or modern {raw:'...'}
      if (trimmed.startsWith('{raw:') && trimmed.endsWith('}')) {
        trimmed = trimmed.substring(5, trimmed.length - 1).trim();
        if ((trimmed.startsWith("'") && trimmed.endsWith("'")) || (trimmed.startsWith('"') && trimmed.endsWith('"'))) {
          trimmed = trimmed.substring(1, trimmed.length - 1);
        }
      }

      return componentToFormattedString(trimmed);
    });

    return {
      title,
      author,
      pages: pages.length > 0 ? pages : [''],
    };
  } catch {
    return null;
  }
}

/**
 * Parses CMI BookExport / CustomText format (<AutoPage> ... <NextPage> ...)
 */
function parseCmiBookExport(text: string): MinecraftBook | null {
  if (!text.includes('<NextPage>') && !text.includes('<AutoPage>')) {
    return null;
  }

  let title = 'CMI Export';
  let author = 'Server';

  // Check for metadata comments like: # Title: ... or # Author: ...
  const lines = text.split('\n');
  const contentLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('# Title:')) {
      title = trimmed.replace('# Title:', '').trim();
    } else if (trimmed.startsWith('# Author:')) {
      author = trimmed.replace('# Author:', '').trim();
    } else if (trimmed.startsWith('# Book:')) {
      title = trimmed.replace('# Book:', '').trim();
    } else {
      contentLines.push(line);
    }
  }

  let cleaned = contentLines.join('\n');
  // Strip leading <AutoPage>
  cleaned = cleaned.replace(/<AutoPage>\s*/i, '');

  const rawPages = cleaned.split(/<NextPage>/i);
  const pages = rawPages.map(p => p.trim());

  return {
    title,
    author,
    pages: pages.length > 0 ? pages : [''],
  };
}

/**
 * Parses Stendhal format:
 * title: <title>
 * author: <author>
 * pages:
 * #- <first line of page 1>
 * <second line of page 1>
 * #- <first line of page 2>
 */
export function parseStendhalBook(text: string): MinecraftBook | null {
  if (!text.includes('pages:') || !text.includes('#-')) {
    return null;
  }

  const cleanedText = text.replace(/\r?\n$/, '');
  const lines = cleanedText.split(/\r?\n/);
  let title = 'Untitled Book';
  let author = 'Unknown';
  let inPages = false;
  const pages: string[] = [];
  let currentPageLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!inPages) {
      if (trimmed.startsWith('title:')) {
        title = trimmed.slice(6).trim();
      } else if (trimmed.startsWith('author:')) {
        author = trimmed.slice(7).trim();
      } else if (trimmed === 'pages:' || trimmed.startsWith('pages:')) {
        inPages = true;
      }
    } else {
      if (line.startsWith('#-')) {
        if (currentPageLines.length > 0 || pages.length > 0) {
          pages.push(currentPageLines.join('\n'));
          currentPageLines = [];
        }
        const text = line.length > 2 && line[2] === ' ' ? line.slice(3) : line.slice(2);
        currentPageLines.push(text);
      } else {
        currentPageLines.push(line);
      }
    }
  }

  if (currentPageLines.length > 0 || pages.length > 0) {
    const pageText = currentPageLines.join('\n');
    if (pageText.length > 0 || pages.length === 0) {
      pages.push(pageText);
    }
  }

  return {
    title,
    author,
    pages: pages.length > 0 ? pages : [''],
  };
}

/**
 * Parses Scribble mod JSON format (.json):
 * { "author": "...", "pages": [ "..." ] }
 */
export function parseScribbleBook(input: string): MinecraftBook | null {
  try {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.pages)) {
      return {
        title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'Scribble Book',
        author: typeof parsed.author === 'string' && parsed.author ? parsed.author : 'Player',
        generation: typeof parsed.generation === 'number' ? parsed.generation : 0,
        pages: parsed.pages.map((p: any) => componentToFormattedString(p)),
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Parses Bedrock Book JSON (WritableBookContent format):
 * { "title": "...", "author": "...", "pages": [ { "text": "...", "photoname": "..." } ] }
 */
export function parseBedrockBook(input: string): MinecraftBook | null {
  try {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed && Array.isArray(parsed.pages)) {
      const isBedrock = parsed.pages.length === 0 || (
        typeof parsed.pages[0] === 'object' && parsed.pages[0] !== null && 'text' in parsed.pages[0]
      );
      if (isBedrock) {
        const pages = parsed.pages.map((p: any) => {
          if (typeof p === 'object' && p !== null && typeof p.text === 'string') {
            return componentToFormattedString(p.text);
          }
          return componentToFormattedString(p);
        });
        return {
          title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'Bedrock Book',
          author: typeof parsed.author === 'string' && parsed.author ? parsed.author : 'Player',
          generation: typeof parsed.generation === 'number' ? parsed.generation : 0,
          pages: pages.length > 0 ? pages : [''],
        };
      }
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Parses Spigot cocoapebbles-book JSON format:
 * { "id": "...", "title": "...", "author": "...", "pages": [ "..." ] }
 * Also supports forced page breaks via <br/> tags.
 */
export function parseCocoapebblesBook(input: string): MinecraftBook | null {
  try {
    const trimmed = input.trim();
    if (!trimmed.startsWith('{') || !trimmed.endsWith('}')) return null;
    const parsed = JSON.parse(trimmed);
    if (parsed && (Array.isArray(parsed.pages) || typeof parsed.id === 'string')) {
      const rawPages: any[] = Array.isArray(parsed.pages) ? parsed.pages : [];
      const expandedPages: string[] = [];

      for (const p of rawPages) {
        const str = typeof p === 'object' && p !== null && typeof p.text === 'string'
          ? p.text
          : componentToFormattedString(p);
        
        // If page contains <br/> tags indicating page breaks in web book editors
        if (/<br\s*\/?>/i.test(str)) {
          const split = str.split(/<br\s*\/?>/i).map((s: string) => s.trim());
          expandedPages.push(...split);
        } else {
          expandedPages.push(str);
        }
      }

      return {
        id: typeof parsed.id === 'string' ? parsed.id : undefined,
        title: typeof parsed.title === 'string' && parsed.title ? parsed.title : 'Spigot Book',
        author: typeof parsed.author === 'string' && parsed.author ? parsed.author : 'Player',
        generation: typeof parsed.generation === 'number' ? parsed.generation : 0,
        pages: expandedPages.length > 0 ? expandedPages : [''],
      };
    }
  } catch {
    return null;
  }
  return null;
}

/**
 * Parses raw unformatted or continuous text using the LosslessSplit engine,
 * guaranteeing String.join("", pages) === text and surrogate-pair safety.
 */
export function parseRawTextLossless(
  text: string,
  title = 'Imported Text',
  author = 'Author',
  engine: BookEngine = 'java'
): MinecraftBook {
  const trimmed = text.trim();
  const pages = splitTextLossless(trimmed, { engine });
  return {
    title,
    author,
    pages: pages.length > 0 ? pages : [''],
  };
}

/**
 * Automatically parses any supported Minecraft book string or file content.
 */
export function parseBook(
  input: string,
  options?: { engine?: BookEngine; splitContinuous?: boolean }
): MinecraftBook {
  const trimmed = input.trim();

  // 1. Check for JSON formats (Bedrock JSON, Spigot JSON, Scribble format, BookCopy format)
  if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
    try {
      const bedrock = parseBedrockBook(trimmed);
      if (bedrock) return bedrock;

      const cocoapebbles = parseCocoapebblesBook(trimmed);
      if (cocoapebbles && (cocoapebbles.id || trimmed.includes('<br'))) return cocoapebbles;

      const parsed = JSON.parse(trimmed);
      if (parsed.pages && Array.isArray(parsed.pages)) {
        const pages = parsed.pages.map((p: any) => {
          if (typeof p === 'object' && p !== null && typeof p.text === 'string') {
            return componentToFormattedString(p.text);
          }
          return componentToFormattedString(p);
        });
        return {
          id: parsed.id || undefined,
          title: parsed.title || 'Scribble Book',
          author: parsed.author || 'Anonymous',
          generation: typeof parsed.generation === 'number' ? parsed.generation : 0,
          pages: pages.length > 0 ? pages : [''],
        };
      }
    } catch {
      // Not JSON, continue
    }
  }

  // 1.5. Check for <br/> page breaks in continuous/web editor text
  if (/<br\s*\/?>/i.test(trimmed) && !trimmed.startsWith('{')) {
    const pages = trimmed.split(/<br\s*\/?>/i).map(p => p.trim());
    return {
      title: 'Imported Book',
      author: 'Author',
      pages: pages.length > 0 ? pages : [''],
    };
  }

  // 2. Check for Stendhal format (.stendhal)
  const stendhal = parseStendhalBook(trimmed);
  if (stendhal) return stendhal;

  // 3. Check for CMI BookExport (<NextPage>)
  const cmi = parseCmiBookExport(trimmed);
  if (cmi) return cmi;

  // 3. Check for Minecraft /give command or SNBT
  if (trimmed.includes('written_book') || trimmed.includes('pages:')) {
    const give = parseGiveCommand(trimmed);
    if (give) return give;
  }

  // 4. Check for Delimited pages (--- or === Page X ===)
  if (trimmed.includes('\n---\n') || /=== Page \d+ ===/i.test(trimmed)) {
    let pages: string[];
    if (trimmed.includes('\n---\n')) {
      pages = trimmed.split(/\n---\n/);
    } else {
      pages = trimmed.split(/=== Page \d+ ===/i).filter(p => p.trim().length > 0);
    }

    return {
      title: 'Delimited Book',
      author: 'Author',
      pages: pages.map(p => p.trim()),
    };
  }

  // 5. Fallback: Plain continuous text
  const splitContinuous = options?.splitContinuous ?? true;
  const pages = splitContinuous
    ? splitTextLossless(trimmed, { engine: options?.engine })
    : [trimmed];

  return {
    title: 'Imported Text',
    author: 'Author',
    pages: pages.length > 0 ? pages : [''],
  };
}
