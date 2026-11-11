import { describe, it, expect, beforeEach } from 'vitest';
import { BookCanvas } from '../src/render/BookCanvas';
import { MinecraftBookViewer, BlockgameBookViewer } from '../src/ui/BlockgameBookViewer';
import { MinecraftBookElement, BlockgameBookElement } from '../src/component/blockgame-book';
import { MINECRAFT_DYE_HEX, MinecraftBook } from '../src/engine/types';

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

    it('applies the high-contrast container class in MinecraftBookViewer when experimental', async () => {
      const viewer = new MinecraftBookViewer(mockContainer, {
        book: testBook,
        experimental: true,
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

  describe('Experimental flag gating (Scholar covers, bookmarks, high contrast)', () => {
    /** Records every glyph color requested from the atlas while `fn` runs. */
    const recordGlyphColors = (canvas: BookCanvas, fn: () => void): string[] => {
      const atlas: any = canvas.getAtlas();
      const original = atlas.getGlyphDrawInfo;
      const colors: string[] = [];
      atlas.getGlyphDrawInfo = (ch: string, color: string, bold: boolean) => {
        colors.push(color);
        return original.call(atlas, ch, color, bold);
      };
      try {
        fn();
      } finally {
        atlas.getGlyphDrawInfo = original;
      }
      return colors;
    };

    const countCalls = (name: 'strokeRect' | 'fill', fn: () => void): number => {
      const original = mockCtx[name];
      let count = 0;
      mockCtx[name] = (...args: any[]) => {
        count++;
        return original?.(...args);
      };
      try {
        fn();
      } finally {
        mockCtx[name] = original;
      }
      return count;
    };

    it('defaults to experimental=false', async () => {
      const canvas = new BookCanvas({ container: mockContainer });
      await canvas.init();
      expect(canvas.isExperimental()).toBe(false);
    });

    it('does not draw cover dye or bookmark ribbon without experimental, but stores the values', async () => {
      const plain = new BookCanvas({ container: mockContainer });
      await plain.init();
      plain.setBook(testBook);
      const baselineStrokes = countCalls('strokeRect', () => plain.render());
      const baselineFills = countCalls('fill', () => plain.render());

      const canvas = new BookCanvas({
        container: mockContainer,
        coverColor: 'red',
        showBookmark: true,
        bookmarkColor: '#FED83D',
      });
      await canvas.init();
      canvas.setBook(testBook);

      expect(canvas.getCoverColor()).toBe('red');
      expect(canvas.isBookmarkVisible()).toBe(true);
      expect(countCalls('strokeRect', () => canvas.render())).toBe(baselineStrokes);
      expect(countCalls('fill', () => canvas.render())).toBe(baselineFills);
    });

    it('draws cover dye and bookmark ribbon once experimental is enabled', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        coverColor: 'red',
        showBookmark: true,
      });
      await canvas.init();
      canvas.setBook(testBook);
      const offStrokes = countCalls('strokeRect', () => canvas.render());
      const offFills = countCalls('fill', () => canvas.render());

      canvas.setExperimental(true);
      expect(canvas.isExperimental()).toBe(true);
      expect(countCalls('strokeRect', () => canvas.render())).toBeGreaterThan(offStrokes);
      expect(countCalls('fill', () => canvas.render())).toBeGreaterThan(offFills);

      canvas.setExperimental(false);
      expect(countCalls('strokeRect', () => canvas.render())).toBe(offStrokes);
    });

    it('ignores high contrast for Bedrock slate background without experimental', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        appearance: 'bedrock',
        highContrast: true,
      });
      await canvas.init();
      canvas.setBook(testBook);
      const hcBg = (canvas as any).bedrockBgHc;
      expect(hcBg).toBeTruthy();
      expect(hcBg).not.toBe((canvas as any).bedrockBg);

      const usedImages: any[] = [];
      const original = mockCtx.drawImage;
      mockCtx.drawImage = (img: any, ...rest: any[]) => {
        usedImages.push(img);
        return original?.(img, ...rest);
      };
      try {
        canvas.render();
        expect(usedImages).not.toContain(hcBg);

        usedImages.length = 0;
        canvas.setExperimental(true);
        canvas.render();
        expect(usedImages).toContain(hcBg);
      } finally {
        mockCtx.drawImage = original;
      }
    });

    it('draws default text white in Bedrock high contrast when experimental', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        appearance: 'bedrock',
        highContrast: true,
        experimental: true,
      });
      await canvas.init();
      canvas.setBook(testBook);

      const colors = recordGlyphColors(canvas, () => canvas.render());
      expect(colors).toContain('#FFFFFF');
      expect(colors).toContain('#FFFF55'); // page indicators
      expect(colors).not.toContain('#000000');
    });

    it('keeps default text black in Bedrock when high contrast is set without experimental', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        appearance: 'bedrock',
        highContrast: true,
      });
      await canvas.init();
      canvas.setBook(testBook);

      const colors = recordGlyphColors(canvas, () => canvas.render());
      expect(colors).toContain('#000000');
      expect(colors).not.toContain('#FFFFFF');
      expect(colors).not.toContain('#FFFF55');
    });

    it('draws default text white in Java high contrast when experimental, but keeps explicit colors', async () => {
      const canvas = new BookCanvas({
        container: mockContainer,
        highContrast: true,
        experimental: true,
      });
      await canvas.init();
      canvas.setBook({ title: 't', author: 'a', pages: ['plain text \u00a7cred text'] });

      const colors = recordGlyphColors(canvas, () => canvas.render());
      expect(colors).toContain('#FFFFFF');
      expect(colors).toContain('#FF5555'); // \u00a7c stays red
      expect(colors).not.toContain('#000000');
    });

    it('keeps Java text black when high contrast is set without experimental', async () => {
      const canvas = new BookCanvas({ container: mockContainer, highContrast: true });
      await canvas.init();
      canvas.setBook({ title: 't', author: 'a', pages: ['plain text'] });

      const colors = recordGlyphColors(canvas, () => canvas.render());
      expect(colors).toContain('#000000');
      expect(colors).not.toContain('#FFFFFF');
    });

    it('viewer: high-contrast container class requires experimental', async () => {
      const viewer = new BlockgameBookViewer(mockContainer, {
        book: testBook,
        highContrast: true,
      });
      await viewer.init();
      expect(viewer.isExperimental()).toBe(false);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(false);

      viewer.setExperimental(true);
      expect(viewer.isExperimental()).toBe(true);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(true);

      viewer.setHighContrast(false);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(false);

      viewer.setHighContrast(true);
      viewer.setExperimental(false);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(false);
      // The value is remembered, so re-enabling brings it back.
      expect(viewer.isHighContrast()).toBe(true);
      viewer.setExperimental(true);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(true);
    });

    it('viewer: always uses the transparent theme and ignores legacy theme values', async () => {
      const viewer = new BlockgameBookViewer(mockContainer, { book: testBook, theme: 'dark' as any });
      await viewer.init();
      expect(mockContainer.classList.contains('mc-theme-transparent')).toBe(true);
      expect(mockContainer.classList.contains('mc-theme-dark')).toBe(false);

      // Deprecated no-op: no class swap and no high-contrast side effect.
      viewer.setTheme('high-contrast');
      expect(mockContainer.classList.contains('mc-theme-transparent')).toBe(true);
      expect(mockContainer.classList.contains('mc-theme-high-contrast')).toBe(false);
      expect(viewer.isHighContrast()).toBe(false);
    });

    it('<blockgame-book> maps the experimental attribute and property to the viewer', async () => {
      const el = new BlockgameBookElement();
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

      await el.connectedCallback();
      const viewer = await el.whenReady();
      expect(el.experimental).toBe(false);
      expect(viewer.isExperimental()).toBe(false);

      el.setAttribute('experimental', '');
      expect(viewer.isExperimental()).toBe(true);
      expect(el.experimental).toBe(true);

      el.setAttribute('experimental', 'false');
      expect(viewer.isExperimental()).toBe(false);

      el.experimental = true;
      expect(attrs['experimental']).toBe('');
      expect(viewer.isExperimental()).toBe(true);

      el.experimental = false;
      expect('experimental' in attrs).toBe(false);
      expect(viewer.isExperimental()).toBe(false);
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
