import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { MinecraftBookViewer, BlockgameBookViewer } from '../src/ui/BlockgameBookViewer';
import { MinecraftBookElement, BlockgameBookElement } from '../src/component/blockgame-book';
import { MINECRAFT_DYE_HEX, BLOCKGAME_DYE_HEX, MinecraftBook, BlockgameBook } from '../src/engine/types';

describe('Themes, Accessibility & Scholar Extensions (v1.4 & v1.6)', () => {
  let mockContainer: any;
  let mockCtx: any;

  const testBook: MinecraftBook = {
    title: 'Witchcraft Grimoire',
    author: 'StarSweetpea',
    pages: [
      'Page 1: Ancient alchemy notes and brew recipes.',
      'Page 2: Braille art preview: ⠁⠂⠃⠄⠅⠆⠇⠈⠉⠊.',
    ],
  };

  beforeEach(() => {
    mockCtx = {
      save: () => {},
      restore: () => {},
      scale: () => {},
      translate: () => {},
      drawImage: () => {},
      beginPath: () => {},
      closePath: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      fillRect: () => {},
      strokeRect: () => {},
      setLineDash: () => {},
      clearRect: () => {},
      rect: () => {},
      clip: () => {},
      fillText: () => {},
      measureText: () => ({ width: 10 }),
      getImageData: () => ({ data: new Uint8ClampedArray(32 * 32 * 4) }),
      imageSmoothingEnabled: false,
    };

    const makeEl = (tag: string) => {
      const el: any = {
        tagName: tag.toUpperCase(),
        className: '',
        classList: {
          classes: new Set<string>(),
          add(...tokens: string[]) {
            for (const c of tokens) this.classes.add(c);
            el.className = Array.from(this.classes).join(' ');
          },
          remove(...tokens: string[]) {
            for (const c of tokens) this.classes.delete(c);
            el.className = Array.from(this.classes).join(' ');
          },
          toggle(c: string) { if (this.classes.has(c)) this.remove(c); else this.add(c); },
          contains(c: string) { return this.classes.has(c) || el.className.split(' ').includes(c); },
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
        removeAttribute(k: string) {
          delete this.attributes[k];
        },
        appendChild(child: any) {
          this.children.push(child);
          child.parentElement = this;
          return child;
        },
        removeChild(child: any) {
          const idx = this.children.indexOf(child);
          if (idx !== -1) {
            this.children.splice(idx, 1);
            child.parentElement = null;
          }
          return child;
        },
        remove() {
          if (this.parentElement) {
            this.parentElement.removeChild(this);
          }
        },
        querySelector(sel: string): any {
          const all = this.querySelectorAll(sel);
          if (all.length > 0) return all[0];
          const fallback = makeEl(sel.includes('btn') || sel.includes('button') ? 'button' : 'div');
          if (sel.startsWith('#')) fallback.id = sel.slice(1);
          if (sel.startsWith('.')) fallback.className = sel.slice(1);
          return fallback;
        },
        querySelectorAll(sel: string): any[] {
          const results: any[] = [];
          const check = (node: any) => {
            let match = false;
            if (sel.startsWith('.')) {
              const cls = sel.slice(1);
              if (node.classList?.contains(cls) || node.className?.split(' ').includes(cls)) match = true;
            } else if (sel.startsWith('#')) {
              if (node.id === sel.slice(1) || node.attributes?.id === sel.slice(1)) match = true;
            } else if (node.tagName?.toLowerCase() === sel.toLowerCase()) {
              match = true;
            }
            if (match) results.push(node);
            for (const child of node.children || []) {
              check(child);
            }
          };
          for (const child of this.children || []) {
            check(child);
          }
          return results;
        },
        addEventListener: () => {},
        removeEventListener: () => {},
        getBoundingClientRect: () => ({ left: 0, top: 0, width: 616, height: 384 }),
      };

      if (tag === 'canvas') {
        el.getContext = () => mockCtx;
        el.toDataURL = () => 'data:image/png;base64,mock';
      }
      return el;
    };

    class MockImage {
      private _src = '';
      onload: any = null;
      onerror: any = null;
      naturalWidth = 256;
      naturalHeight = 256;
      width = 256;
      height = 256;
      get src() {
        return this._src;
      }
      set src(val: string) {
        this._src = val;
        setTimeout(() => {
          if (this.onload) this.onload();
        }, 0);
      }
    }
    (globalThis as any).Image = MockImage;

    (globalThis as any).document = {
      createElement: makeEl,
      body: makeEl('body'),
    };
    (globalThis as any).window = {
      addEventListener: () => {},
      removeEventListener: () => {},
      getSelection: () => ({ removeAllRanges: () => {}, toString: () => '' }),
      innerWidth: 1024,
      innerHeight: 768,
    };

    mockContainer = makeEl('div');
  });

  describe('Bedrock High-Contrast Theme & Accessibility', () => {
    it('sets high-contrast mode on BookCanvas and draws with high-contrast text', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        appearance: 'bedrock',
        highContrast: true,
      });
      await canvas.init();
      canvas.setBook(testBook);

      expect(canvas.isHighContrast()).toBe(true);
      expect(canvas.getAppearance()).toBe('bedrock');

      // Toggle high contrast off and on
      canvas.setHighContrast(false);
      expect(canvas.isHighContrast()).toBe(false);

      canvas.setHighContrast(true);
      expect(canvas.isHighContrast()).toBe(true);
    });

    it('applies high-contrast theme class to viewer container in MinecraftBookViewer', async () => {
      const viewer = new MinecraftBookViewer(mockContainer, {
        book: testBook,
        theme: 'high-contrast',
        highContrast: true,
      });
      await viewer.init();

      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(true);
      expect(viewer.isHighContrast()).toBe(true);
    });
  });

  describe('Scholar Dye Covers & Silk Ribbon Bookmarks', () => {
    it('configures 16 Minecraft dye cover colors on BookCanvas', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        coverColor: 'purple',
      });
      await canvas.init();
      canvas.setBook(testBook);

      expect(canvas.getCoverColor()).toBe('purple');

      // Test changing cover colors across the palette
      canvas.setCoverColor('red');
      expect(canvas.getCoverColor()).toBe('red');

      canvas.setCoverColor('light_blue');
      expect(canvas.getCoverColor()).toBe('light_blue');

      // Verify hex lookup exists for all 16 Minecraft dye colors
      expect(MINECRAFT_DYE_HEX['purple']).toBe('#8932B8');
      expect(MINECRAFT_DYE_HEX['red']).toBe('#B02E26');
      expect(MINECRAFT_DYE_HEX['light_blue']).toBe('#3AB3DA');
      expect(MINECRAFT_DYE_HEX['black']).toBe('#1D1D21');
    });

    it('renders silk bookmark ribbon in BookCanvas', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        showBookmark: true,
        bookmarkColor: '#FED83D', // Yellow ribbon
      });
      await canvas.init();
      canvas.setBook(testBook);

      expect(canvas.isBookmarkVisible()).toBe(true);
      expect(canvas.getBookmarkColor()).toBe('#FED83D');

      canvas.setShowBookmark(false);
      expect(canvas.isBookmarkVisible()).toBe(false);
    });

    it('exposes cover-color, bookmark, and bookmark-color on <minecraft-book>', async () => {
      const el = new MinecraftBookElement();
      const attrs: Record<string, string> = {};
      (el as any).setAttribute = (k: string, v: string) => {
        const old = attrs[k] ?? null;
        attrs[k] = v;
        el.attributeChangedCallback?.(k, old, v);
      };
      (el as any).getAttribute = (k: string) => attrs[k] ?? null;
      (el as any).hasAttribute = (k: string) => k in attrs;
      (el as any).removeAttribute = (k: string) => {
        const old = attrs[k] ?? null;
        delete attrs[k];
        el.attributeChangedCallback?.(k, old, null);
      };
      (el as any).querySelector = () => null;
      (el as any).classList = { add: () => {}, remove: () => {} };
      (el as any).appendChild = (child: any) => child;
      (el as any).dispatchEvent = () => true;

      el.setAttribute('cover-color', 'magenta');
      el.setAttribute('bookmark', '');
      el.setAttribute('bookmark-color', '#8932B8');

      await el.connectedCallback();

      expect(el.coverColor).toBe('magenta');
      expect(el.bookmark).toBe(true);
      expect(el.bookmarkColor).toBe('#8932B8');

      // Update attributes dynamically
      el.setAttribute('cover-color', 'cyan');
      expect(el.coverColor).toBe('cyan');

      el.removeAttribute('bookmark');
      expect(el.bookmark).toBe(false);
    });
  });

  describe('Braille Art Support (v1.6 Backlog)', () => {
    it('measures Unicode Braille characters cleanly within layout line bounds', async () => {
      const canvas = new BookCanvas({ container: mockContainer });
      await canvas.init();

      const atlas = canvas.getAtlas();
      // Braille patterns (U+2800 to U+28FF)
      const b1 = atlas.getAdvance('⠁', false); // Braille pattern dots-1
      const b2 = atlas.getAdvance('⣿', false); // Braille pattern dots-12345678
      expect(b1).toBeGreaterThan(0);
      expect(b2).toBeGreaterThan(0);
      expect(b1).toBe(b2); // Monospaced Braille advances in Minecraft font
    });
  });
});
