import { describe, it, expect, beforeEach } from 'vitest';
import {
  parseBedrockBook,
  parseCocoapebblesBook,
  parseBook,
} from '../src/io/BookParser';
import {
  exportToBedrockJson,
  exportToCocoapebblesJson,
} from '../src/io/BookExporter';
import { ExportModal } from '../src/ui/ExportModal';
import { BlockgameBook } from '../src/engine/types';

describe('Format interchange', () => {
  beforeEach(() => {
    const elementsBySel = new Map<string, any>();
    const getOrCreateEl = (sel: string) => {
      if (elementsBySel.has(sel)) return elementsBySel.get(sel);
      const isBtn = sel.includes('btn') || sel.includes('button');
      const isArea = sel.includes('text') || sel.includes('textarea') || sel.includes('url');
      const el = makeEl(isBtn ? 'button' : (isArea ? 'textarea' : 'div'));
      if (sel.includes('bedrock')) el.setAttribute('data-tab', 'bedrock');
      if (sel.includes('spigot')) el.setAttribute('data-tab', 'spigot');
      if (sel.startsWith('#')) el.id = sel.slice(1);
      elementsBySel.set(sel, el);
      return el;
    };

    const makeEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          toggle: () => {},
          contains: () => false,
          add: () => {},
          remove: () => {},
        },
        style: {},
        children: [] as any[],
        attributes: {} as Record<string, string>,
        _innerHTML: '',
        get innerHTML() {
          return this._innerHTML;
        },
        set innerHTML(val: string) {
          this._innerHTML = val;
          if (val === '') {
            this.children = [];
          }
        },
        textContent: '',
        value: '',
        setAttribute(k: string, v: string) {
          this.attributes[k] = v;
        },
        getAttribute(k: string) {
          return this.attributes[k];
        },
        hasAttribute(k: string) {
          return k in this.attributes;
        },
        appendChild(child: any) {
          this.children.push(child);
          return child;
        },
        removeChild(child: any) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) this.children.splice(idx, 1);
          return child;
        },
        querySelector: (sel: string) => getOrCreateEl(sel),
        querySelectorAll: (sel: string) => {
          if (sel.includes('tab-btn')) {
            return [getOrCreateEl('button[data-tab="bedrock"]'), getOrCreateEl('button[data-tab="spigot"]')];
          }
          return [];
        },
        addEventListener: () => {},
        removeEventListener: () => {},
      };
      return el;
    };

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
    };
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      location: { origin: 'http://localhost', pathname: '/' },
    };
  });
  describe('Bedrock Edition Book JSON (WritableBookContent)', () => {
    const sampleBedrockJson = JSON.stringify({
      title: 'Bedrock Guide',
      author: 'Steve',
      pages: [
        { text: '§aWelcome to Bedrock Edition!' },
        { text: 'Second page with §bDiamond text.' },
      ],
    });

    it('correctly parses Bedrock Edition JSON book format', () => {
      const book = parseBedrockBook(sampleBedrockJson);
      expect(book).not.toBeNull();
      expect(book?.title).toBe('Bedrock Guide');
      expect(book?.author).toBe('Steve');
      expect(book?.pages.length).toBe(2);
      expect(book?.pages[0]).toBe('§aWelcome to Bedrock Edition!');
      expect(book?.pages[1]).toBe('Second page with §bDiamond text.');
    });

    it('exports book to standard Bedrock JSON format', () => {
      const book: BlockgameBook = {
        title: 'Nether Secrets',
        author: 'Alex',
        pages: ['Chapter 1: The Fortress', 'Chapter 2: Bastions'],
      };
      const jsonStr = exportToBedrockJson(book);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.title).toBe('Nether Secrets');
      expect(parsed.author).toBe('Alex');
      expect(Array.isArray(parsed.pages)).toBe(true);
      expect(parsed.pages[0]).toEqual({ text: 'Chapter 1: The Fortress' });
      expect(parsed.pages[1]).toEqual({ text: 'Chapter 2: Bastions' });
    });

    it('auto-detects Bedrock Book JSON in universal parseBook()', () => {
      const book = parseBook(sampleBedrockJson);
      expect(book.title).toBe('Bedrock Guide');
      expect(book.pages.length).toBe(2);
    });
  });

  describe('Spigot & Server Formats (cocoapebbles-book)', () => {
    const sampleSpigotJson = JSON.stringify({
      id: 'custom-book-42',
      title: 'Server Rules',
      author: 'Admin',
      pages: [
        'Rule 1: Be respectful.<br/>Rule 2: No griefing.',
        'Rule 3: Have fun!',
      ],
    });

    it('parses Spigot book JSON and expands <br/> page break tags', () => {
      const book = parseCocoapebblesBook(sampleSpigotJson);
      expect(book).not.toBeNull();
      expect(book?.id).toBe('custom-book-42');
      expect(book?.title).toBe('Server Rules');
      expect(book?.author).toBe('Admin');
      // "Rule 1<br/>Rule 2" splits into two distinct pages + "Rule 3" = 3 pages
      expect(book?.pages.length).toBe(3);
      expect(book?.pages[0]).toBe('Rule 1: Be respectful.');
      expect(book?.pages[1]).toBe('Rule 2: No griefing.');
      expect(book?.pages[2]).toBe('Rule 3: Have fun!');
    });

    it('exports book to cocoapebbles-book JSON preserving metadata id', () => {
      const book: BlockgameBook = {
        id: 'vault-key-77',
        title: 'Vault Cipher',
        author: 'Keeper',
        pages: ['Coordinates: 100, 64, -200'],
      };
      const jsonStr = exportToCocoapebblesJson(book);
      const parsed = JSON.parse(jsonStr);

      expect(parsed.id).toBe('vault-key-77');
      expect(parsed.title).toBe('Vault Cipher');
      expect(parsed.author).toBe('Keeper');
      expect(parsed.pages).toEqual(['Coordinates: 100, 64, -200']);
    });

    it('auto-detects Spigot JSON in universal parseBook()', () => {
      const book = parseBook(sampleSpigotJson);
      expect(book.id).toBe('custom-book-42');
      expect(book.title).toBe('Server Rules');
      expect(book.pages.length).toBe(3);
    });

    it('splits raw text containing <br/> into pages', () => {
      const rawText = 'Page One Content<br/>Page Two Content<br />Page Three Content';
      const book = parseBook(rawText);
      expect(book.pages.length).toBe(3);
      expect(book.pages[0]).toBe('Page One Content');
      expect(book.pages[1]).toBe('Page Two Content');
      expect(book.pages[2]).toBe('Page Three Content');
    });
  });

  describe('Export Modal Integration', () => {
    it('provides Bedrock JSON and Spigot JSON export tabs in ExportModal', () => {
      const modal = new ExportModal();
      const el = modal.getElement();

      expect(el.querySelector('button[data-tab="bedrock"]')).not.toBeNull();
      expect(el.querySelector('button[data-tab="spigot"]')).not.toBeNull();

      modal.show({
        title: 'Interchange Test',
        author: 'Tester',
        pages: ['Test content'],
      });

      const bedrockText = el.querySelector('#export-bedrock-text') as HTMLTextAreaElement;
      expect(bedrockText.value).toContain('"title": "Interchange Test"');
      expect(bedrockText.value).toContain('"text": "Test content"');

      const spigotText = el.querySelector('#export-spigot-text') as HTMLTextAreaElement;
      expect(spigotText.value).toContain('"title": "Interchange Test"');
      expect(spigotText.value).toContain('"pages":');
    });
  });
});
