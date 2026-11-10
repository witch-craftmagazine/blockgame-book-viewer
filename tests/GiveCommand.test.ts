import { describe, it, expect } from 'vitest';
import { parseBook } from '../src/io/BookParser';
import {
  exportToGiveCommandModern,
  exportToGiveCommandJsonPages,
  exportToGiveCommandLegacy,
} from '../src/io/BookExporter';
import { parseSnbt } from '../src/io/Snbt';
import type { BlockgameBook } from '../src/engine/types';

const book: BlockgameBook = {
  title: 'Web Component Guide',
  author: 'Blockgame Book Engine',
  pages: [
    '§0§l<blockgame-book>§r\n\n§2A zero-dependency custom\nelement.§0\n\n§8Select options!§r',
    '§l§nBold & Underline§r\n§o§mItalic Strikethrough§r\n§kMagic',
    'Plain text, no formatting',
    '',
  ],
};

describe('/give command generation', () => {
  for (const [name, fn] of [
    ['1.21.5+', exportToGiveCommandModern],
    ['1.20.5 - 1.21.4', exportToGiveCommandJsonPages],
    ['legacy', exportToGiveCommandLegacy],
  ] as const) {
    it(`${name}: never contains § (chat strips it)`, () => {
      expect(fn(book)).not.toContain('§');
    });
    it(`${name}: round-trips through parseBook`, () => {
      const parsed = parseBook(fn(book));
      expect(parsed.title).toBe(book.title);
      expect(parsed.author).toBe(book.author);
      expect(parsed.pages[0]).toBe('§l<blockgame-book>§r\n\n§2A zero-dependency custom\nelement.§r\n\n§8Select options!');
      expect(parsed.pages[1]).toBe('§l§nBold & Underline§r\n§o§mItalic Strikethrough§r\n§kMagic');
      expect(parsed.pages[2]).toBe('Plain text, no formatting');
    });
  }

  it('1.21.5+: pages are SNBT components, not JSON strings', () => {
    const cmd = exportToGiveCommandModern(book);
    expect(cmd.startsWith('/give @p written_book[written_book_content={title:"Web Component Guide"')).toBe(true);
    expect(cmd).toContain('{text:"<blockgame-book>",bold:true}');
    // Runs must hang off an unstyled parent, otherwise a bold first run is inherited by the whole page.
    expect(cmd).toContain('{text:"",extra:[{text:"<blockgame-book>",bold:true},{text:"\\n\\n"}');
    expect(cmd).toContain('color:dark_green');
    expect(cmd).toContain('obfuscated:true');
    // A JSON-in-string page would contain this and display literally in 1.21.5+.
    expect(cmd).not.toContain(`'{"text"`);
    expect(cmd).not.toContain('"text":');
    // The whole component payload must be valid SNBT.
    const body = cmd.slice(cmd.indexOf('written_book_content=') + 'written_book_content='.length, cmd.lastIndexOf(']') );
    const value = parseSnbt(body) as { pages: unknown[] };
    expect(value.pages).toHaveLength(4);
    expect(value.pages[2]).toBe('Plain text, no formatting');
    expect(value.pages[3]).toBe('');
  });

  it('escapes quotes, backslashes and newlines', () => {
    const cmd = exportToGiveCommandModern({ title: 'T', author: 'A', pages: ['say "hi" \\ there\nnext'] });
    expect(cmd).toContain('pages:["say \\"hi\\" \\\\ there\\nnext"]');
    expect(parseBook(cmd).pages[0]).toBe('say "hi" \\ there\nnext');
  });

  it('JSON-page variants isolate sibling styles with a leading empty string', () => {
    const cmd = exportToGiveCommandLegacy({ title: 'T', author: 'A', pages: ['§cRed§rPlain'] });
    expect(cmd).toContain(`pages:['["",{"text":"Red","color":"red"},{"text":"Plain"}]']`);
  });

  it('truncates titles to 32 characters and writes generation', () => {
    const cmd = exportToGiveCommandModern({ title: 'x'.repeat(40), author: 'A', generation: 1, pages: ['a'] });
    expect(cmd).toContain(`title:"${'x'.repeat(32)}"`);
    expect(cmd).toContain('generation:1');
  });

  it('parses hand-written 26.x SNBT with unquoted keys and {raw:...} pages', () => {
    const cmd = '/give @p written_book[written_book_content={title:"T",author:"A",pages:[{raw:{text:"Hi",color:"red"}},[{text:"A",bold:true},{text:"B"}]]}]';
    const parsed = parseBook(cmd);
    // In a list the first element is the parent, so B inherits bold from A.
    expect(parsed.pages).toEqual(['§cHi', '§lAB']);
  });

  it('does not let a bold first run bleed into later runs (regression)', () => {
    const cmd = exportToGiveCommandModern({ title: 'T', author: 'A', pages: ['§lTitle§r\nbody text'] });
    expect(cmd).toContain('pages:[{text:"",extra:[{text:"Title",bold:true},{text:"\\nbody text"}]}]');
    // Minecraft semantics: children of the empty parent inherit nothing.
    expect(parseBook(cmd).pages[0]).toBe('§lTitle§r\nbody text');
  });

  it('applies list inheritance when importing hand-written components', () => {
    const cmd = '/give @p written_book[written_book_content={title:"T",author:"A",pages:[[{text:"Bold",bold:true},{text:" still bold"}],["",{text:"Bold",bold:true},{text:" plain"}]]}]';
    expect(parseBook(cmd).pages).toEqual(['§lBold still bold', '§lBold§r plain']);
  });
});
