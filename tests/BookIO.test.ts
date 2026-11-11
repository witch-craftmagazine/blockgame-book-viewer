import { describe, it, expect } from 'vitest';
import { parseBook, parseStendhalBook, parseScribbleBook } from '../src/io/BookParser';
import {
  exportToBookCopyJson,
  exportToScribbleJson,
  exportToCmiText,
  exportToStendhal,
  exportToGiveCommandModern,
  exportToGiveCommandLegacy,
  exportToUrlHash,
  importFromUrlHash,
} from '../src/io/BookExporter';
import { BlockgameBook } from '../src/engine/types';

describe('Book Parser and Exporter', () => {
  const sampleBook: BlockgameBook = {
    title: 'Test Chronicle',
    author: 'Steve',
    generation: 0,
    pages: ['Page 1 content', 'Page 2 with §cRed text'],
  };

  it('exports and parses Stendhal format (.stendhal)', () => {
    const stendhalText = exportToStendhal(sampleBook);
    expect(stendhalText).toContain('title: Test Chronicle');
    expect(stendhalText).toContain('author: Steve');
    expect(stendhalText).toContain('pages:');
    expect(stendhalText).toContain('#- Page 1 content');

    const parsed = parseBook(stendhalText);
    expect(parsed.title).toBe(sampleBook.title);
    expect(parsed.author).toBe(sampleBook.author);
    expect(parsed.pages).toEqual(sampleBook.pages);
  });

  it('parses multi-line Stendhal book content correctly', () => {
    const rawStendhal = `title: issue1
author: EE33
pages:
#- §7      **{Issue 1}**
§d☠☠☠☠☠☠ ™ ☠☠☠☠☠☠§l§5§l     WITCH-CRAFT 
    ★MAGAZINE★
#- §8Second page line 1
Line 2
Line 3
`;
    const book = parseStendhalBook(rawStendhal);
    expect(book).not.toBeNull();
    expect(book?.title).toBe('issue1');
    expect(book?.author).toBe('EE33');
    expect(book?.pages.length).toBe(2);
    expect(book?.pages[0]).toContain('WITCH-CRAFT');
    expect(book?.pages[1]).toBe('§8Second page line 1\nLine 2\nLine 3');
  });

  it('exports and parses BookCopy JSON', () => {
    const json = exportToBookCopyJson(sampleBook);
    const parsed = parseBook(json);

    expect(parsed.title).toBe(sampleBook.title);
    expect(parsed.author).toBe(sampleBook.author);
    expect(parsed.pages).toEqual(sampleBook.pages);
  });

  it('exports and parses Scribble mod JSON format (.json)', () => {
    const scribbleJson = exportToScribbleJson(sampleBook);
    expect(scribbleJson).toContain('"author": "Steve"');
    expect(scribbleJson).toContain('"pages": [');

    const parsedDirect = parseScribbleBook(scribbleJson);
    expect(parsedDirect).not.toBeNull();
    expect(parsedDirect?.author).toBe('Steve');
    expect(parsedDirect?.pages).toEqual(sampleBook.pages);

    const parsedAuto = parseBook(scribbleJson);
    expect(parsedAuto.author).toBe('Steve');
    expect(parsedAuto.pages).toEqual(sampleBook.pages);
  });

  it('exports and parses CMI BookExport format with <NextPage>', () => {
    const cmi = exportToCmiText(sampleBook);
    expect(cmi).toContain('<AutoPage>');
    expect(cmi).toContain('<NextPage>');

    const parsed = parseBook(cmi);
    expect(parsed.title).toBe(sampleBook.title);
    expect(parsed.author).toBe(sampleBook.author);
    expect(parsed.pages).toEqual(sampleBook.pages);
  });

  it('exports valid Minecraft /give commands', () => {
    const modern = exportToGiveCommandModern(sampleBook);
    expect(modern).toContain('/give @p written_book[written_book_content=');
    expect(modern).toContain('title:"Test Chronicle"');

    const legacy = exportToGiveCommandLegacy(sampleBook);
    expect(legacy).toContain('/give @p written_book{');
    expect(legacy).toContain("title:'Test Chronicle'");
  });

  it('round-trips through URL hash encoding', () => {
    const hash = exportToUrlHash(sampleBook);
    const decoded = importFromUrlHash(hash);

    expect(decoded).not.toBeNull();
    expect(decoded?.title).toBe(sampleBook.title);
    expect(decoded?.author).toBe(sampleBook.author);
    expect(decoded?.pages).toEqual(sampleBook.pages);
  });

  it('parses legacy give command', () => {
    const cmd = `/give @p written_book{pages:['{"text":"Hello World"}'],title:"My Title",author:"Notch"}`;
    const parsed = parseBook(cmd);

    expect(parsed.title).toBe('My Title');
    expect(parsed.author).toBe('Notch');
    expect(parsed.pages[0]).toBe('Hello World');
  });
});
